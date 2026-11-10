import { useCallback, useEffect, useState } from 'react';
import { Cpu, Zap, Coins, HardDrive, Play, Pause, PackagePlus, RefreshCw, Pickaxe } from 'lucide-react';
import { Btn } from './components';
import './MiningTab.css';

const items = [
  { id: 'gpu_frame', title: 'Каркас фермы', price: 40_000 },
  { id: 'gpu_motherboard', title: 'Материнская плата', price: 55_000 },
  { id: 'gpu_cpu_ram', title: 'Процессор и память', price: 40_000 },
  { id: 'gpu_power', title: 'Блок питания', price: 80_000 },
  { id: 'gpu_cooling', title: 'Охлаждение', price: 35_000 },
  { id: 'gpu_card', title: 'Видеокарта', price: 125_000, batch: true },
];

const money = (value: number) => `${Math.floor(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
const coin = (value: number) => Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 8 });
const rigTitle = (type: string) => type === 'gpu_farm' ? 'GPU-ферма' : type === 'asic' ? 'ASIC-майнер' : 'Промышленный майнер';

type MiningRig = { id: string; rig_type: string; gpu_count: number; installed: boolean; is_running: boolean; coin_per_day: number; power_cost_per_day: number; pending_coin: number };
type MiningTransaction = { created_at: string; transaction_type: string; net_money: number; coin_amount: number };
type MiningState = {
  error?: string; locked?: boolean; player_level?: number; level_required?: number;
  coin_balance?: number; coin_price?: number; components?: Record<string, number>;
  rigs?: MiningRig[]; transactions?: MiningTransaction[]; used_slots?: number;
  site_slots?: number; farm_slot_price?: number; money?: number;
  electricity_paid?: number; net_money?: number; started_count?: number;
  installed_count?: number; skipped_no_space?: number; skipped_no_funds?: number; skipped_no_gpu?: number;
};
type MiningApp = {
  pid: string | null; money: number; setMoney: (money: number) => void;
  supabase: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: MiningState | null; error: { message?: string } | null }> };
  showMsg: (message: string, isError?: boolean) => void;
};
function errorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

export function MiningTab({ app }: { app: MiningApp }) {
  const [state, setState] = useState<MiningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saleAmount, setSaleAmount] = useState('');
  const [gpuQuantity, setGpuQuantity] = useState('1');
  const [error, setError] = useState('');
  const [section, setSection] = useState<'rigs' | 'shop' | 'coin'>('rigs');

  const refresh = useCallback(async () => {
    if (!app.pid) {
      setError('Не удалось определить игрока. Перезагрузи игру и попробуй ещё раз.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: rpcError } = await app.supabase.rpc('mining_state_rpc', { p_player_id: app.pid });
      if (rpcError) throw rpcError;
      if (data?.error) throw new Error(data.error);
      setState(data);
      setError('');
    } catch (e: unknown) {
      setError(errorMessage(e, 'Не удалось загрузить майнинг'));
    } finally {
      setLoading(false);
    }
  }, [app.pid, app.supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (rpc: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error: rpcError } = await app.supabase.rpc(rpc, { p_player_id: app.pid, ...args });
      if (rpcError) throw rpcError;
      if (data?.error) throw new Error(data.error);
      setState(data);
      if (typeof data?.money === 'number') app.setMoney(data.money);
      if (data?.electricity_paid) app.showMsg(`Электричество: ${money(data.electricity_paid)}`);
      else if (data?.net_money) app.showMsg(`Продано · после налога +${money(data.net_money)}`);
      else if (typeof data?.installed_count === 'number') {
        const details = [
          data.skipped_no_space ? `нет места: ${data.skipped_no_space}` : '',
          data.skipped_no_funds ? `не хватает резерва: ${data.skipped_no_funds}` : '',
          data.skipped_no_gpu ? `без видеокарты: ${data.skipped_no_gpu}` : '',
        ].filter(Boolean).join(' · ');
        app.showMsg(data.installed_count > 0
          ? `Установлено и запущено: ${data.installed_count}${details ? ` · пропущено: ${details}` : ''}`
          : `Ничего не установлено${details ? ` · ${details}` : ''}`, data.installed_count === 0);
      }
      else if (typeof data?.started_count === 'number') app.showMsg(data.started_count > 0 ? `Запущено установок: ${data.started_count}` : 'Все установленные майнеры уже работают');
      else app.showMsg('Готово');
      setError('');
    } catch (e: unknown) {
      const message = errorMessage(e, 'Не удалось выполнить действие');
      setError(message);
      app.showMsg(message, true);
    } finally {
      setBusy(false);
    }
  };

  const invoke = (action: string, extra: Record<string, unknown> = {}) => void run('mining_action_rpc', { p_action: action, ...extra });
  const components = state?.components || {};
  const rigs = state?.rigs || [];
  const inventoryRigs = rigs.filter(rig => !rig.installed);
  const canInstallAny = inventoryRigs.some(rig => {
    if (rig.rig_type === 'gpu_farm' && Number(rig.gpu_count) < 1) return false;
    const slotsNeeded = rig.rig_type === 'industrial' ? 4 : 1;
    const powerReserve = rig.rig_type === 'gpu_farm' ? Math.ceil(Number(rig.gpu_count) * 750) : rig.rig_type === 'asic' ? 5000 : 18000;
    return Number(state?.site_slots || 1) - Number(state?.used_slots || 0) >= slotsNeeded
      && Number(app.money) >= powerReserve;
  });
  const stoppedInstalledCount = rigs.filter(rig => rig.installed && !rig.is_running && (rig.rig_type !== 'gpu_farm' || Number(rig.gpu_count) > 0)).length;
  const transactions = state?.transactions || [];
  const pending = rigs.reduce((sum, rig) => sum + Number(rig.pending_coin || 0), 0);
  const canBuild = ['gpu_frame', 'gpu_motherboard', 'gpu_cpu_ram', 'gpu_power', 'gpu_cooling'].every(id => Number(components[id] || 0) > 0);
  const enteredSale = Number(saleAmount);
  const estimate = Number.isFinite(enteredSale) && enteredSale > 0 ? Math.floor(enteredSale * Number(state?.coin_price || 0)) : 0;

  if (loading) return <section className="mining-page"><div className="mining-card">Загружаю майнинг…</div></section>;
  if (!state) return <section className="mining-page"><div className="mining-error" role="alert">{error || 'Не удалось загрузить майнинг.'}</div><Btn variant="secondary" onClick={() => void refresh()}>Повторить</Btn></section>;
  if (state?.locked) return <section className="mining-page"><header className="mining-heading"><Pickaxe /><div><h1>Майнинг</h1><p>Фермы, ASIC и добыча монеты</p></div></header><div className="mining-card"><b>Откроется с {state.level_required} уровня</b><p>Твой уровень: {state.player_level}</p></div></section>;

  return <section className="mining-page">
    <header className="mining-heading"><Pickaxe /><div><h1>Майнинг</h1><p>Собирай оборудование и добывай игровую монету</p></div><button type="button" className="mining-icon-button" onClick={() => void refresh()} aria-label="Обновить"><RefreshCw size={18} /></button></header>
    {error && <div className="mining-error" role="alert">{error}</div>}
    <div className="mining-summary">
      <div><small>Баланс</small><b><Coins size={19} /> {money(app.money)}</b></div>
      <div><small>Игровая монета</small><b>{coin(state.coin_balance || 0)} <span>MC</span></b></div>
      <div><small>Курс монеты</small><b>{money(state.coin_price || 0)} <span>/ MC</span></b></div>
      <div><small>Накоплено к сбору</small><b>{coin(pending)} <span>MC</span></b></div>
    </div>

    <nav className="mining-tabs" aria-label="Разделы майнинга" role="tablist">
      <button type="button" role="tab" aria-selected={section === 'rigs'} className={section === 'rigs' ? 'is-active' : ''} onClick={() => setSection('rigs')}><HardDrive size={16} /> Установки</button>
      <button type="button" role="tab" aria-selected={section === 'shop'} className={section === 'shop' ? 'is-active' : ''} onClick={() => setSection('shop')}><PackagePlus size={16} /> Магазин</button>
      <button type="button" role="tab" aria-selected={section === 'coin'} className={section === 'coin' ? 'is-active' : ''} onClick={() => setSection('coin')}><Coins size={16} /> Монета</button>
    </nav>

    {section === 'rigs' && <div className="mining-card mining-operations">
      <div className="mining-card-title"><div><HardDrive size={20} /><h2>Площадка</h2></div><b>{state?.used_slots || 0} / {state?.site_slots || 1} мест</b></div>
      <p className="mining-muted">Доход начисляется при сборе. Офлайн-расчёт ограничен 12 часами; после этого установка останавливается.</p>
      {pending > 0 && <Btn disabled={busy} onClick={() => invoke('collect')}><Coins size={17} /> Забрать добычу · {coin(pending)} MC</Btn>}
      {stoppedInstalledCount > 0 && <Btn disabled={busy} onClick={() => void run('mining_turn_on_all_rpc', {})}><Play size={17} /> Запустить все · {stoppedInstalledCount}</Btn>}
      {inventoryRigs.length > 0 && <div className="mining-bulk-install"><div><b>В инвентаре: {inventoryRigs.length} майнеров</b><small>Установка запускает добычу; учитываются свободные места и запас на электричество.</small></div><Btn disabled={busy || !canInstallAny} onClick={() => void run('mining_install_all_rigs_rpc', {})}><Play size={17} /> Установить и запустить подходящие</Btn></div>}
      <div className="mining-rig-list">
        {rigs.length === 0 && <p className="mining-empty">Установок пока нет. Собери ферму или купи готовый майнер.</p>}
        {rigs.map(rig => <article className="mining-rig" key={rig.id}>
          <div className="mining-rig-top"><div><b>{rigTitle(rig.rig_type)}</b><small>{coin(rig.coin_per_day)} MC/день · электричество {money(rig.power_cost_per_day)}/день</small></div><span className={rig.is_running ? 'mining-status is-running' : 'mining-status'}>{rig.is_running ? 'Работает' : rig.installed ? 'Остановлен' : 'В инвентаре'}</span></div>
          {rig.rig_type === 'gpu_farm' && <div className="mining-gpu-slots" aria-label={`Видеокарты: ${rig.gpu_count} из 4`}>{[0, 1, 2, 3].map(slot => <div className={slot < Number(rig.gpu_count) ? 'filled' : ''} key={slot}><Cpu size={18} /><small>{slot < Number(rig.gpu_count) ? 'GPU' : 'Слот'}</small></div>)}</div>}
          <div className="mining-actions">
            {rig.rig_type === 'gpu_farm' && Number(rig.gpu_count) < 4 && Number(components.gpu_card || 0) > 0 && <Btn variant="secondary" disabled={busy} onClick={() => invoke('install_gpu', { p_rig_id: rig.id })}>Установить GPU</Btn>}
            {!rig.installed && <Btn disabled={busy} onClick={() => invoke('install_rig', { p_rig_id: rig.id })}>Установить</Btn>}
            {rig.installed && <Btn variant="secondary" disabled={busy} onClick={() => invoke(rig.is_running ? 'turn_off' : 'turn_on', { p_rig_id: rig.id })}>{rig.is_running ? <><Pause size={16} /> Остановить</> : <><Play size={16} /> Запустить</>}</Btn>}
            {rig.installed && <Btn variant="secondary" disabled={busy} onClick={() => invoke('uninstall_rig', { p_rig_id: rig.id })}>Снять</Btn>}
          </div>
        </article>)}
      </div>
    </div>}

    {section === 'shop' && <div className="mining-card">
      <div className="mining-card-title"><div><PackagePlus size={20} /><h2>Магазин оборудования</h2></div></div>
      <div className="mining-store-list">{items.map(item => <article className="mining-store-item" key={item.id}>
        <div><b>{item.title}</b><small>В наличии: {Number(components[item.id] || 0)}</small></div><strong>{money(item.price)}{item.batch ? ' / шт.' : ''}</strong>
        {item.batch && <input aria-label="Количество видеокарт" type="number" min="1" max="4" value={gpuQuantity} onChange={event => setGpuQuantity(event.target.value)} placeholder="1" />}
        <Btn variant="secondary" disabled={busy || Number(app.money) < item.price * (item.batch ? Math.max(1, Math.min(4, Number(gpuQuantity) || 1)) : 1)} onClick={() => invoke('buy_component', { p_item_id: item.id, p_quantity: item.batch ? Math.max(1, Math.min(4, Number(gpuQuantity) || 1)) : 1 })}>Купить</Btn>
      </article>)}</div>
      <div className="mining-build-row"><div><b>Собрать GPU-ферму</b><small>Нужны пять основных компонентов · каркас на 4 видеокарты</small></div><Btn disabled={busy || !canBuild} onClick={() => invoke('build_gpu_farm')}>Собрать</Btn></div>
      <div className="mining-store-item"><div><b>ASIC-майнер</b><small>0,142 MC/день · 10 000 ₽ электричества/день · 1 место</small></div><strong>{money(2_000_000)}</strong><Btn disabled={busy || Number(app.money) < 2_000_000} onClick={() => invoke('buy_asic')}>Купить</Btn></div>
      <div className="mining-store-item"><div><b>Промышленный майнер</b><small>0,5325 MC/день · 36 000 ₽ электричества/день · 4 места</small></div><strong>{money(7_700_000)}</strong><Btn disabled={busy || Number(app.money) < 7_700_000} onClick={() => invoke('buy_industrial')}>Купить</Btn></div>
      <div className="mining-build-row"><div><b>Расширить площадку</b><small>Добавить одно место · сейчас {state?.site_slots || 1}</small></div><Btn variant="secondary" disabled={busy || Number(app.money) < Number(state?.farm_slot_price || 250_000)} onClick={() => invoke('expand_site')}>+1 · {money(state?.farm_slot_price || 250_000)}</Btn></div>
    </div>}

    {section === 'coin' && <>
    <div className="mining-card">
      <div className="mining-card-title"><div><Zap size={20} /><h2>Продать монету</h2></div><small>Налог с продажи — 13%</small></div>
      <div className="mining-sell-row"><input type="number" min="0" max={state?.coin_balance || 0} step="0.00000001" value={saleAmount} onChange={event => setSaleAmount(event.target.value)} placeholder="Количество MC" /><Btn disabled={busy || !enteredSale || enteredSale <= 0 || enteredSale > Number(state?.coin_balance || 0) || estimate <= 0} onClick={() => { void run('mining_sell_coin_rpc', { p_amount: enteredSale }); setSaleAmount(''); }}>Продать</Btn></div>
      {estimate > 0 && <p className="mining-muted">Примерно {money(estimate)} до налога · после налога около {money(estimate * 0.87)}. Итог зависит от текущего курса.</p>}
    </div>

    {transactions.length > 0 && <div className="mining-card"><div className="mining-card-title"><div><RefreshCw size={20} /><h2>Последние операции</h2></div></div><div className="mining-history">{transactions.map((row, index) => <div key={`${row.created_at}-${index}`}><span>{row.transaction_type === 'sell' ? 'Продажа' : 'Добыча'}<small>{new Date(row.created_at).toLocaleString('ru-RU')}</small></span><b>{row.transaction_type === 'sell' ? `+${money(row.net_money)}` : `${coin(row.coin_amount)} MC`}</b></div>)}</div></div>}
    </>}
  </section>;
}
