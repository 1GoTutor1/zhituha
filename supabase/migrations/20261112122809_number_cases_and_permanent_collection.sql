-- Number cases use virtual rubles and server-side odds only.
create table if not exists public.player_number_case_state (
  player_id uuid primary key references public.players(id) on delete cascade,
  daily_opened_on date,
  friend_keys integer not null default 0 check (friend_keys >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.player_number_case_state enable row level security;
revoke all on public.player_number_case_state from public, anon, authenticated;
grant all on public.player_number_case_state to service_role;

-- An activated referral is the existing anti-fraud milestone, not a raw invite link.
create or replace function public.number_case_award_friend_key()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare referrer_id uuid;
begin
  if old.referral_signup_rewarded_at is null and new.referral_signup_rewarded_at is not null
     and new.referred_by is not null and new.referred_by <> new.telegram_id then
    select id into referrer_id from public.players where telegram_id=new.referred_by;
    if referrer_id is not null then
      insert into public.player_number_case_state as case_state(player_id,friend_keys)
      values(referrer_id,1)
      on conflict(player_id) do update
        set friend_keys=case_state.friend_keys+1,
            updated_at=clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists players_number_case_friend_key on public.players;
create trigger players_number_case_friend_key
after update of referral_signup_rewarded_at on public.players
for each row execute function public.number_case_award_friend_key();

create table if not exists public.player_forever_car_numbers (
  plate text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  estimated_value bigint not null check (estimated_value >= 30000),
  earned_at timestamptz not null default clock_timestamp()
);
create index if not exists player_forever_car_numbers_player_idx
  on public.player_forever_car_numbers(player_id, estimated_value desc);
alter table public.player_forever_car_numbers enable row level security;
revoke all on public.player_forever_car_numbers from public, anon, authenticated;
grant all on public.player_forever_car_numbers to service_role;

create or replace function public.number_case_archive_plate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if new.estimated_value >= 30000 then
    insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
    values(new.plate,new.player_id,new.estimated_value)
    on conflict(plate) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists player_car_numbers_archive_forever on public.player_car_numbers;
create trigger player_car_numbers_archive_forever
after insert on public.player_car_numbers
for each row execute function public.number_case_archive_plate();

create or replace function public.number_case_archive_current_plate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare plate_value bigint;
begin
  if new.car_plate is not null and new.car_plate is distinct from old.car_plate then
    plate_value:=public.car_plate_value(new.car_plate);
    if plate_value >= 30000 then
      insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
      values(new.car_plate,new.id,plate_value)
      on conflict(plate) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists players_archive_forever_current_plate on public.players;
create trigger players_archive_forever_current_plate
after update of car_plate on public.players
for each row execute function public.number_case_archive_current_plate();

insert into public.player_forever_car_numbers(plate,player_id,estimated_value,earned_at)
select plate,player_id,estimated_value,created_at from public.player_car_numbers where estimated_value>=30000
on conflict(plate) do nothing;
insert into public.player_forever_car_numbers(plate,player_id,estimated_value)
select p.car_plate,p.id,public.car_plate_value(p.car_plate)
from public.players p where p.car_plate is not null and public.car_plate_value(p.car_plate)>=30000
on conflict(plate) do nothing;

create or replace function public.phone_numbers_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  return jsonb_build_object(
    'numbers',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'number',n.phone_number,'estimated_value',n.estimated_value,'is_active',n.is_active,'created_at',n.created_at) order by n.is_active desc,n.created_at desc)
      from public.player_phone_numbers n where n.player_id=p_player_id),'[]'::jsonb),
    'car_numbers',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'plate',n.plate,'estimated_value',n.estimated_value,'is_active',(p.car_plate=n.plate),'created_at',n.created_at) order by (p.car_plate=n.plate) desc,n.created_at desc)
      from public.player_car_numbers n cross join public.players p where n.player_id=p_player_id and p.id=p_player_id),'[]'::jsonb),
    'forever_car_numbers',coalesce((select jsonb_agg(jsonb_build_object('plate',n.plate,'estimated_value',n.estimated_value,'earned_at',n.earned_at) order by n.estimated_value desc,n.earned_at)
      from public.player_forever_car_numbers n where n.player_id=p_player_id),'[]'::jsonb),
    'pending_car_plate',(select jsonb_build_object('roll_id',r.id,'plate',r.plate,'estimated_value',r.estimated_value,'created_at',r.created_at,'expires_at',r.expires_at)
      from public.player_car_plate_rolls r where r.player_id=p_player_id and r.status='pending' and r.expires_at>clock_timestamp() order by r.created_at desc limit 1),
    'car_plate',(select car_plate from public.players where id=p_player_id and has_car)
  );
