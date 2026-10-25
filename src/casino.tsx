import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Btn } from './components';
import { AnimatedNumber } from './AnimatedNumber';

// ============ КАЗИНО: глобальный цикл раундов (30с ставки / 5с спин / 10с результат) ============

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const colorOf = (n: number) => (n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black');

const RACE_CARS: any[] = [
  { id: 'skyline', name: 'Skyline R34', emoji: '🚙', coef: 'x2',  ch: '40%' },
  { id: 'bmw',     name: 'BMW E34',     emoji: '🚗', coef: 'x2.5', ch: '30%' },
  { id: 'toyota',  name: 'Camry',       emoji: '🚕', coef: 'x3.5', ch: '15%' },
  { id: 'lada',    name: 'Lada 2109',   emoji: '🚘', coef: 'x8',  ch: '10%' },
  { id: 'priora',  name: 'Приора',      emoji: '🏎', coef: 'x12', ch: '4%' },
  { id: 'matiz',   name: 'Matiz',       emoji: '🛞', coef: 'x25', ch: '1%' },
];

type Round = { id: string; status: 'betting' | 'spinning' | 'result'; end_time: number; roulette_result: number | null; dice_result: number | null; race_winner: string | null };

export const CasinoTab = ({ app }: { app: any }) => {
  const { pid, money, setMoney, showMsg, hapticFeedback, action } = app;
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(Date.now());
  const [game, setGame] = useState<'roulette' | 'dice' | 'race'>('roulette');
  const [choice, setChoice] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1000);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [history, setHistory] = useState<number[]>([]); // последние числа рулетки
  const lastRoundId = useRef<string | null>(null);

  // тик таймера каждую секунду (отсчёт = end_time - Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const loadRound = async () => {
    try {
      // серверный «ленивый» цикл: доводит истёкшие раунды и гарантирует свежий betting
      let data: any = null;
      const { data: rpcData } = await supabase.rpc('get_casino_round_rpc', { p_player_id: pid || null });
      data = rpcData;
      if (!data) {
        const { data: fallback } = await supabase.from('casino_rounds').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
        data = fallback;
      }
      if (!data) return;
      const r: Round = { id: data.id, status: data.status, end_time: Number(data.end_time), roulette_result: data.roulette_result, dice_result: data.dice_result, race_winner: data.race_winner };
      setRound(r);
      // мои ставки этого раунда
      if (pid) {
        const { data: bets } = await supabase.from('casino_bets').select('*').eq('player_id', pid).eq('round_id', r.id).order('created_at', { ascending: false });
        setMyBets(bets || []);
      }
      // история чисел (последние 10 завершённых)
      const { data: past } = await supabase.from('casino_rounds').select('roulette_result').eq('status', 'result').not('roulette_result', 'is', null).order('created_at', { ascending: false }).limit(10);
      setHistory((past || []).map((p: any) => p.roulette_result).reverse());
      // новый розыгрыш завершился — обновим баланс (выигрыши начисляет сервер)
      if (lastRoundId.current && lastRoundId.current !== r.id && r.status === 'result') {
        const { data: pl } = await supabase.from('players').select('money').eq('id', pid).maybeSingle();
        if (pl) setMoney(Number(pl.money));
      }
      lastRoundId.current = r.id;
    } catch {}
  };

  // подписка на Realtime + страховочный поллинг раз в 5 сек
  useEffect(() => {
    loadRound();
    const ch = (supabase as any)
      .channel('casino_rounds_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_rounds' }, () => loadRound())
      .subscribe();
    const poll = setInterval(loadRound, 5000);
    return () => { clearInterval(poll); (supabase as any).removeChannel(ch); };
  }, [pid]);

  // фаза result длится 10 сек — по истечении сами дёргаем сервер, тот закроет раунд и откроет новый betting
  useEffect(() => {
    if (round?.status === 'result') {
      const t = setTimeout(loadRound, 11000);
      return () => clearTimeout(t);
    }
  }, [round?.id, round?.status]);

  const phase = round?.status || 'betting';
  const msLeft = round ? Math.max(0, round.end_time - now) : 0;
  const canBet = phase === 'betting' && msLeft > 1500; // запас на сетевую задержку

  const placeBet = () => action(async () => {
    if (!pid) return showMsg('Сначала зарегистрируйся', true);
    if (!choice) return showMsg('Выбери ставку', true);
    if (betAmount < 100 || betAmount > 100000) return showMsg('Ставка от 100 до 100 000₽', true);
    if (money < betAmount) return showMsg('Недостаточно денег', true);
    const { data, error } = await supabase.rpc('place_bet_rpc', { p_player_id: pid, p_game_type: game, p_bet_choice: choice, p_amount: betAmount });
    if (error) return showMsg(error.message, true);
    if ((data as any)?.error) return showMsg((data as any).error, true);
    setMoney(Number((data as any).money));
    hapticFeedback('medium');
    showMsg(`Ставка принята: ${(data as any).money >= 0 ? betAmount.toLocaleString('ru') : ''}₽`);
    setMyBets([...myBets, { game_type: game, bet_choice: choice, amount: betAmount, status: 'pending' }]);
    loadRound();
  });

  const betBtn = (val: string, label: string, style?: any, disabled?: boolean) => (
    <button key={val} onClick={() => { if (!disabled) { setChoice(val); hapticFeedback('light'); } }}
      style={{ padding: '10px 6px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase',
        background: choice === val ? '#c98a10' : '#fbf4e4', color: choice === val ? '#fff8e6' : '#5a4a2f',
        border: choice === val ? '2px solid #8a5d0a' : '2px solid rgba(90,70,40,0.25)', opacity: disabled ? 0.4 : 1, ...style }}>{label}</button>
  );

  const wheelColor = (n: number) => n === 0 ? '#2c7a3c' : RED_NUMBERS.includes(n) ? '#c0453a' : '#2f2a1d';

  // прогресс текущей фазы для кольца-таймера и полоски
  const PHASE_TOTAL = phase === 'betting' ? 30000 : phase === 'spinning' ? 5000 : 10000;
  const progress = round ? Math.min(1, Math.max(0, 1 - msLeft / PHASE_TOTAL)) : 0;
  const R = 26, CIRC = 2 * Math.PI * R;
  const ringColor = phase === 'betting' ? (msLeft < 6000 ? '#ff9a8d' : '#ffd23f') : phase === 'spinning' ? '#f2b632' : '#63bd76';

  // локальная «прокрутка» барабана во время spinning — чисто визуальный перебор чисел
  const [spinNum, setSpinNum] = useState<number | null>(null);
  useEffect(() => {
    if (phase !== 'spinning') { setSpinNum(null); return; }
    const t = setInterval(() => setSpinNum(Math.floor(Math.random() * 37)), 120);
    return () => clearInterval(t);
  }, [phase, round?.id]);

  const shownRoulette = phase === 'spinning' ? spinNum : round?.roulette_result ?? null;

  // кубики по сумме (для результата)
  const dicePair = (sum: number): [number, number] => {
    for (let a = 6; a >= 1; a--) { const b = sum - a; if (b >= 1 && b <= 6) return [a, b]; }
    return [1, 1];
  };
  const DICE_PIPS: any = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieFace = (v: number) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 9px)', gap: 2, padding: 6, background: '#fffdf6', borderRadius: 8, border: '2px solid rgba(90,70,40,0.4)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: DICE_PIPS[v]?.includes(i) ? '#2f2a1d' : 'transparent', display: 'block' }} />)}
    </div>
  );

  // анимация гонки: все машины едут, победитель дальше всех
  const raceLane = (c: any, idx: number) => {
    const isWinner = round?.race_winner === c.id;
    const dur = isWinner ? 2.2 : 2.2 + idx * 0.35 + (idx % 2) * 0.2;
    const finish = isWinner ? 1 : Math.max(0.35, 1 - (idx * 0.12 + (idx % 3) * 0.07));
    return (
      <div key={c.id} style={{ position: 'relative', height: 26, marginBottom: 4, background: 'rgba(255,255,255,0.5)', borderRadius: 6, overflow: 'hidden', border: '1px dashed rgba(90,70,40,0.3)' }}>
        <div style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 8, backgroundImage: 'repeating-linear-gradient(45deg, #2f2a1d 0 4px, #fff 4px 8px)', opacity: 0.6 }} />
        <div style={{
          position: 'absolute', left: 2, top: 1, fontSize: 20, lineHeight: '24px', width: 30,
          animation: phase === 'spinning' ? `carRun ${dur}s cubic-bezier(.12,.8,.3,1) forwards` : 'none',
          transform: phase === 'result' ? `translateX(calc(${Math.round(finish * 100)}% - 34px))` : undefined,
          filter: phase === 'result' && !isWinner ? 'grayscale(0.6)' : 'none',
        }}>{c.emoji}</div>
      </div>
    );
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>🎰 Казино «Золотое дно»</h2>

      {/* Табло фазы с кольцом-таймером */}
      <div style={{ background: '#2f2a1d', color: '#ffd23f', borderRadius: 10, padding: '10px 14px', margin: '10px 0', fontFamily: "'Russo One', sans-serif", display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', animation: phase === 'spinning' ? 'neonPulse 1s infinite' : 'none', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(90,70,40,0.35)' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,210,63,0.18)" strokeWidth="6" />
          <circle cx="32" cy="32" r={R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)}
            transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
          <text x="32" y="38" textAnchor="middle" fill={ringColor} fontSize="16" fontFamily="'Russo One', sans-serif">{Math.ceil(msLeft / 1000)}</text>
        </svg>
        <div style={{ textAlign: 'left', fontSize: 13 }}>
          {phase === 'betting' && <>⏳ Приём ставок<br /><span style={{ color: msLeft < 6000 ? '#ff9a8d' : '#ffd23f' }}>{msLeft < 6000 ? 'осталось мало времени!' : 'успей поставить'}</span></>}
          {phase === 'spinning' && <>🎲 Барабан крутится…<br /><span style={{ color: '#ffd23f' }}>удача, брат!</span></>}
          {phase === 'result' && <>✅ Итоги раунда!<br /><span style={{ color: '#63bd76' }}>новый через {Math.ceil(msLeft / 1000)}с</span></>}
        </div>
      </div>

      {/* Полоска прогресса фазы */}
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(90,70,40,0.2)', overflow: 'hidden', margin: '0 0 10px' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: ringColor, transition: 'width 1s linear', borderRadius: 3 }} />
      </div>

      {/* Визуализация игры */}
      <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', margin: '4px 0 10px' }}>
        {game === 'roulette' && (shownRoulette != null || phase === 'spinning') && (
          <div style={{ position: 'relative', width: 110, height: 110 }}>
            {/* обод барабана */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(#c0453a 0 30deg, #2f2a1d 30deg 60deg, #c0453a 60deg 90deg, #2f2a1d 90deg 120deg, #c0453a 120deg 150deg, #2f2a1d 150deg 180deg, #c0453a 180deg 210deg, #2f2a1d 210deg 240deg, #c0453a 240deg 270deg, #2f2a1d 270deg 300deg, #c0453a 300deg 330deg, #2c7a3c 330deg 360deg)', border: '4px solid #f2b632', boxShadow: '0 4px 0 rgba(90,70,40,0.35), inset 0 0 14px rgba(0,0,0,0.45)', animation: phase === 'spinning' ? 'casinoSpin 0.9s linear infinite' : 'none' }} />
            {/* центральный диск с числом */}
            <div key={`${phase}-${shownRoulette}`} style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: shownRoulette != null ? wheelColor(shownRoulette) : '#efe4c8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Russo One', sans-serif", fontSize: 30, border: '3px solid #fffdf6', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)', animation: phase === 'result' ? 'resultPop 0.6s ease-out' : 'none' }}>
              {shownRoulette ?? '?'}
            </div>
            {/* указатель сверху */}
            <div style={{ position: 'absolute', top: -10, left: '50%', marginLeft: -8, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid #ffd23f', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))' }} />
          </div>
        )}
        {game === 'dice' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'spinning' ? (
              <div style={{ fontSize: 44, animation: 'diceShake 0.4s infinite' }}>🎲🎲</div>
            ) : round?.dice_result != null ? (
              <>
                {dieFace(dicePair(round.dice_result)[0])}
                {dieFace(dicePair(round.dice_result)[1])}
                <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 22, color: '#b06a15', marginLeft: 6, animation: 'resultPop 0.5s ease-out' }}>= {round.dice_result}</div>
              </>
            ) : (
              <div style={{ fontSize: 40, opacity: 0.5 }}>🎲</div>
            )}
          </div>
        )}
        {game === 'race' && (
          <div style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}>
            {RACE_CARS.map((c, i) => raceLane(c, i))}
            {phase === 'result' && round?.race_winner && (
              <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 13, color: '#2c7a3c', marginTop: 4 }}>
                🏆 Победил: {RACE_CARS.find(c => c.id === round.race_winner)?.name}
              </div>
            )}
          </div>
        )}
        {game === 'roulette' && shownRoulette == null && phase !== 'spinning' && (
          <div style={{ fontSize: 40, opacity: 0.5 }}>🎡</div>
        )}
      </div>

      {/* История рулетки */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {history.map((n, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: wheelColor(n), color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{n}</span>)}
        </div>
      )}

      {/* Выбор игры */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {(['roulette', 'dice', 'race'] as const).map(g => (
          <button key={g} onClick={() => { setGame(g); setChoice(null); }}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase',
              background: game === g ? '#3d7ea6' : '#fbf4e4', color: game === g ? '#fff' : '#5a4a2f', border: '2px solid rgba(90,70,40,0.25)' }}>
            {g === 'roulette' ? 'Рулетка' : g === 'dice' ? 'Кости' : 'Гонки'}
          </button>
        ))}
      </div>

      {/* Ставки */}
      <div style={{ background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: 14, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)' }}>
        {game === 'roulette' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {betBtn('red', 'Красное', { background: choice === 'red' ? '#c98a10' : '#c0453a', color: '#fff8e6', ...(choice === 'red' ? { textShadow: '0 1px 0 rgba(0,0,0,0.35)' } : {}) }, !canBet)}
            {betBtn('black', 'Чёрное', { background: choice === 'black' ? '#c98a10' : '#2f2a1d', color: '#fff8e6', ...(choice === 'black' ? { textShadow: '0 1px 0 rgba(0,0,0,0.35)' } : {}) }, !canBet)}
            {betBtn('zero', 'Зеро x36', { background: choice === 'zero' ? '#c98a10' : '#2c7a3c', color: '#fff8e6', ...(choice === 'zero' ? { textShadow: '0 1px 0 rgba(0,0,0,0.35)' } : {}) }, !canBet)}
            {betBtn('even', 'Чёт x2', undefined, !canBet)}
            {betBtn('odd', 'Нечет x2', undefined, !canBet)}
            {betBtn('dozen1', '1-12 x3', undefined, !canBet)}
            {betBtn('dozen2', '13-24 x3', undefined, !canBet)}
            {betBtn('dozen3', '25-36 x3', undefined, !canBet)}
            {betBtn('col1', 'Столб.1 x3', undefined, !canBet)}
          </div>
        )}
        {game === 'dice' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {betBtn('under7', 'Меньше 7 x2', undefined, !canBet)}
            {betBtn('over7', 'Больше 7 x2', undefined, !canBet)}
            {betBtn('exact7', 'Ровно 7 x5', undefined, !canBet)}
            {betBtn('double', 'Дубль x30', undefined, !canBet)}
            {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(n => betBtn(`exact_${n}`, `${n} x30`, undefined, !canBet))}
          </div>
        )}
        {game === 'race' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {RACE_CARS.map(c => betBtn(c.id, `${c.emoji} ${c.name} ${c.coef} (${c.ch})`, undefined, !canBet))}
          </div>
        )}

        {/* Сумма ставки */}
        <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[100, 500, 1000, 5000, 25000].map(v => (
            <button key={v} onClick={() => { setBetAmount(v); hapticFeedback('light'); }} disabled={!canBet}
              style={{ padding: '6px 10px', borderRadius: 8, cursor: canBet ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 'bold',
                background: betAmount === v ? '#3d7ea6' : '#fbf4e4', color: betAmount === v ? '#fff' : '#5a4a2f', border: '2px solid rgba(90,70,40,0.25)', opacity: canBet ? 1 : 0.4 }}>
              {v.toLocaleString('ru')}₽
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 14, fontFamily: "'Russo One', sans-serif" }}>
          Баланс: <AnimatedNumber value={money} format={(n) => n.toLocaleString('ru-RU') + '₽'} />
        </div>
        <Btn variant="primary" onClick={placeBet} disabled={!canBet || !choice} style={{ marginTop: 10, width: '100%' }}>
          {canBet ? `Поставить ${betAmount.toLocaleString('ru')}₽` : '⛔ Приём ставок закрыт'}
        </Btn>
      </div>

      {/* Мои ставки этого раунда */}
      {myBets.length > 0 && (
        <div style={{ marginTop: 12, background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: 10 }}>
          <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>Мои ставки</div>
          {myBets.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 13, padding: '5px 6px', borderRadius: 6, borderBottom: i < myBets.length - 1 ? '1px dashed rgba(90,70,40,0.25)' : 'none', background: b.status === 'won' ? 'rgba(99,189,118,0.25)' : phase !== 'betting' && b.status !== 'pending' ? 'rgba(192,69,58,0.10)' : 'transparent', animation: b.status === 'won' ? 'neonPulse 1.2s infinite' : 'none' }}>
              <span>{b.game_type === 'roulette' ? '🎡' : b.game_type === 'dice' ? '🎲' : '🏁'} {b.bet_choice}</span>
              <span style={{ fontWeight: 'bold' }}>{b.amount.toLocaleString('ru')}₽</span>
              <span style={{ color: b.status === 'won' ? '#2c7a3c' : b.status === 'lost' ? '#c0453a' : '#6b5f45', fontWeight: b.status === 'won' ? 'bold' : 'normal' }}>
                {b.status === 'won' ? 'ВЫИГРЫШ 🎉' : b.status === 'lost' ? 'проигрыш' : 'ждём…'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
