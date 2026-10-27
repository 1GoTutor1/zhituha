-- Work pay: keep the base at 150 and apply only owned-business bonuses.
-- The "quiet day" event no longer multiplies the work payout.
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  p players;
  business_bonus int;
  energy_cost int;
  work_pay int;
  today text;
  hash_value bigint := 0;
  day_index int;
  i int;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Player not found'); end if;

  energy_cost := case when p.has_car then 10 else 20 end;
  if coalesce(p.energy, 0) < energy_cost then
    return jsonb_build_object('error', 'Not enough energy');
  end if;

  select coalesce(sum(case biz_type
    when 'coffee' then 5
    when 'salon' then 10
    when 'taxi' then 15
    when 'phone_factory' then 20
    when 'construction' then 25
    else 0 end), 0)::int
  into business_bonus
  from businesses where owner_id = p_player_id;

  today := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  for i in 1..length(today) loop
    hash_value := mod(hash_value * 31 + ascii(substr(today, i, 1)), 4294967296);
    if hash_value < 0 then hash_value := hash_value + 4294967296; end if;
    if hash_value >= 2147483648 then hash_value := hash_value - 4294967296; end if;
  end loop;
  day_index := mod(abs(hash_value), 10)::int;

  work_pay := floor(150 * (1 + business_bonus / 100.0));
  update players
  set money = coalesce(money, 0) + work_pay,
      energy = coalesce(energy, 0) - energy_cost
  where id = p_player_id
  returning * into p;

  if p.referred_by is not null then
    update players
    set referral_balance = coalesce(referral_balance, 0) +
      floor(work_pay * 0.05 * case when day_index = 6 then 2 else 1 end)
    where telegram_id = p.referred_by;
  end if;

  return jsonb_build_object('money', p.money, 'energy', p.energy, 'work_pay', work_pay);
end;
$$;
