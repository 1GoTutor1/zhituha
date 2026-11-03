-- Safe player nickname changes: ASCII English letters only, case-insensitive
-- uniqueness, and one change per 14 days. Apply once in Supabase SQL Editor.

alter table public.players
  add column if not exists nickname_changed_at timestamptz;

create or replace function public.guard_player_nickname()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname then
    return new;
  end if;

  if new.nickname is null or length(btrim(new.nickname)) not between 1 and 40 then
    raise exception using errcode = 'P0001', message = 'Ник должен быть длиной от 1 до 40 символов';
  end if;

  if tg_op = 'UPDATE' and new.nickname !~ '^[A-Za-z]{3,20}$' then
    raise exception using errcode = 'P0001', message = 'Ник можно менять только на 3–20 английских букв A–Z';
  end if;

  -- Lock by normalized nickname to prevent two simultaneous registrations or
  -- changes from claiming the same name before either transaction commits.
  perform pg_advisory_xact_lock(hashtextextended(lower(new.nickname), 0));
  if exists (
    select 1 from public.players p
    where lower(p.nickname) = lower(new.nickname)
      and p.id is distinct from new.id
  ) then
    raise exception using errcode = 'P0001', message = 'Этот ник уже занят';
  end if;

  if tg_op = 'UPDATE' then
    if old.nickname_changed_at is not null
      and clock_timestamp() < old.nickname_changed_at + interval '14 days' then
      raise exception using errcode = 'P0001', message = 'Менять ник можно один раз в 14 дней';
    end if;
    new.nickname_changed_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists players_nickname_guard on public.players;
create trigger players_nickname_guard
before insert or update of nickname on public.players
for each row execute function public.guard_player_nickname();

create or replace function public.change_nickname_rpc(p_player_id uuid, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare p public.players%rowtype;
begin
  if p_nickname is null or p_nickname !~ '^[A-Za-z]{3,20}$' then
    return jsonb_build_object('error', 'Используй 3–20 английских букв A–Z без цифр и символов');
  end if;

  select * into p from public.players where id = p_player_id for update;
  if not found then return jsonb_build_object('error', 'Игрок не найден'); end if;

  if p.nickname_changed_at is not null
    and clock_timestamp() < p.nickname_changed_at + interval '14 days' then
    return jsonb_build_object(
      'error', 'Менять ник можно один раз в 14 дней',
      'next_change_at', p.nickname_changed_at + interval '14 days'
    );
  end if;

  if lower(p.nickname) = lower(p_nickname) then
    return jsonb_build_object('error', 'Новый ник должен отличаться от текущего');
  end if;

  update public.players set nickname = p_nickname where id = p_player_id;
  select * into p from public.players where id = p_player_id;
  return jsonb_build_object(
    'success', true,
    'nickname', p.nickname,
    'nickname_changed_at', p.nickname_changed_at,
    'next_change_at', p.nickname_changed_at + interval '14 days'
  );
end;
$$;

revoke all on function public.guard_player_nickname(),
  public.change_nickname_rpc(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.change_nickname_rpc(uuid, text) to service_role;

notify pgrst, 'reload schema';
