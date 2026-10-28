import { useState, useEffect, useRef } from 'react';
import { Coins, Zap, UserPlus, Briefcase, Coffee, Users, Smartphone, Phone, Car, Building, Store, Hammer, ChevronLeft, ChevronRight, Gift, Wrench, Search, ShieldAlert, Ban, Trash2, ArrowLeft, X, Backpack, Bug, AlertTriangle, TrendingUp, Wallet, ScrollText, RefreshCw, Trophy, Palette } from 'lucide-react';
import { 
  getAvatar, LADA_PRICE, TOYOTA_PRICE, BUILDING_PRICE, COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, TAXI_BIZ_PRICE, CONSTRUCTION_BIZ_PRICE, PHONE_FACTORY_BIZ_PRICE,
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, S, getDayModifier, COFFEE_CUP_PRICE,
  BUTTON_BATCH_COST, SMARTPHONE_BATCH_COST, BUTTON_BATCH_SIZE, SMARTPHONE_BATCH_SIZE,
  DEFAULT_SELL_LADA, DEFAULT_SELL_TOYOTA, DEFAULT_SELL_APARTMENT, DEFAULT_SELL_PHONE,
  DEFAULT_SELL_BUTTON, DEFAULT_SELL_SMARTPHONE, BIZ_JOBS, BUSINESS_PASSIVE_TIERS, getStock
} from './constants';
import { Btn, Modal } from './components';
import { AnimatedNumber } from './AnimatedNumber';
import { isUiSoundEnabled, toggleUiSound } from './sound';

