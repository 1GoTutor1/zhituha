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
    if (roundBusy.current) return; // не наслаивать запросы, если предыдущий ещё висит
    roundBusy.current = true;
    try {
      // серверный «ленивый» цикл: доводит истёкшие раунды и гарантирует свежий betting.
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
    } catch {} finally { roundBusy.current = false; }
  };

  // подписка на Realtime + страховочный поллинг раз в 5 сек.
  // loadRound держим в useRef, чтобы эффект переподписывался только при смене pid,
  // а не на каждом рендере (иначе канал realtime плодится и долбит сервер).
  const roundBusy = useRef(false);
  const loadRoundRef = useRef(loadRound);
  loadRoundRef.current = loadRound;
  useEffect(() => {
    loadRoundRef.current();
    const ch = (supabase as any)
      .channel('casino_rounds_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_rounds' }, () => loadRoundRef.current())
      .subscribe();
    const poll = setInterval(() => loadRoundRef.current(), 5000);
    return () => { clearInterval(poll); (supabase as any).removeChannel(ch); };
  }, [pid]);

  // фазы доводятся сервером (ленивый цикл + cron api/casino.js). Подстраховка:
  // как только текущая фаза истекла — сразу дёргаем сервер (он закроет раунд
  // и откроет новый betting) и обновляем состояние. Раньше такой пинг был только
  // после 'result': если сервер/сеть не успевали, клиент зависал в «спине» навечно.
  useEffect(() => {
    if (!round) return;
    const msLeft = Math.max(0, round.end_time - Date.now());
    const tick = setTimeout(() => { loadRoundRef.current(); setTimeout(() => loadRoundRef.current(), 4000); }, msLeft + 1500);
    return () => clearTimeout(tick);
  }, [round?.id, round?.status, round?.end_time]);

  const phase = round?.status || 'betting';
  const msLeft = round ? Math.max(0, round.end_time - now) : 0;
  const canBet = phase === 'betting' && msLeft > 1500; // запас на сетевую задержку

  const placeBet = () => action(async () => {
    if (!pid) return showMsg('Сначала зарегистрируйся', true);
    if (!choice) return showMsg('Выбери ставку', true);
    if (betAmount < 100 || betAmount > 100000) return showMsg('Ставка от 100 до 100 000₽', true);
    if (money < betAmount) return showMsg('Недостаточно денег', true);
    // money передаём как p_expected_money: сервер сверит с реальной суммой в БД.
    // Это защита от «зависшего клиента»: если баланс устарел (например, после
    // выигрыша в другом раунде), ставка отклоняется вместо двойного списания.
    const { data, error } = await supabase.rpc('place_bet_rpc', { p_player_id: pid, p_game_type: game, p_bet_choice: choice, p_amount: betAmount, p_expected_money: Math.round(money) });
    if (error) return showMsg(error.message, true);
    if ((data as any)?.error) {
      showMsg((data as any).error, true);
      // баланс на клиенте устарел — подтянем актуальный и обновим сумму ставки
      if ((data as any).money != null) setMoney(Number((data as any).money));
      loadRound();
      return;
    }
    setMoney(Number((data as any).money));
    hapticFeedback('medium');
    showMsg(`Ставка принята: ${betAmount.toLocaleString('ru')}₽`);
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

  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>🎰 Казино «Золотое дно»</h2>

      {/* Табло фазы */}
      <div style={{ background: '#2f2a1d', color: '#ffd23f', borderRadius: 10, padding: '12px 16px', margin: '10px 0', fontFamily: "'Russo One', sans-serif", boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(90,70,40,0.35)' }}>
        {phase === 'betting' && <>⏳ Приём ставок: <span style={{ color: msLeft < 6000 ? '#ff9a8d' : '#ffd23f' }}>{Math.ceil(msLeft / 1000)}с</span></>}
        {phase === 'spinning' && <>🎲 Крутим барабан…</>}
        {phase === 'result' && <>✅ Итоги раунда! Новый через <span style={{ color: '#ffd23f' }}>{Math.max(0, Math.ceil((round ? Number(round.end_time) - now : 0) / 1000))}с</span></>}
      </div>

      {/* Результаты текущего/последнего раунда */}
      {(round?.roulette_result != null || phase !== 'betting') && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
          {round?.roulette_result != null && <div style={{ width: 54, height: 54, borderRadius: '50%', background: wheelColor(round.roulette_result), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Russo One', sans-serif", fontSize: 22, border: '3px solid #f2b632' }}>{round.roulette_result}</div>}
          {round?.dice_result != null && <div style={{ padding: '8px 14px', background: '#fbf4e4', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 8, fontFamily: "'Russo One', sans-serif" }}>🎲 {round.dice_result}</div>}
          {round?.race_winner && <div style={{ padding: '8px 14px', background: '#fbf4e4', border: '2px solid rgba(90,70,40,0.25)', borderRadius: 8, fontFamily: "'Russo One', sans-serif" }}>🏁 {RACE_CARS.find(c => c.id === round.race_winner)?.name || round.race_winner}</div>}
        </div>
      )}

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
