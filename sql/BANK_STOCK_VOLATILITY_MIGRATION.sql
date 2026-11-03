-- Increase stock movement per minute; prices can rise without a configured ceiling.
-- Apply after BANK_MIGRATION.sql (and after BANK_BUSINESS_COLLATERAL_MIGRATION.sql if using business collateral).

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