export const AppModals = ({ app }: { app: any }) => (
  <>
    <Modal open={app.refOpen} onClose={() => app.setRefOpen(false)}>
      <Gift size={40} color="#c0453a" style={{ marginBottom: 15 }} /><h3 style={{ marginTop: 0, fontSize: 20 }}>Рефералка</h3>
      <Btn variant="purple" onClick={app.inviteFriend} style={{ background: 'linear-gradient(135deg, #c0453a 0%, #be185d 100%)', color: '#fdf1ec', marginBottom: 15, padding: 12 }}><UserPlus size={20} /> Пригласить друга</Btn>
      <p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 10 }}>Приглашено друзей: <b>{app.myRefs.length}</b></p>
      <div style={{ background: 'rgba(192,69,58,0.08)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(192,69,58,0.25)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#c0453a' }}>Накоплено 5% с доходов:</p><p style={{ margin: 0, fontSize: 24, color: '#c0453a', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.refBalance} <Coins size={18} style={{ display: 'inline' }} /></p></div>
      <Btn variant="primary" onClick={app.collectRefBonus} disabled={app.proc || app.refBalance <= 0} style={{ background: app.refBalance > 0 ? 'linear-gradient(135deg, #3f9d55 0%, #059669 100%)' : '#e7d9b8', marginBottom: 10 }}>Собрать 5%</Btn>
      <Btn variant="secondary" onClick={() => app.setRefOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
    </Modal>

    <Modal open={app.quitOpen} onClose={() => app.setQuitOpen(false)}>
      <h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3><p style={{ color: '#6b5f45', fontSize: 15, marginBottom: 20 }}>Ты уверен?</p>
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setQuitOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="danger" onClick={app.quit} disabled={app.proc}>Уволиться</Btn></div>
    </Modal>

    <Modal open={app.sellOpen} onClose={() => { app.setSellOpen(false); app.setSellSource(null); }}>
      <h3>Продажа {app.sellItemType === 'phone' ? 'телефона' : app.sellItemType === 'car' ? 'машины' : 'квартиры'}</h3>
      <p style={{ color: '#6b5f45', fontSize: 12, marginBottom: 10 }}>{app.sellSource === 'personal' ? 'Из личного имущества' : 'Со склада бизнеса'}</p>
      <label style={{ display: 'block', textAlign: 'left', color: '#6b5f45', fontSize: 13, marginBottom: 6 }}>Цена продажи — назначаете сами, ₽</label>
      <input type="number" min="1" step="1" value={app.sellPrice} onChange={(e: any) => app.setSellPrice(e.target.value)} style={S.input} />
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => { app.setSellOpen(false); app.setSellSource(null); }} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="purple" onClick={app.listItem}>Выставить</Btn></div>
    </Modal>

    <Modal open={app.buyingType !== null} onClose={() => app.setBuyingType(null)}>
      <Store size={40} color="#5f43a0" style={{ marginBottom: 15 }} />
      <h3>Название бизнеса</h3>
      <p style={{ color: '#6b5f45', fontSize: 13, marginBottom: 15 }}>Только английские буквы и цифры</p>
      <input type="text" value={app.bizNameInput} onChange={(e: any) => app.setBizNameInput(e.target.value)} placeholder="Speed Motors" style={S.input} />
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setBuyingType(null)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="purple" onClick={app.submitBizName}>Купить</Btn></div>
    </Modal>

    <Modal open={app.promoOpen} onClose={() => app.setPromoOpen(false)}>
      <Gift size={40} color="#3f9d55" style={{ marginBottom: 15 }} />
      <h3>Активация промокода</h3>
      <input type="text" value={app.promoInput} onChange={(e: any) => app.setPromoInput(e.target.value.toUpperCase())} placeholder="ALPHA100" style={S.input} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.4fr)', gap: 10, width: '100%' }}>
        <Btn variant="secondary" onClick={() => app.setPromoOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d', minWidth: 0, padding: '12px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>Отмена</Btn>
        <Btn variant="primary" onClick={app.redeemPromo} style={{ minWidth: 0, padding: '12px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>Активировать</Btn>
      </div>
    </Modal>

    <Modal open={app.bugOpen} onClose={() => app.setBugOpen(false)}>
      <Bug size={40} color="#c0453a" style={{ marginBottom: 15 }} />
      <h3>Сообщить о баге</h3>
      <p style={{ color: '#6b5f45', fontSize: 13, marginBottom: 15 }}>Опиши проблему, и админ получит сообщение в Telegram.</p>
      <textarea 
        value={app.bugText} 
        onChange={(e: any) => app.setBugText(e.target.value)} 
        placeholder="Что случилось?" 
        style={{ ...S.input, minHeight: '100px', resize: 'none' }} 
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => app.setBugOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn>
        <Btn variant="primary" onClick={app.submitBug} disabled={app.proc || app.bugText.trim().length === 0}>
          {app.proc ? 'Отправка...' : 'Отправить'}
        </Btn>
      </div>
    </Modal>
  </>
);

export const DailyRewardModal = ({ app }: { app: any }) => {
  if (!app.isDailyOpen) return null;
  return (
    <div style={S.modalBg}>
      <div style={{ ...S.modalBox, maxWidth: '360px' }}>
        <Gift size={40} color="#c0453a" style={{ marginBottom: 10 }} />
        <h3 style={{ marginTop: 0, marginBottom: 15 }}>Ежедневный доход</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {DAILY_REWARDS.map((rw, i) => {
            const isClaimed = app.dailyStreak > i;
            const isCurrent = app.dailyStreak === i;
            return (
              <div key={i} style={{ backgroundColor: isCurrent ? 'rgba(192,69,58,0.15)' : '#e7d9b8', border: isCurrent ? '1px solid #c0453a' : '1px solid rgba(90,70,40,0.08)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isClaimed ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, color: '#6b5f45', marginBottom: 5 }}>День {i + 1}</div>
                {rw.type === 'money' ? <Coins size={20} color="#b06a15" /> : <Coffee size={20} color="#2c7a3c" />}
                <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 5 }}>{rw.amount} {rw.type === 'money' ? 'монет' : 'шт.'}</div>
                {rw.boost && <div style={{ fontSize: 10, color: '#c0453a' }}>+Буст x1.1</div>}
              </div>
            );
          })}
        </div>
        <Btn variant="primary" onClick={app.claimDaily} disabled={app.proc || app.dailyStreak >= 7} style={{ marginBottom: 10 }}>
          {app.dailyStreak >= 7 ? 'Приходи завтра' : 'Забрать награду'}
        </Btn>
        <Btn variant="secondary" onClick={() => app.setIsDailyOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
      </div>
    </div>
  );
};

export const TutorialCard = ({ app }: { app: any }) => {
  if (app.onboardStep >= 6) return null;

  const steps = [
    `Тапни 'Подработка' (${app.tutorialWorkClicks || 0}/3)`,
    "Энергия упала — тапни 'Отдых'",
    "Выпей кофе из туториала ☕",
    "Загляни в 'Бизнесы'",
    "Посмотри цены на Рынке",
    "Ты в теме! Забери ежедневку 🎁"
  ];

  return (
    <div style={{ backgroundColor: 'rgba(61,126,166,0.10)', border: '1px solid #3d7ea6', borderRadius: 8, padding: 15, marginBottom: 20, position: 'relative' }}>
      <button onClick={app.skipTutorial} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#6b5f45', cursor: 'pointer' }}><X size={18} /></button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 30 }}>👨‍🦳</div>
        <div><div style={{ fontWeight: 'bold', color: '#2f6a94' }}>Дядя Гоша</div><div style={{ fontSize: 12, color: '#6b5f45' }}>Шаг {app.onboardStep + 1} из 6</div></div>
      </div>
      <div style={{ fontSize: 14, color: '#2f2a1d', marginBottom: 10 }}>{steps[app.onboardStep]}</div>
      {app.onboardStep === 2 && <Btn variant="primary" onClick={app.drinkTutorialCoffee} disabled={app.proc} style={{ padding: 10, fontSize: 14, marginBottom: 10 }}>Взять кофе (+100 энергии)</Btn>}
      {app.onboardStep === 5 && <Btn variant="primary" onClick={app.claimTutorialReward} disabled={app.proc} style={{ padding: 10, fontSize: 14 }}>Забрать 2000 монет</Btn>}
    </div>
  );
};

export const HomeTab = ({ app }: { app: any }) => {
  const av = getAvatar(app.avatarId);
  const maxEnergy = app.maxEnergy;
  const myCoffee = app.myBizs?.find((b: any) => b.biz_type === 'coffee');
  const modifier = getDayModifier();
  const [soundEnabled, setSoundEnabled] = useState(isUiSoundEnabled);
  const [workReward, setWorkReward] = useState<{ id: number; amount: number } | null>(null);
  useEffect(() => {
    const onReward = (event: Event) => {
      const id = Date.now();
      setWorkReward({ id, amount: Number((event as CustomEvent<number>).detail) });
      window.setTimeout(() => setWorkReward(current => current?.id === id ? null : current), 1200);
    };
    window.addEventListener('zhituha:work-reward', onReward);
    return () => window.removeEventListener('zhituha:work-reward', onReward);
  }, []);
  const energyCost = app.hasCar ? 10 : 20;

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={app.handleAvatar} style={{ width: 55, height: 55, borderRadius: '10px', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, ...(app.profileFrame === 'frame_test' ? frameStyle('frame_test') : app.profileFrame === 'frame_amber' ? frameStyle('frame_amber') : { border: '2px solid rgba(90,70,40,0.22)' }), cursor: 'pointer', userSelect: 'none' }}>{av.emoji}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', fontFamily: 'Russo One, Impact, sans-serif' }}>{app.nick}</div>
              <button onClick={() => app.setRefOpen(true)} style={{ background: 'rgba(192,69,58,0.12)', border: '1px solid #c0453a', color: '#c0453a', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><UserPlus size={16} /></button>
              <button onClick={() => app.setPromoOpen(true)} style={{ background: 'rgba(63,157,85,0.15)', border: '1px solid #3f9d55', color: '#3f9d55', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Gift size={16} /></button>
              <button onClick={() => app.setBugOpen(true)} style={{ background: 'rgba(192,69,58,0.12)', border: '1px solid #c0453a', color: '#c0453a', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Bug size={16} /></button>
            </div>
            <div style={{ fontSize: 13, color: '#6b5f45', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              ID: {app.tgId.slice(0, 6)}
              {app.boostEnd > Date.now() && <span style={{ color: '#c0453a', fontWeight: 'bold', marginLeft: 5, fontSize: 11, border: '1px solid #c0453a', padding: '1px 4px', borderRadius: 4 }}>x1.1 БУСТ</span>}
              {app.profileFrame === 'frame_test' && <span style={{ color: '#087f70', fontWeight: 'bold', marginLeft: 4, fontSize: 10, border: '1px solid #63e6be', padding: '1px 5px', borderRadius: 5 }}>TEST</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <button aria-label={soundEnabled ? 'Mute' : 'Unmute'} onClick={() => setSoundEnabled(toggleUiSound())} style={{ border: '1px solid rgba(90,70,40,.2)', borderRadius: 8, padding: 6, marginBottom: 8, background: 'rgba(90,70,40,.06)', color: '#6b5f45', cursor: 'pointer' }}>{soundEnabled ? '\u{1F50A}' : '\u{1F507}'}</button>
          <div style={{ color: '#b06a15', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, fontFamily: 'Russo One, Impact, sans-serif' }}><Coins size={18} /> <AnimatedNumber value={app.money} /></div>
          <div style={{ color: '#5f43a0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 14 }}><Zap size={16} /> <AnimatedNumber value={app.energy} format={(n) => `${n}/${maxEnergy}`} /></div>
        </div>
      </div>

      <div onClick={() => app.setModifierOpen(true)} style={{ backgroundColor: 'rgba(90,70,40,0.08)', border: `1px solid ${modifier.color}`, borderRadius: 8, padding: 12, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div style={{ fontSize: 20 }}>🔥</div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: modifier.color, fontSize: 14 }}>{modifier.name}</div>
          <div style={{ fontSize: 12, color: '#6b5f45' }}>{modifier.desc}</div>
        </div>
        <div style={{ fontSize: 12, color: '#6b5f45' }}>Подробнее →</div>
      </div>

      <TutorialCard app={app} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 10, backgroundColor: '#fbf4e4', border: '1px solid rgba(192, 132, 252, 0.3)', color: '#2f2a1d', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Briefcase size={24} color="#5f43a0" /><span style={{ fontSize: 13 }}>Мои бизнесы</span>
        </button>
        <button onClick={() => app.setTab('cafe')} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 10, backgroundColor: '#fbf4e4', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#2f2a1d', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Coffee size={24} color="#b06a15" /><span style={{ fontSize: 13 }}>Пить кофе</span>
        </button>
      </div>

      {(app.role === 'admin' || app.role === 'superadmin') && <>
        <button onClick={app.openAdmin} style={{ width: '100%', marginBottom: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, border: '2px solid #8f302b', background: 'linear-gradient(180deg, #c94b40, #a9322a)', color: '#fff4e0', boxShadow: '0 4px 0 rgba(90,35,30,.35)', fontFamily: 'Russo One, sans-serif', fontSize: 14, cursor: 'pointer' }}><ShieldAlert size={20} /> Панель администратора</button>
        <button onClick={() => app.setMaintenance(true)} disabled={app.maintenanceBusy || app.maintenanceEnabled} style={{ width: '100%', marginBottom: 18, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, border: '1px solid rgba(61,126,166,.45)', background: 'rgba(61,126,166,.12)', color: '#2f5f7d', fontWeight: 700, cursor: app.maintenanceBusy || app.maintenanceEnabled ? 'default' : 'pointer', opacity: app.maintenanceEnabled ? .55 : 1 }}><Wrench size={18} /> {app.maintenanceEnabled ? 'Техработы включены' : 'Закрыть игру на техработы'}</button>
        {app.maintenanceError && <p role="alert" style={{ color: '#c0453a' }}>{app.maintenanceError}</p>}
      </>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => app.setTab('shop')} style={{ ...S.btnPurple, flex: 1, width: 'auto', minWidth: 0, padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}><Gift size={18} /> Донат</button>
        <button onClick={() => app.setTab('profile')} style={{ ...S.btnSecondary, flex: 1, width: 'auto', minWidth: 0, padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}><Palette size={18} /> Косметика</button>
      </div>

      {myCoffee && (
        <div style={{ backgroundColor: '#fbf4e4', border: '1px solid rgba(63,157,85,0.35)', borderRadius: 10, padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(63,157,85,0.15)', padding: 10, borderRadius: 12 }}><Coins size={24} color="#2c7a3c" /></div>
            <div><div style={{ fontSize: 16, fontWeight: 'bold' }}>Касса: {myCoffee.business_name}</div><div style={{ fontSize: 12, color: '#6b5f45' }}>Доход: <span style={{ color: '#2c7a3c', fontWeight: 'bold'}}>{myCoffee.coffee_balance || 0}</span> монет</div></div>
          </div>
          <Btn variant="primary" onClick={app.collect} disabled={app.proc || !myCoffee.coffee_balance} style={{ width: 'auto', padding: '10px 15px', fontSize: 14 }}>Собрать</Btn>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn variant="purple" onClick={app.work} disabled={app.proc || app.energy < energyCost} style={{ position: 'relative', overflow: 'visible', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: '#f6f2fc', padding: 20, fontSize: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Users size={24} /> Вкалывать (-{energyCost}⚡ +{app.workPay}💰)</div>
          {app.bizBonusPercent > 0 && <div style={{ fontSize: 12, color: '#d9f2e2', display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={14}/> Бонус бизнесов: +{app.bizBonusPercent}%</div>}
          {workReward && <span key={workReward.id} className="work-reward-float">+{workReward.amount} {'\u20bd'}</span>}
        </Btn>
        
        <Btn variant="secondary" onClick={app.rest} disabled={app.proc || app.tLeft > 0 || app.energy >= maxEnergy} style={{ background: '#fbf4e4', border: '1px solid rgba(90,70,40,0.22)', color: app.tLeft > 0 ? '#6b5f45' : '#2f2a1d', padding: 20, fontSize: 18 }}>
          <Zap size={24} color={app.tLeft > 0 ? '#6b5f45' : '#2c7a3c'} /> {app.tLeft > 0 ? `Отдыхаем ${app.tLeft} сек...` : `Отдых (${app.restTime / 1000} сек)`}
        </Btn>
      </div>
    </div>
  );
};

export const MarketItem = ({ item, app, type }: any) => (
  <div style={{ backgroundColor: '#fbf4e4', padding: 15, borderRadius: 10, border: '1px solid rgba(90,70,40,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
        {type === 'phone' ? (item.item_data === 'button' ? <Phone size={18} color="#6b5f45" /> : <Smartphone size={18} color="#6b5f45" />) 
        : type === 'car' ? <Car size={18} /> : <Building size={18} />} 
        {type === 'car' ? (item.item_data === 'lada' ? 'Лада' : 'Тойота') : type === 'house' ? 'Квартира' : (item.item_data === 'button' ? 'Кнопочный тел.' : item.item_data === 'smartphone' ? 'Смартфон' : 'Телефон')}
      </div>
      <div style={{ fontSize: 12, color: '#6b5f45', marginTop: 4 }}>Продавец: {item.seller_name}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <span style={{ color: '#b06a15', fontWeight: 'bold', fontFamily: 'Russo One, Impact, sans-serif' }}>{item.price.toLocaleString('ru-RU')}</span>
      {item.seller_id !== app.pid ? (
        <Btn variant="primary" onClick={() => app.buyLot(item)} disabled={app.proc} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>Купить</Btn>
      ) : (
        <button onClick={() => app.cancelLot(item)} style={{ background: 'transparent', border: 'none', color: '#c0453a', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Снять с продажи</button>
      )}
    </div>
  </div>
);

export const MarketTab = ({ app }: { app: any }) => {
  const [showTop, setShowTop] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'money' | 'referrals'>('money');
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<any>(null);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const myLots = app.market.filter((m: any) => m.seller_id === app.pid).length;
  const maxSlots = app.marketSlots;
  const topPlayers = leaderboardMode === 'money' ? app.players : app.referralLeaderboard;

  const openPlayerProfile = async (topPlayer: any) => {
    const targetId = topPlayer.id || topPlayer.player_id;
    if (!targetId) return app.showMsg('Не удалось открыть профиль игрока', true);
    if (String(targetId) === String(app.pid)) return app.handleAvatar();
    setSelectedPublicProfile(null);
    setPublicProfileLoading(true);
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'public_profile',
          target_player_id: targetId,
          init_data: (window as any).Telegram?.WebApp?.initData || '',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.profile) throw new Error(result.error || 'Не удалось загрузить профиль');
      setSelectedPublicProfile(result.profile);
    } catch (error) {
      app.showMsg(error instanceof Error ? error.message : 'Не удалось загрузить профиль', true);
    } finally {
      setPublicProfileLoading(false);
    }
  };

  if (showTop) {
    return (
      <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setShowTop(false)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} color="#b06a15"/>{leaderboardMode === 'money' ? '\u0422\u043e\u043f \u0431\u043e\u0433\u0430\u0447\u0435\u0439' : '\u0422\u043e\u043f \u043f\u043e \u0440\u0435\u0444\u0435\u0440\u0430\u043b\u0430\u043c'}</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, background: '#fbf4e4', padding: 5, borderRadius: 8 }}>
          <button onClick={() => setLeaderboardMode('money')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 10, border: 0, borderRadius: 7, cursor: 'pointer', background: leaderboardMode === 'money' ? '#b06a15' : 'transparent', color: leaderboardMode === 'money' ? '#fff' : '#6b5f45', fontWeight: 'bold' }}><Coins size={15} /> {'\u041f\u043e \u0434\u0435\u043d\u044c\u0433\u0430\u043c'}</button>
          <button onClick={() => setLeaderboardMode('referrals')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 10, border: 0, borderRadius: 7, cursor: 'pointer', background: leaderboardMode === 'referrals' ? '#c0453a' : 'transparent', color: leaderboardMode === 'referrals' ? '#fff' : '#6b5f45', fontWeight: 'bold' }}><Users size={15} /> {'\u0420\u0435\u0444\u0435\u0440\u0430\u043b\u044b'}</button>
        </div>
        <div style={{ marginTop: 20 }}>
          {topPlayers.length === 0 && <p style={{ color: '#6b5f45' }}>{leaderboardMode === 'referrals' && app.referralLeaderboardUnavailable ? '\u0420\u0435\u0439\u0442\u0438\u043d\u0433 \u0440\u0435\u0444\u0435\u0440\u0430\u043b\u043e\u0432 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d' : leaderboardMode === 'money' ? '\u041f\u043e\u043a\u0430 \u043d\u0438\u043a\u043e\u0433\u043e...' : '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u044b\u0445'}</p>}
          {topPlayers.map((p: any, i: number) => (
            <button key={p.id || p.player_id || `${p.nickname}-${i}`} type="button" disabled={publicProfileLoading} onClick={() => void openPlayerProfile(p)} title="Открыть профиль" style={{ width: '100%', backgroundColor: '#fbf4e4', padding: '12px 15px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(90,70,40,0.08)', marginBottom: 8, color: '#2f2a1d', cursor: publicProfileLoading ? 'wait' : 'pointer', textAlign: 'left', opacity: publicProfileLoading ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#b06a15' : i === 1 ? '#5f43a0' : i === 2 ? '#3d7ea6' : '#6b5f45', minWidth: 26 }}>#{i + 1}</span>
                <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
              </div>
              <span style={{ color: leaderboardMode === 'money' ? '#2c7a3c' : '#c0453a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{leaderboardMode === 'money' ? <>{Number(p.money || 0).toLocaleString('ru-RU')} <Coins size={14} /></> : <>{Number(p.referral_count || 0).toLocaleString('ru-RU')} {'\u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u044b\u0445'}</>}</span>
            </button>
          ))}
        </div>
        <PublicProfileModal
          profile={selectedPublicProfile}
          loading={publicProfileLoading}
          onClose={() => setSelectedPublicProfile(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
        <button 
          onClick={() => setShowTop(true)} 
          title="Топ богачей"
          style={{ background: 'rgba(224,138,46,0.15)', border: '1px solid #b06a15', color: '#b06a15', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Trophy size={16} />
        </button>
        <h2 style={{ margin: 0 }}>Рынок</h2>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div style={{ fontSize: 14, color: '#6b5f45' }}>Твои слоты: <b style={{color: '#2f2a1d'}}>{myLots} / {maxSlots}</b></div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#fbf4e4', padding: 5, borderRadius: 8 }}>
        {['items', 'cars', 'realestate'].map((t: any) => (
          <button key={t} onClick={() => app.setMarketTab(t)} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 12, backgroundColor: app.marketTab === t ? '#3d7ea6' : 'transparent', color: app.marketTab === t ? '#f0f7fb' : '#6b5f45', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
            {t === 'items' ? '📱 Предметы' : t === 'cars' ? '🚗 Авто' : '🏠 Жильё'}
          </button>
        ))}
      </div>

      <h3 style={{ color: '#6b5f45', fontSize: 16, marginBottom: 10 }}>{app.marketTab === 'items' ? 'Лоты (Предметы)' : app.marketTab === 'cars' ? 'Лоты (Авто)' : 'Лоты (Жилье)'}</h3>
      {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).length === 0 && <p style={{ color: '#6b5f45' }}>Пусто...</p>}
      {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).map((item: any) => (
        <MarketItem key={item.id} item={item} app={app} type={item.item_type} />
      ))}
    </div>
  );
};

export const BusinessTab = ({ app, activeBiz, currentStock }: any) => {
  const [passiveNow, setPassiveNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setPassiveNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const bizTypes = ['coffee', 'salon', 'taxi', 'phone_factory', 'construction'];
  const currentIndex = bizTypes.indexOf(app.activeBizType);
  const prevType = bizTypes[(currentIndex - 1 + 5) % 5];
  const nextType = bizTypes[(currentIndex + 1) % 5];

  const getPrice = (type: string) => type === 'coffee' ? COFFEE_BIZ_PRICE : type === 'salon' ? SALON_BIZ_PRICE : type === 'taxi' ? TAXI_BIZ_PRICE : type === 'phone_factory' ? PHONE_FACTORY_BIZ_PRICE : CONSTRUCTION_BIZ_PRICE;
  const getBizName = (type: string) => type === 'coffee' ? 'Кофейня' : type === 'salon' ? 'Автосалон' : type === 'taxi' ? 'Таксопарк' : type === 'phone_factory' ? 'Телефонный цех' : 'Стройтрест';

  const bizWorkers = app.allWorkers?.filter((w: any) => w.business_id === activeBiz?.id) || [];
  const salonHasSeller = bizWorkers.some((worker: any) => worker.role === 'Продавец');
  const carOrderTotal = (price: number, amount: number) => {
    const subtotal = price * amount;
    return salonHasSeller ? subtotal : subtotal + Math.floor(subtotal * 0.1);
  };
  const passiveTiers = activeBiz ? BUSINESS_PASSIVE_TIERS[activeBiz.biz_type as keyof typeof BUSINESS_PASSIVE_TIERS] : null;
  const passiveLevel = Math.max(-1, Math.min(3, Number(activeBiz?.passive_level ?? -1)));
  const nextPassiveTier = passiveTiers?.[passiveLevel + 1];
  const passiveCarCount = activeBiz?.biz_type === 'taxi' ? (getStock(activeBiz).taxi_cars?.length || 0) : 1;
  const passiveHasStaff = activeBiz?.biz_type !== 'taxi' || bizWorkers.length > 0;
  const passiveRate = passiveLevel >= 0 && passiveTiers ? passiveTiers[passiveLevel].incomePerMinute : 0;
  const passiveUpdatedAt = Date.parse(activeBiz?.passive_updated_at || '');
  const passiveElapsedMinutes = passiveLevel >= 0 && passiveHasStaff && Number.isFinite(passiveUpdatedAt)
    ? Math.max(0, Math.floor((passiveNow - passiveUpdatedAt) / 60000))
    : 0;
  const passivePending = Number(activeBiz?.passive_balance || 0) + passiveElapsedMinutes * passiveRate * passiveCarCount;

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Мой Бизнес</h2>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setActiveBizType(prevType)} style={{ background: 'rgba(90,70,40,0.08)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}><ChevronLeft size={20} color="#2f2a1d" /></button>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{activeBiz ? activeBiz.business_name : getBizName(app.activeBizType)}</div>
        <button onClick={() => app.setActiveBizType(nextType)} style={{ background: 'rgba(90,70,40,0.08)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}><ChevronRight size={20} color="#2f2a1d" /></button>
      </div>

      {activeBiz ? (
        <div style={S.card}>
          {app.activeBizType === 'salon' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Лада ({currentStock.lada || 0}) | Тойота ({currentStock.toyota || 0})</b></p>
              {app.carOrderEnd > 0 ? (<div style={{ background: 'rgba(61,126,166,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(61,126,166,0.25)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#3d7ea6' }}>Едут: <b>{currentStock.order_amount || 1} {currentStock.current_model === 'lada' ? 'Лад' : 'Тойот'}</b></p><p style={{ margin: 0, fontSize: 22, color: '#3d7ea6', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.carTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
                  <p style={{ fontSize: 12, color: '#6b5f45', margin: 0 }}>Заказ Лады · {LADA_PRICE.toLocaleString('ru-RU')} ₽/шт. · 15 мин{!salonHasSeller ? ' · без продавца +10%' : ''}</p>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[1, 5, 10].map(n => <Btn key={n} variant="secondary" onClick={() => app.orderCar('lada', n)} disabled={app.proc || app.money < carOrderTotal(LADA_PRICE, n)} style={{ flex: 1, padding: '8px 3px', fontSize: 11, lineHeight: 1.25, background: 'rgba(61,126,166,0.10)', color: '#3d7ea6', border: '1px solid #3d7ea6' }}>×{n} · {carOrderTotal(LADA_PRICE, n).toLocaleString('ru-RU')} ₽</Btn>)}
                  </div>
                  <p style={{ fontSize: 12, color: '#6b5f45', margin: '10px 0 0 0' }}>Заказ Тойоты · {TOYOTA_PRICE.toLocaleString('ru-RU')} ₽/шт. · 45 мин{!salonHasSeller ? ' · без продавца +10%' : ''}</p>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[1, 5, 10].map(n => <Btn key={n} variant="secondary" onClick={() => app.orderCar('toyota', n)} disabled={app.proc || app.money < carOrderTotal(TOYOTA_PRICE, n)} style={{ flex: 1, padding: '8px 3px', fontSize: 11, lineHeight: 1.25, background: 'rgba(61,126,166,0.10)', color: '#3d7ea6', border: '1px solid #3d7ea6' }}>×{n} · {carOrderTotal(TOYOTA_PRICE, n).toLocaleString('ru-RU')} ₽</Btn>)}
                  </div>
                </div>)}
              {currentStock.lada > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('lada'); app.setSellPrice(String(DEFAULT_SELL_LADA)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Ладу</Btn>}
              {currentStock.toyota > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('toyota'); app.setSellPrice(String(DEFAULT_SELL_TOYOTA)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Тойоту</Btn>}
          </>)}
          
          {app.activeBizType === 'construction' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Склад квартир: <b>{currentStock.apartments || 0} шт.</b></p>
              {app.buildEnd > 0 ? (<div style={{ background: 'rgba(224,138,46,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#b06a15' }}>Строится дом...</p><p style={{ margin: 0, fontSize: 22, color: '#b06a15', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.buildTimeLeft} сек.</p></div>)
              : (<Btn variant="secondary" onClick={app.startBuild} disabled={app.proc || app.money < BUILDING_PRICE} style={{ background: 'rgba(224,138,46,0.10)', color: '#b06a15', border: '1px solid #b06a15', marginBottom: 15 }}><Hammer size={20}/> Построить дом ({BUILDING_PRICE.toLocaleString('ru-RU')})</Btn>)}
              {currentStock.apartments > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('house'); app.setSellItemData('apartment'); app.setSellPrice(String(DEFAULT_SELL_APARTMENT)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Building size={18}/> Продать квартиру</Btn>}
          </>)}

          {app.activeBizType === 'phone_factory' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Кнопочные ({currentStock.button || 0}) | Смартфоны ({currentStock.smartphone || 0})</b></p>
              {app.phoneProdEnd > 0 ? (<div style={{ background: 'rgba(122,92,184,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(139, 92, 246, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#5f43a0' }}>Производится партия...</p><p style={{ margin: 0, fontSize: 22, color: '#5f43a0', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.phoneProdTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}><Btn variant="secondary" onClick={() => app.orderPhones('button')} disabled={app.proc || app.money < BUTTON_BATCH_COST} style={{ background: 'rgba(90,70,40,0.08)', color: '#6b5f45', border: '1px solid rgba(90,70,40,0.3)', display: 'flex', justifyContent: 'space-between' }}><span>Кнопочные ({BUTTON_BATCH_SIZE} шт.)</span><span>{BUTTON_BATCH_COST.toLocaleString('ru-RU')}</span></Btn><Btn variant="secondary" onClick={() => app.orderPhones('smartphone')} disabled={app.proc || app.money < SMARTPHONE_BATCH_COST} style={{ background: 'rgba(90,70,40,0.08)', color: '#6b5f45', border: '1px solid rgba(90,70,40,0.3)', display: 'flex', justifyContent: 'space-between' }}><span>Смартфоны ({SMARTPHONE_BATCH_SIZE} шт.)</span><span>{SMARTPHONE_BATCH_COST.toLocaleString('ru-RU')}</span></Btn></div>)}
              {currentStock.button > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('button'); app.setSellPrice(String(DEFAULT_SELL_BUTTON)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Phone size={18}/> Продать кнопочный</Btn>}
              {currentStock.smartphone > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('smartphone'); app.setSellPrice(String(DEFAULT_SELL_SMARTPHONE)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Smartphone size={18}/> Продать смартфон</Btn>}
          </>)}

          {app.activeBizType === 'taxi' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Машин в парке: <b>{currentStock.taxi_cars?.length || 0}</b></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
                {currentStock.taxi_cars?.map((car: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontWeight: 'bold' }}>{car.model === 'lada' ? 'Лада' : 'Тойота'}</span><span style={{ color: car.health > 50 ? '#3f9d55' : car.health > 0 ? '#b06a15' : '#c0453a' }}>{car.health}%</span></div>
                    {car.health <= 0 && <Btn variant="danger" onClick={() => app.repairTaxiCar(i)} disabled={app.proc} style={{ padding: 8, fontSize: 12, marginTop: 5 }}><Wrench size={14}/> Ремонт ({car.model === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA})</Btn>}
                  </div>
                ))}
              </div>
              <Btn variant="primary" onClick={app.collectTaxi} disabled={app.proc || !currentStock.taxi_cars?.length || !app.allWorkers?.some((w: any) => w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id && w.role === 'Водитель')} style={{ marginBottom: 10 }}>{!currentStock.taxi_cars?.length ? 'Нет машин' : !app.allWorkers?.some((w: any) => w.role === 'Водитель' && w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id) ? 'Нужен водитель' : 'Собрать доход'}</Btn>
              <p style={{ fontSize: 12, color: '#6b5f45', marginBottom: 5 }}>Добавить машину в парк:</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="secondary" onClick={() => app.addTaxiCar('lada')} disabled={app.proc} style={{ padding: 10, fontSize: 12 }}>+ Лада</Btn>
                <Btn variant="secondary" onClick={() => app.addTaxiCar('toyota')} disabled={app.proc} style={{ padding: 10, fontSize: 12 }}>+ Тойота</Btn>
              </div>
          </>)}
          
          {app.activeBizType === 'coffee' && (
            <div style={{ marginTop: 15 }}>
              <p style={{ fontSize: 14, color: '#6b5f45', marginBottom: 10 }}>Касса кафе: <b style={{ color: '#3f9d55', fontSize: 18, fontFamily: 'Russo One' }}>{activeBiz.coffee_balance || 0}</b> монет</p>
              <Btn variant="primary" onClick={app.collect} disabled={app.proc || !activeBiz.coffee_balance} style={{ marginBottom: 15 }}>Собрать кассу</Btn>
            </div>
          )}

          {passiveTiers && (
            <div style={{ marginTop: 20, padding: 15, borderRadius: 12, background: 'linear-gradient(145deg, rgba(40,32,20,0.96), rgba(24,24,28,0.94))', border: '1px solid rgba(214,177,103,0.35)', color: '#f8f0df', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#f1d28f' }}>Пассивный доход</h3>
                <span style={{ fontSize: 12, color: '#d2c5a7' }}>{passiveLevel < 0 ? 'Закрыт' : `Уровень ${passiveLevel} / 3`}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d2c5a7' }}>
                {passiveLevel < 0
                  ? 'Открой пассивный доход и получай деньги, пока играешь или отдыхаешь.'
                  : `${(passiveRate * passiveCarCount).toLocaleString('ru-RU')} ₽ в минуту${activeBiz.biz_type === 'taxi' ? ` · ${passiveRate} ₽ за машину` : ''}`}
              </p>
              {passiveLevel >= 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#d2c5a7', fontSize: 13 }}>{passiveHasStaff ? 'Накоплено' : 'Для дохода найми сотрудника'}</span>
                    <b style={{ color: '#9ee6a9', fontSize: 16 }}>{passivePending.toLocaleString('ru-RU')} ₽</b>
                  </div>
                  {activeBiz.biz_type === 'taxi' && passiveCarCount === 0 && <p style={{ margin: '0 0 10px', color: '#e5be72', fontSize: 12 }}>Добавь машины в таксопарк, чтобы получать доход.</p>}
                  <Btn variant="primary" onClick={() => app.collectBusinessPassive(activeBiz.id)} disabled={app.proc || passivePending <= 0} style={{ marginBottom: 8, background: 'linear-gradient(135deg, #3f9d55, #26713a)' }}>Собрать пассивный доход</Btn>
                </>
              )}
              {nextPassiveTier ? (
                <Btn variant="secondary" onClick={() => app.upgradeBusinessPassive(activeBiz.id)} disabled={app.proc || app.money < nextPassiveTier.cost} style={{ background: 'rgba(214,177,103,0.14)', border: '1px solid rgba(214,177,103,0.55)', color: '#f1d28f' }}>
                  {passiveLevel < 0 ? 'Открыть' : `Улучшить до уровня ${passiveLevel + 1}`} · {nextPassiveTier.cost.toLocaleString('ru-RU')} ₽
                </Btn>
              ) : (
                <p style={{ margin: '8px 0 0', color: '#9ee6a9', fontSize: 13, textAlign: 'center' }}>Максимальный уровень</p>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid rgba(90,70,40,0.22)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#6b5f45' }}>Сотрудники ({bizWorkers.length})</h4>
            {bizWorkers.length === 0 && <p style={{ fontSize: 12, color: '#b06a15', margin: 0 }}>Нет сотрудников. Биржа труда ждет!</p>}
            {bizWorkers.map((w: any) => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 13, textAlign: 'left' }}><b>{w.player_name}</b><br/><span style={{ color: '#6b5f45', fontSize: 11 }}>{w.role} (ЗП: {activeBiz.biz_type === 'salon' ? (w.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : `${w.salary} ₽`})</span></div>
                <Btn variant="danger" onClick={() => app.fire(w.id)} disabled={app.proc} style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>Уволить</Btn>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(90,70,40,0.22)' }}>
            <Btn variant="danger" onClick={() => app.sellBusiness(activeBiz)} disabled={app.proc} style={{ background: 'transparent', border: '1px solid #c0453a', color: '#c0453a' }}>Продать бизнес (за 50%)</Btn>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <Store size={48} color="#5f43a0" style={{ marginBottom: 15 }} />
          <h3>Купить {getBizName(app.activeBizType)}</h3>
          <Btn variant="purple" onClick={() => app.setBuyingType(app.activeBizType)} disabled={app.proc || app.money < getPrice(app.activeBizType)} style={{ background: app.money < getPrice(app.activeBizType) ? '#e7d9b8' : 'linear-gradient(135deg, #7a5cb8 0%, #7a5cb8 100%)', color: '#f6f2fc' }}>{app.proc ? 'Обработка...' : `Купить за ${getPrice(app.activeBizType).toLocaleString('ru-RU')}`}</Btn>
        </div>
      )}
    </div>
  );
};

const formatLogTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return iso; }
};

const LogEntry = ({ log }: { log: any }) => {
  const [open, setOpen] = useState(false);
  const isMoney = log.action_type === 'money_change';
  const delta = log.money_delta || 0;
  const details = log.details || {};
  
  let summary = '';
  if (isMoney) {
    summary = `💰 ${delta > 0 ? '+' : ''}${delta} → ${log.money_after ?? '?'}`;
  } else {
    summary = log.action_type.replace(/_/g, ' ');
    if (details.code) summary += ` · ${details.code}`;
    if (details.amount) summary += ` · ${details.amount}`;
    if (details.reason) summary += ` · ${details.reason}`;
  }

  return (
    <div 
      onClick={() => setOpen(o => !o)} 
      style={{ 
        backgroundColor: '#fbf4e4', padding: 10, borderRadius: 12, marginBottom: 6, 
        border: `1px solid ${isMoney ? (delta > 0 ? 'rgba(63,157,85,0.35)' : 'rgba(192,69,58,0.35)') : 'rgba(90,70,40,0.08)'}`,
        cursor: 'pointer', textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#6b5f45', minWidth: 90 }}>{formatLogTime(log.created_at)}</div>
        <div style={{ flex: 1, fontSize: 12 }}>
          <b style={{ color: isMoney ? (delta > 0 ? '#3f9d55' : '#c0453a') : '#2f6a94' }}>{summary}</b>
          {log.nickname && <span style={{ color: '#6b5f45' }}> · {log.nickname}</span>}
        </div>
      </div>
      {open && (
        <pre style={{ 
          marginTop: 8, padding: 8, background: '#e7d9b8', borderRadius: 8, 
          fontSize: 10, color: '#6b5f45', overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>{JSON.stringify({ player_id: log.player_id, telegram_id: log.telegram_id, ...details }, null, 2)}</pre>
      )}
    </div>
  );
};

export const AdminTab = ({ app }: { app: any }) => {
  const [searchQ, setSearchQ] = useState('');
  const [foundPlayers, setFoundPlayers] = useState<any[]>([]);
  const [activeSearchQ, setActiveSearchQ] = useState('');
  const [adminPlayersPage, setAdminPlayersPage] = useState(1);
  const [adminPlayersPages, setAdminPlayersPages] = useState(1);
  const [adminPlayersTotal, setAdminPlayersTotal] = useState(0);
  const [adminPlayersLoading, setAdminPlayersLoading] = useState(false);
  const playersRequestId = useRef(0);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerBizs, setPlayerBizs] = useState<any[]>([]);
  const [playerDetailsLoading, setPlayerDetailsLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoLimit, setPromoLimit] = useState('100');
  const [grantCosmeticId, setGrantCosmeticId] = useState('frame_test');
  
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState<string>('all');

  const logClientEvent = async (actionType: string, details: any = {}) => {
    try { await app.supabase.rpc('log_action_rpc', { p_player_id: app.pid, p_action_type: actionType, p_details: details }); }
    catch (e) { /* ignore */ }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await app.supabase.rpc('get_logs_rpc', {
      p_admin_id: app.pid,
      p_limit: 200,
      p_action_type: logsFilter === 'all' ? null : logsFilter
    });
    setLogsLoading(false);
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    setLogs(data?.logs || []);
  };

  const cleanupLogs = async () => {
    if (!window.confirm('Удалить логи старше 30 дней?')) return;
    const { data, error } = await app.supabase.rpc('cleanup_logs_rpc', { p_admin_id: app.pid, p_keep_days: 30 });
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    app.showMsg(`Удалено ${data?.deleted || 0} записей`);
    loadLogs();
  };

  useEffect(() => {
    if (app.adminTab === 'logs') loadLogs();
  }, [app.adminTab, logsFilter]);

  const loadAdminPlayers = async (page = adminPlayersPage, query = activeSearchQ) => {
    const requestId = ++playersRequestId.current;
    setAdminPlayersLoading(true);
    try {
      const response = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_list', page, query, init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const result = await response.json();
      if (requestId !== playersRequestId.current) return;
      if (!response.ok) return app.showMsg(result.error || 'Не удалось загрузить игроков', true);
      const pages = Math.max(1, Number(result.total_pages) || 1);
      if (page > pages) {
        setAdminPlayersPages(pages);
        setAdminPlayersPage(pages);
        return;
      }
      setFoundPlayers(result.players || []);
      setAdminPlayersTotal(Number(result.total) || 0);
      setAdminPlayersPages(pages);
    } catch {
      if (requestId !== playersRequestId.current) return;
      app.showMsg('Не удалось загрузить игроков', true);
    } finally {
      if (requestId === playersRequestId.current) setAdminPlayersLoading(false);
    }
  };

  useEffect(() => {
    if (app.adminTab === 'players' && !selectedPlayer) loadAdminPlayers();
  }, [app.adminTab, adminPlayersPage, activeSearchQ, selectedPlayer]);

  const handleSearch = () => {
    const query = searchQ.trim();
    if (adminPlayersPage !== 1) setAdminPlayersPage(1);
    if (activeSearchQ === query && adminPlayersPage === 1) loadAdminPlayers(1, query);
    else setActiveSearchQ(query);
  };
  
  const loadPlayerDetails = async (p: any) => { 
    const requestId = ++playersRequestId.current;
    setSelectedPlayer(p);
    setPlayerDetailsLoading(true);
    try {
      const { data, error } = await app.supabase.from('businesses').select('*').eq('owner_id', p.id);
      if (error) throw error;
      if (requestId !== playersRequestId.current) return;
      setPlayerBizs(data || []);
    } catch (error: any) {
      if (requestId !== playersRequestId.current) return;
      setPlayerBizs([]);
      app.showMsg(error?.message || 'Не удалось загрузить бизнесы игрока', true);
    } finally {
      if (requestId === playersRequestId.current) setPlayerDetailsLoading(false);
    }
  };
  
  const handleGiveMoney = async (amount: number) => { 
    if (!selectedPlayer) return; 
    // выдача денег — только через админ-RPC (роль проверяется на сервере, лог пишется там же)
    const { data, error } = await app.supabase.rpc('admin_give_money_rpc', { p_admin_id: app.pid, p_target_player_id: selectedPlayer.id, p_amount: amount });
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    const newMoney = Math.max(0, Number(data?.money ?? selectedPlayer.money + amount));
    setSelectedPlayer({ ...selectedPlayer, money: newMoney });
    app.showMsg(`Выдано ${amount}`); 
    if (app.loadData) app.loadData(true); 
  };
  
  const handleGrantCosmetic = async () => {
    if (!selectedPlayer) return;
    try {
      const response = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_grant_cosmetic',
          target_player_id: selectedPlayer.id,
          item_id: grantCosmeticId,
          init_data: (window as any).Telegram?.WebApp?.initData || '',
        }),
      });
      const result = await response.json();
      if (!response.ok) return app.showMsg(result.error || 'Не удалось выдать косметику', true);
      setSelectedPlayer((current: any) => current ? { ...current, owned_cosmetics: result.owned_cosmetics || [] } : current);
      app.showMsg(result.already_owned ? 'У игрока уже есть этот предмет' : 'Косметика выдана');
      if (selectedPlayer.id === app.pid && app.loadData) await app.loadData(true);
    } catch {
      app.showMsg('Не удалось выдать косметику', true);
    }
  };

  const handleBan = async () => { 
    if (!selectedPlayer) return; 
    const newStatus = !selectedPlayer.is_banned; 
    // RLS запрещает прямой UPDATE — только через админ-RPC (проверка роли на сервере)
    const { error: banErr } = await app.supabase.rpc('admin_set_ban_rpc', { p_admin_id: app.pid, p_target_player_id: selectedPlayer.id, p_val: newStatus });
    if (banErr) return app.showMsg(banErr.message || 'Ошибка бана', true); 
    setSelectedPlayer({ ...selectedPlayer, is_banned: newStatus }); 
    await logClientEvent(newStatus ? 'admin_ban' : 'admin_unban', { target_nick: selectedPlayer.nickname, target_id: selectedPlayer.id });
    app.showMsg(newStatus ? "Забанен" : "Разбанен"); 
    if (app.loadData) app.loadData(true); 
  };
  
  const handleDeleteBiz = async (bizId: string) => { 
    if (!window.confirm("Удалить этот бизнес?")) return; 
    const bizName = playerBizs.find(b => b.id === bizId)?.business_name;
    const { error: delErr } = await app.supabase.rpc('admin_delete_biz_rpc', { p_admin_id: app.pid, p_biz_id: bizId });
    if (delErr) return app.showMsg(delErr.message || 'Ошибка удаления', true); 
    setPlayerBizs(prev => prev.filter(b => b.id !== bizId)); 
    await logClientEvent('admin_delete_biz', { target_nick: selectedPlayer?.nickname, target_id: selectedPlayer?.id, biz_id: bizId, biz_name: bizName });
    app.showMsg("Бизнес удален"); 
    if (app.loadData) app.loadData(true); 
  };
  
  const handleCreatePromo = async () => { 
    if (!promoCode || !promoAmount) return app.showMsg("Заполни все поля", true);
    const amount = parseInt(promoAmount);
    const limit = parseInt(promoLimit);
    if (isNaN(amount) || amount <= 0) return app.showMsg("Неверная сумма", true);
    if (isNaN(limit) || limit <= 0) return app.showMsg("Неверный лимит", true);
    
    const { data, error } = await app.supabase.rpc('create_promo_rpc', {
      p_admin_id: app.pid,
      p_code: promoCode.toUpperCase().trim(),
      p_amount: amount,
      p_max_uses: limit
    });
    if (error) return app.showMsg(error.message, true);
    if (data && data.error) return app.showMsg(data.error, true);
    
    await logClientEvent('admin_create_promo', { code: promoCode.toUpperCase().trim(), amount, max_uses: limit });
    app.showMsg("Промокод создан!"); 
    setPromoCode(''); 
    setPromoAmount('');
  };

  const logFilters = ['all', 'money_change', 'admin_give_money', 'admin_ban', 'admin_unban', 'admin_delete_biz', 'admin_create_promo', 'admin_grant_cosmetic', 'promo_used'];

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: 10 }}>
        <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#6b5f45', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, color: '#c0453a', display: 'flex', alignItems: 'center', gap: 5 }}><ShieldAlert size={20}/> Админка</h2>
      </div>
      
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <Btn variant={app.adminTab === 'players' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('players')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'players' ? '#c0453a' : '#fbf4e4' }}>Игроки</Btn>
        <Btn variant={app.adminTab === 'promos' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('promos')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'promos' ? '#c0453a' : '#fbf4e4' }}>Промо</Btn>
        <Btn variant={app.adminTab === 'logs' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('logs')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'logs' ? '#c0453a' : '#fbf4e4' }}>Логи</Btn>
      </div>

      {app.adminTab === 'players' && (
        <div>
          {!selectedPlayer ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input type="text" placeholder="Поиск по нику..." value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} style={{ ...S.input, marginBottom: 0, flex: 1 }} />
                <Btn variant="primary" onClick={handleSearch} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '0 15px' }}><Search size={20}/></Btn>
                {activeSearchQ && <Btn variant="secondary" onClick={() => { setSearchQ(''); setActiveSearchQ(''); setAdminPlayersPage(1); }} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '0 10px' }}>Сбросить</Btn>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12, color: '#6b5f45' }}>
                <span>{activeSearchQ ? `Результаты поиска: ${adminPlayersTotal}` : `Игроков: ${adminPlayersTotal}`}</span>
                <Btn variant="secondary" onClick={() => loadAdminPlayers()} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>Обновить</Btn>
              </div>
              {adminPlayersLoading && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Загружаю игроков...</p>}
              {foundPlayers.map(p => (
                <div key={p.id} onClick={() => loadPlayerDetails(p)} style={{ background: '#fbf4e4', padding: 15, borderRadius: 8, marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  <span style={{ color: '#2c7a3c' }}>{p.money} <Coins size={12}/></span>
                </div>
              ))}
              {!adminPlayersLoading && foundPlayers.length === 0 && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Игроки не найдены.</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                <Btn variant="secondary" onClick={() => setAdminPlayersPage(page => Math.max(1, page - 1))} disabled={adminPlayersLoading || adminPlayersPage <= 1} style={{ width: 'auto', padding: '8px 12px' }}>← Назад</Btn>
                <span style={{ color: '#6b5f45', fontSize: 12 }}>Страница {adminPlayersPage} из {adminPlayersPages}</span>
                <Btn variant="secondary" onClick={() => setAdminPlayersPage(page => Math.min(adminPlayersPages, page + 1))} disabled={adminPlayersLoading || adminPlayersPage >= adminPlayersPages} style={{ width: 'auto', padding: '8px 12px' }}>Дальше →</Btn>
              </div>
              
              <div style={{ marginTop: 40, padding: 20, border: '1px solid #c0453a', borderRadius: 8, background: 'rgba(192,69,58,0.08)' }}>
                <h3 style={{ color: '#c0453a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={20}/> Опасная зона</h3>
                <p style={{ fontSize: 13, color: '#6b5f45', marginBottom: 15, textAlign: 'left' }}>Это действие удалит все бизнесы, лоты, уволит рабочих и обнулит деньги ВСЕХ игроков. Отменить это будет невозможно!</p>
                <Btn variant="danger" onClick={app.resetGame} disabled={app.proc}>ПОЛНЫЙ СБРОС ИГРЫ</Btn>
              </div>
            </>
          ) : (
            <div style={S.card}>
              <button onClick={() => setSelectedPlayer(null)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 10, cursor: 'pointer' }}>← К поиску</button>
              <h3 style={{ margin: '0 0 5px 0' }}>{selectedPlayer.nickname}</h3>
              <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 15px 0' }}>ID: {selectedPlayer.telegram_id}</p>
              
              <div style={{ background: '#e7d9b8', padding: 10, borderRadius: 12, marginBottom: 15 }}>
                <p style={{ margin: '0 0 5px 0' }}>Баланс: <b style={{ color: '#2c7a3c' }}>{selectedPlayer.money}</b></p>
                <p style={{ margin: 0 }}>Статус: <b style={{ color: selectedPlayer.is_banned ? '#c0453a' : '#2c7a3c' }}>{selectedPlayer.is_banned ? 'ЗАБАНЕН' : 'Активен'}</b></p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <Btn variant="primary" onClick={() => handleGiveMoney(10000)} style={{ padding: 10, fontSize: 13 }}>+10k</Btn>
                <Btn variant="danger" onClick={() => handleGiveMoney(-10000)} style={{ padding: 10, fontSize: 13 }}>-10k</Btn>
                <Btn variant={selectedPlayer.is_banned ? 'secondary' : 'danger'} onClick={handleBan} style={{ padding: 10, fontSize: 13 }}><Ban size={16}/> {selectedPlayer.is_banned ? 'Разбан' : 'Бан'}</Btn>
              </div>

              <div style={{ borderTop: '1px solid rgba(90,70,40,.3)', paddingTop: 15, marginBottom: 15 }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Выдать косметику</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select aria-label="Косметика для выдачи" value={grantCosmeticId} onChange={e => setGrantCosmeticId(e.target.value)} style={{ ...S.input, marginBottom: 0, flex: 1 }}>
                    <option value="frame_test">Рамка TEST</option>
                    <option value="frame_amber">Янтарная рамка</option>
                    <option value="background_concrete">Фон «Бетон»</option>
                  </select>
                  <Btn variant="purple" onClick={handleGrantCosmetic} style={{ width: 'auto', padding: '8px 12px' }}>Выдать</Btn>
                </div>
              </div>

              <h4 style={{ margin: '15px 0 10px 0', borderTop: '1px solid rgba(90,70,40,0.3)', paddingTop: 15 }}>Бизнесы ({playerBizs.length})</h4>
              {playerDetailsLoading && <p role="status" style={{ color: '#6b5f45', fontSize: 12 }}>Загружаем бизнесы игрока…</p>}

              {playerBizs.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{b.business_name} ({b.biz_type})</span>
                  <button onClick={() => handleDeleteBiz(b.id)} style={{ background: 'none', border: 'none', color: '#c0453a', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
              {playerBizs.length === 0 && <p style={{ color: '#6b5f45', fontSize: 12 }}>Нет бизнесов.</p>}
            </div>
          )}
        </div>
      )}

      {app.adminTab === 'promos' && (
        <div style={S.card}>
          <h3>Создать промокод</h3>
          <input type="text" placeholder="КОД (Англ. буквы)" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} style={S.input} />
          <input type="number" placeholder="Сумма монет" value={promoAmount} onChange={e => setPromoAmount(e.target.value)} style={S.input} />
          <input type="number" placeholder="Лимит активаций" value={promoLimit} onChange={e => setPromoLimit(e.target.value)} style={S.input} />
          <Btn variant="primary" onClick={handleCreatePromo} disabled={app.proc}>Создать</Btn>
        </div>
      )}

      {app.adminTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Btn variant="secondary" onClick={loadLogs} disabled={logsLoading} style={{ padding: 10, fontSize: 12, flex: 1 }}>
              <RefreshCw size={14} style={{ marginRight: 4 }}/> {logsLoading ? 'Загрузка...' : 'Обновить'}
            </Btn>
            <Btn variant="danger" onClick={cleanupLogs} disabled={app.proc} style={{ padding: 10, fontSize: 12, flex: 1, background: 'rgba(192,69,58,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#c0453a' }}>
              <Trash2 size={14} style={{ marginRight: 4 }}/> Очистить 30д+
            </Btn>
          </div>
          
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {logFilters.map(f => (
              <button 
                key={f} 
                onClick={() => setLogsFilter(f)} 
                style={{ 
                  padding: '6px 10px', fontSize: 10, borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: logsFilter === f ? '#3d7ea6' : '#fbf4e4', 
                  color: logsFilter === f ? '#f0f7fb' : '#6b5f45',
                  border: 'none'
                }}
              >{f === 'all' ? 'Все' : f.replace(/_/g, ' ')}</button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#6b5f45', marginBottom: 8 }}>
            <ScrollText size={12} style={{ display: 'inline', marginRight: 4 }}/> {logs.length} записей
          </div>
          
          {logsLoading && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Загрузка...</p>}
          {!logsLoading && logs.length === 0 && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Пусто</p>}
          {!logsLoading && logs.map(log => <LogEntry key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
};

export const CafeTab = ({ app }: { app: any }) => {
  const hasBarista = app.allWorkers?.some((w: any) => w.business_id === app.selCafe?.id && w.role === 'Бариста');

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <button onClick={() => { app.setTab('home'); app.setSelCafe(null); }} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Кафе</h2>
      {app.bLeft > 0 ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#b06a15" style={{ marginBottom: 15 }} /><h3>Готовим...</h3><p style={{ fontSize: 24, fontWeight: 'bold', color: '#b06a15', fontFamily: 'Russo One' }}>{app.bLeft} сек.</p></div>
      : app.selCafe ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#b06a15" style={{ marginBottom: 15 }} /><h3 style={{ marginBottom: 5 }}>{app.selCafe.business_name}</h3><p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 20 }}>Владелец: {app.selCafe.owner_name}</p><Btn variant="yellow" onClick={() => app.buyCoffee(app.selCafe)} disabled={app.proc || app.money < COFFEE_CUP_PRICE || app.energy >= app.maxEnergy || !hasBarista} style={{ background: (app.money < COFFEE_CUP_PRICE || app.energy >= app.maxEnergy || !hasBarista) ? '#e7d9b8' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: (app.money < COFFEE_CUP_PRICE || app.energy >= app.maxEnergy || !hasBarista) ? '#6b5f45' : '#3a2c08', marginBottom: 10 }}>{!hasBarista ? 'Нет бариста' : app.energy >= app.maxEnergy ? 'Полная энергия' : app.money < COFFEE_CUP_PRICE ? 'Мало денег' : `Купить кофе за ${COFFEE_CUP_PRICE}`}</Btn><Btn variant="secondary" onClick={() => app.setSelCafe(null)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Назад</Btn></div>
      : <div>{app.allBiz.filter((b: any) => b.biz_type === 'coffee').map((b: any) => { const barista = app.allWorkers?.find((w: any) => w.business_id === b.id && w.role === 'Бариста'); return (<div key={b.id} onClick={() => app.setSelCafe(b)} style={{ backgroundColor: '#fbf4e4', padding: 15, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(90,70,40,0.08)', cursor: 'pointer', marginBottom: 10 }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16} /> {b.business_name}</div><div style={{ fontSize: 12, color: '#6b5f45', marginTop: 4 }}>Владелец: {b.owner_name}</div>{!barista && <div style={{ fontSize: 11, color: '#c0453a', marginTop: 2 }}>Нет бариста</div>}</div><span style={{ color: '#b06a15', fontWeight: 'bold' }}>→</span></div>); })}{app.allBiz.filter((b: any) => b.biz_type === 'coffee').length === 0 && <p style={{ color: '#6b5f45' }}>Нет открытых кафе.</p>}</div>}
    </div>
  );
};

export const JobsTab = ({ app }: { app: any }) => {
  const [boardLoading, setBoardLoading] = useState(false);
  useEffect(() => {
    if (!app.boardOpen) return;
    let cancelled = false;
    setBoardLoading(true);
    Promise.all([
      app.supabase.from('businesses').select('id, owner_id, owner_name, biz_type, business_name, worker_id, worker_name, coffee_balance, last_collected'),
      app.supabase.from('business_workers').select('id, business_id, player_id, player_name, role, salary'),
    ]).then(([businesses, workers]: any[]) => {
      if (cancelled) return;
      if (businesses.error || workers.error) {
        app.showMsg(businesses.error?.message || workers.error?.message || 'Не удалось обновить вакансии', true);
        return;
      }
      app.setAllBiz(businesses.data || []);
      app.setAllWorkers(workers.data || []);
    }).catch((error: any) => {
      if (!cancelled) app.showMsg(error?.message || 'Не удалось обновить вакансии', true);
    }).finally(() => {
      if (!cancelled) setBoardLoading(false);
    });
    return () => { cancelled = true; };
  }, [app.boardOpen]);

  if (app.boardOpen) {
    const availableJobs: any[] = [];
    app.allBiz.forEach((biz: any) => {
      if (biz.owner_id === app.pid) return;
      const roles = BIZ_JOBS[biz.biz_type] || [];
      roles.forEach((roleInfo: any) => {
        const hiredCount = app.allWorkers.filter((w: any) => w.business_id === biz.id && w.role === roleInfo.role).length;
        if (hiredCount < roleInfo.max) {
          availableJobs.push({ biz, role: roleInfo.role, salary: roleInfo.salary });
        }
      });
    });

    return (
      <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <button onClick={() => app.setBoardOpen(false)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
        <h2>Вакансии</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {boardLoading && availableJobs.length === 0 && <p role="status" style={{ color: '#6b5f45' }}>Обновляем список вакансий...</p>}
          {!boardLoading && availableJobs.length === 0 && <p style={{ color: '#6b5f45' }}>Пока нет свободных мест...</p>}
          {availableJobs.map((job, idx) => (
            <div key={idx} style={{ backgroundColor: '#fbf4e4', padding: 15, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(90,70,40,0.08)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>{job.role}</div>
                <div style={{ fontSize: 12, color: '#6b5f45', marginTop: 4 }}>{job.biz.business_name} ({job.biz.owner_name})</div>
                <div style={{ fontSize: 12, color: '#3d7ea6', marginTop: 2 }}>ЗП: {job.biz.biz_type === 'salon' ? (job.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : `${job.salary} ₽`}</div>
              </div>
              <Btn variant="secondary" onClick={() => app.hire(job.biz.id, job.role, job.salary)} disabled={app.proc || app.myJob !== null} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{app.myJob ? 'Уже работаете' : 'Устроиться'}</Btn>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (app.myJob) {
    const biz = app.allBiz.find((b:any) => b.id === app.myJob.business_id);
    const isCoffee = biz?.biz_type === 'coffee';
    const isSalon = biz?.biz_type === 'salon';
    const salonPayPercent = app.myJob.role === 'Механик' ? 3 : 5;
    
    return (
      <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <h2>Моя работа</h2>
        <div style={{ backgroundColor: '#fbf4e4', padding: 20, borderRadius: 10, border: '1px solid rgba(90,70,40,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <span style={{ fontSize: 18, fontWeight: 'bold' }}>{app.myJob.role}</span>
          </div>
          <p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#6b5f45' }}>Бизнес: <b style={{ color: '#2f2a1d' }}>{biz?.business_name || 'Неизвестно'}</b></p>
          
          {isCoffee ? (
            <>
              <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Ты получаешь <b style={{ color: '#3f9d55' }}>{app.myJob.salary}₽</b> с каждой проданной чашки.</p>
              <div style={{ background: 'rgba(63,157,85,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(63,157,85,0.25)' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#3f9d55' }}>Накопленные чаевые:</p>
                <p style={{ margin: 0, fontSize: 24, color: '#3f9d55', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.tipBalance || 0} <Coins size={18} style={{ display: 'inline' }} /></p>
                <Btn variant="primary" onClick={app.collectTips} disabled={app.proc || !app.tipBalance} style={{ marginTop: 10, padding: 8, fontSize: 13 }}><Wallet size={16} style={{ display: 'inline', marginRight: 5 }}/> Забрать чаевые</Btn>
              </div>
            </>
          ) : isSalon ? (
            <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Получаешь <b style={{ color: '#3f9d55' }}>{salonPayPercent}%</b> от цены продажи автомобиля после его продажи.</p>
          ) : (
            <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Зарплата: <b style={{ color: '#3f9d55' }}>{app.myJob.salary} 💰</b></p>
          )}
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => app.setBoardOpen(true)} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: '#3d7ea6', color: '#f0f7fb', borderRadius: 8, fontWeight: 'bold', border: 'none' }}>Вакансии</button>
            <Btn variant="danger" onClick={() => app.setQuitOpen(true)} disabled={app.proc} style={{ flex: 1, fontSize: 14, padding: 12, background: 'rgba(192,69,58,0.08)', border: '1px solid rgba(192,69,58,0.35)' }}>Уволиться</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <h2>Работа</h2>
      <div style={{ ...S.card, textAlign: 'center', marginTop: 50 }}>
        <div style={{ fontSize: 50, marginBottom: 10 }}>📉</div><h3>Вы безработный</h3><p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 20 }}>Пора найти работу!</p>
        <Btn variant="secondary" onClick={() => app.setBoardOpen(true)}><Briefcase size={20} /> Биржа труда</Btn>
      </div>
    </div>
  );
};

const PREMIUM_ITEMS = [
  { id: 'frame_test', name: 'Рамка TEST', price: 120, icon: '🧪', description: 'Фирменная рамка TEST для твоего профиля' },
  { id: 'frame_amber', name: 'Янтарная рамка', price: 60, icon: '🟠', description: 'Тёплый янтарный ободок вокруг аватара' },
  { id: 'background_concrete', name: 'Фон игры «Бетон»', price: 90, icon: '🏙️', description: 'Меняет фон всей игровой страницы' },
  { id: 'market_slots_2', name: '+2 слота рынка', price: 80, icon: '🛒', description: 'Постоянно увеличивает число объявлений; максимум 9 слотов' },
];

const frameStyle = (frame: string) => frame === 'frame_test'
  ? { border: '3px solid #63e6be', boxShadow: '0 0 0 2px #152d2b, 0 0 18px rgba(99,230,190,.65)' }
  : frame === 'frame_amber'
    ? { border: '3px solid #e69a32', boxShadow: '0 0 0 2px #6f3d0d, 0 0 14px rgba(230,154,50,.45)' }
    : { border: '3px solid rgba(90,70,40,.28)' };

const PublicProfileModal = ({ profile, loading, onClose }: { profile: any, loading: boolean, onClose: () => void }) => {
  const frameNames: Record<string, string> = { frame_test: 'Рамка TEST', frame_amber: 'Янтарная рамка' };
  const backgroundNames: Record<string, string> = { background_concrete: 'Бетонный фон' };
  const businessNames: Record<string, string> = {
    coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк',
    construction: 'Стройтрест', phone_factory: 'Телефонный цех',
  };
  const avatar = getAvatar(profile ? Number(profile.avatar_id) || 1 : 1);
  const profileBackground = profile?.profile_background === 'background_concrete'
    ? 'linear-gradient(145deg, #d2d6d3, #a3aaa7)'
    : 'linear-gradient(145deg, #fbf4e4, #e7d9b8)';

  return (
    <Modal open={loading || !!profile} onClose={onClose} contentStyle={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      {loading ? <p style={{ color: '#6b5f45' }}>Загружаю профиль…</p> : profile && <>
        <div style={{ ...S.card, textAlign: 'center', padding: 18, marginBottom: 12, background: profileBackground }}>
          <div style={{ width: 76, height: 76, margin: '0 auto 10px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 40, background: avatar.bg, ...frameStyle(profile.profile_frame) }}>{avatar.emoji}</div>
          {profile.profile_frame === 'frame_test' && <div style={{ display: 'inline-block', marginBottom: 6, padding: '3px 10px', borderRadius: 12, color: '#073b35', background: '#63e6be', fontFamily: 'Russo One', fontSize: 11, letterSpacing: 1 }}>TEST</div>}
          <h3 style={{ margin: 0, fontFamily: 'Russo One' }}>{profile.nickname}</h3>
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 10px' }}>Показатели</h4>
          <div>💰 Баланс: <b>{Number(profile.money || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>👥 Приглашено: <b>{Number(profile.referral_count || 0)}</b></div>
          <div>🎁 Реферальный баланс: <b>{Number(profile.referral_balance || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>📱 Телефоны: <b>{Number(profile.phone_count || 0)}</b></div>
          <div>🚗 Машина: <b>{profile.has_car ? (profile.car_model === 'lada' ? 'Лада' : 'Тойота') : 'Нет'}</b></div>
          <div>🏠 Жильё: <b>{profile.has_house ? (profile.house_type || 'Квартира') : 'Нет'}</b></div>
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 8px' }}>Бизнесы</h4>
          {profile.businesses?.length
            ? profile.businesses.map((business: any) => <div key={`${business.biz_type}-${business.business_name}`} style={{ marginBottom: 5 }}>🏢 {business.business_name} · {businessNames[business.biz_type] || 'Бизнес'}</div>)
            : <span style={{ color: '#6b5f45' }}>Пока нет бизнесов</span>}
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 8px' }}>Надето</h4>
          <div>🖼 Рамка: <b>{frameNames[profile.profile_frame] || 'Стандартная'}</b></div>
          <div>🎨 Фон: <b>{backgroundNames[profile.profile_background] || 'Стандартный'}</b></div>
        </div>
        <Btn variant="secondary" onClick={onClose} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
      </>}
    </Modal>
  );
};

export const ProfileTab = ({ app }: { app: any }) => {
  const avatar = getAvatar(app.avatarId);
  const background = app.profileBackground === 'background_concrete'
    ? 'linear-gradient(145deg, #d2d6d3, #a3aaa7)'
    : 'linear-gradient(145deg, #fbf4e4, #e7d9b8)';
  return <div style={{ maxWidth: 420, margin: '0 auto', animation: 'fadeIn .3s' }}>
    <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 0, color: '#6b5f45', cursor: 'pointer', margin: '8px 0 16px' }}>← На главную</button>
    <h2>Профиль</h2>
    <div style={{ ...S.card, textAlign: 'center', padding: 24, background }}>
      <div style={{ width: 92, height: 92, margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 48, background: avatar.bg, ...frameStyle(app.profileFrame) }}>{avatar.emoji}</div>
      {app.profileFrame === 'frame_test' && <div style={{ display: 'inline-block', marginBottom: 8, padding: '3px 10px', borderRadius: 12, color: '#073b35', background: '#63e6be', fontFamily: 'Russo One', fontSize: 11, letterSpacing: 1 }}>TEST</div>}
      <div style={{ fontSize: 23, fontFamily: 'Russo One' }}>{app.nick}</div>
      <div style={{ color: '#6b5f45', marginTop: 6 }}>ID: {app.tgId.slice(0, 6)} · имя нельзя менять</div>
      <div style={{ marginTop: 12, fontWeight: 700 }}>💰 {Number(app.money || 0).toLocaleString('ru-RU')} ₽</div>
      <div style={{ marginTop: 5, color: '#6b5f45' }}>🎨 {app.profileBackground === 'background_concrete' ? 'Бетонный фон' : 'Стандартный фон'}</div>
      <div style={{ marginTop: 12, fontWeight: 700, color: '#7656a8' }}>◆ {app.premiumBalance} жетонов</div>
    </div>
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>Моя статистика</h3>
      <p>👥 Приглашено: <b>{app.myRefs.length}</b></p>
      <p>🎁 Реферальный баланс: <b>{Number(app.refBalance || 0).toLocaleString('ru-RU')} ₽</b></p>
      <h4 style={{ margin: '14px 0 6px' }}>Мои бизнесы</h4>
      {app.myBizs.length
        ? app.myBizs.map((business: any) => <p key={business.id}>🏢 {business.business_name}</p>)
        : <p style={{ color: '#6b5f45' }}>Пока нет бизнесов</p>}
      <h4 style={{ margin: '14px 0 6px' }}>Применённая косметика</h4>
      <p>🖼 {app.profileFrame === 'frame_test' ? 'Рамка TEST' : app.profileFrame === 'frame_amber' ? 'Янтарная рамка' : 'Стандартная рамка'}</p>
      <p>🎨 {app.profileBackground === 'background_concrete' ? 'Бетонный фон' : 'Стандартный фон'}</p>
    </div>
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>Моя косметика</h3>
      {['frame_test', 'frame_amber'].filter(id => app.ownedCosmetics.includes(id)).length === 0 && <p style={{ color: '#6b5f45' }}>Пока нет купленных рамок.</p>}
      {['frame_test', 'frame_amber'].filter(id => app.ownedCosmetics.includes(id)).map(id => <button key={id} onClick={() => app.donateAction('equip', { item_id: id })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8, ...frameStyle(id) }}>{id === 'frame_test' ? '🧪 Надеть рамку TEST' : '🟠 Надеть янтарную рамку'}</button>)}
      {app.ownedCosmetics.includes('background_concrete') && <button onClick={() => app.donateAction('equip', { item_id: 'background_concrete' })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8 }}>🏙️ Установить фон игры «Бетон»</button>}
      <button onClick={() => app.donateAction('equip', { item_id: 'default' })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%' }}>Вернуть стандартный вид</button>
    </div>
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0438'}</h3>
      {PREMIUM_ITEMS.filter(item => item.id !== 'market_slots_2').map(item => {
        const owned = app.ownedCosmetics.includes(item.id);
        return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid rgba(90,70,40,.12)', textAlign: 'left' }}>
          <span style={{ fontSize: 27 }}>{item.icon}</span><div style={{ flex: 1 }}><b>{item.name}</b><div style={{ color: '#6b5f45', fontSize: 12 }}>{item.description}</div></div>
          <button onClick={() => app.donateAction('purchase', { item_id: item.id })} disabled={app.proc || owned || app.premiumBalance < item.price} style={{ ...S.btnPurple, padding: '8px 10px', opacity: owned ? .55 : 1 }}>{owned ? '\u041A\u0443\u043F\u043B\u0435\u043D\u043E' : `${item.price} \u25C6`}</button>
        </div>;
      })}
    </div>
  </div>;
};

export const ShopTab = ({ app }: { app: any }) => {
  const [moneyAmount, setMoneyAmount] = useState('2500');
  const [premiumAmount, setPremiumAmount] = useState('1');
  return (
  <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Донат</h2><button onClick={() => app.setTab('home')} style={{ ...S.btnSecondary, width: 'auto', padding: '8px 12px', fontSize: 12 }}>На главную</button></div>
    <div style={{ ...S.card, border: '2px solid #8a6ac0' }}>
      <h3 style={{ marginTop: 0, color: '#7656a8' }}>◆ Донат-жетоны</h3>
      <p style={{ color: '#6b5f45', fontSize: 13 }}>Покупай жетоны за Telegram Stars. Все пакеты доступны в Telegram Mini App.</p>
      {[{ id: 'starter', stars: 15, gems: 50 }, { id: 'popular', stars: 50, gems: 250 }, { id: 'big', stars: 100, gems: 650 }].map(pack => <button key={pack.id} onClick={() => app.buyStars(pack.id)} disabled={app.proc} style={{ ...S.btnPurple, width: '100%', marginTop: 8 }}>⭐ {pack.stars} Stars → {pack.gems} жетонов</button>)}
      <div style={{ borderTop: '1px solid rgba(90,70,40,.15)', marginTop: 14, paddingTop: 12 }}>
        <b>Обмен игровой валюты</b>
        <p style={{ color: '#6b5f45', fontSize: 12, margin: '6px 0' }}>2 500 монет → 1 жетон · 1 жетон → 1 500 монет</p>
        <input aria-label="Количество игровых монет для обмена" type="number" min="2500" max="200000" step="2500" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} style={S.input} />
        <button onClick={() => app.donateAction('exchange', { direction: 'money_to_premium', amount: Number(moneyAmount) })} disabled={app.proc || Number(moneyAmount) < 2500 || Number(moneyAmount) > 200000 || Number(moneyAmount) % 2500 !== 0 || Number(moneyAmount) > app.money} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8 }}>Обменять монеты на жетоны</button>
        <input aria-label="Количество жетонов для обмена на игровые монеты" type="number" min="1" max="100" step="1" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} style={S.input} />
        <button onClick={() => app.donateAction('exchange', { direction: 'premium_to_money', amount: Number(premiumAmount) })} disabled={app.proc || !Number.isSafeInteger(Number(premiumAmount)) || Number(premiumAmount) < 1 || Number(premiumAmount) > 100 || Number(premiumAmount) > app.premiumBalance} style={{ ...S.btnSecondary, width: '100%' }}>Обменять на {Math.max(0, Number(premiumAmount) || 0) * 1500} монет</button>
      </div>
    </div>
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u0423\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430'}</h3>
      {PREMIUM_ITEMS.filter(item => item.id === 'market_slots_2').map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
        <span style={{ fontSize: 27 }}>{item.icon}</span><div style={{ flex: 1 }}><b>{item.name}</b><div style={{ color: '#6b5f45', fontSize: 12 }}>{item.description}</div></div>
        <button onClick={() => app.donateAction('purchase', { item_id: item.id })} disabled={app.proc || app.marketSlots >= 9 || app.premiumBalance < item.price} style={{ ...S.btnPurple, padding: '8px 10px' }}>{app.marketSlots >= 9 ? '\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C' : `${item.price} \u25C6`}</button>
      </div>)}
    </div>
  </div>
  );
};

export const InventoryTab = ({ app }: { app: any }) => (
  <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <h2>Инвентарь</h2>
    {app.phone ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#6b5f45" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('phone'); app.setSellPrice(String(DEFAULT_SELL_PHONE)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить</Btn><Btn variant="primary" onClick={() => app.buyPhone(false)} disabled={app.proc}>Сдать (+1400)</Btn></div> : null}
    {app.hasCar ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Car size={32} color="#3d7ea6" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>{app.carModel === 'lada' ? 'Лада' : app.carModel === 'toyota' ? 'Тойота' : 'Автомобиль'}</div><div style={{ fontSize: 12, color: '#3f9d55', marginTop: 4 }}>Отдых: {app.restTime / 1000} сек.</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('car'); app.setSellItemData(app.carModel); app.setSellPrice(app.carModel === 'lada' ? String(DEFAULT_SELL_LADA) : String(DEFAULT_SELL_TOYOTA)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    {app.hasHouse ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Building size={32} color="#b06a15" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Квартира</div><div style={{ fontSize: 12, color: '#3f9d55', marginTop: 4 }}>Макс. энергия: {app.maxEnergy}</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('house'); app.setSellItemData(app.houseType); app.setSellPrice(String(DEFAULT_SELL_APARTMENT)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    {!app.phone && !app.hasCar && !app.hasHouse && <div style={{ color: '#6b5f45', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }} /><br />Пусто...</div>}
  </div>
);
