-- Run in Supabase SQL Editor to repair/update the token ↔ coin exchange RPC.
-- Rates: 2,500 coins → 1 token; 1 token → 1,500 coins.
create or replace function public.donation_exchange_rpc(
  p_player_id uuid,
  p_direction text,
  p_amount bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.players;
  gems bigint;
  coins bigint;
  exchange_data jsonb;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('error', 'Укажи положительное целое количество для обмена');
  end if;

  select * into p
  from public.players
  where id = p_player_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Игрок не найден');
  end if;

  if p_direction = 'money_to_premium' then
    if p_amount < 2500 or p_amount > 200000 or p_amount % 2500 <> 0 then
      return jsonb_build_object('error', 'Обмен: от 2 500 до 200 000 монет, шаг 2 500');
    end if;
    if coalesce(p.money, 0) < p_amount then
      return jsonb_build_object('error', 'Недостаточно монет');
    end if;

    gems := p_amount / 2500;
    update public.players
    set money = coalesce(money, 0) - p_amount,
        premium_balance = coalesce(premium_balance, 0) + gems
    where id = p_player_id
    returning * into p;
    exchange_data := jsonb_build_object('direction', p_direction, 'spent', p_amount, 'received', gems);

  elsif p_direction = 'premium_to_money' then
    if p_amount > 100 then
      return jsonb_build_object('error', 'За один обмен можно конвертировать не больше 100 жетонов');
    end if;
    if coalesce(p.premium_balance, 0) < p_amount then
      return jsonb_build_object('error', 'Недостаточно жетонов');
    end if;

    coins := p_amount * 1500;
    update public.players
    set money = coalesce(money, 0) + coins,
        premium_balance = coalesce(premium_balance, 0) - p_amount
    where id = p_player_id
    returning * into p;
    exchange_data := jsonb_build_object('direction', p_direction, 'spent', p_amount, 'received', coins);
  else
    return jsonb_build_object('error', 'Неизвестное направление обмена');
  end if;

  return jsonb_build_object(
    'ok', true,
    'exchange', exchange_data,
    'player', jsonb_build_object(
      'money', p.money,
      'premium_balance', p.premium_balance,
      'market_slots', p.market_slots,
      'owned_cosmetics', p.owned_cosmetics,
      'profile_frame', p.profile_frame,
      'profile_background', p.profile_background
    )
  );
end;
$$;

revoke execute on function public.donation_exchange_rpc(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.donation_exchange_rpc(uuid, text, bigint) to service_role;
