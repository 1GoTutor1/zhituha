-- Adds collectible mobile numbers sold by minimarkets and plate rolls for owned cars.
-- Apply after BUSINESS_COMMERCE_MIGRATION.sql, BUSINESS_INCOME_TAX_13_MIGRATION.sql,
-- BUSINESS_SALES_HISTORY_MIGRATION.sql, and DEALERSHIP_FLEET_MIGRATION.sql.

alter table public.players add column if not exists car_plate text;

create table if not exists public.player_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  phone_number text not null unique,
  estimated_value bigint not null check (estimated_value > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists player_phone_numbers_player_time_idx
  on public.player_phone_numbers(player_id, created_at desc);
create unique index if not exists player_phone_numbers_one_active_idx
  on public.player_phone_numbers(player_id) where is_active;
alter table public.player_phone_numbers enable row level security;
revoke all on public.player_phone_numbers from public, anon, authenticated;
grant all on public.player_phone_numbers to service_role;

create table if not exists public.player_car_plate_rolls (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  plate text not null,
  estimated_value bigint not null check (estimated_value > 0),
  status text not null default 'pending' check (status in ('pending','kept','sold')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '10 minutes'
);
create unique index if not exists player_car_plate_rolls_pending_plate_idx
  on public.player_car_plate_rolls(plate) where status='pending';
alter table public.player_car_plate_rolls enable row level security;
revoke all on public.player_car_plate_rolls from public, anon, authenticated;
grant all on public.player_car_plate_rolls to service_role;

create or replace function public.phone_number_value(p_number text)
returns bigint language plpgsql immutable set search_path=pg_catalog,public as $$
declare d text; prefix text; tail text; prefix_mult numeric:=1; body_mult numeric:=1;
  pair_count integer:=0; max_repeat integer:=0; digit_count integer; run_len integer:=1; max_run integer:=1;
  i integer; current_digit integer; previous_digit integer; delta integer; direction integer:=0;
  palindrome boolean; counts integer[]:=array_fill(0, array[10]);
begin
  d:=regexp_replace(coalesce(p_number,''),'[^0-9]','','g');
  if length(d)=11 and left(d,1)='7' then d:=substr(d,2); end if;
  if length(d)<>10 or left(d,1)<>'9' then return 1000; end if;
  prefix:=substr(d,1,3); tail:=substr(d,4,7);
  if prefix=repeat(substr(prefix,1,1),3) then prefix_mult:=3;
  elsif prefix=reverse(prefix) then prefix_mult:=2;
  elsif substr(prefix,2,1)=substr(prefix,3,1) or substr(prefix,1,1)=substr(prefix,2,1) then prefix_mult:=1.5;
  end if;
  for i in 1..7 loop
    current_digit:=substr(tail,i,1)::integer;
    counts[current_digit+1]:=counts[current_digit+1]+1;
    if i>1 then
      previous_digit:=substr(tail,i-1,1)::integer;
      if current_digit=previous_digit then run_len:=run_len+1; else run_len:=1; end if;
      max_run:=greatest(max_run,run_len);
    end if;
  end loop;
  max_repeat:=greatest(counts[1],counts[2],counts[3],counts[4],counts[5],counts[6],counts[7],counts[8],counts[9],counts[10]);
  select count(*) into pair_count from unnest(counts) x where x=2;
  if max_repeat=7 then body_mult:=32;
  elsif max_repeat=6 then body_mult:=16;
  elsif max_repeat=5 then body_mult:=8;
  elsif max_repeat=4 then body_mult:=4;
  elsif max_repeat=3 then body_mult:=2.5;
  elsif pair_count>=2 then body_mult:=1.5;
  elsif max_repeat=2 then body_mult:=1.2;
  end if;
  if max_run>=7 then body_mult:=greatest(body_mult,10);
  elsif max_run>=6 then body_mult:=greatest(body_mult,6);
  elsif max_run>=5 then body_mult:=greatest(body_mult,3);
  elsif max_run>=4 then body_mult:=greatest(body_mult,2);
  end if;
  if tail=reverse(tail) then body_mult:=greatest(body_mult,8); end if;
  if substr(tail,1,1)=substr(tail,3,1) and substr(tail,1,1)=substr(tail,5,1)
    and substr(tail,1,1)=substr(tail,7,1) and substr(tail,2,1)=substr(tail,4,1)
    and substr(tail,2,1)=substr(tail,6,1) then body_mult:=greatest(body_mult,7); end if;
  if right(tail,4)='7777' then body_mult:=greatest(body_mult,10);
  elsif right(tail,4) in ('0000','8888','9999') then body_mult:=greatest(body_mult,8);
  elsif right(tail,4) in ('1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321') then body_mult:=greatest(body_mult,5);
  elsif right(tail,4) in ('1212','3434','5656','7878','9090') then body_mult:=greatest(body_mult,4);
  end if;
  return least(100000::numeric, round(1000*prefix_mult*body_mult))::bigint;
end;
$$;

create or replace function public.car_plate_value(p_plate text)
returns bigint language plpgsql immutable set search_path=pg_catalog,public as $$
declare compact text; letters text; digits text; region text; digit_mult numeric:=1; letter_mult numeric:=1; region_mult numeric:=1;
begin
  compact:=regexp_replace(upper(coalesce(p_plate,'')),'[^А-Я0-9]','','g');
  if length(compact)<7 then return 1000; end if;
  letters:=substr(compact,1,1)||substr(compact,5,2);
  digits:=substr(compact,2,3); region:=substr(compact,7);
  if digits='777' then digit_mult:=12;
  elsif digits='001' then digit_mult:=8;
  elsif digits='888' then digit_mult:=8;
  elsif digits='999' then digit_mult:=7;
  elsif digits='555' then digit_mult:=6;
  elsif digits='007' then digit_mult:=5;
  elsif digits=repeat(substr(digits,1,1),3) then digit_mult:=4;
  elsif digits in ('100','200','300','400','500','600','700','800','900') then digit_mult:=2.5;
  elsif substr(digits,1,1)=substr(digits,2,1) or substr(digits,2,1)=substr(digits,3,1) then digit_mult:=1.5;
  elsif digits in ('123','321') then digit_mult:=2;
  end if;
  if letters=repeat(substr(letters,1,1),3) then letter_mult:=8;
  elsif substr(letters,1,1)=substr(letters,2,1) or substr(letters,2,1)=substr(letters,3,1) or substr(letters,1,1)=substr(letters,3,1) then letter_mult:=2;
  end if;
  if substr(letters,1,1) in ('А','М','О') then letter_mult:=letter_mult*1.2; end if;
  if region in ('77','99','777') then region_mult:=2; end if;
  return least(100000::numeric,round(1000*digit_mult*letter_mult*region_mult))::bigint;
end;
$$;

create or replace function public.generate_phone_number()
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare d text; candidate text; i integer; j integer;
begin
  for i in 1..100 loop
    d:='9'||floor(random()*10)::integer::text||floor(random()*10)::integer::text;
    for j in 1..7 loop d:=d||floor(random()*10)::integer::text; end loop;
    candidate:='+7 '||substr(d,1,3)||' '||substr(d,4,3)||'-'||substr(d,7,2)||'-'||substr(d,9,2);
    if not exists(select 1 from public.player_phone_numbers where phone_number=candidate) then return candidate; end if;
  end loop;
  raise exception 'Unable to allocate a unique phone number';
end;
$$;

create or replace function public.generate_car_plate()
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х']; regions text[]:=array['01','02','16','50','77','97','99','777'];
  candidate text; letters text; digits text; region text; i integer;
begin
  for i in 1..100 loop
    letters:=alphabet[1+floor(random()*array_length(alphabet,1))::integer]||alphabet[1+floor(random()*array_length(alphabet,1))::integer]||alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    digits:=lpad(floor(random()*1000)::integer::text,3,'0');
    region:=regions[1+floor(random()*array_length(regions,1))::integer];
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    if not exists(select 1 from public.players where car_plate=candidate)
      and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
      and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Unable to allocate a unique car plate';
end;
$$;

create or replace function public.ensure_personal_car_plate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if coalesce(new.has_car,false) then
    if tg_op='INSERT' or not coalesce(old.has_car,false) or new.car_model is distinct from old.car_model or nullif(new.car_plate,'') is null then
      new.car_plate:=public.generate_car_plate();
    end if;
  else
    new.car_plate:=null;
  end if;
  return new;
end;
$$;
drop trigger if exists players_ensure_car_plate on public.players;
create trigger players_ensure_car_plate_insert before insert on public.players
for each row execute function public.ensure_personal_car_plate();
create trigger players_ensure_car_plate_update before update of has_car,car_model on public.players
for each row execute function public.ensure_personal_car_plate();
update public.players set car_plate=public.generate_car_plate() where coalesce(has_car,false) and nullif(car_plate,'') is null;

create or replace function public.ensure_taxi_car_plates()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare cars jsonb; car jsonb; out_cars jsonb:='[]'::jsonb;
begin
  if new.biz_type<>'taxi' or jsonb_typeof(new.stock->'taxi_cars')<>'array' then return new; end if;
  cars:=new.stock->'taxi_cars';
  for car in select value from jsonb_array_elements(cars) loop
    if nullif(car->>'plate','') is null then car:=jsonb_set(car,'{plate}',to_jsonb(public.generate_car_plate()),true); end if;
    out_cars:=out_cars||jsonb_build_array(car);
  end loop;
  new.stock:=jsonb_set(new.stock,'{taxi_cars}',out_cars,true);
  return new;
end;
$$;
drop trigger if exists businesses_ensure_taxi_car_plates on public.businesses;
drop trigger if exists businesses_ensure_taxi_car_plates_insert on public.businesses;
drop trigger if exists businesses_ensure_taxi_car_plates_update on public.businesses;
create trigger businesses_ensure_taxi_car_plates_insert before insert on public.businesses
for each row execute function public.ensure_taxi_car_plates();
create trigger businesses_ensure_taxi_car_plates_update before update of stock on public.businesses
for each row execute function public.ensure_taxi_car_plates();
update public.businesses set stock=stock where biz_type='taxi' and jsonb_typeof(stock->'taxi_cars')='array';

create or replace function public.phone_numbers_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  return jsonb_build_object(
    'numbers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',phone_number,'estimated_value',estimated_value,'is_active',is_active,'created_at',created_at) order by is_active desc,created_at desc)
      from public.player_phone_numbers where player_id=p_player_id),'[]'::jsonb),
    'car_plate',(select car_plate from public.players where id=p_player_id and has_car)
  );