end;
$$;

create or replace view public.forever_number_leaderboard as
select n.player_id,p.nickname,count(*)::integer as number_count,
       sum(n.estimated_value)::bigint as collection_value,
       max(n.estimated_value)::bigint as best_number_value
from public.player_forever_car_numbers n
join public.players p on p.id=n.player_id
where coalesce(p.is_banned,false)=false
group by n.player_id,p.nickname;
revoke all on public.forever_number_leaderboard from public,anon,authenticated;
grant select on public.forever_number_leaderboard to service_role;

create or replace function public.number_cases_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.players; s public.player_number_case_state; today date:=timezone('Europe/Moscow',clock_timestamp())::date;
begin
  select * into p from public.players where id=p_player_id;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  insert into public.player_number_case_state(player_id) values(p_player_id) on conflict(player_id) do nothing;
  select * into s from public.player_number_case_state where player_id=p_player_id;
  return jsonb_build_object('daily_ready',s.daily_opened_on is distinct from today,
    'friend_keys',s.friend_keys,'money',coalesce(p.money,0),'premium_balance',coalesce(p.premium_balance,0));
end;
$$;

create or replace function public.generate_number_case_plate(p_tier text)
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
  regions text[]:=array['01','02','16','50','77','97','99','777'];
  first_letter text; other_letter text; letters text; digits text; region text; candidate text;
  plate_value bigint; i integer;
begin
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..200 loop
    first_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    if p_tier='common' then
      letters:=alphabet[1+floor(random()*12)::integer]||alphabet[1+floor(random()*12)::integer]||alphabet[1+floor(random()*12)::integer];
      digits:='101'; region:='01';
    elsif p_tier='rare' then
      other_letter:=alphabet[1+floor(random()*12)::integer];
      letters:=first_letter||first_letter||other_letter;
      digits:=case when random()<0.5 then '100' else '200' end; region:='01';
    elsif p_tier='epic' then
      letters:=first_letter||first_letter||first_letter; digits:='110'; region:='01';
    elsif p_tier='legendary' then
      letters:=first_letter||first_letter||first_letter; digits:='100'; region:='77';
    elsif p_tier='mythic' then
      letters:=first_letter||first_letter||first_letter; digits:='777'; region:='77';
    else
      raise exception 'Unknown plate rarity';
    end if;
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    plate_value:=public.car_plate_value(candidate);
    if (p_tier='common' and plate_value<3000)
      or (p_tier='rare' and plate_value>=3000 and plate_value<10000)
      or (p_tier='epic' and plate_value>=10000 and plate_value<30000)
      or (p_tier='legendary' and plate_value>=30000 and plate_value<60000)
      or (p_tier='mythic' and plate_value>=60000) then
      if not exists(select 1 from public.players where car_plate=candidate)
        and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
        and not exists(select 1 from public.player_car_numbers where plate=candidate)
        and not exists(select 1 from public.player_forever_car_numbers where plate=candidate)
        and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
        return candidate;
      end if;
    end if;
  end loop;
  raise exception 'Unable to allocate unique plate for case';
end;
$$;

