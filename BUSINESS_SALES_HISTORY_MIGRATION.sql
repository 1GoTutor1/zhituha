-- Owner-visible sales history for all businesses except casinos.
-- Run after the business commerce and dealership migrations.

create table if not exists public.business_sales_history (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references public.players(id) on delete cascade,
  biz_type text not null,
  business_name text not null,
  event_type text not null,
  amount bigint not null check (amount > 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists business_sales_history_owner_time_idx
  on public.business_sales_history(owner_id,business_id,created_at desc);
alter table public.business_sales_history enable row level security;
revoke all on public.business_sales_history from public,anon,authenticated;
grant all on public.business_sales_history to service_role;

create or replace function public.record_business_sale_history()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare sale_amount bigint; sale_kind text;
begin
  if new.biz_type='casino' or new.owner_id is null then return new; end if;

  if coalesce(new.coffee_balance,0)>coalesce(old.coffee_balance,0) then
    sale_amount:=coalesce(new.coffee_balance,0)-coalesce(old.coffee_balance,0);
    sale_kind:='coffee_sale';
  elsif coalesce(new.cash_balance,0)>coalesce(old.cash_balance,0) then
    if current_setting('zhituha.business_cash_history_event',true)='cash_transfer' then return new; end if;
    sale_amount:=coalesce(new.cash_balance,0)-coalesce(old.cash_balance,0);
    sale_kind:=case new.biz_type
      when 'coffee' then 'retail_sale'
      when 'minimarket' then 'retail_sale'
      when 'salon' then 'vehicle_sale'
      when 'auto_repair' then 'repair_sale'
      when 'taxi' then 'taxi_sale'
      else 'business_sale' end;
  else
    return new;
  end if;

  if sale_amount>0 then
    insert into public.business_sales_history(business_id,owner_id,biz_type,business_name,event_type,amount,details)
      values(new.id,new.owner_id,new.biz_type,new.business_name,sale_kind,sale_amount,
        jsonb_build_object('cash_balance',coalesce(new.cash_balance,0),'coffee_balance',coalesce(new.coffee_balance,0)));
  end if;
  return new;
end $$;

drop trigger if exists business_sales_history_record on public.businesses;
create trigger business_sales_history_record after update of cash_balance,coffee_balance on public.businesses
for each row execute function public.record_business_sale_history();

-- Mark owner deposits and withdrawals so they are not reported as customer sales.
do $$ begin
  if to_regprocedure('public.business_cash_transfer_rpc_before_sales_history(uuid,uuid,bigint,text)') is null then
    execute 'alter function public.business_cash_transfer_rpc(uuid,uuid,bigint,text) rename to business_cash_transfer_rpc_before_sales_history';
  end if;
end $$;
create or replace function public.business_cash_transfer_rpc(
  p_player_id uuid,p_business_id uuid,p_amount bigint,p_direction text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare previous_event text; result_json jsonb;
begin
  previous_event:=current_setting('zhituha.business_cash_history_event',true);
  perform set_config('zhituha.business_cash_history_event','cash_transfer',true);
  result_json:=public.business_cash_transfer_rpc_before_sales_history(p_player_id,p_business_id,p_amount,p_direction);
  perform set_config('zhituha.business_cash_history_event',coalesce(previous_event,''),true);
  return result_json;
end $$;

-- Taxi fleet income is paid directly to the owner rather than held in the business cash box.
do $$ begin
  if to_regprocedure('public.taxi_collect_rpc_before_sales_history(uuid,uuid)') is null then
    execute 'alter function public.taxi_collect_rpc(uuid,uuid) rename to taxi_collect_rpc_before_sales_history';
  end if;
end $$;
create or replace function public.taxi_collect_rpc(p_biz_id uuid,p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; b public.businesses; income bigint; gross bigint;
begin
  result_json:=public.taxi_collect_rpc_before_sales_history(p_biz_id,p_player_id);
  if result_json ? 'error' or not (result_json ? 'income') then return result_json; end if;
  select * into b from public.businesses where id=p_biz_id and owner_id=p_player_id and biz_type='taxi';
  if not found then return result_json; end if;
  income:=coalesce((result_json->>'income')::bigint,0);
  gross:=coalesce((result_json->>'gross')::bigint,income);
  if income>0 then
    insert into public.business_sales_history(business_id,owner_id,biz_type,business_name,event_type,amount,details)
      values(b.id,b.owner_id,b.biz_type,b.business_name,'taxi_fleet_income',income,jsonb_build_object('gross',gross));
  end if;
  return result_json;
end $$;

create or replace function public.business_sales_history_rpc(p_player_id uuid,p_business_id uuid,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.businesses; total bigint; sale_count bigint; rows_json jsonb;
begin
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id for share;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  if b.biz_type='casino' then return jsonb_build_object('error','История продаж для казино отключена'); end if;
  select count(*),coalesce(sum(amount),0) into sale_count,total from public.business_sales_history
    where business_id=b.id and owner_id=p_player_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'event_type',s.event_type,'amount',s.amount,'details',s.details,'created_at',s.created_at
  ) order by s.created_at desc),'[]'::jsonb) into rows_json from (
    select id,event_type,amount,details,created_at from public.business_sales_history
    where business_id=b.id and owner_id=p_player_id
    order by created_at desc limit greatest(1,least(coalesce(p_limit,30),100))
  ) s;
  return jsonb_build_object('business_id',b.id,'business_name',b.business_name,
    'total_sales',total,'sales_count',sale_count,'sales',rows_json);
end $$;

revoke all on function public.record_business_sale_history(),
  public.business_cash_transfer_rpc_before_sales_history(uuid,uuid,bigint,text),
  public.taxi_collect_rpc_before_sales_history(uuid,uuid),
  public.business_cash_transfer_rpc(uuid,uuid,bigint,text),
  public.taxi_collect_rpc(uuid,uuid),
  public.business_sales_history_rpc(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.business_cash_transfer_rpc(uuid,uuid,bigint,text),
  public.taxi_collect_rpc(uuid,uuid),public.business_sales_history_rpc(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
