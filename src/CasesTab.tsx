import { useEffect, useState } from 'react';
import { Dices, KeyRound, Sparkles } from 'lucide-react';

const CASES = [
  { id: 'ordinary', title: 'Обычная', price: 3000, description: 'Базовая прокрутка; шансы приблизительные.', odds: [['Обычный номер', '56,4%'], ['Редкий номер', '39,1%'], ['Эпический номер', '4,2%'], ['Легендарный номер', '0,2%'], ['Мифический номер', '0,1%']] },
  { id: 'taxi', title: 'Редкая', price: 5000, description: 'Небольшое повышение шанса получить редкий номер или лучше.', odds: [['Обычный номер', '55%'], ['Редкий номер', '39,85%'], ['Эпический номер', '4,75%'], ['Легендарный номер', '0,3%'], ['Мифический номер', '0,1%']] },
  { id: 'capital', title: 'Эпическая', price: 15000, description: 'Шанс редкого номера или выше — 55%.', odds: [['Обычный номер', '45%'], ['Редкий номер', '47%'], ['Эпический номер', '7%'], ['Легендарный номер', '0,8%'], ['Мифический номер', '0,2%']] },
  { id: 'blatnoy', title: 'Легендарная', price: 40000, description: 'Шанс редкого номера или выше — 80%.', odds: [['Обычный номер', '20%'], ['Редкий номер', '55%'], ['Эпический номер', '22%'], ['Легендарный номер', '2,5%'], ['Мифический номер', '0,5%']] },
  { id: 'mythic', title: 'Мифическая', price: 100000, description: 'Шанс редкого номера или выше — 95%.', odds: [['Обычный номер', '5%'], ['Редкий номер', '40%'], ['Эпический номер', '45%'], ['Легендарный номер', '8%'], ['Мифический номер', '2%']] },
  { id: 'friend', title: 'Реферальная', price: 0, description: 'Бесплатная прокрутка за ключ активированного реферала.', odds: [['Обычный номер', '45%'], ['Редкий номер', '47%'], ['Эпический номер', '7%'], ['Легендарный номер', '0,8%'], ['Мифический номер', '0,2%']] },
] as const;

const moneyText = (value: number) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
const RARITY_NAMES: Record<string, string> = { common: 'обычный', rare: 'редкий', epic: 'эпический', legendary: 'легендарный', mythic: 'мифический' };

type NumberCasesState = { error?: string; friend_keys: number; money: number; premium_balance: number };
type NumberCaseResult = { plate: string; rarity: string; estimated_value: number; money?: number; premium_balance?: number; friend_keys?: number };
type CasesApp = {
  pid: string | null;
  supabase: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: NumberCasesState | null; error: { message: string } | null }> };
  spinCarPlate: () => void;
  openNumberCase: (caseId: string) => Promise<NumberCaseResult>;
  proc: boolean;
  money: number;
  currentDistrict: string;
};

