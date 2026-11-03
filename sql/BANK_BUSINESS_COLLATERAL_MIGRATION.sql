-- Extend bank loans to accept a player's owned business as collateral.
-- A pledged business remains active, but cannot be sold or transferred.

alter table public.bank_loans
  add column if not exists collateral_business_id uuid references public.businesses(id) on delete set null;
alter table public.bank_loans drop constraint if exists bank_loans_collateral_type_check;
alter table public.bank_loans add constraint bank_loans_collateral_type_check
  check (collateral_type in ('car','house','business'));
create index if not exists bank_loans_collateral_business_idx
  on public.bank_loans(collateral_business_id) where collateral_business_id is not null;

create or replace function public.bank_guard_business_collateral()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id))
     and exists (
       select 1 from public.bank_loans l
       where l.collateral_business_id = old.id and l.status = 'active' and l.amount_due > 0
     ) then
    raise exception 'Заложенный бизнес нельзя продать или передать до погашения кредита';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists bank_business_pledge_delete_guard on public.businesses;
create trigger bank_business_pledge_delete_guard before delete on public.businesses
for each row execute function public.bank_guard_business_collateral();
drop trigger if exists bank_business_pledge_transfer_guard on public.businesses;
create trigger bank_business_pledge_transfer_guard before update of owner_id on public.businesses
for each row execute function public.bank_guard_business_collateral();

