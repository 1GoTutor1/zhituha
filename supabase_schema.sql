-- ============================================================
-- ЖИТУХА — схема Supabase + все RPC-функции.
-- Выполнить ЦЕЛИКОМ в Supabase Dashboard → SQL Editor.
-- Повторное выполнение безопасно (drop-if-exists).
-- ============================================================

-- =================== 1. ТАБЛИЦЫ ===================
-- Таблицы players / businesses / business_workers / market_items / promo_codes /
-- promo_uses / action_logs УЖЕ СУЩЕСТВУЮТ в базе (сверено по твоим CREATE TABLE).
-- Скрипт их НЕ трогает и НЕ пересоздаёт — только функции и RLS ниже.

-- =================== 2. RLS ===================
alter table players          enable row level security;
alter table businesses       enable row level security;
alter table business_workers enable row level security;
alter table market_items     enable row level security;
alter table promo_codes      enable row level security;
alter table promo_uses       enable row level security;
alter table action_logs      enable row level security;

-- Чтение всем (анон-ключ): лидерборд, рынок, витрины салонов и т.д.
drop policy if exists "read all" on players;
drop policy if exists "read all" on businesses;       create policy "read all" on businesses       for select using (true);
drop policy if exists "read all" on business_workers; create policy "read all" on business_workers for select using (true);
drop policy if exists "read all" on market_items;     create policy "read all" on market_items     for select using (true);
drop policy if exists "read all" on promo_codes;
revoke select on promo_codes from public, anon, authenticated;

-- Запись с клиента ЗАПРЕЩЕНА везде, кроме регистрации (insert нового игрока).
-- Все мутации идут через security definer функции ниже.
-- UPDATE разрешён только на БЕЗОПАСНЫЕ поля (роль/деньги/бан менять с клиента нельзя)
drop policy if exists "safe profile update" on players;
create policy "safe profile update" on players for update
  using (true) with check (
    role is not distinct from players.role and
    is_banned is not distinct from players.is_banned and
    money is not distinct from players.money and
    energy is not distinct from players.energy and
    referral_balance is not distinct from players.referral_balance and
    tip_balance is not distinct from players.tip_balance and
    telegram_id is not distinct from players.telegram_id
  );
drop policy if exists "no delete" on players;         create policy "no delete" on players         for delete using (false);
drop policy if exists "reg insert" on players;
create policy "reg insert" on players for insert with check (false);
revoke insert, update, delete on players from public, anon, authenticated;
revoke select on players from public, anon, authenticated;
grant select, insert, update, delete on players to service_role;
drop policy if exists "no write" on businesses;       create policy "no write" on businesses       for all using (false) with check (false);
drop policy if exists "no write" on business_workers; create policy "no write" on business_workers for all using (false) with check (false);
drop policy if exists "no write" on market_items;     create policy "no write" on market_items     for all using (false) with check (false);
drop policy if exists "no write" on promo_codes;      create policy "no write" on promo_codes      for all using (false) with check (false);
drop policy if exists "no write" on promo_uses;       create policy "no write" on promo_uses       for all using (false) with check (false);
drop policy if exists "no direct write logs" on action_logs;
create policy "no direct write logs" on action_logs for all using (false) with check (false);

-- =================== 3. ХЕЛПЕРЫ ===================

-- Единая точка изменения денег/энергии (используется и bot.js).
-- ===========================================================================
-- 0. ГАРАНТИРОВАННОЕ УДАЛЕНИЕ СТАРЫХ ВЕРСИЙ ВСЕХ ФУНКЦИЙ (по всем возможным
--    сигнатурам). PostgreSQL не даёт менять через CREATE OR REPLACE типы
--    параметров или возвращаемый тип, поэтому функции сначала удаляются.
--    Данные таблиц при этом НЕ удаляются!
-- ===========================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text AS sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'change_stats','assert_owner','update_profile_rpc','rest_rpc','buy_phone_rpc',
        'buy_business_rpc','sell_business_rpc','finish_business_timer_rpc','claim_daily_reward_rpc','work_rpc','drink_tutorial_coffee_rpc','claim_tutorial_reward_rpc','start_car_order_rpc',
        'start_build_rpc','start_phone_order_rpc','collect_coffee_cash_rpc','collect_coffee_energy_rpc',
        'buy_coffee_rpc','taxi_add_car_rpc','taxi_collect_rpc','taxi_repair_rpc','hire_worker_rpc',
        'fire_worker_rpc','quit_job_rpc','list_item_rpc','buy_market_item','cancel_lot_rpc',
        'add_referral_balance','collect_ref_bonus_rpc','collect_tips_rpc','redeem_promo','reset_game_rpc',
        'is_admin','log_action_rpc','get_logs_rpc','cleanup_logs_rpc','create_promo_rpc',
        -- старые имена из прошлых версий скрипта:
        'register_player_rpc','set_subscribed_rpc','set_banned_rpc','get_player_by_tg','log_action',
        'tip_barista_rpc','claim_tips_rpc','claim_daily_rpc','brew_start_rpc','rob_business_rpc',
        'redeem_promo_rpc','admin_give_money_rpc','admin_set_ban_rpc','admin_delete_biz_rpc','claim_daily_rpc',
        -- экономика по дизайн-доку (новая версия):
        'pay_workers_for_batch','collect_coffee_cash_rpc_v2','check_player_economy_budget',
        -- защита ролей/зарплат на сервере:
        'validate_worker_role','role_count',
        -- казино (лечит 42P13 при повторном запуске):
        'ensure_round','place_bet_rpc','resolve_round_rpc','spin_round_rpc','get_casino_round_rpc','casino_tick_rpc','casino_advance'
      )
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

create or replace function public.change_stats(p_player_id uuid, p_money_diff bigint default 0, p_energy_diff int default 0)
returns jsonb language plpgsql security definer as $$
declare p players;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if coalesce(p.money,0) + p_money_diff < 0 then return jsonb_build_object('error','недостаточно денег'); end if;
  update players set
    money  = greatest(0, coalesce(money,0) + p_money_diff),
    energy = greatest(0, least(200, coalesce(energy,0) + p_energy_diff))
  where id = p_player_id;
  return jsonb_build_object('money', greatest(0, p.money + p_money_diff),
                            'energy', greatest(0, least(200, p.energy + p_energy_diff)));
end $$;

