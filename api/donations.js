import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyTelegramInitData } from './_telegram.js';

const PACKAGES = Object.freeze({
  starter: { stars: 15, credits: 50, title: '50 жетонов' },
  popular: { stars: 50, credits: 250, title: '250 жетонов' },
  big: { stars: 100, credits: 500, title: '500 жетонов' },
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { BOT_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BOT_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Платёжный сервер не настроен' });
  }
  const user = verifyTelegramInitData(req.body?.init_data, BOT_TOKEN);
  if (!user) return res.status(403).json({ error: 'Открой игру через Telegram' });

  const sb = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: player, error: playerError } = await sb.from('players').select('id, telegram_id').eq('telegram_id', String(user.id)).maybeSingle();
    if (playerError) throw playerError;
    if (!player) return res.status(404).json({ error: 'Игрок не зарегистрирован' });

    const { action, item_id: itemId, direction, amount, package_id: packageId, business_id: businessId } = req.body || {};
    if (action === 'create_invoice') {
      const pack = PACKAGES[packageId];
      if (!pack) return res.status(400).json({ error: 'Пакет не найден' });
      const { error: expireError } = await sb.from('donation_orders').update({ status: 'failed' })
        .eq('player_id', player.id).eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 20 * 1000).toISOString());
      if (expireError) throw expireError;
      const orderId = crypto.randomUUID();
      const { error: insertError } = await sb.from('donation_orders').insert({
        id: orderId, player_id: player.id, telegram_id: String(user.id), package_id: packageId,
        stars_amount: pack.stars, credits_amount: pack.credits,
      });
      if (insertError?.code === '23505') return res.status(409).json({ error: 'Закрой окно оплаты или повтори через несколько секунд.' });
      if (insertError) throw insertError;

      const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: pack.title,
          description: `Донат-жетоны для профиля в игре Житуха`,
          payload: orderId,
          currency: 'XTR',
          prices: [{ label: pack.title, amount: pack.stars }],
        }),
      });
      const invoice = await invoiceResponse.json();
      if (!invoiceResponse.ok || !invoice.ok || typeof invoice.result !== 'string') {
        await sb.from('donation_orders').update({ status: 'failed' }).eq('id', orderId);
        console.error('Telegram invoice creation failed:', invoice?.description || invoiceResponse.status);
        return res.status(502).json({ error: 'Telegram не смог создать счёт. Попробуй ещё раз.' });
      }
      return res.status(200).json({ invoice_url: invoice.result, order_id: orderId });
    }
    if (action === 'close_invoice') {
      const orderId = typeof req.body?.order_id === 'string' ? req.body.order_id : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return res.status(400).json({ error: 'Некорректный счёт' });
      }
      const { data: order, error: orderError } = await sb.from('donation_orders')
        .select('id, status').eq('id', orderId).eq('player_id', player.id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return res.status(404).json({ error: 'Счёт не найден' });
      if (order.status === 'pending') {
        // Release the one-pending-order lock. The Stars RPC still accepts a late
        // successful payment for this order in case Telegram reports it afterward.
        const { error: closeError } = await sb.from('donation_orders')
          .update({ status: 'failed' }).eq('id', orderId).eq('player_id', player.id).eq('status', 'pending');
        if (closeError) throw closeError;
      }
      return res.status(200).json({ closed: order.status !== 'paid' });
    }

    let rpcName;
    let rpcArgs;
    if (action === 'purchase' && typeof itemId === 'string') {
      rpcName = 'donation_purchase_rpc'; rpcArgs = { p_player_id: player.id, p_item_id: itemId };
    } else if (action === 'purchase_autostock' && typeof businessId === 'string') {
      rpcName = 'business_autostock_purchase_rpc'; rpcArgs = { p_player_id: player.id, p_business_id: businessId };
    } else if (action === 'equip' && typeof itemId === 'string') {
      rpcName = 'donation_equip_rpc'; rpcArgs = { p_player_id: player.id, p_item_id: itemId };
    } else if (action === 'exchange' && ['money_to_premium', 'premium_to_money'].includes(direction) && Number.isSafeInteger(amount)) {
      rpcName = 'donation_exchange_rpc'; rpcArgs = { p_player_id: player.id, p_direction: direction, p_amount: amount };
    } else {
      return res.status(400).json({ error: 'Некорректное действие' });
    }

    const { data, error } = await sb.rpc(rpcName, rpcArgs);
    if (error) throw error;
    if (data?.error) return res.status(400).json({ error: data.error });
    const updatedPlayer = data?.player || null;
    const message = action === 'equip'
      ? 'Профиль обновлён'
      : action === 'purchase_autostock'
        ? 'Слот автопополнения куплен'
      : action === 'purchase' && itemId === 'premium_14d'
        ? 'VIP Premium продлён на 14 дней'
        : action === 'purchase' ? 'Покупка успешна' : 'Обмен успешен';
    return res.status(200).json({ player: updatedPlayer, message });
  } catch (error) {
    console.error('Donation request failed:', error?.message || error);
    return res.status(500).json({ error: 'Не удалось выполнить операцию' });
  }
}
