-- Keep all 120 possible 1-5 challenge orders unique until they have been used.
alter table public.work_anticheat
  add column if not exists captcha_history text[] not null default '{}'::text[];

create or replace function public.issue_work_captcha_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare used_codes text[]; code text; attempt integer;
begin
  select captcha_history into used_codes from public.work_anticheat where player_id=p_player_id for update;
  if not found then return jsonb_build_object('error','Проверка не найдена'); end if;
  used_codes:=coalesce(used_codes,'{}'::text[]);
  for attempt in 1..240 loop
    select string_agg(n::text,'' order by random()) into code from generate_series(1,5) as seq(n);
    exit when cardinality(used_codes)>=120 or not (code=any(used_codes));
  end loop;
  if cardinality(used_codes)>=120 then used_codes:='{}'::text[]; end if;
  used_codes:=array_append(used_codes,code);
  update public.work_anticheat set captcha_code=code,captcha_issued_at=clock_timestamp(),captcha_history=used_codes
    where player_id=p_player_id;
  return jsonb_build_object('captcha_code',code);
end $$;

do $$ begin
  if to_regprocedure('public.work_rpc_before_ordered_captcha(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_ordered_captcha';
  end if;
end $$;
create or replace function public.work_rpc(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; old_code text; issued_at timestamptz; challenge jsonb;
begin
  insert into public.work_anticheat(player_id) values(p_player_id) on conflict do nothing;
  select captcha_code,captcha_issued_at into old_code,issued_at
    from public.work_anticheat where player_id=p_player_id for update;
  result_json:=public.work_rpc_before_ordered_captcha(p_player_id);
  if not coalesce((result_json->>'captcha_required')::boolean,false) then return result_json; end if;
  if old_code is null or issued_at<clock_timestamp()-interval '10 minutes' then
    challenge:=public.issue_work_captcha_rpc(p_player_id);
    return result_json||challenge;
  end if;
  return result_json||jsonb_build_object('captcha_code',old_code);
end $$;

do $$ begin
  if to_regprocedure('public.verify_work_captcha_rpc_before_ordered_captcha(uuid,text)') is null then
    execute 'alter function public.verify_work_captcha_rpc(uuid,text) rename to verify_work_captcha_rpc_before_ordered_captcha';
  end if;
end $$;
create or replace function public.verify_work_captcha_rpc(p_player_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result_json jsonb; challenge jsonb;
begin
  result_json:=public.verify_work_captcha_rpc_before_ordered_captcha(p_player_id,p_code);
  if not coalesce((result_json->>'captcha_required')::boolean,false) then return result_json; end if;
  challenge:=public.issue_work_captcha_rpc(p_player_id);
  return result_json||challenge;
end $$;

revoke all on function public.issue_work_captcha_rpc(uuid),
  public.work_rpc_before_ordered_captcha(uuid),public.verify_work_captcha_rpc_before_ordered_captcha(uuid,text),
  public.work_rpc(uuid),public.verify_work_captcha_rpc(uuid,text) from public,anon,authenticated;
grant execute on function public.work_rpc(uuid),public.verify_work_captcha_rpc(uuid,text) to service_role;
notify pgrst,'reload schema';
