import { useEffect, useState } from 'react';
import { Dices, KeyRound, Sparkles } from 'lucide-react';
import { NumberSpinMachine } from './NumberSpinMachine';

type CaseDefinition = {
  id: string;
  title: string;
  price: number;
  description: string;
  odds: readonly (readonly [string, string])[];
};

const CASES: readonly CaseDefinition[] = [
  { id: 'ordinary', title: 'Обычная', price: 4000, description: 'Базовая крутка. Средняя оценка номера — около 3 900 ₽.', odds: [['Обычный номер', '51,8%'], ['Редкий номер', '43,8%'], ['Эпический номер', '4,1%'], ['Легендарный номер', '0,2%'], ['Мифический номер', '0,1%']] },
  { id: 'taxi', title: 'Редкая', price: 5000, description: 'Шанс редкого номера или выше — 45%.', odds: [['Обычный номер', '55%'], ['Редкий номер', '39,85%'], ['Эпический номер', '4,75%'], ['Легендарный номер', '0,3%'], ['Мифический номер', '0,1%']] },
  { id: 'capital', title: 'Эпическая', price: 10000, description: 'Шанс эпического номера или выше — 30%.', odds: [['Обычный номер', '30%'], ['Редкий номер', '40%'], ['Эпический номер', '25%'], ['Легендарный номер', '4%'], ['Мифический номер', '1%']] },
  { id: 'blatnoy', title: 'Легендарная', price: 20000, description: 'Шанс легендарного номера или выше — 20%.', odds: [['Обычный номер', '10%'], ['Редкий номер', '30%'], ['Эпический номер', '40%'], ['Легендарный номер', '16%'], ['Мифический номер', '4%']] },
  { id: 'mythic', title: 'Мифическая', price: 35000, description: 'Шанс мифического номера — 15%, легендарного или выше — 45%.', odds: [['Обычный номер', '2%'], ['Редкий номер', '15%'], ['Эпический номер', '38%'], ['Легендарный номер', '30%'], ['Мифический номер', '15%']] },
  { id: 'friend', title: 'Реферальная', price: 0, description: 'Бесплатная крутка за ключ приглашённого друга.', odds: [['Обычный номер', '45%'], ['Редкий номер', '47%'], ['Эпический номер', '7%'], ['Легендарный номер', '0,8%'], ['Мифический номер', '0,2%']] },
];

const moneyText = (value: number) => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
const RARITY_NAMES: Record<string, string> = { common: 'обычный', rare: 'редкий', epic: 'эпический', legendary: 'легендарный', mythic: 'мифический' };

type NumberCasesState = { error?: string; friend_keys: number; money: number; premium_balance: number };
type NumberCaseReward = {
  reward_type?: 'plate' | 'token' | 'attempt';
  number_id?: string;
  plate?: string;
  rarity?: string;
  estimated_value?: number;
  money?: number;
  premium_balance?: number;
  friend_keys?: number;
  token_reward?: number;
};
type CaseResult = { caseId: string; reward: NumberCaseReward };
type CaseSpin = { caseId: string; stage: 'spinning' | 'stopping'; reward?: NumberCaseReward };
type CasesApp = {
  pid: string | null;
  supabase: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: NumberCasesState | null; error: { message: string } | null }> };
  spinCarPlate: () => void;
  openNumberCase: (caseId: string) => Promise<NumberCaseReward>;
  sellCarNumber: (numberId: string) => void;
  proc: boolean;
  money: number;
  currentDistrict: string;
};

