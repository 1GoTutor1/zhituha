// api/bot.js
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const bot = new Telegraf(process.env.BOT_TOKEN || '');
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://zhituha-ashen.vercel.app';

// --- ЗАЩИТА ВЕБХУКА: секретный токен (задаётся при setWebhook) ---
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // задай в Vercel env, например длинную случайную строку

// --- ХЕЛПЕРЫ ---
const formatTime = (ms) => {
  if (ms <= 0) return 'готово';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}м ${secs}с`;
};
const escapeMarkdown = (value) => String(value ?? '').replace(/([_*\[\]\x60])/g, '\\$1');

const getStockSafe = (biz) => {
  if (!biz || !biz.stock) return {};
  try { return typeof biz.stock === 'string' ? JSON.parse(biz.stock) : biz.stock; }
  catch { return {}; }
};

const isAdmin = async (tgId) => {
  const { data } = await supabase.from('players').select('role').eq('telegram_id', tgId.toString()).maybeSingle();
  return data?.role === 'superadmin' || data?.role === 'admin';
};

const backKeyboard = () => ({ inline_keyboard: [[{ text: '← Назад', callback_data: 'btn_back' }]] });
const adminKeyboard = () => ({ inline_keyboard: [
  [{ text: '\uD83D\uDCE5 \u0411\u0430\u0433-\u0440\u0435\u043f\u043e\u0440\u0442\u044b', callback_data: 'btn_bug_reports' }],
  [{ text: '✉️ Написать игроку', callback_data: 'btn_admin_dm' }],
  [{ text: '← Назад', callback_data: 'btn_back' }],
] });

const showBugReports = async (ctx, page = 0) => {
  if (!(await isAdmin(ctx.from.id))) {
    if (ctx.callbackQuery) return ctx.answerCbQuery('\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430', { show_alert: true });
    return ctx.reply('\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430.');
  }

  const { count, error: countError } = await supabase.from('bug_reports')
    .select('id', { count: 'exact', head: true }).eq('status', 'open');
  const total = count || 0;
  const safePage = total ? Math.min(page, total - 1) : 0;
  const { data: reports, error } = await supabase.from('bug_reports')
    .select('id, player_name, telegram_id, message, created_at')
    .eq('status', 'open').order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(safePage, safePage);

  let text;
  let keyboard;
  if (error || countError) {
    console.error('Bug report inbox query failed:', error?.message || countError?.message);
    text = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0431\u0430\u0433-\u0440\u0435\u043f\u043e\u0440\u0442\u044b. \u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u044e BUG_REPORT_INBOX_MIGRATION.sql.';
    keyboard = adminKeyboard();
  } else {
    const report = reports?.[0];
    if (!report) {
      text = `\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0431\u0430\u0433-\u0440\u0435\u043f\u043e\u0440\u0442\u044b\n\u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0445: ${total}\n\n\u041d\u043e\u0432\u044b\u0445 \u043e\u0442\u043a\u0440\u044b\u0442\u044b\u0445 \u0440\u0435\u043f\u043e\u0440\u0442\u043e\u0432 \u043d\u0435\u0442.`;
      keyboard = adminKeyboard();
    } else {
      const date = new Date(report.created_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
      text = `\u0411\u0430\u0433-\u0440\u0435\u043f\u043e\u0440\u0442 #${report.id} · ${safePage + 1}/${total}\n${date}\n\u0418\u0433\u0440\u043e\u043a: ${report.player_name} (TG ${report.telegram_id})\n\n${report.message}`;
      const nav = [];
      if (safePage > 0) nav.push({ text: '\u2190 \u041d\u043e\u0432\u0435\u0435', callback_data: `btn_bug_reports_${safePage - 1}` });
      if (safePage < total - 1) nav.push({ text: '\u0421\u0442\u0430\u0440\u0435\u0435 \u2192', callback_data: `btn_bug_reports_${safePage + 1}` });
      const rows = [[{ text: `\u2705 \u0417\u0430\u043a\u0440\u044b\u0442\u044c #${report.id}`, callback_data: `bug_resolve_${report.id}_${safePage}` }]];
      if (nav.length) rows.push(nav);
      rows.push([{ text: '\u0412 \u0430\u0434\u043c\u0438\u043d-\u043c\u0435\u043d\u044e', callback_data: 'btn_admin' }]);
      keyboard = { inline_keyboard: rows };
    }
  }

  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { reply_markup: keyboard }); }
    catch { await ctx.reply(text, { reply_markup: keyboard }); }
    return ctx.answerCbQuery();
  }
  return ctx.reply(text, { reply_markup: keyboard });
};

