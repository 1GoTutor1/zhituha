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

type Round = { id: string; status: 'betting' | 'spinning' | 'result'; end_time: number; roulette_result: number | null; dice_result: number | null; dice_first: number | null; dice_second: number | null; race_winner: string | null };

const SPIN_MS = 5000;        // длительность анимации спина; сервер держит spinning ровно столько же
const CAR_START_PCT = 10;    // стартовая позиция машин (слева)
const CAR_FINISH_PCT = 88;   // финиш у 🏁 — машина доезжает ПОСЛЕДНИМ к концу спина и ждёт итоги

// easeOutCubic: быстрый старт -> плавное замедление и точная остановка на финише (t=1 => 1)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// порядок финиша машин фиксирован по id (не зависит от порядка списка): аутсайдер финиширует первым,
// фаворит — последним ровно в конце спина; остальные дожидаются его у финиша (анимация НЕ рестартует)
const CAR_FINISH_ORDER: Record<string, number> = { matiz: 0.55, priora: 0.66, lada: 0.76, toyota: 0.85, bmw: 0.93, skyline: 1 };

export const CasinoTab = ({ app }: { app: any }) => {
  const { pid, money, setMoney, showMsg, hapticFeedback, action } = app;
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(Date.now());
  const [game, setGame] = useState<'roulette' | 'dice' | 'race'>('roulette');
  const [choice, setChoice] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1000);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [rouletteHistory, setRouletteHistory] = useState<number[]>([]);
  const [diceHistory, setDiceHistory] = useState<number[]>([]);
  const [raceHistory, setRaceHistory] = useState<string[]>([]);
  const lastRoundId = useRef<string | null>(null);
  const loadingRef = useRef(false);         // защита от наложения запросов loadRound
  const mountedRef = useRef(true);
  const spinRequestedRef = useRef(false);   // мы уже попросили сервер начать спин этого раунда
  const serverDriftRef = useRef(0);         // поправка «серверные часы минус локальные» (для синхронной гонки)

  // тик: 100мс во время спина (плавная анимация), 1с в остальных фазах
  useEffect(() => {
    const fast = round?.status === 'spinning';
    const t = setInterval(() => setNow(Date.now()), fast ? 100 : 1000);
    return () => clearInterval(t);
  }, [round?.status]);

  const loadRound = useCallback(async () => {
    if (loadingRef.current) return; // не дёргаем сервер параллельно (realtime + поллинг + свои таймеры)
    loadingRef.current = true;
    try {
      // серверный «ленивый» цикл: доводит истёкшие/зависшие раунды и гарантирует свежий betting
      let data: any = null;
      const requestStartedAt = Date.now();
      const { data: rpcData } = await supabase.rpc('get_casino_round_rpc', { p_player_id: pid || null });
      data = rpcData;
      if (Number.isFinite(Number(data?.server_now))) {
        // Используем серверное время ответа, а не начало фазы: иначе каждый polling
        // прибавлял уже прошедшие секунды обратно к таймеру.
        const requestMidpoint = (requestStartedAt + Date.now()) / 2;
        serverDriftRef.current = Number(data.server_now) - requestMidpoint;
      }
      if (!data) {
        const { data: fallback } = await supabase.from('casino_rounds').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
        data = fallback;
      }
      if (!data) return;
      const r: Round = { id: data.id, status: data.status, end_time: Number(data.end_time), roulette_result: data.roulette_result, dice_result: data.dice_result, dice_first: data.dice_first ?? null, dice_second: data.dice_second ?? null, race_winner: data.race_winner };
      if (!mountedRef.current) return;
      if (r.status !== 'spinning') spinRequestedRef.current = false; // новый раунд — можно снова спросить спин
      setRound(r);
      // мои ставки этого раунда (только когда они реально могут измениться)
      if (pid && r.status !== 'spinning') {
        const { data: bets } = await supabase.from('casino_bets').select('game_type,bet_choice,amount,status').eq('player_id', pid).eq('round_id', r.id).order('created_at', { ascending: false });
        if (mountedRef.current) setMyBets(bets || []);
      }
      // история чисел (последние 10 завершённых) — обновляем только на новом раунде, не каждый поллинг
      if (lastRoundId.current !== r.id) {
        const { data: past } = await supabase.from('casino_rounds').select('roulette_result,dice_result,race_winner').eq('status', 'result').order('created_at', { ascending: false }).limit(10);
        if (mountedRef.current) {
          const rounds = (past || []).reverse();
          setRouletteHistory(rounds.map((p: any) => p.roulette_result).filter((n: number | null) => n != null));
          setDiceHistory(rounds.map((p: any) => p.dice_result).filter((n: number | null) => n != null));
          setRaceHistory(rounds.map((p: any) => p.race_winner).filter((winner: string | null) => winner != null));
        }
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

  // «серверное» время (локальное + измеренная поправка) — все анимации считаются ОТ него,
  // поэтому у всех игроков барабан/кости/гонка идут синхронно и заканчиваются вместе с Phase
  const serverNow = now + serverDriftRef.current;
  const phase = round?.status || 'betting';
  const msLeft = round ? Math.max(0, round.end_time - serverNow) : 0;
  const msLeftInt = Math.ceil(msLeft / 1000);
  const canBet = phase === 'betting' && msLeft > 1500; // запас на сетевую задержку

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
  useEffect(() => {
    if (phase !== 'betting' || !round) return;
    if (serverNow < round.end_time) return; // ещё есть время на ставки
    const pastDeadline = serverNow >= round.end_time + SPIN_MS + 3000; // сервер не открыл спин — повторим запрос/закроем сами
    if (spinRequestedRef.current && !pastDeadline) return;
    spinRequestedRef.current = true;
    (async () => {
      try { await supabase.rpc('spin_round_rpc', { p_spin_ms: SPIN_MS }); } catch {}
      loadRound();
    })();
  }, [phase, round?.id, Math.floor(serverNow / 500), loadRound]);

  // фаза result длится 10 сек — по истечении сами дёргаем сервер, тот закроет раунд и откроет новый betting
  useEffect(() => {
    if (round?.status === 'result') {
      const wait = Math.max(250, round.end_time + 250 - serverNow);
      const t = setTimeout(loadRound, wait);
      return () => clearTimeout(t);
    }
  }, [round?.id, round?.status, round?.end_time, loadRound]);

  // страховка от ВЕЧНОГО СПИНА: если сервер завис в spinning — через ~7 сек дёрнем тик,
  // сервер (ensure_round/casino_advance) принудительно доведёт зависший раунд и откроет новый
  useEffect(() => {
    if (round?.status === 'spinning') {
      const t = setTimeout(loadRound, SPIN_MS + 2000);
      return () => clearTimeout(t);
    }
  }, [round?.id, round?.status, loadRound]);

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
    <div key={`die-${delay}`} style={{ width: 58, height: 58, perspective: 420, margin: 8 }}>
      <div style={{ position: 'relative', width: 48, height: 48, margin: 5, transformStyle: 'preserve-3d', transform: DICE_ROTATION[v], transition: `transform ${rolling ? '110ms' : '420ms'} cubic-bezier(.2,.75,.25,1)`, filter: 'drop-shadow(0 5px 3px rgba(45,32,12,.3))' }}>
        {([
          ['front', 'translateZ(24px)', 1], ['back', 'rotateY(180deg) translateZ(24px)', 6],
          ['right', 'rotateY(90deg) translateZ(24px)', 2], ['left', 'rotateY(-90deg) translateZ(24px)', 5],
          ['top', 'rotateX(90deg) translateZ(24px)', 3], ['bottom', 'rotateX(-90deg) translateZ(24px)', 4],
        ] as const).map(([side, transform, value]) => (
          <div key={side} style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', padding: 5, gap: 2, borderRadius: 8, background: 'linear-gradient(145deg,#fffdf5,#e8d8b5)', border: '2px solid #6d5734', boxSizing: 'border-box', transform, backfaceVisibility: 'hidden' }}>
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
        {phase === 'betting' && <>⏳ Приём ставок: <span style={{ color: msLeft < 6000 ? '#ff9a8d' : '#ffd23f' }}>{msLeftInt}с</span></>}
        {phase === 'spinning' && !spinDoneWaitingResult && game === 'roulette' && <>🎡 Колесо крутится…</>}
        {phase === 'spinning' && !spinDoneWaitingResult && game === 'dice' && <>🎲 Кости летят по столу…</>}
        {phase === 'spinning' && !spinDoneWaitingResult && game === 'race' && <>🏁 Гонка пошла! Машины набирают ход…</>}
        {phase === 'spinning' && spinDoneWaitingResult && <>⏸ Финиш! Ждём официальные итоги…</>}
        {phase === 'result' && <>✅ Итоги раунда! Новый через <span style={{ color: '#ffd23f' }}>{Math.max(0, msLeftInt)}с</span></>}
      </div>

      {/* Визуал текущей игры: крутится ТОЛЬКО активная вкладка */}
      <div style={{ margin: '8px 0' }}>
        {game === 'roulette' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            {(() => {
              // ВНЕ фазы спина колесо стоит (в приёме ставок — эмодзи в центре), никаких «барабанов».
              if (!spinningVisible) return (
                <div style={{ position: 'relative', width: 160, height: 160 }}>
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
              const SEGMENTS = 12, segAngle = 360 / SEGMENTS;
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
              const WHEEL_SPIN_DEG = 1800;                    // 5 оборотов за спин
              const baseRot = WHEEL_SPIN_DEG * e;             // монотонно растёт при spinT 0->1
              const finalMod = resultNum != null ? ((360 - (numbers.indexOf(resultNum) * segAngle)) % 360 + 360) % 360 : null;
              let wheelRot = baseRot;
              if (finalMod != null) {
                // цель = следующий полный оборот после фазы ставок + короткий финальный доворот (<=90°)
                const target = 360 + finalMod;
                const d = (((target - baseRot) % 360) + 360) % 360;
                wheelRot = baseRot + (d > 180 ? d - 360 : d);
              }
              // переход включаем только когда колесо реально доворачиваем (остановка/финишная доводка)
              const wheelTrans = spinningNow && spinT >= 1 && finalMod != null && Math.abs(wheelRot - baseRot) > 0.5
                ? 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
              // центральное число: во время вращения — сектор под указателем (чуть с опережением,
              // чтобы финальное значение совпало с остановкой); после остановки — реальный итог
              const centerNum = resultNum != null && (spinT >= 1 || !spinningNow)
                ? resultNum
                : numbers[sectorUnder(baseRot + 72 * (1 - e))];
              // ВНУТРЕННИЙ БАРАБАН: крутится в ОБРАТНУЮ сторону и быстрее — числа и цвета реально
              // «пролетают» как в настоящем автомате; после t>=1 останавливается (без рестарта)
              const REEL = 10, reelStep = 360 / REEL;
              const reelRot = -(1800 * e + 360 * 3 * e);
              const reelOffset = Math.floor(((((-reelRot) % 360) + 360) % 360) / reelStep);
              const reelNums = Array.from({ length: REEL }, (_, i) => (reelOffset + i) % 37);
              return (
                <div style={{ position: 'relative', width: 160, height: 160 }}>
                  {/* золотой указатель (неподвижен) */}
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '16px solid #f2b632', zIndex: 4, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
                  {/* внешнее вращающееся колесо с секторами */}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #f2b632', boxShadow: '0 4px 14px rgba(0,0,0,0.4), inset 0 0 0 4px #241f14', background: `conic-gradient(${numbers.map((n, i) => `${wheelColor(n)} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(', ')})`, transform: `rotate(${wheelRot}deg)`, transition: wheelTrans }}>
                    {numbers.map((n, i) => (
                      <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${i * segAngle + segAngle / 2}deg) translateY(-63px)` }}>
                        <span style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: 'rgba(15,12,6,0.6)', color: '#fff8e6', fontSize: 9, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${-(i * segAngle + segAngle / 2) - wheelRot}deg)` }}>{n}</span>
                      </div>
                    ))}
                  </div>
                  {/* внутренний барабан: крутится в обратку, числа+цвет меняются как в настоящем автомате */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 84, height: 84, marginLeft: -42, marginTop: -42, borderRadius: '50%', overflow: 'hidden', border: '3px solid #f2b632', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.5)', background: '#241f14', transform: `rotate(${reelRot}deg)` }}>
                    {reelNums.map((n, i) => (
                      <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${i * (360 / REEL)}deg) translateY(-30px)` }}>
                        <span style={{ position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: '50%', background: wheelColor(n), color: '#fff', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${-i * (360 / REEL) - reelRot}deg)` }}>{n}</span>
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
        {game === 'race' && (
          <div style={{ background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: '10px 12px', textAlign: 'left' }}>
            {phase === 'spinning' ? (
              RACE_CARS.map((c, idx) => {
                // позиции считаются из ПРОГРЕССА СПИНА (общие серверные часы): каждая машина
                // доезжает к своей доле дистанции и стоит там, а лидер — ровно к концу спина.
                // Никаких CSS-циклов: анимация не рестартует и дожидается итогов.
                const finishAt = CAR_FINISH_ORDER[c.id] ?? 1;
                const localT = Math.min(1, spinT / finishAt);
                const pos = CAR_START_PCT + (CAR_FINISH_PCT - CAR_START_PCT) * easeOutCubic(localT);
                const finished = localT >= 1;
                return (
                  <div key={c.id} style={{ position: 'relative', height: 30, marginBottom: 6, overflow: 'hidden', borderBottom: idx < RACE_CARS.length - 1 ? '1px dashed rgba(90,70,40,0.3)' : 'none' }}>
                    <span style={{ position: 'absolute', left: 0, top: 4, fontSize: 12, fontFamily: "'Russo One', sans-serif", color: '#6b5f45', zIndex: 1 }}>{c.emoji} {c.name}</span>
                    <span style={{ position: 'absolute', top: 2, left: `${pos}%`, transition: 'left 0.12s linear', filter: finished ? 'none' : undefined }}>
                      {!finished ? '💨' : ''}{c.emoji}
                    </span>
                    <span style={{ position: 'absolute', right: 0, top: 4, fontSize: 16 }}>🏁</span>
                  </div>
                );
              })
            ) : phase === 'result' && round?.race_winner ? (
              <div style={{ fontFamily: "'Russo One', sans-serif", textAlign: 'center' }}>🏆 Победил: {RACE_CARS.find(c => c.id === round.race_winner)?.emoji} {RACE_CARS.find(c => c.id === round.race_winner)?.name || round.race_winner}</div>
            ) : (
              <div style={{ fontFamily: "'Russo One', sans-serif", textAlign: 'center', color: '#6b5f45' }}>🏁 Трасса ждёт старта</div>
            )}
          </div>
        )}
      </div>

      {/* История выбранной игры */}
      {game === 'roulette' && rouletteHistory.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {rouletteHistory.map((n, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: wheelColor(n), color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{n}</span>)}
        </div>
      )}
      {game === 'dice' && diceHistory.length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {diceHistory.map((sum, i) => <span key={i} style={{ padding: '4px 8px', borderRadius: 7, background: '#fbf4e4', color: '#5a4a2f', border: '1px solid rgba(90,70,40,.25)', fontSize: 12, fontWeight: 'bold' }}>🎲 {sum}</span>)}
        </div>
      )}
      {game === 'race' && raceHistory.length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {raceHistory.map((winner, i) => { const car = RACE_CARS.find(c => c.id === winner); return <span key={i} title={car?.name || winner} style={{ padding: '4px 8px', borderRadius: 7, background: '#fbf4e4', color: '#5a4a2f', border: '1px solid rgba(90,70,40,.25)', fontSize: 12, fontWeight: 'bold' }}>{car?.emoji || '🏁'} {car?.name || winner}</span>; })}
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
      {myBets.filter(b => b.game_type === game).length > 0 && (
        <div style={{ marginTop: 12, background: '#efe4c8', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 12, padding: 10 }}>
          <div style={{ fontFamily: "'Russo One', sans-serif", fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>Мои ставки</div>
          {myBets.filter(b => b.game_type === game).map((b, i, visibleBets) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < visibleBets.length - 1 ? '1px dashed rgba(90,70,40,0.25)' : 'none' }}>
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
