-- Pay out all available stock-trading fees as daily dividends.
-- Run after BANK_STOCKS_REWORK_MIGRATION.sql.

create or replace function public.bank_market_tick_rpc()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  q public.bank_stock_quotes;
  recent numeric;
  previous numeric;
  signal numeric;
  noise numeric;
  move_pct numeric;
  next_price bigint;
  utc_day timestamptz;
  eligible_shares bigint;
  pool_balance bigint;
  dividend_budget bigint;
  per_share bigint;
  total_paid bigint;
  holder record;
  holder_payout bigint;
  l public.bank_loans;
  recovered bigint;
  surplus bigint;
  p public.players;
begin
  perform pg_advisory_xact_lock(733014522::bigint);
  utc_day:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';

  for q in select * from public.bank_stock_quotes order by symbol for update loop
    select coalesce(sum(quantity),0) into recent from public.bank_sector_events
      where sector=q.symbol and created_at>=clock_timestamp()-interval '1 hour';
    select coalesce(sum(quantity),0) into previous from public.bank_sector_events
      where sector=q.symbol and created_at>=clock_timestamp()-interval '2 hours'
        and created_at<clock_timestamp()-interval '1 hour';
    if previous<=0 then
      signal:=case when recent>0 then least(0.30,recent*0.01) else 0 end;
    else
      signal:=greatest(-0.35,least(0.35,((recent-previous)/greatest(previous,1))*0.25));
    end if;
    noise:=random()*0.8-0.4;
    move_pct:=greatest(-0.75,least(0.75,signal+noise));
    next_price:=greatest(100,round(q.price*(1+move_pct/100.0))::bigint);
    update public.bank_stock_quotes set previous_price=q.price,price=next_price,updated_at=clock_timestamp()
      where symbol=q.symbol;
    insert into public.bank_stock_ticks(symbol,price) values(q.symbol,next_price);

    if q.last_dividend_at is null or q.last_dividend_at<utc_day then
      select coalesce(sum(shares),0) into eligible_shares from public.bank_stock_holdings
        where symbol=q.symbol and shares>0 and updated_at<=clock_timestamp()-interval '6 hours';
      select coalesce(balance,0) into pool_balance from public.bank_stock_dividend_pools where symbol=q.symbol for update;

      -- Distribute the entire accumulated fee pool. Integer remainder stays in
      -- the pool and rolls forward to the next daily payout.
      dividend_budget:=pool_balance;
      per_share:=case when eligible_shares>0 then floor(dividend_budget/eligible_shares)::bigint else 0 end;
      total_paid:=0;
      if per_share>0 then
        for holder in select player_id,shares from public.bank_stock_holdings
          where symbol=q.symbol and shares>0 and updated_at<=clock_timestamp()-interval '6 hours' loop
          holder_payout:=holder.shares*per_share;
          if holder_payout<=0 then continue; end if;
          insert into public.bank_accounts(player_id) values(holder.player_id) on conflict(player_id) do nothing;
          update public.bank_accounts set balance=balance+holder_payout,updated_at=clock_timestamp()
            where player_id=holder.player_id;
          insert into public.bank_transactions(player_id,operation,amount,details)
            values(holder.player_id,'stock_dividend',holder_payout,
              jsonb_build_object('symbol',q.symbol,'shares',holder.shares,'per_share',per_share));
          total_paid:=total_paid+holder_payout;
        end loop;
      end if;
      update public.bank_stock_dividend_pools set balance=greatest(0,balance-total_paid),updated_at=clock_timestamp()
        where symbol=q.symbol;
      update public.bank_stock_quotes set last_dividend_per_share=per_share,last_dividend_at=clock_timestamp()
        where symbol=q.symbol;
    end if;
  end loop;

  for l in select * from public.bank_loans where status='active' and amount_due>0 and grace_until<=clock_timestamp() for update skip locked loop
    select * into p from public.players where id=l.player_id for update;
    recovered:=least(l.collateral_value,l.amount_due);
    surplus:=greatest(0,l.collateral_value-recovered);
    if l.collateral_type='car' then
      update public.players set has_car=false,car_model='none' where id=l.player_id;
    else
      update public.players set has_house=false,house_type='none' where id=l.player_id;
    end if;
    if surplus>0 then
      insert into public.bank_accounts(player_id) values(l.player_id) on conflict(player_id) do nothing;
      update public.bank_accounts set balance=balance+surplus,updated_at=clock_timestamp() where player_id=l.player_id;
    end if;
    update public.bank_loans set amount_due=greatest(0,amount_due-l.collateral_value),status='foreclosed',closed_at=clock_timestamp() where id=l.id;
    insert into public.bank_transactions(player_id,operation,amount,details)
      values(l.player_id,'loan_foreclosure',surplus,jsonb_build_object('loan_id',l.id,'collateral_type',l.collateral_type,'recovered',recovered));
  end loop;

  delete from public.bank_sector_events where created_at<clock_timestamp()-interval '7 days';
  delete from public.bank_stock_ticks where created_at<clock_timestamp()-interval '30 days';
  return jsonb_build_object('success',true);
end $$;

revoke all on function public.bank_market_tick_rpc() from public,anon,authenticated;
grant execute on function public.bank_market_tick_rpc() to service_role;
notify pgrst,'reload schema';
