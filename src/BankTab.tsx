import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Building2, Car, ChartNoAxesCombined, Clock3, Landmark, RefreshCw, Send, ShieldCheck, Store, Wallet } from 'lucide-react';
import { Btn } from './components';
import { S } from './constants';

type BankSection = 'account' | 'deposits' | 'stocks' | 'loans' | 'history';
type Stock = { symbol: string; title: string; price: number; previous_price: number; history: { price: number; at: string }[] };
type Deposit = { id: string; principal: number; rate_bps: number; term_hours: number; maturity_at: string; status: string; created_at: string };
type Loan = { id: string; collateral_type: 'car' | 'house' | 'business'; collateral_model: string; collateral_business_id: string | null; collateral_value: number; principal: number; amount_due: number; due_at: string; grace_until: string; status: string };
type Holding = { symbol: string; shares: number; price: number; value: number; cost_basis: number; realized_profit: number; liquidation_value: number };
type Transaction = { id: number; operation: string; amount: number; details: Record<string, unknown>; created_at: string };
type OwnedBusiness = { id: string; biz_type: string; business_name: string; passive_level?: number | null };
type BankState = { wallet: number; balance: number; deposits: Deposit[]; loan: Loan | null; holdings: Holding[]; stocks: Stock[]; transactions: Transaction[]; server_now: string };
type RpcReply = { data: unknown; error: { message: string } | null };
type BankApp = {
  pid: string | null;
  money: number;
  hasCar: boolean;
  carModel: string;
  vehicleState?: { models?: { model_id: string; model_name: string; base_price: number }[] };
  hasHouse: boolean;
  myBizs: OwnedBusiness[];
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcReply> };
  setMoney?: (value: number) => void;
  hapticFeedback?: (style: 'light' | 'medium' | 'heavy') => void;
  showMsg?: (message: string, error?: boolean) => void;
  loadData?: (silent?: boolean) => Promise<void>;
};
const STOCK_LABELS: Record<string, string> = {
  coffee_beans: 'Кофейные зёрна', auto_parts: 'Автозапчасти', building_materials: 'Стройматериалы'
};
const BUSINESS_NAMES: Record<string, string> = {
  coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк',
  phone_factory: 'Телефонный цех', construction: 'Стройтрест'
};
const BUSINESS_BASE_VALUES: Record<string, number> = {
  coffee: 15_000, salon: 150_000, taxi: 300_000, phone_factory: 300_000, construction: 500_000
};
const BUSINESS_UPGRADE_COSTS: Record<string, number[]> = {
  coffee: [5_000, 20_000, 60_000, 150_000], salon: [50_000, 150_000, 400_000, 1_000_000],
  taxi: [100_000, 300_000, 700_000, 1_500_000], phone_factory: [100_000, 300_000, 800_000, 2_000_000],
  construction: [150_000, 500_000, 1_500_000, 3_000_000]
};
const DEPOSIT_TERMS: [number, string, number][] = [
  [1, '1 час', 0.1], [6, '6 часов', 0.3], [12, '12 часов', 0.5],
  [24, '1 день', 1], [72, '3 дня', 4], [168, '7 дней', 10]
];
const depositTermLabel = (hours: number) => hours < 24 ? `${hours} ч.` : `${hours / 24} дн.`;
const businessCollateralValue = (business: OwnedBusiness) => {
  const level = Math.max(-1, Math.min(3, Number(business.passive_level ?? -1)));
  const upgrades = (BUSINESS_UPGRADE_COSTS[business.biz_type] || []).slice(0, level + 1).reduce((sum, cost) => sum + cost, 0);
  return (BUSINESS_BASE_VALUES[business.biz_type] || 0) + Math.floor(upgrades * 0.5);
};
const money = (value: number) => `${Math.floor(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
const dateTime = (value: string) => new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const bankErrorText = (message: string) => message === 'RPC failed'
  ? 'Банк вернул ошибку запроса. Обнови страницу; если ошибка повторится, проверь логи Vercel для api/rpc.'
  : message;

const StockChart = ({ history, color }: { history: Stock['history']; color: string }) => {
  const points = history.slice(-60);
  const values = points.map(point => Number(point.price));
  const dataMin = values.length ? Math.min(...values) : 100;
  const dataMax = values.length ? Math.max(...values) : 101;
  const padding = Math.max(1, (dataMax - dataMin) * 0.12, dataMax * 0.005);
  const min = Math.max(100, dataMin - padding);
  const max = Math.max(dataMax + padding, min + 1);
  const span = Math.max(1, max - min);
  const polyline = values.map((value, index) => {
    const x = values.length < 2 ? 150 : (index / (values.length - 1)) * 300;
    const y = 78 - ((value - min) / span) * 64;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 300 90" preserveAspectRatio="none" role="img" aria-label="График цены за последний час" style={{ width: '100%', height: 76, display: 'block', background: 'rgba(90,70,40,.04)', borderRadius: 8 }}>
      <line x1="0" y1="78" x2="300" y2="78" stroke="rgba(90,70,40,.18)" strokeDasharray="4 4" />
      {values.length > 1 && <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {values.length === 1 && <circle cx="150" cy="46" r="3" fill={color} />}
    </svg>
  );
};

export const BankTab = ({ app: rawApp }: { app: unknown }) => {
  const app = rawApp as BankApp;
  const [section, setSection] = useState<BankSection>('account');
  const [bank, setBank] = useState<BankState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cashAmount, setCashAmount] = useState('1000');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('1000');
  const [depositAmount, setDepositAmount] = useState('1000');
  const [sharesAmount, setSharesAmount] = useState('1');
  const [collateral, setCollateral] = useState<'car' | 'house' | 'business' | ''>('');
  const [collateralBusinessId, setCollateralBusinessId] = useState('');
  const [loanAmount, setLoanAmount] = useState('10000');
  const [repaymentAmount, setRepaymentAmount] = useState('1000');
  const lastForeclosureSeen = useRef<number | null>(null);

  const loadBank = useCallback(async (quiet = false) => {
    if (!app.pid) return;
    if (!quiet) setLoading(true);
    try {
      const { data, error: rpcError } = await app.supabase.rpc('bank_get_state_rpc', { p_player_id: app.pid });
      if (rpcError) throw new Error(bankErrorText(rpcError.message));
      if (!data || typeof data !== 'object') throw new Error('Ответ банка пустой');
      const state = data as BankState & { error?: string };
      if (state.error) throw new Error(state.error);
      setBank(state);
      app.setMoney?.(Number(state.wallet) || 0);
      const foreclosure = state.transactions.find(transaction => transaction.operation === 'loan_foreclosure');
      if (foreclosure && foreclosure.id !== lastForeclosureSeen.current) {
        const hadSeenForeclosure = lastForeclosureSeen.current !== null;
        lastForeclosureSeen.current = foreclosure.id;
        if (hadSeenForeclosure) void app.loadData?.(true);
      }
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить банк');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [app.pid, app.supabase, app.setMoney]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadBank(); }, 0);
    const timer = window.setInterval(() => { void loadBank(true); }, 30_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadBank]);

  const run = async (rpcName: string, args: Record<string, unknown>, successText: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await app.supabase.rpc(rpcName, { p_player_id: app.pid, ...args });
      if (rpcError) throw new Error(bankErrorText(rpcError.message));
      const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (typeof payload.error === 'string') throw new Error(payload.error);
      if (typeof payload.wallet === 'number') app.setMoney?.(payload.wallet);
      await loadBank(true);
      app.hapticFeedback?.('medium');
      app.showMsg?.(successText);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'Операция не выполнена';
      setError(message);
      app.showMsg?.(message, true);
    } finally {
      setBusy(false);
    }
  };

  const stocks: Stock[] = bank?.stocks || [];
  const holdings = useMemo(() => new Map<string, Holding>((bank?.holdings || []).map(holding => [holding.symbol, holding])), [bank?.holdings]);
  const deposits = bank?.deposits || [];
  const loan = bank?.loan || null;
  const sharesToTrade = Math.max(1, Math.floor(Number(sharesAmount) || 1));
  const stockPortfolio = bank?.holdings || [];
  const stockInvested = stockPortfolio.reduce((sum, holding) => sum + Number(holding.cost_basis || 0), 0);
  const stockLiquidationValue = stockPortfolio.reduce((sum, holding) => sum + Number(holding.liquidation_value ?? Math.floor(holding.shares * holding.price * 0.95)), 0);
  const stockRealizedProfit = stockPortfolio.reduce((sum, holding) => sum + Number(holding.realized_profit || 0), 0);
  const stockUnrealizedProfit = stockLiquidationValue - stockInvested;
  const stockTotalProfit = stockRealizedProfit + stockUnrealizedProfit;
  const selectedBusiness = app.myBizs.find(business => business.id === collateralBusinessId);
  const selectedCollateralValue = collateral === 'car'
    ? (app.carModel === 'toyota' ? 65_000 : 28_000)
    : collateral === 'house' ? 50_000
      : collateral === 'business' && selectedBusiness ? businessCollateralValue(selectedBusiness) : 0;
  const maxLoan = Math.floor(selectedCollateralValue * 0.7);

  const sections: { id: BankSection; title: string }[] = [
    { id: 'account', title: 'Счёт' }, { id: 'deposits', title: 'Вклады' },
    { id: 'stocks', title: 'Акции' }, { id: 'loans', title: 'Кредиты' }, { id: 'history', title: 'История' }
  ];

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', animation: 'fadeIn 0.3s', textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Landmark size={24} color="#3d7ea6" /> Банк</h2>
        <button type="button" onClick={() => void loadBank()} aria-label="Обновить банк" style={{ border: 0, borderRadius: 8, padding: 8, background: 'rgba(90,70,40,.08)', color: '#6b5f45', cursor: 'pointer' }}><RefreshCw size={18} /></button>
      </div>
      <p style={{ margin: '0 0 15px', color: '#6b5f45', fontSize: 12 }}>Счёт, вклады, инвестиции и кредиты</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ ...S.card, margin: 0, padding: 12 }}><div style={{ color: '#6b5f45', fontSize: 11 }}>Наличные</div><b style={{ color: '#b06a15' }}>{money(Number(bank?.wallet ?? app.money))}</b></div>
        <div style={{ ...S.card, margin: 0, padding: 12 }}><div style={{ color: '#6b5f45', fontSize: 11 }}>На банковском счёте</div><b style={{ color: '#3d7ea6' }}>{money(bank?.balance || 0)}</b></div>
      </div>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
        {sections.map(item => <button key={item.id} type="button" onClick={() => setSection(item.id)} style={{ flex: '0 0 auto', border: section === item.id ? '1px solid #3d7ea6' : '1px solid rgba(90,70,40,.16)', borderRadius: 8, padding: '8px 10px', background: section === item.id ? 'rgba(61,126,166,.12)' : '#fbf4e4', color: section === item.id ? '#2e6688' : '#6b5f45', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{item.title}</button>)}
      </div>

      {error && <div role="alert" style={{ background: 'rgba(192,69,58,.10)', border: '1px solid rgba(192,69,58,.3)', borderRadius: 8, padding: 10, color: '#a9322a', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {loading ? <div style={{ ...S.card, textAlign: 'center', color: '#6b5f45' }}>Загружаем счёт…</div> : <>
        {section === 'account' && <>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Wallet size={18} /> Перевод между наличными и счётом</h3>
            <label style={{ display: 'block', color: '#6b5f45', fontSize: 12, marginBottom: 5 }}>Сумма, ₽</label>
            <input type="number" min="1" step="1" value={cashAmount} onChange={event => setCashAmount(event.target.value)} style={S.input} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" disabled={busy} style={{ flex: 1, padding: 10 }} onClick={() => void run('bank_move_cash_rpc', { p_amount: Number(cashAmount), p_direction: 'deposit' }, 'Деньги внесены на счёт')}><ArrowDownToLine size={15} /> Внести</Btn>
              <Btn variant="primary" disabled={busy} style={{ flex: 1, padding: 10 }} onClick={() => void run('bank_move_cash_rpc', { p_amount: Number(cashAmount), p_direction: 'withdraw' }, 'Деньги сняты со счёта')}><ArrowUpFromLine size={15} /> Снять</Btn>
            </div>
          </div>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}><Send size={17} /> Перевести игроку</h3>
            <input type="text" value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="Ник получателя" style={S.input} />
            <input type="number" min="1" step="1" value={transferAmount} onChange={event => setTransferAmount(event.target.value)} placeholder="Сумма" style={S.input} />
            <Btn variant="primary" disabled={busy || !recipient.trim()} onClick={() => void run('bank_transfer_rpc', { p_recipient_nickname: recipient.trim(), p_amount: Number(transferAmount) }, 'Перевод отправлен')}>Перевести</Btn>
          </div>
        </>}

        {section === 'deposits' && <>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 6px' }}>Срочный вклад</h3>
            <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 12px' }}>Доход заранее известен. Досрочное закрытие вернёт сумму без процентов.</p>
            <input type="number" min="1000" step="100" value={depositAmount} onChange={event => setDepositAmount(event.target.value)} style={S.input} />
            <div style={{ display: 'grid', gap: 8 }}>
              {DEPOSIT_TERMS.map(([hours, label, percent]) => {
                const principal = Math.max(0, Number(depositAmount) || 0);
                const interest = Math.floor(principal * Number(percent) / 100);
                return <Btn key={hours} variant="secondary" disabled={busy || principal < 1000 || principal > 1_000_000} onClick={() => void run('bank_open_deposit_rpc', { p_amount: principal, p_term_hours: hours }, 'Вклад открыт')} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: 10 }}><span>{label} · {percent}%</span><span>Вернётся {money(principal + interest)}</span></Btn>;
              })}
            </div>
          </div>
          <h3 style={{ fontSize: 15 }}>Мои вклады</h3>
        {deposits.length === 0 && <div style={{ ...S.card, color: '#6b5f45', fontSize: 13 }}>Активных вкладов нет.</div>}
          {deposits.map((deposit: Deposit) => {
            const due = new Date(deposit.maturity_at).getTime() <= new Date(bank?.server_now || 0).getTime();
            const total = Number(deposit.principal) + (due ? Math.floor(Number(deposit.principal) * Number(deposit.rate_bps) / 10000) : 0);
            return <div key={deposit.id} style={{ ...S.card, marginTop: 8 }}><b>{money(deposit.principal)} · {depositTermLabel(deposit.term_hours)}</b><p style={{ color: '#6b5f45', fontSize: 12, margin: '6px 0 10px' }}>{due ? `К выплате ${money(total)}` : `Окончание ${dateTime(deposit.maturity_at)} · ${Number(deposit.rate_bps) / 100}%`}</p><Btn variant={due ? 'primary' : 'secondary'} disabled={busy} onClick={() => void run('bank_close_deposit_rpc', { p_deposit_id: deposit.id }, due ? 'Вклад выплачен' : 'Вклад закрыт без процентов')}>{due ? 'Забрать с процентами' : 'Закрыть досрочно'}</Btn></div>;
          })}
        </>}

        {section === 'stocks' && <>
          <div style={{ ...S.card, padding: 12, fontSize: 12, color: '#6b5f45' }}><ChartNoAxesCombined size={16} style={{ verticalAlign: 'middle' }} /> Котировки общие для игроков и меняются каждую минуту по активности игры и случайному движению. Продажа — 95% текущей цены.</div>
          <div style={{ ...S.card, padding: 14, border: `1px solid ${stockTotalProfit >= 0 ? 'rgba(63,157,85,.35)' : 'rgba(192,69,58,.35)'}`, background: stockTotalProfit >= 0 ? 'linear-gradient(135deg, rgba(63,157,85,.10), #fffaf0 70%)' : 'linear-gradient(135deg, rgba(192,69,58,.10), #fffaf0 70%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div><div style={{ color: '#6b5f45', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Результат по акциям</div><div style={{ color: stockTotalProfit >= 0 ? '#2c7a3c' : '#b83229', fontSize: 24, fontWeight: 900, marginTop: 3 }}>{stockTotalProfit > 0 ? '+' : ''}{money(stockTotalProfit)}</div></div>
              <div style={{ fontSize: 24 }}>{stockTotalProfit >= 0 ? '📈' : '📉'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 12 }}>
              {[
                ['Вложено сейчас', stockInvested, '#5a4a2f', false],
                ['Получишь при продаже', stockLiquidationValue, '#3d7ea6', false],
                ['Зафиксировано продажами', stockRealizedProfit, stockRealizedProfit >= 0 ? '#2c7a3c' : '#b83229', true],
                ['Изменение открытых акций', stockUnrealizedProfit, stockUnrealizedProfit >= 0 ? '#2c7a3c' : '#b83229', true]
              ].map(([label, value, color, signed]) => <div key={String(label)} style={{ padding: 9, borderRadius: 8, background: 'rgba(255,255,255,.66)' }}><div style={{ color: '#80745e', fontSize: 10 }}>{label}</div><b style={{ color: String(color), fontSize: 13 }}>{signed && Number(value) > 0 ? '+' : ''}{money(Number(value))}</b></div>)}
            </div>
            <div style={{ color: '#80745e', fontSize: 10, marginTop: 8 }}>Учитываются цена покупки, комиссия 5% при покупке и выплата 95% от котировки при продаже.</div>
          </div>
          <label style={{ display: 'block', color: '#6b5f45', fontSize: 12, margin: '8px 0 5px' }}>Количество акций</label>
          <input type="number" min="1" max="10000" step="1" value={sharesAmount} onChange={event => setSharesAmount(event.target.value)} style={S.input} />
          {stocks.map(stock => {
            const holding = holdings.get(stock.symbol);
            const shares = Number(holding?.shares) || 0;
            const costBasis = Number(holding?.cost_basis) || 0;
            const sellValue = Number(holding?.liquidation_value ?? Math.floor(shares * stock.price * 0.95));
            const openProfit = sellValue - costBasis;
            const realizedProfit = Number(holding?.realized_profit) || 0;
            const purchaseTotal = Math.ceil(stock.price * 1.05) * sharesToTrade;
            const change = stock.previous_price ? ((stock.price - stock.previous_price) / stock.previous_price) * 100 : 0;
            const color = change >= 0 ? '#3f9d55' : '#c0453a';
            return <div key={stock.symbol} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div><b>{STOCK_LABELS[stock.symbol] || stock.title}</b><div style={{ fontSize: 11, color: '#6b5f45', marginTop: 3 }}>У тебя: {shares.toLocaleString('ru-RU')} шт.</div></div>
                <div style={{ textAlign: 'right' }}><b style={{ fontSize: 17 }}>{money(stock.price)}</b><div style={{ color, fontSize: 11 }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}% за тик</div></div>
              </div>
              <div style={{ margin: '10px 0' }}><StockChart history={stock.history || []} color={color} /><div style={{ display: 'flex', justifyContent: 'space-between', color: '#8a806c', fontSize: 10 }}><span>−60 мин</span><span>Сейчас</span></div></div>
              <div style={{ padding: 10, borderRadius: 9, background: openProfit >= 0 ? 'rgba(63,157,85,.08)' : 'rgba(192,69,58,.08)', marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}><span style={{ color: '#6b5f45' }}>Вложено в оставшиеся акции</span><b>{money(costBasis)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, marginTop: 4 }}><span style={{ color: '#6b5f45' }}>Вернётся при продаже сейчас</span><b>{money(sellValue)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginTop: 6 }}><span style={{ color: '#6b5f45' }}>Профит открытых</span><b style={{ color: openProfit >= 0 ? '#2c7a3c' : '#b83229' }}>{openProfit > 0 ? '+' : ''}{money(openProfit)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, marginTop: 4 }}><span style={{ color: '#6b5f45' }}>Уже зафиксировано продажами</span><b style={{ color: realizedProfit >= 0 ? '#2c7a3c' : '#b83229' }}>{realizedProfit > 0 ? '+' : ''}{money(realizedProfit)}</b></div>
              </div>
              <div style={{ fontSize: 11, color: '#6b5f45', marginBottom: 8 }}>Покупка с комиссией 5%: {money(purchaseTotal)} · продажа сейчас: {money(Math.floor(stock.price * sharesToTrade * 0.95))}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" disabled={busy || sharesToTrade > 10000 || Number(bank?.balance) < purchaseTotal} onClick={() => void run('bank_buy_stock_rpc', { p_symbol: stock.symbol, p_shares: sharesToTrade }, 'Акции куплены')} style={{ flex: 1, padding: 9 }}>Купить</Btn>
                <Btn variant="primary" disabled={busy || shares < sharesToTrade} onClick={() => void run('bank_sell_stock_rpc', { p_symbol: stock.symbol, p_shares: sharesToTrade }, 'Акции проданы')} style={{ flex: 1, padding: 9 }}>Продать</Btn>
              </div>
            </div>;
          })}
          {stocks.length === 0 && <div style={{ ...S.card, color: '#6b5f45' }}>Котировки пока загружаются.</div>}
        </>}

        {section === 'loans' && <>
          {loan ? <div style={S.card}>
            <h3 style={{ margin: '0 0 8px' }}>Текущий кредит</h3>
            <p style={{ fontSize: 13, margin: '4px 0' }}>Остаток долга: <b>{money(loan.amount_due)}</b></p>
            <p style={{ fontSize: 12, color: '#6b5f45', margin: '4px 0' }}>Залог: {loan.collateral_type === 'car' ? (app.vehicleState?.models?.find((model: any) => model.model_id === loan.collateral_model)?.model_name || (loan.collateral_model === 'toyota' ? 'Тойота' : 'Ока')) : loan.collateral_type === 'house' ? 'Квартира' : BUSINESS_NAMES[loan.collateral_model] || 'Бизнес'} · оценка {money(loan.collateral_value)}</p>
            <p style={{ fontSize: 12, color: '#6b5f45', margin: '4px 0 12px' }}>Срок {dateTime(loan.due_at)} · после него ещё сутки на погашение</p>
            <input type="number" min="1" step="1" value={repaymentAmount} onChange={event => setRepaymentAmount(event.target.value)} style={S.input} />
            <Btn variant="primary" disabled={busy || Number(bank?.balance) < 1} onClick={() => void run('bank_repay_loan_rpc', { p_loan_id: loan.id, p_amount: Number(repaymentAmount) }, 'Платёж по кредиту внесён')}>Погасить часть</Btn>
            <Btn variant="secondary" disabled={busy || Number(bank?.balance) < Number(loan.amount_due)} onClick={() => void run('bank_repay_loan_rpc', { p_loan_id: loan.id, p_amount: Number(loan.amount_due) }, 'Кредит погашен')} style={{ marginTop: 8 }}>Погасить полностью</Btn>
          </div> : <div style={S.card}>
            <h3 style={{ margin: '0 0 6px' }}>Кредит под залог</h3>
            <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 10px' }}>Срок 72 часа · переплата 10% · после срока сутки на погашение. Залог изымется при невозврате.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {app.hasCar && <button type="button" onClick={() => setCollateral('car')} style={{ flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', background: collateral === 'car' ? 'rgba(61,126,166,.14)' : '#fbf4e4', border: collateral === 'car' ? '1px solid #3d7ea6' : '1px solid rgba(90,70,40,.18)', color: '#2f2a1d' }}><Car size={16} /> {app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.model_name || (app.carModel === 'toyota' ? 'Тойота' : 'Ока')}<br/><small>до {money(Math.floor(Number(app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.base_price || (app.carModel === 'toyota' ? 65000 : 35000)) * .7))}</small></button>}
              {app.hasHouse && <button type="button" onClick={() => setCollateral('house')} style={{ flex: 1, padding: 10, borderRadius: 8, cursor: 'pointer', background: collateral === 'house' ? 'rgba(61,126,166,.14)' : '#fbf4e4', border: collateral === 'house' ? '1px solid #3d7ea6' : '1px solid rgba(90,70,40,.18)', color: '#2f2a1d' }}><Building2 size={16} /> Квартира<br/><small>до {money(35000)}</small></button>}
            </div>
            {app.myBizs.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
              {app.myBizs.map(business => {
                const appraisal = businessCollateralValue(business);
                const selected = collateral === 'business' && collateralBusinessId === business.id;
                return <button key={business.id} type="button" onClick={() => { setCollateral('business'); setCollateralBusinessId(business.id); }} style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: selected ? 'rgba(61,126,166,.14)' : '#fbf4e4', border: selected ? '1px solid #3d7ea6' : '1px solid rgba(90,70,40,.18)', color: '#2f2a1d', textAlign: 'left' }}><Store size={16} /> {business.business_name || BUSINESS_NAMES[business.biz_type]}<br/><small>Кредит до {money(Math.floor(appraisal * 0.7))}</small></button>;
              })}
            </div>}
            {!app.hasCar && !app.hasHouse && app.myBizs.length === 0 && <p style={{ color: '#b06a15', fontSize: 12 }}>Для кредита нужна машина, квартира или бизнес.</p>}
            {collateral && (collateral !== 'business' || selectedBusiness) && <><p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 5px' }}>Оценка залога: {money(selectedCollateralValue)} · максимум кредита: {money(maxLoan)}</p><input type="number" min="1000" max={maxLoan} step="1000" value={loanAmount} onChange={event => setLoanAmount(event.target.value)} style={S.input} /><p style={{ color: '#6b5f45', fontSize: 12 }}>Вернуть через 72 часа: {money(Number(loanAmount) + Math.ceil(Number(loanAmount) * .1))}</p><Btn variant="primary" disabled={busy || Number(loanAmount) < 1000 || Number(loanAmount) > maxLoan} onClick={() => void run('bank_apply_loan_rpc', { p_collateral_type: collateral, p_collateral_business_id: collateral === 'business' ? collateralBusinessId : null, p_amount: Number(loanAmount) }, 'Кредит зачислен на банковский счёт')}>Получить кредит</Btn></>}
          </div>}
          <div style={{ ...S.card, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#6b5f45' }}><ShieldCheck size={17} color="#3f9d55" /> Заложенные машину и квартиру нельзя продать через рынок, бизнес — продать или передать. Банк взыщет залог после окончания срока и суток на погашение.</div>
        </>}

        {section === 'history' && <>
          {(bank?.transactions || []).length === 0 && <div style={{ ...S.card, color: '#6b5f45', fontSize: 13 }}>Операций пока нет.</div>}
          {(bank?.transactions || []).map((transaction: Transaction) => <div key={transaction.id} style={{ ...S.card, marginBottom: 8, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><div><b style={{ fontSize: 12 }}>{({ cash_deposit: 'Внесение наличных', cash_withdraw: 'Снятие наличных', transfer_out: 'Перевод отправлен', transfer_in: 'Перевод получен', deposit_open: 'Открытие вклада', deposit_payout: 'Выплата вклада', deposit_early_close: 'Досрочное закрытие', stock_buy: 'Покупка акций', stock_sell: 'Продажа акций', loan_issued: 'Выдача кредита', loan_repayment: 'Погашение кредита', loan_foreclosure: 'Изъятие залога' } as Record<string,string>)[transaction.operation] || transaction.operation}</b><div style={{ color: '#8a806c', fontSize: 10, marginTop: 3 }}>{dateTime(transaction.created_at)}</div></div><span style={{ color: Number(transaction.amount) >= 0 ? '#3f9d55' : '#c0453a', fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(transaction.amount) > 0 ? '+' : ''}{money(transaction.amount)}</span></div>)}
        </>}
      </>}
      <div style={{ color: '#958b78', fontSize: 10, textAlign: 'center', margin: '15px 0 5px' }}><Clock3 size={12} style={{ verticalAlign: 'middle' }} /> Котировки обновляются раз в минуту</div>
    </div>
  );
};
