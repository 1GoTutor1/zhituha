-- Fix family territory attack numeric rounding. Run this in Supabase SQL Editor.
create or replace function public.family_territory_attack_rpc(p_player_id uuid, p_territory_key text, p_stake bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  member public.family_memberships;
  f public.families;
  territory public.family_territories;
  day_msk date := timezone('Europe/Moscow', clock_timestamp())::date;
  chance numeric(5,2);
  roll numeric(7,4);
  success boolean;
  new_defense bigint;
begin
  if p_territory_key is null or p_territory_key not in ('A','B','C') then return jsonb_build_object('error','Выбери территорию A, B или C'); end if;
  if p_stake is null or p_stake<25000 or p_stake>500000 or p_stake%5000<>0 then return jsonb_build_object('error','Ставка захвата: от 25 000 до 500 000 ₽, шаг 5 000 ₽'); end if;
  select * into member from public.family_memberships where player_id=p_player_id and left_at is null for update;
  if not found or member.member_role not in ('leader','deputy') then return jsonb_build_object('error','Захватывать территории могут лидер и заместитель'); end if;
  select * into f from public.families where id=member.family_id and disbanded_at is null for update;
  select * into territory from public.family_territories where territory_key=p_territory_key for update;
  if territory.owner_family_id=member.family_id then return jsonb_build_object('error','Эта территория уже ваша'); end if;
  if exists(select 1 from public.family_territory_attempts where family_id=member.family_id and attempt_day=day_msk) then
    return jsonb_build_object('error','Семья уже пробовала захватить территорию сегодня');
  end if;
  if coalesce(f.cash_balance,0)<p_stake then return jsonb_build_object('error','В кассе семьи недостаточно денег для этой ставки'); end if;
  chance := least(85::numeric, round(100.0*p_stake/(p_stake+greatest(territory.defense_value,territory.base_value)),2));
  roll := round((random()*100.0)::numeric,4);
  success := roll<chance;
  update public.families set cash_balance=cash_balance-p_stake
    where id=member.family_id returning * into f;
  insert into public.family_territory_attempts(family_id,player_id,territory_key,attempt_day,stake,defense_value,chance_percent,roll_percent,succeeded)
    values(member.family_id,p_player_id,p_territory_key,day_msk,p_stake,territory.defense_value,chance,roll,success);
  if success then
    new_defense := territory.base_value + least(territory.base_value,p_stake/2);
    update public.family_territories set owner_family_id=member.family_id,defense_value=new_defense,
      captured_at=clock_timestamp(),updated_at=clock_timestamp() where territory_key=p_territory_key;
  end if;
  return jsonb_build_object('success',true,'captured',success,'territory',p_territory_key,
    'stake',p_stake,'chance_percent',chance,'roll_percent',roll,'cash_balance',f.cash_balance,
    'message',case when success then 'Территория захвачена!' else 'Попытка не удалась. Ставка потрачена.' end);
end $$;
