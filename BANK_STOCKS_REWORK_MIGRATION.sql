-- Rework stock trading: smoother sector-driven prices, 1% fees, and
-- daily dividends funded from those fees. Run after BANK_MIGRATION.sql.

alter table public.bank_stock_quotes
  add column if not exists last_dividend_per_share bigint not null default 0,
  add column if not exists last_dividend_at timestamptz;
update public.bank_stock_quotes set last_dividend_at=clock_timestamp() where last_dividend_at is null;

create table if not exists public.bank_stock_dividend_pools (
  symbol text primary key references public.bank_stock_quotes(symbol) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
insert into public.bank_stock_dividend_pools(symbol)
  select symbol from public.bank_stock_quotes on conflict(symbol) do nothing;
alter table public.bank_stock_dividend_pools enable row level security;
revoke all on public.bank_stock_dividend_pools from public,anon,authenticated;
grant all on public.bank_stock_dividend_pools to service_role;

create or replace function public.bank_get_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.players where id=p_player_id) then
    return jsonb_build_object('error','player not found');
  end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict(player_id) do nothing;
  result:=jsonb_build_object(
    'wallet',(select money from public.players where id=p_player_id),
    'balance',(select balance from public.bank_accounts where player_id=p_player_id),
    'deposits',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'principal',d.principal,'rate_bps',d.rate_bps,'term_hours',d.term_hours,
      'maturity_at',d.maturity_at,'status',d.status,'created_at',d.created_at
    ) order by d.created_at desc) from public.bank_deposits d where d.player_id=p_player_id and d.status='active'),'[]'::jsonb),
    'loan',(select to_jsonb(l) from public.bank_loans l where l.player_id=p_player_id
      and l.status in ('active','foreclosed') and l.amount_due>0 order by l.created_at desc limit 1),
    'holdings',coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',h.symbol,'shares',h.shares,'price',q.price,'value',h.shares*q.price,
      'cost_basis',h.cost_basis,'realized_profit',h.realized_profit,
      'liquidation_value',floor(h.shares*q.price*0.99),
      'dividends_received',coalesce((select sum(t.amount) from public.bank_transactions t
        where t.player_id=p_player_id and t.operation='stock_dividend' and t.details->>'symbol'=h.symbol),0)
    ) order by h.symbol) from public.bank_stock_holdings h join public.bank_stock_quotes q using(symbol)
      where h.player_id=p_player_id and (h.shares>0 or h.realized_profit<>0)),'[]'::jsonb),
    'stocks',coalesce((select jsonb_agg(jsonb_build_object(
      'symbol',q.symbol,'title',q.title,'price',q.price,'previous_price',q.previous_price,
      'last_dividend_per_share',q.last_dividend_per_share,'last_dividend_at',q.last_dividend_at,
      'recent_activity',(select coalesce(sum(e.quantity),0) from public.bank_sector_events e
        where e.sector=q.symbol and e.created_at>=clock_timestamp()-interval '1 hour'),
      'previous_activity',(select coalesce(sum(e.quantity),0) from public.bank_sector_events e
        where e.sector=q.symbol and e.created_at>=clock_timestamp()-interval '2 hours'
          and e.created_at<clock_timestamp()-interval '1 hour'),
      'history',coalesce((select jsonb_agg(jsonb_build_object('price',t.price,'at',t.created_at) order by t.created_at)
        from (select price,created_at from public.bank_stock_ticks where symbol=q.symbol order by created_at desc limit 60) t),'[]'::jsonb)
    ) order by q.symbol) from public.bank_stock_quotes q),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'operation',t.operation,'amount',t.amount,'details',t.details,'created_at',t.created_at
    ) order by t.created_at desc) from (select * from public.bank_transactions
      where player_id=p_player_id order by created_at desc limit 30) t),'[]'::jsonb),
    'server_now',clock_timestamp()
  );
  return result;
end $$;

