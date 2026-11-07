-- Fix the legacy taxi reward routine without replacing its current business logic.
-- A PL/pgSQL variable named `c` shadowed the JSON row alias `c` in one query.
do $$
declare
  routine text;
  original text;
begin
  select pg_get_functiondef('public.finish_profession_cycle_rpc_legacy(uuid)'::regprocedure)
    into routine;
  original := routine;
  routine := replace(routine, 'as c(car,position)', 'as taxi_car_row(car,position)');
  routine := replace(routine, 'c.car', 'taxi_car_row.car');
  routine := replace(routine, 'c.position', 'taxi_car_row.position');
  if routine = original or position('taxi_car_row.car' in routine) = 0 then
    raise exception 'Could not patch the taxi car alias in finish_profession_cycle_rpc_legacy';
  end if;
  execute routine;
end;
$$;

-- Allow one taxi car per hired driver instead of imposing a separate two-car cap.
do $$
declare
  routine text;
  original text;
begin
  select pg_get_functiondef('public.taxi_purchase_vehicle_rpc(uuid,uuid,uuid,text)'::regprocedure)
    into routine;
  original := routine;
  routine := replace(routine, 'jsonb_array_length(cars)>=2', 'jsonb_array_length(cars)>=count_drivers');
  routine := replace(routine,
    '  if jsonb_array_length(cars)>=count_drivers then',
    '  select count(*)::integer into count_drivers from public.business_workers where business_id=taxi.id and role=''Водитель'';' || chr(10) ||
    '  if jsonb_array_length(cars)>=count_drivers then');
  if routine = original or position('into count_drivers' in routine) = 0 then
    raise exception 'Could not patch taxi fleet capacity';
  end if;
  execute routine;
end;
$$;
