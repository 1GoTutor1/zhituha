create or replace function public.generate_number_case_plate(p_tier text)
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
  common_regions text[]:=array['01','02','16','50','77','97','99','777'];
  high_regions text[]:=array['77','99','777'];
  digit_patterns text[]:=array['100','200','300','400','500','600','700','800','900'];
  repeated_digits text[]:=array['000','111','222','333','444','555','666','777','888','999'];
  first_letter text; other_letter text; letters text; digits text; region text; candidate text;
  plate_value bigint; i integer;
begin
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..2000 loop
    first_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    if p_tier='common' then
      letters:=alphabet[1+floor(random()*12)::integer]||alphabet[1+floor(random()*12)::integer]||alphabet[1+floor(random()*12)::integer];
      digits:=lpad(floor(random()*1000)::integer::text,3,'0');
      region:=common_regions[1+floor(random()*array_length(common_regions,1))::integer];
    elsif p_tier='rare' then
      other_letter:=alphabet[1+floor(random()*12)::integer];
      letters:=first_letter||first_letter||other_letter;
      digits:=digit_patterns[1+floor(random()*array_length(digit_patterns,1))::integer];
      region:='01';
    elsif p_tier='epic' then
      letters:=first_letter||first_letter||first_letter;
      digits:='110'; region:='01';
    elsif p_tier='legendary' then
      letters:=first_letter||first_letter||first_letter;
      digits:=digit_patterns[1+floor(random()*array_length(digit_patterns,1))::integer]; region:='77';
    elsif p_tier='mythic' then
      letters:=first_letter||first_letter||first_letter;
      digits:=repeated_digits[1+floor(random()*array_length(repeated_digits,1))::integer];
      region:=high_regions[1+floor(random()*array_length(high_regions,1))::integer];
    else
      raise exception 'Unknown plate rarity';
    end if;
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    plate_value:=public.car_plate_value(candidate);
    if (p_tier='common' and plate_value<3000)
      or (p_tier='rare' and plate_value>=3000 and plate_value<10000)
      or (p_tier='epic' and plate_value>=10000 and plate_value<30000)
      or (p_tier='legendary' and plate_value>=30000 and plate_value<60000)
      or (p_tier='mythic' and plate_value>=60000) then
      if not exists(select 1 from public.players where car_plate=candidate)
        and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
        and not exists(select 1 from public.player_car_numbers where plate=candidate)
        and not exists(select 1 from public.player_forever_car_numbers where plate=candidate)
        and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
        return candidate;
      end if;
    end if;
  end loop;
  raise exception 'Unable to allocate unique plate for case';
end;
$$;

notify pgrst, 'reload schema';