import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Btn } from './components';
import { AnimatedNumber } from './AnimatedNumber';
import { playUiSound } from './sound';

// Рулетка и кости используют общий раунд; слоты запускаются отдельно для игрока.

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const colorOf = (n: number) => (n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black');
const DICE_EXACT_MULTIPLIERS: Record<number, number> = { 2: 30, 3: 15, 4: 10, 5: 7.5, 6: 6, 7: 5, 8: 6, 9: 7.5, 10: 10, 11: 15, 12: 30 };

type Round = { id: string; status: 'betting' | 'spinning' | 'result'; end_time: number; roulette_result: number | null; dice_result: number | null; dice_first: number | null; dice_second: number | null; bet_count: number; bet_total: number };

const SPIN_MS = 5000;        // длительность анимации спина; сервер держит spinning ровно столько же
// easing for roulette wheel only.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const SLOT_SYMBOLS = ['7️⃣', '💎', '🔔', '🍒', '🍋', '⭐'];
const SLOT_PAYTABLE = [
  { combo: '7️⃣ 7️⃣ 7️⃣', multiplier: 20, label: 'Три семёрки' },
  { combo: '💎 💎 💎', multiplier: 12, label: 'Три алмаза' },
  { combo: '🔔 🔔 🔔', multiplier: 8, label: 'Три колокольчика' },
  { combo: '🍒 🍒 🍒', multiplier: 5, label: 'Три вишни' },
  { combo: '🍋 🍋 🍋', multiplier: 3, label: 'Три лимона' },
  { combo: '⭐ ⭐ ⭐', multiplier: 4, label: 'Три звезды' },
  { combo: 'Любая пара одинаковых', multiplier: 1.5, label: 'Пара' },
];
type SlotSpin = { id?: string; symbols: string[]; amount: number; payout: number; multiplier: number; net: number; created_at?: string };
export const CasinoTab = ({ app }: { app: any }) => {
  const { pid, money, setMoney, showMsg, hapticFeedback, action } = app;
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(Date.now());
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [lastServerSyncAt, setLastServerSyncAt] = useState(0);
  const [syncIssue, setSyncIssue] = useState(false);
  const [game, setGame] = useState<'roulette' | 'dice' | 'slots'>('roulette');
  const [choice, setChoice] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1000);
  const allInBet = Math.min(100000, Math.floor(Number(money) || 0));
  const [myBets, setMyBets] = useState<any[]>([]);
  const [rouletteHistory, setRouletteHistory] = useState<number[]>([]);
  const [diceHistory, setDiceHistory] = useState<number[]>([]);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotDisplay, setSlotDisplay] = useState<string[]>(['🍒', '7️⃣', '💎']);
  const [slotResult, setSlotResult] = useState<SlotSpin | null>(null);
  const [slotHistory, setSlotHistory] = useState<SlotSpin[]>([]);
  const lastRoundId = useRef<string | null>(null);
  const lastObservedPhase = useRef<Round['status'] | null>(null);
  const pendingLoadRef = useRef(false);
  const loadingRef = useRef(false);         // защита от наложения запросов loadRound
  const mountedRef = useRef(true);
  const realtimeRefreshRef = useRef<number | null>(null);
  const serverDriftRef = useRef(0);         // поправка «серверные часы минус локальные»

  // тик: 100мс во время спина (плавная анимация), 1с в остальных фазах
  useEffect(() => {
    const fast = round?.status === 'spinning';
    const t = setInterval(() => setNow(Date.now()), fast ? 100 : 1000);
    return () => clearInterval(t);
  }, [round?.status]);

  const loadRound = useCallback(async () => {
    if (loadingRef.current) { pendingLoadRef.current = true; return; }
    if (loadingRef.current) return; // не дёргаем сервер параллельно (realtime + поллинг + свои таймеры)
    loadingRef.current = true;
    try {
      // серверный «ленивый» цикл: доводит истёкшие/зависшие раунды и гарантирует свежий betting
      let data: any = null;
      const requestStartedAt = Date.now();
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_casino_round_rpc', { p_player_id: pid || null });
      if (rpcError) {
        if (mountedRef.current) setSyncIssue(true);
        return;
      }
      data = rpcData;
      if (mountedRef.current) {
        setLastServerSyncAt(Date.now());
        setSyncIssue(false);
      }
      if (Number.isFinite(Number(data?.server_now))) {
        // Используем серверное время ответа, а не начало фазы: иначе каждый polling
        // прибавлял уже прошедшие секунды обратно к таймеру.
        const requestMidpoint = (requestStartedAt + Date.now()) / 2;
        serverDriftRef.current = Number(data.server_now) - requestMidpoint;
      }
      if (!data) {
        if (mountedRef.current) setRound(null);
        return;
      }
      const r: Round = { id: data.id, status: data.status, end_time: Number(data.end_time), roulette_result: data.roulette_result, dice_result: data.dice_result, dice_first: data.dice_first ?? null, dice_second: data.dice_second ?? null, bet_count: Number(data.bet_count) || 0, bet_total: Number(data.bet_total) || 0 };
      if (!mountedRef.current) return;
      setRound(r);
      const previousPhase = lastObservedPhase.current;
      if (r.status === 'spinning' && previousPhase !== 'spinning') playUiSound('casinoSpin');
      if (r.status === 'result' && previousPhase === 'spinning') {
        const settledBets = data.my_bets || [];
        if (settledBets.length) playUiSound(settledBets.some((bet: any) => bet.status === 'won') ? 'casinoWin' : 'casinoLose');
      }
      lastObservedPhase.current = r.status;
      if (r.status === 'result' && typeof data.player_money === 'number' && mountedRef.current) setMoney(Number(data.player_money));
      // мои ставки этого раунда (только когда они реально могут измениться)
      if (pid && r.status !== 'spinning' && mountedRef.current) setMyBets(data.my_bets || []);
      // история чисел (последние 10 завершённых) — обновляем только на новом раунде, не каждый поллинг
      if (lastRoundId.current !== r.id) {
        const past = data.history || [];
        if (mountedRef.current) {
          const rounds = [...past].reverse();
          setRouletteHistory(rounds.map((p: any) => p.roulette_result).filter((n: number | null) => n != null));
          setDiceHistory(rounds.map((p: any) => p.dice_result).filter((n: number | null) => n != null));
        }
        // новый розыгрыш завершился — обновим баланс (выигрыши начисляет сервер)
        if (lastRoundId.current && r.status === 'result') {
          if (typeof data.player_money === 'number' && mountedRef.current) setMoney(Number(data.player_money));
        }
      }
      lastRoundId.current = r.id;
    } catch {
      if (mountedRef.current) setSyncIssue(true);
    } finally {
      loadingRef.current = false;
      if (pendingLoadRef.current) {
        pendingLoadRef.current = false;
        window.setTimeout(() => { if (mountedRef.current) void loadRound(); }, 80);
      }
    }
  }, [pid]);

  // подписка на Realtime + страховочный поллинг раз в 5 сек
  useEffect(() => {
    mountedRef.current = true;
    if (game === 'slots') return () => { mountedRef.current = false; };
    loadRound();
    const channel = supabase.channel('casino-live-round')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_rounds' }, () => {
        if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current);
        realtimeRefreshRef.current = window.setTimeout(() => {
          realtimeRefreshRef.current = null;
          if (mountedRef.current) void loadRound();
        }, 120);
      })
      .subscribe((status: string) => {
        if (mountedRef.current) setRealtimeReady(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED' && mountedRef.current) void loadRound();
      });
    const poll = window.setInterval(() => {
      if (!realtimeReady) void loadRound();
    }, 60000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(poll);
      if (realtimeRefreshRef.current !== null) window.clearTimeout(realtimeRefreshRef.current);
      realtimeRefreshRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [pid, loadRound, game, realtimeReady]);

  useEffect(() => {
    if (game !== 'slots' || !pid) return;
    let cancelled = false;
    void supabase.rpc('casino_slots_history_rpc', { p_player_id: pid }).then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray((data as any)?.history)) setSlotHistory((data as any).history);
    });
    return () => { cancelled = true; };
  }, [game, pid]);

  useEffect(() => {
    if (!slotSpinning) return;
    const timer = window.setInterval(() => setSlotDisplay([
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ]), 90);
    return () => window.clearInterval(timer);
  }, [slotSpinning]);

  // «серверное» время (локальное + измеренная поправка) — все анимации считаются ОТ него,
  // поэтому рулетка и кости синхронны с общим серверным раундом
  const serverNow = now + serverDriftRef.current;
  const phase = round?.status || 'betting';
  const msLeft = round ? Math.max(0, round.end_time - serverNow) : 0;
  const msLeftInt = Math.ceil(msLeft / 1000);
  const phaseOverdueSeconds = round ? Math.max(0, Math.ceil((serverNow - round.end_time) / 1000)) : 0;
  const canBet = phase === 'betting' && msLeft > 1500; // запас на сетевую задержку
  const syncAgeSeconds = lastServerSyncAt ? Math.max(0, Math.floor((now - lastServerSyncAt) / 1000)) : null;
  const syncStatus = syncAgeSeconds === null
    ? 'Подключение к серверу…'
    : syncIssue
      ? `Ошибка синхронизации · ответ ${syncAgeSeconds}с назад`
      : syncAgeSeconds > 30
        ? `Казино не отвечает · ${syncAgeSeconds}с без ответа`
        : realtimeReady
          ? 'LIVE · сервер отвечает'
          : 'Сервер отвечает · резервный опрос';
  const syncColor = syncAgeSeconds !== null && (syncIssue || syncAgeSeconds > 30) ? '#bb3434' : syncAgeSeconds !== null ? '#2c7a3c' : '#9b6a18';

  // прогресс спина 0..1 — считаем от end_time раунда, а НЕ от момента, когда клиент увидел статус.
  // Анимация всегда доходит до конца и ОСТАНАВЛИВАЕТСЯ (не рестартует), даже если сервер запаздывает
  // с переходом в 'result': после t>=1 держим финальную картинку и ждём итоги.
  const spinT = phase === 'spinning' ? Math.min(1, Math.max(0, 1 - msLeft / SPIN_MS)) : 0;
  const spinningVisible = phase === 'spinning';
  const spinDoneWaitingResult = phase === 'spinning' && serverNow >= round!.end_time; // спин доиграл, ждём resolve
  const wheelColor = (n: number) => n === 0 ? '#2c7a3c' : RED_NUMBERS.includes(n) ? '#c0453a' : '#2f2a1d';

  // явный старт спина: как только время ставок вышло, просим сервер заранее разыграть итоги
  // и открыть фазу 'spinning' на SPIN_MS. Ставки при этом ещё НЕ рассчитаны — resolve произойдёт
  // автоматически по окончании спина, поэтому анимация гарантированно проигрывается ЦЕЛИКОМ.

  // рандомные грани кубиков пока идёт анимация (только на вкладке Кости); по окончании — стоп
  const [fakeDice, setFakeDice] = useState<[number, number]>([1, 1]);
  useEffect(() => {
    if (phase !== 'spinning' || game !== 'dice' || spinT >= 1) return;
    const t = setInterval(() => setFakeDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]), 120);
    return () => clearInterval(t);
  }, [phase, game, spinT >= 1]);

  const DICE_PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const DICE_ROTATION: Record<number, string> = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateX(0deg) rotateY(-90deg)', 3: 'rotateX(-90deg) rotateY(0deg)', 4: 'rotateX(90deg) rotateY(0deg)', 5: 'rotateX(0deg) rotateY(90deg)', 6: 'rotateX(0deg) rotateY(180deg)' };
  const dieFace = (v: number, rolling: boolean, delay: string) => (
    <div key={`die-${delay}`} style={{ width: 66, height: 66, perspective: 420, margin: 4, animation: rolling ? 'casinoDieTumble .72s ease-in-out infinite' : 'none', animationDelay: delay }}>
      <div style={{ position: 'relative', width: 48, height: 48, margin: 8, transformStyle: 'preserve-3d', transform: DICE_ROTATION[v], transition: `transform ${rolling ? '100ms' : '420ms'} cubic-bezier(.2,.75,.25,1)` }}>
        {([
          ['front', 'translateZ(24px)', 1], ['back', 'rotateY(180deg) translateZ(24px)', 6],
          ['right', 'rotateY(90deg) translateZ(24px)', 2], ['left', 'rotateY(-90deg) translateZ(24px)', 5],
          ['top', 'rotateX(90deg) translateZ(24px)', 3], ['bottom', 'rotateX(-90deg) translateZ(24px)', 4],
        ] as const).map(([side, transform, value]) => (
          <div key={side} style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', padding: 5, gap: 2, borderRadius: 8, background: 'linear-gradient(145deg,#fffdf5,#e8d8b5)', border: '2px solid #6d5734', boxShadow: 'inset 0 1px 3px rgba(60,40,10,.2)', boxSizing: 'border-box', transform, backfaceVisibility: 'hidden' }}>
            {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: DICE_PIPS[value]?.includes(i) ? '#2f2a1d' : 'transparent', alignSelf: 'center', justifySelf: 'center' }} />)}
          </div>
        ))}
      </div>
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
    showMsg(`Ставка принята: ${(data as any).money >= 0 ? betAmount.toLocaleString('ru') : ''}₽`, false, 'casinoBet');
    loadRound();
  });

  const spinSlots = () => action(async () => {
    if (!pid) throw new Error('Сначала зарегистрируйся');
    if (!Number.isSafeInteger(betAmount) || betAmount < 100 || betAmount > 100000) throw new Error('Ставка от 100 до 100 000 ₽');
    if (Number(money) < betAmount) throw new Error('Недостаточно денег');
    setSlotResult(null);
    setSlotSpinning(true);
    playUiSound('casinoSpin');
    try {
      const { data, error } = await supabase.rpc('casino_slots_spin_rpc', {
        p_player_id: pid,
        p_amount: betAmount,
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as SlotSpin & { money: number };
      await new Promise(resolve => window.setTimeout(resolve, 1300));
      setMoney(Number(result.money));
      setSlotDisplay(result.symbols);
      setSlotResult(result);
      setSlotHistory(previous => [result, ...previous].slice(0, 10));
      hapticFeedback(result.payout > 0 ? 'heavy' : 'medium');
      playUiSound(result.payout > 0 ? 'casinoWin' : 'casinoLose');
      showMsg(result.payout > 0
        ? `Выигрыш ${Number(result.payout).toLocaleString('ru-RU')} ₽ · x${result.multiplier}`
        : `Комбинация не сыграла · −${betAmount.toLocaleString('ru-RU')} ₽`, false, result.payout > 0 ? 'reward' : 'casinoLose');
    } finally {
      setSlotSpinning(false);
    }
  });

  const betBtn = (val: string, label: string, style?: any, disabled?: boolean) => (
    <button key={val} className={`casino-bet-option${choice === val ? ' is-selected' : ''}`} onClick={() => { if (!disabled) { setChoice(val); hapticFeedback('light'); } }}
      style={{ padding: '10px 6px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase',
        background: choice === val ? '#c98a10' : '#fbf4e4', color: choice === val ? '#fff8e6' : '#5a4a2f',
        border: choice === val ? '2px solid #8a5d0a' : '2px solid rgba(90,70,40,0.25)', opacity: disabled ? 0.4 : 1, ...style }}>{label}</button>
  );

  return (
    <div className="casino-page" style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>🎰 Казино «Золотое дно»</h2>

      {/* Табло фазы — свой текст под каждую игру */}
      {game !== 'slots' && <div className="casino-phase-panel" data-phase={round?.status || 'loading'} style={{ background: '#2f2a1d', color: '#ffd23f', borderRadius: 10, padding: '12px 16px', margin: '10px 0', fontFamily: "'Russo One', sans-serif", boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(90,70,40,0.35)' }}>
        {!round && <>{'\u23F3'} {syncIssue ? '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0440\u0430\u0443\u043d\u0434 \u00b7 \u0436\u0434\u0451\u043c \u043e\u0442\u0432\u0435\u0442\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' : syncAgeSeconds !== null ? '\u0420\u0430\u0443\u043d\u0434 \u0435\u0449\u0451 \u043d\u0435 \u0441\u043e\u0437\u0434\u0430\u043d \u00b7 \u0441\u0435\u0440\u0432\u0435\u0440 \u043e\u0442\u0432\u0435\u0447\u0430\u0435\u0442' : '\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0430\u0435\u043c\u0441\u044f \u043a \u0440\u0430\u0443\u043d\u0434\u0443\u2026'}</>}
        {round && phase === 'betting' && msLeft > 0 && <>{'\u23f1'} {'\u041f\u0440\u0438\u0451\u043c \u0441\u0442\u0430\u0432\u043e\u043a \u00b7 \u0434\u043e \u0441\u043f\u0438\u043d\u0430'} <span style={{ color: msLeft < 6000 ? '#ff9a8d' : '#ffd23f' }}>{msLeftInt}{'\u0441'}</span></>}
        {round && phase === 'betting' && msLeft <= 0 && <>{'\u23f3'} {'\u0421\u0442\u0430\u0432\u043a\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u044b \u00b7 \u0437\u0430\u043f\u0443\u0441\u043a \u0441\u043f\u0438\u043d\u0430 \u0437\u0430\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f'} {phaseOverdueSeconds}{'\u0441'}</>}
        {round && phase === 'spinning' && !spinDoneWaitingResult && <>{game === 'roulette' ? '\u{1F3A1} \u041a\u043e\u043b\u0435\u0441\u043e \u043a\u0440\u0443\u0442\u0438\u0442\u0441\u044f' : game === 'dice' ? '\u{1F3B2} \u041a\u043e\u0441\u0442\u0438 \u0431\u0440\u043e\u0441\u0430\u044e\u0442\u0441\u044f' : '\u{1F3C1} \u0418\u0434\u0451\u0442 \u0433\u043e\u043d\u043a\u0430'} {'\u00b7 \u0434\u043e \u0438\u0442\u043e\u0433\u0430'} <span style={{ color: '#ffd23f' }}>{msLeftInt}{'\u0441'}</span></>}
        {round && phase === 'spinning' && spinDoneWaitingResult && <>{'\u23f3'} {'\u0421\u043f\u0438\u043d \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d \u00b7 \u0436\u0434\u0451\u043c \u0440\u0430\u0441\u0447\u0451\u0442 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430'} {phaseOverdueSeconds}{'\u0441'}</>}
        {round && phase === 'result' && <>{'\u2705'} {'\u0418\u0442\u043e\u0433\u0438 \u0440\u0430\u0443\u043d\u0434\u0430 \u00b7 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0447\u0435\u0440\u0435\u0437'} <span style={{ color: '#ffd23f' }}>{msLeftInt}{'\u0441'}</span></>}
      </div>}
      {game !== 'slots' && <div className="casino-round-meta" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', margin: '-3px 0 10px', color: '#6b5f45', fontSize: 12 }}>
        <span>👥 Ставок в раунде: <b>{round?.bet_count || 0}</b> · сумма: <b>{(round?.bet_total || 0).toLocaleString('ru-RU')}₽</b></span>
        <span style={{ color: syncColor }}>{'\u25CF'} {syncStatus}</span>
      </div>}

      {/* Визуал текущей игры: крутится ТОЛЬКО активная вкладка */}
      <div className="casino-visual-stage" style={{ margin: '8px 0' }}>
        {game === 'roulette' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              // ВНЕ фазы спина колесо стоит (в приёме ставок — эмодзи в центре), никаких «барабанов».
              if (!spinningVisible && round?.roulette_result == null) return (
                <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '16px solid #f2b632', zIndex: 4 }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #f2b632', boxShadow: '0 4px 14px rgba(0,0,0,0.4), inset 0 0 0 4px #241f14', background: `conic-gradient(${Array.from({ length: 12 }).map((_, i) => `${wheelColor(Math.round(i * 3))} ${i * 30}deg ${(i + 1) * 30}deg`).join(', ')})` }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: '50%', background: '#241f14', border: '3px solid #f2b632', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, zIndex: 3 }}>
                    {round?.roulette_result != null ? round.roulette_result : '🎡'}
                  </div>
                </div>
              );
              // НАСТОЯЩЕЕ КОЛЕСО рулетки: 12 цветных секторов с числами, физический поворот от
              // прогресса спина (быстро -> замедление -> точная остановка), золотой указатель сверху.
              // Внутренний барабан крутится в ОБРАТНУЮ сторону и показывает меняющиеся числа/цвета.
              // После t>=1 колесо стоит на РЕАЛЬНОМ результате сервера и ждёт фазу итогов (без рестарта).
              const SEGMENTS = 37, segAngle = 360 / SEGMENTS;
              const numbers: number[] = [];
              for (let i = 0; i < SEGMENTS; i++) numbers.push(Math.round((i * 36) / (SEGMENTS - 1))); // 0..36 по кругу
              const spinningNow = phase === 'spinning';
              const e = easeOutCubic(spinT);                 // 0..1 прогресс спина (с замедлением)
              const resultNum = round?.roulette_result ?? null;
              // сектор ПОД указателем (0° сверху): сектор i занимает [i*segAngle,(i+1)*segAngle)
              const sectorUnder = (rot: number) => {
                const a = ((360 - (((rot % 360) + 360) % 360)) % 360 + segAngle / 2) % 360;
                return Math.floor(a / segAngle) % SEGMENTS;
              };
              // ВНЕШНЕЕ колесо: непрерывный поворот без рывков. Как только сервер опубликовал
              // итог, колесо ПЛАВНО доворачивается (за ~0.5с), чтобы РЕАЛЬНОЕ число встало ровно
              // под золотой указатель — как в настоящей рулетке.
              const WHEEL_SPIN_DEG = resultNum != null ? 360 * 9 - (resultNum + 0.5) * segAngle : 360 * 9;
              const baseRot = WHEEL_SPIN_DEG * (spinningNow ? e : 1);
              const finalMod = null;
              let wheelRot = baseRot;
              if (finalMod != null) {
                // цель = следующий полный оборот после фазы ставок + короткий финальный доворот (<=90°)
                const target = 360 + finalMod;
                const d = (((target - baseRot) % 360) + 360) % 360;
                wheelRot = baseRot + (d > 180 ? d - 360 : d);
              }
              // переход включаем только когда колесо реально доворачиваем (остановка/финишная доводка)
              const wheelTrans = spinningNow ? 'transform 0.1s linear' : 'none';
              // центральное число: во время вращения — сектор под указателем (чуть с опережением,
              // чтобы финальное значение совпало с остановкой); после остановки — реальный итог
              const centerNum = resultNum != null && (spinT >= 1 || !spinningNow)
                ? resultNum
                : numbers[sectorUnder(wheelRot)];
              // ВНУТРЕННИЙ БАРАБАН: крутится в ОБРАТНУЮ сторону и быстрее — числа и цвета реально
              // «пролетают» как в настоящем автомате; после t>=1 останавливается (без рестарта)
              const REEL = 10;
              const reelRot = spinningNow ? -(3600 * e) : round?.roulette_result != null ? -3600 : 0;
              const reelOffset = 0;
              const reelNums = Array.from({ length: REEL }, (_, i) => (reelOffset + i) % 37);
              const ballAngle = -90 - 1440 * (1 - (spinningNow ? e : 1));
              return (
                <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
                  {/* золотой указатель (неподвижен) */}
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '16px solid #f2b632', zIndex: 4, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
                  {/* внешнее вращающееся колесо с секторами */}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #f2b632', boxShadow: '0 4px 14px rgba(0,0,0,0.4), inset 0 0 0 4px #241f14', background: `conic-gradient(${numbers.map((n, i) => `${wheelColor(n)} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(', ')})`, transform: `rotate(${wheelRot}deg)`, transition: wheelTrans }}>
                    {numbers.map((n, i) => (
                      <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${i * segAngle + segAngle / 2}deg) translateY(-94px)` }}>
                        <span style={{ position: 'absolute', left: -7, top: -7, width: 14, height: 14, borderRadius: '50%', background: 'rgba(15,12,6,0.72)', color: '#fff8e6', fontSize: 7, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${-(i * segAngle + segAngle / 2) - wheelRot}deg)` }}>{n}</span>
                      </div>
                    ))}
                    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#fff,#ffd66b 48%,#a95c14)', boxShadow: '0 1px 5px #100b04', zIndex: 5, transform: `rotate(${ballAngle - wheelRot}deg) translateY(-108px)` }} />
                  </div>
                  {/* внутренний барабан: крутится в обратку, числа+цвет меняются как в настоящем автомате */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 116, height: 116, marginLeft: -58, marginTop: -58, borderRadius: '50%', overflow: 'hidden', border: '4px solid #f2b632', boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.7), 0 0 0 3px #241f14', background: `conic-gradient(${Array.from({ length: REEL }, (_, i) => `${i % 2 ? '#9b7131' : '#d9b35c'} ${i * 360 / REEL}deg ${(i + 1) * 360 / REEL}deg`).join(', ')})`, transform: `rotate(${reelRot}deg)`, transition: spinningNow ? 'transform 0.1s linear' : 'none' }}>
                    {reelNums.map((n, i) => (
                      <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${i * (360 / REEL)}deg) translateY(-43px)` }}>
                        <span style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: '50%', background: wheelColor(n), border: '1px solid #f6d98d', color: '#fff', fontSize: 7, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                      </div>
                    ))}
                  </div>
                  {/* центральный диск: число ПОД указателем (в момент остановки — реальный результат) */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: '50%', background: wheelColor(centerNum), border: '2px solid #f2b632', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Russo One', sans-serif", fontSize: 15, zIndex: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>{centerNum}</div>
                </div>
              );
            })()}
          </div>
        )}
        {game === 'dice' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {phase === 'spinning' ? (
              spinT >= 1 && round?.dice_result != null ? (
                // кости долетели — показываем реальные значения сразу, как анимация закончилась,
                // и спокойно ждём фазу итогов (без рестарта кручения)
                (() => {
                  const d1 = round.dice_first ?? Math.min(6, Math.max(1, (round.dice_result ?? 7) - 6));
                  const d2 = round.dice_second ?? ((round.dice_result ?? 7) - d1);
                  return (<>
                    {dieFace(d1, false, '0s')}
                    {dieFace(d2, false, '0s')}
                    <div style={{ padding: '8px 14px', background: '#fbf4e4', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 8, fontFamily: "'Russo One', sans-serif" }}>Σ {round.dice_result}</div>
                  </>);
                })()
              ) : (
                <>
                  {dieFace(fakeDice[0], true, '0s')}
                  {dieFace(fakeDice[1], true, '0.15s')}
                </>
              )
            ) : round?.dice_result != null ? (
              (() => {
                // покажем два кубика, дающие сумму результата (или один кубик = результат, если не разложить)
                const d1 = round.dice_first ?? Math.min(6, Math.max(1, (round.dice_result ?? 7) - 6));
                const d2 = round.dice_second ?? ((round.dice_result ?? 7) - d1);
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
        {game === 'slots' && <div style={{ width: '100%', maxWidth: 370, margin: '0 auto', padding: 16, borderRadius: 16, border: '2px solid #c69335', background: 'linear-gradient(145deg,#332519,#17130e)', boxShadow: '0 8px 22px rgba(30,20,8,.3)' }}>
          <div style={{ color: '#f8d876', fontFamily: "'Russo One', sans-serif", fontSize: 13, marginBottom: 12 }}>СЛОТОВЫЙ АВТОМАТ · ТВОЙ ЛИЧНЫЙ СПИН</div>
          <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: 10, borderRadius: 12, background: '#f7eed9', border: '3px solid #bd8730' }}>
            {slotDisplay.map((symbol, index) => <div key={index} className={slotSpinning ? 'casino-slot-reel is-spinning' : 'casino-slot-reel'} style={{ minHeight: 74, display: 'grid', placeItems: 'center', borderRadius: 9, background: 'linear-gradient(180deg,#fffdf5,#e8d8b5)', boxShadow: 'inset 0 2px 5px rgba(80,50,10,.2)', fontSize: 'clamp(34px, 12vw, 54px)' }}>{symbol}</div>)}
          </div>
          <div style={{ minHeight: 24, marginTop: 10, color: slotResult?.payout ? '#ffdf72' : '#e6dbc7', fontWeight: 700 }}>
            {slotSpinning ? 'Крутятся барабаны…' : slotResult ? slotResult.payout ? `Выплата x${slotResult.multiplier} · +${slotResult.net.toLocaleString('ru-RU')} ₽` : `Не повезло · −${slotResult.amount.toLocaleString('ru-RU')} ₽` : 'Сделай ставку и нажми «Крутить»'}
          </div>
        </div>}
      </div>

      {/* История выбранной игры */}
      {game === 'roulette' && rouletteHistory.length > 0 && (
        <div className="casino-history-row" style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {rouletteHistory.map((n, i) => <span className="casino-history-chip" key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: wheelColor(n), color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{n}</span>)}
        </div>
      )}
      {game === 'dice' && diceHistory.length > 0 && (
        <div className="casino-history-row" style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {diceHistory.map((sum, i) => <span className="casino-history-chip" key={i} style={{ padding: '4px 8px', borderRadius: 7, background: '#fbf4e4', color: '#5a4a2f', border: '1px solid rgba(90,70,40,.25)', fontSize: 12, fontWeight: 'bold' }}>🎲 {sum}</span>)}
        </div>
      )}
      {game === 'slots' && slotHistory.length > 0 && <div className="casino-my-bets" style={{ margin: '0 0 12px', background: 'var(--surface-raised)', border: '1px solid var(--surface-line)', borderRadius: 12, padding: 10, textAlign: 'left' }}>
        <b style={{ fontSize: 12 }}>ТВОЯ ИСТОРИЯ СЛОТОВ</b>
        {slotHistory.slice(0, 5).map((spin, index) => <div key={spin.id || `${spin.created_at}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px dashed var(--surface-line)', fontSize: 13 }}>
          <span>{spin.symbols.join(' ')} · ставка {spin.amount.toLocaleString('ru-RU')} ₽</span><b style={{ color: spin.payout > 0 ? '#2c7a3c' : '#c0453a' }}>{spin.payout > 0 ? `x${spin.multiplier} · +${spin.net.toLocaleString('ru-RU')} ₽` : `${spin.net.toLocaleString('ru-RU')} ₽`}</b>
        </div>)}
      </div>}

      {/* Выбор игры */}
      <div className="casino-game-tabs" style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {(['roulette', 'dice', 'slots'] as const).map(g => (
          <button key={g} className={`casino-game-tab${game === g ? ' is-active' : ''}`} onClick={() => { setGame(g); setChoice(null); }}
            style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase',
              background: game === g ? '#3d7ea6' : '#fbf4e4', color: game === g ? '#fff' : '#5a4a2f', border: '2px solid rgba(90,70,40,0.25)' }}>
            {g === 'roulette' ? 'Рулетка' : g === 'dice' ? 'Кости' : 'Слоты'}
          </button>
        ))}
      </div>

      {/* Ставки */}
      <div className="casino-bet-panel" style={{ background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: 14, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)' }}>
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
            {betBtn('double', 'Дубль x5', undefined, !canBet)}
            {[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(n => betBtn(`exact_${n}`, `${n} x${DICE_EXACT_MULTIPLIERS[n]}`, undefined, !canBet))}
          </div>
        )}
        {game === 'slots' && <div style={{ textAlign: 'left' }}>
          <b style={{ display: 'block', marginBottom: 8, fontFamily: "'Russo One', sans-serif", fontSize: 13 }}>ТАБЛИЦА ВЫПЛАТ</b>
          <div style={{ display: 'grid', gap: 5 }}>
            {SLOT_PAYTABLE.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 7, background: 'rgba(90,70,40,.06)', fontSize: 13 }}><span>{row.combo} <small style={{ color: '#6b5f45' }}>· {row.label}</small></span><b style={{ color: '#327b45', whiteSpace: 'nowrap' }}>x{row.multiplier}</b></div>)}
          </div>
          <small style={{ display: 'block', marginTop: 7, color: '#6b5f45' }}>Выплата включает поставленную сумму. Ставка: от 100 до 100 000 ₽. Каждый спин независимый и виден только тебе.</small>
        </div>}

        {/* Сумма ставки */}
        <div className="casino-stake-presets" style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[100, 500, 1000, 5000, 25000].map(v => (
            <button key={v} className={`casino-stake-button${betAmount === v ? ' is-selected' : ''}`} onClick={() => { setBetAmount(v); hapticFeedback('light'); }} disabled={game === 'slots' ? app.proc || slotSpinning : !canBet}
              style={{ padding: '6px 10px', borderRadius: 8, cursor: canBet ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 'bold',
                background: betAmount === v ? '#3d7ea6' : '#fbf4e4', color: betAmount === v ? '#fff' : '#5a4a2f', border: '2px solid rgba(90,70,40,0.25)', opacity: game === 'slots' || canBet ? 1 : 0.4 }}>
              {v.toLocaleString('ru')}₽
            </button>
          ))}
          <button type="button" className={`casino-stake-button casino-all-in${betAmount === allInBet && allInBet >= 100 ? ' is-selected' : ''}`} onClick={() => { setBetAmount(allInBet); hapticFeedback('light'); }} disabled={(game === 'slots' ? app.proc || slotSpinning : !canBet) || allInBet < 100}
            title="Поставить весь доступный баланс, но не больше лимита 100 000 ₽"
            style={{ padding: '6px 10px', borderRadius: 8, cursor: canBet && allInBet >= 100 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 'bold',
              background: betAmount === allInBet && allInBet >= 100 ? '#c0453a' : '#fbf4e4', color: betAmount === allInBet && allInBet >= 100 ? '#fff' : '#5a4a2f', border: '2px solid rgba(90,70,40,0.25)', opacity: (game === 'slots' || canBet) && allInBet >= 100 ? 1 : 0.4 }}>
            ALL IN{money > 100000 ? ' · 100 000 ₽ max' : ''}
          </button>
        </div>

        <div className="casino-balance" style={{ marginTop: 12, fontSize: 14, fontFamily: "'Russo One', sans-serif" }}>
          Баланс: <AnimatedNumber value={money} format={(n) => n.toLocaleString('ru-RU') + '₽'} />
        </div>
        <Btn variant="primary" onClick={game === 'slots' ? spinSlots : placeBet} disabled={game === 'slots' ? app.proc || slotSpinning || betAmount > money : !canBet || !choice} style={{ marginTop: 10, width: '100%' }}>
          {game === 'slots' ? slotSpinning ? 'Барабаны крутятся…' : `Крутить за ${betAmount.toLocaleString('ru')} ₽` : canBet ? `Поставить ${betAmount.toLocaleString('ru')}₽` : '⛔ Приём ставок закрыт'}
        </Btn>
      </div>

      {/* Мои ставки этого раунда */}
      {game !== 'slots' && myBets.filter(b => b.game_type === game).length > 0 && (
        <div className="casino-my-bets" style={{ marginTop: 12, background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: 10 }}>
          <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>Мои ставки</div>
          {myBets.filter(b => b.game_type === game).map((b, i, visibleBets) => (
            <div key={i} className="casino-bet-history-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: i < visibleBets.length - 1 ? '1px dashed rgba(90,70,40,0.25)' : 'none' }}>
              <span>{b.game_type === 'roulette' ? '🎡' : '🎲'} {b.bet_choice}</span>
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