const topKeyboard = (active = 'money') => ({ inline_keyboard: [
  [
    { text: `${active === 'money' ? '\u2713 ' : ''}\u0422\u043e\u043f \u043f\u043e \u0434\u0435\u043d\u044c\u0433\u0430\u043c`, callback_data: 'btn_top' },
    { text: `${active === 'level' ? '\u2713 ' : ''}\u0422\u043e\u043f \u043f\u043e \u0443\u0440\u043e\u0432\u043d\u044e`, callback_data: 'btn_top_level' },
  ],
  [{ text: '\u041d\u0430\u0437\u0430\u0434', callback_data: 'btn_back' }],
] });

const mainMenuKeyboard = async (tgId, appUrl = WEBAPP_URL) => {
  const admin = await isAdmin(tgId);
  const rows = [
    [{ text: '🎮 Играть в Житуху', web_app: { url: appUrl } }],
    [{ text: '💰 Баланс', callback_data: 'btn_balance' }, { text: '🏢 Бизнесы', callback_data: 'btn_biz' }],
    [{ text: '📈 Прогресс', callback_data: 'btn_progress' }],
    [{ text: '\uD83C\uDFC6 \u0422\u043e\u043f \u043f\u043e \u0434\u0435\u043d\u044c\u0433\u0430\u043c', callback_data: 'btn_top' }, { text: '\u2B50 \u0422\u043e\u043f \u043f\u043e \u0443\u0440\u043e\u0432\u043d\u044e', callback_data: 'btn_top_level' }],
  ];
  if (admin) rows.push([{ text: '⚙️ Админка', callback_data: 'btn_admin' }]);
  return { inline_keyboard: rows };
};

const replyOrEdit = async (ctx, text, extra = {}) => {
  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(text, extra); }
    catch (e) { await ctx.reply(text, extra); }
    await ctx.answerCbQuery();
  } else {
    await ctx.reply(text, extra);
  }
};

// --- КОМАНДЫ / ЭКРАНЫ ---
const getBalance = async (ctx) => {
  const tgId = ctx.from.id.toString();
  const { data: player, error } = await supabase.from('players')
    .select('nickname, money, has_house, house_type, has_car, phone_count, daily_streak, referral_balance, tip_balance, premium_balance, profile_frame, profile_background')
    .eq('telegram_id', tgId).maybeSingle();
  if (error) {
    console.error('Bot profile query failed:', error.message);
    return replyOrEdit(ctx, 'Не удалось загрузить профиль. Попробуй ещё раз позже.', { reply_markup: backKeyboard() });
  }
  if (!player) return replyOrEdit(ctx, '❌ Ты еще не зарегистрирован в игре! Нажми /start и создай персонажа.', { reply_markup: backKeyboard() });

  const text = `👤 *${escapeMarkdown(player.nickname || 'Профиль игрока')}*\n\n` +
    `💰 Баланс: *${Number(player.money).toLocaleString('ru-RU')}* монет\n` +
    `💵 Чаевые: *${player.tip_balance || 0}*\n` +
    `🪙 Жетоны: *${player.premium_balance || 0}*\n` +
    `📅 Серия ежедневных наград: *${player.daily_streak || 0}* дн.\n` +
    `👥 Реферальный баланс: *${player.referral_balance || 0}*\n` +
    `🚗 Машина: *${player.has_car ? (player.car_model === 'lada' ? 'Ока' : 'Тойота') : 'Нет'}*\n` +
    `🏠 Жильё: *${player.has_house ? (player.house_type || 'Квартира') : 'Нет'}*\n` +
    `📱 Телефоны: *${player.phone_count || 0}*` +
    (player.profile_frame ? `\n🖼 Рамка: *${player.profile_frame}*` : '') +
    (player.profile_background ? `\n🎨 Фон: *${player.profile_background}*` : '');

  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
};