-- Защита от ручного вызова change_stats через серверный шлюз с произвольной суммой.
create table if not exists public.rpc_economy_limits (
  player_id uuid primary key references public.players(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  money_earned bigint not null default 0
);
alter table public.rpc_economy_limits enable row level security;
revoke all on public.rpc_economy_limits from public, anon, authenticated;
grant all on public.rpc_economy_limits to service_role;

create or replace function public.check_player_economy_budget(
  p_player_id uuid, p_money_diff bigint, p_energy_diff int default 0
) returns jsonb language plpgsql security definer as $$
declare quota rpc_economy_limits;
begin
  if abs(p_money_diff) > 5000 or abs(p_energy_diff) > 200 then
    return jsonb_build_object('ok', false, 'error', 'Изменение превышает лимит за одну операцию');
  end if;
  insert into rpc_economy_limits (player_id) values (p_player_id) on conflict (player_id) do nothing;
  select * into quota from rpc_economy_limits where player_id = p_player_id for update;
  if quota.window_started_at <= now() - interval '24 hours' then
    update rpc_economy_limits set window_started_at = now(), money_earned = 0
      where player_id = p_player_id returning * into quota;
  end if;
  if greatest(p_money_diff, 0) + quota.money_earned > 20000 then
    return jsonb_build_object('ok', false, 'error', 'Достигнут лимит начисления за 24 часа');
  end if;
  update rpc_economy_limits set money_earned = money_earned + greatest(p_money_diff, 0)
    where player_id = p_player_id;
  return jsonb_build_object('ok', true);
end $$;

-- Проверка, что бизнес принадлежит игроку (для всех biz-RPC).
create or replace function public.assert_owner(p_biz_id uuid, p_player_id uuid)
returns businesses language plpgsql security definer as $$
declare b businesses;
begin
  select * into b from businesses where id = p_biz_id and owner_id = p_player_id for update;
  if not found then raise exception 'not owner'; end if;
  return b;
end $$;

-- =================== ЭКОНОМИКА ПО ДИЗАЙН-ДОКУ ===================

-- СЕРВЕРНАЯ ВАЛИДАЦИЯ НАЁМА: роль должна соответствовать типу бизнеса,
-- зарплата — жёстко из дизайн-дока (клиенту не доверяем), места не заняты.
-- Возвращает null если ок, иначе текст ошибки.
create or replace function public.validate_worker_role(
  p_biz_id uuid, p_player_id uuid, p_role text, p_salary int)
returns text language plpgsql security definer as $$
declare b businesses; need int; allowed int; cnt int;
begin
  if p_role is null or p_salary is null then return 'Некорректная роль'; end if;
  select biz_type into b.biz_type from businesses where id = p_biz_id and owner_id = p_player_id;
  if not found then return 'бизнес не найден'; end if;

  -- один игрок = одна работа во всей игре
  if exists (select 1 from business_workers where player_id = p_player_id) then
    return 'уже работаешь'; end if;

  if b.biz_type = 'coffee' then
    if p_role = 'Бариста' then
      if p_salary <> 60 then return 'Зарплата бариста фиксирована: 60'; end if;
      allowed := 1;
    elsif p_role = 'Помощник бариста' then
      if p_salary <> 30 then return 'Зарплата помощника фиксирована: 30'; end if;
      allowed := 1;
    else return 'Такой роли в кофейне нет'; end if;
  elsif b.biz_type = 'salon' then
    if p_role = 'Механик' then
      if p_salary <> 10000 then return 'Зарплата механика фиксирована: 10000'; end if;
      allowed := 2;
    elsif p_role = 'Продавец' then
      if p_salary <> 15000 then return 'Зарплата продавца фиксирована: 15000'; end if;
      allowed := 1;
    else return 'Такой роли в автосалоне нет'; end if;
  elsif b.biz_type = 'phone_factory' then
    if p_role = 'Сборщик' then
      if p_salary <> 10000 then return 'Зарплата сборщика фиксирована: 10000'; end if;
      allowed := 2;
    elsif p_role = 'Инженер' then
      if p_salary <> 15000 then return 'Зарплата инженера фиксирована: 15000'; end if;
      allowed := 1;
    else return 'Такой роли в цехе нет'; end if;
  elsif b.biz_type = 'construction' then
    if p_role = 'Строитель' then
      if p_salary <> 10000 then return 'Зарплата строителя фиксирована: 10000'; end if;
      allowed := 3;
    elsif p_role = 'Прораб' then
      if p_salary <> 20000 then return 'Зарплата прораба фиксирована: 20000'; end if;
      allowed := 1;
    else return 'Такой роли в стройтресте нет'; end if;
  elsif b.biz_type = 'taxi' then
    if p_role = 'Водитель' then
      if p_salary <> 10 then return 'Ставка водителя фиксирована: 10% кассы'; end if;
      allowed := 2;
    elsif p_role = 'Механик' then
      if p_salary <> 5 then return 'Ставка механика фиксирована: 5% кассы'; end if;
      allowed := 1;
    else return 'Такой роли в таксопарке нет'; end if;
  else return 'Неизвестный тип бизнеса'; end if;

  select count(*) into cnt from business_workers
   where business_id = p_biz_id and role = p_role;
  if cnt >= allowed then return 'Места заняты (' || allowed || ')'; end if;
  return null; -- всё ок
end $$;

-- Число рабочих мест роли в бизнесе (сколько реально нанято).
create or replace function public.role_count(p_biz_id uuid, p_role text)
returns int language sql stable as $$
  select count(*)::int from business_workers where business_id = p_biz_id and role = p_role;
$$;

-- Выплата ЗП работягам за завершённую партию (салон/цех/стройка).
-- Строитель/Механик(салон)/Сборщик: 10000 за место. Прораб/Продавец/Инженер: доплата сверху.
create or replace function public.pay_workers_for_batch(p_biz_id uuid, p_worker_role text, p_boss_role text)
returns jsonb language plpgsql security definer as $$
declare worker_pay int; boss_pay int; n int; per_head bigint;
begin
  -- ЗП работяги (одинакова во всех трёх бизнесах), но НЕ больше лимита партии:
  -- стройка: 3 места x 10к = 30к из лимита 50к (Прораб забирает 20к);
  -- салон/цех: 2 x 10к + 15к начальника = 35к — ровно лимит.
  worker_pay := 10000;
  boss_pay   := case p_boss_role when 'Прораб' then 20000 when 'Продавец' then 15000 when 'Инженер' then 15000 else 0 end;
  n := public.role_count(p_biz_id, p_worker_role);

  if n > 0 then
    per_head := least(worker_pay::bigint, floor(50000 / n)); -- потолок суммарной ЗП за партию
    update players set money = coalesce(money,0) + per_head
    where id in (select player_id from business_workers where business_id = p_biz_id and role = p_worker_role);
    worker_pay := per_head::int;
  end if;
  if boss_pay > 0 and public.role_count(p_biz_id, p_boss_role) > 0 then
    update players set money = coalesce(money,0) + boss_pay
    where id in (select player_id from business_workers where business_id = p_biz_id and role = p_boss_role);
  end if;
  return jsonb_build_object('worker_pay', worker_pay * n,
                            'boss_pay',   case when public.role_count(p_biz_id, p_boss_role) > 0 then boss_pay else 0 end);
end $$;

-- =================== 4. ПРОФИЛЬ / РЕГИСТРАЦИЯ ===================

-- ВАРИАНТ А (упрощённая авторизация): проверка на клиентской стороне через pid.
-- Полноценная сверка по Telegram initData будет добавлена позже (вариант Б).
create or replace function public.update_profile_rpc(p_player_id uuid, p_updates jsonb)
returns void language plpgsql security definer as $$
begin
  if p_updates ? 'role' and p_updates->>'role' is distinct from 'player' then
    raise exception 'role change forbidden'; -- роль не меняется с клиента НИКОГДА
  end if;
  update players set
    nickname        = coalesce(p_updates->>'nickname', nickname),
    gender          = coalesce(p_updates->>'gender', gender),
    avatar_id       = coalesce((p_updates->>'avatar_id')::int, avatar_id),
    onboarding_step = greatest(coalesce(onboarding_step, 0), least(6, greatest(0, coalesce((p_updates->>'onboarding_step')::int, onboarding_step))))
  where id = p_player_id;
end $$;

create or replace function public.claim_daily_reward_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  elapsed bigint; next_streak int; reward_type text; reward_amount int := 0; next_boost bigint;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  elapsed := now_ms - coalesce(p.last_claim, 0);
  if coalesce(p.last_claim, 0) > 0 and elapsed < 86400000 then
    return jsonb_build_object('error', 'Награда ещё не готова');
  end if;
  if coalesce(p.last_claim, 0) > 0 and elapsed <= 172800000 and coalesce(p.daily_streak, 0) >= 7 then
    return jsonb_build_object('error', 'Приходи завтра');
  end if;
  if coalesce(p.last_claim, 0) = 0 or elapsed > 172800000 then next_streak := 1;
  else next_streak := least(coalesce(p.daily_streak, 0) + 1, 7); end if;

  if next_streak in (1, 3, 5, 7) then
    reward_type := 'money';
    reward_amount := case next_streak when 1 then 500 when 3 then 1000 when 5 then 1500 else 3500 end;
    if coalesce(p.boost_end, 0) > now_ms then reward_amount := floor(reward_amount * 1.1); end if;
  else
    reward_type := 'coffee';
  end if;
  next_boost := case when next_streak = 7 then now_ms + 86400000 else coalesce(p.boost_end, 0) end;

  update players set
    daily_streak = next_streak,
    last_claim = now_ms,
    boost_end = next_boost,
    money = coalesce(money, 0) + reward_amount,
    energy = case when reward_type = 'coffee'
      then greatest(coalesce(energy, 0), case when has_house then 150 else 100 end)
      else energy end
  where id = p_player_id
  returning * into p;
  return jsonb_build_object('daily_streak', next_streak, 'reward_type', reward_type,
    'reward_amount', reward_amount, 'money', p.money, 'energy', p.energy,
    'boost_end', p.boost_end, 'boost_awarded', next_streak = 7);
end $$;

create or replace function public.drink_tutorial_coffee_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; target_energy int;
begin
  select * into p from players where id = p_player_id for update;
  if not found or coalesce(p.onboarding_step, 0) <> 2 then
    return jsonb_build_object('error', 'Кофе доступен только на этом шаге обучения');
  end if;
  target_energy := case when p.has_house then 150 else 100 end;
  update players set energy = greatest(coalesce(energy,0), target_energy), onboarding_step = 3
    where id = p_player_id returning * into p;
  return jsonb_build_object('energy', p.energy, 'onboarding_step', p.onboarding_step);
end $$;

create or replace function public.claim_tutorial_reward_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players;
begin
  select * into p from players where id = p_player_id for update;
  if not found or coalesce(p.onboarding_step, 0) <> 5 then
    return jsonb_build_object('error', 'Награда доступна только после обучения');
  end if;
  update players set money = coalesce(money,0) + 2000, onboarding_step = 6
    where id = p_player_id returning * into p;
  return jsonb_build_object('money', p.money, 'onboarding_step', p.onboarding_step);
end $$;

create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; business_bonus int; energy_cost int; work_pay int;
  today text; hash_value bigint := 0; day_index int; i int;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  energy_cost := case when p.has_car then 10 else 20 end;
  if coalesce(p.energy,0) < energy_cost then return jsonb_build_object('error', 'Недостаточно энергии'); end if;

  select coalesce(sum(case biz_type when 'coffee' then 5 when 'salon' then 10 when 'taxi' then 15
    when 'phone_factory' then 20 when 'construction' then 25 else 0 end), 0)::int
    into business_bonus from businesses where owner_id = p_player_id;

  today := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  for i in 1..length(today) loop
    hash_value := mod(hash_value * 31 + ascii(substr(today, i, 1)), 4294967296);
    if hash_value < 0 then hash_value := hash_value + 4294967296; end if;
    if hash_value >= 2147483648 then hash_value := hash_value - 4294967296; end if;
  end loop;
  day_index := mod(abs(hash_value), 10)::int;
  work_pay := floor((case when day_index = 8 then 225 else 150 end) * (1 + business_bonus / 100.0));

  update players set money = coalesce(money,0) + work_pay, energy = coalesce(energy,0) - energy_cost
    where id = p_player_id returning * into p;
  if p.referred_by is not null then
    update players set referral_balance = coalesce(referral_balance,0) +
      floor(work_pay * 0.05 * case when day_index = 6 then 2 else 1 end)
      where telegram_id = p.referred_by;
  end if;
  return jsonb_build_object('money', p.money, 'energy', p.energy, 'work_pay', work_pay);
end $$;

-- Админ: выдать/забрать деньги + лог. Только для роли admin/superadmin.
create or replace function public.admin_give_money_rpc(
  p_admin_id uuid, p_target_player_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer as $$
declare a players; t players;
begin
  select * into a from players where id = p_admin_id;
  if a.role is distinct from 'admin' and a.role is distinct from 'superadmin' then
    return jsonb_build_object('error','не админ'); end if;
  select * into t from players where id = p_target_player_id for update;
  if not found then return jsonb_build_object('error','игрок не найден'); end if;
  if coalesce(t.money,0) + p_amount < 0 then return jsonb_build_object('error','уход в минус'); end if;
  update players set money = coalesce(money,0) + p_amount where id = p_target_player_id;
  perform log_action_rpc(p_target_player_id, 'admin_give_money',
    jsonb_build_object('from_admin', a.nickname), p_amount::int, (t.money + p_amount)::int);
  return jsonb_build_object('success', true, 'money', t.money + p_amount);
end $$;

-- Отдых (кд от last_rest_time, макс энергия зависит от дома)
create or replace function public.rest_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  p players;
  now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
  target_energy int;
  cooldown_ms int;
  today text;
  hash_value bigint := 0;
  day_index int;
  i int;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  cooldown_ms := case
    when coalesce(p.has_car, false) and p.car_model = 'toyota' then 70000
    when coalesce(p.has_car, false) and p.car_model = 'lada' then 80000
    else 90000
  end;

  -- Скидка дня "Автошоу" действует только у игроков с машиной.
  today := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  for i in 1..length(today) loop
    hash_value := mod(hash_value * 31 + ascii(substr(today, i, 1)), 4294967296);
    if hash_value >= 2147483648 then hash_value := hash_value - 4294967296; end if;
  end loop;
  day_index := mod(abs(hash_value), 10)::int;
  if coalesce(p.has_car, false) and day_index = 3 then
    cooldown_ms := floor(cooldown_ms * 0.8)::int;
  end if;

  if p.last_rest_time > 0 and now_ms - p.last_rest_time < cooldown_ms then
    return jsonb_build_object('error','Рано отдыхать');
  end if;
  target_energy := case when p.has_house then 150 else 100 end;
  update players set energy = greatest(coalesce(energy,0), target_energy),
                     last_rest_time = now_ms where id = p_player_id;
  return jsonb_build_object('energy', greatest(coalesce(p.energy,0), target_energy), 'rest_end', now_ms + cooldown_ms, 'rest_time', cooldown_ms);
end $$;

-- Телефон: покупка/сдача (влияет на market_slots)
create or replace function public.buy_phone_rpc(p_player_id uuid, p_is_buying boolean)
returns jsonb language plpgsql security definer as $$
declare p players; slots int;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if p_is_buying then
    if p.phone_count > 0 then return jsonb_build_object('error','телефон уже есть'); end if;
    if p.money < 2000 then return jsonb_build_object('error','мало денег'); end if;
    slots := coalesce(p.market_slots,3) + 2;
    update players set money = money - 2000, phone_count = 1, market_slots = slots where id = p_player_id;
    return jsonb_build_object('money', p.money - 2000, 'market_slots', slots);
  else
    if p.phone_count <= 0 then return jsonb_build_object('error','телефона нет'); end if;
    slots := greatest(3, coalesce(p.market_slots,3) - 2);
    update players set money = money + 1400, phone_count = 0, market_slots = slots where id = p_player_id;
    return jsonb_build_object('money', p.money + 1400, 'market_slots', slots);
  end if;
end $$;

-- =================== 5. БИЗНЕСЫ ===================

-- Сигнатура = фактический вызов из клиента (App.tsx): p_owner_id/p_owner_name/p_biz_type/p_biz_name/p_price.
-- Цена берётся с сервера по типу бизнеса (клиентскую p_price игнорируем — защита от читов).
create or replace function public.buy_business_rpc(p_owner_id uuid, p_owner_name text, p_biz_type text, p_biz_name text, p_price bigint default 0)
returns jsonb language plpgsql security definer as $$
declare p players; price int; mine int;
begin
  price := case p_biz_type
    when 'coffee' then 15000 when 'salon' then 150000 when 'taxi' then 300000
    when 'phone_factory' then 300000 when 'construction' then 500000 end;
  if price is null then return jsonb_build_object('error','bad type'); end if;
  select * into p from players where id = p_owner_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  select count(*) into mine from businesses where owner_id = p_owner_id and biz_type = p_biz_type;
  if mine > 0 then return jsonb_build_object('error','уже есть такой бизнес'); end if;
  if p.money < price then return jsonb_build_object('error','мало денег'); end if;
  update players set money = money - price where id = p_owner_id;
  insert into businesses (owner_id, owner_name, biz_type, business_name)
  values (p_owner_id, p_owner_name, p_biz_type, coalesce(nullif(p_biz_name,''), initcap(p_biz_type)));
  perform log_action_rpc(p_owner_id, 'buy_business', jsonb_build_object('type',p_biz_type), -price, p.money - price);
  return jsonb_build_object('success', true, 'money', p.money - price);
end $$;

create or replace function public.sell_business_rpc(p_owner_id uuid, p_biz_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; price int; refund int;
begin
  select * into b from businesses where id = p_biz_id and owner_id = p_owner_id for update;
  if not found then return jsonb_build_object('error','бизнес не найден'); end if;
  price := case b.biz_type
    when 'coffee' then 15000 when 'salon' then 150000 when 'taxi' then 300000
    when 'phone_factory' then 300000 when 'construction' then 500000 end;
  refund := floor(price * 0.5);
  delete from businesses where id = p_biz_id;
  perform change_stats(p_owner_id, refund, 0);
  return jsonb_build_object('refund', refund);
end $$;

-- Завершение таймера бизнеса (салон/стройка/цех). Идемпотентно: повторный вызов вернёт success=false.
create or replace function public.finish_business_timer_rpc(
  p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; s jsonb; now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
  deadline bigint; reward_key text; reward_amount int; pay jsonb;
begin
  b := public.assert_owner(p_biz_id, p_player_id);
  s := coalesce(b.stock, '{}'::jsonb);

  if b.biz_type = 'salon' then
    deadline := coalesce(b.car_order_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
    reward_key := s->>'current_model';
    reward_amount := coalesce((s->>'order_amount')::int, 0);
    if reward_key is null or reward_key not in ('lada', 'toyota') or reward_amount < 1 or reward_amount > 10 then
      return jsonb_build_object('success', false, 'error', 'invalid order');
    end if;
    s := jsonb_set(s, array[reward_key], to_jsonb(coalesce((s->>reward_key)::int, 0) + reward_amount));
    s := jsonb_set(jsonb_set(s, '{current_model}', '"none"'), '{order_amount}', '0');
    update businesses set stock = s, car_order_end = 0 where id = p_biz_id;
  elsif b.biz_type in ('construction','phone_factory') then
    deadline := coalesce(b.build_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
    if b.biz_type = 'construction' then
      reward_key := 'apartments';
      reward_amount := 10;
    else
      reward_key := s->>'current_phone_model';
      if reward_key = 'button' then reward_amount := 10;
      elsif reward_key = 'smartphone' then reward_amount := 5;
      else return jsonb_build_object('success', false, 'error', 'invalid production');
      end if;
    end if;
    s := jsonb_set(s, array[reward_key], to_jsonb(coalesce((s->>reward_key)::int, 0) + reward_amount));
    if b.biz_type = 'phone_factory' then s := jsonb_set(s, '{current_phone_model}', '"none"'); end if;
    update businesses set stock = s, build_end = 0 where id = p_biz_id;
  else
    return jsonb_build_object('success', false);
  end if;

  -- ЗП за завершённую партию (дизайн-док): работягам + начальнику, если наняты.
  pay := '{}'::jsonb;
  if b.biz_type = 'salon' then
    pay := public.pay_workers_for_batch(p_biz_id, 'Механик', 'Продавец');
  elsif b.biz_type = 'phone_factory' then
    pay := public.pay_workers_for_batch(p_biz_id, 'Сборщик', 'Инженер');
  elsif b.biz_type = 'construction' then
    pay := public.pay_workers_for_batch(p_biz_id, 'Строитель', 'Прораб');
  end if;

  return jsonb_build_object('success', true, 'pay', pay);
exception when others then
  return jsonb_build_object('success', false, 'error', 'business not owned');
end $$;

-- Автосалон: старт заказа машин.
-- Сервер сам считает цену партии, длительность (база 15/45 мин) и ШТРАФЫ по дизайн-доку:
--   без Механика (работяга, макс 2) — заказ не запускается;
--   без Продавца (начальник) — время x3 + 10% от стоимости партии ("таможня").
create or replace function public.start_car_order_rpc(
  p_biz_id uuid, p_player_id uuid, p_model text, p_amount int)
returns jsonb language plpgsql security definer as $$
declare b businesses; price bigint; base_ms bigint; end_ms bigint; fine bigint := 0;
  now_ms bigint := floor(extract(epoch from now())*1000); mech int; seller int;
begin
  if p_model not in ('lada','toyota') then return jsonb_build_object('error','bad model'); end if;
  if p_amount < 1 or p_amount > 10 then return jsonb_build_object('error','amount 1-10'); end if;
  price := (case p_model when 'lada' then 20000 else 50000 end) * p_amount;
  base_ms := case p_model when 'lada' then 900000 else 2700000 end; -- 15 / 45 мин
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'salon' then return jsonb_build_object('error','не автосалон'); end if;
  if coalesce(b.car_order_end,0) > now_ms then return jsonb_build_object('error','уже едут'); end if;
  if public.money_of(p_player_id) < price then return jsonb_build_object('error','мало денег на партию'); end if;
  mech   := public.role_count(p_biz_id, 'Механик');
  seller := public.role_count(p_biz_id, 'Продавец');
  if mech = 0 then return jsonb_build_object('error','Нет механика — заказ не оформить'); end if;
  if seller = 0 then base_ms := base_ms * 3; fine := floor(price * 0.10); end if;
  end_ms := now_ms + base_ms;
  update businesses set car_order_end = end_ms,
    stock = jsonb_set(jsonb_set(jsonb_set(coalesce(stock,'{}'), '{current_model}', to_jsonb(p_model)),
      '{order_amount}', to_jsonb(p_amount)), '{order_fine}', to_jsonb(fine))
  where id = p_biz_id;
  perform change_stats(p_player_id, -(price + fine), 0);
  return jsonb_build_object('money', (select money from players where id = p_player_id),
                            'car_order_end', end_ms, 'fine', fine);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Заметка для функций ниже: money_of — быстрый читатель баланса (для проверок "мало денег").
create or replace function public.money_of(p_player_id uuid)
returns bigint language sql stable security definer as $$
  select coalesce(money,0)::bigint from players where id = p_player_id;
$$;

-- Стройка: старт строительства дома.
-- По дизайн-доку: себестоимость 350 000₽, база 1 час. Без Строителя (макс 3, обязателен) —
-- стройка не запускается. Без Прораба — время x3 + 5 000₽/час штрафа из кассы (списывается при старте).
create or replace function public.start_build_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; end_ms bigint; base_ms bigint := 3600000; fine bigint := 0;
  now_ms bigint := floor(extract(epoch from now())*1000); builders int; foreman int;
begin
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'construction' then return jsonb_build_object('error','не стройтрест'); end if;
  if coalesce(b.build_end,0) > now_ms then return jsonb_build_object('error','стройка идет'); end if;
  builders := public.role_count(p_biz_id, 'Строитель');
  foreman  := public.role_count(p_biz_id, 'Прораб');
  if builders = 0 then return jsonb_build_object('error','Нет строителей — стройка не начнется'); end if;
  if foreman = 0 then base_ms := base_ms * 3; fine := 5000; end if; -- 5000₽/час простоя
  end_ms := now_ms + base_ms;
  update businesses set build_end = end_ms,
    stock = jsonb_set(coalesce(stock,'{}'), '{build_fine}', to_jsonb(fine))
  where id = p_biz_id;
  perform change_stats(p_player_id, -(350000 + fine), 0);
  return jsonb_build_object('money',(select money from players where id=p_player_id),'build_end',end_ms,'fine',fine);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Цех: старт партии телефонов.
-- Кнопочные: 7 000₽ / партия 10 шт / 10 мин. Смартфоны: 25 000₽ / партия 5 шт / 30 мин.
-- Без Сборщика (макс 2, обязателен) — производство не запускается.
-- Без Инженера — время x3 + 3 000₽ за простой станка.
create or replace function public.start_phone_order_rpc(p_biz_id uuid, p_player_id uuid, p_model text)
returns jsonb language plpgsql security definer as $$
declare b businesses; price int; base_ms bigint; end_ms bigint; fine bigint := 0;
  now_ms bigint := floor(extract(epoch from now())*1000); asm_ int; eng int;
begin
  if p_model not in ('button','smartphone') then return jsonb_build_object('error','bad model'); end if;
  price   := case p_model when 'button' then 7000 else 25000 end;
  base_ms := case p_model when 'button' then 600000 else 1800000 end; -- 10 / 30 мин
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'phone_factory' then return jsonb_build_object('error','не цех'); end if;
  if coalesce(b.build_end,0) > now_ms then return jsonb_build_object('error','идет производство'); end if;
  asm_ := public.role_count(p_biz_id, 'Сборщик');
  eng  := public.role_count(p_biz_id, 'Инженер');
  if asm_ = 0 then return jsonb_build_object('error','Нет сборщиков — станок стоит'); end if;
  if eng = 0 then base_ms := base_ms * 3; fine := 3000; end if;
  end_ms := now_ms + base_ms;
  update businesses set build_end = end_ms,
    stock = jsonb_set(jsonb_set(coalesce(stock,'{}'), '{current_phone_model}', to_jsonb(p_model)),
      '{prod_fine}', to_jsonb(fine))
  where id = p_biz_id;
  perform change_stats(p_player_id, -(price + fine), 0);
  return jsonb_build_object('money',(select money from players where id=p_player_id),'build_end',end_ms,'fine',fine);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Кофейня: сбор кассы в карман.
-- По дизайн-доку касса уже содержит долю владельца (410 с чашки, без помощника — 440):
-- распределение чаевых/ЗП происходит при продаже кофе (buy_coffee_rpc).
create or replace function public.collect_coffee_cash_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; amt bigint; referrer_tg text;
begin
  b := assert_owner(p_biz_id, p_player_id);
  amt := coalesce(b.coffee_balance, 0);
  if amt <= 0 then return jsonb_build_object('error','касса пуста'); end if;
  update businesses set coffee_balance = 0 where id = p_biz_id;
  perform change_stats(p_player_id, amt, 0);
  select referred_by into referrer_tg from players where id = p_player_id;
  if referrer_tg is not null then
    update players set referral_balance = coalesce(referral_balance,0) + floor(amt * 0.05)
      where telegram_id = referrer_tg;
  end if;
  return jsonb_build_object('collected', amt, 'money', (select money from players where id = p_player_id));
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Tutorial-кофе: энергия игрока (brew_end на players)
create or replace function public.collect_coffee_energy_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('success', false); end if;
  if coalesce(p.brew_end,0) = 0 then return jsonb_build_object('success', false); end if;
  if now_ms < p.brew_end then return jsonb_build_object('success', false, 'brew_end', p.brew_end); end if;
  update players set energy = greatest(coalesce(energy,0), case when has_house then 150 else 100 end),
                     brew_end = 0 where id = p_player_id;
  return jsonb_build_object('success', true, 'energy', greatest(coalesce(p.energy,0), case when p.has_house then 150 else 100 end));
end $$;

-- Кофейня: покупатель варит кофе у конкретного кафе.
-- Экономика чашки 500₽ по дизайн-доку (всё считает сервер):
--   Бариста (обязателен, без него кнопка не работает) -> +60 чаевых;
--   Помощник бариста (опционален) -> +30 чаевых, иначе эти 30 забирает владелец;
--   Владелец -> 410 в кассу (+30 если помощника нет = 440).
create or replace function public.buy_coffee_rpc(p_buyer_id uuid, p_cafe_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; c businesses; now_ms bigint := floor(extract(epoch from now())*1000);
  barista record; helper record; owner_share int;
begin
  select * into p from players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error','нет игрока'); end if;
  if p.money < 500 then return jsonb_build_object('error','мало денег'); end if;
  select * into c from businesses where id = p_cafe_id and biz_type = 'coffee' for update;
  if not found then return jsonb_build_object('error','кафе не найдено'); end if;
  if coalesce(p.brew_end,0) > now_ms then return jsonb_build_object('error','кофе уже варится'); end if;

  -- бариста обязателен (по дизайн-доку)
  select w.* into barista from business_workers w
    where w.business_id = p_cafe_id and w.role = 'Бариста' limit 1;
  if barista.player_id is null then return jsonb_build_object('error','В кафе нет бариста'); end if;
  -- помощник опционален
  select w.* into helper from business_workers w
    where w.business_id = p_cafe_id and w.role = 'Помощник бариста' limit 1;

  owner_share := case when helper.player_id is null then 440 else 410 end;

  update players set money = money - 500, brew_end = now_ms + 15000 where id = p_buyer_id;
  update businesses set coffee_balance = coalesce(coffee_balance,0) + owner_share where id = p_cafe_id;
  -- ЗП работягам капает сразу в чаевые (tip_balance), забираются collect_tips_rpc
  update players set tip_balance = coalesce(tip_balance,0) + 60 where id = barista.player_id;
  if helper.player_id is not null then
    update players set tip_balance = coalesce(tip_balance,0) + 30 where id = helper.player_id;
  end if;
  -- ВАЖНО: владельцу кафе идёт ТОЛЬКО owner_share в кассу (410/440).
  -- Никаких доп. бонусов — иначе экономика чашки ломается (было +25 сверху).
  return jsonb_build_object('brew_end', now_ms + 15000, 'money', p.money - 500,
                            'owner_share', owner_share, 'cafe_id', p_cafe_id);
end $$;

-- =================== 6. ТАКСОПАРК ===================

create or replace function public.taxi_add_car_rpc(p_biz_id uuid, p_player_id uuid, p_model text)
returns jsonb language plpgsql security definer as $$
declare b businesses; price int; m jsonb;
begin
  if p_model not in ('lada','toyota') then return jsonb_build_object('error','bad model'); end if;
  price := case p_model when 'lada' then 20000 else 50000 end;
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'taxi' then return jsonb_build_object('error','не таксопарк'); end if;
  m := jsonb_build_object('model', p_model, 'health', 100,
        'last_claim', floor(extract(epoch from now())*1000));
  update businesses set stock = jsonb_set(coalesce(stock,'{}'), '{taxi_cars}',
        coalesce(stock->'taxi_cars','[]'::jsonb) || m) where id = p_biz_id;
  perform change_stats(p_player_id, -price, 0);
  return jsonb_build_object('money', (select money from players where id = p_player_id));
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Таксопарк: сбор дохода. По дизайн-доку:
--   доход Лада 1000/час, Тойота 1500/час, копится до 8 часов;
--   без Водителя (макс 2, обязателен) — машины стоят, доход 0;
--   Водитель забирает 10% от кассы (делит поровну между нанятыми), Механик — 5%;
--   без Механика износ 50%/час, с ним — обычный 8%/час.
create or replace function public.taxi_collect_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; cars jsonb; car jsonb; drv record; mech record;
  now_ms bigint := floor(extract(epoch from now())*1000);
  total bigint := 0; gross bigint := 0; hours numeric; inc int; wear int;
  drivers int; out jsonb := '[]'::jsonb; drv_share int; mech_share int;
begin
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'taxi' then return jsonb_build_object('error','не таксопарк'); end if;

  drivers := public.role_count(p_biz_id, 'Водитель');
  if drivers = 0 then return jsonb_build_object('error','Нет водителей — машины стоят'); end if;
  select w.* into mech from business_workers w where w.business_id = p_biz_id and w.role = 'Механик' limit 1;
  wear := case when mech.player_id is null then 50 else 8 end; -- % износа в час

  cars := coalesce(b.stock->'taxi_cars','[]'::jsonb);
  for car in select * from jsonb_array_elements(cars) loop
    if (car->>'health')::int <= 0 then out := out || car; continue; end if;
    hours := least(((now_ms - (car->>'last_claim')::bigint) / 3600000.0)::numeric, 8);
    inc := floor(hours * (case car->>'model' when 'lada' then 1000 else 1500 end))::int;
    gross := gross + inc;
    out := out || jsonb_set(
      jsonb_set(car, '{health}', to_jsonb(greatest(0, (car->>'health')::int - floor(hours * wear)::int))),
      '{last_claim}', to_jsonb(now_ms));
  end loop;
  if gross = 0 then return jsonb_build_object('error','Еще рано собирать доход'); end if;

  -- распределение по дизайн-доку: водители 10%, механик 5%, владельцу 85%
  drv_share  := floor(gross * 0.10)::int;
  mech_share := case when mech.player_id is null then 0 else floor(gross * 0.05)::int end;
  total := gross - drv_share - mech_share;

  if drv_share > 0 then
    update players set tip_balance = coalesce(tip_balance,0) + floor(drv_share / drivers)
    where id in (select player_id from business_workers where business_id = p_biz_id and role = 'Водитель');
  end if;
  if mech_share > 0 then
    update players set tip_balance = coalesce(tip_balance,0) + mech_share where id = mech.player_id;
  end if;

  update businesses set stock = jsonb_set(coalesce(stock,'{}'), '{taxi_cars}', out) where id = p_biz_id;
  perform change_stats(p_player_id, total, 0);
  return jsonb_build_object('income', total, 'gross', gross,
    'money', (select money from players where id = p_player_id),
    'stock', jsonb_set(coalesce(b.stock,'{}'), '{taxi_cars}', out));
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

create or replace function public.taxi_repair_rpc(p_biz_id uuid, p_player_id uuid, p_car_index int)
returns jsonb language plpgsql security definer as $$
declare b businesses; cars jsonb; cost int;
begin
  b := assert_owner(p_biz_id, p_player_id);
  cars := b.stock->'taxi_cars';
  if cars is null or jsonb_array_length(cars) <= p_car_index then return jsonb_build_object('error','машины нет'); end if;
  cost := case cars->p_car_index->>'model' when 'lada' then 3000 else 10000 end;
  cars := jsonb_set(cars, array[p_car_index::text],
    jsonb_set(jsonb_set(cars->p_car_index, '{health}', '100'),
              '{last_claim}', to_jsonb(floor(extract(epoch from now())*1000))));
  update businesses set stock = jsonb_set(stock, '{taxi_cars}', cars) where id = p_biz_id;
  perform change_stats(p_player_id, -cost, 0);
  return jsonb_build_object('money', (select money from players where id = p_player_id));
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- =================== 7. СОТРУДНИКИ ===================

create or replace function public.hire_worker_rpc(
  p_player_id uuid, p_player_name text, p_business_id uuid, p_role text, p_salary int)
returns jsonb language plpgsql security definer as $$
declare vtext text;
begin
  -- серверная проверка: роль/зарплата/места по дизайн-доку (клиенту не верим)
  vtext := public.validate_worker_role(p_business_id, p_player_id, p_role, p_salary);
  if vtext is not null then return jsonb_build_object('error', vtext); end if;
  insert into business_workers (business_id, player_id, player_name, role, salary)
  values (p_business_id, p_player_id, p_player_name, p_role, p_salary);
  return jsonb_build_object('workers',
    (select jsonb_agg(w2) from business_workers w2 where w2.business_id = p_business_id));
end $$;

create or replace function public.fire_worker_rpc(p_worker_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare w business_workers;
begin
  select * into w from business_workers where id = p_worker_id;
  if not found then return jsonb_build_object('error','не найдено'); end if;
  if not exists (select 1 from businesses b where b.id = w.business_id and b.owner_id = p_player_id) then
    return jsonb_build_object('error','нет доступа');
  end if;
  delete from business_workers where id = p_worker_id;
  return jsonb_build_object('workers',
    (select jsonb_agg(w2) from business_workers w2 where w2.business_id = w.business_id));
end $$;


create or replace function public.quit_job_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
begin
  delete from business_workers where player_id = p_player_id;
  return jsonb_build_object('success', true);
end $$;

-- =================== 8. РЫНОК ===================

-- Выставить лот. p_source: 'personal' | 'stock'. Со склада — списывает 1 шт. из stock бизнеса.
-- ВАЖНО: в реальной таблице market_items нет колонок source/status — источник хранится
-- внутри item_data как 'personal:<тип>' / 'stock:<тип>', снятие лота = DELETE строки.
create or replace function public.list_item_rpc(
  p_seller_id uuid, p_item_type text, p_item_data text, p_price bigint,
  p_source text, p_bonus_slots int default 0)
returns jsonb language plpgsql security definer as $$
declare p players; b businesses; used int; cap int;
begin
  if p_price is null or p_price <= 0 or p_price > 100000000 then return jsonb_build_object('error','цена?'); end if;
  if p_source not in ('personal','stock') then return jsonb_build_object('error','source?'); end if;
  if p_bonus_slots < 0 or p_bonus_slots > 2 then return jsonb_build_object('error','bonus slots?'); end if;
  if p_item_type is null or p_item_data is null or not ((p_item_type = 'phone' and
       ((p_source = 'stock' and p_item_data in ('button','smartphone')) or (p_source = 'personal' and p_item_data = 'phone')))
       or (p_item_type = 'car' and p_item_data in ('lada','toyota'))
       or (p_item_type = 'house' and p_item_data = 'apartment')) then
    return jsonb_build_object('error','invalid item');
  end if;
  select * into p from players where id = p_seller_id for update;
  if not found then return jsonb_build_object('error','нет игрока'); end if;
  select count(*) into used from market_items where seller_id = p_seller_id;
  cap := coalesce(p.market_slots,3) + coalesce(p_bonus_slots,0);
  if used >= cap then return jsonb_build_object('error','нет свободных слотов'); end if;

  if p_source = 'stock' then
    -- берём первый бизнес нужного типа у продавца и списываем 1 штуку
    select * into b from businesses
      where owner_id = p_seller_id
        and biz_type = case p_item_type when 'car' then 'salon' when 'house' then 'construction'
                                        when 'phone' then 'phone_factory' end
      for update;
    if not found then return jsonb_build_object('error','нет бизнеса-склада'); end if;
    if coalesce((b.stock->>p_item_data)::int, 0) < 1 then return jsonb_build_object('error','склад пуст'); end if;
    update businesses set stock = jsonb_set(stock, array[p_item_data],
      to_jsonb((stock->>p_item_data)::int - 1)) where id = b.id;
  elsif p_source = 'personal' then
    if p_item_type = 'phone' and coalesce(p.phone_count,0) < 1 then return jsonb_build_object('error','нет телефона'); end if;
    if p_item_type = 'car'   and not p.has_car   then return jsonb_build_object('error','нет машины'); end if;
    if p_item_type = 'house' and not p.has_house then return jsonb_build_object('error','нет дома'); end if;
    -- снимаем личное имущество на время продажи
    update players set
      phone_count = case when p_item_type='phone' then greatest(0, phone_count-1) else phone_count end,
      has_car     = case when p_item_type='car' then false else has_car end,
      car_model   = case when p_item_type='car' then 'none' else car_model end,
      has_house   = case when p_item_type='house' then false else has_house end,
      house_type  = case when p_item_type='house' then 'none' else house_type end
    where id = p_seller_id;
  else
    return jsonb_build_object('error','source?');
  end if;

  insert into market_items (seller_id, seller_name, item_type, item_data, price)
  values (p_seller_id, p.nickname, p_item_type, p_source || ':' || p_item_data, p_price);
  return jsonb_build_object('success', true);
end $$;

-- Покупка лота: деньги buyer→seller минус комиссия, лот удаляется (DELETE).
-- item_data хранится как 'personal:<тип>' / 'stock:<тип>'.
create or replace function public.buy_market_item(p_buyer_id uuid, p_item_id uuid, p_commission_percent int default 5)
returns jsonb language plpgsql security definer as $$
declare m market_items; buyer players; payout bigint; real_data text; item_source text;
begin
  if p_commission_percent is null or p_commission_percent not in (0, 5) then return jsonb_build_object('error','invalid commission'); end if;
  select * into m from market_items where id = p_item_id for update;
  if not found then return jsonb_build_object('error','лот не найден'); end if;
  if m.seller_id = p_buyer_id then return jsonb_build_object('error','себе не продашь'); end if;
  select * into buyer from players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error','нет покупателя'); end if;
  if buyer.money < m.price then return jsonb_build_object('error','мало денег'); end if;

  real_data := split_part(m.item_data, ':', 2);   -- 'personal:lada' -> 'lada'
  item_source := split_part(m.item_data, ':', 1);
  if m.item_type is null or real_data is null or not ((m.item_type = 'phone' and
       ((item_source = 'stock' and real_data in ('button','smartphone')) or (item_source = 'personal' and real_data = 'phone')))
       or (m.item_type = 'car' and real_data in ('lada','toyota'))
       or (m.item_type = 'house' and real_data = 'apartment')) then
    return jsonb_build_object('error','invalid item');
  end if;
  if (m.item_type = 'phone' and coalesce(buyer.phone_count,0) > 0)
     or (m.item_type = 'car' and coalesce(buyer.has_car,false))
     or (m.item_type = 'house' and coalesce(buyer.has_house,false)) then
    return jsonb_build_object('error','item already owned');
  end if;
  delete from market_items where id = p_item_id;
  perform change_stats(p_buyer_id, -m.price, 0);
  update players set
    phone_count = case when m.item_type = 'phone' then coalesce(phone_count,0) + 1 else phone_count end,
    has_car = case when m.item_type = 'car' then true else has_car end,
    car_model = case when m.item_type = 'car' then real_data else car_model end,
    has_house = case when m.item_type = 'house' then true else has_house end,
    house_type = case when m.item_type = 'house' then real_data else house_type end
  where id = p_buyer_id;
  payout := m.price - floor(m.price * p_commission_percent / 100.0);
  perform change_stats(m.seller_id, payout, 0);
  return jsonb_build_object('success', true, 'item_type', m.item_type, 'item_data', real_data,
                            'money', buyer.money - m.price);
end $$;

-- Снять лот: вернуть товар (личное имущество или на склад) и DELETE строки лота.
create or replace function public.cancel_lot_rpc(p_player_id uuid, p_item_id uuid, p_add_stock boolean default false)
returns jsonb language plpgsql security definer as $$
declare m market_items; b businesses; real_data text; src text;
begin
  select * into m from market_items where id = p_item_id and seller_id = p_player_id for update;
  if not found then return jsonb_build_object('error','лот не найден'); end if;
  src       := split_part(m.item_data, ':', 1);    -- 'personal' | 'stock'
  real_data := split_part(m.item_data, ':', 2);    -- 'lada' | 'phone' | ...
  delete from market_items where id = p_item_id;

  if src = 'personal' then
    update players set
      phone_count = case when m.item_type='phone' then phone_count+1 else phone_count end,
      has_car     = case when m.item_type='car' then true else has_car end,
      car_model   = case when m.item_type='car' then real_data else car_model end,
      has_house   = case when m.item_type='house' then true else has_house end,
      house_type  = case when m.item_type='house' then real_data else house_type end
    where id = p_player_id;
  elsif p_add_stock then
    select * into b from businesses
      where owner_id = p_player_id
        and biz_type = case m.item_type when 'car' then 'salon' when 'house' then 'construction'
                                        when 'phone' then 'phone_factory' end
      for update;
    if found then
      update businesses set stock = jsonb_set(coalesce(stock,'{}'), array[real_data],
        to_jsonb(coalesce((stock->>real_data)::int, 0) + 1)) where id = b.id;
    end if;
  end if;
  return jsonb_build_object('success', true, 'item_type', m.item_type, 'item_data', real_data);
end $$;

-- =================== 9. РЕФЕРРЫ / ТИПЫ / ПРОМО ===================

create or replace function public.add_referral_balance(p_telegram_id text, p_amount bigint)
returns void language sql security definer as $$
  update players set referral_balance = coalesce(referral_balance,0) + p_amount where telegram_id = p_telegram_id;
$$;

create or replace function public.collect_ref_bonus_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; amt bigint;
begin
  select * into p from players where id = p_player_id for update;
  amt := coalesce(p.referral_balance, 0);
  if amt <= 0 then return jsonb_build_object('error','пусто'); end if;
  update players set referral_balance = 0 where id = p_player_id;
  perform change_stats(p_player_id, amt, 0);
  return jsonb_build_object('collected', amt, 'money', (select money from players where id = p_player_id));
end $$;

create or replace function public.collect_tips_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; amt bigint;
begin
  select * into p from players where id = p_player_id for update;
  amt := coalesce(p.tip_balance, 0);
  if amt <= 0 then return jsonb_build_object('error','чаевых нет'); end if;
  update players set tip_balance = 0 where id = p_player_id;
  perform change_stats(p_player_id, amt, 0);
  return jsonb_build_object('collected', amt, 'money', (select money from players where id = p_player_id));
end $$;

-- Промокоды живут в РЕАЛЬНЫХ таблицах promo_codes + promo_uses (см. CREATE TABLE пользователя).

create or replace function public.redeem_promo(p_code text, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare pr promo_codes; already boolean;
begin
  if p_player_id is null then return jsonb_build_object('error','нет игрока'); end if;
  select * into pr from promo_codes where upper(code) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('error','промокод не найден'); end if;
  if coalesce(pr.used_count,0) >= coalesce(pr.max_uses,100) then return jsonb_build_object('error','лимит активаций'); end if;
  select exists(select 1 from promo_uses where promo_id = pr.id and player_id = p_player_id) into already;
  if already then return jsonb_build_object('error','ты уже использовал этот промокод'); end if;
  insert into promo_uses(promo_id, player_id) values (pr.id, p_player_id);
  update promo_codes set used_count = coalesce(used_count,0) + 1 where id = pr.id;
  perform change_stats(p_player_id, pr.amount, 0);
  perform log_action_rpc(p_player_id, 'promo', jsonb_build_object('code', pr.code), pr.amount,
                         (select money from players where id = p_player_id));
  return jsonb_build_object('success', true, 'amount', pr.amount,
                            'money', (select money from players where id = p_player_id));
end $$;

-- Полный сброс игры (админ-команда /resetgame) — сигнатура как в клиенте: p_admin_id.
create or replace function public.reset_game_rpc(p_admin_id uuid)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  delete from businesses where owner_id = p_admin_id;
  delete from business_workers where player_id = p_admin_id;
  delete from market_items where seller_id = p_admin_id;
  update players set money = 3500, energy = 80, phone_count = 0, has_car = false, car_model = 'none',
    has_house = false, house_type = 'none', referral_balance = 0, tip_balance = 0,
    daily_streak = 0, boost_end = 0, brew_end = 0, market_slots = 3, onboarding_step = 0,
    last_claim = 0, last_rest_time = 0
  where id = p_admin_id;
  perform log_action_rpc(p_admin_id, 'reset_game', '{}'::jsonb, null, null);
  return jsonb_build_object('success', true);
end $$;

-- =================== 10. АДМИН: ЖУРНАЛЫ И ПРОМОКОДЫ ===================

-- Таблица action_logs уже существует (совпадает с реальной схемой Supabase).
create index if not exists idx_action_logs_created on public.action_logs using btree (created_at desc);
create index if not exists idx_action_logs_player on public.action_logs using btree (player_id, created_at desc);
create index if not exists idx_action_logs_type on public.action_logs using btree (action_type, created_at desc);

-- Проверка админа по роли в БД (не по клиентскому параметру!)
create or replace function public.is_admin(p_player_id uuid)
returns boolean language sql security definer stable as $$
  select coalesce((select role = 'admin' from players where id = p_player_id), false);
$$;

create or replace function public.log_action_rpc(
  p_player_id uuid, p_action_type text, p_details jsonb default '{}'::jsonb,
  p_money_delta integer default null, p_money_after integer default null)
returns void language plpgsql security definer as $$
begin
  insert into action_logs (player_id, action_type, details, money_delta, money_after)
  values (p_player_id, left(coalesce(p_action_type,'unknown'), 64), coalesce(p_details,'{}'),
          p_money_delta, p_money_after);
end $$;

create or replace function public.get_logs_rpc(p_admin_id uuid, p_limit int default 200, p_action_type text default null)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  return jsonb_build_object('logs',
    (select jsonb_agg(l order by l.created_at desc)
     from (
       select l.* from action_logs l
       where (p_action_type is null or l.action_type = p_action_type)
       order by l.created_at desc limit least(coalesce(p_limit,200), 500)
     ) l));
end $$;

create or replace function public.cleanup_logs_rpc(p_admin_id uuid, p_keep_days int default 30)
returns jsonb language plpgsql security definer as $$
declare n int;
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  delete from action_logs where created_at < now() - make_interval(days => greatest(p_keep_days, 1));
  get diagnostics n = row_count;
  return jsonb_build_object('deleted', n);
end $$;

create or replace function public.create_promo_rpc(p_admin_id uuid, p_code text, p_amount bigint, p_max_uses int)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  if p_code !~ '^[A-Z0-9]{3,20}$' then return jsonb_build_object('error','код: A-Z 0-9, 3-20 символов'); end if;
  if p_amount <= 0 or p_amount > 10000000 then return jsonb_build_object('error','сумма?'); end if;
  insert into promo_codes (code, amount, max_uses, used_count) values (p_code, p_amount, coalesce(p_max_uses,100), 0)
  on conflict (code) do update set amount = excluded.amount, max_uses = excluded.max_uses, used_count = 0;
  return jsonb_build_object('success', true);
end $$;

-- Browser RPC execution is granted only after all functions have been created below.

-- =================== 10. АДМИН-DIRECT ACTIONS (заменяют прямые UPDATE/DELETE из tabs.tsx) ==========
create or replace function public.admin_set_ban_rpc(p_admin_id uuid, p_target_player_id uuid, p_val boolean)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  if p_target_player_id = p_admin_id then return jsonb_build_object('error','нельзя банить себя'); end if;
  update players set is_banned = p_val where id = p_target_player_id;
  perform log_action_rpc(p_admin_id, case when p_val then 'admin_ban' else 'admin_unban' end,
    jsonb_build_object('target', p_target_player_id), null, null);
  return jsonb_build_object('success', true);
end $$;

create or replace function public.admin_delete_biz_rpc(p_admin_id uuid, p_biz_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses;
begin
  if not public.is_admin(p_admin_id) then return jsonb_build_object('error','не админ'); end if;
  select * into b from businesses where id = p_biz_id for update;
  if not found then return jsonb_build_object('error','бизнес не найден'); end if;
  delete from business_workers where business_id = p_biz_id;
  delete from businesses where id = p_biz_id;
  perform log_action_rpc(p_admin_id, 'admin_delete_biz',
    jsonb_build_object('biz', p_biz_id, 'type', b.biz_type, 'owner', b.owner_id), null, null);
  return jsonb_build_object('success', true);
end $$;

-- Keep SECURITY DEFINER functions private until the server gateway is configured.

-- =================== 10. КАЗИНО (глобальный цикл раундов 45 сек) ============
create table if not exists public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'betting',   -- betting | spinning | result
  end_time bigint not null,                 -- мс, когда закрываются ставки
  roulette_result int,                      -- 0..36
  dice_result int,                          -- 2..12
  race_winner text,                         -- id машины
  dice_first int,                           -- первая грань кубика
  dice_second int,                          -- вторая грань кубика
  created_at timestamptz not null default clock_timestamp()
);

-- Добавляем грани и в уже созданные проекты, сохраняя совместимость со старой схемой.
alter table public.casino_rounds add column if not exists dice_first int;
alter table public.casino_rounds add column if not exists dice_second int;
alter table public.casino_rounds alter column created_at set default clock_timestamp();
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
drop policy if exists "read all" on casino_rounds;
drop policy if exists "read all" on casino_bets;
revoke select on casino_rounds, casino_bets from public, anon, authenticated;
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
declare r casino_rounds; now_ms bigint;
begin
  -- Все читатели и cron сериализуются, чтобы не открыть два betting-раунда.
  perform pg_advisory_xact_lock(733014521::bigint);
  select * into r from casino_rounds order by created_at desc, id desc limit 1 for update;
  now_ms := floor(extract(epoch from clock_timestamp())*1000);

  -- залипший spinning: результат уже разыгран и лежит в строке — просто доводим статус,
  -- повторного розыгрыша нет (ставки уже рассчитаны внутри resolve)
  if found and r.status = 'spinning' then
    if coalesce(r.end_time, 0) < now_ms - 8000 then
      -- Провести ещё не обработанные ставки тем же сохранённым результатом.
      perform resolve_round_rpc(r.id);
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
    if coalesce(r.end_time, 0) > now_ms then return; end if;
    insert into casino_rounds(status, end_time) values ('betting', now_ms + 30000);
    return;
  end if;

  -- раундов вообще нет (первый запуск) — создаём
  insert into casino_rounds(status, end_time) values ('betting', now_ms + 30000);
end $$;

-- СТАВКА: списывает деньги сервером, защита от гонок через FOR UPDATE
create or replace function public.place_bet_rpc(p_player_id uuid, p_game_type text, p_bet_choice text, p_amount int)
returns jsonb language plpgsql security definer as $$
declare r casino_rounds; p players; now_ms bigint;
begin
  if p_amount < 100 or p_amount > 100000 then return jsonb_build_object('error','ставка от 100 до 100 000₽'); end if;
  if p_game_type not in ('roulette','dice','race') then return jsonb_build_object('error','игра?'); end if;
  if p_game_type='roulette' and p_bet_choice !~ '^(red|black|even|odd|zero|dozen[123]|col[123]|exact_(0|[1-9]|[12][0-9]|3[0-6]))$'
    then return jsonb_build_object('error','неверная ставка на рулетку'); end if;
  if p_game_type='dice' and p_bet_choice !~ '^(under7|over7|exact7|double|exact_([2-9]|1[012]))$'
    then return jsonb_build_object('error','неверная ставка на кости'); end if;
  if p_game_type='race' and p_bet_choice not in ('skyline','bmw','toyota','lada','priora','matiz')
    then return jsonb_build_object('error','такой машины нет'); end if;

  select * into r from casino_rounds order by created_at desc, id desc limit 1 for update;
  now_ms := floor(extract(epoch from clock_timestamp())*1000);
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
  if r.status not in ('betting', 'spinning') then
    return jsonb_build_object('skipped', true, 'status', r.status);
  end if;

  -- Для betting выбираем результат и открываем анимацию. Для spinning
  -- результат уже выбран spin_round_rpc, поэтому повторно RNG не вызываем.
  if r.status = 'betting' then
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
      roulette_result=v_roulette, dice_result=v_dice, race_winner=v_winner,
      dice_first=v_dice1, dice_second=v_dice2
    where id = p_round_id;
  else
    v_roulette := r.roulette_result;
    v_dice := r.dice_result;
    v_winner := r.race_winner;
    v_dice1 := coalesce(r.dice_first, greatest(1, least(6, r.dice_result - 6)));
    v_dice2 := coalesce(r.dice_second, r.dice_result - v_dice1);
  end if;

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

  update casino_rounds set status='result', end_time = floor(extract(epoch from clock_timestamp())*1000) + 10000
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
  declare r record; n int := 0; now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
begin
  -- зависшие spinning (>8 сек) закрываем в result напрямую — ставки уже рассчитаны внутри resolve
  for r in select id from casino_rounds
            where status='spinning' and coalesce(end_time,0) < now_ms loop
    -- spin_round_rpc уже выбрал результат; здесь нужно провести выплаты,
    -- а не просто закрыть раунд.
    perform resolve_round_rpc(r.id);
    n := n + 1;
  end loop;
  for r in select id from casino_rounds
            where status='betting' and end_time <= now_ms loop
    perform resolve_round_rpc(r.id);
    n := n + 1;
  end loop;
  return n;
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
        v_race_r numeric; v_winner text; now_ms bigint;
begin
  select * into r from casino_rounds order by created_at desc, id desc limit 1 for update;
  now_ms := floor(extract(epoch from clock_timestamp())*1000);
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
         roulette_result = v_roulette, dice_result = v_dice, race_winner = v_winner,
         dice_first = v_dice1, dice_second = v_dice2
   where id = r.id;
  return jsonb_build_object('ok', true, 'until', now_ms + p_spin_ms);
end $$;

-- Casino browser calls also go through /api/rpc.

-- клиентский вход в цикл: при заходе на вкладку казино доводит ленивый цикл
-- (завершает истёкшие/зависшие раунды и гарантирует свежий betting-раунд). Возвращает текущий раунд.
create or replace function public.get_casino_round_rpc(p_player_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare r casino_rounds;
begin
  perform casino_advance();
  perform ensure_round();
  select * into r from casino_rounds order by created_at desc, id desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'status', r.status, 'end_time', r.end_time,
    'roulette_result', r.roulette_result, 'dice_result', r.dice_result,
    'dice_first', r.dice_first, 'dice_second', r.dice_second, 'race_winner', r.race_winner,
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

-- вызывается из cron (api/casino.js): завершает истёкшие + создаёт новый раунд
create or replace function public.casino_tick_rpc()
returns jsonb language plpgsql security definer as $$
declare n int;
begin
  n := casino_advance();
  perform ensure_round();
  return jsonb_build_object('resolved', n, 'ok', true);
end $$;

-- Realtime: добавить таблицы казино в публикацию (для подписки клиента)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table casino_rounds'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table casino_bets';   exception when duplicate_object then null; end;
  end if;
end $$;

-- Browser RPC calls are authenticated by /api/rpc with Telegram initData.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- SECURITY DEFINER functions must not resolve objects from a caller-controlled schema.
revoke create on schema public from public, anon, authenticated;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = pg_catalog, public, pg_temp', f.signature);
  end loop;
end $$;
