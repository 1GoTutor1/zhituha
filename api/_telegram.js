import crypto from 'crypto';

const MAX_AGE_SEC = 24 * 60 * 60;
const MAX_FUTURE_SEC = 30;

export function verifyTelegramInitData(initData, botToken = process.env.BOT_TOKEN) {
  if (!botToken || typeof initData !== 'string' || !initData || initData.length > 16_384) return null;

  try {
    const params = new URLSearchParams(initData);
    const hashes = params.getAll('hash');
    const dates = params.getAll('auth_date');
    const users = params.getAll('user');
    if (hashes.length !== 1 || dates.length !== 1 || users.length !== 1) return null;

    const hash = hashes[0];
    if (!/^[a-f0-9]{64}$/i.test(hash)) return null;
    const authDate = Number(dates[0]);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || now - authDate > MAX_AGE_SEC || authDate - now > MAX_FUTURE_SEC) return null;

    const pairs = [...params.entries()].filter(([key]) => key !== 'hash');
    pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = pairs.map(([key, value]) => `${key}=${value}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
    if (!crypto.timingSafeEqual(calculated, Buffer.from(hash, 'hex'))) return null;

    const user = JSON.parse(users[0]);
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return { id: user.id, username: user.username || null, first_name: user.first_name || null };
  } catch {
    return null;
  }
}
