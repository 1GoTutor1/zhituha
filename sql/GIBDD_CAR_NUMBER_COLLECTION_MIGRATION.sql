-- Collectible vehicle plates and a state-office spin that does not require a car.
-- Requires PHONE_AND_CAR_NUMBERS_MIGRATION.sql.

create table if not exists public.player_car_numbers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  plate text not null unique,
  estimated_value bigint not null check (estimated_value > 0),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists player_car_numbers_player_time_idx
  on public.player_car_numbers(player_id, created_at desc);
alter table public.player_car_numbers enable row level security;
revoke all on public.player_car_numbers from public, anon, authenticated;
grant all on public.player_car_numbers to service_role;

create or replace function public.generate_car_plate()
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х']; regions text[]:=array['01','02','16','50','77','97','99','777'];
  candidate text; letters text; digits text; region text; i integer;
begin
  -- Keep plate allocation unique when two players roll at the same time.
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..100 loop
    letters:=alphabet[1+floor(random()*array_length(alphabet,1))::integer]||alphabet[1+floor(random()*array_length(alphabet,1))::integer]||alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    digits:=lpad(floor(random()*1000)::integer::text,3,'0');
    region:=regions[1+floor(random()*array_length(regions,1))::integer];
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    if not exists(select 1 from public.players where car_plate=candidate)
      and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
      and not exists(select 1 from public.player_car_numbers where plate=candidate)
      and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Unable to allocate a unique car plate';
end;
$$;

create or replace function public.archive_previous_car_plate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if coalesce(old.has_car,false) and nullif(old.car_plate,'') is not null
     and old.car_plate is distinct from new.car_plate then
    insert into public.player_car_numbers(player_id,plate,estimated_value)
    values(old.id,old.car_plate,public.car_plate_value(old.car_plate))
    on conflict (plate) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists players_archive_previous_car_plate on public.players;
create trigger players_archive_previous_car_plate after update of has_car,car_model,car_plate on public.players
for each row execute function public.archive_previous_car_plate();

create or replace function public.phone_numbers_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  return jsonb_build_object(
    'numbers',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'number',n.phone_number,'estimated_value',n.estimated_value,'is_active',n.is_active,'created_at',n.created_at) order by n.is_active desc,n.created_at desc)
      from public.player_phone_numbers n where n.player_id=p_player_id),'[]'::jsonb),
    'car_numbers',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'plate',n.plate,'estimated_value',n.estimated_value,'is_active',(p.car_plate=n.plate),'created_at',n.created_at) order by (p.car_plate=n.plate) desc,n.created_at desc)
      from public.player_car_numbers n cross join public.players p where n.player_id=p_player_id and p.id=p_player_id),'[]'::jsonb),
    'pending_car_plate',(select jsonb_build_object('roll_id',r.id,'plate',r.plate,'estimated_value',r.estimated_value,'created_at',r.created_at,'expires_at',r.expires_at)
      from public.player_car_plate_rolls r where r.player_id=p_player_id and r.status='pending' and r.expires_at>clock_timestamp() order by r.created_at desc limit 1),
    'car_plate',(select car_plate from public.players where id=p_player_id and has_car)
  );
end;
$$;

create or replace function public.spin_car_plate_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; candidate text; value bigint; cost bigint:=3000; roll_id uuid;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if p.current_district<>'center' then return jsonb_build_object('error','ГИБДД доступно только в центральном районе'); end if;
  if exists(select 1 from public.player_car_plate_rolls where player_id=p_player_id and status='pending' and expires_at>clock_timestamp()) then
    return jsonb_build_object('error','Сначала выбери: сохранить номер, поставить на машину или продать');
  end if;
  delete from public.player_car_plate_rolls where player_id=p_player_id and status='pending' and expires_at<=clock_timestamp();
  if coalesce(p.money,0)<cost then return jsonb_build_object('error','Не хватает денег на крутку номера'); end if;
  candidate:=public.generate_car_plate(); value:=public.car_plate_value(candidate);
  update public.players set money=coalesce(money,0)-cost where id=p_player_id;
  insert into public.player_car_plate_rolls(player_id,plate,estimated_value) values(p_player_id,candidate,value) returning id into roll_id;
  return jsonb_build_object('success',true,'roll_id',roll_id,'plate',candidate,'estimated_value',value,'cost',cost,'money',p.money-cost,'current_plate',p.car_plate);
