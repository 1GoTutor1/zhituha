-- Personal slots: every spin is independent, stored per player, and settled atomically.
create table if not exists public.casino_slot_spins (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  request_id uuid not null,
  amount bigint not null check (amount between 100 and 100000),
  symbols text[] not null check (cardinality(symbols)=3),
  multiplier numeric(5,2) not null default 0,
  payout bigint not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  unique(player_id,request_id)
);

create index if not exists casino_slot_spins_player_created_idx
  on public.casino_slot_spins(player_id,created_at desc);

alter table public.casino_slot_spins enable row level security;
revoke all on public.casino_slot_spins from public,anon,authenticated;

create or replace function public.casino_slots_spin_rpc(
  p_player_id uuid,p_amount integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  p public.players;
  spin public.casino_slot_spins;
  icons text[]:=array['7️⃣','💎','🔔','🍒','🍋','⭐'];
  landed text[];
  mult numeric(5,2):=0;
  payout bigint:=0;
  new_money bigint;
begin
  if p_player_id is null or p_request_id is null then
    return jsonb_build_object('error','Не удалось проверить запрос. Повтори спин');
  end if;
  if p_amount is null or p_amount<100 or p_amount>100000 then
    return jsonb_build_object('error','Ставка от 100 до 100 000 ₽');
  end if;

  select * into p from public.players where id=p_player_id for update;
  if not found then return jsonb_build_object('error','Игрок не найден'); end if;

  -- Retry with the same request ID returns the original result and never charges twice.
  select * into spin from public.casino_slot_spins where player_id=p_player_id and request_id=p_request_id;
  if found then
    return jsonb_build_object('success',true,'id',spin.id,'symbols',spin.symbols,
      'amount',spin.amount,'payout',spin.payout,'multiplier',spin.multiplier,
      'net',spin.payout-spin.amount,'money',p.money,'created_at',spin.created_at);
  end if;
  if coalesce(p.money,0)<p_amount then return jsonb_build_object('error','Недостаточно денег'); end if;

  landed:=array[
    icons[1+floor(random()*array_length(icons,1))::int],
    icons[1+floor(random()*array_length(icons,1))::int],
    icons[1+floor(random()*array_length(icons,1))::int]
  ];
  if landed[1]=landed[2] and landed[2]=landed[3] then
    mult:=case landed[1]
      when '7️⃣' then 20 when '💎' then 12 when '🔔' then 8
      when '🍒' then 5 when '🍋' then 3 when '⭐' then 4 else 0 end;
  elsif landed[1]=landed[2] or landed[1]=landed[3] or landed[2]=landed[3] then
    mult:=1.5;
  end if;
  payout:=floor(p_amount*mult)::bigint;

  insert into public.casino_slot_spins(player_id,request_id,amount,symbols,multiplier,payout)
    values(p_player_id,p_request_id,p_amount,landed,mult,payout) returning * into spin;
  update public.players set money=coalesce(money,0)-p_amount+payout where id=p_player_id returning money into new_money;

  return jsonb_build_object('success',true,'id',spin.id,'symbols',landed,
    'amount',p_amount,'payout',payout,'multiplier',mult,
    'net',payout-p_amount,'money',new_money,'created_at',spin.created_at);
end $$;

create or replace function public.casino_slots_history_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if p_player_id is null then return jsonb_build_object('error','Игрок не найден'); end if;
  return jsonb_build_object('history',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.id,'symbols',s.symbols,'amount',s.amount,
      'payout',s.payout,'multiplier',s.multiplier,'net',s.payout-s.amount,'created_at',s.created_at)
      order by s.created_at desc,id desc)
    from (select * from public.casino_slot_spins where player_id=p_player_id
      order by created_at desc,id desc limit 10) s
  ),'[]'::jsonb));
end $$;

revoke all on function public.casino_slots_spin_rpc(uuid,integer,uuid),
  public.casino_slots_history_rpc(uuid) from public,anon,authenticated,service_role;
grant execute on function public.casino_slots_spin_rpc(uuid,integer,uuid),
  public.casino_slots_history_rpc(uuid) to service_role;
