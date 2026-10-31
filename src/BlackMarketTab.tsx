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
  plot?: { planted_at: string; ready_at: string; ready_in_seconds: number; yield_units: number } | null;
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
  const [tab, setTab] = useState<'trader' | 'cultivation'>('trader');
  const [state, setState] = useState<BlackMarketState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const refresh = useCallback(async () => {
    if (!app.pid) return;
    const { data: responseData, error: rpcError } = await app.supabase.rpc('black_market_state_rpc', { p_player_id: app.pid });
    if (rpcError) throw rpcError;
    const data = responseData as BlackMarketState;
    if (data?.error) throw new Error(data.error);
    setNow(Date.now());
    setState(data);
  }, [app.pid, app.supabase]);
  useEffect(() => {
    if (app.tab !== 'black_market') return;
    const load = () => void refresh().catch((e: unknown) => setError(messageFromError(e, 'Не удалось загрузить рынок')));
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [app.tab, refresh]);
  useEffect(() => {
    if (!state?.plot?.planted_at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.plot?.planted_at]);
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
  const plantedAt = plot?.planted_at ? Date.parse(plot.planted_at) : 0;
  const readyAt = plot?.ready_at ? Date.parse(plot.ready_at) : 0;
  const totalGrowMs = Math.max(1, readyAt - plantedAt);
  const growth = plot?.planted_at ? Math.min(1, Math.max(0, (now - plantedAt) / totalGrowMs)) : 0;
  const seconds = plot?.planted_at ? Math.max(0, Math.ceil((readyAt - now) / 1000)) : 0;
  const growthLabel = growth >= 1 ? 'Созрело' : growth >= .72 ? 'Почти готово' : growth >= .34 ? 'Растёт' : 'Проклюнулось';
  const clock = `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const next = state?.next_open_at ? new Date(state.next_open_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '07:00 или 15:00 МСК';
  const cropUnits = Number(state?.crop_units || 0);
  const cropValue = cropUnits * Number(state?.buy_price || 0);
  const currentPrice = Number(state?.buy_price || 0);
  const seedPrice = Number(state?.seed_price || 100_000);
  const expectedProfit = currentPrice * 10 - seedPrice;
  return <div style={{ padding: 'calc(120px + env(safe-area-inset-top, 16px)) 16px calc(100px + env(safe-area-inset-bottom, 16px))', maxWidth: 620, margin: '0 auto', color: 'var(--text-main, #f7f1ff)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><small style={{ color: '#8d75a8', letterSpacing: 1 }}>ЗАКРЫТАЯ ТОРГОВЛЯ</small><h2 style={{ margin: '4px 0' }}>Чёрный рынок</h2></div><button aria-label="Обновить" onClick={() => void refresh()} style={{ background: 'transparent', color: 'inherit', border: 0 }}><RefreshCw size={19} /></button></header>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><button onClick={() => setTab('trader')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #49345d', background: tab === 'trader' ? '#ff922e' : '#21182c', color: 'white', fontWeight: 800 }}><Store size={16} /> Торговец</button><button onClick={() => setTab('cultivation')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #49345d', background: tab === 'cultivation' ? '#ff922e' : '#21182c', color: 'white', fontWeight: 800 }}><Sprout size={16} /> Выращивание</button></div>
    <section className="black-market-feature" data-mode={tab} data-ready={Boolean(plot?.planted_at && growth >= 1)}>
      <div><span>{tab === 'trader' ? (isOpen ? 'ТОРГОВЕЦ УЖЕ В ГОРОДЕ' : 'СЛЕДУЮЩИЙ ЗАЕЗД') : 'СВОЙ УЧАСТОК'}</span><b>{tab === 'trader' ? (isOpen ? 'Успей до отъезда' : `Приедет в ${next} МСК`) : 'Урожай за 4 часа'}</b></div>
    </section>
    <section style={panel}><b>{isOpen ? 'Торговец на месте' : 'Торговец уехал'}</b><p style={{ color: '#b7a8c7', margin: '7px 0' }}>{isOpen ? 'Рынок открыт с 07:00 до 11:00 и с 15:00 до 19:00 по Москве.' : `Следующий приезд: ${next} МСК.`}</p>{isOpen && <div>Скупка сейчас: <b>{fmt(state?.buy_price)} ₽ за единицу</b></div>}</section>
    {tab === 'trader' ? <>
      <section style={panel}><h3><Leaf size={18} /> Семена</h3><p>Фиксированная цена — <b>{fmt(state?.seed_price)} ₽</b> за семя. Покупка доступна во время приезда торговца.</p><p>В запасе: <b>{fmt(state?.seeds)}</b></p><Btn disabled={busy || !isOpen} onClick={() => void act('black_market_buy_seed_rpc')}>Купить семя · {fmt(state?.seed_price)} ₽</Btn></section>
      <section style={panel}><h3><ShoppingBag size={18} /> Скупка урожая</h3><p>Урожай принимается только здесь и только во время визита торговца. В запасе: <b>{fmt(cropUnits)} ед.</b></p>{isOpen && cropUnits > 0 && <p>По текущей котировке: <b>{fmt(cropValue)} ₽</b></p>}<Btn disabled={busy || !isOpen || cropUnits < 1} onClick={() => void act('black_market_sell_rpc')}>Сдать урожай{isOpen && cropUnits > 0 ? ` · ${fmt(cropValue)} ₽` : ''}</Btn></section>
      {isOpen && <section style={panel} aria-live="polite"><h3>Расчёт по текущей цене</h3><p>Обычный урожай — 10 единиц. По нынешней котировке это <b>{fmt(currentPrice * 10)} ₽</b>, или <b style={{ color: expectedProfit >= 0 ? '#73dc98' : '#ff8798' }}>{expectedProfit > 0 ? '+' : ''}{fmt(expectedProfit)} ₽</b> после стоимости семени.</p><p>Для сравнения: при 8 единицах получится {fmt(currentPrice * 8 - seedPrice)} ₽, при 12 — {fmt(currentPrice * 12 - seedPrice)} ₽.</p><small style={{ color: '#b7a8c7' }}>Это расчёт по сегодняшней цене. Курс может измениться к моменту созревания; прибыль не гарантирована.</small></section>}
    </> : <section className="black-market-cultivation" style={panel}>
      <h3><Sprout size={18} /> Участок</h3>
      <p>Выращивание занимает 4 часа. Урожай: обычно 10 единиц, иногда 8 или 12.</p>
      <div className="black-market-garden" data-growing={Boolean(plot?.planted_at)}>
        <img className="black-market-growth-art" src={!plot?.planted_at || growth < .55 ? '/images/black-market-seedling.jpg' : '/images/black-market-mature.jpg'} alt="" aria-hidden="true" />
        <div className="black-market-plant" style={{ '--growth': growth, '--growth-scale': 0.42 + growth * 0.58 } as React.CSSProperties}><Sprout size={64} strokeWidth={1.6} /></div>
        <span className="black-market-garden-label">{plot?.planted_at ? growthLabel : 'Грядка свободна'}</span>
        <div className="black-market-growth-track"><span style={{ width: `${growth * 100}%` }} /></div>
      </div>
      {plot?.planted_at ? <p className="black-market-growth-status">{seconds > 0 ? <>До сбора <b>{clock}</b> · {Math.floor(growth * 100)}%</> : <>Урожай созрел · <b>{fmt(plot.yield_units)} ед.</b></>}</p> : <p>Семян: <b>{fmt(state?.seeds)}</b></p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!plot?.planted_at && <Btn disabled={busy || !Number(state?.seeds)} onClick={() => void act('black_market_plant_rpc')}>Посадить семя</Btn>}
        {plot?.planted_at && <Btn disabled={busy || seconds > 0} onClick={() => void act('black_market_harvest_rpc')}>Собрать урожай · {fmt(plot.yield_units)} ед.</Btn>}
      </div>
    </section>}
    {state?.family_event && <section style={panel}><b>Семейная поставка</b><p>Сдайте вместе {state.family_event.target_units} единиц до отъезда торговца. Нужно минимум {state.family_event.min_members} участников. За успешное событие семья получает 15 очков.</p><p>Сдано: <b>{state.family_event.sold_units}/{state.family_event.target_units}</b> · Участников: <b>{state.family_event.member_count}/{state.family_event.min_members}</b></p><p>{state.family_event.joined ? 'Ты участвуешь в поставке.' : 'Вступи в событие до продажи товара.'}</p>{!state.family_event.joined && <Btn disabled={busy || !isOpen} onClick={() => void act('family_black_market_join_rpc')}>Участвовать</Btn>}</section>}
    {error && <p role="alert" style={{ color: '#ff7187' }}>{error}</p>}
  </div>;
};