export const CasesTab = ({ app }: { app: CasesApp }) => {
  const [state, setState] = useState<NumberCasesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<NumberCaseResult | null>(null);
  const [selectedId, setSelectedId] = useState<string>('ordinary');
  const selectedCase = CASES.find(item => item.id === selectedId) ?? CASES[0];
  const referralCase = CASES.find(item => item.id === 'friend')!;

  useEffect(() => {
    let current = true;
    const playerId = app.pid;
    if (!playerId) return () => { current = false; };
    void app.supabase.rpc('number_cases_state_rpc', { p_player_id: playerId }).then(({ data, error: rpcError }) => {
      if (!current) return;
      if (rpcError || data?.error) setError(data?.error || 'Не удалось загрузить прокрутки');
      else setState(data);
      setLoading(false);
    });
    return () => { current = false; };
  }, [app.pid, app.supabase]);

  const open = async (id: string) => {
    setError(''); setResult(null);
    if (id === 'ordinary') { app.spinCarPlate(); return; }
    try {
      const opened = await app.openNumberCase(id);
      setResult(opened);
      setState(previous => ({
        ...(previous ?? { friend_keys: 0, money: 0, premium_balance: 0 }),
        friend_keys: opened.friend_keys ?? previous?.friend_keys ?? 0,
        money: opened.money ?? previous?.money ?? 0,
        premium_balance: opened.premium_balance ?? previous?.premium_balance ?? 0,
      }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Не удалось запустить прокрутку');
    }
  };
  const friendKeys = state?.friend_keys ?? 0;

  return <div className="game-tab" style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14, animation: 'fadeIn 0.3s' }}>
    <header style={{ textAlign: 'left' }}><h2 style={{ margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 8 }}><Dices size={22} /> Крутки номеров</h2><small style={{ color: 'var(--text-muted, #777)' }}>Выбери редкость и цену. Шансы указаны до запуска.</small></header>
    {state && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'rgba(100,100,100,.08)' }}><b>Баланс: {moneyText(app.money ?? state.money)}</b><span><KeyRound size={14} style={{ verticalAlign: 'middle' }} /> Реферальные ключи: {state.friend_keys || 0}</span><span><Sparkles size={14} style={{ verticalAlign: 'middle' }} /> Жетоны: {state.premium_balance || 0}</span></div>}
    {loading && <div className="loading">Загрузка прокруток…</div>}
    {error && <div role="alert" style={{ color: '#bd3e37' }}>{error}</div>}
    {result && <section role="status" style={{ padding: 14, borderRadius: 12, background: 'rgba(65,107,80,.12)', textAlign: 'center' }}>
      <><b style={{ display: 'block' }}>Номер добавлен в коллекцию</b><div className="ru-license-plate" style={{ margin: '10px auto', width: 'fit-content' }}>{result.plate}</div><small>{RARITY_NAMES[result.rarity] || result.rarity} · оценка {moneyText(result.estimated_value)}</small></>
    </section>}
    <section aria-label="Выбор редкости крутки" style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
      <b style={{ fontSize: 12, color: 'var(--text-muted, #777)', letterSpacing: '.06em' }}>РЕДКОСТЬ КРУТКИ</b>
      <div className="spin-rarity-strip" role="group" aria-label="Выберите редкость">
        {CASES.filter(item => item.id !== 'friend').map(item => {
          const selected = selectedId === item.id;
          return <button key={item.id} type="button" aria-pressed={selected} onClick={() => setSelectedId(item.id)} className={`spin-rarity-option${selected ? ' is-selected' : ''}`}>
            <span>{item.title}</span><small>{moneyText(item.price)}</small>
          </button>;
        })}
      </div>
    </section>

    <article style={{ padding: 13, borderRadius: 14, border: '1px solid var(--surface-line, rgba(130,150,150,.2))', background: 'var(--surface-raised, rgba(100,100,100,.07))', display: 'grid', gap: 9, textAlign: 'left' }}>
      <div><b>{selectedCase.title} крутка</b><small style={{ display: 'block', marginTop: 3, color: 'var(--text-muted, #777)' }}>{selectedCase.description}</small></div>
      <details>
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted, #777)' }}>Все шансы</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 12px', marginTop: 8, fontSize: 12 }}>
          {selectedCase.odds.map(([label, chance]) => <span key={label} style={{ display: 'contents' }}><span>{label}</span><b>{chance}</b></span>)}
        </div>
      </details>
      {(() => {
        const disabled = app.proc || (selectedCase.price > 0 && Number(app.money ?? state?.money ?? 0) < selectedCase.price) || (selectedCase.id === 'ordinary' && app.currentDistrict !== 'center');
        const buttonText = selectedCase.id === 'ordinary' && app.currentDistrict !== 'center' ? 'Нужен центральный район' : `Крутить за ${moneyText(selectedCase.price)}`;
        return <button type="button" disabled={disabled} onClick={() => void open(selectedCase.id)} style={{ border: 0, borderRadius: 9, padding: '11px 14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1, background: 'var(--accent, #e5a51e)', color: '#211b12' }}>{app.proc ? 'Крутим…' : buttonText}</button>;
      })()}
    </article>

    <button type="button" disabled={app.proc || friendKeys < 1} onClick={() => void open(referralCase.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', border: '1px solid var(--surface-line, rgba(130,150,150,.2))', borderRadius: 14, background: 'var(--surface-raised, rgba(100,100,100,.07))', color: 'var(--text-main, inherit)', textAlign: 'left', opacity: friendKeys > 0 ? 1 : .62, cursor: friendKeys > 0 ? 'pointer' : 'not-allowed' }}>
      <KeyRound size={19} /><span style={{ flex: 1 }}><b style={{ display: 'block' }}>Реферальная крутка</b><small style={{ color: 'var(--text-muted, #777)' }}>{friendKeys} ключей · бесплатно</small></span><span style={{ color: 'var(--accent, #e5a51e)', fontWeight: 700 }}>{friendKeys > 0 ? 'Открыть ›' : 'Нужен ключ'}</span>
    </button>
  </div>;
};
