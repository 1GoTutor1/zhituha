-- Player owned casino: 5%, 7%, 10% share of accepted bets at levels 1-3.
create table if not exists public.casino_business_upgrades (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 3),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.casino_business_upgrades enable row level security;
revoke all on public.casino_business_upgrades from public,anon,authenticated;
grant all on public.casino_business_upgrades to service_role;

create or replace function public.casino_business_state_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.businesses; current_level integer;
begin
  select * into b from public.businesses where owner_id=p_player_id
    and biz_type='casino' and location_key='casino_01';
  if not found then return jsonb_build_object('owned',false); end if;
  select level into current_level from public.casino_business_upgrades where business_id=b.id;
  current_level:=coalesce(current_level,1);
  return jsonb_build_object('success',true,'level',current_level,
    'share_percent',case current_level when 1 then 5 when 2 then 7 else 10 end,
    'next_cost',case current_level when 1 then 20000000 when 2 then 35000000 else null end,
    'cash_balance',coalesce(b.cash_balance,0));
end $$;

create or replace function public.casino_business_upgrade_rpc(p_player_id uuid,p_business_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.businesses; current_level integer; next_level integer; cost bigint; pct integer; new_cash bigint;
begin
  select * into b from public.businesses where id=p_business_id and owner_id=p_player_id
    and biz_type='casino' and location_key='casino_01' for update;
  if not found then return jsonb_build_object('error','Своё казино не найдено'); end if;
  insert into public.casino_business_upgrades(business_id,level) values(b.id,1) on conflict do nothing;
  select level into current_level from public.casino_business_upgrades where business_id=b.id for update;
  if current_level>=3 then return jsonb_build_object('error','Казино уже улучшено до максимального уровня'); end if;
  next_level:=current_level+1;
  cost:=case next_level when 2 then 20000000 else 35000000 end;
  if coalesce(b.cash_balance,0)<cost then return jsonb_build_object('error','В кассе казино недостаточно денег для улучшения'); end if;
  update public.businesses set cash_balance=coalesce(cash_balance,0)-cost where id=b.id returning cash_balance into new_cash;
  update public.casino_business_upgrades set level=next_level,updated_at=clock_timestamp() where business_id=b.id;
  pct:=case next_level when 2 then 7 else 10 end;
  return jsonb_build_object('success',true,'level',next_level,'share_percent',pct,
    'cost',cost,'cash_balance',new_cash);
end $$;

create or replace function public.place_bet_rpc(p_player_id uuid,p_game_type text,p_bet_choice text,p_amount int)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  r public.casino_rounds;
  p public.players;
  casino public.businesses;
  casino_level integer;
  share_percent integer:=0;
  owner_share bigint:=0;
  now_ms bigint;
begin
  if p_amount<100 or p_amount>100000 then return jsonb_build_object('error','Ставка должна быть от 100 до 100 000 ₽'); end if;
  if p_game_type not in ('roulette','dice','race') then return jsonb_build_object('error','Неизвестная игра'); end if;
  if p_game_type='roulette' and p_bet_choice !~ '^(red|black|even|odd|zero|dozen[123]|col[123]|exact_(0|[1-9]|[12][0-9]|3[0-6]))$'
    then return jsonb_build_object('error','Неверная ставка на рулетку'); end if;
  if p_game_type='dice' and p_bet_choice !~ '^(under7|over7|exact7|double|exact_([2-9]|1[012]))$'
    then return jsonb_build_object('error','Неверная ставка на кости'); end if;
  if p_game_type='race' and p_bet_choice not in ('skyline','bmw','toyota','lada','priora','matiz')
    then return jsonb_build_object('error','Такой машины нет'); end if;

  select * into r from public.casino_rounds order by created_at desc,id desc limit 1 for update;
  now_ms:=floor(extract(epoch from clock_timestamp())*1000);
  if not found or r.status<>'betting' or r.end_time<=now_ms then
    return jsonb_build_object('error','Приём ставок закрыт');
  end if;
  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;
  if coalesce(p.money,0)<p_amount then return jsonb_build_object('error','Недостаточно денег'); end if;

  select * into casino from public.businesses where biz_type='casino' and location_key='casino_01';
  if found and casino.owner_id<>p_player_id then
    select level into casino_level from public.casino_business_upgrades where business_id=casino.id;
    share_percent:=case coalesce(casino_level,1) when 1 then 5 when 2 then 7 else 10 end;
    owner_share:=floor(p_amount*share_percent/100.0)::bigint;
  end if;

  update public.players set money=money-p_amount where id=p_player_id;
  if owner_share>0 then
    update public.businesses set cash_balance=coalesce(cash_balance,0)+owner_share where id=casino.id;
  end if;
  insert into public.casino_bets(round_id,player_id,game_type,bet_choice,amount)
    values(r.id,p_player_id,p_game_type,p_bet_choice,p_amount);
  update public.casino_rounds set bet_count=bet_count+1,bet_total=bet_total+p_amount where id=r.id;
  perform public.log_action_rpc(p_player_id,'casino_bet',
    jsonb_build_object('game',p_game_type,'choice',p_bet_choice,'round',r.id),-p_amount,p.money-p_amount);
  return jsonb_build_object('success',true,'money',p.money-p_amount,'round_id',r.id,
    'casino_owner_share',owner_share,'casino_share_percent',share_percent);
end $$;

revoke all on function public.casino_business_state_rpc(uuid),public.casino_business_upgrade_rpc(uuid,uuid),
  public.place_bet_rpc(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.casino_business_state_rpc(uuid),public.casino_business_upgrade_rpc(uuid,uuid),
  public.place_bet_rpc(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
