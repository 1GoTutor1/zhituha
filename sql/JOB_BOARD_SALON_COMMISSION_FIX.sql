-- Align salon vacancy hiring with its commission model (mechanic 3%, seller 5%).
-- Accept old 10000/15000 values as well so clients deployed before this patch
-- can still hire until they refresh. Apply after JOB_BOARD_MINIMARKET_FIX.sql.

create or replace function public.validate_worker_role(
  p_biz_id uuid, p_player_id uuid, p_role text, p_salary integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b public.businesses;
  allowed integer;
  cnt integer;
begin
  if p_role is null or p_salary is null then return 'Некорректная роль'; end if;
  select * into b from public.businesses where id = p_biz_id and owner_id <> p_player_id;
  if not found then return 'Бизнес не найден'; end if;
  if exists(select 1 from public.business_workers where player_id = p_player_id) then
    return 'Уже работаешь';
  end if;

  if b.biz_type = 'minimarket' then
    if p_role <> 'Кассир' or p_salary <> 5 then return 'Кассиру положено 5% с продаж'; end if;
    allowed := 1;
  elsif b.biz_type = 'auto_repair' then
    if p_role <> 'Механик' or p_salary <> 3 then return 'Механику положено 3% с ремонта'; end if;
    allowed := 1;
  elsif b.biz_type = 'coffee' then
    if p_role = 'Бариста' and p_salary = 60 then allowed := 1;
    elsif p_role = 'Помощник бариста' and p_salary = 30 then allowed := 1;
    else return 'Для кофейни выбери доступную вакансию'; end if;
  elsif b.biz_type = 'salon' then
    if p_role = 'Механик' and p_salary in (3, 10000) then allowed := 2;
    elsif p_role = 'Продавец' and p_salary in (5, 15000) then allowed := 1;
    else return 'Для автосалона выбери доступную вакансию'; end if;
  elsif b.biz_type = 'phone_factory' then
    if p_role = 'Сборщик' and p_salary = 10000 then allowed := 2;
    elsif p_role = 'Инженер' and p_salary = 15000 then allowed := 1;
    else return 'Для цеха выбери доступную вакансию'; end if;
  elsif b.biz_type = 'construction' then
    if p_role = 'Строитель' and p_salary = 10000 then allowed := 3;
    elsif p_role = 'Прораб' and p_salary = 20000 then allowed := 1;
    else return 'Для стройтреста выбери доступную вакансию'; end if;
  elsif b.biz_type = 'taxi' then
    if p_role = 'Водитель' and p_salary = 10 then allowed := 2;
    elsif p_role = 'Механик' and p_salary = 5 then allowed := 1;
    else return 'Для таксопарка выбери доступную вакансию'; end if;
  else
    return 'Для этого бизнеса вакансии пока недоступны';
  end if;

  select count(*) into cnt from public.business_workers
    where business_id = p_biz_id and role = p_role;
  if cnt >= allowed then return 'Места заняты (' || allowed || ')'; end if;
  return null;
end;
$$;