end;
$$;

create or replace function public.resolve_car_plate_spin_rpc(p_player_id uuid,p_roll_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.player_car_plate_rolls; p public.players; next_money bigint;
begin
  if p_action not in ('keep','activate','sell') then return jsonb_build_object('error','Неизвестное действие'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into r from public.player_car_plate_rolls where id=p_roll_id and player_id=p_player_id and status='pending' and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('error','Время на выбор номера истекло; крути новый'); end if;
  if p_action='activate' and not coalesce(p.has_car,false) then
    return jsonb_build_object('error','Чтобы поставить номер на машину, сначала купи автомобиль. Его можно сохранить в коллекцию.');
  end if;
  if p_action='sell' then
    update public.players set money=coalesce(money,0)+r.estimated_value where id=p_player_id returning money into next_money;
    update public.player_car_plate_rolls set status='sold' where id=r.id;
    return jsonb_build_object('success',true,'action','sell','plate',r.plate,'price',r.estimated_value,'money',next_money);
  end if;
  insert into public.player_car_numbers(player_id,plate,estimated_value)
  values(p_player_id,r.plate,r.estimated_value);
  update public.player_car_plate_rolls set status='kept' where id=r.id;
  if p_action='activate' then
    update public.players set car_plate=r.plate where id=p_player_id;
  end if;
  return jsonb_build_object('success',true,'action',p_action,'plate',r.plate,'current_plate',case when p_action='activate' then r.plate else p.car_plate end);
end;
$$;

create or replace function public.activate_car_number_rpc(p_player_id uuid,p_number_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; n public.player_car_numbers;
begin
  select * into p from public.players where id=p_player_id and has_car for update;
  if not found then return jsonb_build_object('error','Чтобы поставить номер, нужна личная машина'); end if;
  select * into n from public.player_car_numbers where id=p_number_id and player_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Номер не найден в коллекции'); end if;
  update public.players set car_plate=n.plate where id=p_player_id;
  return jsonb_build_object('success',true,'plate',n.plate);
end;
$$;

create or replace function public.sell_car_number_to_state_rpc(p_player_id uuid,p_number_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n public.player_car_numbers; current_plate text; next_money bigint;
begin
  select car_plate into current_plate from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  select * into n from public.player_car_numbers where id=p_number_id and player_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Номер не найден в коллекции'); end if;
  if current_plate=n.plate then return jsonb_build_object('error','Сначала поставь на машину другой номер'); end if;
  update public.players set money=coalesce(money,0)+n.estimated_value where id=p_player_id returning money into next_money;
  delete from public.player_car_numbers where id=n.id;
  return jsonb_build_object('success',true,'money',next_money,'price',n.estimated_value,'plate',n.plate);
end;
$$;

revoke all on function public.archive_previous_car_plate(),public.phone_numbers_state_rpc(uuid),public.spin_car_plate_rpc(uuid),
  public.resolve_car_plate_spin_rpc(uuid,uuid,text),public.activate_car_number_rpc(uuid,uuid),public.sell_car_number_to_state_rpc(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.phone_numbers_state_rpc(uuid),public.spin_car_plate_rpc(uuid),
  public.resolve_car_plate_spin_rpc(uuid,uuid,text),public.activate_car_number_rpc(uuid,uuid),public.sell_car_number_to_state_rpc(uuid,uuid)
  to service_role;
notify pgrst,'reload schema';
