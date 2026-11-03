-- Limit each passive-income settlement to eight hours of uncollected time.
-- Apply after BUSINESS_PASSIVE_INCOME.sql. Existing balances are not changed.

create or replace function public.settle_business_passive(
  p_biz_id uuid,
  p_settle_at timestamptz default clock_timestamp()
) returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.businesses;
  elapsed_minutes bigint;
  earned_minutes bigint;
  rate_per_minute bigint;
  units bigint := 1;
  earned bigint := 0;
  eligible boolean := true;
begin
  select * into b
  from public.businesses
  where id = p_biz_id
  for update;
  if not found then return 0; end if;

  if b.passive_level < 0 then
    update public.businesses
    set passive_updated_at = p_settle_at
    where id = p_biz_id;
    return coalesce(b.passive_balance, 0);
  end if;

  rate_per_minute := case b.biz_type
    when 'coffee' then (array[0, 15, 40, 100, 250]::bigint[])[b.passive_level + 2]
    when 'salon' then (array[0, 60, 150, 350, 800]::bigint[])[b.passive_level + 2]
    when 'phone_factory' then (array[0, 100, 250, 600, 1400]::bigint[])[b.passive_level + 2]
    when 'construction' then (array[0, 150, 400, 900, 2000]::bigint[])[b.passive_level + 2]
    when 'taxi' then (array[0, 30, 80, 200, 500]::bigint[])[b.passive_level + 2]
    else 0
  end;

  if b.biz_type = 'taxi' then
    units := jsonb_array_length(
      case
        when jsonb_typeof(coalesce(b.stock->'taxi_cars', '[]'::jsonb)) = 'array'
          then coalesce(b.stock->'taxi_cars', '[]'::jsonb)
        else '[]'::jsonb
      end
    );
    eligible := units > 0 and exists (
      select 1 from public.business_workers where business_id = p_biz_id
    );
  end if;

  if not eligible then
    update public.businesses
    set passive_updated_at = p_settle_at
    where id = p_biz_id;
    return coalesce(b.passive_balance, 0);
  end if;

  elapsed_minutes := greatest(
    0,
    floor(extract(epoch from (p_settle_at - b.passive_updated_at)) / 60)
  )::bigint;
  earned_minutes := least(elapsed_minutes, 8 * 60);

  if earned_minutes > 0 then
    earned := earned_minutes * rate_per_minute * units;
    update public.businesses
    set passive_balance = coalesce(passive_balance, 0) + earned,
        passive_updated_at = case
          when elapsed_minutes > 8 * 60 then p_settle_at
          else passive_updated_at + earned_minutes * interval '1 minute'
        end
    where id = p_biz_id;
  elsif elapsed_minutes > 8 * 60 then
    update public.businesses
    set passive_updated_at = p_settle_at
    where id = p_biz_id;
  end if;

  return coalesce(b.passive_balance, 0) + earned;
end;
$$;

revoke all on function public.settle_business_passive(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.settle_business_passive(uuid, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
