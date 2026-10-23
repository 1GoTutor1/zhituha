// api/bot.js
import { Telegraf } from 'telegraf';

// Проверяем токен
const bot = new Telegraf(process.env.BOT_TOKEN || '123456:FAKE');
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://zhituha-ashen.vercel.app'; 

bot.start((ctx) => {
  const startPayload = ctx.startPayload; 
  const appUrl = startPayload 
    ? `${WEBAPP_URL}?start_param=${startPayload}` 
    : WEBAPP_URL;

  const welcomeText = `Привет, ${ctx.from.first_name}! 👋\n\n` +
                      `Добро пожаловать в «Житуху»! Жми кнопку ниже, чтобы начать! 👇`;

  ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть в Житуху', web_app: { url: appUrl } }]
      ]
    }
  });
});

bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
});

export default async function handler(req, res) {
  // Если открыли в браузере (GET) - показываем, что бот работает
  if (req.method === 'GET') {
    return res.status(200).send('Бот работает и ждет сообщений от Telegram!');
  }

  // Обработка POST запроса от Telegram
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка в вебхуке:', err);
    res.status(500).send('Error');
  }
}