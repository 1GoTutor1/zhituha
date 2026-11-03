-- Coffee: temporary +10% bonus to profession income and item sales.
-- Deposits: raise the existing term schedule tenfold (minimum 1%).

alter table public.players
  add column if not exists coffee_bonus_until timestamptz;

-- The owner-defined retail price remains the source of truth. This wrapper only
-- adds time to the same +10% timer after each successful coffee-shop purchase.
do $$
begin
  if to_regprocedure('public.business_shop_buy_rpc_before_coffee_bonus(uuid,uuid,text,integer)') is null then
    execute 'alter function public.business_shop_buy_rpc(uuid,uuid,text,integer) rename to business_shop_buy_rpc_before_coffee_bonus';
  end if;
end $$;

create or replace function public.business_shop_buy_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; bonus_until timestamptz; purchase_time timestamptz; minutes_per_cup integer;
begin
  result_json:=public.business_shop_buy_rpc_before_coffee_bonus(p_player_id,p_business_id,p_product_id,p_quantity);
  if result_json ? 'error' or coalesce((result_json->>'success')::boolean,false) is not true then
    return result_json;
  end if;

  if exists(select 1 from public.business_shop_products
    where product_id=p_product_id and biz_type='coffee') then
    -- Every coffee gives the same +10% effect; the drink determines its duration.
    minutes_per_cup:=case p_product_id when 'coffee_small' then 5 when 'coffee_medium' then 7 when 'coffee_large' then 9 else 5 end;
    -- Bulk purchases and different drinks add to the same timer, capped at 24 hours.
    select greatest(clock_timestamp(), coalesce(coffee_bonus_until, clock_timestamp()))
      into purchase_time
    from public.players where id=p_player_id for update;
    bonus_until:=purchase_time + make_interval(mins => minutes_per_cup * p_quantity);
    bonus_until:=least(bonus_until, clock_timestamp()+interval '24 hours');
    update public.players set coffee_bonus_until=bonus_until where id=p_player_id;
    result_json:=result_json || jsonb_build_object(
      'coffee_bonus_until',bonus_until,
      'coffee_bonus_percent',10,
      'coffee_bonus_minutes',minutes_per_cup * p_quantity
    );
  end if;
  return result_json;
end $$;

-- Add 10% to direct profession payouts (courier/taxi). Item drops themselves
-- are unchanged; the bonus is applied when the player sells them.
do $$
begin
  if to_regprocedure('public.finish_profession_cycle_rpc_before_coffee_bonus(uuid)') is null then
    execute 'alter function public.finish_profession_cycle_rpc(uuid) rename to finish_profession_cycle_rpc_before_coffee_bonus';
  end if;
end $$;

create or replace function public.finish_profession_cycle_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; cash_reward bigint; bonus bigint; new_money bigint;
begin
  result_json:=public.finish_profession_cycle_rpc_before_coffee_bonus(p_player_id);
  if result_json ? 'error' or coalesce((result_json->>'success')::boolean,true) is false then
    return result_json;
  end if;
  if not exists(select 1 from public.players where id=p_player_id and coffee_bonus_until>clock_timestamp()) then
    return result_json;
  end if;

  cash_reward:=coalesce((result_json->>'cash_reward')::bigint,0);
  bonus:=floor(cash_reward*0.10)::bigint;
  if bonus<=0 then return result_json; end if;
  update public.players set money=coalesce(money,0)+bonus where id=p_player_id returning money into new_money;
  return result_json || jsonb_build_object(
    'cash_reward',cash_reward+bonus,
    'money',new_money,
    'coffee_bonus_paid',bonus
  );
end $$;

