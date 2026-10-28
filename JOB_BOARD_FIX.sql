-- Fix employment validation and serialize hiring to protect job slots. Run in Supabase SQL Editor.
create or replace function public.validate_worker_role(
  p_biz_id uuid, p_player_id uuid, p_role text, p_salary int)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare b businesses; need int; allowed int; cnt int;
begin
  if p_role is null or p_salary is null then return 'Некорректная роль'; end if;
  select biz_type into b.biz_type from businesses where id = p_biz_id and owner_id <> p_player_id;
  if not found then return 'бизнес не найден'; end if;

  -- один игрок = одна работа во всей игре
  if exists (select 1 from business_workers where player_id = p_player_id) then
    return 'уже работаешь'; end if;

  if b.biz_type = 'coffee' then
    if p_role = 'Бариста' then
      if p_salary <> 60 then return 'Зарплата бариста фиксирована: 60'; end if;
      allowed := 1;
    elsif p_role = 'Помощник бариста' then
      if p_salary <> 30 then return 'Зарплата помощника фиксирована: 30'; end if;
      allowed := 1;
    else return 'Такой роли в кофейне нет'; end if;
  elsif b.biz_type = 'salon' then
    if p_role = 'Механик' then
      if p_salary <> 10000 then return 'Зарплата механика фиксирована: 10000'; end if;
      allowed := 2;
    elsif p_role = 'Продавец' then
      if p_salary <> 15000 then return 'Зарплата продавца фиксирована: 15000'; end if;
      allowed := 1;
    else return 'Такой роли в автосалоне нет'; end if;
  elsif b.biz_type = 'phone_factory' then
    if p_role = 'Сборщик' then
      if p_salary <> 10000 then return 'Зарплата сборщика фиксирована: 10000'; end if;
      allowed := 2;
    elsif p_role = 'Инженер' then
      if p_salary <> 15000 then return 'Зарплата инженера фиксирована: 15000'; end if;
      allowed := 1;
    else return 'Такой роли в цехе нет'; end if;
  elsif b.biz_type = 'construction' then
    if p_role = 'Строитель' then
      if p_salary <> 10000 then return 'Зарплата строителя фиксирована: 10000'; end if;
      allowed := 3;
    elsif p_role = 'Прораб' then
      if p_salary <> 20000 then return 'Зарплата прораба фиксирована: 20000'; end if;
      allowed := 1;
    else return 'Такой роли в стройтресте нет'; end if;
  elsif b.biz_type = 'taxi' then
    if p_role = 'Водитель' then
      if p_salary <> 10 then return 'Ставка водителя фиксирована: 10% кассы'; end if;
      allowed := 2;
    elsif p_role = 'Механик' then
      if p_salary <> 5 then return 'Ставка механика фиксирована: 5% кассы'; end if;
      allowed := 1;
    else return 'Такой роли в таксопарке нет'; end if;
  else return 'Неизвестный тип бизнеса'; end if;

  select count(*) into cnt from business_workers
   where business_id = p_biz_id and role = p_role;
  if cnt >= allowed then return 'Места заняты (' || allowed || ')'; end if;
  return null; -- всё ок
end $$;

create or replace function public.hire_worker_rpc(
  p_player_id uuid, p_player_name text, p_business_id uuid, p_role text, p_salary int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare vtext text; v_player_name text;
begin
  perform 1 from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  perform 1 from public.businesses where id = p_business_id for update;
  if not found then return jsonb_build_object('error','business not found'); end if;
  select nickname into v_player_name from public.players where id = p_player_id;
  vtext := public.validate_worker_role(p_business_id, p_player_id, p_role, p_salary);
  if vtext is not null then return jsonb_build_object('error', vtext); end if;
  insert into public.business_workers (business_id, player_id, player_name, role, salary)
  values (p_business_id, p_player_id, v_player_name, p_role, p_salary);
  return jsonb_build_object('workers',
    (select jsonb_agg(w2) from public.business_workers w2 where w2.business_id = p_business_id));
end $$;
