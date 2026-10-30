-- Let active lease-to-own businesses pay passive-income upgrades from their cash box.
-- Apply after BUSINESS_PASSIVE_INCOME.sql and BUSINESS_LEASE_TO_OWN_MIGRATION.sql.

create or replace function public.upgrade_leased_business_passive_rpc(
  p_biz_id uuid,
  p_player_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  p public.players;
  b public.businesses;
  lease public.business_lease_contracts;
  next_level integer;
  price bigint;
  passive_balance bigint;
begin
  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;

  select * into b from public.businesses
  where id = p_biz_id and owner_id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Бизнес не найден'); end if;

  select * into lease from public.business_lease_contracts
  where business_id = p_biz_id and lessee_id = p_player_id and status = 'active'
  for update;
  if not found then return jsonb_build_object('error', 'Действующая аренда с выкупом не найдена'); end if;

  next_level := coalesce(b.passive_level, -1) + 1;
  if next_level > 3 then return jsonb_build_object('error', 'Достигнут максимальный уровень пассивного дохода'); end if;

  price := case b.biz_type
    when 'coffee' then (array[5000, 20000, 60000, 150000]::bigint[])[next_level + 1]
    when 'salon' then (array[50000, 150000, 400000, 1000000]::bigint[])[next_level + 1]
    when 'phone_factory' then (array[100000, 300000, 800000, 2000000]::bigint[])[next_level + 1]
    when 'construction' then (array[150000, 500000, 1500000, 3000000]::bigint[])[next_level + 1]
    when 'taxi' then (array[100000, 300000, 700000, 1500000]::bigint[])[next_level + 1]
    else null
  end;
  if price is null then return jsonb_build_object('error', 'Для этого типа бизнеса пассивный доход недоступен'); end if;
  if coalesce(b.cash_balance, 0) < price then
    return jsonb_build_object('error', format('В кассе бизнеса нужно %s ₽', price));
  end if;

  passive_balance := public.settle_business_passive(p_biz_id, clock_timestamp());
  update public.businesses
  set cash_balance = coalesce(cash_balance, 0) - price,
      passive_level = next_level,
      passive_updated_at = clock_timestamp()
  where id = p_biz_id
  returning * into b;

  perform public.log_action_rpc(
    p_player_id,
    'upgrade_business_passive',
    jsonb_build_object(
      'business_id', p_biz_id,
      'level', next_level,
      'payment_source', 'business_cash',
      'cost', price
    ),
    0,
    least(coalesce(p.money, 0), 2147483647)::integer
  );

  return jsonb_build_object(
    'level', next_level,
    'money', p.money,
    'cash_balance', b.cash_balance,
    'passive_balance', passive_balance,
    'passive_updated_at', b.passive_updated_at,
    'price', price,
    'payment_source', 'business_cash'
  );
end;
$$;

revoke all on function public.upgrade_leased_business_passive_rpc(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.upgrade_leased_business_passive_rpc(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