drop function if exists public.bank_apply_loan_rpc(uuid,text,bigint);
create or replace function public.bank_apply_loan_rpc(
  p_player_id uuid, p_collateral_type text, p_collateral_business_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  p public.players; b public.businesses; collateral text; collateral_value bigint; base_value bigint;
  upgrade_spend bigint; loan_id uuid; due timestamptz; loan_total bigint;
begin
  if p_amount is null or p_amount<1000 then return jsonb_build_object('error','Минимальная сумма кредита — 1 000 ₽'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if exists(select 1 from public.bank_loans where player_id=p_player_id and status in ('active','foreclosed') and amount_due>0) then
    return jsonb_build_object('error','Сначала погаси текущий кредит');
  end if;

  if p_collateral_type='car' and coalesce(p.has_car,false) then
    collateral := coalesce(p.car_model,'lada');
    collateral_value := coalesce((select v.base_price from public.business_vehicle_catalog v where v.model_id=collateral),case collateral when 'toyota' then 65000 else 35000 end);
  elsif p_collateral_type='house' and coalesce(p.has_house,false) then
    collateral := coalesce(p.house_type,'apartment');
    collateral_value := 50000;
  elsif p_collateral_type='business' then
    if p_collateral_business_id is null then return jsonb_build_object('error','Выбери бизнес для залога'); end if;
    select * into b from public.businesses where id=p_collateral_business_id and owner_id=p_player_id for update;
    if not found then return jsonb_build_object('error','Бизнес не найден или принадлежит другому игроку'); end if;
    base_value := case b.biz_type
      when 'coffee' then 15000 when 'salon' then 150000 when 'taxi' then 300000
      when 'phone_factory' then 300000 when 'construction' then 500000 else 0 end;
    if base_value=0 then return jsonb_build_object('error','Этот бизнес нельзя заложить'); end if;
    select coalesce(sum(t.cost),0)::bigint into upgrade_spend
    from unnest(case b.biz_type
      when 'coffee' then array[5000,20000,60000,150000]::bigint[]
      when 'salon' then array[50000,150000,400000,1000000]::bigint[]
      when 'taxi' then array[100000,300000,700000,1500000]::bigint[]
      when 'phone_factory' then array[100000,300000,800000,2000000]::bigint[]
      when 'construction' then array[150000,500000,1500000,3000000]::bigint[]
      else array[]::bigint[] end) with ordinality as t(cost, level_no)
    where t.level_no <= greatest(0,coalesce(b.passive_level,-1)+1);
    collateral := b.biz_type;
    collateral_value := base_value + floor(upgrade_spend*0.5);
  else
    return jsonb_build_object('error','Выбранное имущество нельзя заложить');
  end if;

  if p_amount>floor(collateral_value*0.70) then
    return jsonb_build_object('error',format('Под это имущество можно получить максимум %s ₽',floor(collateral_value*0.70)));
  end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict(player_id) do nothing;
  loan_total := p_amount + ceil(p_amount*0.10);
  due := now()+interval '72 hours';
  insert into public.bank_loans(player_id,collateral_type,collateral_model,collateral_business_id,
    collateral_value,principal,amount_due,due_at,grace_until)
  values(p_player_id,p_collateral_type,collateral,
    case when p_collateral_type='business' then p_collateral_business_id else null end,
    collateral_value,p_amount,loan_total,due,due+interval '24 hours') returning id into loan_id;
  update public.bank_accounts set balance=balance+p_amount,updated_at=now() where player_id=p_player_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'loan_issued',p_amount,jsonb_build_object('loan_id',loan_id,'collateral_type',p_collateral_type,
      'collateral_model',collateral,'collateral_business_id',case when p_collateral_type='business' then p_collateral_business_id else null end,
      'collateral_value',collateral_value,'amount_due',loan_total));
  return jsonb_build_object('success',true,'loan_id',loan_id,
    'balance',(select balance from public.bank_accounts where player_id=p_player_id),
    'amount_due',loan_total,'due_at',due,'grace_until',due+interval '24 hours','collateral_value',collateral_value);
end $$;

create or replace function public.bank_market_tick_rpc()
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  q public.bank_stock_quotes; recent numeric; previous numeric; signal numeric; noise numeric; move_pct numeric; next_price bigint;
  l public.bank_loans; p public.players; b public.businesses; recovered bigint; surplus bigint; business_found boolean;
begin
  perform pg_advisory_xact_lock(733014522::bigint);
  for q in select * from public.bank_stock_quotes order by symbol for update loop
    select coalesce(sum(quantity),0) into recent from public.bank_sector_events
      where sector=q.symbol and created_at>=now()-interval '60 minutes';
    select coalesce(sum(quantity),0) into previous from public.bank_sector_events
      where sector=q.symbol and created_at>=now()-interval '120 minutes' and created_at<now()-interval '60 minutes';
    signal := greatest(-0.40,least(0.40,((recent-previous)/greatest(previous,5))*0.20));
    noise := 0.20 + random()*49.80;
    move_pct := noise * case when random() < 0.50 + signal then 1 else -1 end;
    next_price := greatest(100,round(q.price*(1+move_pct/100.0))::bigint);
    update public.bank_stock_quotes set previous_price=q.price,price=next_price,updated_at=now() where symbol=q.symbol;
    insert into public.bank_stock_ticks(symbol,price) values(q.symbol,next_price);
  end loop;

  for l in select * from public.bank_loans where status='active' and amount_due>0 and grace_until<=now() for update skip locked loop
    select * into p from public.players where id=l.player_id for update;
    recovered := least(l.collateral_value,l.amount_due);
    surplus := greatest(0,l.collateral_value-recovered);
    business_found := false;
    if l.collateral_type='car' then
      update public.players set has_car=false,car_model='none' where id=l.player_id;
    elsif l.collateral_type='house' then
      update public.players set has_house=false,house_type='none' where id=l.player_id;
    elsif l.collateral_type='business' and l.collateral_business_id is not null then
      select * into b from public.businesses where id=l.collateral_business_id and owner_id=l.player_id for update;
      business_found := found;
      if business_found then
        update public.bank_loans set amount_due=greatest(0,amount_due-l.collateral_value),status='foreclosed',closed_at=now() where id=l.id;
        delete from public.business_workers where business_id=b.id;
        delete from public.businesses where id=b.id;
      else
        recovered := 0; surplus := 0;
        update public.bank_loans set status='foreclosed',closed_at=now() where id=l.id;
      end if;
    end if;
    if surplus>0 then
      insert into public.bank_accounts(player_id) values(l.player_id) on conflict(player_id) do nothing;
      update public.bank_accounts set balance=balance+surplus,updated_at=now() where player_id=l.player_id;
    end if;
    if l.collateral_type<>'business' then
      update public.bank_loans set amount_due=greatest(0,amount_due-l.collateral_value),status='foreclosed',closed_at=now() where id=l.id;
    end if;
    insert into public.bank_transactions(player_id,operation,amount,details)
      values(l.player_id,'loan_foreclosure',surplus,jsonb_build_object('loan_id',l.id,'collateral_type',l.collateral_type,
        'collateral_model',l.collateral_model,'collateral_business_id',l.collateral_business_id,'recovered',recovered));
  end loop;
  delete from public.bank_sector_events where created_at<now()-interval '7 days';
  delete from public.bank_stock_ticks where created_at<now()-interval '30 days';
  return jsonb_build_object('success',true);
end $$;

revoke all on function public.bank_apply_loan_rpc(uuid,text,uuid,bigint), public.bank_market_tick_rpc()
  from public, anon, authenticated;
grant execute on function public.bank_apply_loan_rpc(uuid,text,uuid,bigint), public.bank_market_tick_rpc()
  to service_role;
