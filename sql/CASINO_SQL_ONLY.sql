-- Только блок казино, если не хочешь гонять весь supabase_schema.sql повторно.
-- =================== 10. КАЗИНО (глобальный цикл раундов 45 сек) ============
create table if not exists public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'betting',   -- betting | spinning | result
  end_time bigint not null,                 -- мс, когда закрываются ставки
  roulette_result int,                      -- 0..36
  dice_result int,                          -- 2..12
  race_winner text,                         -- id машины
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_casino_rounds_created on casino_rounds (created_at desc);

create table if not exists public.casino_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references casino_rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  game_type text not null,                  -- roulette | dice | race
  bet_choice text not null,
  amount int not null check (amount > 0),
  status text not null default 'pending',   -- pending | won | lost
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_casino_bets_round on casino_bets (round_id, status);
create index if not exists idx_casino_bets_player on casino_bets (player_id, created_at desc);

alter table casino_rounds enable row level security;
alter table casino_bets   enable row level security;
drop policy if exists "read all" on casino_rounds; create policy "read all" on casino_rounds for select using (true);
drop policy if exists "read all" on casino_bets;   create policy "read all" on casino_bets   for select using (true);
drop policy if exists "no write" on casino_rounds; create policy "no write" on casino_rounds for all using (false) with check (false);
drop policy if exists "no write" on casino_bets;   create policy "no write" on casino_bets   for all using (false) with check (false);

-- гарантированно создаёт новый betting-раунд, если текущего нет (идемпотентно)
create or replace function public.ensure_round()
returns void language plpgsql security definer as $$
declare r casino_rounds; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into r from casino_rounds order by created_at desc limit 1 for update;
  if found and r.status = 'betting' and r.end_time > now_ms then return; end if;
  if found and r.status = 'betting' and r.end_time <= now_ms then
    update casino_rounds set status='spinning' where id = r.id;
  end if;
  insert into casino_rounds(status, end_time) values ('betting', now_ms + 30000);
end $$;

-- СТАВКА: списывает деньги сервером, защита от гонок через FOR UPDATE
create or replace function public.place_bet_rpc(p_player_id uuid, p_game_type text, p_bet_choice text, p_amount int)
returns jsonb language plpgsql security definer as $$
declare r casino_rounds; p players; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  if p_amount < 100 or p_amount > 100000 then return jsonb_build_object('error','ставка от 100 до 100 000₽'); end if;
  if p_game_type not in ('roulette','dice','race') then return jsonb_build_object('error','игра?'); end if;
  if p_game_type='roulette' and p_bet_choice !~ '^(red|black|even|odd|zero|dozen[123]|col[123]|exact_(0|[1-9]|[12][0-9]|3[0-6]))$'
    then return jsonb_build_object('error','неверная ставка на рулетку'); end if;
  if p_game_type='dice' and p_bet_choice !~ '^(under7|over7|exact7|double|exact_([2-9]|1[012]))$'
    then return jsonb_build_object('error','неверная ставка на кости'); end if;
  if p_game_type='race' and p_bet_choice not in ('skyline','bmw','toyota','lada','priora','matiz')
    then return jsonb_build_object('error','такой машины нет'); end if;

  select * into r from casino_rounds order by created_at desc limit 1 for update;
  if not found or r.status <> 'betting' or r.end_time <= now_ms
    then return jsonb_build_object('error','приём ставок закрыт'); end if;

  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','игрок не найден'); end if;
  if coalesce(p.money,0) < p_amount then return jsonb_build_object('error','недостаточно денег'); end if;

  update players set money = money - p_amount where id = p_player_id;
  insert into casino_bets(round_id, player_id, game_type, bet_choice, amount)
  values (r.id, p_player_id, p_game_type, p_bet_choice, p_amount);
  perform log_action_rpc(p_player_id, 'casino_bet',
    jsonb_build_object('game',p_game_type,'choice',p_bet_choice,'round',r.id), -p_amount, p.money - p_amount);
  return jsonb_build_object('success', true, 'money', p.money - p_amount, 'round_id', r.id);
end $$;

