-- Limited state-owned business locations and atomic purchasing.
-- Apply after PROFESSIONS_INVENTORY_MIGRATION.sql.

-- Disable legacy direct business purchase/sale RPCs. The authenticated API gateway
-- now exposes only the location catalog operations below.
revoke all on function public.buy_business_rpc(uuid,text,text,text,bigint),
  public.sell_business_rpc(uuid,uuid) from public,anon,authenticated;

alter table public.businesses add column if not exists location_key text;
create unique index if not exists businesses_location_key_uidx
  on public.businesses(location_key) where location_key is not null;

create table if not exists public.business_locations (
  location_key text primary key,
  biz_type text not null,
  business_name text not null,
  purchase_price bigint check (purchase_price is null or purchase_price > 0),
  business_id uuid unique references public.businesses(id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.business_locations enable row level security;
drop policy if exists "read business location catalog" on public.business_locations;
create policy "read business location catalog" on public.business_locations for select using (true);
drop policy if exists "no direct business location writes" on public.business_locations;
create policy "no direct business location writes" on public.business_locations for insert with check (false);
drop policy if exists "no direct business location updates" on public.business_locations;
create policy "no direct business location updates" on public.business_locations for update using (false) with check (false);
drop policy if exists "no direct business location deletes" on public.business_locations;
create policy "no direct business location deletes" on public.business_locations for delete using (false);

insert into public.business_locations(location_key,biz_type,business_name,purchase_price) values
  ('coffee_01','coffee','Кофейня №1',350000),('coffee_02','coffee','Кофейня №2',350000),
  ('coffee_03','coffee','Кофейня №3',350000),('coffee_04','coffee','Кофейня №4',350000),
  ('coffee_05','coffee','Кофейня №5',350000),('coffee_06','coffee','Кофейня №6',350000),
  ('coffee_07','coffee','Кофейня №7',350000),
  ('salon_low','salon','Автосалон низкого класса',350000),
  ('salon_mid','salon','Автосалон среднего класса',650000),
  ('salon_high','salon','Автосалон высокого класса',1000000),
  ('taxi_yandex','taxi','Таксопарк Яндекс',1200000),
  ('taxi_maxim','taxi','Таксопарк Максим',1000000),
  ('taxi_uber','taxi','Таксопарк Uber',1200000),
  ('construction_01','construction','Стройтрест №1',850000),
  ('construction_02','construction','Стройтрест №2',850000),
  ('minimarket_01','minimarket','Минимаркет №1',600000),
  ('minimarket_02','minimarket','Минимаркет №2',600000),
  ('minimarket_03','minimarket','Минимаркет №3',600000),
  ('minimarket_04','minimarket','Минимаркет №4',600000),
  ('minimarket_05','minimarket','Минимаркет №5',600000),
  ('repair_01','auto_repair','Автомастерская №1',900000),
  ('repair_02','auto_repair','Автомастерская №2',900000),
  ('casino_01','casino','Казино',20000000)
on conflict (location_key) do update set
  biz_type=excluded.biz_type,business_name=excluded.business_name,
  purchase_price=excluded.purchase_price;

-- Existing owned businesses occupy the first matching free locations by age.
with ranked as (
  select b.id,b.biz_type,row_number() over(partition by b.biz_type order by b.created_at,b.id) as n
  from public.businesses b where b.location_key is null
), open_locations as (
  select l.location_key,l.biz_type,row_number() over(partition by l.biz_type order by l.location_key) as n
  from public.business_locations l where l.business_id is null
), mapped as (
  select r.id,l.location_key from ranked r join open_locations l
    on l.biz_type=r.biz_type and l.n=r.n
)
update public.business_locations l set business_id=m.id
from mapped m where l.location_key=m.location_key;
update public.businesses b set location_key=l.location_key
from public.business_locations l where l.business_id=b.id and b.location_key is null;

create or replace function public.enforce_player_business_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare current_count integer;
begin
  if new.owner_id is null then return new; end if;
  perform 1 from public.players where id=new.owner_id for update;
  select count(*) into current_count from public.businesses where owner_id=new.owner_id;
  if current_count>=3 then raise exception 'У одного игрока может быть не больше трёх бизнесов'; end if;
  return new;
end $$;
drop trigger if exists business_owner_max_three on public.businesses;
create trigger business_owner_max_three before insert on public.businesses
  for each row execute function public.enforce_player_business_limit();

create or replace function public.business_catalog_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owned_count integer;
begin
  select count(*) into owned_count from public.businesses where owner_id=p_player_id;
  return jsonb_build_object('owned_count',owned_count,'limit',3,
    'locations',coalesce((select jsonb_agg(jsonb_build_object(
      'location_key',l.location_key,'biz_type',l.biz_type,'business_name',l.business_name,
      'price',l.purchase_price,'business_id',l.business_id,
      'owner_id',b.owner_id,'owner_name',b.owner_name,
      'status',case when l.business_id is null then 'available'
        when b.owner_id=p_player_id then 'owned' else 'busy' end)
      order by case l.biz_type when 'coffee' then 1 when 'salon' then 2 when 'taxi' then 3
        when 'construction' then 4 when 'minimarket' then 5 when 'auto_repair' then 6 else 7 end,
        l.location_key)
      from public.business_locations l left join public.businesses b on b.id=l.business_id),'[]'::jsonb));
end $$;

create or replace function public.purchase_business_location_rpc(p_player_id uuid,p_location_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.players; l public.business_locations; result_business public.businesses; total integer;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into l from public.business_locations where location_key=p_location_key for update;
  if not found then return jsonb_build_object('error','Такая точка не найдена'); end if;
  if l.business_id is not null then return jsonb_build_object('error','Эта точка уже занята'); end if;
  if l.purchase_price is null then return jsonb_build_object('error','Цена этой точки ещё не установлена'); end if;
  if l.biz_type not in ('coffee','salon','taxi','construction','minimarket','auto_repair') then
    return jsonb_build_object('error','Этот тип бизнеса откроется после подключения его игровых систем'); end if;
  select count(*) into total from public.businesses where owner_id=p_player_id;
  if total>=3 then return jsonb_build_object('error','У одного игрока может быть не больше трёх бизнесов'); end if;
  if coalesce(p.money,0)<l.purchase_price then return jsonb_build_object('error','Не хватает денег'); end if;
  update public.players set money=money-l.purchase_price where id=p_player_id returning * into p;
  insert into public.businesses(owner_id,owner_name,biz_type,business_name,location_key)
    values(p_player_id,p.nickname,l.biz_type,l.business_name,l.location_key) returning * into result_business;
  update public.business_locations set business_id=result_business.id where location_key=l.location_key;
  return jsonb_build_object('success',true,'business_id',result_business.id,
    'biz_type',result_business.biz_type,'business_name',result_business.business_name,
    'price',l.purchase_price,'money',p.money,'owned_count',total+1);
end $$;

create or replace function public.sell_business_to_state_rpc(p_player_id uuid,p_biz_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; base_price bigint; refund bigint; returned_cash bigint; new_balance bigint;
begin
  select * into b from public.businesses where id=p_biz_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  select purchase_price into base_price from public.business_locations where location_key=b.location_key;
  base_price := coalesce(base_price,case b.biz_type when 'coffee' then 350000
    when 'salon' then case b.location_key when 'salon_mid' then 650000 when 'salon_high' then 1000000 else 350000 end
    when 'taxi' then 1200000 when 'construction' then 850000 when 'auto_repair' then 900000
    when 'casino' then 20000000 else 0 end);
  if base_price<=0 then return jsonb_build_object('error','Для этой точки не настроена цена продажи'); end if;
  refund := floor(base_price*0.5);
  returned_cash := coalesce(b.cash_balance,0)+coalesce(b.coffee_balance,0);
  update public.players set money=coalesce(money,0)+refund+returned_cash where id=p_player_id returning money into new_balance;
  delete from public.businesses where id=b.id;
  return jsonb_build_object('success',true,'refund',refund,'cash_returned',returned_cash,'money',new_balance);
end $$;

revoke all on function public.business_catalog_rpc(uuid),
  public.purchase_business_location_rpc(uuid,text),public.sell_business_to_state_rpc(uuid,uuid) from public,anon,authenticated;
grant execute on function public.business_catalog_rpc(uuid),
  public.purchase_business_location_rpc(uuid,text),public.sell_business_to_state_rpc(uuid,uuid) to service_role;

create table if not exists public.business_auctions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid unique references public.businesses(id) on delete set null,
  seller_id uuid not null references public.players(id) on delete cascade,
  starting_price bigint not null check (starting_price>0),
  highest_bid bigint not null,
  highest_bidder_id uuid references public.players(id) on delete set null,
  ends_at timestamptz not null,
  status text not null default 'active' check(status in ('active','sold','expired')),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists business_auctions_active_end_idx on public.business_auctions(ends_at) where status='active';
alter table public.business_auctions enable row level security;
drop policy if exists "read business auctions" on public.business_auctions;
create policy "read business auctions" on public.business_auctions for select using (true);
drop policy if exists "no direct business auction writes" on public.business_auctions;
create policy "no direct business auction writes" on public.business_auctions for all using (false) with check (false);

create or replace function public.protect_business_with_live_auction()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.business_auctions where business_id=old.id and status='active') then
    raise exception 'Нельзя удалить бизнес, пока идут торги';
  end if;
  return old;
end $$;
drop trigger if exists protect_live_business_auction on public.businesses;
create trigger protect_live_business_auction before delete on public.businesses
  for each row execute function public.protect_business_with_live_auction();

create or replace function public.business_auctions_settle_rpc()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.business_auctions; buyer public.players; closed integer:=0;
begin
  for a in select * from public.business_auctions where status='active' and ends_at<=clock_timestamp()
    order by ends_at for update skip locked loop
    if a.highest_bidder_id is null then
      update public.business_auctions set status='expired' where id=a.id;
    else
      select * into buyer from public.players where id=a.highest_bidder_id for update;
      if not found then
        update public.business_auctions set status='expired',highest_bidder_id=null where id=a.id;
      else
        update public.businesses set owner_id=buyer.id,owner_name=buyer.nickname where id=a.business_id;
        update public.players set money=coalesce(money,0)+a.highest_bid where id=a.seller_id;
        update public.business_auctions set status='sold' where id=a.id;
      end if;
    end if;
    closed:=closed+1;
  end loop;
  return closed;
end $$;

create or replace function public.create_business_auction_rpc(p_player_id uuid,p_biz_id uuid,p_starting_price bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; base_price bigint; a public.business_auctions;
begin
  perform public.business_auctions_settle_rpc();
  if p_starting_price<1 then return jsonb_build_object('error','Начальная ставка должна быть выше нуля'); end if;
  select * into b from public.businesses where id=p_biz_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  if exists(select 1 from public.business_auctions where business_id=b.id and status='active') then
    return jsonb_build_object('error','Бизнес уже выставлен на торги'); end if;
  select purchase_price into base_price from public.business_locations where location_key=b.location_key;
  if p_starting_price<floor(coalesce(base_price,1)*0.5) then
    return jsonb_build_object('error',format('Минимальная начальная цена: %s ₽',floor(coalesce(base_price,1)*0.5))); end if;
  insert into public.business_auctions(business_id,seller_id,starting_price,highest_bid,ends_at)
    values(b.id,p_player_id,p_starting_price,p_starting_price,clock_timestamp()+interval '24 hours') returning * into a;
  return jsonb_build_object('success',true,'auction_id',a.id,'ends_at',a.ends_at,'starting_price',a.starting_price);
end $$;

create or replace function public.bid_business_auction_rpc(p_player_id uuid,p_auction_id uuid,p_bid bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.business_auctions; p public.players; total integer; available_funds bigint;
begin
  perform public.business_auctions_settle_rpc();
  select * into a from public.business_auctions where id=p_auction_id and status='active' for update;
  if not found then return jsonb_build_object('error','Торги уже завершены'); end if;
  if a.ends_at<=clock_timestamp() then return jsonb_build_object('error','Время торгов вышло'); end if;
  if a.seller_id=p_player_id then return jsonb_build_object('error','Нельзя делать ставку на собственный бизнес'); end if;
  if p_bid<=a.highest_bid then return jsonb_build_object('error',format('Ставка должна быть выше %s ₽',a.highest_bid)); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select count(*) into total from public.businesses where owner_id=p_player_id;
  if total + (select count(*) from public.business_auctions where status='active' and highest_bidder_id=p_player_id and id<>a.id) >= 3 then
    return jsonb_build_object('error','Для выигрыша нужно свободное место: максимум три бизнеса'); end if;
  available_funds:=coalesce(p.money,0);
  if a.highest_bidder_id=p_player_id then available_funds:=available_funds+a.highest_bid; end if;
  if available_funds < p_bid then
    return jsonb_build_object('error','Не хватает денег для ставки'); end if;
  if a.highest_bidder_id is not null then
    update public.players set money=coalesce(money,0)+a.highest_bid where id=a.highest_bidder_id;
  end if;
  update public.players set money=coalesce(money,0)-p_bid where id=p_player_id;
  update public.business_auctions set highest_bid=p_bid,highest_bidder_id=p_player_id where id=a.id;
  return jsonb_build_object('success',true,'highest_bid',p_bid,'ends_at',a.ends_at,'refunded',a.highest_bid);
end $$;

do $$
declare existing_job record;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    for existing_job in select jobid from cron.job where jobname='business-auction-settlement' loop
      perform cron.unschedule(existing_job.jobid);
    end loop;
    perform cron.schedule('business-auction-settlement','* * * * *',
      'select public.business_auctions_settle_rpc();');
  end if;
exception when others then
  raise notice 'Business auction cron was not scheduled: %',sqlerrm;
end $$;

create or replace function public.business_catalog_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owned_count integer;
begin
  perform public.business_auctions_settle_rpc();
  select count(*) into owned_count from public.businesses where owner_id=p_player_id;
  return jsonb_build_object('owned_count',owned_count,'limit',3,
    'locations',coalesce((select jsonb_agg(jsonb_build_object(
      'location_key',l.location_key,'biz_type',l.biz_type,'business_name',l.business_name,
      'price',l.purchase_price,'business_id',l.business_id,'owner_id',b.owner_id,'owner_name',b.owner_name,
      'status',case when auc.status='active' then 'auction' when l.business_id is null then 'available'
        when b.owner_id=p_player_id then 'owned' else 'busy' end,
      'auction_id',auc.id,'highest_bid',auc.highest_bid,'ends_at',auc.ends_at)
      order by case l.biz_type when 'coffee' then 1 when 'salon' then 2 when 'taxi' then 3
        when 'construction' then 4 when 'minimarket' then 5 when 'auto_repair' then 6 else 7 end,l.location_key)
      from public.business_locations l left join public.businesses b on b.id=l.business_id
      left join public.business_auctions auc on auc.business_id=l.business_id and auc.status='active'),'[]'::jsonb));
end $$;

revoke all on function public.business_auctions_settle_rpc(),public.create_business_auction_rpc(uuid,uuid,bigint),
  public.bid_business_auction_rpc(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.business_catalog_rpc(uuid),public.create_business_auction_rpc(uuid,uuid,bigint),
  public.bid_business_auction_rpc(uuid,uuid,bigint) to service_role;

create or replace function public.enforce_player_business_limit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare current_count integer; reserved_count integer:=0;
begin
  if new.owner_id is null then return new; end if;
  perform 1 from public.players where id=new.owner_id for update;
  select count(*) into current_count from public.businesses where owner_id=new.owner_id;
  select count(*) into reserved_count from public.business_auctions
    where status='active' and highest_bidder_id=new.owner_id;
  if current_count+reserved_count>=3 then raise exception 'У одного игрока может быть не больше трёх бизнесов'; end if;
  return new;
end $$;

create or replace function public.sell_business_to_state_rpc(p_player_id uuid,p_biz_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.businesses; base_price bigint; refund bigint; returned_cash bigint; new_balance bigint;
begin
  select * into b from public.businesses where id=p_biz_id and owner_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Бизнес не найден'); end if;
  if exists(select 1 from public.business_auctions where business_id=b.id and status='active') then
    return jsonb_build_object('error','Сначала заверши или дождись торгов'); end if;
  select purchase_price into base_price from public.business_locations where location_key=b.location_key;
  base_price := coalesce(base_price,case b.biz_type when 'coffee' then 350000
    when 'salon' then case b.location_key when 'salon_mid' then 650000 when 'salon_high' then 1000000 else 350000 end
    when 'taxi' then 1200000 when 'construction' then 850000 when 'auto_repair' then 900000
    when 'casino' then 20000000 else 0 end);
  if base_price<=0 then return jsonb_build_object('error','Для этой точки не настроена цена продажи'); end if;
  refund := floor(base_price*0.5);
  returned_cash := coalesce(b.cash_balance,0)+coalesce(b.coffee_balance,0);
  update public.players set money=coalesce(money,0)+refund+returned_cash where id=p_player_id returning money into new_balance;
  delete from public.businesses where id=b.id;
  return jsonb_build_object('success',true,'refund',refund,'cash_returned',returned_cash,'money',new_balance);
end $$;