const getProgress = async (ctx) => {
  const tgId = String(ctx.from.id);
  const { data: player, error: playerError } = await supabase.from('players')
    .select('id, nickname, daily_streak, phone_count')
    .eq('telegram_id', tgId).maybeSingle();
  if (playerError) {
    console.error('Bot progress query failed:', playerError.message);
    return replyOrEdit(ctx, 'Не удалось загрузить прогресс. Попробуй ещё раз позже.', { reply_markup: backKeyboard() });
  }
  if (!player) return replyOrEdit(ctx, '❌ Сначала создай персонажа в игре через /start.', { reply_markup: backKeyboard() });

  const [bizResult, referralResult] = await Promise.all([
    supabase.from('businesses').select('biz_type, business_name, build_end, car_order_end, passive_level').eq('owner_id', player.id),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('referred_by', tgId),
  ]);
  if (bizResult.error || referralResult.error) {
    console.error('Bot progress details query failed:', bizResult.error?.message || referralResult.error?.message);
    return replyOrEdit(ctx, 'Не удалось загрузить прогресс. Попробуй ещё раз позже.', { reply_markup: backKeyboard() });
  }

  const now = Date.now();
  const activeTimers = (bizResult.data || []).flatMap((biz) => {
    const timers = [];
    const buildEnd = Number(biz.build_end);
    const orderEnd = Number(biz.car_order_end);
    if (Number.isFinite(buildEnd) && buildEnd > now) {
      const label = biz.biz_type === 'phone_factory' ? 'производство телефонов' : 'стройка';
      timers.push(`🏗 ${escapeMarkdown(biz.business_name)}: ${label} — ${formatTime(buildEnd - now)}`);
    }
    if (Number.isFinite(orderEnd) && orderEnd > now) timers.push(`🚘 ${escapeMarkdown(biz.business_name)}: заказ авто — ${formatTime(orderEnd - now)}`);
    return timers;
  });
  const bizLines = (bizResult.data || []).map((biz) => {
    const level = Number(biz.passive_level ?? -1);
    return `• ${escapeMarkdown(biz.business_name)} (пассивный доход: ${level < 0 ? 'не открыт' : `ур. ${level}`})`;
  });
  const lines = [
    `📈 *Прогресс ${escapeMarkdown(player.nickname || 'игрока')}*`,
    '',
    `📅 Серия ежедневных наград: *${player.daily_streak || 0} дн.*`,
    `👥 Приглашено игроков: *${referralResult.count || 0}*`,
    `🏢 Бизнесов: *${bizLines.length}*`,
    `📱 Телефонов: *${player.phone_count || 0}*`,
    '',
    bizLines.length ? `*Твои бизнесы:*\n${bizLines.join('\n')}` : '🏚 Пока нет бизнеса. Открой игру, чтобы начать.',
    activeTimers.length ? `\n\n*Активные таймеры:*\n${activeTimers.join('\n')}` : '',
  ].filter(Boolean);
  await replyOrEdit(ctx, lines.join('\n'), { parse_mode: 'Markdown', reply_markup: backKeyboard() });
};

const getTop = async (ctx) => {
  const { data: top } = await supabase.from('players').select('nickname, money').order('money', { ascending: false }).limit(5);
  if (!top) return replyOrEdit(ctx, 'Ошибка получения топа.', { reply_markup: topKeyboard('money') });

  let text = `🏆 *Топ-5 богачей района:*\n\n`;
  top.forEach((p, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
    text += `${emoji} ${escapeMarkdown(p.nickname || 'Игрок')} — *${Number(p.money).toLocaleString('ru-RU')}* монет\n`;
  });
  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: topKeyboard('money') });
};

