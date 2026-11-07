-- Expand taxi hiring to five drivers so parks can staff their larger fleets.
do $$
declare
  routine text;
  original text;
begin
  select pg_get_functiondef('public.validate_worker_role(uuid,uuid,text,integer)'::regprocedure)
    into routine;
  original := routine;
  routine := replace(routine,
    'if p_role = ''Водитель'' and p_salary = 10 then allowed := 2;',
    'if p_role = ''Водитель'' and p_salary = 10 then allowed := 5;');
  if routine = original then
    raise exception 'Could not update the taxi driver vacancy limit';
  end if;
  execute routine;
end;
$$;
