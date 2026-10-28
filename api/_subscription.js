const CHANNEL_USERNAME = '@zhituha_news';
const CHECK_TIMEOUT_MS = 2500;

export async function checkChannelSubscription(telegramUserId, botToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL_USERNAME, user_id: Number(telegramUserId) }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !result.result) throw new Error('Telegram membership lookup failed');
    const member = result.result;
    return ['creator', 'administrator', 'member'].includes(member.status)
      || (member.status === 'restricted' && member.is_member === true);
  } finally {
    clearTimeout(timeout);
  }
}
