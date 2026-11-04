-- Repair commission activation for referrals that existed before the
-- referral signup reward migration. Run after REFERRAL_AND_RETURN_BONUS_MIGRATION.sql.

alter table public.players
  add column if not exists referral_commission_activated_at timestamptz;

-- Preserve referrals that have already earned commissions or still have an
-- active window. Legacy referrals with no earnings and an expired backfilled
-- window may activate once after meeting the normal activity requirements.
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

  if not found or invitee.referred_by is null then
    return jsonb_build_object('activated', false, 'reason', 'not_referred');
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

  if not found then
    return jsonb_build_object('activated', false, 'referrer_missing', true);
  end if;

  -- Only referrals that have not received the signup reward get it here.
  -- Existing referrals keep their history and receive only the repaired
  -- commission window, avoiding duplicate cash/token rewards.
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

revoke all on function public.activate_referral_after_work_rpc(uuid)
  from public, anon, authenticated;

-- This helper is called only by the SECURITY DEFINER work RPC wrapper.
