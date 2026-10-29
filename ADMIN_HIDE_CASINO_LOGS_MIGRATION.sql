-- Keep casino events out of the shared admin action log.
-- Casino bets and rounds remain available in casino_bets/casino_rounds.
create or replace function public.log_action_rpc(
  p_player_id uuid,
  p_action_type text,
  p_details jsonb default '{}'::jsonb,
  p_money_delta integer default null,
  p_money_after integer default null
)
returns void
language plpgsql
security definer
as $$
begin
  if p_action_type in ('casino_bet', 'casino_resolve') then
    return;
  end if;

  insert into public.action_logs (player_id, action_type, details, money_delta, money_after)
  values (
    p_player_id,
    left(coalesce(p_action_type, 'unknown'), 64),
    coalesce(p_details, '{}'::jsonb),
    p_money_delta,
    p_money_after
  );
end;
$$;

-- Remove casino entries already accumulated in the shared admin log.
delete from public.action_logs
where action_type in ('casino_bet', 'casino_resolve');

create or replace function public.get_logs_rpc(
  p_admin_id uuid,
  p_limit int default 200,
  p_action_type text default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  if not public.is_admin(p_admin_id) then
    return jsonb_build_object('error', 'не админ');
  end if;

  return jsonb_build_object(
    'logs',
    (
      select jsonb_agg(l order by l.created_at desc)
      from (
        select l.*
        from public.action_logs l
        where l.action_type not in ('casino_bet', 'casino_resolve')
          and (p_action_type is null or l.action_type = p_action_type)
        order by l.created_at desc
        limit least(coalesce(p_limit, 200), 500)
      ) l
    )
  );
end;
$$;