const getLevelTop = async (ctx) => {
  const { data: top, error } = await supabase.from('players')
    .select('nickname, player_level, player_xp')
    .order('player_level', { ascending: false })
    .order('player_xp', { ascending: false })
    .limit(5);
  if (error || !top) {
    console.error('Level leaderboard query failed:', error?.message);
    return replyOrEdit(ctx, 'Не удалось загрузить рейтинг уровней. Проверь миграцию профессий.', { reply_markup: topKeyboard('level') });
  }
  let text = '\u2B50 *\u0422\u043e\u043f-5 \u043f\u043e \u0443\u0440\u043e\u0432\u043d\u044e*\n\n';
  top.forEach((player, index) => {
    const medal = index === 0 ? '\uD83E\uDD47' : index === 1 ? '\uD83E\uDD48' : index === 2 ? '\uD83E\uDD49' : '\uD83D\uDC64';
    const level = Math.max(1, Number(player.player_level) || 1);
    const xp = Math.max(0, Number(player.player_xp) || 0);
    text += `${medal} ${escapeMarkdown(player.nickname || 'Игрок')} - *ур. ${level}* | ${xp.toLocaleString('ru-RU')} XP\n`;
  });
  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: topKeyboard('level') });
};

const getBiz = async (ctx) => {
  const tgId = ctx.from.id.toString();
  const { data: player } = await supabase.from('players').select('id').eq('telegram_id', tgId).maybeSingle();
  if (!player) return replyOrEdit(ctx, '❌ Ты еще не зарегистрирован в игре!', { reply_markup: backKeyboard() });

  const { data: bizs } = await supabase.from('businesses').select('*').eq('owner_id', player.id);
  if (!bizs || bizs.length === 0) return replyOrEdit(ctx, '🏚 У тебя пока нет бизнесов. Открой первый в игре!', { reply_markup: backKeyboard() });

  let text = `🏢 *Твои бизнесы:*\n\n`;
  const now = Date.now();

  bizs.forEach(b => {
    const s = getStockSafe(b);
    if (b.biz_type === 'coffee') text += `☕ *${b.business_name}*:\n   Касса: *${b.coffee_balance || 0}* монет\n`;
    else if (b.biz_type === 'salon') {
      const models = { lada: 'Ока', matiz: 'Matiz', vaz_2107: 'ВАЗ-2107', renault_logan: 'Logan', volkswagen_polo: 'Polo', ford_focus: 'Focus', toyota: 'Corolla', skoda_octavia: 'Octavia', kia_optima: 'Optima', bmw_3: 'BMW 3', bmw_5: 'BMW 5', mercedes_e: 'Mercedes E', lexus_es: 'Lexus ES', porsche_panamera: 'Panamera', range_rover: 'Range Rover' };
      const stock = Object.entries(models).filter(([id]) => Number(s[id]) > 0).map(([id, name]) => `${name} (${Number(s[id])})`).join(', ') || 'пусто';
      text += `🚗 *${b.business_name}*:\n   Склад: ${stock}\n`;
      if (b.car_order_end > now) text += `   🚚 В пути: ${formatTime(b.car_order_end - now)}\n`;
    } else if (b.biz_type === 'construction') {
      text += `🏗 *${b.business_name}*:\n   Склад квартир: *${s.apartments || 0}*\n`;
      if (b.build_end > now) text += `   🏗 Строится: ${formatTime(b.build_end - now)}\n`;
    } else if (b.biz_type === 'taxi') {
      text += `🚕 *${b.business_name}*:\n   Машин в парке: *${s.taxi_cars?.length || 0}*\n`;
    } else if (b.biz_type === 'phone_factory') {
      text += `📱 *${b.business_name}*:\n   Склад: Кнопочные (${s.button || 0}), Смартфоны (${s.smartphone || 0})\n`;
      if (b.build_end > now) text += `   🏭 Производство: ${formatTime(b.build_end - now)}\n`;
    }
    text += `\n`;
  });
  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
};

// --- СТАРТ / МЕНЮ ---
bot.start(async (ctx) => {
  const startPayload = ctx.startPayload;
  const appUrl = startPayload ? `${WEBAPP_URL}?start_param=${startPayload}` : WEBAPP_URL;
  const keyboard = await mainMenuKeyboard(ctx.from.id, appUrl);

  await ctx.reply(`Привет, ${ctx.from.first_name}! 👋\n\nДобро пожаловать в «Житуху»! Выбери действие:`, {
    reply_markup: keyboard
  });
});

