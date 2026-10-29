-- Up to three automated wholesale restock rules per business, paid with 99 premium tokens per slot.
create extension if not exists pg_cron;
create table if not exists public.business_autostock_licenses (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  slots integer not null default 0 check (slots between 0 and 3)
);
create table if not exists public.business_autostock_rules (
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id text not null,
  threshold integer not null check (threshold between 0 and 1000000),
  refill_quantity integer not null check (refill_quantity between 1 and 10000),
  enabled boolean not null default true,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (business_id, product_id)
);
alter table public.business_autostock_licenses enable row level security;
alter table public.business_autostock_rules enable row level security;
revoke all on public.business_autostock_licenses, public.business_autostock_rules from public, anon, authenticated;
grant all on public.business_autostock_licenses, public.business_autostock_rules to service_role;

create or replace function public.business_autostock_purchase_rpc(p_player_id uuid, p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; b public.businesses; current_slots integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id and biz_type in ('coffee','minimarket') for update;
  if not found then return jsonb_build_object('error','Можно подключить только к своей кофейне или минимаркету'); end if;
  insert into public.business_autostock_licenses(business_id,slots) values(b.id,0) on conflict do nothing;
  select slots into current_slots from public.business_autostock_licenses where business_id=b.id for update;
  if current_slots>=3 then return jsonb_build_object('error','У этого бизнеса уже куплены все 3 улучшения'); end if;
  if coalesce(p.premium_balance,0)<99 then return jsonb_build_object('error','Нужно 99 жетонов'); end if;
  update public.players set premium_balance=premium_balance-99 where id=p_player_id returning * into p;
  update public.business_autostock_licenses set slots=slots+1 where business_id=b.id returning slots into current_slots;
  return jsonb_build_object('success',true,'slots',current_slots,
    'player',jsonb_build_object('premium_balance',p.premium_balance,'money',p.money,
      'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,
      'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

create or replace function public.business_autostock_configure_rpc(
  p_player_id uuid,p_business_id uuid,p_product_id text,p_threshold integer,p_refill_quantity integer,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.businesses; product public.business_shop_products; slots_count integer; used_count integer;
begin
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id and biz_type in ('coffee','minimarket') for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  select * into product from public.business_shop_products where product_id=p_product_id and biz_type=b.biz_type;
  if not found then return jsonb_build_object('error','Товар не найден'); end if;
  insert into public.business_autostock_licenses(business_id,slots) values(b.id,0) on conflict do nothing;
  select slots into slots_count from public.business_autostock_licenses where business_id=b.id for update;
  if not p_enabled then
    delete from public.business_autostock_rules where business_id=b.id and product_id=p_product_id;
    return jsonb_build_object('success',true,'enabled',false);
  end if;
  if p_threshold is null or p_threshold<0 or p_refill_quantity is null or p_refill_quantity<1 or p_refill_quantity>10000
    or p_refill_quantity<=p_threshold then
    return jsonb_build_object('error','Объём закупки должен быть больше порога (максимум 10 000)');
  end if;
  select count(*) into used_count from public.business_autostock_rules where business_id=b.id and enabled and product_id<>p_product_id;
  if not exists(select 1 from public.business_autostock_rules where business_id=b.id and product_id=p_product_id and enabled)
    and used_count>=slots_count then return jsonb_build_object('error','Сначала купи слот автопополнения за 99 жетонов'); end if;
  insert into public.business_autostock_rules(business_id,product_id,threshold,refill_quantity,enabled)
    values(b.id,p_product_id,p_threshold,p_refill_quantity,true)
    on conflict(business_id,product_id) do update set threshold=excluded.threshold,
      refill_quantity=excluded.refill_quantity,enabled=true,updated_at=clock_timestamp();
  return jsonb_build_object('success',true,'enabled',true,'threshold',p_threshold,'refill_quantity',p_refill_quantity);
end $$;

create or replace function public.business_autostock_state_rpc(p_player_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public,pg_temp as $$
  select jsonb_build_object('businesses',coalesce(jsonb_agg(jsonb_build_object(
    'business_id',b.id,'slots',coalesce(l.slots,0),
    'rules',coalesce((select jsonb_agg(jsonb_build_object('product_id',r.product_id,'threshold',r.threshold,
      'refill_quantity',r.refill_quantity,'enabled',r.enabled)) from public.business_autostock_rules r where r.business_id=b.id),'[]'::jsonb)
  )),'[]'::jsonb))
  from public.businesses b left join public.business_autostock_licenses l on l.business_id=b.id
  where b.owner_id=p_player_id and b.biz_type in ('coffee','minimarket');
$$;

-- Run once a minute. Refill each configured product from the business cash balance.
create or replace function public.business_autostock_tick_rpc()
returns integer language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r record; b public.businesses; p public.business_shop_products; s public.business_shop_stock; cost bigint; changed integer:=0;
begin
  for r in select * from public.business_autostock_rules where enabled order by business_id,product_id loop
    select * into b from public.businesses where id=r.business_id for update skip locked;
    if not found then continue; end if;
    select * into p from public.business_shop_products where product_id=r.product_id and biz_type=b.biz_type;
    if not found then continue; end if;
    select * into s from public.business_shop_stock where business_id=b.id and product_id=r.product_id for update;
    if not found or s.quantity>r.threshold then continue; end if;
    cost:=p.wholesale_price*r.refill_quantity;
    if coalesce(b.cash_balance,0)<cost then continue; end if;
    insert into public.business_shop_stock(business_id,product_id,quantity,retail_price)
      values(b.id,p.product_id,r.refill_quantity,p.base_price)
      on conflict(business_id,product_id) do update set
        quantity=public.business_shop_stock.quantity+excluded.quantity,updated_at=clock_timestamp();
    update public.businesses set cash_balance=coalesce(cash_balance,0)-cost where id=b.id;
    changed:=changed+1;
  end loop;
  return changed;
end $$;

revoke all on function public.business_autostock_purchase_rpc(uuid,uuid),
  public.business_autostock_configure_rpc(uuid,uuid,text,integer,integer,boolean),
  public.business_autostock_state_rpc(uuid),public.business_autostock_tick_rpc()
  from public,anon,authenticated;
grant execute on function public.business_autostock_purchase_rpc(uuid,uuid),
  public.business_autostock_configure_rpc(uuid,uuid,text,integer,integer,boolean),
  public.business_autostock_state_rpc(uuid),public.business_autostock_tick_rpc() to service_role;

do $$
begin
  if not exists(select 1 from cron.job where jobname='business-autostock-minute') then
    perform cron.schedule('business-autostock-minute','* * * * *','select public.business_autostock_tick_rpc();');
  end if;
end $$;
notify pgrst,'reload schema';
