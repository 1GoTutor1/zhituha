-- Donat + cosmetics patch. Re-run in Supabase SQL Editor before deploying the matching app to apply the current exchange rates.
alter table public.players
  add column if not exists premium_balance bigint not null default 0,
  add column if not exists owned_cosmetics text[] not null default '{}',
  add column if not exists profile_frame text not null default '',
  add column if not exists profile_background text not null default '';

create table if not exists public.donation_orders (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  telegram_id text not null,
  package_id text not null check (package_id in ('starter','popular','big')),
  stars_amount integer not null check (stars_amount > 0),
  credits_amount integer not null check (credits_amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  telegram_charge_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.donation_orders enable row level security;
revoke all on public.donation_orders from public, anon, authenticated;
grant select, insert, update on public.donation_orders to service_role;
grant usage on schema public to service_role;
create unique index if not exists donation_one_pending_order_per_player
  on public.donation_orders(player_id) where status='pending';

create or replace function public.apply_stars_payment_rpc(
  p_order_id uuid, p_telegram_id text, p_charge_id text, p_stars_amount integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.donation_orders; p public.players;
begin
  if p_charge_id is null or length(p_charge_id) < 5 then return jsonb_build_object('error','invalid charge'); end if;
  select * into o from public.donation_orders where id = p_order_id for update;
  if not found or o.telegram_id <> p_telegram_id or o.stars_amount <> p_stars_amount then
    return jsonb_build_object('error','payment does not match order');
  end if;
  if o.status = 'paid' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if exists (select 1 from public.donation_orders where telegram_charge_id = p_charge_id) then
    return jsonb_build_object('error','charge already processed');
  end if;
  update public.players set premium_balance = premium_balance + o.credits_amount where id = o.player_id returning * into p;
  if not found then return jsonb_build_object('error','player not found'); end if;
  update public.donation_orders set status='paid', telegram_charge_id=p_charge_id, paid_at=now() where id=o.id;
  return jsonb_build_object('ok',true,'premium_balance',p.premium_balance);
end $$;

create or replace function public.donation_exchange_rpc(
  p_player_id uuid, p_direction text, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.players; gems bigint; coins bigint;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if p_direction='money_to_premium' then
    if p_amount < 2500 or p_amount > 200000 or p_amount % 2500 <> 0 then return jsonb_build_object('error','Обмен: от 2 500 до 200 000 монет, шаг 2 500'); end if;
    if p.money < p_amount then return jsonb_build_object('error','Недостаточно монет'); end if;
    gems := p_amount / 2500;
    update public.players set money=money-p_amount, premium_balance=premium_balance+gems where id=p_player_id returning * into p;
  elsif p_direction='premium_to_money' then
    if p_amount < 1 or p_amount > 100 then return jsonb_build_object('error','Некорректное количество жетонов'); end if;
    if p.premium_balance < p_amount then return jsonb_build_object('error','Недостаточно жетонов'); end if;
    coins := p_amount * 1500;
    update public.players set money=money+coins, premium_balance=premium_balance-p_amount where id=p_player_id returning * into p;
  else return jsonb_build_object('error','Неизвестный обмен'); end if;
  return jsonb_build_object('ok',true,'player',jsonb_build_object('money',p.money,'premium_balance',p.premium_balance,'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

create or replace function public.donation_purchase_rpc(p_player_id uuid, p_item_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.players; cost bigint;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  cost := case p_item_id when 'frame_test' then 120 when 'frame_amber' then 60 when 'background_concrete' then 90 when 'market_slots_2' then case when coalesce(p.market_slots,3) >= 8 then 40 else 80 end else null end;
  if cost is null then return jsonb_build_object('error','Предмет не найден'); end if;
  if p.premium_balance < cost then return jsonb_build_object('error','Недостаточно жетонов'); end if;
  if p_item_id <> 'market_slots_2' and p_item_id = any(p.owned_cosmetics) then return jsonb_build_object('error','Уже куплено'); end if;
  if p_item_id = 'market_slots_2' and coalesce(p.market_slots,3) >= 9 then return jsonb_build_object('error','Достигнут максимум слотов'); end if;
  if p_item_id = 'market_slots_2' then
    update public.players set premium_balance=premium_balance-cost, market_slots=least(coalesce(market_slots,3)+2,9) where id=p_player_id returning * into p;
  else
    update public.players set premium_balance=premium_balance-cost, owned_cosmetics=array_append(owned_cosmetics,p_item_id) where id=p_player_id returning * into p;
  end if;
  return jsonb_build_object('ok',true,'player',jsonb_build_object('money',p.money,'premium_balance',p.premium_balance,'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

create or replace function public.donation_equip_rpc(p_player_id uuid, p_item_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.players;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if p_item_id='default' then
    update public.players set profile_frame='', profile_background='' where id=p_player_id returning * into p;
  elsif p_item_id in ('frame_test','frame_amber') and p_item_id = any(p.owned_cosmetics) then
    update public.players set profile_frame=p_item_id where id=p_player_id returning * into p;
  elsif p_item_id='background_concrete' and p_item_id = any(p.owned_cosmetics) then
    update public.players set profile_background=p_item_id where id=p_player_id returning * into p;
  else return jsonb_build_object('error','Сначала купи эту косметику'); end if;
  return jsonb_build_object('ok',true,'player',jsonb_build_object('money',p.money,'premium_balance',p.premium_balance,'market_slots',p.market_slots,'owned_cosmetics',p.owned_cosmetics,'profile_frame',p.profile_frame,'profile_background',p.profile_background));
end $$;

revoke execute on function public.apply_stars_payment_rpc(uuid,text,text,integer) from public, anon, authenticated;
revoke execute on function public.donation_exchange_rpc(uuid,text,bigint) from public, anon, authenticated;
revoke execute on function public.donation_purchase_rpc(uuid,text) from public, anon, authenticated;
revoke execute on function public.donation_equip_rpc(uuid,text) from public, anon, authenticated;
grant execute on function public.apply_stars_payment_rpc(uuid,text,text,integer) to service_role;
grant execute on function public.donation_exchange_rpc(uuid,text,bigint) to service_role;
grant execute on function public.donation_purchase_rpc(uuid,text) to service_role;
grant execute on function public.donation_equip_rpc(uuid,text) to service_role;
