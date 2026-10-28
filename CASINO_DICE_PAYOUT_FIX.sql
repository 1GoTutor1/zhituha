-- Dice payouts use probability-weighted odds; apply once in Supabase SQL Editor.
create or replace function public.resolve_round_rpc(p_round_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  r casino_rounds; b casino_bets;
  v_roulette int; v_dice1 int; v_dice2 int; v_dice int; v_race_r numeric; v_winner text;
  mult numeric; win_cnt int := 0; lose_cnt int := 0; payout_total bigint := 0;
  reds int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  select * into r from casino_rounds where id = p_round_id for update;
  if not found then return jsonb_build_object('error','раунд не найден'); end if;
  if r.status not in ('betting', 'spinning') then
    return jsonb_build_object('skipped', true, 'status', r.status);
  end if;

  -- Для betting выбираем результат и открываем анимацию. Для spinning
  -- результат уже выбран spin_round_rpc, поэтому повторно RNG не вызываем.
  if r.status = 'betting' then
    v_roulette := floor(random() * 37)::int;
    v_dice1 := floor(random() * 6)::int + 1;
    v_dice2 := floor(random() * 6)::int + 1;
    v_dice := v_dice1 + v_dice2;
    v_race_r := random() * 100;
    v_winner := case
      when v_race_r <= 40   then 'skyline'
      when v_race_r <= 70   then 'bmw'
      when v_race_r <= 85   then 'toyota'
      when v_race_r <= 95   then 'lada'
      when v_race_r <= 99   then 'priora'
      else 'matiz' end;

    update casino_rounds set status='spinning',
      roulette_result=v_roulette, dice_result=v_dice, race_winner=v_winner,
      dice_first=v_dice1, dice_second=v_dice2
    where id = p_round_id;
  else
    v_roulette := r.roulette_result;
    v_dice := r.dice_result;
    v_winner := r.race_winner;
    v_dice1 := coalesce(r.dice_first, greatest(1, least(6, r.dice_result - 6)));
    v_dice2 := coalesce(r.dice_second, r.dice_result - v_dice1);
  end if;

  for b in select * from casino_bets where round_id = p_round_id and status = 'pending' loop
    mult := 0;
    if b.game_type = 'roulette' then
      mult := case
        when b.bet_choice = 'zero'  and v_roulette = 0 then 36
        when b.bet_choice = 'red'   and v_roulette = any(reds) then 2
        when b.bet_choice = 'black' and v_roulette <> 0 and not (v_roulette = any(reds)) then 2
        when b.bet_choice = 'even'  and v_roulette <> 0 and v_roulette % 2 = 0 then 2
        when b.bet_choice = 'odd'   and v_roulette % 2 = 1 then 2
        when b.bet_choice = 'dozen1' and v_roulette between 1 and 12 then 3
        when b.bet_choice = 'dozen2' and v_roulette between 13 and 24 then 3
        when b.bet_choice = 'dozen3' and v_roulette between 25 and 36 then 3
        when b.bet_choice = 'col1' and v_roulette <> 0 and v_roulette % 3 = 1 then 3
        when b.bet_choice = 'col2' and v_roulette <> 0 and v_roulette % 3 = 2 then 3
        when b.bet_choice = 'col3' and v_roulette <> 0 and v_roulette % 3 = 0 then 3
        when b.bet_choice = 'exact_' || v_roulette then 36
        else 0 end;
    elsif b.game_type = 'dice' then
      mult := case
        when b.bet_choice = 'under7' and v_dice < 7 then 2
        when b.bet_choice = 'over7'  and v_dice > 7 then 2
        when b.bet_choice = 'exact7' and v_dice = 7 then 5
        when b.bet_choice = 'double' and v_dice1 = v_dice2 then 5
        when b.bet_choice = 'exact_' || v_dice then case v_dice
          when 2 then 30 when 3 then 15 when 4 then 10 when 5 then 7.5
          when 6 then 6 when 7 then 5 when 8 then 6 when 9 then 7.5
          when 10 then 10 when 11 then 15 when 12 then 30 else 0 end
        else 0 end;
    else -- race
      mult := case
        when b.bet_choice = v_winner then case v_winner
          when 'skyline' then 2 when 'bmw' then 2.5 when 'toyota' then 3.5
          when 'lada' then 8 when 'priora' then 12 else 25 end
        else 0 end;
    end if;

    if mult > 0 then
      update casino_bets set status='won' where id = b.id;
      perform change_stats(b.player_id, floor(b.amount * mult)::bigint, 0);
      win_cnt := win_cnt + 1; payout_total := payout_total + floor(b.amount * mult);
    else
      update casino_bets set status='lost' where id = b.id;
      lose_cnt := lose_cnt + 1;
    end if;
  end loop;

  update casino_rounds set status='result', end_time = floor(extract(epoch from clock_timestamp())*1000) + 10000
  where id = p_round_id;
  perform log_action_rpc(null, 'casino_resolve',
    jsonb_build_object('round', p_round_id, 'roulette', v_roulette, 'dice', v_dice,
                       'race', v_winner, 'wins', win_cnt, 'losses', lose_cnt, 'payout', payout_total),
    null, null);
  return jsonb_build_object('resolved', true, 'roulette', v_roulette, 'dice', v_dice,
                            'race', v_winner, 'wins', win_cnt, 'payout', payout_total);
end $$;
