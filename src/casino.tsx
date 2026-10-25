import { useState, useEffect, useRef, useCallback } from 'react';
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

const SPIN_MS = 5000;        // локальная длительность анимации спина (UI крутится сам, не залипает)

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
  const spinStartRef = useRef<number>(0);   // когда мы увидели spinning (для локальной анимации)
  const loadingRef = useRef(false);         // защита от наложения запросов loadRound
  const mountedRef = useRef(true);

  // тик таймера каждую секунду (отсчёт = end_time - Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const loadRound = useCallback(async () => {
    if (loadingRef.current) return; // не дёргаем сервер параллельно (realtime + поллинг + свои таймеры)
    loadingRef.current = true;
    try {
      // серверный «ленивый» цикл: доводит истёкшие/зависшие раунды и гарантирует свежий betting
      let data: any = null;
      const { data: rpcData } = await supabase.rpc('get_casino_round_rpc', { p_player_id: pid || null });
      data = rpcData;
      if (!data) {
        const { data: fallback } = await supabase.from('casino_rounds').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
        data = fallback;
      }
      if (!data) return;
      const r: Round = { id: data.id, status: data.status, end_time: Number(data.end_time), roulette_result: data.roulette_result, dice_result: data.dice_result, race_winner: data.race_winner };
      if (!mountedRef.current) return;
      // фиксируем старт локального спина при переходе betting -> spinning
      if (r.status === 'spinning' && round?.status !== 'spinning') spinStartRef.current = Date.now();
      setRound(r);
      // мои ставки этого раунда (только когда они реально могут измениться)
      if (pid && r.status !== 'spinning') {
        const { data: bets } = await supabase.from('casino_bets').select('game_type,bet_choice,amount,status').eq('player_id', pid).eq('round_id', r.id).order('created_at', { ascending: false });
        if (mountedRef.current) setMyBets(bets || []);
      }
      // история чисел (последние 10 завершённых) — обновляем только на новом раунде, не каждый поллинг
      if (lastRoundId.current !== r.id) {
        const { data: past } = await supabase.from('casino_rounds').select('roulette_result').eq('status', 'result').not('roulette_result', 'is', null).order('created_at', { ascending: false }).limit(10);
        if (mountedRef.current) setHistory((past || []).map((p: any) => p.roulette_result).reverse());
        // новый розыгрыш завершился — обновим баланс (выигрыши начисляет сервер)
        if (lastRoundId.current && r.status === 'result') {
          const { data: pl } = await supabase.from('players').select('money').eq('id', pid).maybeSingle();
          if (pl && mountedRef.current) setMoney(Number(pl.money));
        }
      }
      lastRoundId.current = r.id;
    } catch {} finally { loadingRef.current = false; }
  }, [pid]);

  // подписка на Realtime + страховочный поллинг раз в 5 сек
  useEffect(() => {
    mountedRef.current = true;
    loadRound();
    const ch = (supabase as any)
      .channel('casino_rounds_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_rounds' }, () => loadRound())
      .subscribe();
    const poll = setInterval(loadRound, 5000);
    return () => { mountedRef.current = false; clearInterval(poll); (supabase as any).removeChannel(ch); };
  }, [pid, loadRound]);

  // фаза result длится 10 сек — по истечении сами дёргаем сервер, тот закроет раунд и откроет новый betting
  useEffect(() => {
    if (round?.status === 'result') {
      const t = setTimeout(loadRound, 11000);
      return () => clearTimeout(t);
    }
  }, [round?.id, round?.status, loadRound]);

  // страховка от ВЕЧНОГО СПИНА: если сервер завис в spinning — через пару секунд дёрнем тик,
  // сервер (ensure_round/casino_advance) принудительно доведёт зависший раунд и откроет новый
  useEffect(() => {
    if (round?.status === 'spinning') {
      const t = setTimeout(loadRound, SPIN_MS + 2000);
      return () => clearTimeout(t);
    }
  }, [round?.id, round?.status, loadRound]);

  const phase = round?.status || 'betting';
  const msLeft = round ? Math.max(0, round.end_time - now) : 0;
  const canBet = phase === 'betting' && msLeft > 1500; // запас на сетевую задержку
  // локальная анимация спина: крутим ONLY выбранный барабан максимум SPIN_MS секунд.
  // Даже если сервер завис в 'spinning', UI никогда не залипает: анимация заканчивается,
  // а страховочный тик выше дотянет сервер до нового раунда.
  const spinElapsed = phase === 'spinning' ? Math.max(0, now - spinStartRef.current) : 0;
  const isSpinning = phase === 'spinning' && spinElapsed < SPIN_MS;
  const wheelColor = (n: number) => n === 0 ? '#2c7a3c' : RED_NUMBERS.includes(n) ? '#c0453a' : '#2f2a1d';

  // число-мигалка во время локальной анимации (покажем реальное только в фазе result)
  const [fakeNum, setFakeNum] = useState<number | null>(null);
  useEffect(() => {
    if (!isSpinning || game !== 'roulette') { setFakeNum(null); return; }
    const t = setInterval(() => setFakeNum(Math.floor(Math.random() * 37)), 90);
    return () => clearInterval(t);
  }, [isSpinning, game]);

  // рандомные грани кубиков во время анимации (только на вкладке Кости)
  const [fakeDice, setFakeDice] = useState<[number, number]>([1, 1]);
  useEffect(() => {
    if (!isSpinning || game !== 'dice') return;
    const t = setInterval(() => setFakeDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]), 120);
    return () => clearInterval(t);
  }, [isSpinning, game]);

  // прогресс гонки 0..1 для анимации машин (только на вкладке Гонки)
  const raceProgress = (game === 'race' && isSpinning) ? Math.min(1, spinElapsed / SPIN_MS) : 0;

  const DICE_PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieFace = (v: number, rolling: boolean, delay: string) => (
    <div key={rolling ? `${v}-${delay}` : `st-${v}`} style={{ width: 54, height: 54, background: '#fbf4e4', border: '3px solid #5a4a2f', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', padding: 6, gap: 2, animation: rolling ? `casinoDiceRoll 0.6s ease-in-out infinite` : 'none', animationDelay: delay }}>
      {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ width: '100%', height: '100%', borderRadius: '50%', background: DICE_PIPS[v]?.includes(i) ? '#2f2a1d' : 'transparent', alignSelf: 'center', justifySelf: 'center' }} />)}
    </div>
  );

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

  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>🎰 Казино «Золотое дно»</h2>

      {/* Табло фазы — свой текст под каждую игру */}
      <div style={{ background: '#2f2a1d', color: '#ffd23f', borderRadius: 10, padding: '12px 16px', margin: '10px 0', fontFamily: "'Russo One', sans-serif", boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(90,70,40,0.35)' }}>
        {phase === 'betting' && <>⏳ Приём ставок: <span style={{ color: msLeft < 6000 ? '#ff9a8d' : '#ffd23f' }}>{Math.ceil(msLeft / 1000)}с</span></>}
        {isSpinning && game === 'roulette' && <>🎡 Крутим барабан…</>}
        {isSpinning && game === 'dice' && <>🎲 Кости летят по столу…</>}
        {isSpinning && game === 'race' && <>🏁 Машины на старте, гонка пошла!</>}
        {phase === 'spinning' && !isSpinning && <>⏸ Розыгрыш задерживается, ждём новый раунд…</>}
        {phase === 'result' && <>✅ Итоги раунда! Новый через <span style={{ color: '#ffd23f' }}>{Math.max(0, Math.ceil((round ? Number(round.end_time) - now : 0) / 1000))}с</span></>}
      </div>

      {/* Визуал текущей игры: крутится ТОЛЬКО активная вкладка */}
      <div style={{ margin: '8px 0' }}>
        {game === 'roulette' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isSpinning
              ? <div key="reel" style={{ width: 54, height: 54, borderRadius: '50%', background: fakeNum != null ? wheelColor(fakeNum) : '#2f2a1d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Russo One', sans-serif", fontSize: 22, border: '3px solid #f2b632', animation: `casinoReel ${SPIN_MS}ms cubic-bezier(0.15, 0.9, 0.25, 1) forwards` }}>{fakeNum ?? '🎡'}</div>
              : round?.roulette_result != null && <div style={{ width: 54, height: 54, borderRadius: '50%', background: wheelColor(round.roulette_result), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Russo One', sans-serif", fontSize: 22, border: '3px solid #f2b632' }}>{round.roulette_result}</div>}
            {!isSpinning && phase !== 'betting' && round?.roulette_result == null && <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#2f2a1d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '3px solid #f2b632' }}>🎡</div>}
          </div>
        )}
        {game === 'dice' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {isSpinning ? (
              <>
                {dieFace(fakeDice[0], true, '0s')}
                {dieFace(fakeDice[1], true, '0.15s')}
              </>
            ) : round?.dice_result != null ? (
              (() => {
                // покажем два кубика, дающие сумму результата (или один кубик = результат, если не разложить)
                const d1 = Math.min(6, Math.max(1, (round.dice_result ?? 7) - 6));
                const d2 = (round.dice_result ?? 7) - d1;
                return (
                  <>
                    {dieFace(d1, false, '0s')}
                    {dieFace(d2, false, '0s')}
                    <div style={{ padding: '8px 14px', background: '#fbf4e4', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 8, fontFamily: "'Russo One', sans-serif" }}>Σ {round.dice_result}</div>
                  </>
                );
              })()
            ) : (
              <div style={{ padding: '8px 14px', background: '#fbf4e4', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 8, fontFamily: "'Russo One', sans-serif" }}>🎲 Ждём розыгрыш</div>
            )}
          </div>
        )}
        {game === 'race' && (
          <div style={{ background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: '10px 12px', textAlign: 'left' }}>
            {isSpinning ? (
              RACE_CARS.map((c, idx) => (
                <div key={c.id} style={{ position: 'relative', height: 30, marginBottom: 6, overflow: 'hidden', borderBottom: idx < RACE_CARS.length - 1 ? '1px dashed rgba(90,70,40,0.3)' : 'none' }}>
                  <span style={{ position: 'absolute', left: 0, top: 4, fontSize: 12, fontFamily: "'Russo One', sans-serif", color: '#6b5f45', zIndex: 1 }}>{c.emoji} {c.name}</span>
                  <span style={{ position: 'absolute', top: 2, fontSize: 20, left: `calc(12% + ${raceProgress * (78 - idx * 3)}%)`, transition: 'left 0.4s linear' }}>💨{c.emoji}</span>
                  <span style={{ position: 'absolute', right: 0, top: 4, fontSize: 16 }}>🏁</span>
                </div>
              ))
            ) : round?.race_winner ? (
              <div style={{ fontFamily: "'Russo One', sans-serif", textAlign: 'center' }}>🏆 Победил: {RACE_CARS.find(c => c.id === round.race_winner)?.emoji} {RACE_CARS.find(c => c.id === round.race_winner)?.name || round.race_winner}</div>
            ) : (
              <div style={{ fontFamily: "'Russo One', sans-serif", textAlign: 'center', color: '#6b5f45' }}>🏁 Трасса ждёт старта</div>
            )}
          </div>
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
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < myBets.length - 1 ? '1px dashed rgba(90,70,40,0.25)' : 'none' }}>
              <span>{b.game_type === 'roulette' ? '🎡' : b.game_type === 'dice' ? '🎲' : '🏁'} {b.bet_choice}</span>
              <span style={{ fontWeight: 'bold' }}>{b.amount.toLocaleString('ru')}₽</span>
              <span style={{ color: b.status === 'won' ? '#2c7a3c' : b.status === 'lost' ? '#c0453a' : '#6b5f45' }}>
                {b.status === 'won' ? 'ВЫИГРЫШ 🎉' : b.status === 'lost' ? 'проигрыш' : 'ждём…'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
