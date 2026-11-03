-- Remove the old phone-based permanent market slot bonus.
-- Run once in Supabase SQL Editor after deploying the matching app update.

update public.players
set market_slots = 3
where market_slots is distinct from 3;

create or replace function public.buy_phone_rpc(p_player_id uuid, p_is_buying boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare p players;
begin
  select * into p from players where id = p_player_id for update;
  if not found then return jsonb_build_object('error','player not found'); end if;
  if p_is_buying then
    return jsonb_build_object('error','телефоны больше нельзя купить у системы');
  end if;
  if p.phone_count <= 0 then return jsonb_build_object('error','телефона нет'); end if;
  update players set money = money + 1400, phone_count = 0 where id = p_player_id;
  return jsonb_build_object('money', p.money + 1400, 'market_slots', coalesce(p.market_slots,3));
end $$;

revoke execute on function public.buy_phone_rpc(uuid, boolean) from public, anon, authenticated;
grant execute on function public.buy_phone_rpc(uuid, boolean) to service_role;
