import { verifyTelegramInitData } from './_telegram.js';
import { blockDuringMaintenance, readMaintenance } from './_maintenance.js';
import { checkChannelSubscription } from './_subscription.js';
import { getServiceClient } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = !SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : !BOT_TOKEN ? 'BOT_TOKEN' : 'VITE_SUPABASE_URL';
    return res.status(500).json({ error: `Vercel server setting is missing: ${missing}` });
  }
  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Telegram authentication required' });

  const sb = getServiceClient();
  const { action } = req.body || {};
  try {
    const profileRefreshFields = 'id, role, is_subscribed, is_banned, money, referral_balance, tip_balance, boost_end, brew_end, coffee_bonus_until, return_boost_until, phone_count, has_car, car_model, car_health, energy, current_district, has_house, house_type, market_slots, premium_balance, premium_until, owned_cosmetics, profile_frame, profile_background';
    const playerSelection = ['leaderboard', 'public_profile'].includes(action) ? 'id, role'
      : action === 'profile_refresh' ? profileRefreshFields : '*';
    const [playerResult, maintenanceEnabled, referralsResult] = await Promise.all([
      sb.from('players').select(playerSelection).eq('telegram_id', String(user.id)).maybeSingle(),
      readMaintenance(sb),
      action === 'me'
        ? sb.from('players').select('id', { count: 'exact', head: true }).eq('referred_by', String(user.id))
        : Promise.resolve({ data: null, error: null }),
    ]);
    const { data: player, error: playerError } = playerResult;
    if (playerError) throw playerError;
    if (await blockDuringMaintenance(sb, player, res, maintenanceEnabled)) return;

    if (action === 'subscription_check') {
      let isSubscribed;
      try { isSubscribed = await checkChannelSubscription(user.id, BOT_TOKEN); }
      catch {
        return res.status(503).json({ error: 'Не удалось проверить подписку. Попробуй ещё раз.' });
      }
      if (player) {
        const { error } = await sb.from('players').update({ is_subscribed: isSubscribed }).eq('id', player.id);
        if (error) throw error;
      }
      return res.status(200).json({ is_subscribed: isSubscribed });
    }

    if (action === 'change_nickname') {
      if (!player) return res.status(404).json({ error: 'Игрок не зарегистрирован' });
      if (player.is_banned) return res.status(403).json({ error: 'Аккаунт заблокирован' });
      if (player.is_subscribed === false) return res.status(403).json({ error: 'Сначала подпишись на канал игры' });
      const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname : '';
      if (!/^[A-Za-z]{3,20}$/.test(nickname)) {
        return res.status(400).json({ error: 'Используй 3–20 английских букв A–Z без цифр и символов' });
      }
      const { data, error } = await sb.rpc('change_nickname_rpc', {
        p_player_id: player.id,
        p_nickname: nickname,
      });
      if (error) return res.status(400).json({ error: String(error.message || 'Не удалось сменить ник').slice(0, 180) });
      if (data?.error) return res.status(400).json(data);
      return res.status(200).json(data);
    }

    if (action === 'leaderboard') {
      const { data, error } = await sb.from('players').select('id, nickname, money, profile_background, owned_cosmetics, premium_until, season_badge_showcase')
        .or('is_banned.is.null,is_banned.eq.false').order('money', { ascending: false }).limit(10);
      if (error) throw error;
      const allowedBackgrounds = new Set(['background_panelka', 'background_brick', 'background_concrete', 'background_night_route']);
      const players = (data || []).map(({ owned_cosmetics, ...rankedPlayer }) => ({
        ...rankedPlayer,
        premium_active: !!rankedPlayer.premium_until && new Date(rankedPlayer.premium_until).getTime() > Date.now(),
        season_badge_showcase: Array.isArray(rankedPlayer.season_badge_showcase) ? rankedPlayer.season_badge_showcase.slice(0, 1) : [],
        profile_background: allowedBackgrounds.has(rankedPlayer.profile_background)
          && Array.isArray(owned_cosmetics) && owned_cosmetics.includes(rankedPlayer.profile_background)
          ? rankedPlayer.profile_background : null,
      }));
      return res.status(200).json({ players });
    }

    if (action === 'public_profile') {
      if (!player) return res.status(404).json({ error: 'Player profile not found' });
      const targetId = typeof req.body?.target_player_id === 'string' ? req.body.target_player_id : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
        return res.status(400).json({ error: 'Invalid player id' });
      }
      const { data: target, error: targetError } = await sb.from('players')
        .select('id, telegram_id, nickname, gender, avatar_id, money, referral_balance, has_car, car_model, has_house, house_type, phone_count, profile_frame, profile_background, premium_until, player_level, player_xp, active_profession, unlocked_professions, season_badge_showcase, is_banned')
        .eq('id', targetId).maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.is_banned) return res.status(404).json({ error: 'Player profile not found' });

      const [businessResult, referralCountResult, familyMembershipResult, familyAwardsResult] = await Promise.all([
        sb.from('businesses').select('business_name, biz_type, passive_level').eq('owner_id', target.id).limit(20),
        sb.from('players').select('id', { count: 'exact', head: true }).eq('referred_by', String(target.telegram_id)),
        sb.from('family_memberships').select('family_id').eq('player_id', target.id).is('left_at', null).maybeSingle(),
        sb.from('family_member_awards').select('season_no, place, contribution').eq('player_id', target.id).order('season_no', { ascending: false }).limit(5),
      ]);
      if (businessResult.error) throw businessResult.error;
      if (referralCountResult.error) throw referralCountResult.error;
      if (familyMembershipResult.error) throw familyMembershipResult.error;
      let family = null;
      if (familyMembershipResult.data?.family_id) {
        const { data: familyData, error: familyError } = await sb.from('families')
          .select('id, name, tag').eq('id', familyMembershipResult.data.family_id)
          .is('disbanded_at', null).maybeSingle();
        if (familyError) throw familyError;
        family = familyData;
      }
      return res.status(200).json({
        profile: {
          id: target.id,
          nickname: target.nickname,
          gender: target.gender,
          avatar_id: target.avatar_id,
          money: target.money,
          referral_balance: target.referral_balance,
          has_car: target.has_car,
          car_model: target.car_model,
          has_house: target.has_house,
          house_type: target.house_type,
          phone_count: target.phone_count,
          profile_frame: target.profile_frame,
          profile_background: target.profile_background,
          premium_until: target.premium_until,
          premium_active: !!target.premium_until && new Date(target.premium_until).getTime() > Date.now(),
          season_badge_showcase: Array.isArray(target.season_badge_showcase) ? target.season_badge_showcase.slice(0, 3) : [],
          player_level: target.player_level,
          player_xp: target.player_xp,
          active_profession: target.active_profession,
          unlocked_professions: target.unlocked_professions,
          referral_count: referralCountResult.count || 0,
          businesses: businessResult.data || [],
          family,
          family_awards: familyAwardsResult.error ? [] : familyAwardsResult.data || [],
        },
      });
    }

    if (!player) return res.status(200).json({ player: null, referrals: [] });

    // Periodic refreshes need only the current profile. The full `me` action
    // touches activity and loads profession/taxi state, which is needed at login.
    if (action === 'profile_refresh') {
      if (player.is_banned) return res.status(403).json({ error: 'Аккаунт заблокирован' });
      if (player.is_subscribed === false) return res.status(403).json({ error: 'Сначала подпишись на канал игры' });
      return res.status(200).json({ player });
    }

    if (action === 'donor_leaderboard') {
      const { data, error } = await sb.rpc('donation_leaderboard_rpc', { p_limit: 10 });
      if (error) throw error;
      return res.status(200).json({ players: data?.players || [] });
    }

    if (action === 'me') {
      if (referralsResult.error) throw referralsResult.error;
      let returnBonus = null;
      const { data: activity, error: activityError } = await sb.rpc('player_touch_activity_rpc', { p_player_id: player.id });
      if (activityError) {
        // The game can still load while the return-bonus migration is being applied.
        if (!['PGRST202', '42883'].includes(activityError.code)) {
          console.error('Player activity touch failed:', activityError.message);
        }
      } else if (activity) {
        if (activity.money != null) player.money = activity.money;
        if (activity.return_boost_until) player.return_boost_until = activity.return_boost_until;
        returnBonus = activity.return_bonus || null;
      }
      const [professionResult, taxiFleetResult, missionResult] = await Promise.all([
        sb.rpc('profession_state_rpc', { p_player_id: player.id }),
        sb.rpc('taxi_fleet_rpc', { p_player_id: player.id }),
        sb.rpc('daily_missions_state_rpc', { p_player_id: player.id })
          .catch(error => ({ data: null, error })),
      ]);
      const { data: professionState, error: professionError } = professionResult;
      if (professionError) throw professionError;
      const { data: taxiFleet, error: taxiFleetError } = taxiFleetResult;
      if (taxiFleetError) throw taxiFleetError;
      if (professionState) professionState.taxi_fleet = taxiFleet;
      return res.status(200).json({
        player,
        referrals_count: referralsResult.count || 0,
        profession: professionState,
        daily_missions: missionResult.error ? null : missionResult.data?.missions || [],
        return_bonus: returnBonus,
      });
    }
    if (action === 'admin_grant_cosmetic') {
      if (!['admin', 'superadmin'].includes(player.role)) return res.status(403).json({ error: 'Admin access required' });
      const targetId = typeof req.body?.target_player_id === 'string' ? req.body.target_player_id : '';
      const itemId = typeof req.body?.item_id === 'string' ? req.body.item_id : '';
      const allowedItems = new Set([
        'frame_test', 'frame_amber', 'background_concrete', 'background_brick', 'background_panelka',
      ]);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId) || !allowedItems.has(itemId)) {
        return res.status(400).json({ error: 'Invalid player or cosmetic item' });
      }
      const { data: target, error: targetError } = await sb.from('players')
        .select('id, owned_cosmetics').eq('id', targetId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return res.status(404).json({ error: 'Player not found' });
      const owned = Array.isArray(target.owned_cosmetics) ? target.owned_cosmetics : [];
      if (owned.includes(itemId)) return res.status(200).json({ owned_cosmetics: owned, already_owned: true });
      const nextOwned = [...owned, itemId];
      const { error: grantError } = await sb.from('players').update({ owned_cosmetics: nextOwned }).eq('id', targetId);
      if (grantError) throw grantError;
      const { error: auditError } = await sb.rpc('log_action_rpc', {
        p_player_id: player.id,
        p_action_type: 'admin_grant_cosmetic',
        p_details: { target_player_id: targetId, item_id: itemId },
      });
      if (auditError) console.error('Cosmetic grant audit failed:', auditError.message);
      return res.status(200).json({ owned_cosmetics: nextOwned, already_owned: false });
    }
    if (action === 'admin_search') {
      if (!['admin', 'superadmin'].includes(player.role)) return res.status(403).json({ error: 'Admin access required' });
      const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 40) : '';
      if (!query) return res.status(200).json({ players: [] });
      const { data, error } = await sb.from('players').select('id, telegram_id, nickname, money, is_banned').ilike('nickname', `%${query}%`).order('nickname', { ascending: true }).limit(20);
      if (error) throw error;
      return res.status(200).json({ players: data || [] });
    }
    if (action === 'admin_list') {
      if (!['admin', 'superadmin'].includes(player.role)) return res.status(403).json({ error: 'Admin access required' });
      const pageSize = 20;
      const requestedPage = Number(req.body?.page);
      const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000000) : 1;
      const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 40) : '';
      let playersQuery = sb.from('players')
        .select('id, telegram_id, nickname, money, is_banned', { count: 'exact' })
        .order('nickname', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (query) playersQuery = playersQuery.ilike('nickname', `%${query}%`);
      const { data, error, count } = await playersQuery;
      if (error) throw error;
      const total = count || 0;
      return res.status(200).json({ players: data || [], page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) });
    }
    if (action === 'casino_money') return res.status(200).json({ money: player.money });
    return res.status(400).json({ error: 'Unsupported player action' });
  } catch (error) {
    console.error('Player API failed:', error?.message || error);
    return res.status(500).json({ error: 'Player service failed' });
  }
}