-- РОЗЫГРЫШ: вся математика RNG на сервере, нулевая погрешность
create or replace function public.resolve_round_rpc(p_round_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  r casino_rounds; b casino_bets;
  v_roulette int; v_dice1 int; v_dice2 int; v_dice int; v_race_r numeric; v_winner text;
  mult numeric; win_cnt int := 0; lose_cnt int := 0; payout_total bigint := 0;
  reds int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  select * into r from casino_rounds where id = p_round_id for update;
  if not found then return jsonb_build_object('error','раунд не найден'); end if;
  if r.status <> 'betting' then return jsonb_build_object('skipped', true, 'status', r.status); end if;

  v_roulette := floor(random() * 37)::int;
  v_dice1 := floor(random() * 6)::int + 1;
  v_dice2 := floor(random() * 6)::int + 1;
  v_dice := v_dice1 + v_dice2;
  v_race_r := random() * 100;
  v_winner := case
    when v_race_r <= 40   then 'skyline'
    when v_race_r <= 70   then 'bmw'
    when v_race_r <= 85   then 'toyota'
    when v_race_r <= 95   then 'lada'
    when v_race_r <= 99   then 'priora'
    else 'matiz' end;

  update casino_rounds set status='spinning',
    roulette_result=v_roulette, dice_result=v_dice, race_winner=v_winner
  where id = p_round_id;

  for b in select * from casino_bets where round_id = p_round_id and status = 'pending' loop
    mult := 0;
    if b.game_type = 'roulette' then
      mult := case
        when b.bet_choice = 'zero'  and v_roulette = 0 then 36
        when b.bet_choice = 'red'   and v_roulette = any(reds) then 2
        when b.bet_choice = 'black' and v_roulette <> 0 and not (v_roulette = any(reds)) then 2
        when b.bet_choice = 'even'  and v_roulette <> 0 and v_roulette % 2 = 0 then 2
        when b.bet_choice = 'odd'   and v_roulette % 2 = 1 then 2
        when b.bet_choice = 'dozen1' and v_roulette between 1 and 12 then 3
        when b.bet_choice = 'dozen2' and v_roulette between 13 and 24 then 3
        when b.bet_choice = 'dozen3' and v_roulette between 25 and 36 then 3
        when b.bet_choice = 'col1' and v_roulette <> 0 and v_roulette % 3 = 1 then 3
        when b.bet_choice = 'col2' and v_roulette <> 0 and v_roulette % 3 = 2 then 3
        when b.bet_choice = 'col3' and v_roulette <> 0 and v_roulette % 3 = 0 then 3
        when b.bet_choice = 'exact_' || v_roulette then 36
        else 0 end;
    elsif b.game_type = 'dice' then
      mult := case
        when b.bet_choice = 'under7' and v_dice < 7 then 2
        when b.bet_choice = 'over7'  and v_dice > 7 then 2
        when b.bet_choice = 'exact7' and v_dice = 7 then 5
        when b.bet_choice = 'double' and v_dice1 = v_dice2 then 5
        when b.bet_choice = 'exact_' || v_dice then case v_dice
          when 2 then 30 when 3 then 15 when 4 then 10 when 5 then 7.5
          when 6 then 6 when 7 then 5 when 8 then 6 when 9 then 7.5
          when 10 then 10 when 11 then 15 when 12 then 30 else 0 end
        else 0 end;
    else -- race
      mult := case
        when b.bet_choice = v_winner then case v_winner
          when 'skyline' then 2 when 'bmw' then 2.5 when 'toyota' then 3.5
          when 'lada' then 8 when 'priora' then 12 else 25 end
        else 0 end;
    end if;

    if mult > 0 then
      update casino_bets set status='won' where id = b.id;
      perform change_stats(b.player_id, floor(b.amount * mult), 0);
      win_cnt := win_cnt + 1; payout_total := payout_total + floor(b.amount * mult);
    else
      update casino_bets set status='lost' where id = b.id;
      lose_cnt := lose_cnt + 1;
    end if;
  end loop;

  update casino_rounds set status='result' where id = p_round_id;
  perform log_action_rpc(null, 'casino_resolve',
    jsonb_build_object('round', p_round_id, 'roulette', v_roulette, 'dice', v_dice,
                       'race', v_winner, 'wins', win_cnt, 'losses', lose_cnt, 'payout', payout_total),
    null, null);
  return jsonb_build_object('resolved', true, 'roulette', v_roulette, 'dice', v_dice,
                            'race', v_winner, 'wins', win_cnt, 'payout', payout_total);
end $$;

-- вызывается из cron (api/casino.js): завершает истёкшие + создаёт новый раунд
create or replace function public.casino_tick_rpc()
returns jsonb language plpgsql security definer as $$
declare r record; done jsonb := '[]'::jsonb;
begin
  for r in select id from casino_rounds
            where (status='betting' and end_time <= floor(extract(epoch from now())*1000))
               or status='spinning' loop
    perform resolve_round_rpc(r.id);
    done := done || to_jsonb(r.id);
  end loop;
  perform ensure_round();
  return jsonb_build_object('resolved', done, 'ok', true);
end $$;

grant execute on all functions in schema public to anon, authenticated;
