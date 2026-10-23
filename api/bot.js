// api/bot.js
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://zhituha-ashen.vercel.app'; 

bot.start((ctx) => {
  const startPayload = ctx.startPayload; 
  const appUrl = startPayload 
    ? `${WEBAPP_URL}?start_param=${startPayload}` 
    : WEBAPP_URL;

  const welcomeText = `Привет, ${ctx.from.first_name}! 👋\n\n` +
                      `Добро пожаловать в «Житуху» — экономическую симуляцию, где ты строишь свой бизнес-империум с нуля.\n\n` +
                      `Жми кнопку ниже, чтобы начать! 👇`;

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

// Экспортируем для Vercel
module.exports = async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка в вебхуке:', err);
    res.status(500).send('Error');
  }
}