create or replace function public.work_rpc_before_return_bonus(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare r jsonb;
begin
  r := public.work_rpc_before_season_pass(p_player_id);
  if r is null or r ? 'error'
    or coalesce((r->>'captcha_required')::boolean,false)
    or coalesce((r->>'blocked')::boolean,false)
    or coalesce((r->>'ignored')::boolean,false)
    or r->>'work_pay' is null then
    return r;
  end if;
  return r;
end;
$$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  r jsonb;
  base_amount bigint;
  extra bigint;
  next_money bigint;
  referral_result jsonb;
  referrer_tg text;
  referral_before bigint;
  referral_after bigint;
  old_commission bigint;
  new_commission bigint;
  earned_so_far bigint;
  commission_until timestamptz;
begin
  -- Keep the full existing work flow: captcha, XP, daily missions, coffee and
  -- season pass. The inner legacy work RPC still writes the 5% commission;
  -- capture and cap that delta below without changing the underlying payout.
  select referred_by into referrer_tg
  from public.players
  where id = p_player_id
  for update;

  if referrer_tg is not null then
    select coalesce(referral_balance, 0) into referral_before
    from public.players
    where telegram_id = referrer_tg
    for update;
  end if;

  r := public.work_rpc_before_return_bonus(p_player_id);
  if r is null
    or r ? 'error'
    or coalesce((r->>'captcha_required')::boolean, false)
    or coalesce((r->>'ignored')::boolean, false)
    or coalesce((r->>'blocked')::boolean, false)
    or r->>'work_pay' is null then
    return r;
  end if;

  -- Count this only after the base work action succeeded; keep it in the same transaction.
  perform public.season_pass_add_xp(p_player_id, 'work');

  referral_result := public.activate_referral_after_work_rpc(p_player_id);
  if coalesce((referral_result->>'activated')::boolean, false) then
    r := r || jsonb_build_object('referral_activated', true);
  end if;

  base_amount := greatest(0, coalesce((r->>'work_pay')::bigint, 0));
  if referrer_tg is not null and referral_before is not null then
    select coalesce(referral_balance, 0) into referral_after
    from public.players
    where telegram_id = referrer_tg;

    old_commission := greatest(0, coalesce(referral_after, referral_before) - referral_before);
    if old_commission > 0 then
      select coalesce(referral_commission_earned, 0), referral_commission_until
      into earned_so_far, commission_until
      from public.players
      where id = p_player_id
      for update;

      new_commission := case
        when commission_until > clock_timestamp() and earned_so_far < 10000
          then least(old_commission, 10000 - earned_so_far)
        else 0
      end;

      update public.players
      set referral_balance = greatest(0, coalesce(referral_balance, 0) - old_commission)
      where telegram_id = referrer_tg;

      if new_commission > 0 then
        update public.players
        set referral_balance = coalesce(referral_balance, 0) + new_commission
        where telegram_id = referrer_tg;

        update public.players
        set referral_commission_earned = coalesce(referral_commission_earned, 0) + new_commission
        where id = p_player_id;
      end if;
    end if;
  end if;

  extra := public.apply_return_boost_bonus_rpc(p_player_id, base_amount);
  if extra > 0 then
    select money into next_money from public.players where id = p_player_id;
    r := r || jsonb_build_object(
      'work_pay', base_amount + extra,
      'return_bonus_income', extra,
      'money', next_money
    );
  end if;

  return r;
end;
$$;
notify pgrst, 'reload schema';