bot.command(['balance', 'bal'], getBalance);
bot.command('profile', getBalance);
bot.command('progress', getProgress);
bot.command('top', getTop);
bot.command(['toplevel', 'leveltop'], getLevelTop);
bot.command(['biz', 'business'], getBiz);

// --- ЛИЧНОЕ СООБЩЕНИЕ ИГРОКУ (только администраторы) ---
bot.command(['dm', 'message'], async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');

  const commandText = String(ctx.message?.text || '').replace(/^\/(?:dm|message)(?:@\w+)?\s*/i, '');
  const match = commandText.match(/^(\d{5,20})\s+([\s\S]*\S)\s*$/);
  if (!match) {
    return ctx.reply('Формат: /dm <Telegram ID> <сообщение>\nНапример: /dm 123456789 Привет!');
  }

  const [, targetTgId, message] = match;
  if (message.length > 3800) return ctx.reply('Сообщение слишком длинное: максимум 3 800 символов.');

  const { data: target, error } = await supabase.from('players')
    .select('telegram_id, nickname')
    .eq('telegram_id', targetTgId)
    .maybeSingle();
  if (error) {
    console.error('Bot direct-message lookup failed:', error.message);
    return ctx.reply('Не удалось найти игрока. Попробуй позже.');
  }
  if (!target) return ctx.reply('Игрок с таким Telegram ID не найден.');

  try {
    await ctx.telegram.sendMessage(String(target.telegram_id), `📩 Личное сообщение\n\n${message}`, {
      disable_web_page_preview: true,
    });
    return ctx.reply(`✅ Личное сообщение отправлено игроку ${target.nickname || targetTgId}.`);
  } catch (sendError) {
    console.error('Bot direct-message delivery failed:', sendError?.response?.description || sendError?.message || sendError);
    return ctx.reply('Не удалось доставить сообщение. Возможно, игрок ещё не запускал бота или запретил ему писать.');
  }
});

bot.action('btn_balance', getBalance);
bot.action('btn_progress', getProgress);
bot.action('btn_top', getTop);
bot.action('btn_top_level', getLevelTop);
bot.action('btn_biz', getBiz);

bot.on('pre_checkout_query', async (ctx) => {
  const query = ctx.preCheckoutQuery;
  try {
    const { data: order, error } = await supabase.from('donation_orders')
      .select('id, telegram_id, stars_amount, status')
      .eq('id', query.invoice_payload).maybeSingle();
    // Closed invoice orders are released for a replacement invoice, but the
    // original Telegram link can still be paid, so keep it payable and idempotent.
    const valid = !error && order && ['pending', 'failed'].includes(order.status)
      && order.telegram_id === String(ctx.from.id)
      && query.currency === 'XTR' && Number(query.total_amount) === Number(order.stars_amount);
    await ctx.answerPreCheckoutQuery(Boolean(valid), valid ? undefined : 'Заказ не найден или сумма не совпадает. Создай новый счёт.');
  } catch (error) {
    console.error('Stars pre-checkout validation failed:', error?.message || error);
    await ctx.answerPreCheckoutQuery(false, 'Не удалось проверить заказ. Попробуй позже.');
  }
});