create or replace function public.open_number_case_rpc(p_player_id uuid,p_case_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  p public.players;
  s public.player_number_case_state;
  today date:=timezone('Europe/Moscow',clock_timestamp())::date;
  price bigint:=case p_case_id when 'taxi' then 5000 when 'capital' then 15000 when 'blatnoy' then 40000 when 'mythic' then 100000 else 0 end;
  roll numeric;
  tier text;
  plate text;
  plate_value bigint;
  plate_id uuid;
  token_reward boolean:=false;
  attempts integer;
begin
  if p_case_id is null or p_case_id not in ('daily','friend','taxi','capital','blatnoy','mythic') then
    return jsonb_build_object('error','Неизвестный кейс');
  end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  insert into public.player_number_case_state(player_id) values(p_player_id) on conflict(player_id) do nothing;
  select * into s from public.player_number_case_state where player_id=p_player_id for update;

  if p_case_id='daily' then
    if s.daily_opened_on=today then return jsonb_build_object('error','Ежедневный кейс уже открыт сегодня'); end if;
    update public.player_number_case_state set daily_opened_on=today,updated_at=clock_timestamp() where player_id=p_player_id;
    roll:=random()*100;
    if roll<10 then token_reward:=true;
    else
      roll:=(roll-10)/0.90;
      if roll<55 then tier:='common'; elsif roll<94.85 then tier:='rare'; elsif roll<99.6 then tier:='epic'; elsif roll<99.9 then tier:='legendary'; else tier:='mythic'; end if;
    end if;
  elsif p_case_id='friend' then
    if s.friend_keys<1 then return jsonb_build_object('error','Пока нет ключа за друга'); end if;
    update public.player_number_case_state set friend_keys=friend_keys-1,updated_at=clock_timestamp() where player_id=p_player_id;
    roll:=random()*100;
    if roll<45 then tier:='common'; elsif roll<92 then tier:='rare'; elsif roll<99 then tier:='epic'; elsif roll<99.8 then tier:='legendary'; else tier:='mythic'; end if;
  else
    if coalesce(p.money,0)<price then return jsonb_build_object('error','Не хватает игровых рублей'); end if;
    update public.players set money=coalesce(money,0)-price where id=p_player_id returning * into p;
    roll:=random()*100;
    if p_case_id='taxi' then
      -- A normal spin samples about 43.57% rare+ plates; Taxi gives 45%.
      if roll<55 then tier:='common'; elsif roll<94.85 then tier:='rare'; elsif roll<99.6 then tier:='epic'; elsif roll<99.9 then tier:='legendary'; else tier:='mythic'; end if;
    elsif p_case_id='capital' then
      if roll<45 then tier:='common'; elsif roll<92 then tier:='rare'; elsif roll<99 then tier:='epic'; elsif roll<99.8 then tier:='legendary'; else tier:='mythic'; end if;
    elsif p_case_id='blatnoy' then
      if roll<20 then tier:='common'; elsif roll<75 then tier:='rare'; elsif roll<97 then tier:='epic'; elsif roll<99.5 then tier:='legendary'; else tier:='mythic'; end if;
    else
      if roll<5 then tier:='common'; elsif roll<45 then tier:='rare'; elsif roll<90 then tier:='epic'; elsif roll<98 then tier:='legendary'; else tier:='mythic'; end if;
    end if;
  end if;

  if token_reward then
    update public.players set premium_balance=coalesce(premium_balance,0)+1 where id=p_player_id returning * into p;
    return jsonb_build_object('success',true,'reward_type','token','token_reward',1,'money',coalesce(p.money,0),
      'premium_balance',coalesce(p.premium_balance,0),'friend_keys',(select friend_keys from public.player_number_case_state where player_id=p_player_id));
  end if;

  for attempts in 1..200 loop
    plate:=public.generate_number_case_plate(tier);
    plate_value:=public.car_plate_value(plate);
    insert into public.player_car_numbers(player_id,plate,estimated_value)
    values(p_player_id,plate,plate_value) on conflict(plate) do nothing returning id into plate_id;
    if plate_id is not null then exit; end if;
  end loop;
  if plate_id is null then raise exception 'Unable to allocate unique plate for case'; end if;
  return jsonb_build_object('success',true,'reward_type','plate','number_id',plate_id,'plate',plate,'estimated_value',plate_value,
    'rarity',tier,'money',coalesce(p.money,0),'premium_balance',coalesce(p.premium_balance,0),
    'friend_keys',(select friend_keys from public.player_number_case_state where player_id=p_player_id));
end;
$$;

revoke all on function public.number_case_award_friend_key(),public.number_case_archive_plate(),
  public.number_case_archive_current_plate(),public.generate_number_case_plate(text),
  public.number_cases_state_rpc(uuid),public.open_number_case_rpc(uuid,text),public.phone_numbers_state_rpc(uuid)
  from public,anon,authenticated;
grant execute on function public.number_cases_state_rpc(uuid),public.open_number_case_rpc(uuid,text),public.phone_numbers_state_rpc(uuid) to service_role;
notify pgrst,'reload schema';
