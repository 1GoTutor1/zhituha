-- Hide the CAPTCHA answer from RPC JSON and return a path-rendered SVG image.
-- Apply after AUTOCLICKER_CAPTCHA_MIGRATION.sql and WORK_CAPTCHA_ORDER_MIGRATION.sql,
-- then deploy the matching frontend. This deters simple scripts that read the RPC answer;
-- it is not intended to defeat advanced OCR or a human-solving service.

create or replace function public.work_captcha_image(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  glyphs text[] := array[
    'M 4 5 L 8 1 L 8 19 M 4 19 L 12 19',
    'M 2 5 C 3 1 11 0 13 4 C 16 8 11 11 2 19 L 14 19',
    'M 2 3 C 12 0 14 3 10 8 L 6 10 C 13 9 15 13 12 17 C 10 21 4 21 1 18',
    'M 11 20 L 11 1 L 1 13 L 15 13',
    'M 14 2 L 4 2 L 3 9 C 12 6 15 11 13 16 C 11 21 4 21 1 18'
  ];
  svg text := '<svg xmlns="http://www.w3.org/2000/svg" width="132" height="40" viewBox="0 0 132 40"><rect width="132" height="40" rx="7" fill="#100b18"/>';
  idx integer;
  x integer;
  angle integer;
  digit integer;
begin
  if p_code is null or p_code !~ '^[1-5]{5}$' then
    return null;
  end if;

  for idx in 1..length(p_code) loop
    x := 5 + (idx - 1) * 25;
    angle := floor(random() * 13)::integer - 6;
    digit := substring(p_code from idx for 1)::integer;
    svg := svg || format(
      '<path d="%s" transform="translate(%s,8) rotate(%s,8,10)" fill="none" stroke="#f7f3fb" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
      glyphs[digit], x, angle
    );
  end loop;

  svg := svg || '</svg>';
  return 'data:image/svg+xml;base64,' || encode(convert_to(svg, 'UTF8'), 'base64');
end;
$$;

do $$
begin
  if to_regprocedure('public.work_rpc_before_image_captcha(uuid)') is null then
    execute 'alter function public.work_rpc(uuid) rename to work_rpc_before_image_captcha';
  end if;
  if to_regprocedure('public.verify_work_captcha_rpc_before_image_captcha(uuid,text)') is null then
    execute 'alter function public.verify_work_captcha_rpc(uuid,text) rename to verify_work_captcha_rpc_before_image_captcha';
  end if;
end;
$$;

create or replace function public.work_rpc(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  answer text;
begin
  result_json := public.work_rpc_before_image_captcha(p_player_id);
  answer := result_json->>'captcha_code';
  if answer is null then return result_json; end if;
  return (result_json - 'captcha_code') || jsonb_build_object(
    'captcha_image', public.work_captcha_image(answer)
  );
end;
$$;

create or replace function public.verify_work_captcha_rpc(p_player_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  result_json jsonb;
  answer text;
begin
  result_json := public.verify_work_captcha_rpc_before_image_captcha(p_player_id, p_code);
  answer := result_json->>'captcha_code';
  if answer is null then return result_json; end if;
  return (result_json - 'captcha_code') || jsonb_build_object(
    'captcha_image', public.work_captcha_image(answer)
  );
end;
$$;

revoke all on function public.work_captcha_image(text),
  public.work_rpc_before_image_captcha(uuid),
  public.verify_work_captcha_rpc_before_image_captcha(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.work_rpc(uuid), public.verify_work_captcha_rpc(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.work_rpc(uuid), public.verify_work_captcha_rpc(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
