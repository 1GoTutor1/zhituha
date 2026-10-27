// api/bot.js
import crypto from 'crypto';
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

const mainMenuKeyboard = async (tgId, appUrl = WEBAPP_URL) => {
  const admin = await isAdmin(tgId);
  const rows = [
    [{ text: '🎮 Играть в Житуху', web_app: { url: appUrl } }],
    [{ text: '💰 Баланс', callback_data: 'btn_balance' }, { text: '🏢 Бизнесы', callback_data: 'btn_biz' }],
    [{ text: '🏆 Топ богачей', callback_data: 'btn_top' }],
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
  const { data: player } = await supabase.from('players').select('*').eq('telegram_id', tgId).maybeSingle();
  if (!player) return replyOrEdit(ctx, '❌ Ты еще не зарегистрирован в игре! Нажми /start и создай персонажа.', { reply_markup: backKeyboard() });

  const maxEnergy = player.has_house ? 150 : 100;
  const text = `💳 *Твой профиль:*\n\n` +
    `💰 Баланс: *${Number(player.money).toLocaleString('ru-RU')}* монет\n` +
    `⚡ Энергия: *${player.energy}/${maxEnergy}*\n` +
    `💵 Чаевые: *${player.tip_balance || 0}*\n` +
    `🚗 Машина: *${player.has_car ? (player.car_model === 'lada' ? 'Лада' : 'Тойота') : 'Нет'}*\n` +
    `🏠 Жилье: *${player.has_house ? 'Квартира' : 'Нет'}*`;

  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
};

const getTop = async (ctx) => {
  const { data: top } = await supabase.from('players').select('nickname, money').order('money', { ascending: false }).limit(5);
  if (!top) return replyOrEdit(ctx, 'Ошибка получения топа.', { reply_markup: backKeyboard() });

  let text = `🏆 *Топ-5 богачей района:*\n\n`;
  top.forEach((p, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
    text += `${emoji} ${p.nickname} — *${Number(p.money).toLocaleString('ru-RU')}* монет\n`;
  });
  await replyOrEdit(ctx, text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
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
      text += `🚗 *${b.business_name}*:\n   Склад: Лада (${s.lada || 0}), Тойота (${s.toyota || 0})\n`;
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
bot.command('top', getTop);
bot.command(['biz', 'business'], getBiz);

bot.action('btn_balance', getBalance);
bot.action('btn_top', getTop);
bot.action('btn_biz', getBiz);

bot.on('pre_checkout_query', async (ctx) => {
  const query = ctx.preCheckoutQuery;
  try {
    const { data: order, error } = await supabase.from('donation_orders')
      .select('id, telegram_id, stars_amount, status')
      .eq('id', query.invoice_payload).maybeSingle();
    const valid = !error && order && order.status === 'pending'
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
    if (!data?.duplicate) await ctx.reply('Оплата прошла! Донат-жетоны начислены на аккаунт. Возвращайся в игру.');
  } catch (error) {
    console.error('Stars payment delivery failed:', error?.message || error);
    await ctx.reply('Платёж получен, но начисление задержалось. Напиши администратору и сохрани этот чек.');
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
bot.action('btn_admin', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) {
    return ctx.answerCbQuery('⛔ Нет доступа', { show_alert: true });
  }
  const text = `⚙️ *Админ-панель*\n\n` +
    `Доступные команды:\n\n` +
    `📊 \`/stats\` — статистика сервера\n` +
    `💰 \`/give <id> <сумма>\` — выдать/забрать деньги\n` +
    `📢 \`/broadcast <текст>\` — рассылка всем`;

  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
  } catch (e) {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: backKeyboard() });
  }
  await ctx.answerCbQuery();
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
    { command: 'balance', description: '💰 Мой баланс и энергия' },
    { command: 'biz', description: '🏢 Мои бизнесы и таймеры' },
    { command: 'top', description: '🏆 Топ-5 богачей района' },
    { command: 'stats', description: '📊 Статистика сервера (Админ)' },
  ]);
};
setupCommands().catch(console.error);

// --- ОБРАБОТЧИК ---
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
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
