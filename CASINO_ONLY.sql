-- дропаем кривые версии функций, которые ты вставил прошлым скриптом
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text AS sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'ensure_round','place_bet_rpc','resolve_round_rpc','spin_round_rpc','get_casino_round_rpc','casino_tick_rpc','casino_advance')
  loop
    execute 'drop function if exists public.' || r.sig || ' cascade';
  end loop;
end $$;

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

-- Фикс «вечной игры»: раньше просроченный betting сам закрывался здесь же (insert нового
-- betting), из-за чего два параллельных вызова могли породить ДВА новых цикла — счётчики
-- раундов рассинхронизировались и игра «зацикливалась». Теперь ensure_round НИКОГДА не
-- создаёт новый раунд, пока текущий не довёден до 'result' (ставкой на сам результат):
--   * 'spinning' — переходное состояние внутри resolve_round_rpc (одна транзакция).
--     Если раунд залип в нём дольше SPIN_GRACE_MS (сбой/старая версия функции) — доводим
--     его до 'result' той же ставкой на roulette_result, что уже записана в строке.
--   * 'betting' просрочен — НЕ трогаем: его закроет casino_advance() через resolve_round_rpc
--     (он корректно рассчитывает ставки и пишет результат ровно один раз).
--   * Новый 'betting' создаётся ТОЛЬКО когда последний раунд в статусе 'result' и фаза
--     результатов истекла — ровно один вставку, идемпотентно под FOR UPDATE.
create or replace function public.ensure_round()
returns void language plpgsql security definer as $$
declare r casino_rounds; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into r from casino_rounds order by created_at desc limit 1 for update;

  -- залипший spinning: результат уже разыгран и лежит в строке — просто доводим статус,
  -- повторного розыгрыша нет (ставки уже рассчитаны внутри resolve)
  if found and r.status = 'spinning' then
    if coalesce(r.end_time, 0) < now_ms - 8000 then
      update casino_rounds set status = 'result', end_time = now_ms + 10000 where id = r.id;
      return;
    end if;
    return; -- spinning идёт штатно, ждём
  end if;

  -- betting (в т.ч. просроченный) не трогаем — его закроет casino_advance()/resolve_round_rpc
  if found and r.status = 'betting' then
    return;
  end if;

  -- result: держим фазу итогов 10 секунд, потом открываем ОДИН новый betting
  if found and r.status = 'result' then
    if coalesce(r.end_time, 0) + 10000 > now_ms then return; end if;
    insert into casino_rounds(status, end_time) values ('betting', now_ms + 30000);
    return;
  end if;

  -- раундов вообще нет (первый запуск) — создаём
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
        when b.bet_choice = 'double' and v_dice1 = v_dice2 then 30
        when b.bet_choice = 'exact_' || v_dice then 30
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

  update casino_rounds set status='result', end_time = floor(extract(epoch from now())*1000) + 10000
  where id = p_round_id;
  perform log_action_rpc(null, 'casino_resolve',
    jsonb_build_object('round', p_round_id, 'roulette', v_roulette, 'dice', v_dice,
                       'race', v_winner, 'wins', win_cnt, 'losses', lose_cnt, 'payout', payout_total),
    null, null);
  return jsonb_build_object('resolved', true, 'roulette', v_roulette, 'dice', v_dice,
                            'race', v_winner, 'wins', win_cnt, 'payout', payout_total);
end $$;

-- внутренний тик: доводит все просроченные betting-раунды и зависшие spinning
create or replace function public.casino_advance()
returns int language plpgsql security definer as $$
declare r record; n int := 0; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  -- зависшие spinning (>8 сек) закрываем в result напрямую — ставки уже рассчитаны внутри resolve
  for r in select id from casino_rounds
            where status='spinning' and coalesce(end_time,0) < now_ms - 8000 loop
    update casino_rounds set status='result', end_time = now_ms + 5000 where id = r.id;
    n := n + 1;
  end loop;
  for r in select id from casino_rounds
            where status='betting' and end_time <= now_ms loop
    perform resolve_round_rpc(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- клиентский вход в цикл: при заходе на вкладку казино доводит ленивый цикл
-- (завершает истёкшие/зависшие раунды и гарантирует свежий betting-раунд). Возвращает текущий раунд.
create or replace function public.get_casino_round_rpc(p_player_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare r casino_rounds;
begin
  perform casino_advance();
  perform ensure_round();
  select * into r from casino_rounds order by created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'status', r.status, 'end_time', r.end_time,
    'roulette_result', r.roulette_result, 'dice_result', r.dice_result, 'race_winner', r.race_winner);
end $$;

-- вызывается из cron (api/casino.js): завершает истёкшие + создаёт новый раунд
create or replace function public.casino_tick_rpc()
returns jsonb language plpgsql security definer as $$
declare n int;
begin
  n := casino_advance();
  perform ensure_round();
  return jsonb_build_object('resolved', n, 'ok', true);
end $$;

-- ЯВНЫЙ СТарт анимации: клиент вызывает эту функцию сразу после принятия последней ставки
-- (или когда понял, что время ставок истекло). Она вычисляет ИТОГИ заранее, оставляет раунд
-- в 'spinning' на p_spin_ms миллисекунд и возвращает результат. Ставки при этом НЕ
-- рассчитываются — это делает resolve_round_rpc ровно один раз, когда спин закончится.
-- Так анимация гарантированно проигрывается целиком (машины доезжают, барабан останавливается),
-- а фаза 'result' стартует только после неё. Идемпотентна для одного раунда.
create or replace function public.spin_round_rpc(p_spin_ms int default 5000)
returns jsonb language plpgsql security definer as $$
declare r casino_rounds; v_roulette int; v_dice1 int; v_dice2 int; v_dice int;
        v_race_r numeric; v_winner text; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into r from casino_rounds order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('error','раунда нет'); end if;
  if r.status = 'spinning' then
    return jsonb_build_object('ok', true, 'already_spinning', true, 'until', r.end_time);
  end if;
  if r.status <> 'betting' then return jsonb_build_object('skipped', true, 'status', r.status); end if;
  if r.end_time > now_ms then
    -- до конца приёма ставок ещё есть время: спин начнётся автоматически по расписанию
    return jsonb_build_object('waiting', true, 'until', r.end_time);
  end if;

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

  p_spin_ms := greatest(1000, least(15000, coalesce(p_spin_ms, 5000)));
  update casino_rounds
     set status = 'spinning', end_time = now_ms + p_spin_ms,
         roulette_result = v_roulette, dice_result = v_dice, race_winner = v_winner
   where id = r.id;
  return jsonb_build_object('ok', true, 'until', now_ms + p_spin_ms);
end $$;

grant execute on function public.spin_round_rpc(int) to anon, authenticated;

-- Realtime: добавить таблицы казино в публикацию (для подписки клиента)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table casino_rounds'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table casino_bets';   exception when duplicate_object then null; end;
  end if;
end $$;

grant execute on all functions in schema public to anon, authenticated;