bot.on('message', async (ctx, next) => {
  const payment = ctx.message?.successful_payment;
  if (!payment) return next();
  try {
    if (payment.currency !== 'XTR') throw new Error('Unexpected Stars currency');
    const { data, error } = await supabase.rpc('apply_stars_payment_rpc', {
      p_order_id: payment.invoice_payload,
      p_telegram_id: String(ctx.from.id),
      p_charge_id: payment.telegram_payment_charge_id,
      p_stars_amount: Number(payment.total_amount),
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.ok === true && data.duplicate !== true && process.env.ADMIN_TG_ID) {
      try {
        const { data: order, error: orderError } = await supabase.from('donation_orders')
          .select('id, player_id, credits_amount')
          .eq('id', payment.invoice_payload)
          .maybeSingle();
        if (orderError) throw orderError;
        const { data: donor, error: donorError } = await supabase.from('players')
          .select('nickname')
          .eq('id', order?.player_id)
          .maybeSingle();
        if (donorError) throw donorError;
        const payerName = donor?.nickname || [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Без ника';
        const username = ctx.from.username ? ` (@${ctx.from.username})` : '';
        const notice = [
          '💸 Новый донат в Житухе',
          `Игрок: ${payerName}${username}`,
          `Telegram ID: ${ctx.from.id}`,
          `Оплачено: ⭐ ${Number(payment.total_amount).toLocaleString('ru-RU')}`,
          `Начислено жетонов: ${Number(order?.credits_amount || 0).toLocaleString('ru-RU')}`,
          `Заказ: ${payment.invoice_payload}`,
        ].join('\n');
        await ctx.telegram.sendMessage(String(process.env.ADMIN_TG_ID), notice, { disable_web_page_preview: true });
      } catch (notifyError) {
        // Don't make Telegram retry an already credited payment just because the admin DM failed.
        console.error('Donation admin notification failed:', notifyError?.response?.description || notifyError?.message || notifyError);
      }
    }
    await ctx.reply('Оплата подтверждена! Донат-жетоны зачислены на аккаунт. Возвращайся в игру.');
  } catch (error) {
    console.error('Stars payment delivery failed:', error?.message || error);
    try {
      await ctx.reply('Платёж получен, но начисление пока не подтверждено. Сохрани чек; бот повторит обработку, а если жетоны не появятся — напиши администратору.');
    } catch (replyError) {
      console.error('Stars payment failure notice failed:', replyError?.message || replyError);
    }
    // Пусть webhook ответит Telegram ошибкой: он повторит update, а RPC безопасно
    // вернёт duplicate, если успел начислить жетоны до временного сбоя.
    throw error;
  }
});

// --- КНОПКА НАЗАД ---
bot.action('btn_back', async (ctx) => {
  const keyboard = await mainMenuKeyboard(ctx.from.id);
  try {
    await ctx.editMessageText('Главное меню:', { reply_markup: keyboard });
  } catch (e) {
    await ctx.reply('Главное меню:', { reply_markup: keyboard });
  }
  await ctx.answerCbQuery();
});

// --- АДМИНКА ---
bot.command('reports', async (ctx) => showBugReports(ctx, 0));

bot.action(/^btn_bug_reports(?:_(\d+))?$/, async (ctx) => {
  await showBugReports(ctx, Number(ctx.match?.[1] || 0));
});

bot.action(/^bug_resolve_(\d+)_(\d+)$/, async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.answerCbQuery('\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430', { show_alert: true });
  const [, rawId, rawPage] = ctx.match;
  const { error } = await supabase.from('bug_reports').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: String(ctx.from.id),
  }).eq('id', Number(rawId)).eq('status', 'open');
  if (error) {
    console.error('Bug report resolve failed:', error.message);
    await ctx.answerCbQuery('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043a\u0440\u044b\u0442\u044c', { show_alert: true });
    return;
  }
  await showBugReports(ctx, Number(rawPage));
});

bot.action('btn_admin', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) {
    return ctx.answerCbQuery('⛔ Нет доступа', { show_alert: true });
  }
  const text = `⚙️ *Админ-панель*\n\n` +
    `Доступные команды:\n\n` +
    `📊 \`/stats\` — статистика сервера\n` +
    `💰 \`/give <id> <сумма>\` — выдать/забрать деньги\n` +
    `✉️ \`/dm <id> <текст>\` — написать игроку лично\n` +
    `📢 \`/broadcast <текст>\` — рассылка всем`;

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: adminKeyboard() });
  } catch (e) {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: adminKeyboard() });
  }
  await ctx.answerCbQuery();
});

bot.action('btn_admin_dm', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) {
    return ctx.answerCbQuery('⛔ Нет доступа', { show_alert: true });
  }
  await ctx.answerCbQuery();
  await ctx.reply('✉️ Чтобы написать игроку, отправь команду:\n/dm <Telegram ID> <сообщение>\n\nНапример:\n/dm 123456789 Привет!');
});

