-- Shorten available fixed deposit terms for 1?2 week seasons.
-- Apply after BANK_MIGRATION.sql in Supabase SQL Editor.

create or replace function public.bank_open_deposit_rpc(p_player_id uuid, p_amount bigint, p_term_hours int)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare rate int; account public.bank_accounts; deposit_id uuid; maturity timestamptz; active_principal bigint;
begin
  rate := case p_term_hours when 1 then 10 when 6 then 30 when 12 then 50 when 24 then 100 when 72 then 400 when 168 then 1000 else null end;
  if rate is null then return jsonb_build_object('error','Выберите срок от 1 часа: 1, 6, 12, 24, 72 или 168 часов'); end if;
  if p_amount is null or p_amount<1000 or p_amount>1000000 then return jsonb_build_object('error','Вклад должен быть от 1 000 до 1 000 000 ₽'); end if;
  insert into public.bank_accounts(player_id) values(p_player_id) on conflict (player_id) do nothing;
  select * into account from public.bank_accounts where player_id=p_player_id for update;
  if account.balance<p_amount then return jsonb_build_object('error','Недостаточно денег на счёте'); end if;
  select coalesce(sum(principal),0) into active_principal from public.bank_deposits where player_id=p_player_id and status='active';
  if active_principal+p_amount>1000000 then return jsonb_build_object('error','Общий лимит активных вкладов — 1 000 000 ₽'); end if;
  maturity := now()+make_interval(hours=>p_term_hours);
  update public.bank_accounts set balance=balance-p_amount,updated_at=now() where player_id=p_player_id;
  insert into public.bank_deposits(player_id,principal,rate_bps,term_hours,maturity_at)
    values(p_player_id,p_amount,rate,p_term_hours,maturity) returning id into deposit_id;
  insert into public.bank_transactions(player_id,operation,amount,details)
    values(p_player_id,'deposit_open',-p_amount,jsonb_build_object('deposit_id',deposit_id,'term_hours',p_term_hours,'rate_bps',rate));
  return jsonb_build_object('success',true,'deposit_id',deposit_id,'maturity_at',maturity);
end $$;
