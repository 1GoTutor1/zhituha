-- Finalize an ended season and return the top collection in one database round trip.
create or replace function public.number_forever_leaderboard_rpc()
returns table(player_id uuid,nickname text,number_count integer,collection_value bigint,best_number_value bigint)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.number_case_finalize_expired_seasons();
  return query
    select v.player_id,v.nickname,v.number_count,v.collection_value,v.best_number_value
    from public.forever_number_leaderboard v
    order by v.collection_value desc,v.player_id asc
    limit 10;
end;
$$;

revoke all on function public.number_forever_leaderboard_rpc() from public,anon,authenticated;
grant execute on function public.number_forever_leaderboard_rpc() to service_role;
