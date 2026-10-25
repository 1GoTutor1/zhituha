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
drop policy if exists "read all" on players;          create policy "read all" on players          for select using (true);
drop policy if exists "read all" on businesses;       create policy "read all" on businesses       for select using (true);
drop policy if exists "read all" on business_workers; create policy "read all" on business_workers for select using (true);
drop policy if exists "read all" on market_items;     create policy "read all" on market_items     for select using (true);
drop policy if exists "read all" on promo_codes;      create policy "read all" on promo_codes      for select using (true);

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
create policy "reg insert" on players for insert with check (
  not exists (select 1 from players p2 where p2.telegram_id = players.telegram_id) -- один аккаунт на TG id
  and coalesce(players.money, 0) <= 5000                                           -- стартовый капитал не накрутишь
);
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
        'buy_business_rpc','sell_business_rpc','finish_business_timer_rpc','start_car_order_rpc',
        'start_build_rpc','start_phone_order_rpc','collect_coffee_cash_rpc','collect_coffee_energy_rpc',
        'buy_coffee_rpc','taxi_add_car_rpc','taxi_collect_rpc','taxi_repair_rpc','hire_worker_rpc',
        'fire_worker_rpc','quit_job_rpc','list_item_rpc','buy_market_item','cancel_lot_rpc',
        'add_referral_balance','collect_ref_bonus_rpc','collect_tips_rpc','redeem_promo','reset_game_rpc',
        'is_admin','log_action_rpc','get_logs_rpc','cleanup_logs_rpc','create_promo_rpc',
        -- старые имена из прошлых версий скрипта:
        'register_player_rpc','set_subscribed_rpc','set_banned_rpc','get_player_by_tg','log_action',
        'tip_barista_rpc','claim_tips_rpc','claim_daily_rpc','brew_start_rpc','rob_business_rpc',
        'redeem_promo_rpc','admin_give_money_rpc'
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

-- Проверка, что бизнес принадлежит игроку (для всех biz-RPC).
create or replace function public.assert_owner(p_biz_id uuid, p_player_id uuid)
returns businesses language plpgsql security definer as $$
declare b businesses;
begin
  select * into b from businesses where id = p_biz_id and owner_id = p_player_id for update;
  if not found then raise exception 'not owner'; end if;
  return b;
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
    onboarding_step = coalesce((p_updates->>'onboarding_step')::int, onboarding_step),
    daily_streak    = coalesce((p_updates->>'daily_streak')::int, daily_streak),
    last_claim      = coalesce((p_updates->>'last_claim')::bigint, last_claim),
    boost_end       = coalesce((p_updates->>'boost_end')::bigint, boost_end),
    is_subscribed   = coalesce((p_updates->>'is_subscribed')::boolean, is_subscribed),
    market_slots    = coalesce((p_updates->>'market_slots')::int, market_slots),
    last_rest_time  = coalesce((p_updates->>'last_rest_time')::bigint, last_rest_time),
    phone_count     = coalesce((p_updates->>'phone_count')::int, phone_count),
    car_model       = coalesce(p_updates->>'car_model', car_model),
    house_type      = coalesce(p_updates->>'house_type', house_type),
    has_car         = coalesce((p_updates->>'has_car')::boolean, has_car),
    has_house       = coalesce((p_updates->>'has_house')::boolean, has_house)
  where id = p_player_id;
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
create or replace function public.rest_rpc(p_player_id uuid, p_target_energy int)
returns jsonb language plpgsql security definer as $$
declare p players; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if p.last_rest_time > 0 and now_ms - p.last_rest_time < 90000 then
    return jsonb_build_object('error','Рано отдыхать');
  end if;
  update players set energy = least(p_target_energy, greatest(coalesce(energy,0), coalesce(p_target_energy,100))),
                     last_rest_time = now_ms where id = p_player_id;
  return jsonb_build_object('energy', least(p_target_energy, 200), 'rest_end', now_ms + 90000);
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
  p_biz_id uuid, p_add_key text, p_add_amount int,
  p_clear_order boolean default false, p_clear_build boolean default false,
  p_clear_phone_model boolean default false)
