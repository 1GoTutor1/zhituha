-- Apply after FAMILY_SYSTEM_MIGRATION.sql and COSMETIC_BACKGROUNDS_MIGRATION.sql.
-- Adds the renewable 14-day VIP pass and the seven game-wide daily events.

alter table public.players
  add column if not exists premium_until timestamptz;

create or replace function public.donation_purchase_rpc(p_player_id uuid, p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  cost bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;

  if p_item_id = 'premium_14d' then
    cost := 499;
    if coalesce(p.premium_balance, 0) < cost then
      return jsonb_build_object('error', 'Недостаточно жетонов');
    end if;

    update public.players
    set premium_balance = coalesce(premium_balance, 0) - cost,
        premium_until = greatest(coalesce(premium_until, clock_timestamp()), clock_timestamp()) + interval '14 days'
    where id = p_player_id
    returning * into p;

    return jsonb_build_object('ok', true, 'player', jsonb_build_object(
      'money', p.money,
      'premium_balance', p.premium_balance,
      'premium_until', p.premium_until,
      'market_slots', p.market_slots,
      'owned_cosmetics', p.owned_cosmetics,
      'profile_frame', p.profile_frame,
      'profile_background', p.profile_background
    ));
  end if;

  cost := case p_item_id
    when 'frame_test' then 120
    when 'frame_amber' then 60
    when 'background_concrete' then 90
    when 'background_brick' then 40
    when 'background_panelka' then 80
    when 'market_slots_2' then case when coalesce(p.market_slots, 3) >= 8 then 40 else 80 end
    else null
  end;
  if cost is null then return jsonb_build_object('error', 'Предмет не найден'); end if;
  if coalesce(p.premium_balance, 0) < cost then
    return jsonb_build_object('error', 'Недостаточно жетонов');
  end if;
  if p_item_id <> 'market_slots_2' and p_item_id = any(coalesce(p.owned_cosmetics, '{}'::text[])) then
    return jsonb_build_object('error', 'Уже куплено');
  end if;
  if p_item_id = 'market_slots_2' and coalesce(p.market_slots, 3) >= 9 then
    return jsonb_build_object('error', 'Достигнут максимум слотов');
  end if;

  if p_item_id = 'market_slots_2' then
    update public.players
    set premium_balance = premium_balance - cost,
        market_slots = least(coalesce(market_slots, 3) + 2, 9)
    where id = p_player_id returning * into p;
  else
    update public.players
    set premium_balance = premium_balance - cost,
        owned_cosmetics = array_append(coalesce(owned_cosmetics, '{}'::text[]), p_item_id)
    where id = p_player_id returning * into p;
  end if;

  return jsonb_build_object('ok', true, 'player', jsonb_build_object(
    'money', p.money,
    'premium_balance', p.premium_balance,
    'premium_until', p.premium_until,
    'market_slots', p.market_slots,
    'owned_cosmetics', p.owned_cosmetics,
    'profile_frame', p.profile_frame,
    'profile_background', p.profile_background
  ));
end
$$;

revoke all on function public.donation_purchase_rpc(uuid, text) from public, anon, authenticated;
grant execute on function public.donation_purchase_rpc(uuid, text) to service_role;

-- Keep the family-territory logic and add VIP luck on top of it.
do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_premium(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_premium';
  end if;
end
$$;

create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_json jsonb;
  cycle_row public.profession_cycles;
  replacement public.profession_items;
  vip_until timestamptz;
  current_money bigint;
  cash_reward bigint;
  cash_bonus bigint;
  rare_weight integer;
  total_weight integer;
  roll integer;
  day_index integer;
  base_luck numeric;
  family_luck numeric;
  premium_luck numeric;
  daily_luck numeric;
  incremental_chance numeric;
begin
  result_json := public.finish_profession_cycle_rpc_before_premium(p_player_id);
  if result_json is null or result_json ? 'error'
    or not (result_json ? 'profession') then
    return result_json;
  end if;

  select premium_until into vip_until from public.players where id = p_player_id;
  day_index := ((timezone('Europe/Moscow', statement_timestamp())::date - date '1970-01-01') % 7)::integer;

  select * into cycle_row
  from public.profession_cycles
  where player_id = p_player_id
  order by created_at desc limit 1 for update;
  if not found then return result_json; end if;

  if cycle_row.profession in ('miner', 'lumberjack', 'fisherman', 'farmer')
    and coalesce((result_json->>'pending_reward')::boolean, false) then
    select coalesce(sum(drop_weight) filter (where rarity in ('rare', 'epic')), 0)::integer,
           coalesce(sum(drop_weight), 0)::integer
    into rare_weight, total_weight
    from public.profession_items
    where profession = cycle_row.profession;
    if total_weight <= 0 or rare_weight <= 0 then return result_json; end if;

    base_luck := rare_weight::numeric / total_weight::numeric;
    family_luck := coalesce(
      nullif(result_json->>'drop_luck_bonus_percent', '')::numeric / 100,
      public.family_drop_luck_bonus(p_player_id),
      0
    );
    premium_luck := case when vip_until > statement_timestamp() then base_luck else 0 end;
    daily_luck := case
      when (day_index = 0 and cycle_row.profession = 'miner')
        or (day_index = 1 and cycle_row.profession = 'lumberjack')
        or (day_index = 2 and cycle_row.profession = 'fisherman')
        or (day_index = 3 and cycle_row.profession = 'farmer')
      then base_luck * 0.20
      else 0
    end;

    -- Family luck is already applied by the wrapped function. VIP adds one base chance;
    -- the profession event adds 20% of that base chance. Both bonuses stack additively.
    if (premium_luck + daily_luck) > 0
      and coalesce(result_json#>>'{item,rarity}', '') not in ('rare', 'epic') then
      incremental_chance := least(1::numeric,
        (premium_luck + daily_luck) / greatest(0.000001::numeric, 1 - base_luck - family_luck));
      if random() < incremental_chance then
        roll := floor(random() * rare_weight)::integer;
        select * into replacement from (
          select di.*, sum(di.drop_weight) over (order by di.item_id) - di.drop_weight as lower_bound
          from public.profession_items di
          where di.profession = cycle_row.profession and di.rarity in ('rare', 'epic')
        ) weighted
        where roll >= lower_bound
        order by lower_bound desc
        limit 1;

        if replacement.item_id is not null then
          result_json := jsonb_set(result_json, '{item}', jsonb_build_object(
            'item_id', replacement.item_id,
            'item_name', replacement.item_name,
            'rarity', replacement.rarity,
            'sell_price', replacement.sell_price,
            'icon', replacement.icon
          ));
        end if;
      end if;
    end if;

    if premium_luck > 0 or daily_luck > 0 then
      result_json := result_json || jsonb_build_object(
        'drop_luck_bonus_percent', (family_luck + premium_luck + daily_luck) * 100,
        'premium_luck_active', premium_luck > 0,
        'daily_modifier_id', day_index + 1
      );
    end if;
  elsif (day_index = 4 and cycle_row.profession = 'courier')
    or (day_index = 5 and cycle_row.profession = 'taxi') then
    cash_reward := coalesce((result_json->>'cash_reward')::bigint, 0);
    cash_bonus := floor(cash_reward * 0.20)::bigint;
    if cash_bonus > 0 then
      update public.players
      set money = coalesce(money, 0) + cash_bonus
      where id = p_player_id
      returning money into current_money;
      result_json := result_json || jsonb_build_object(
        'money', current_money,
        'cash_reward', cash_reward + cash_bonus,
        'daily_modifier_id', day_index + 1,
        'daily_bonus_percent', 20
      );
    end if;
  end if;

  update public.profession_cycles
  set result = result_json
  where id = cycle_row.id;
  return result_json;
end
$$;

revoke all on function public.finish_profession_cycle_rpc(uuid) from public, anon, authenticated;
revoke all on function public.finish_profession_cycle_rpc_before_premium(uuid) from public, anon, authenticated, service_role;
grant execute on function public.finish_profession_cycle_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
