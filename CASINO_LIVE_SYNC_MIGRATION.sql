-- Casino live-loop patch. Apply once in Supabase SQL Editor after the base casino schema.
-- Supabase Cron supports a 1-second schedule on supported Postgres versions.
create extension if not exists pg_cron;

alter table public.casino_rounds
  add column if not exists bet_count integer not null default 0,
  add column if not exists bet_total bigint not null default 0;

update public.casino_rounds r
set bet_count = coalesce(b.bet_count, 0), bet_total = coalesce(b.bet_total, 0)
from (
  select round_id, count(*)::integer as bet_count, sum(amount)::bigint as bet_total
  from public.casino_bets group by round_id
) b
where b.round_id = r.id;

-- The only data exposed to clients is the shared round state and aggregate bet totals.
alter table public.casino_rounds enable row level security;
revoke select on public.casino_rounds from public, anon, authenticated;
drop policy if exists "public read casino rounds" on public.casino_rounds;
create policy "public read casino rounds" on public.casino_rounds for select using (true);
grant select on public.casino_rounds to anon, authenticated;

create or replace function public.place_bet_rpc(p_player_id uuid, p_game_type text, p_bet_choice text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r casino_rounds; p players; now_ms bigint;
begin
  if p_amount < 100 or p_amount > 100000 then return jsonb_build_object('error','Ставка от 100 до 100 000'); end if;
  if p_game_type not in ('roulette','dice','race') then return jsonb_build_object('error','Неизвестная игра'); end if;
  if p_game_type='roulette' and p_bet_choice !~ '^(red|black|even|odd|zero|dozen[123]|col[123]|exact_(0|[1-9]|[12][0-9]|3[0-6]))$'
    then return jsonb_build_object('error','Неверная ставка на рулетку'); end if;
  if p_game_type='dice' and p_bet_choice !~ '^(under7|over7|exact7|double|exact_([2-9]|1[012]))$'
    then return jsonb_build_object('error','Неверная ставка на кости'); end if;
  if p_game_type='race' and p_bet_choice not in ('skyline','bmw','toyota','lada','priora','matiz')
    then return jsonb_build_object('error','Такой машины нет'); end if;

  select * into r from casino_rounds order by created_at desc, id desc limit 1 for update;
  now_ms := floor(extract(epoch from clock_timestamp())*1000);
  if not found or r.status <> 'betting' or r.end_time <= now_ms
    then return jsonb_build_object('error','Приём ставок закрыт'); end if;

  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if coalesce(p.money,0) < p_amount then return jsonb_build_object('error','Недостаточно денег'); end if;

  update players set money = money - p_amount where id = p_player_id;
  insert into casino_bets(round_id, player_id, game_type, bet_choice, amount)
  values (r.id, p_player_id, p_game_type, p_bet_choice, p_amount);
  update casino_rounds set bet_count = bet_count + 1, bet_total = bet_total + p_amount where id = r.id;
  perform log_action_rpc(p_player_id, 'casino_bet',
    jsonb_build_object('game',p_game_type,'choice',p_bet_choice,'round',r.id), -p_amount, p.money - p_amount);
  return jsonb_build_object('success', true, 'money', p.money - p_amount, 'round_id', r.id);
end $$;

-- Only the database clock advances the shared round; clients only subscribe and place bets.
create or replace function public.casino_advance()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare r casino_rounds; now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
begin
  select * into r from casino_rounds order by created_at desc, id desc limit 1 for update;
  if not found then return 0; end if;
  if r.status='betting' and r.end_time <= now_ms then
    perform spin_round_rpc(5000);
    return 1;
  end if;
  if r.status='spinning' and coalesce(r.end_time,0) <= now_ms then
    perform resolve_round_rpc(r.id);
    return 1;
  end if;
  return 0;
end $$;

create or replace function public.get_casino_round_rpc(p_player_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r casino_rounds;
begin
  select * into r from casino_rounds order by created_at desc, id desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'status', r.status, 'end_time', r.end_time,
    'roulette_result', r.roulette_result, 'dice_result', r.dice_result,
    'dice_first', r.dice_first, 'dice_second', r.dice_second, 'race_winner', r.race_winner,
    'bet_count', r.bet_count, 'bet_total', r.bet_total,
    'my_bets', coalesce((select jsonb_agg(jsonb_build_object(
      'game_type', game_type, 'bet_choice', bet_choice, 'amount', amount, 'status', status
    ) order by created_at desc) from casino_bets where round_id = r.id and player_id = p_player_id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
      'roulette_result', h.roulette_result, 'dice_result', h.dice_result, 'race_winner', h.race_winner
    )) from (select roulette_result, dice_result, race_winner from casino_rounds
            where status = 'result' order by created_at desc limit 10) h), '[]'::jsonb),
    'player_money', (select money from players where id = p_player_id),
    'server_now', floor(extract(epoch from clock_timestamp())*1000));
end $$;

-- Expose only round state over Supabase Realtime, never individual casino bets.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.casino_rounds';
    exception when duplicate_object then null; end;
  end if;
end $$;

-- Same job name makes the migration safe to re-run: it updates the existing schedule.
select cron.schedule('casino-live-tick', '1 second', $$select public.casino_tick_rpc();$$);