end;
$$;

create or replace function public.spin_phone_number_rpc(p_player_id uuid,p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.businesses; cashier public.business_workers; p public.players; phone text; value bigint; cost bigint:=2500; commission bigint; number_id uuid;
begin
  select * into b from public.businesses where id=p_business_id and biz_type='minimarket' for update;
  if not found then return jsonb_build_object('error','Услуга доступна в минимаркете'); end if;
  if b.owner_id=p_player_id then return jsonb_build_object('error','Нельзя покупать услугу в своём магазине'); end if;
  select * into cashier from public.business_workers where business_id=b.id and role='Кассир' order by created_at limit 1 for update;
  if not found then return jsonb_build_object('error','Магазин закрыт: нужен кассир'); end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if coalesce(p.money,0)<cost then return jsonb_build_object('error','Не хватает денег на крутку номера'); end if;
  phone:=public.generate_phone_number(); value:=public.phone_number_value(phone); commission:=floor(cost*0.05);
  update public.players set money=coalesce(money,0)-cost where id=p_player_id;
  insert into public.player_phone_numbers(player_id,phone_number,estimated_value) values(p_player_id,phone,value) returning id into number_id;
  update public.players set money=coalesce(money,0)+commission where id=cashier.player_id;
  update public.businesses set cash_balance=coalesce(cash_balance,0)+cost-commission where id=b.id;
  return jsonb_build_object('success',true,'number_id',number_id,'number',phone,'estimated_value',value,'cost',cost,'commission',commission,
    'money',p.money-cost+case when cashier.player_id=p_player_id then commission else 0 end,'business_name',b.business_name);
end;
$$;

create or replace function public.sell_phone_number_to_state_rpc(p_player_id uuid,p_number_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n public.player_phone_numbers; next_money bigint;
begin
  select * into n from public.player_phone_numbers where id=p_number_id and player_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Номер не найден в коллекции'); end if;
  update public.players set money=coalesce(money,0)+n.estimated_value where id=p_player_id returning money into next_money;
  delete from public.player_phone_numbers where id=n.id;
  return jsonb_build_object('success',true,'money',next_money,'price',n.estimated_value,'number',n.phone_number);
end;
$$;

create or replace function public.activate_phone_number_rpc(p_player_id uuid,p_number_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if not exists(select 1 from public.players where id=p_player_id and coalesce(phone_count,0)>0 for update) then return jsonb_build_object('error','Сначала получи телефон'); end if;
  if not exists(select 1 from public.player_phone_numbers where id=p_number_id and player_id=p_player_id) then return jsonb_build_object('error','Номер не найден в коллекции'); end if;
  update public.player_phone_numbers set is_active=(id=p_number_id) where player_id=p_player_id;
  return jsonb_build_object('success',true,'number_id',p_number_id);
end;
$$;

create or replace function public.spin_car_plate_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; candidate text; value bigint; cost bigint:=3000; roll_id uuid;
begin
  select * into p from public.players where id=p_player_id for update;
  if not found or not coalesce(p.has_car,false) then return jsonb_build_object('error','Номер можно крутить только при наличии личной машины'); end if;
  if coalesce(p.money,0)<cost then return jsonb_build_object('error','Не хватает денег на переброс номера'); end if;
  candidate:=public.generate_car_plate(); value:=public.car_plate_value(candidate);
  update public.players set money=coalesce(money,0)-cost where id=p_player_id;
  insert into public.player_car_plate_rolls(player_id,plate,estimated_value) values(p_player_id,candidate,value) returning id into roll_id;
  return jsonb_build_object('success',true,'roll_id',roll_id,'plate',candidate,'estimated_value',value,'cost',cost,'money',p.money-cost,'current_plate',p.car_plate);
end;
$$;

create or replace function public.resolve_car_plate_spin_rpc(p_player_id uuid,p_roll_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.player_car_plate_rolls; p public.players; next_money bigint; old_plate text;
begin
  if p_action not in ('keep','sell') then return jsonb_build_object('error','Неизвестное действие'); end if;
  select * into p from public.players where id=p_player_id and has_car for update;
  if not found then return jsonb_build_object('error','У тебя нет личной машины'); end if;
  select * into r from public.player_car_plate_rolls where id=p_roll_id and player_id=p_player_id and status='pending' and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('error','Время на выбор номера истекло; крути новый'); end if;
  if p_action='keep' then
    old_plate:=p.car_plate;
    update public.players set car_plate=r.plate where id=p_player_id;
    update public.player_car_plate_rolls set status='kept' where id=r.id;
    return jsonb_build_object('success',true,'action','keep','plate',r.plate,'old_plate',old_plate);
  end if;
  update public.players set money=coalesce(money,0)+r.estimated_value where id=p_player_id returning money into next_money;
  update public.player_car_plate_rolls set status='sold' where id=r.id;
  return jsonb_build_object('success',true,'action','sell','plate',r.plate,'price',r.estimated_value,'money',next_money);
end;
$$;

revoke all on function public.phone_number_value(text),public.car_plate_value(text),public.generate_phone_number(),public.generate_car_plate(),
  public.ensure_personal_car_plate(),public.ensure_taxi_car_plates(),public.phone_numbers_state_rpc(uuid),
  public.spin_phone_number_rpc(uuid,uuid),public.sell_phone_number_to_state_rpc(uuid,uuid),
  public.activate_phone_number_rpc(uuid,uuid),public.spin_car_plate_rpc(uuid),public.resolve_car_plate_spin_rpc(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.phone_numbers_state_rpc(uuid),public.spin_phone_number_rpc(uuid,uuid),
  public.sell_phone_number_to_state_rpc(uuid,uuid),public.activate_phone_number_rpc(uuid,uuid),
  public.spin_car_plate_rpc(uuid),public.resolve_car_plate_spin_rpc(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
