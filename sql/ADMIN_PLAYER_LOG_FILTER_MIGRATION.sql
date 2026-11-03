-- Admin log viewer: allow an admin to filter the shared action log by one player.
-- Search accepts an exact nickname, Telegram ID, or internal player UUID.

drop function if exists public.get_logs_rpc(uuid, integer, text);

create or replace function public.get_logs_rpc(
  p_admin_id uuid,
  p_limit integer default 200,
  p_action_type text default null,
  p_player_query text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_query text := nullif(btrim(p_player_query), '');
  v_player_id uuid;
  v_player jsonb := null;
begin
  if not exists (
    select 1 from public.players p
     where p.id = p_admin_id and p.role in ('admin', 'superadmin')
  ) then
    return jsonb_build_object('error', 'Admin access required');
  end if;

  if v_query is not null then
    select p.id
      into v_player_id
      from public.players p
     where lower(p.nickname) = lower(v_query)
        or p.telegram_id::text = v_query
        or p.id::text = v_query
     order by case
       when p.id::text = v_query then 1
       when p.telegram_id::text = v_query then 2
       else 3
     end
     limit 1;

    if v_player_id is null then
      return jsonb_build_object('logs', '[]'::jsonb, 'player', null);
    end if;

    select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'telegram_id', p.telegram_id)
      into v_player
      from public.players p
     where p.id = v_player_id;
  end if;

  return jsonb_build_object(
    'logs', coalesce((
      select jsonb_agg(
        to_jsonb(l) || jsonb_build_object('nickname', p.nickname, 'telegram_id', p.telegram_id)
        order by l.created_at desc
      )
      from (
        select al.*
          from public.action_logs al
         where al.action_type not in ('casino_bet', 'casino_resolve')
           and (p_action_type is null or al.action_type = p_action_type)
           and (
             v_player_id is null
             or al.player_id = v_player_id
             or al.details->>'target_id' = v_player_id::text
             or al.details->>'target_player_id' = v_player_id::text
           )
         order by al.created_at desc
         limit least(greatest(coalesce(p_limit, 200), 1), 500)
      ) l
      left join public.players p on p.id = l.player_id
    ), '[]'::jsonb),
    'player', v_player
  );
end;
$$;

revoke all on function public.get_logs_rpc(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.get_logs_rpc(uuid, integer, text, text) to service_role;
