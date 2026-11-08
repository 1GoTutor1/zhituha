-- Restore referral activation and the complete work pipeline after the atomic
-- daily-mission wrapper replaced the referral-aware work wrapper.

-- Preserve referrals that already received referral commissions so this repair
-- never opens a second commission window for them.
update public.players
set referral_commission_activated_at = coalesce(
  referral_commission_until - interval '14 days',
  referral_signup_rewarded_at,
  created_at,
  clock_timestamp()
)
where referred_by is not null
  and referral_commission_activated_at is null
  and (
    coalesce(referral_commission_earned, 0) > 0
    or referral_commission_until > clock_timestamp()
  );

create or replace function public.activate_referral_after_work_rpc(p_new_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  invitee public.players;
  inviter public.players;
  visits integer;
  v_now timestamptz := clock_timestamp();
  signup_reward bigint := 0;
  token_reward bigint := 0;
begin
  select * into invitee
  from public.players
  where id = p_new_player_id
  for update;

  if not found or invitee.referred_by is null or coalesce(invitee.is_banned, false) then
    return jsonb_build_object('activated', false, 'reason', 'not_eligible');
  end if;

  if invitee.referral_commission_activated_at is not null then
    return jsonb_build_object('activated', false, 'duplicate', true);
  end if;

  select count(*)::integer into visits
  from public.referral_visit_days
  where player_id = p_new_player_id;

  if visits < 2 then
    return jsonb_build_object('activated', false, 'visits_required', 2, 'visits', visits);
  end if;

  select * into inviter
  from public.players
  where telegram_id = invitee.referred_by
  for update;

  if not found or coalesce(inviter.is_banned, false) then
    return jsonb_build_object('activated', false, 'referrer_missing_or_banned');
  end if;

  -- Historical referrals have already had the signup reward backfilled. Give
  -- the cash/tokens only to a referral that has not received it before.
  if invitee.referral_signup_rewarded_at is null then
    update public.players
    set money = coalesce(money, 0) + 500,
        premium_balance = coalesce(premium_balance, 0) + 10
    where id = inviter.id
    returning * into inviter;
    signup_reward := 500;
    token_reward := 10;
  end if;

  update public.players
  set referral_signup_rewarded_at = coalesce(referral_signup_rewarded_at, v_now),
      referral_commission_activated_at = v_now,
      referral_commission_until = v_now + interval '14 days',
      referral_commission_earned = 0
  where id = p_new_player_id;

  return jsonb_build_object(
    'activated', true,
    'legacy', invitee.referral_signup_rewarded_at is not null,
    'commission_percent', 5,
    'commission_days', 14,
    'commission_cap', 10000,
    'referrer_money_bonus', signup_reward,
    'referrer_token_bonus', token_reward,
    'referrer_money', inviter.money,
    'referrer_premium_balance', inviter.premium_balance
  );
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

revoke all on function public.activate_referral_after_work_rpc(uuid)
  from public, anon, authenticated;
revoke all on function public.work_rpc(uuid)
  from public, anon, authenticated;
grant execute on function public.work_rpc(uuid) to service_role;

notify pgrst, 'reload schema';
