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
  attempt_reward boolean:=false;
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
    if s.daily_opened_on=today then return jsonb_build_object('error','Ежедневная попытка уже использована'); end if;
    update public.player_number_case_state set daily_opened_on=today,updated_at=clock_timestamp() where player_id=p_player_id;
    roll:=random()*100;
    if roll<10 then token_reward:=true;
    elsif roll<20 then
      attempt_reward:=true;
      update public.player_number_case_state set daily_opened_on=null,updated_at=clock_timestamp() where player_id=p_player_id;
    else
      roll:=(roll-20)/0.80;
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
      if roll<55 then tier:='common'; elsif roll<94.85 then tier:='rare'; elsif roll<99.6 then tier:='epic'; elsif roll<99.9 then tier:='legendary'; else tier:='mythic'; end if;
    elsif p_case_id='capital' then
      if roll<45 then tier:='common'; elsif roll<92 then tier:='rare'; elsif roll<99 then tier:='epic'; elsif roll<99.8 then tier:='legendary'; else tier:='mythic'; end if;
    elsif p_case_id='blatnoy' then
      if roll<20 then tier:='common'; elsif roll<75 then tier:='rare'; elsif roll<97 then tier:='epic'; elsif roll<99.5 then tier:='legendary'; else tier:='mythic'; end if;
    else
      if roll<5 then tier:='common'; elsif roll<45 then tier:='rare'; elsif roll<90 then tier:='epic'; elsif roll<98 then tier:='legendary'; else tier:='mythic'; end if;
    end if;
  end if;

  if attempt_reward then
    return jsonb_build_object('success',true,'reward_type','attempt','daily_ready',true,'money',coalesce(p.money,0),
      'premium_balance',coalesce(p.premium_balance,0),'friend_keys',(select friend_keys from public.player_number_case_state where player_id=p_player_id));
  end if;
  if token_reward then
    update public.players set premium_balance=coalesce(premium_balance,0)+1 where id=p_player_id returning * into p;
    return jsonb_build_object('success',true,'reward_type','token','token_reward',1,'daily_ready',false,'money',coalesce(p.money,0),
      'premium_balance',coalesce(p.premium_balance,0),'friend_keys',(select friend_keys from public.player_number_case_state where player_id=p_player_id));
  end if;

  for attempts in 1..200 loop
    plate:=public.generate_number_case_plate(tier);
    plate_value:=public.car_plate_value(plate);
    insert into public.player_car_numbers(player_id,plate,estimated_value)
    values(p_player_id,plate,plate_value) on conflict on constraint player_car_numbers_plate_key do nothing returning id into plate_id;
    if plate_id is not null then exit; end if;
  end loop;
  if plate_id is null then raise exception 'Unable to allocate unique plate for case'; end if;
  return jsonb_build_object('success',true,'reward_type','plate','number_id',plate_id,'plate',plate,'estimated_value',plate_value,
    'rarity',tier,'daily_ready',case when p_case_id='daily' then false else s.daily_opened_on is distinct from today end,
    'money',coalesce(p.money,0),'premium_balance',coalesce(p.premium_balance,0),
    'friend_keys',(select friend_keys from public.player_number_case_state where player_id=p_player_id));
end;
$$;

notify pgrst, 'reload schema';