returns jsonb language plpgsql security definer as $$
declare b businesses; s jsonb; now_ms bigint := floor(extract(epoch from now())*1000); deadline bigint;
begin
  select * into b from businesses where id = p_biz_id for update;
  if not found then return jsonb_build_object('success', false); end if;
  s := coalesce(b.stock, '{}'::jsonb);

  -- проверка истечения таймера по типу бизнеса
  if b.biz_type = 'salon' then
    deadline := coalesce(b.car_order_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
  elsif b.biz_type in ('construction','phone_factory') then
    deadline := coalesce(b.build_end, 0);
    if deadline = 0 or now_ms < deadline then return jsonb_build_object('success', false); end if;
  else
    return jsonb_build_object('success', false);
  end if;

  s := jsonb_set(s, array[p_add_key], to_jsonb(coalesce((s->>p_add_key)::int, 0) + p_add_amount));
  if p_clear_order then
    s := jsonb_set(jsonb_set(s, '{current_model}', '"none"'), '{order_amount}', '0');
  end if;
  if p_clear_phone_model then s := jsonb_set(s, '{current_phone_model}', '"none"'); end if;

  update businesses set stock = s,
    car_order_end = case when p_clear_order then 0 else car_order_end end,
    build_end     = case when p_clear_build  then 0 else build_end end
  where id = p_biz_id;
  return jsonb_build_object('success', true);
end $$;

-- Автосалон: старт заказа машин
create or replace function public.start_car_order_rpc(
  p_biz_id uuid, p_player_id uuid, p_model text, p_amount int, p_duration_ms bigint)
returns jsonb language plpgsql security definer as $$
declare b businesses; price bigint; end_ms bigint; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  if p_model not in ('lada','toyota') then return jsonb_build_object('error','bad model'); end if;
  if p_amount < 1 or p_amount > 10 then return jsonb_build_object('error','amount 1-10'); end if;
  price := (case p_model when 'lada' then 20000 else 50000 end) * p_amount;
  b := assert_owner(p_biz_id, p_player_id);
  if coalesce(b.car_order_end,0) > now_ms then return jsonb_build_object('error','уже едут'); end if;
  end_ms := now_ms + p_duration_ms;
  update businesses set car_order_end = end_ms,
    stock = jsonb_set(jsonb_set(coalesce(stock,'{}'), '{current_model}', to_jsonb(p_model)), '{order_amount}', to_jsonb(p_amount))
  where id = p_biz_id;
  perform change_stats(p_player_id, -price, 0);
  return jsonb_build_object('money', (select money from players where id = p_player_id), 'car_order_end', end_ms);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Стройка: старт строительства дома
create or replace function public.start_build_rpc(p_biz_id uuid, p_player_id uuid, p_duration_ms bigint)
returns jsonb language plpgsql security definer as $$
declare b businesses; end_ms bigint; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  b := assert_owner(p_biz_id, p_player_id);
  if coalesce(b.build_end,0) > now_ms then return jsonb_build_object('error','стройка идет'); end if;
  end_ms := now_ms + p_duration_ms;
  update businesses set build_end = end_ms where id = p_biz_id;
  perform change_stats(p_player_id, -350000, 0);
  return jsonb_build_object('money',(select money from players where id=p_player_id),'build_end',end_ms);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Цех: старт партии телефонов
create or replace function public.start_phone_order_rpc(p_biz_id uuid, p_player_id uuid, p_model text, p_duration_ms bigint)
returns jsonb language plpgsql security definer as $$
declare b businesses; price int; end_ms bigint; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  if p_model not in ('button','smartphone') then return jsonb_build_object('error','bad model'); end if;
  price := case p_model when 'button' then 7000 else 25000 end;
  b := assert_owner(p_biz_id, p_player_id);
  if coalesce(b.build_end,0) > now_ms then return jsonb_build_object('error','идет производство'); end if;
  end_ms := now_ms + p_duration_ms;
  update businesses set build_end = end_ms,
    stock = jsonb_set(coalesce(stock,'{}'), '{current_phone_model}', to_jsonb(p_model))
  where id = p_biz_id;
  perform change_stats(p_player_id, -price, 0);
  return jsonb_build_object('money',(select money from players where id=p_player_id),'build_end',end_ms);
exception when others then return jsonb_build_object('error','бизнес не твой');
end $$;

-- Кофейня: сбор кассы в карман
create or replace function public.collect_coffee_cash_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; amt bigint;
begin
  b := assert_owner(p_biz_id, p_player_id);
  amt := coalesce(b.coffee_balance, 0);
  if amt <= 0 then return jsonb_build_object('error','касса пуста'); end if;
  update businesses set coffee_balance = 0 where id = p_biz_id;
  perform change_stats(p_player_id, amt, 0);
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

-- Кофейня: покупатель варит кофе у конкретного кафе (касса растёт, brew_end на покупателе).
create or replace function public.buy_coffee_rpc(p_buyer_id uuid, p_cafe_id uuid)
returns jsonb language plpgsql security definer as $$
declare p players; c businesses; now_ms bigint := floor(extract(epoch from now())*1000);
begin
  select * into p from players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error','нет игрока'); end if;
  if p.money < 500 then return jsonb_build_object('error','мало денег'); end if;
  select * into c from businesses where id = p_cafe_id and biz_type = 'coffee' for update;
  if not found then return jsonb_build_object('error','кафе не найдено'); end if;
  if coalesce(p.brew_end,0) > now_ms then return jsonb_build_object('error','кофе уже варится'); end if;
  update players set money = money - 500, brew_end = now_ms + 15000 where id = p_buyer_id;
  update businesses set coffee_balance = coalesce(coffee_balance,0) + 500 where id = p_cafe_id;
  -- владельцу кафе капает бонус в referral_balance (собирается через collect_ref_bonus_rpc)
  if c.owner_id is distinct from p_buyer_id then
    update players set referral_balance = coalesce(referral_balance,0) + 25 where id = c.owner_id;
  end if;
  return jsonb_build_object('brew_end', now_ms + 15000, 'money', p.money - 500);
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

create or replace function public.taxi_collect_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare b businesses; cars jsonb; car jsonb;
  now_ms bigint := floor(extract(epoch from now())*1000);
  total bigint := 0; hours numeric; inc int; out jsonb := '[]'::jsonb;
begin
  b := assert_owner(p_biz_id, p_player_id);
  if b.biz_type <> 'taxi' then return jsonb_build_object('error','не таксопарк'); end if;
  cars := coalesce(b.stock->'taxi_cars','[]'::jsonb);
  for car in select * from jsonb_array_elements(cars) loop
    if (car->>'health')::int <= 0 then out := out || car; continue; end if;
    hours := least(((now_ms - (car->>'last_claim')::bigint) / 3600000.0)::numeric, 8);
    inc := floor(hours * (case car->>'model' when 'lada' then 1000 else 1500 end))::int;
    total := total + inc;
    out := out || jsonb_set(
      jsonb_set(car, '{health}', to_jsonb(greatest(0, (car->>'health')::int - floor(hours*8)::int))),
      '{last_claim}', to_jsonb(now_ms));
  end loop;
  if total = 0 then return jsonb_build_object('error','Еще рано собирать доход'); end if;
  update businesses set stock = jsonb_set(coalesce(stock,'{}'), '{taxi_cars}', out) where id = p_biz_id;
  perform change_stats(p_player_id, total, 0);
  return jsonb_build_object('income', total,
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
declare w business_workers; cnt int;
begin
  -- unique(player_id) в таблице: один игрок = одна работа во всей игре
  select count(*) into cnt from business_workers where player_id = p_player_id;
  if cnt > 0 then return jsonb_build_object('error','уже работаешь'); end if;
  if exists (select 1 from business_workers where player_id = p_player_id and business_id = p_business_id and role = p_role) then
    return jsonb_build_object('error','уже здесь'); end if;
  insert into business_workers (business_id, player_id, player_name, role, salary)
  values (p_business_id, p_player_id, p_player_name, p_role, p_salary);
  return jsonb_build_object('workers',
    (select jsonb_agg(w2) from business_workers w2 where w2.business_id = p_business_id));
end $$;

create or replace function public.fire_worker_rpc(p_worker_id uuid)
returns jsonb language plpgsql security definer as $$
declare w business_workers;
begin
  select * into w from business_workers where id = p_worker_id;
  if not found then return jsonb_build_object('error','не найдено'); end if;
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
  if p_price <= 0 or p_price > 100000000 then return jsonb_build_object('error','цена?'); end if;
  if p_source not in ('personal','stock') then return jsonb_build_object('error','source?'); end if;
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
create or replace function public.buy_market_item(p_buyer_id uuid, p_item_id uuid, p_commission_percent int default 10)
returns jsonb language plpgsql security definer as $$
declare m market_items; buyer players; payout bigint; real_data text;
begin
  select * into m from market_items where id = p_item_id for update;
  if not found then return jsonb_build_object('error','лот не найден'); end if;
  if m.seller_id = p_buyer_id then return jsonb_build_object('error','себе не продашь'); end if;
  select * into buyer from players where id = p_buyer_id for update;
  if not found then return jsonb_build_object('error','нет покупателя'); end if;
  if buyer.money < m.price then return jsonb_build_object('error','мало денег'); end if;

  real_data := split_part(m.item_data, ':', 2);   -- 'personal:lada' -> 'lada'
  delete from market_items where id = p_item_id;
  perform change_stats(p_buyer_id, -m.price, 0);
  payout := m.price - floor(m.price * coalesce(p_commission_percent,10) / 100.0);
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
  return jsonb_build_object('success', true, 'amount', pr.amount);
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

grant execute on all functions in schema public to anon, authenticated;

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

grant execute on all functions in schema public to anon, authenticated;