-- The regular work button still pays through work_rpc, so include it as well.
do $$
begin
  if to_regprocedure('public.work_rpc_before_coffee_bonus(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_coffee_bonus';
  end if;
end $$;

create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; bonus bigint; new_money bigint;
begin
  result_json:=public.work_rpc_before_coffee_bonus(p_player_id);
  if result_json ? 'error'
    or not exists(select 1 from public.players where id=p_player_id and coffee_bonus_until>clock_timestamp()) then
    return result_json;
  end if;
  bonus:=floor(coalesce((result_json->>'work_pay')::bigint,0)*0.10)::bigint;
  if bonus<=0 then return result_json; end if;
  update public.players set money=coalesce(money,0)+bonus where id=p_player_id returning money into new_money;
  return result_json || jsonb_build_object('work_pay',coalesce((result_json->>'work_pay')::bigint,0)+bonus,
    'money',new_money,'coffee_bonus_paid',bonus);
end $$;

-- Apply the same bonus when selling the just-found item or an inventory stack.
do $$
begin
  if to_regprocedure('public.claim_profession_reward_rpc_before_coffee_bonus(uuid,text)') is null then
    execute 'alter function public.claim_profession_reward_rpc(uuid,text) rename to claim_profession_reward_rpc_before_coffee_bonus';
  end if;
  if to_regprocedure('public.sell_inventory_rpc_before_coffee_bonus(uuid,text,integer)') is null then
    execute 'alter function public.sell_inventory_rpc(uuid,text,integer) rename to sell_inventory_rpc_before_coffee_bonus';
  end if;
end $$;

create or replace function public.claim_profession_reward_rpc(p_player_id uuid,p_choice text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; bonus bigint; new_money bigint;
begin
  result_json:=public.claim_profession_reward_rpc_before_coffee_bonus(p_player_id,p_choice);
  if result_json ? 'error' or p_choice<>'sell'
    or not exists(select 1 from public.players where id=p_player_id and coffee_bonus_until>clock_timestamp()) then
    return result_json;
  end if;
  bonus:=floor(coalesce((result_json->>'proceeds')::bigint,0)*0.10)::bigint;
  if bonus<=0 then return result_json; end if;
  update public.players set money=coalesce(money,0)+bonus where id=p_player_id returning money into new_money;
  return result_json || jsonb_build_object('proceeds',coalesce((result_json->>'proceeds')::bigint,0)+bonus,
    'money',new_money,'coffee_bonus_paid',bonus);
end $$;

create or replace function public.sell_inventory_rpc(p_player_id uuid,p_item_id text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; bonus bigint; new_money bigint;
begin
  result_json:=public.sell_inventory_rpc_before_coffee_bonus(p_player_id,p_item_id,p_quantity);
  if result_json ? 'error'
    or not exists(select 1 from public.players where id=p_player_id and coffee_bonus_until>clock_timestamp()) then
    return result_json;
  end if;
  bonus:=floor(coalesce((result_json->>'proceeds')::bigint,0)*0.10)::bigint;
  if bonus<=0 then return result_json; end if;
  update public.players set money=coalesce(money,0)+bonus where id=p_player_id returning money into new_money;
  return result_json || jsonb_build_object('proceeds',coalesce((result_json->>'proceeds')::bigint,0)+bonus,
    'money',new_money,'coffee_bonus_paid',bonus);
end $$;

-- Tenfold the former rates: 0.1/0.3/0.5/1/4/10% -> 1/3/5/10/40/100%.
create or replace function public.bank_open_deposit_rpc(p_player_id uuid,p_amount bigint,p_term_hours int)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare rate int; account public.bank_accounts; deposit_id uuid; maturity timestamptz; active_principal bigint;
begin
  rate:=case p_term_hours when 1 then 100 when 6 then 300 when 12 then 500 when 24 then 1000 when 72 then 4000 when 168 then 10000 else null end;
  if rate is null then return jsonb_build_object('error','Выбери срок: 1, 6, 12, 24, 72 или 168 часов'); end if;
  if p_amount is null or p_amount<1000 or p_amount>1000000 then return jsonb_build_object('error','Вклад должен быть от 1 000 до 1 000 000 ₽'); end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict(player_id) do nothing;
  select * into account from public.bank_accounts where player_id=p_player_id for update;
  if account.balance<p_amount then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
  select coalesce(sum(principal),0) into active_principal from public.bank_deposits where player_id=p_player_id and status='active';
  if active_principal+p_amount>1000000 then return jsonb_build_object('error','Общий лимит активных вкладов — 1 000 000 ₽'); end if;
  maturity:=clock_timestamp()+make_interval(hours=>p_term_hours);
  update public.bank_accounts set balance=balance-p_amount,updated_at=clock_timestamp() where player_id=p_player_id;
  insert into public.bank_deposits(player_id,principal,rate_bps,term_hours,maturity_at)
    values(p_player_id,p_amount,rate,p_term_hours,maturity) returning id into deposit_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'deposit_open',-p_amount,jsonb_build_object('deposit_id',deposit_id,'term_hours',p_term_hours,'rate_bps',rate));
  return jsonb_build_object('success',true,'deposit_id',deposit_id,'maturity_at',maturity);
end $$;

-- Existing active deposits receive the new rate too; already closed deposits stay untouched.
update public.bank_deposits set rate_bps=case term_hours
  when 1 then 100 when 6 then 300 when 12 then 500 when 24 then 1000
  when 72 then 4000 when 168 then 10000 else rate_bps end
where status='active' and term_hours in (1,6,12,24,72,168);

revoke all on function public.business_shop_buy_rpc(uuid,uuid,text,integer),
  public.business_shop_buy_rpc_before_coffee_bonus(uuid,uuid,text,integer),
  public.finish_profession_cycle_rpc(uuid),public.finish_profession_cycle_rpc_before_coffee_bonus(uuid),
  public.work_rpc(uuid),public.work_rpc_before_coffee_bonus(uuid),
  public.claim_profession_reward_rpc(uuid,text),public.claim_profession_reward_rpc_before_coffee_bonus(uuid,text),
  public.sell_inventory_rpc(uuid,text,integer),public.sell_inventory_rpc_before_coffee_bonus(uuid,text,integer),
  public.bank_open_deposit_rpc(uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_shop_buy_rpc(uuid,uuid,text,integer),
  public.finish_profession_cycle_rpc(uuid),public.claim_profession_reward_rpc(uuid,text),
  public.work_rpc(uuid),public.sell_inventory_rpc(uuid,text,integer),
  public.bank_open_deposit_rpc(uuid,bigint,integer) to service_role;
