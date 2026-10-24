export default async function handler(req, res) {
  // Разрешаем запросы
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { player_name, player_id, message } = req.body || {};
    const token = process.env.BOT_TOKEN;
    const adminId = process.env.ADMIN_TG_ID;

    if (!token || !adminId) {
      return res.status(500).json({ error: 'Сервер не настроен (нет BOT_TOKEN или ADMIN_TG_ID)' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    const text = `🐞 **Баг-репорт!**\n\n👤 Игрок: **${player_name}**\n🆔 TG ID: \`${player_id}\`\n\n📝 Сообщение:\n${message}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: `Telegram API: ${tgData.description}` });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
}