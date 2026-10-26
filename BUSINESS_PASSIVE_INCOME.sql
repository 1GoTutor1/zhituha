-- Пассивный доход бизнесов, уровни 0-3.
-- Выполнить один раз в Supabase Dashboard -> SQL Editor.
-- Пассивный доход: -1 = закрыт, 0..3 = открытие и три улучшения.
alter table public.businesses add column if not exists passive_level smallint not null default -1;
alter table public.businesses add column if not exists passive_balance bigint not null default 0;
alter table public.businesses add column if not exists passive_updated_at timestamptz not null default now();
update public.businesses set passive_level = -1 where passive_level is null or passive_level < -1 or passive_level > 3;
update public.businesses set passive_balance = 0 where passive_balance is null or passive_balance < 0;
update public.businesses set passive_updated_at = now() where passive_updated_at is null;
alter table public.businesses alter column passive_level set default -1;
alter table public.businesses alter column passive_level set not null;
alter table public.businesses alter column passive_balance set default 0;
alter table public.businesses alter column passive_balance set not null;
alter table public.businesses alter column passive_updated_at set default now();
alter table public.businesses alter column passive_updated_at set not null;

drop trigger if exists business_workers_passive_income_trigger on public.business_workers;

create or replace function public.settle_business_passive(
  p_biz_id uuid, p_settle_at timestamptz default clock_timestamp())
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b businesses;
  elapsed_minutes bigint;
  rate_per_minute bigint;
  units bigint := 1;
  earned bigint := 0;
  eligible boolean := true;
begin
  select * into b from businesses where id = p_biz_id for update;
  if not found then return 0; end if;

  if b.passive_level < 0 then
    update businesses set passive_updated_at = p_settle_at where id = p_biz_id;
    return coalesce(b.passive_balance, 0);
  end if;

  rate_per_minute := case b.biz_type
    when 'coffee' then (array[0,15,40,100,250]::bigint[])[b.passive_level + 2]
    when 'salon' then (array[0,60,150,350,800]::bigint[])[b.passive_level + 2]
    when 'phone_factory' then (array[0,100,250,600,1400]::bigint[])[b.passive_level + 2]
    when 'construction' then (array[0,150,400,900,2000]::bigint[])[b.passive_level + 2]
    when 'taxi' then (array[0,30,80,200,500]::bigint[])[b.passive_level + 2]
    else 0
  end;

  if b.biz_type = 'taxi' then
    units := jsonb_array_length(case when jsonb_typeof(coalesce(b.stock->'taxi_cars','[]'::jsonb)) = 'array'
      then coalesce(b.stock->'taxi_cars','[]'::jsonb) else '[]'::jsonb end);
    eligible := units > 0 and exists(select 1 from business_workers where business_id = p_biz_id);
  end if;

  if not eligible then
    update businesses set passive_updated_at = p_settle_at where id = p_biz_id;
    return coalesce(b.passive_balance, 0);
  end if;

  elapsed_minutes := greatest(0, floor(extract(epoch from (p_settle_at - b.passive_updated_at)) / 60))::bigint;
  if elapsed_minutes > 0 then
    earned := elapsed_minutes * rate_per_minute * units;
    update businesses set passive_balance = coalesce(passive_balance,0) + earned,
      passive_updated_at = passive_updated_at + elapsed_minutes * interval '1 minute'
      where id = p_biz_id;
  end if;
  return coalesce(b.passive_balance,0) + earned;
end $$;

revoke all on function public.settle_business_passive(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.settle_business_passive(uuid, timestamptz) to service_role;

create or replace function public.business_worker_passive_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform public.settle_business_passive(new.business_id, clock_timestamp());
    return new;
  end if;

  perform public.settle_business_passive(old.business_id, clock_timestamp());
  if not exists(select 1 from business_workers where business_id = old.business_id and id <> old.id) then
    update businesses set passive_updated_at = clock_timestamp() where id = old.business_id;
  end if;
  return old;
end $$;

create trigger business_workers_passive_income_trigger
before insert or delete on public.business_workers
for each row execute function public.business_worker_passive_trigger();

create or replace function public.upgrade_business_passive_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p players;
  b businesses;
  next_level int;
  price int;
  balance bigint;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  select * into b from businesses where id = p_biz_id and owner_id = p_player_id for update;
  if not found then return jsonb_build_object('error','business not owned'); end if;
  next_level := coalesce(b.passive_level,-1) + 1;
  if next_level > 3 then return jsonb_build_object('error','maximum passive level reached'); end if;
  price := case b.biz_type
    when 'coffee' then (array[5000,20000,60000,150000]::bigint[])[next_level + 1]
    when 'salon' then (array[50000,150000,400000,1000000]::bigint[])[next_level + 1]
    when 'phone_factory' then (array[100000,300000,800000,2000000]::bigint[])[next_level + 1]
    when 'construction' then (array[150000,500000,1500000,3000000]::bigint[])[next_level + 1]
    when 'taxi' then (array[100000,300000,700000,1500000]::bigint[])[next_level + 1]
    else null
  end;
  if price is null then return jsonb_build_object('error','unsupported business type'); end if;
  if coalesce(p.money,0) < price then return jsonb_build_object('error','not enough money'); end if;

  balance := public.settle_business_passive(p_biz_id, clock_timestamp());
  update players set money = money - price where id = p_player_id returning * into p;
  update businesses set passive_level = next_level, passive_updated_at = clock_timestamp()
    where id = p_biz_id returning * into b;
  perform log_action_rpc(p_player_id, 'upgrade_business_passive',
    jsonb_build_object('business_id',p_biz_id,'level',next_level), -price, least(p.money,2147483647)::int);
  return jsonb_build_object('level',next_level,'money',p.money,'passive_balance',balance,
    'passive_updated_at',b.passive_updated_at,'price',price);
end $$;

create or replace function public.collect_business_passive_rpc(p_biz_id uuid, p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p players;
  b businesses;
  amount bigint;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  select * into b from businesses where id = p_biz_id and owner_id = p_player_id for update;
  if not found then return jsonb_build_object('error','business not owned'); end if;
  if coalesce(b.passive_level,-1) < 0 then return jsonb_build_object('error','passive income is locked'); end if;

  amount := public.settle_business_passive(p_biz_id, clock_timestamp());
  if amount <= 0 then return jsonb_build_object('error','no passive income yet'); end if;
  update businesses set passive_balance = 0 where id = p_biz_id returning * into b;
  update players set money = money + amount where id = p_player_id returning * into p;
  perform log_action_rpc(p_player_id, 'collect_business_passive',
    jsonb_build_object('business_id',p_biz_id,'amount',amount), least(amount,2147483647)::int, least(p.money,2147483647)::int);
  return jsonb_build_object('collected',amount,'money',p.money,'passive_updated_at',b.passive_updated_at);
end $$;


revoke execute on function public.business_worker_passive_trigger() from public, anon, authenticated;
revoke execute on function public.upgrade_business_passive_rpc(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.collect_business_passive_rpc(uuid, uuid) from public, anon, authenticated;
grant execute on function public.upgrade_business_passive_rpc(uuid, uuid) to service_role;
grant execute on function public.collect_business_passive_rpc(uuid, uuid) to service_role;