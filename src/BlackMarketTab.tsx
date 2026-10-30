import { useCallback, useEffect, useState } from 'react';
import { Leaf, RefreshCw, ShoppingBag, Sprout, Store } from 'lucide-react';
import { Btn } from './components';

const fmt = (value: unknown) => Number(value || 0).toLocaleString('ru-RU');
const panel: React.CSSProperties = { background: 'var(--surface-card, #21182c)', border: '1px solid var(--surface-line, #40304d)', borderRadius: 18, padding: 16, marginBottom: 14, textAlign: 'left' };

type RpcResponse = { data: unknown; error: { message?: string } | null };
type BlackMarketState = {
  market_open?: boolean;
  buy_price?: number;
  seed_price?: number;
  next_open_at?: string | null;
  seeds?: number;
  crop_units?: number;
  slot?: number | null;
  error?: string;
  plot?: { planted_at: string; ready_at: string; ready_in_seconds: number } | null;
  family_event?: { id: string; target_units: number; sold_units: number; min_members: number; member_count: number; joined: boolean; completed: boolean } | null;
};
type BlackMarketApp = {
  pid: string | null;
  tab: string;
  supabase: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResponse> };
  setMoney?: (money: number) => void;
  showMsg: (message: string) => void;
};
const messageFromError = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const BlackMarketTab = ({ app }: { app: BlackMarketApp }) => {
  const [tab, setTab] = useState<'trader' | 'seedlings'>('trader');
  const [state, setState] = useState<BlackMarketState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!app.pid) return;
    const { data: responseData, error: rpcError } = await app.supabase.rpc('black_market_state_rpc', { p_player_id: app.pid });
    if (rpcError) throw rpcError;
    const data = responseData as BlackMarketState;
    if (data?.error) throw new Error(data.error);
    setState(data);
  }, [app.pid, app.supabase]);
  useEffect(() => {
    if (app.tab !== 'black_market') return;
    const load = () => void refresh().catch((e: unknown) => setError(messageFromError(e, 'Не удалось загрузить рынок')));
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [app.tab, refresh]);
  const act = async (name: string, args: Record<string, unknown> = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data: responseData, error: rpcError } = await app.supabase.rpc(name, { p_player_id: app.pid, ...args });
      if (rpcError) throw rpcError;
      const data = responseData as { error?: string; success?: boolean; message?: string; money?: number };
      if (data?.error || data?.success === false) throw new Error(data.error || data.message || 'Действие не выполнено');
      if (data?.money != null) app.setMoney?.(Number(data.money));
      app.showMsg(data?.message || 'Готово');
      await refresh();
    } catch (e: unknown) { setError(messageFromError(e, 'Ошибка действия')); }
    finally { setBusy(false); }
  };
  const isOpen = Boolean(state?.market_open);
  const plot = state?.plot;
  const seconds = Math.max(0, Number(plot?.ready_in_seconds || 0));
  const clock = `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const next = state?.next_open_at ? new Date(state.next_open_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '07:00 или 15:00 МСК';
  return <div style={{ padding: 'calc(120px + env(safe-area-inset-top, 16px)) 16px calc(100px + env(safe-area-inset-bottom, 16px))', maxWidth: 620, margin: '0 auto', color: 'var(--text-main, #f7f1ff)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><small style={{ color: '#8d75a8', letterSpacing: 1 }}>ЗАКРЫТАЯ ТОРГОВЛЯ</small><h2 style={{ margin: '4px 0' }}>Чёрный рынок</h2></div><button aria-label="Обновить" onClick={() => void refresh()} style={{ background: 'transparent', color: 'inherit', border: 0 }}><RefreshCw size={19} /></button></header>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><button onClick={() => setTab('trader')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #49345d', background: tab === 'trader' ? '#ff922e' : '#21182c', color: 'white', fontWeight: 800 }}><Store size={16} /> Торговец</button><button onClick={() => setTab('seedlings')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #49345d', background: tab === 'seedlings' ? '#ff922e' : '#21182c', color: 'white', fontWeight: 800 }}><Sprout size={16} /> Рассада</button></div>
    <section style={panel}><b>{isOpen ? 'Торговец на месте' : 'Торговец уехал'}</b><p style={{ color: '#b7a8c7', margin: '7px 0' }}>{isOpen ? 'Рынок открыт с 07:00 до 11:00 и с 15:00 до 19:00 по Москве.' : `Следующий приезд: ${next} МСК. Без пушей — только таймер здесь.`}</p>{isOpen && <div>Скупка сейчас: <b>{fmt(state?.buy_price)} ₽ за единицу</b></div>}</section>
    {tab === 'seedlings' ? <section style={panel}><h3><Leaf size={18} /> Семена</h3><p>Фиксированная цена: <b>{fmt(state?.seed_price)} ₽</b>. Выращивание доступно всегда и занимает 4 часа. Урожай: обычно 10 единиц; редкий разброс — 8 или 12.</p><p>Семян: <b>{fmt(state?.seeds)}</b> · Урожай: <b>{fmt(state?.crop_units)}</b></p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Btn disabled={busy || !isOpen} onClick={() => void act('black_market_buy_seed_rpc')}>Купить семя</Btn><Btn variant="secondary" disabled={busy || !Number(state?.seeds) || Boolean(plot?.planted_at)} onClick={() => void act('black_market_plant_rpc')}>Посадить</Btn>{plot?.planted_at && <Btn disabled={busy || seconds > 0} onClick={() => void act('black_market_harvest_rpc')}>{seconds ? `Созреет через ${clock}` : 'Собрать урожай'}</Btn>}</div>{plot?.planted_at && seconds > 0 && <p>До сбора: <b>{clock}</b></p>}</section> : <section style={panel}><h3><ShoppingBag size={18} /> Сбыт</h3><p>В наличии: <b>{fmt(state?.crop_units)} единиц</b>. Продать их можно только этому торговцу; его цена меняется с каждым приездом.</p><Btn disabled={busy || !isOpen || !Number(state?.crop_units)} onClick={() => void act('black_market_sell_rpc')}>Продать весь урожай</Btn></section>}
    {state?.family_event && <section style={panel}><b>Семейная поставка</b><p>Сдайте вместе {state.family_event.target_units} единиц до отъезда торговца. Нужно минимум {state.family_event.min_members} участников. За успешное событие семья получает 15 очков.</p><p>Сдано: <b>{state.family_event.sold_units}/{state.family_event.target_units}</b> · Участников: <b>{state.family_event.member_count}/{state.family_event.min_members}</b></p><p>{state.family_event.joined ? 'Ты участвуешь в поставке.' : 'Вступи в событие до продажи товара.'}</p>{!state.family_event.joined && <Btn disabled={busy || !isOpen} onClick={() => void act('family_black_market_join_rpc')}>Участвовать</Btn>}</section>}
    {error && <p role="alert" style={{ color: '#ff7187' }}>{error}</p>}
  </div>;
};