create or replace function public.bank_buy_stock_rpc(p_player_id uuid,p_symbol text,p_shares int)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare q public.bank_stock_quotes; a public.bank_accounts; gross bigint; fee bigint; total bigint;
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then
    return jsonb_build_object('error','Можно купить от 1 до 10 000 акций');
  end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  gross:=q.price*p_shares; fee:=greatest(1,ceil(gross*0.01)::bigint); total:=gross+fee;
  select * into a from public.bank_accounts where player_id=p_player_id for update;
  if not found or a.balance<total then return jsonb_build_object('error','Недостаточно денег на банковском счёте'); end if;
  update public.bank_accounts set balance=balance-total,updated_at=clock_timestamp() where player_id=p_player_id;
  insert into public.bank_stock_holdings(player_id,symbol,shares,cost_basis)
    values(p_player_id,p_symbol,p_shares,total)
    on conflict(player_id,symbol) do update set shares=bank_stock_holdings.shares+excluded.shares,
      cost_basis=bank_stock_holdings.cost_basis+excluded.cost_basis,updated_at=clock_timestamp();
  insert into public.bank_stock_dividend_pools(symbol,balance) values(p_symbol,fee)
    on conflict(symbol) do update set balance=bank_stock_dividend_pools.balance+excluded.balance,updated_at=clock_timestamp();
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_buy',-total,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price,'commission',fee));
  return jsonb_build_object('success',true,'balance',a.balance-total,'price',q.price,'gross',gross,'commission',fee,'total',total);
end $$;

create or replace function public.bank_sell_stock_rpc(p_player_id uuid,p_symbol text,p_shares int)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare q public.bank_stock_quotes; h public.bank_stock_holdings; gross bigint; fee bigint; proceeds bigint; sold_cost numeric(30,6);
begin
  if p_shares is null or p_shares<1 or p_shares>10000 then
    return jsonb_build_object('error','Некорректное количество акций');
  end if;
  select * into q from public.bank_stock_quotes where symbol=p_symbol for update;
  if not found then return jsonb_build_object('error','Акция не найдена'); end if;
  select * into h from public.bank_stock_holdings where player_id=p_player_id and symbol=p_symbol for update;
  if not found or h.shares<p_shares then return jsonb_build_object('error','Недостаточно акций'); end if;
  gross:=q.price*p_shares; fee:=greatest(1,ceil(gross*0.01)::bigint); proceeds:=greatest(0,gross-fee);
  sold_cost:=h.cost_basis*p_shares/h.shares;
  update public.bank_stock_holdings set shares=shares-p_shares,cost_basis=greatest(0,cost_basis-sold_cost),
    realized_profit=realized_profit+proceeds-sold_cost,updated_at=clock_timestamp()
    where player_id=p_player_id and symbol=p_symbol;
  update public.bank_accounts set balance=balance+proceeds,updated_at=clock_timestamp() where player_id=p_player_id;
  insert into public.bank_stock_dividend_pools(symbol,balance) values(p_symbol,fee)
    on conflict(symbol) do update set balance=bank_stock_dividend_pools.balance+excluded.balance,updated_at=clock_timestamp();
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'stock_sell',proceeds,jsonb_build_object('symbol',p_symbol,'shares',p_shares,'price',q.price,'gross',gross,'commission',fee));
  return jsonb_build_object('success',true,'proceeds',proceeds,'gross',gross,'commission',fee,'price',q.price);
end $$;

create or replace function public.bank_market_tick_rpc()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare q public.bank_stock_quotes; recent numeric; previous numeric; signal numeric; noise numeric; move_pct numeric; next_price bigint;
  utc_day timestamptz; eligible_shares bigint; pool_balance bigint; dividend_budget bigint;
  per_share bigint; total_paid bigint; holder record; holder_payout bigint;
  l public.bank_loans; recovered bigint; surplus bigint; p public.players;
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
        where symbol=q.symbol and shares>0 and updated_at<=utc_day-interval '6 hours';
      select coalesce(balance,0) into pool_balance from public.bank_stock_dividend_pools where symbol=q.symbol for update;
      dividend_budget:=floor(pool_balance*0.20)::bigint;
      per_share:=case when eligible_shares>0 then floor(dividend_budget/eligible_shares)::bigint else 0 end;
      total_paid:=0;
      if per_share>0 then
        for holder in select player_id,shares from public.bank_stock_holdings
          where symbol=q.symbol and shares>0 and updated_at<=utc_day-interval '6 hours' loop
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

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='bank-market-minute-tick';
    perform cron.unschedule(jobid) from cron.job where jobname='bank-market-five-minute-tick';
    perform cron.schedule('bank-market-five-minute-tick','*/5 * * * *','select public.bank_market_tick_rpc();');
  end if;
end $$;

revoke all on function public.bank_get_state_rpc(uuid),public.bank_buy_stock_rpc(uuid,text,int),
  public.bank_sell_stock_rpc(uuid,text,int),public.bank_market_tick_rpc() from public,anon,authenticated;
grant execute on function public.bank_get_state_rpc(uuid),public.bank_buy_stock_rpc(uuid,text,int),
  public.bank_sell_stock_rpc(uuid,text,int),public.bank_market_tick_rpc() to service_role;
notify pgrst,'reload schema';
