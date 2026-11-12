-- Lift the old int4 cash ceiling while keeping all money changes in the
-- existing audited RPCs and preserving exact integer values in the UI.
drop trigger if exists zzzz_players_money_source_audit on public.players;
drop policy if exists "safe profile update" on public.players;
alter table public.players
  alter column money type bigint using money::bigint;
create policy "safe profile update" on public.players for update
  using (true) with check (
    role is not distinct from players.role and
    is_banned is not distinct from players.is_banned and
    money is not distinct from players.money and
    energy is not distinct from players.energy and
    referral_balance is not distinct from players.referral_balance and
    tip_balance is not distinct from players.tip_balance and
    telegram_id is not distinct from players.telegram_id
  );
create trigger zzzz_players_money_source_audit
after update of money on public.players
for each row execute function public.audit_player_money_change();

create or replace function public.bank_move_cash_rpc(p_player_id uuid, p_amount bigint, p_direction text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  a public.bank_accounts;
  new_balance bigint;
  new_wallet bigint;
  max_safe_integer constant bigint := 9007199254740991;
begin
  if p_amount is null or p_amount < 1 or p_amount > max_safe_integer then
    return jsonb_build_object('error', 'Сумма должна быть от 1 до 9 007 199 254 740 991 ₽');
  end if;
  if p_direction is null or p_direction not in ('deposit', 'withdraw') then
    return jsonb_build_object('error', 'Некорректная операция');
  end if;

  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  insert into public.bank_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;
  select * into a from public.bank_accounts where player_id = p_player_id for update;

  if p_direction = 'deposit' then
    if coalesce(p.money, 0) < p_amount then return jsonb_build_object('error', 'Недостаточно наличных'); end if;
    if a.balance > 9223372036854775807::bigint - p_amount then return jsonb_build_object('error', 'Превышен максимальный баланс счёта'); end if;
    update public.players set money = money - p_amount where id = p_player_id returning money into new_wallet;
    update public.bank_accounts set balance = balance + p_amount, updated_at = now() where player_id = p_player_id returning balance into new_balance;
    insert into public.bank_transactions(player_id, operation, amount) values (p_player_id, 'cash_deposit', p_amount);
  else
    if a.balance < p_amount then return jsonb_build_object('error', 'Недостаточно денег на счёте'); end if;
    if coalesce(p.money, 0) > max_safe_integer - p_amount then return jsonb_build_object('error', 'В кошельке не помещается такая сумма; сними её несколькими операциями'); end if;
    update public.players set money = money + p_amount where id = p_player_id returning money into new_wallet;
    update public.bank_accounts set balance = balance - p_amount, updated_at = now() where player_id = p_player_id returning balance into new_balance;
    insert into public.bank_transactions(player_id, operation, amount) values (p_player_id, 'cash_withdraw', p_amount);
  end if;

  return jsonb_build_object('balance', new_balance, 'wallet', new_wallet);
end;
$$;

create or replace function public.daily_mission_claim_rpc(p_player_id uuid, p_mission_id text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  today_utc date := timezone('UTC', clock_timestamp())::date;
  m public.player_daily_missions;
  new_money bigint;
begin
  select * into m from public.player_daily_missions
   where player_id = p_player_id and mission_date = today_utc and mission_id = p_mission_id for update;
  if not found then return jsonb_build_object('error', 'Задание не найдено'); end if;
  if m.progress < m.target then return jsonb_build_object('error', 'Сначала выполни задание'); end if;
  if m.claimed_at is not null then return jsonb_build_object('error', 'Награда уже получена'); end if;
  update public.player_daily_missions set claimed_at = clock_timestamp()
   where player_id = p_player_id and mission_date = today_utc and mission_id = p_mission_id;
  update public.players set money = coalesce(money, 0) + m.reward where id = p_player_id returning money into new_money;
  perform public.log_action_rpc(
    p_player_id, 'daily_mission_reward',
    jsonb_build_object('mission', p_mission_id, 'reward', m.reward),
    greatest(-2147483648::bigint, least(2147483647::bigint, m.reward::bigint))::integer,
    greatest(-2147483648::bigint, least(2147483647::bigint, new_money))::integer
  );
  return jsonb_build_object('success', true, 'reward', m.reward, 'money', new_money);
end;
$$;

create or replace function public.admin_give_money_rpc(p_admin_id uuid, p_target_player_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  a public.players;
  t public.players;
  next_money bigint;
begin
  select * into a from public.players where id = p_admin_id;
  if a.role is distinct from 'admin' and a.role is distinct from 'superadmin' then return jsonb_build_object('error', 'не админ'); end if;
  select * into t from public.players where id = p_target_player_id for update;
  if not found then return jsonb_build_object('error', 'игрок не найден'); end if;
  if p_amount > 0 and t.money > 9223372036854775807::bigint - p_amount then return jsonb_build_object('error', 'превышен предел баланса'); end if;
  if p_amount < 0 and t.money < -9223372036854775807::bigint - 1 - p_amount then return jsonb_build_object('error', 'превышен предел баланса'); end if;
  next_money := coalesce(t.money, 0) + p_amount;
  if next_money < 0 then return jsonb_build_object('error', 'уход в минус'); end if;
  perform set_config('app.money_actor_id', p_admin_id::text, true);
  update public.players set money = next_money where id = p_target_player_id;
  perform public.log_action_rpc(
    p_target_player_id, 'admin_give_money', jsonb_build_object('from_admin', a.nickname),
    greatest(-2147483648::bigint, least(2147483647::bigint, p_amount))::integer,
    greatest(-2147483648::bigint, least(2147483647::bigint, next_money))::integer
  );
  return jsonb_build_object('success', true, 'money', next_money);
end;
$$;

create or replace function public.buy_business_rpc(p_owner_id uuid, p_owner_name text, p_biz_type text, p_biz_name text, p_price bigint default 0)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  price bigint;
  mine integer;
  next_money bigint;
begin
  price := case p_biz_type when 'coffee' then 15000 when 'salon' then 150000 when 'taxi' then 300000 when 'phone_factory' then 300000 when 'construction' then 500000 end;
  if price is null then return jsonb_build_object('error', 'bad type'); end if;
  select * into p from public.players where id = p_owner_id for update;
  if not found then return jsonb_build_object('error', 'player not found'); end if;
  select count(*) into mine from public.businesses where owner_id = p_owner_id and biz_type = p_biz_type;
  if mine > 0 then return jsonb_build_object('error', 'уже есть такой бизнес'); end if;
  if p.money < price then return jsonb_build_object('error', 'мало денег'); end if;
  next_money := p.money - price;
  update public.players set money = next_money where id = p_owner_id;
  insert into public.businesses(owner_id, owner_name, biz_type, business_name)
  values (p_owner_id, p_owner_name, p_biz_type, coalesce(nullif(p_biz_name, ''), initcap(p_biz_type)));
  perform public.log_action_rpc(p_owner_id, 'buy_business', jsonb_build_object('type', p_biz_type), -price::integer,
    greatest(-2147483648::bigint, least(2147483647::bigint, next_money))::integer);
  return jsonb_build_object('success', true, 'money', next_money);
end;
$$;

create or replace function public.redeem_promo(p_code text, p_player_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  pr public.promo_codes;
  already boolean;
  current_money bigint;
begin
  if p_player_id is null then return jsonb_build_object('error', 'нет игрока'); end if;
  select * into pr from public.promo_codes where upper(code) = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('error', 'промокод не найден'); end if;
  if coalesce(pr.used_count, 0) >= coalesce(pr.max_uses, 100) then return jsonb_build_object('error', 'лимит активаций'); end if;
  select exists(select 1 from public.promo_uses where promo_id = pr.id and player_id = p_player_id) into already;
  if already then return jsonb_build_object('error', 'ты уже использовал этот промокод'); end if;
  insert into public.promo_uses(promo_id, player_id) values (pr.id, p_player_id);
  update public.promo_codes set used_count = coalesce(used_count, 0) + 1 where id = pr.id;
  perform public.change_stats(p_player_id, pr.amount, 0);
  select money into current_money from public.players where id = p_player_id;
  perform public.log_action_rpc(p_player_id, 'promo', jsonb_build_object('code', pr.code), pr.amount,
    greatest(-2147483648::bigint, least(2147483647::bigint, current_money))::integer);
  return jsonb_build_object('success', true, 'amount', pr.amount, 'money', current_money);
end;
$$;

create or replace function public.mining_action_rpc(
  p_player_id uuid,
  p_action text,
  p_item_id text default null,
  p_rig_id uuid default null,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_player public.players;
  v_rig public.player_mining_rigs;
  v_quantity integer := coalesce(p_quantity, 1);
  v_cost bigint;
  v_item text;
  v_used_slots integer;
  v_slot_cost integer;
  v_site_slots integer;
  v_gpu_count integer;
  v_action_result jsonb;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;
  if coalesce(v_player.is_banned, false) then return jsonb_build_object('error', 'Аккаунт заблокирован'); end if;
  if coalesce(v_player.player_level, 1) < 10 then return jsonb_build_object('error', 'Майнинг откроется с 10 уровня'); end if;
  insert into public.player_mining_accounts(player_id) values (p_player_id) on conflict (player_id) do nothing;

  if p_action = 'buy_component' then
    if v_quantity < 1 or v_quantity > 500 then return jsonb_build_object('error', 'Количество должно быть от 1 до 500'); end if;
    v_item := p_item_id;
    v_cost := case v_item
      when 'gpu_frame' then 40000
      when 'gpu_motherboard' then 55000
      when 'gpu_cpu_ram' then 40000
      when 'gpu_power' then 80000
      when 'gpu_cooling' then 35000
      when 'gpu_card' then 125000
      else null end;
    if v_cost is null then return jsonb_build_object('error', 'Такой детали нет в магазине'); end if;
    if v_item = 'gpu_card' and v_quantity > 4 then return jsonb_build_object('error', 'За раз можно купить не больше 4 видеокарт'); end if;
    if v_item <> 'gpu_card' and v_quantity <> 1 then return jsonb_build_object('error', 'Эту деталь можно купить только по одной'); end if;
    v_cost := v_cost * v_quantity;
    if coalesce(v_player.money, 0) < v_cost then return jsonb_build_object('error', 'Недостаточно ₽'); end if;
    update public.players set money = money - v_cost where id = p_player_id returning * into v_player;
    if exists (select 1 from public.player_mining_inventory where player_id = p_player_id and item_id = v_item and quantity > 2147483647 - v_quantity) then
      return jsonb_build_object('error', 'В инвентаре нет места для такого количества');
    end if;
    insert into public.player_mining_inventory(player_id, item_id, quantity)
    values (p_player_id, v_item, v_quantity)
    on conflict (player_id, item_id) do update set quantity = player_mining_inventory.quantity + excluded.quantity;
    v_action_result := jsonb_build_object('purchased', v_item, 'quantity', v_quantity, 'cost', v_cost);

  elsif p_action in ('buy_asic', 'buy_industrial') then
    if v_quantity < 1 or v_quantity > 500 then return jsonb_build_object('error', 'За раз можно купить от 1 до 500 майнеров'); end if;
    v_cost := (case p_action when 'buy_asic' then 2000000 else 7700000 end)::bigint * v_quantity;
    if coalesce(v_player.money, 0) < v_cost then return jsonb_build_object('error', 'Недостаточно ₽'); end if;
    update public.players set money = money - v_cost where id = p_player_id returning * into v_player;
    insert into public.player_mining_rigs(player_id, rig_type)
    select p_player_id, case p_action when 'buy_asic' then 'asic' else 'industrial' end
    from generate_series(1, v_quantity);
    v_action_result := jsonb_build_object('cost', v_cost, 'quantity', v_quantity, 'purchased', p_action);

  elsif p_action = 'build_gpu_farm' then
    if exists (
      select 1 from (values ('gpu_frame'), ('gpu_motherboard'), ('gpu_cpu_ram'), ('gpu_power'), ('gpu_cooling')) required(item_id)
      where not exists (select 1 from public.player_mining_inventory i where i.player_id = p_player_id and i.item_id = required.item_id and i.quantity > 0)
    ) then return jsonb_build_object('error', 'Сначала купи все основные детали фермы'); end if;
    update public.player_mining_inventory set quantity = quantity - 1
    where player_id = p_player_id and item_id in ('gpu_frame','gpu_motherboard','gpu_cpu_ram','gpu_power','gpu_cooling');
    insert into public.player_mining_rigs(player_id, rig_type, gpu_count)
    values (p_player_id, 'gpu_farm', 0) returning * into v_rig;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'built', true, 'gpu_slots', 4);

  elsif p_action = 'install_gpu' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or v_rig.rig_type <> 'gpu_farm' then return jsonb_build_object('error', 'Ферма не найдена'); end if;
    if v_rig.gpu_count >= 4 then return jsonb_build_object('error', 'Все слоты видеокарт заняты'); end if;
    if v_rig.is_running then perform public.mining_settle_player(p_player_id); end if;
    update public.player_mining_inventory set quantity = quantity - 1
    where player_id = p_player_id and item_id = 'gpu_card' and quantity > 0;
    if not found then return jsonb_build_object('error', 'Купи видеокарту в магазине'); end if;
    update public.player_mining_rigs set gpu_count = gpu_count + 1 where id = v_rig.id returning * into v_rig;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'gpu_count', v_rig.gpu_count);

  elsif p_action = 'install_rig' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found then return jsonb_build_object('error', 'Установка не найдена'); end if;
    if v_rig.installed then return jsonb_build_object('error', 'Установка уже размещена'); end if;
    if v_rig.rig_type = 'gpu_farm' and v_rig.gpu_count < 1 then return jsonb_build_object('error', 'Установи минимум одну видеокарту'); end if;
    if coalesce(v_player.money, 0) < (case when v_rig.rig_type = 'gpu_farm' then ceil(v_rig.gpu_count * 750)::bigint when v_rig.rig_type = 'asic' then 5000 else 18000 end) then
      return jsonb_build_object('error', 'Не хватит денег даже на 12 часов электричества');
    end if;
    v_slot_cost := case when v_rig.rig_type = 'industrial' then 4 else 1 end;
    select site_slots into v_site_slots from public.player_mining_accounts where player_id = p_player_id for update;
    select coalesce(sum(case when rig_type = 'industrial' then 4 else 1 end), 0)::integer
      into v_used_slots from public.player_mining_rigs where player_id = p_player_id and installed;
    if v_used_slots + v_slot_cost > v_site_slots then return jsonb_build_object('error', 'На площадке нет места. Расширь площадку в магазине'); end if;
    update public.player_mining_rigs set installed = true, is_running = true, last_settled_at = clock_timestamp() where id = v_rig.id;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'installed', true, 'is_running', true);

  elsif p_action in ('turn_on', 'turn_off') then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or not v_rig.installed then return jsonb_build_object('error', 'Сначала установи ферму на площадке'); end if;
    if p_action = 'turn_off' then
      perform public.mining_settle_player(p_player_id);
      update public.player_mining_rigs set is_running = false, last_settled_at = clock_timestamp() where id = v_rig.id;
      v_action_result := jsonb_build_object('rig_id', v_rig.id, 'is_running', false);
    else
      if v_rig.rig_type = 'gpu_farm' and v_rig.gpu_count < 1 then return jsonb_build_object('error', 'Установи минимум одну видеокарту'); end if;
      if v_player.money < (case when v_rig.rig_type = 'gpu_farm' then ceil(v_rig.gpu_count * 750)::bigint when v_rig.rig_type = 'asic' then 5000 else 18000 end) then
        return jsonb_build_object('error', 'Не хватит ₽ даже на 12 часов электричества');
      end if;
      update public.player_mining_rigs set is_running = true, last_settled_at = clock_timestamp() where id = v_rig.id;
      v_action_result := jsonb_build_object('rig_id', v_rig.id, 'is_running', true);
    end if;

  elsif p_action = 'uninstall_rig' then
    select * into v_rig from public.player_mining_rigs where id = p_rig_id and player_id = p_player_id for update;
    if not found or not v_rig.installed then return jsonb_build_object('error', 'Установка не размещена'); end if;
    perform public.mining_settle_player(p_player_id);
    update public.player_mining_rigs set installed = false, is_running = false, last_settled_at = clock_timestamp() where id = v_rig.id;
    v_action_result := jsonb_build_object('rig_id', v_rig.id, 'installed', false);

  elsif p_action = 'expand_site' then
    if v_quantity < 1 or v_quantity > 500 then return jsonb_build_object('error', 'За раз можно купить от 1 до 500 мест'); end if;
    if coalesce(v_player.money, 0) < 250000::bigint * v_quantity then return jsonb_build_object('error', 'Недостаточно ₽ для расширения площадки'); end if;
    select site_slots into v_site_slots from public.player_mining_accounts where player_id = p_player_id for update;
    if v_site_slots > 2147483647 - v_quantity then return jsonb_build_object('error', 'Достигнут предел количества мест'); end if;
    update public.players set money = money - 250000::bigint * v_quantity where id = p_player_id returning * into v_player;
    update public.player_mining_accounts set site_slots = site_slots + v_quantity where player_id = p_player_id returning site_slots into v_site_slots;
    v_action_result := jsonb_build_object('site_slots', v_site_slots, 'quantity', v_quantity, 'cost', 250000::bigint * v_quantity);

  elsif p_action = 'collect' then
    v_action_result := public.mining_settle_player(p_player_id);
    if v_action_result ? 'error' then return v_action_result; end if;

  else
    return jsonb_build_object('error', 'Неизвестное действие майнинга');
  end if;

  return public.mining_state_rpc(p_player_id) || coalesce(v_action_result, '{}'::jsonb);
end;
$$;


notify pgrst, 'reload schema';