export const CasesTab = ({ app }: { app: CasesApp }) => {
  const [state, setState] = useState<NumberCasesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CaseResult | null>(null);
  const [spin, setSpin] = useState<CaseSpin | null>(null);
  const [selectedId, setSelectedId] = useState('ordinary');
  const selectedCase = CASES.find(item => item.id === selectedId) ?? CASES[0];
  const referralCase = CASES.find(item => item.id === 'friend')!;
  const spinningCase = spin && CASES.find(item => item.id === spin.caseId);

  useEffect(() => {
    let current = true;
    const playerId = app.pid;
    if (!playerId) return () => { current = false; };
    void app.supabase.rpc('number_cases_state_rpc', { p_player_id: playerId }).then(({ data, error: rpcError }) => {
      if (!current) return;
      if (rpcError || data?.error) setError(data?.error || 'Не удалось загрузить крутки');
      else setState(data);
      setLoading(false);
    });
    return () => { current = false; };
  }, [app.pid, app.supabase]);

  const finishSpin = () => {
    if (!spin?.reward) return;
    setResult({ caseId: spin.caseId, reward: spin.reward });
    setSpin(null);
  };

  const open = async (id: string) => {
    setError('');
    setResult(null);
    if (id === 'ordinary') { app.spinCarPlate(); return; }
    setSpin({ caseId: id, stage: 'spinning' });
    try {
      const [opened] = await Promise.all([
        app.openNumberCase(id),
        new Promise(resolve => window.setTimeout(resolve, 1100)),
      ]);
      setState(previous => ({
        ...(previous ?? { friend_keys: 0, money: 0, premium_balance: 0 }),
        friend_keys: opened.friend_keys ?? previous?.friend_keys ?? 0,
        money: opened.money ?? previous?.money ?? 0,
        premium_balance: opened.premium_balance ?? previous?.premium_balance ?? 0,
      }));
      if (opened.reward_type === 'plate' && opened.plate) {
        setSpin({ caseId: id, stage: 'stopping', reward: opened });
      } else {
        setResult({ caseId: id, reward: opened });
        setSpin(null);
      }
    } catch (caught: unknown) {
      setSpin(null);
      setError(caught instanceof Error ? caught.message : 'Не удалось запустить крутку');
    }
  };

  const friendKeys = state?.friend_keys ?? 0;
  const resultPrice = result ? (CASES.find(item => item.id === result.caseId)?.price ?? 0) : 0;
  const resultValue = Number(result?.reward.estimated_value ?? 0);
  const resultNet = resultValue - resultPrice;

  return <div className="game-tab" style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14, animation: 'fadeIn 0.3s' }}>
    <header style={{ textAlign: 'left' }}><h2 style={{ margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: 8 }}><Dices size={22} /> Крутки номеров</h2><small style={{ color: 'var(--text-muted, #777)' }}>Выбери редкость и цену. Шансы указаны до запуска.</small></header>
    {state && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'rgba(100,100,100,.08)' }}><b>Баланс: {moneyText(app.money ?? state.money)}</b><span><KeyRound size={14} style={{ verticalAlign: 'middle' }} /> Реферальные ключи: {state.friend_keys || 0}</span><span><Sparkles size={14} style={{ verticalAlign: 'middle' }} /> Жетоны: {state.premium_balance || 0}</span></div>}
    {loading && <div className="loading">Загрузка круток…</div>}
    {error && <div role="alert" style={{ color: '#bd3e37' }}>{error}</div>}

    {result && <section className="number-case-result" role="status">
      <b className="number-case-result-title">{result.reward.reward_type === 'token' ? `Получен жетон · +${result.reward.token_reward ?? 1}` : result.reward.reward_type === 'attempt' ? 'Получена дополнительная попытка' : 'Номер добавлен в коллекцию'}</b>
      {result.reward.plate && <>
        <div className="ru-license-plate" style={{ margin: '10px auto', width: 'fit-content' }}>{result.reward.plate}</div>
        <small>{RARITY_NAMES[result.reward.rarity ?? ''] || result.reward.rarity} · оценка {moneyText(resultValue)}</small>
        <div className="number-case-economy">
          <span>Крутка <b>{moneyText(resultPrice)}</b></span>
          <span>При продаже <b>{moneyText(resultValue)}</b></span>
          <strong className={resultNet >= 0 ? 'is-positive' : 'is-negative'}>{resultNet >= 0 ? `Потенциально в плюс · ${moneyText(resultNet)}` : `До окупаемости · ${moneyText(Math.abs(resultNet))}`}</strong>
        </div>
        <div className="number-case-result-actions">
          {result.reward.number_id && <button type="button" disabled={app.proc} onClick={() => { app.sellCarNumber(result.reward.number_id!); setResult(null); }}>Продать государству · {moneyText(resultValue)}</button>}
          <button type="button" disabled={app.proc} onClick={() => setResult(null)}>Оставить в коллекции</button>
        </div>
      </>}
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

    <article className="number-case-choice">
      <div><b>{selectedCase.title} крутка</b><small>{selectedCase.description}</small></div>
      <details>
        <summary>Все шансы</summary>
        <div className="number-case-odds">
          {selectedCase.odds.map(([label, chance]) => <span className="number-case-odds-row" key={label}><span>{label}</span><b>{chance}</b></span>)}
        </div>
      </details>
      {(() => {
        const disabled = app.proc || (selectedCase.price > 0 && Number(app.money ?? state?.money ?? 0) < selectedCase.price) || (selectedCase.id === 'ordinary' && app.currentDistrict !== 'center');
        const buttonText = selectedCase.id === 'ordinary' && app.currentDistrict !== 'center' ? 'Нужен центральный район' : `Крутить за ${moneyText(selectedCase.price)}`;
        return <button type="button" disabled={disabled} onClick={() => void open(selectedCase.id)}>{app.proc ? 'Крутим…' : buttonText}</button>;
      })()}
    </article>

    <button className="number-case-referral" type="button" disabled={app.proc || friendKeys < 1} onClick={() => void open(referralCase.id)}>
      <KeyRound size={19} /><span><b>Реферальная крутка</b><small>{friendKeys} ключей · бесплатно</small></span><strong>{friendKeys > 0 ? 'Открыть ›' : 'Нужен ключ'}</strong>
    </button>

    {spin && <div className="number-case-spin-screen" role="dialog" aria-modal="true" aria-label="Крутка автомобильного номера">
      <section className="number-case-spin-card">
        <span className="number-case-spin-kicker">{spinningCase?.title ?? 'Номерная'} крутка</span>
        <h2>{spin.stage === 'stopping' ? 'Фиксируем номер' : 'Крутим номер'}</h2>
        <p>{spin.stage === 'stopping' ? 'Сверяем комбинацию и оценку' : 'Барабаны уже запущены'}</p>
        <NumberSpinMachine isCar targetValue={spin.stage === 'stopping' ? spin.reward?.plate ?? null : null} stopping={spin.stage === 'stopping'} onSettled={finishSpin} />
        <div className={`number-case-spin-progress${spin.stage === 'stopping' ? ' is-stopping' : ''}`}><i /></div>
        <small>{spin.stage === 'stopping' ? 'Номер определён' : 'Удачи!'}</small>
      </section>
    </div>}
  </div>;
};
