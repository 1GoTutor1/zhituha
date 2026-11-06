-- Give commonly recognized Russian plate series and readable letter combinations a collectible value.
-- Old series associations vary by region and era; this is a game pricing table only.
create or replace function public.car_plate_value(p_plate text)
returns bigint language plpgsql immutable set search_path=pg_catalog,public as $$
declare
  compact text;
  letters text;
  digits text;
  region text;
  digit_mult numeric:=1;
  letter_mult numeric:=1;
  region_mult numeric:=1;
  letter_order constant text:='АВЕКМНОРСТУХ';
  first_letter_index integer;
  second_letter_index integer;
  third_letter_index integer;
begin
  compact:=regexp_replace(upper(coalesce(p_plate,'')),'[^А-Я0-9]','','g');
  if length(compact)<7 then return 1000; end if;
  letters:=substr(compact,1,1)||substr(compact,5,2);
  digits:=substr(compact,2,3);
  region:=substr(compact,7);

  if digits='777' then digit_mult:=12;
  elsif digits in ('001','888') then digit_mult:=8;
  elsif digits='999' then digit_mult:=7;
  elsif digits='555' then digit_mult:=6;
  elsif digits='007' then digit_mult:=5;
  elsif digits=repeat(substr(digits,1,1),3) then digit_mult:=4;
  elsif digits in ('100','200','300','400','500','600','700','800','900') then digit_mult:=2.5;
  elsif substr(digits,1,1)=substr(digits,2,1) or substr(digits,2,1)=substr(digits,3,1) then digit_mult:=1.5;
  elsif digits in ('123','321') then digit_mult:=2;
  end if;

  if letters=repeat(substr(letters,1,1),3) then
    letter_mult:=8;
  elsif letters in ('АМР','ЕКХ','АУЕ') then
    letter_mult:=7;
  elsif letters='ХКХ' then
    letter_mult:=6;
  elsif letters in ('ВОР','ХАМ') then
    letter_mult:=5;
  elsif letters in ('АМО','АММ','АОО','АРМ','АТК','ВКР','ВМР','ВОО','ЕКР','ЕОО','ЕРЕ',
    'ККХ','КММ','КМР','КОО','ММР','МОО','ОКО','ООА','ООН','ООС','ОРР','ОСК','ОСМ','ОТТ','САС','СКР','СОО') then
    letter_mult:=4;
  elsif substr(letters,1,1)=substr(letters,2,1)
     or substr(letters,2,1)=substr(letters,3,1)
     or substr(letters,1,1)=substr(letters,3,1) then
    letter_mult:=2.5;
  else
    first_letter_index:=strpos(letter_order,substr(letters,1,1));
    second_letter_index:=strpos(letter_order,substr(letters,2,1));
    third_letter_index:=strpos(letter_order,substr(letters,3,1));
    if first_letter_index>0 and second_letter_index>0 and third_letter_index>0
       and ((second_letter_index=first_letter_index+1 and third_letter_index=second_letter_index+1)
         or (second_letter_index=first_letter_index-1 and third_letter_index=second_letter_index-1)) then
      letter_mult:=3;
    end if;
  end if;
  if substr(letters,1,1) in ('А','М','О') then letter_mult:=letter_mult*1.2; end if;
  if region in ('77','99','777') then region_mult:=2; end if;
  return least(100000::numeric,round(1000*digit_mult*letter_mult*region_mult))::bigint;
end;
$$;

create or replace function public.generate_car_plate()
returns text language plpgsql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  alphabet text[]:=array['А','В','Е','К','М','Н','О','Р','С','Т','У','Х'];
  regions text[]:=array['01','02','16','50','77','97','99','777'];
  special_series text[]:=array['АМР','ЕКХ','АУЕ','ХКХ','ВОР','ХАМ','АМО','АММ','АОО','АРМ','АТК','ВКР','ВМР','ВОО','ЕКР','ЕОО','ЕРЕ','ККХ','КММ','КМР','КОО','ММР','МОО','ОКО','ООА','ООН','ООС','ОРР','ОСК','ОСМ','ОТТ','САС','СКР','СОО'];
  candidate text;
  letters text;
  digits text;
  region text;
  repeated_letter text;
  other_letter text;
  pattern_roll numeric;
  start_index integer;
  pattern_kind integer;
  i integer;
begin
  perform pg_advisory_xact_lock(hashtext('zhituha-car-plate'));
  for i in 1..100 loop
    pattern_roll:=random();
    if pattern_roll<0.04 then
      repeated_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
      letters:=repeated_letter||repeated_letter||repeated_letter;
    elsif pattern_roll<0.28 then
      repeated_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
      loop
        other_letter:=alphabet[1+floor(random()*array_length(alphabet,1))::integer];
        exit when other_letter<>repeated_letter;
      end loop;
      pattern_kind:=floor(random()*3)::integer;
      if pattern_kind=0 then letters:=repeated_letter||repeated_letter||other_letter;
      elsif pattern_kind=1 then letters:=repeated_letter||other_letter||other_letter;
      else letters:=repeated_letter||other_letter||repeated_letter;
      end if;
    elsif pattern_roll<0.38 then
      start_index:=1+floor(random()*(array_length(alphabet,1)-2))::integer;
      if random()<0.5 then
        letters:=alphabet[start_index]||alphabet[start_index+1]||alphabet[start_index+2];
      else
        letters:=alphabet[start_index+2]||alphabet[start_index+1]||alphabet[start_index];
      end if;
    elsif pattern_roll<0.44 then
      letters:=special_series[1+floor(random()*array_length(special_series,1))::integer];
    else
      letters:=alphabet[1+floor(random()*array_length(alphabet,1))::integer]
        ||alphabet[1+floor(random()*array_length(alphabet,1))::integer]
        ||alphabet[1+floor(random()*array_length(alphabet,1))::integer];
    end if;
    digits:=lpad(floor(random()*1000)::integer::text,3,'0');
    region:=regions[1+floor(random()*array_length(regions,1))::integer];
    candidate:=substr(letters,1,1)||digits||substr(letters,2,2)||' '||region;
    if not exists(select 1 from public.players where car_plate=candidate)
      and not exists(select 1 from public.player_car_plate_rolls where plate=candidate and status='pending')
      and not exists(select 1 from public.player_car_numbers where plate=candidate)
      and not exists(select 1 from public.businesses b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.stock->'taxi_cars')='array' then b.stock->'taxi_cars' else '[]'::jsonb end) c where c->>'plate'=candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Unable to allocate a unique car plate';
end;
$$;
