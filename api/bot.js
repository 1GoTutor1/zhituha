// api/bot.js
import { Telegraf } from 'telegraf';

import { createClient } from '@supabase/supabase-js';

// Инициализация Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://zhituha-ashen.vercel.app'; 

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const formatTime = (ms) => {
  if (ms <= 0) return 'готово';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}м ${secs}с`;
};

// --- КОМАНДЫ БОТА ---

// 1. Старт
bot.start((ctx) => {
  const startPayload = ctx.startPayload; 
  const appUrl = startPayload ? `${WEBAPP_URL}?start_param=${startPayload}` : WEBAPP_URL;

  ctx.reply(`Привет, ${ctx.from.first_name}! 👋\n\nДобро пожаловать в «Житуху»! Жми кнопку ниже, чтобы начать! 👇`, {
    reply_markup: {
      inline_keyboard: [[{ text: '🎮 Играть в Житуху', web_app: { url: appUrl } }]]
    }
  });
});

// 2. Баланс (/bal)
bot.command(['balance', 'bal'], async (ctx) => {
  const tgId = ctx.from.id.toString();
  const { data: player } = await supabase.from('players').select('*').eq('telegram_id', tgId).maybeSingle();

  if (!player) return ctx.reply('❌ Ты еще не зарегистрирован в игре! Нажми /start и создай персонажа.');

  ctx.reply(`💳 **Твой профиль:**\n\n💰 Баланс: **${player.money.toLocaleString('ru-RU')}** монет\n⚡ Энергия: **${player.energy}/100**\n🚗 Машина: **${player.has_car ? (player.car_model === 'lada' ? 'Лада' : 'Тойота') : 'Нет'}**\n🏠 Жилье: **${player.has_house ? 'Квартира' : 'Нет'}**`, { parse_mode: 'Markdown' });
});

// 3. Топ игроков (/top)
bot.command('top', async (ctx) => {
  const { data: top } = await supabase.from('players').select('nickname, money').order('money', { ascending: false }).limit(5);

  if (!top) return ctx.reply('Ошибка получения топа.');

  let text = `🏆 **Топ-5 богачей района:**\n\n`;
  top.forEach((p, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
    text += `${emoji} ${p.nickname} — **${p.money.toLocaleString('ru-RU')}** монет\n`;
  });

  ctx.reply(text, { parse_mode: 'Markdown' });
});

// 4. Мои бизнесы (/biz)
bot.command(['biz', 'business'], async (ctx) => {
  const tgId = ctx.from.id.toString();
  const { data: player } = await supabase.from('players').select('id').eq('telegram_id', tgId).maybeSingle();
  if (!player) return ctx.reply('❌ Ты еще не зарегистрирован в игре!');

  const { data: bizs } = await supabase.from('businesses').select('*').eq('owner_id', player.id);

  if (!bizs || bizs.length === 0) return ctx.reply('🏚 У тебя пока нет бизнесов. Открой первый в игре!');

  let text = `🏢 **Твои бизнесы:**\n\n`;
  const now = Date.now();

  bizs.forEach(b => {
    if (b.biz_type === 'coffee') {
      text += `☕ **${b.business_name}**:\n   Касса: **${b.coffee_balance || 0}** монет\n`;
    } else if (b.biz_type === 'salon') {
      text += `🚗 **${b.business_name}**:\n   Склад: Лада (${b.stock?.lada || 0}), Тойота (${b.stock?.toyota || 0})\n`;
      if (b.car_order_end > now) text += `   🚚 В пути: ${formatTime(b.car_order_end - now)}\n`;
    } else if (b.biz_type === 'construction') {
      text += `🏗 **${b.business_name}**:\n   Склад квартир: **${b.stock?.apartments || 0}**\n`;
      if (b.build_end > now) text += `   🏗 Строится: ${formatTime(b.build_end - now)}\n`;
    } else if (b.biz_type === 'taxi') {
      text += `🚕 **${b.business_name}**:\n   Машин в парке: **${b.stock?.taxi_cars?.length || 0}**\n`;
    } else if (b.biz_type === 'phone_factory') {
      text += `📱 **${b.business_name}**:\n   Склад: Кнопочные (${b.stock?.button || 0}), Смартфоны (${b.stock?.smartphone || 0})\n`;
      if (b.build_end > now) text += `   🏭 Производство: ${formatTime(b.build_end - now)}\n`;
    }
    text += `\n`;
  });

  ctx.reply(text, { parse_mode: 'Markdown' });
});

// --- АДМИНСКИЕ КОМАНДЫ ---

const isAdmin = async (tgId) => {
  const { data } = await supabase.from('players').select('role').eq('telegram_id', tgId.toString()).maybeSingle();
  return data?.role === 'superadmin' || data?.role === 'admin';
};

// 5. Статы (/stats)
bot.command('stats', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');

  ctx.reply('⏳ Собираю статистику...');

  const { count: playersCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { data: allMoney } = await supabase.from('players').select('money');
  const totalMoney = allMoney?.reduce((acc, curr) => acc + (Number(curr.money) || 0), 0) || 0;

  const { count: coffeeCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('biz_type', 'coffee');
  const { count: salonCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('biz_type', 'salon');
  const { count: constrCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('biz_type', 'construction');
  const { count: taxiCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('biz_type', 'taxi');
  const { count: factoryCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('biz_type', 'phone_factory');
  const { count: marketCount } = await supabase.from('market_items').select('*', { count: 'exact', head: true });

  ctx.reply(`📊 **СТАТИСТИКА СЕРВЕРА:**\n\n👥 Игроков: **${playersCount}**\n💰 Общий объем денег: **${totalMoney.toLocaleString('ru-RU')}**\n\n🏢 **Бизнесы:**\n☕ Кофейни: ${coffeeCount}\n🚗 Автосалоны: ${salonCount}\n🏗 Стройтресты: ${constrCount}\n🚕 Таксопарки: ${taxiCount}\n📱 Телефонные цеха: ${factoryCount}\n\n🛒 Лотов на рынке: **${marketCount}**`, { parse_mode: 'Markdown' });
});

// 6. Выдать деньги (/give ID СУММА)
bot.command('give', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.reply('⛔ Отказано в доступе.');
  
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('⚠️ Использование: `/give 123456789 50000`', { parse_mode: 'Markdown' });

  const targetTgId = args[0];
  const amount = parseInt(args[1]);

  if (isNaN(amount)) return ctx.reply('⚠️ Сумма должна быть числом.');

  const { data: targetPlayer } = await supabase.from('players').select('id, money, nickname').eq('telegram_id', targetTgId).maybeSingle();
  if (!targetPlayer) return ctx.reply('❌ Игрок с таким ID не найден.');

  const newMoney = Math.max(0, targetPlayer.money + amount);
  await supabase.from('players').update({ money: newMoney }).eq('id', targetPlayer.id);

  ctx.reply(`✅ Игроку **${targetPlayer.nickname}** выдано/забрано **${amount.toLocaleString('ru-RU')}** монет. Новый баланс: ${newMoney.toLocaleString('ru-RU')}`, { parse_mode: 'Markdown' });
});

// 7. Рассылка (/broadcast ТЕКСТ)
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
      await ctx.telegram.sendMessage(p.telegram_id, `📢 **Сообщение от Администрации:**\n\n${text}`, { parse_mode: 'Markdown' });
      success++;
      // Задержка, чтобы Телеграм не забанил бота за спам
      await new Promise(r => setTimeout(r, 50)); 
    } catch (e) {
      console.log(`Не смог отправить игроку ${p.telegram_id}`);
    }
  }

  ctx.reply(`✅ Рассылка завершена! Отправлено ${success} из ${allPlayers.length}.`);
});

// --- ОБРАБОТКА ЗАПРОСОВ ---
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('Бот работает и ждет сообщений от Telegram!');
  }

  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка в вебхуке:', err);
    res.status(500).send('Error');
  }
}