// --- СТАТИСТИКА ---
bot.command('stats', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');
  ctx.reply('⏳ Собираю статистику...');

  const { count: playersCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { data: allMoney } = await supabase.from('players').select('money');
  const totalMoney = allMoney?.reduce((acc, curr) => acc + (Number(curr.money) || 0), 0) || 0;
  const { count: marketCount } = await supabase.from('market_items').select('*', { count: 'exact', head: true });

  ctx.reply(`📊 *СТАТИСТИКА СЕРВЕРА:*\n\n👥 Игроков: *${playersCount}*\n💰 Общий объем денег: *${totalMoney.toLocaleString('ru-RU')}*\n🛒 Лотов на рынке: *${marketCount}*`, { parse_mode: 'Markdown' });
});

// --- ВЫДАТЬ ДЕНЬГИ ---
bot.command('give', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('⚠️ Использование: `/give 123456789 50000`', { parse_mode: 'Markdown' });

  const targetTgId = args[0];
  const amount = parseInt(args[1]);
  if (isNaN(amount)) return ctx.reply('⚠️ Сумма должна быть числом.');

  const { data: targetPlayer } = await supabase.from('players').select('id, nickname').eq('telegram_id', targetTgId).maybeSingle();
  if (!targetPlayer) return ctx.reply('❌ Игрок с таким ID не найден.');

  const { data, error } = await supabase.rpc('change_stats', {
    p_player_id: targetPlayer.id,
    p_money_diff: amount,
    p_energy_diff: 0
  });
  if (error) return ctx.reply('❌ Ошибка: ' + error.message);
  if (data && data.error) return ctx.reply('❌ ' + data.error);

  ctx.reply(`✅ Игроку *${targetPlayer.nickname}* выдано/забрано *${amount.toLocaleString('ru-RU')}* монет. Баланс: *${Number(data.money).toLocaleString('ru-RU')}*`, { parse_mode: 'Markdown' });
});

// --- РАССЫЛКА ---
bot.command('broadcast', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text) return ctx.reply('⚠️ Использование: `/broadcast Привет всем!`', { parse_mode: 'Markdown' });

  const { data: allPlayers } = await supabase.from('players').select('telegram_id');
  if (!allPlayers) return;

  ctx.reply(`⏳ Начинаю рассылку для ${allPlayers.length} игроков...`);
  let success = 0;
  for (const p of allPlayers) {
    try {
      await ctx.telegram.sendMessage(p.telegram_id, `📢 *Сообщение от Администрации:*\n\n${text}`, { parse_mode: 'Markdown' });
      success++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {}
  }
  ctx.reply(`✅ Рассылка завершена! Отправлено ${success} из ${allPlayers.length}.`);
});

// --- КОМАНДЫ В МЕНЮ TELEGRAM ---
const setupCommands = async () => {
  await bot.telegram.setMyCommands([
    { command: 'balance', description: '\u041c\u043e\u0439 \u0431\u0430\u043b\u0430\u043d\u0441 \u0438 \u043f\u0440\u043e\u0444\u0438\u043b\u044c' },
    { command: 'profile', description: '👤 Профиль, активы и жетоны' },
    { command: 'progress', description: '📈 Прогресс, приглашения и таймеры' },
    { command: 'biz', description: '🏢 Мои бизнесы и таймеры' },
    { command: 'top', description: '🏆 Топ-5 богачей района' },
    { command: 'stats', description: '📊 Статистика сервера (Админ)' },
    { command: 'dm', description: '✉️ Личное сообщение игроку (Админ)' },
  ]);
};
setupCommands().catch(console.error);

// --- ОБРАБОТЧИК ---
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
  throw err;
});

export default async function handler(req, res) {
  if (!process.env.BOT_TOKEN || !supabase || !WEBHOOK_SECRET) return res.status(500).json({ error: 'Bot webhook is not configured' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. Секретный заголовок вебхука (защита от произвольных POST-запросов на URL).
  //    Устанавливается при регистрации вебхука: setWebhook(url, { secret_token: WEBHOOK_SECRET })
  if (req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка в вебхуке:', err);
    res.status(500).send('Error');
  }
}
