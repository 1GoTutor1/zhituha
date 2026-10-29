import { useState, useEffect, useRef } from 'react';
import { Coins, UserPlus, Briefcase, Coffee, Users, Smartphone, Phone, Car, Building, Store, Hammer, ChevronRight, Gift, Wrench, Search, ShieldAlert, Ban, Trash2, ArrowLeft, X, Backpack, Bug, AlertTriangle, Wallet, ScrollText, RefreshCw, Trophy, Palette, Settings, Volume2, VolumeX, Vibrate, Sun, Moon, Pickaxe, TreePine, Fish, Sprout, PackageCheck, CarFront } from 'lucide-react';
import { 
  getAvatar, BUILDING_PRICE,
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, S, getDayModifier, COFFEE_CUP_PRICE,
  BUTTON_BATCH_COST, SMARTPHONE_BATCH_COST, BUTTON_BATCH_SIZE, SMARTPHONE_BATCH_SIZE,
  DEFAULT_SELL_LADA, DEFAULT_SELL_TOYOTA, DEFAULT_SELL_APARTMENT, DEFAULT_SELL_PHONE,
  DEFAULT_SELL_BUTTON, DEFAULT_SELL_SMARTPHONE, BIZ_JOBS, BUSINESS_PASSIVE_TIERS, getStock,
  PLAYER_PROFESSIONS, PROFESSION_LOOT, PROFESSION_RARITIES
} from './constants';
import { Btn, Modal } from './components';
import { AnimatedNumber } from './AnimatedNumber';
import { ItemArtwork } from './ItemArtwork';
import { getProfileBackground, PROFILE_BACKGROUND_NAMES } from './profileBackgrounds';

export const AppModals = ({ app }: { app: any }) => (
  <>
    {app.career?.pending_reward?.item && <Modal open onClose={() => {}} contentStyle={{ maxWidth: 390, padding: 18, backgroundImage: 'none' }}>
      {(() => {
        const item = app.career.pending_reward.item;
        const rarity = PROFESSION_RARITIES[item.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common;
        return <div className={`profession-drop-reveal rarity-${item.rarity || 'common'}`}>
          <div className="profession-drop-confetti" aria-hidden="true">✦　✧　✦</div>
          <div className="profession-drop-icon" style={{ color: rarity.color }}><ItemArtwork item={item} size={120} /></div>
          <div className="profession-drop-rarity" style={{ color: rarity.color }}>{rarity.name}</div>
          <h2>{item.item_name}</h2>
          <p>Находка готова. Выбери, что с ней сделать:</p>
          <div className="profession-drop-value">Цена государства · {Number(item.sell_price).toLocaleString('ru-RU')} ₽</div>
          <div className="profession-drop-actions">
            <Btn variant="secondary" disabled={app.proc || (Number(app.career.inventory_slots) >= 200)} onClick={() => app.claimProfessionReward('inventory')}><Backpack size={18} /> В инвентарь</Btn>
            <Btn variant="primary" disabled={app.proc} onClick={() => { if (['rare','epic'].includes(item.rarity) && !window.confirm('\u041F\u0440\u043E\u0434\u0430\u0442\u044C \u0440\u0435\u0434\u043A\u0443\u044E \u043D\u0430\u0445\u043E\u0434\u043A\u0443?')) return; app.claimProfessionReward('sell'); }}><Coins size={18} /> Продать</Btn>
          </div>
          {Number(app.career.inventory_slots) >= 200 && <small>Инвентарь 200/200 — продай находку или освободи слот.</small>}
        </div>;
      })()}
    </Modal>}
    <Modal open={app.settingsOpen} onClose={() => app.setSettingsOpen(false)} contentStyle={{ maxWidth: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} /> Настройки</h3>
        <button type="button" aria-label="Закрыть настройки" onClick={() => app.setSettingsOpen(false)} style={{ border: 0, background: 'transparent', color: '#6b5f45', padding: 5, cursor: 'pointer' }}><X size={20} /></button>
      </div>
      <div className="settings-list">
        <button type="button" role="switch" aria-checked={app.soundEnabled} onClick={() => app.changeSoundEnabled(!app.soundEnabled)} className="settings-row">
          <span><Volume2 size={19} /> Звуковые эффекты</span><b>{app.soundEnabled ? 'Вкл.' : 'Выкл.'} {app.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</b>
        </button>
        <button type="button" role="switch" aria-checked={app.vibrationEnabled} onClick={() => app.changeVibrationEnabled(!app.vibrationEnabled)} className="settings-row">
          <span><Vibrate size={19} /> Вибрация</span><b>{app.vibrationEnabled ? 'Вкл.' : 'Выкл.'}</b>
        </button>
      </div>
      <div style={{ textAlign: 'left', fontSize: 13, fontWeight: 700, margin: '18px 0 8px' }}>Оформление</div>
      <div className="settings-theme-options">
        <button type="button" aria-pressed={app.uiTheme === 'light'} onClick={() => app.changeUiTheme('light')} className={`settings-theme-option${app.uiTheme === 'light' ? ' is-selected' : ''}`}><Sun size={18} /> Светлое</button>
        <button type="button" aria-pressed={app.uiTheme === 'dark'} onClick={() => app.changeUiTheme('dark')} className={`settings-theme-option${app.uiTheme === 'dark' ? ' is-selected' : ''}`}><Moon size={18} /> Тёмное</button>
      </div>
      <Btn variant="secondary" onClick={() => app.setSettingsOpen(false)} style={{ marginTop: 18 }}>Готово</Btn>
    </Modal>

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
      {(() => {
        const model = app.sellSource === 'stock' && app.sellItemType === 'car'
          ? app.vehicleState?.models?.find((item: any) => item.model_id === app.sellItemData) : null;
        const min = model ? Math.ceil(Number(model.base_price) * 0.75) : null;
        const max = model ? Math.floor(Number(model.base_price) * 1.25) : null;
        const valid = min == null || (max != null && Number(app.sellPrice) >= min && Number(app.sellPrice) <= max);
        return <>
      <h3>Продажа {app.sellItemType === 'phone' ? 'телефона' : app.sellItemType === 'car' ? 'машины' : 'квартиры'}</h3>
      <p style={{ color: '#6b5f45', fontSize: 12, marginBottom: 10 }}>{app.sellSource === 'personal' ? 'Из личного имущества' : 'Со склада бизнеса'}</p>
      <label style={{ display: 'block', textAlign: 'left', color: '#6b5f45', fontSize: 13, marginBottom: 6 }}>Цена продажи — назначаете сами, ₽</label>
      <input type="number" min="1" step="1" value={app.sellPrice} onChange={(e: any) => app.setSellPrice(e.target.value)} style={S.input} />
      {min != null && <small style={{ display: 'block', color: valid ? '#6b5f45' : '#c0453a', margin: '-10px 0 12px' }}>Для машины бизнеса: {min.toLocaleString('ru-RU')}–{max?.toLocaleString('ru-RU')} ₽</small>}
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => { app.setSellOpen(false); app.setSellSource(null); }} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="purple" onClick={app.listItem} disabled={!valid || app.proc}>Выставить</Btn></div>
        </>;
      })()}
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
                <Coins size={20} color="#b06a15" />
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
    `Выбери действие в карточке профессии и пройди 3 этапа`,
    "Находка готова! Продай её государству или отправь в инвентарь",
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
      {app.onboardStep === 2 && <Btn variant="primary" onClick={app.drinkTutorialCoffee} disabled={app.proc} style={{ padding: 10, fontSize: 14, marginBottom: 10 }}>Продолжить</Btn>}
      {app.onboardStep === 5 && <Btn variant="primary" onClick={app.claimTutorialReward} disabled={app.proc} style={{ padding: 10, fontSize: 14 }}>Забрать 2000 монет</Btn>}
    </div>
  );
};

const PROFESSION_ICONS: Record<string, any> = { miner: Pickaxe, lumberjack: TreePine, fisherman: Fish, farmer: Sprout, courier: PackageCheck, taxi: CarFront };

const ProfessionScene = ({ profession, stage }: { profession: string; stage: number }) => {
  const Icon = PROFESSION_ICONS[profession] || Pickaxe;
  return <div className={`profession-scene profession-scene-${profession}`} data-stage={stage}>
    <div className="profession-scene-sun" />
    {profession === 'fisherman' && <div className="profession-water"><i /><i /><i /></div>}
    {profession === 'farmer' && <div className={`profession-sprout profession-sprout-${stage}`}><Sprout size={44} /></div>}
    {profession === 'miner' && <div className={`profession-rock profession-rock-${stage}`}><span /><span /></div>}
    {profession === 'lumberjack' && <div className={`profession-tree profession-tree-${stage}`}><TreePine size={70} /></div>}
    {profession === 'courier' && <div className={`profession-package profession-package-${stage}`}><PackageCheck size={54} /></div>}
    {profession === 'taxi' && <div className={`profession-taxi profession-taxi-${stage}`}><CarFront size={62} /></div>}
    {profession !== 'farmer' && profession !== 'miner' && profession !== 'lumberjack' && profession !== 'courier' && profession !== 'taxi' && <Icon size={60} />}
    <div className="profession-scene-caption">{PLAYER_PROFESSIONS.find(item => item.id === profession)?.name}</div>
  </div>;
};

const ProfessionWorkCard = ({ app }: { app: any }) => {
  const career = app.career || {};
  const profession = PLAYER_PROFESSIONS.find(item => item.id === career.profession) || PLAYER_PROFESSIONS[0];
  const Icon = PROFESSION_ICONS[profession.id] || Pickaxe;
  const cycle = career.active_cycle;
  const progress = cycle ? Math.min(100, Math.max(0, (Number(cycle.actions_done || 0) / 3) * 100)) : 0;
  const unlocked = Array.isArray(career.unlocked) ? career.unlocked : ['miner'];
  const drops = PROFESSION_LOOT[profession.id] || [];
  const canDoStep = !!cycle && cycle.actions_done < 3 && !app.proc;
  const full = Number(career.inventory_slots) >= Number(career.inventory_capacity || 200) && drops.length > 0;

  return <section className="profession-work-card">
    <div className="profession-card-head">
      <div><span className="profession-eyebrow">ТВОЯ ПРОФЕССИЯ</span><h2>{profession.name}</h2></div>
      <div className="profession-level-badge">УР. {career.level || 1}</div>
    </div>
    <div className="profession-xp-block">
      <div className="profession-xp-label"><b>Уровень {career.level || 1}</b><span>{Number(career.xp || 0).toLocaleString('ru-RU')} / {Number(career.xp_to_next || 100).toLocaleString('ru-RU')} XP</span></div>
      <div className="profession-xp-track"><span style={{ width: `${Math.min(100, Number(career.xp || 0) / Math.max(1, Number(career.xp_to_next || 100)) * 100)}%` }} /></div>
    </div>
    <label className="profession-select-label" htmlFor="profession-select">Выбрать профессию</label>
    <div className="profession-select-wrap"><Icon size={19} /><select id="profession-select" value={profession.id} onChange={event => app.selectProfession(event.target.value)} disabled={!!cycle || app.proc}>
      {PLAYER_PROFESSIONS.map(item => <option key={item.id} value={item.id} disabled={!unlocked.includes(item.id)}>{item.name}{unlocked.includes(item.id) ? '' : ` · с уровня ${item.unlockLevel}`}</option>)}
    </select><ChevronRight size={17} /></div>
    {profession.id === 'taxi' && <div className="profession-select-wrap taxi-shift-car">
      <CarFront size={19} />
      <select aria-label="Машина на смену" value={career.taxi_fleet?.selected_car_index ?? ''}
        onChange={event => app.selectTaxiCar(Number(event.target.value))} disabled={!!cycle || app.proc || !(career.taxi_fleet?.cars?.length)}>
        <option value="" disabled>Выбери машину на смену</option>
        {(career.taxi_fleet?.cars || []).map((car: any) => <option key={car.car_index} value={car.car_index} disabled={car.busy || car.health <= 0}>
          {car.model_name || app.vehicleState?.models?.find((item: any) => item.model_id === car.model)?.model_name || car.model} / {car.class === 'economy' ? 'эконом' : car.class === 'comfort' ? 'комфорт' : 'бизнес'} · {car.health}%{car.busy ? ' · занята' : ''}
        </option>)}
      </select><ChevronRight size={17} />
    </div>}
    <ProfessionScene profession={profession.id} stage={cycle?.actions_done || 0} />
    <div className="profession-cycle-status">
      {cycle ? <>
        <div className="profession-stage-label"><b>{cycle.actions_done < 3 ? `Этап ${cycle.actions_done + 1} из 3` : 'Результат готов'}</b>
          <span>{cycle.actions_done < 3 ? profession.actionLabels[cycle.actions_done] : 'Можно забрать'}</span></div>
        <div className="profession-cycle-track"><span style={{ width: `${progress}%` }} /></div>
        {cycle.actions_done < 3
          ? <button className="profession-action-button" disabled={!canDoStep} onClick={() => app.stepProfessionCycle(cycle.actions_done + 1)}><Icon size={20} /> {profession.actionLabels[cycle.actions_done]}</button>
          : <button className="profession-action-button" disabled={app.proc} onClick={app.finishProfessionCycle}>Забрать результат</button>}
      </> : <>
        <div className="profession-stage-label"><b>Три простых действия</b><span>Выполни их и сразу получи награду · +25 XP</span></div>
        {full && <div className="profession-inventory-full">Инвентарь заполнен · {career.inventory_slots}/200 <button onClick={() => app.setTab('inventory')}>Открыть</button></div>}
        <button className="profession-action-button" disabled={app.proc || full || (profession.id === 'taxi' && career.taxi_fleet?.selected_car_index == null)} onClick={app.startProfessionCycle}><Icon size={20} /> Начать работу</button>
      </>}
    </div>
    <div className="profession-reward-preview">
      <div className="profession-preview-title">{drops.length ? `Находки · ${profession.minPrice}–${profession.maxPrice} ₽` : `Выплата · ${profession.minPrice}–${profession.maxPrice} ₽`}</div>
      {drops.length ? <div className="profession-drop-list">{drops.map(item => <span key={item.id} style={{ color: PROFESSION_RARITIES[item.rarity].color }} title={PROFESSION_RARITIES[item.rarity].name}>{item.icon} {item.name}</span>)}</div> : <div className="profession-cash-preview">{profession.output}</div>}
      <small>Предмет появится после завершения. Редкости видны заранее, точные шансы — нет.</small>
    </div>
  </section>;
};

export const HomeTab = ({ app }: { app: any }) => {
  const av = getAvatar(app.avatarId);
  const myCoffee = app.myBizs?.find((b: any) => b.biz_type === 'coffee');
  const modifier = getDayModifier();
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
          <button type="button" aria-label="Настройки" title="Настройки" onClick={() => app.setSettingsOpen(true)} style={{ border: '1px solid rgba(90,70,40,.2)', borderRadius: 8, padding: 6, marginBottom: 8, background: 'rgba(90,70,40,.06)', color: '#6b5f45', cursor: 'pointer' }}><Settings size={18} /></button>
          <div style={{ color: '#b06a15', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, fontFamily: 'Russo One, Impact, sans-serif' }}><Coins size={18} /> <AnimatedNumber value={app.money} /></div>
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
      <ProfessionWorkCard app={app} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 10, backgroundColor: '#fbf4e4', border: '1px solid rgba(192, 132, 252, 0.3)', color: '#2f2a1d', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Briefcase size={24} color="#5f43a0" /><span style={{ fontSize: 13 }}>Бизнесы</span>
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

    </div>
  );
};

export const MarketItem = ({ item, app, type }: any) => (
  <div style={{ backgroundColor: '#fbf4e4', padding: 15, borderRadius: 10, border: '1px solid rgba(90,70,40,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
        {type === 'phone' ? (item.item_data === 'button' ? <Phone size={18} color="#6b5f45" /> : <Smartphone size={18} color="#6b5f45" />) 
        : type === 'car' ? <Car size={18} /> : <Building size={18} />} 
        {(() => { const itemKey = String(item.item_data || '').split(':').pop(); return type === 'car'
          ? (app.vehicleState?.models?.find((model: any) => model.model_id === itemKey)?.model_name || (itemKey === 'lada' ? 'Ока' : 'Тойота'))
          : type === 'house' ? 'Квартира' : (itemKey === 'button' ? 'Кнопочный тел.' : itemKey === 'smartphone' ? 'Смартфон' : 'Телефон'); })()}
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
  const [shopPurchase, setShopPurchase] = useState<any>(null);
  const [shopQuantity, setShopQuantity] = useState(1);
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
          vehicleState={app.vehicleState}
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
        {['items', 'cars', 'realestate', 'shops'].map((t: any) => (
          <button key={t} onClick={() => app.setMarketTab(t)} style={{ flex: 1, minWidth: 0, padding: '8px 3px', fontSize: 11, whiteSpace: 'nowrap', border: 'none', borderRadius: 12, backgroundColor: app.marketTab === t ? '#3d7ea6' : 'transparent', color: app.marketTab === t ? '#f0f7fb' : '#6b5f45', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
            {t === 'items' ? 'Предметы' : t === 'cars' ? 'Авто' : t === 'realestate' ? 'Жильё' : 'Магазины'}
          </button>
        ))}
      </div>

      {app.marketTab === 'shops' ? <>
        <h3 style={{ color: '#6b5f45', fontSize: 16, marginBottom: 10 }}>Магазины игроков</h3>
        {(app.businessOffers?.shops || []).map((shop: any) => {
          const own = String(shop.owner_id) === String(app.pid);
          const status = shop.status === 'open' ? 'Открыт' : shop.status === 'closed_staff' ? 'Закрыт · нет сотрудника' : 'Закрыт · нет товара';
          return <section key={shop.business_id} style={{ ...S.card, maxWidth: 'none', padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
              <div style={{ textAlign: 'left' }}><b>{shop.business_name}</b><div style={{ fontSize: 12, color: '#6b5f45' }}>Владелец: {shop.owner_name || 'Государство'}</div></div>
              <span style={{ fontSize: 11, color: shop.status === 'open' ? '#327b45' : '#a46b21', whiteSpace: 'nowrap' }}>{status}</span>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {(shop.products || []).map((product: any) => <div key={product.product_id} style={{ padding: 10, borderRadius: 9, background: 'rgba(90,70,40,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                <div><b>{product.product_name}</b><div style={{ fontSize: 12, color: '#6b5f45' }}>Остаток: {product.quantity}</div><strong>{Number(product.retail_price).toLocaleString('ru-RU')} ₽</strong></div>
                <button type="button" disabled={app.proc || own || shop.status !== 'open' || product.quantity < 1} onClick={() => { setShopPurchase({ shop, product }); setShopQuantity(1); }} style={{ border: 0, borderRadius: 8, padding: '9px 12px', color: '#fff', background: own || shop.status !== 'open' ? '#a7a092' : '#3f9d55', fontWeight: 700, whiteSpace: 'nowrap' }}>{own ? 'Твой магазин' : 'Купить'}</button>
              </div>)}
            </div>
          </section>;
        })}
        <h3 style={{ color: '#6b5f45', fontSize: 16, margin: '18px 0 10px' }}>Автомастерские</h3>
        <div style={{ ...S.card, maxWidth: 'none', padding: 14, marginBottom: 12, textAlign: 'left' }}>
          <b>Личная машина</b><div style={{ color: '#6b5f45', fontSize: 12, marginTop: 4 }}>{app.hasCar ? `${app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.model_name || (app.carModel === 'lada' ? 'Ока' : 'Тойота')} · состояние ${app.carHealth}%` : 'Личной машины нет'}</div>
          {(app.businessOffers?.repair_shops || []).map((shop: any) => <div key={shop.business_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid rgba(90,70,40,.12)', paddingTop: 8, marginTop: 8 }}>
            <div><b>{shop.business_name}</b><small style={{ display: 'block', color: shop.status === 'open' ? '#327b45' : '#a46b21' }}>{shop.status === 'open' ? `Механик на месте · владелец ${shop.owner_name}` : 'Закрыта · нет механика'}</small></div>
            {app.hasCar && <button type="button" disabled={app.proc || shop.status !== 'open' || app.carHealth >= 100 || String(shop.owner_id) === String(app.pid)} onClick={() => app.repairPersonalCarAtShop(shop.business_id)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', color: '#fff', background: '#3d7ea6', whiteSpace: 'nowrap' }}>{app.carHealth >= 100 ? 'Исправна' : 'Починить'}</button>}
          </div>)}
          {!(app.businessOffers?.repair_shops || []).length && <small style={{ color: '#6b5f45' }}>Пока нет автомастерских.</small>}
        </div>
        {!(app.businessOffers?.shops || []).length && <p style={{ color: '#6b5f45' }}>Магазины появятся после покупки точек у государства.</p>}
        <Modal open={!!shopPurchase} onClose={() => setShopPurchase(null)}>
          {shopPurchase && <>
            <h3 style={{ marginTop: 0 }}>{shopPurchase.product.product_name}</h3>
            <p style={{ color: '#6b5f45' }}>{shopPurchase.shop.business_name} · {Number(shopPurchase.product.retail_price).toLocaleString('ru-RU')} ₽ за штуку</p>
            <label htmlFor="shop-buy-quantity" style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>Количество</label>
            <input id="shop-buy-quantity" type="number" min={1} max={Math.min(20, Number(shopPurchase.product.quantity))} value={shopQuantity} onChange={event => setShopQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} style={S.input} />
            <p style={{ margin: '0 0 12px', textAlign: 'left' }}>Итого: <b>{(Number(shopPurchase.product.retail_price) * shopQuantity).toLocaleString('ru-RU')} ₽</b></p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setShopPurchase(null)}>Назад</Btn>
              <Btn variant="primary" disabled={app.proc || app.money < Number(shopPurchase.product.retail_price) * shopQuantity || shopQuantity > Number(shopPurchase.product.quantity)} onClick={() => { app.buyBusinessProduct(shopPurchase.shop.business_id, shopPurchase.product.product_id, shopQuantity); setShopPurchase(null); }}>Подтвердить покупку</Btn>
            </div>
          </>}
        </Modal>
      </> : <>

      <h3 style={{ color: '#6b5f45', fontSize: 16, marginBottom: 10 }}>{app.marketTab === 'items' ? 'Лоты (Предметы)' : app.marketTab === 'cars' ? 'Лоты (Авто)' : 'Лоты (Жилье)'}</h3>
      {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).length === 0 && <p style={{ color: '#6b5f45' }}>Пусто...</p>}
      {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).map((item: any) => (
        <MarketItem key={item.id} item={item} app={app} type={item.item_type} />
      ))}
      </>}
    </div>
  );
};

const BusinessAuctionEntry = ({ location, app }: any) => {
  const [bid, setBid] = useState(String(Number(location.highest_bid || 0) + 1));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(location.ends_at) - now) / 1000));
  const countdown = `${Math.floor(remaining / 3600)}ч ${Math.floor((remaining % 3600) / 60)}м`;
  const ownAuction = String(location.owner_id) === String(app.pid);
  return <div className="business-auction-entry">
    <small>Ставка: {Number(location.highest_bid).toLocaleString('ru-RU')} ₽ · {remaining ? countdown : 'завершение'}</small>
    {!ownAuction && <div><input aria-label="Сумма ставки" type="number" min={Number(location.highest_bid) + 1} step="1000" value={bid} onChange={event => setBid(event.target.value)} />
      <button disabled={app.proc || Number(bid) <= Number(location.highest_bid)} onClick={() => app.bidBusinessAuction(location.auction_id, Number(bid))}>Ставка</button></div>}
  </div>;
};

export const BusinessTab = ({ app, activeBiz, currentStock }: any) => {
  const [businessView, setBusinessView] = useState<'all' | 'mine'>('all');
  const [passiveNow, setPassiveNow] = useState(Date.now());
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [auctionPrice, setAuctionPrice] = useState('');
  const [cashAmount, setCashAmount] = useState('1000');
  const [shopPriceDrafts, setShopPriceDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    const timer = setInterval(() => setPassiveNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getBizName = (type: string) => ({ coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк', construction: 'Стройтрест', minimarket: 'Мини-маркет', auto_repair: 'Автомастерская' }[type] || 'Бизнес');

  const bizWorkers = app.allWorkers?.filter((w: any) => w.business_id === activeBiz?.id) || [];
  const salonHasSeller = bizWorkers.some((worker: any) => worker.role === 'Продавец');
  const carOrderTotal = (price: number, amount: number) => {
    const subtotal = price * amount;
    return salonHasSeller ? subtotal : subtotal + Math.floor(subtotal * 0.1);
  };
  const salonClass = activeBiz?.location_key === 'salon_mid' ? 'mid' : activeBiz?.location_key === 'salon_high' ? 'high' : 'low';
  const salonModels = (app.vehicleState?.models || []).filter((model: any) => model.salon_class === salonClass);
  const vehicleName = (modelId: string) => app.vehicleState?.models?.find((model: any) => model.model_id === modelId)?.model_name || modelId;
  const vehicleRepairPrice = (modelId: string) => Number(app.vehicleState?.models?.find((model: any) => model.model_id === modelId)?.repair_price || (modelId === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA));
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
      <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Бизнесы</h2>

      <div role="tablist" aria-label="Разделы бизнеса" style={{ display: 'flex', gap: 6, padding: 5, marginBottom: 18, borderRadius: 10, background: 'rgba(90,70,40,.08)' }}>
        {([{ id: 'all', label: 'Все' }, { id: 'mine', label: `Мои (${app.myBizs.length})` }] as const).map(item => <button key={item.id} type="button" role="tab" aria-selected={businessView === item.id} onClick={() => setBusinessView(item.id)} style={{ flex: 1, padding: 10, border: 0, borderRadius: 7, cursor: 'pointer', fontWeight: 700, background: businessView === item.id ? '#fbf4e4' : 'transparent', color: '#2f2a1d', boxShadow: businessView === item.id ? '0 1px 4px rgba(50,40,25,.12)' : 'none' }}>{item.label}</button>)}
      </div>

      {businessView === 'mine' && <>
      <section className="business-location-catalog" style={{ marginBottom: 18 }}>
        <div className="business-catalog-heading"><div><h3>Мои бизнесы</h3><span>{app.myBizs.length} / 3</span></div></div>
        {app.myBizs.length ? app.myBizs.map((business: any) => <button key={business.id} type="button" onClick={() => { app.setActiveBizType(business.biz_type); app.setActiveBizId(business.id); }} className="business-location-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: '#2f2a1d', background: String(activeBiz?.id) === String(business.id) ? 'rgba(61,126,166,.12)' : undefined }}>
          <span className="business-location-info"><b>{business.business_name}</b><small>{getBizName(business.biz_type)}{String(activeBiz?.id) === String(business.id) ? ' · выбрано' : ''}</small></span>
          <span className="business-location-action">Открыть</span>
        </button>) : <p style={{ margin: 12, color: '#6b5f45', fontSize: 13 }}>У тебя пока нет бизнеса. Найди свободную точку во вкладке «Все».</p>}
      </section>
      </>}

      {businessView === 'all' && <section className="business-location-catalog">
        <div className="business-catalog-heading"><div><h3>Точки бизнеса</h3><span>В собственности: {app.businessCatalog?.owned_count ?? app.myBizs.length} / 3</span></div><button onClick={app.loadBusinessCatalog} aria-label="Обновить список"><RefreshCw size={17} /></button></div>
        {(app.businessCatalog?.locations || []).map((location: any) => {
          const owned = location.status === 'owned';
          const available = location.status === 'available';
          const purchasable = ['coffee','salon','taxi','construction','minimarket','auto_repair'].includes(location.biz_type);
          const price = location.price == null ? null : Number(location.price);
          return <div key={location.location_key} className="business-location-row">
            <div className="business-location-info"><b>{location.business_name}</b><small>{owned ? 'Твой бизнес' : available ? 'Свободно у государства' : `Владелец: ${location.owner_name || 'занято'}`}</small></div>
            <div className="business-location-action">
              {owned ? <button onClick={() => { app.setActiveBizType(location.biz_type); app.setActiveBizId(location.business_id); setBusinessView('mine'); }}>Управлять</button>
                : available && purchasable && price != null ? <button disabled={app.proc || app.businessCatalog?.owned_count >= 3 || app.money < price} onClick={() => app.purchaseBusinessLocation(location.location_key)}>{price.toLocaleString('ru-RU')} ₽ · Купить</button>
                : location.status === 'auction' ? <BusinessAuctionEntry location={location} app={app} />
                : <span>{price == null ? 'Цена не задана' : !purchasable ? 'Готовится' : 'Занято'}</span>}
            </div>
          </div>;
        })}
      </section>}

      <Modal open={auctionOpen} onClose={() => setAuctionOpen(false)} contentStyle={{ maxWidth: 360 }}>
        <h3 style={{ marginTop: 0 }}>Выставить бизнес на торги</h3>
        <p style={{ color: '#6b5f45', fontSize: 13 }}>Торги идут 24 часа. Ставка покупателя резервируется, а при перебивании возвращается.</p>
        <label style={{ display: 'block', textAlign: 'left', fontSize: 12, marginBottom: 6 }}>Начальная цена, ₽</label>
        <input type="number" min="1" step="1000" value={auctionPrice} onChange={event => setAuctionPrice(event.target.value)} style={S.input} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setAuctionOpen(false)}>Отмена</Btn>
          <Btn variant="primary" disabled={app.proc || Number(auctionPrice) < 1} onClick={() => { app.createBusinessAuction(activeBiz.id, Number(auctionPrice)); setAuctionOpen(false); }}>Начать торги</Btn>
        </div>
      </Modal>

      {businessView === 'mine' && (activeBiz ? (
        <div style={S.card}>
          <section style={{ marginBottom: 18, padding: 13, borderRadius: 10, background: 'rgba(61,126,166,.08)', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>Касса бизнеса</b><strong>{Number(activeBiz.cash_balance || 0).toLocaleString('ru-RU')} ₽</strong></div>
            <label htmlFor="business-cash-amount" style={{ display: 'block', fontSize: 12, margin: '10px 0 5px', color: '#6b5f45' }}>Сумма пополнения или снятия</label>
            <input id="business-cash-amount" type="number" min="1" max="10000000" value={cashAmount} onChange={event => setCashAmount(event.target.value)} style={{ ...S.input, marginBottom: 8, padding: 10, fontSize: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" disabled={app.proc || Number(cashAmount) < 1 || app.money < Number(cashAmount)} onClick={() => app.transferBusinessCash(activeBiz.id, Number(cashAmount), 'deposit')}>Внести</Btn>
              <Btn variant="secondary" disabled={app.proc || Number(cashAmount) < 1 || Number(activeBiz.cash_balance || 0) < Number(cashAmount)} onClick={() => app.transferBusinessCash(activeBiz.id, Number(cashAmount), 'withdraw')}>Снять</Btn>
            </div>
          </section>

          {app.activeBizType === 'salon' && (<>
              <p style={{ color: '#6b5f45', fontSize: 13, margin: '5px 0 12px' }}>Класс автосалона: <b>{salonClass === 'low' ? 'низкий' : salonClass === 'mid' ? 'средний' : 'высокий'}</b>. Заказы списываются из кассы бизнеса.</p>
              {app.carOrderEnd > 0 ? (<div style={{ background: 'rgba(61,126,166,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(61,126,166,0.25)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#3d7ea6' }}>Едут: <b>{vehicleName(currentStock.current_model || '')} ×{currentStock.order_amount || 1}</b></p><p style={{ margin: 0, fontSize: 22, color: '#3d7ea6', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.carTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'grid', gap: 8, marginBottom: 15 }}>
                  {salonModels.map((model: any) => {
                    const amount = Number(currentStock[model.model_id] || 0);
                    const orderMinutes = Math.round(Number(model.order_ms) / 60000);
                    return <div key={model.model_id} style={{ padding: 10, borderRadius: 10, background: 'rgba(90,70,40,.06)', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{model.model_name}</b><span>На складе: {amount}</span></div>
                      <small style={{ color: '#6b5f45' }}>Закупка {Number(model.base_price).toLocaleString('ru-RU')} ₽ · поставка {orderMinutes} мин.</small>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{[1, 5, 10].map(n => <Btn key={n} variant="secondary" onClick={() => app.orderCar(model.model_id, n)} disabled={app.proc || Number(activeBiz.cash_balance || 0) < carOrderTotal(Number(model.base_price), n)} style={{ flex: 1, padding: 7, fontSize: 11 }}>×{n} · {carOrderTotal(Number(model.base_price), n).toLocaleString('ru-RU')} ₽</Btn>)}</div>
                      {amount > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData(model.model_id); app.setSellPrice(String(Number(model.base_price))); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginTop: 7, width: '100%' }}><Car size={16}/> Выставить на рынок</Btn>}
                    </div>;
                  })}
                </div>)}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontWeight: 'bold' }}>{car.model_name || vehicleName(car.model)}</span><span style={{ color: car.health > 50 ? '#3f9d55' : car.health > 0 ? '#b06a15' : '#c0453a' }}>{car.health}%</span></div>
                    {car.health < 100 && <div style={{ marginTop: 7, display: 'grid', gap: 5 }}>
                      {(app.businessOffers?.repair_shops || []).map((shop: any) => <button key={shop.business_id} type="button" disabled={app.proc || shop.status !== 'open' || Number(activeBiz.cash_balance || 0) < vehicleRepairPrice(car.model)} onClick={() => app.repairTaxiCarAtShop(shop.business_id, activeBiz.id, i)} style={{ border: '1px solid #3d7ea6', borderRadius: 8, padding: 8, background: 'rgba(61,126,166,.08)', color: '#2f6a94', textAlign: 'left' }}>В {shop.business_name} · ремонт {vehicleRepairPrice(car.model).toLocaleString('ru-RU')} ₽ {shop.status !== 'open' ? '· закрыта' : `· касса ${Number(activeBiz.cash_balance || 0).toLocaleString('ru-RU')} ₽`}</button>)}
                      {!(app.businessOffers?.repair_shops || []).length && <small style={{ color: '#6b5f45' }}>Для ремонта нужна автомастерская с механиком.</small>}
                    </div>}
                  </div>
                ))}
              </div>
              <Btn variant="primary" onClick={app.collectTaxi} disabled={app.proc || !currentStock.taxi_cars?.length || !app.allWorkers?.some((w: any) => w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id && w.role === 'Водитель')} style={{ marginBottom: 10 }}>{!currentStock.taxi_cars?.length ? 'Нет машин' : !app.allWorkers?.some((w: any) => w.role === 'Водитель' && w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id) ? 'Нужен водитель' : 'Собрать доход'}</Btn>
              <p style={{ fontSize: 12, color: '#6b5f45', marginBottom: 5 }}>Покупка машины у автосалона · оплачивается из кассы парка:</p>
              {(app.vehicleState?.dealers || []).map((dealer: any) => {
                const offers = (dealer.models || []).filter((model: any) => model.quantity > 0);
                if (!offers.length) return null;
                return <section key={dealer.business_id} style={{ padding: 10, marginBottom: 8, borderRadius: 10, background: 'rgba(90,70,40,.06)', textAlign: 'left' }}>
                  <b>{dealer.business_name}</b><small style={{ display: 'block', color: '#6b5f45' }}>Владелец: {dealer.owner_name || 'игрок'} · класс {dealer.salon_class === 'low' ? 'низкий' : dealer.salon_class === 'mid' ? 'средний' : 'высокий'}</small>
                  {offers.map((model: any) => <button key={model.model_id} type="button" disabled={app.proc || (currentStock.taxi_cars?.length || 0) >= 2 || Number(activeBiz.cash_balance || 0) < Number(model.base_price) || String(dealer.owner_id) === String(app.pid)} onClick={() => app.buyTaxiVehicle(dealer.business_id, model.model_id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, marginTop: 6, padding: 8, border: '1px solid #3d7ea6', borderRadius: 8, background: '#fffaf0', color: '#2f2a1d', textAlign: 'left' }}><span>{model.model_name} · {model.quantity} шт.</span><b>{Number(model.base_price).toLocaleString('ru-RU')} ₽</b></button>)}
                </section>;
              })}
              {(app.vehicleState?.dealers || []).length === 0 && <small style={{ color: '#6b5f45' }}>Нет автосалонов с машинами в наличии.</small>}
          </>)}
          
          {app.activeBizType === 'coffee' && (
            <div style={{ marginTop: 15 }}>
              <p style={{ fontSize: 14, color: '#6b5f45', marginBottom: 10 }}>Касса кафе: <b style={{ color: '#3f9d55', fontSize: 18, fontFamily: 'Russo One' }}>{activeBiz.coffee_balance || 0}</b> монет</p>
              <Btn variant="primary" onClick={app.collect} disabled={app.proc || !activeBiz.coffee_balance} style={{ marginBottom: 15 }}>Собрать кассу</Btn>
            </div>
          )}

          {['coffee','minimarket'].includes(activeBiz.biz_type) && (() => {
            const products = (app.businessOffers?.shops || []).find((shop: any) => shop.business_id === activeBiz.id)?.products || [];
            return <section style={{ marginTop: 18, textAlign: 'left' }}>
              <h3 style={{ margin: '0 0 8px' }}>Товары и склад</h3>
              <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 10px' }}>Закупка списывается из кассы. Цена для игроков — от 75% до 125% базовой.</p>
              {products.map((product: any) => {
                const draft = shopPriceDrafts[product.product_id] ?? String(product.retail_price);
                const cost10 = Number(product.wholesale_price) * 10;
                const cost50 = Number(product.wholesale_price) * 50;
                return <div key={product.product_id} style={{ padding: 11, borderRadius: 10, background: 'rgba(90,70,40,.06)', marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{product.product_name}</b><span>На складе: {product.quantity}</span></div>
                  <small style={{ color: '#6b5f45' }}>Опт {Number(product.wholesale_price).toLocaleString('ru-RU')} ₽/шт.</small>
                  <label style={{ display: 'block', fontSize: 12, margin: '8px 0 4px' }}>Цена игроку · {product.min_price}–{product.max_price} ₽</label>
                  <input aria-label={`Цена ${product.product_name}`} type="range" min={product.min_price} max={product.max_price} value={Math.max(Number(product.min_price), Math.min(Number(product.max_price), Number(draft) || Number(product.retail_price)))} onChange={event => setShopPriceDrafts(current => ({ ...current, [product.product_id]: event.target.value }))} style={{ width: '100%', accentColor: '#3d7ea6' }} />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input type="number" min={product.min_price} max={product.max_price} value={draft} onChange={event => setShopPriceDrafts(current => ({ ...current, [product.product_id]: event.target.value }))} style={{ ...S.input, flex: 1, margin: 0, padding: 9, fontSize: 15 }} />
                    <button type="button" disabled={app.proc || Number(draft) === Number(product.retail_price)} onClick={() => app.setBusinessProductPrice(activeBiz.id, product.product_id, Number(draft))} style={{ border: 0, borderRadius: 8, padding: '0 12px', color: '#fff', background: '#3d7ea6', fontWeight: 700 }}>Сохранить</button>
                  </div>
                  <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                    <button type="button" disabled={app.proc || Number(activeBiz.cash_balance || 0) < cost10} onClick={() => app.restockBusinessProduct(activeBiz.id, product.product_id, 10)} style={{ flex: 1, border: '1px solid #3d7ea6', borderRadius: 8, padding: 8, color: '#2f6a94', background: 'rgba(61,126,166,.08)' }}>Опт +10 · {cost10.toLocaleString('ru-RU')} ₽</button>
                    <button type="button" disabled={app.proc || Number(activeBiz.cash_balance || 0) < cost50} onClick={() => app.restockBusinessProduct(activeBiz.id, product.product_id, 50)} style={{ flex: 1, border: '1px solid #3d7ea6', borderRadius: 8, padding: 8, color: '#2f6a94', background: 'rgba(61,126,166,.08)' }}>Опт +50 · {cost50.toLocaleString('ru-RU')} ₽</button>
                  </div>
                </div>;
              })}
            </section>;
          })()}

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
                <div style={{ fontSize: 13, textAlign: 'left' }}><b>{w.player_name}</b><br/><span style={{ color: '#6b5f45', fontSize: 11 }}>{w.role} (ЗП: {activeBiz.biz_type === 'salon' ? (w.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : activeBiz.biz_type === 'minimarket' ? '5% с продаж' : activeBiz.biz_type === 'auto_repair' ? '3% с ремонта' : `${w.salary} ₽`})</span></div>
                <Btn variant="danger" onClick={() => app.fire(w.id)} disabled={app.proc} style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>Уволить</Btn>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(90,70,40,0.22)' }}>
            <Btn variant="danger" onClick={() => app.sellBusiness(activeBiz)} disabled={app.proc} style={{ background: 'transparent', border: '1px solid #c0453a', color: '#c0453a', marginBottom: 8 }}>Продать государству · 50%</Btn>
            <Btn variant="purple" onClick={() => { const point = app.businessCatalog?.locations?.find((location: any) => location.business_id === activeBiz.id); setAuctionPrice(String(Math.floor(Number(point?.price || 0) * 0.5))); setAuctionOpen(true); }} disabled={app.proc || !!app.businessCatalog?.locations?.some((location: any) => location.business_id === activeBiz.id && location.status === 'auction')}>Выставить на торги · 24 часа</Btn>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <Store size={48} color="#5f43a0" style={{ marginBottom: 15 }} />
          <h3>Выбери точку бизнеса</h3>
          <p style={{ color: '#6b5f45' }}>Покупка у государства доступна в каталоге выше. Свободные места ограничены.</p>
        </div>
      ))}
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

  useEffect(() => {
    if (app.adminTab === 'market') void app.loadMarket();
  }, [app.adminTab]);

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
        <Btn variant={app.adminTab === 'market' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('market')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'market' ? '#c0453a' : '#fbf4e4' }}>Рынок</Btn>
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
                    <option value="background_brick">Фон «Кирпич»</option>
                    <option value="background_panelka">Фон «Панелька»</option>
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

      {app.adminTab === 'market' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, textAlign: 'left' }}>
            <div><b>Лоты на рынке</b><div style={{ color: '#6b5f45', fontSize: 12 }}>При удалении вещь возвращается продавцу</div></div>
            <Btn variant="secondary" onClick={() => void app.loadMarket()} disabled={app.proc} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}><RefreshCw size={14} /></Btn>
          </div>
          {app.market.length === 0 && <p style={{ color: '#6b5f45' }}>Активных лотов нет.</p>}
          {app.market.map((lot: any) => {
            const kind = lot.item_type === 'car' ? 'Автомобиль' : lot.item_type === 'house' ? 'Жильё' : 'Предмет';
            const itemName = String(lot.item_data || '').split(':').pop();
            return <div key={lot.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, textAlign: 'left' }}>
              <div style={{ minWidth: 0 }}><b>{kind}: {itemName}</b><div style={{ color: '#6b5f45', fontSize: 12, overflowWrap: 'anywhere' }}>{lot.seller_name || 'Без имени'} · {Number(lot.price || 0).toLocaleString('ru-RU')} ₽</div></div>
              <Btn variant="danger" onClick={() => app.adminDeleteMarketLot(lot)} disabled={app.proc} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}><Trash2 size={15} /> Удалить</Btn>
            </div>;
          })}
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
      : app.selCafe ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#b06a15" style={{ marginBottom: 15 }} /><h3 style={{ marginBottom: 5 }}>{app.selCafe.business_name}</h3><p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 20 }}>Владелец: {app.selCafe.owner_name}</p><Btn variant="yellow" onClick={() => app.buyCoffee(app.selCafe)} disabled={app.proc || app.money < COFFEE_CUP_PRICE || !hasBarista} style={{ background: (app.money < COFFEE_CUP_PRICE || !hasBarista) ? '#e7d9b8' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: (app.money < COFFEE_CUP_PRICE || !hasBarista) ? '#6b5f45' : '#3a2c08', marginBottom: 10 }}>{!hasBarista ? 'Нет бариста' : app.money < COFFEE_CUP_PRICE ? 'Мало денег' : `Купить кофе за ${COFFEE_CUP_PRICE}`}</Btn><Btn variant="secondary" onClick={() => app.setSelCafe(null)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Назад</Btn></div>
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
                <div style={{ fontSize: 12, color: '#3d7ea6', marginTop: 2 }}>ЗП: {job.biz.biz_type === 'salon' ? (job.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : job.biz.biz_type === 'minimarket' ? '5% с продаж' : job.biz.biz_type === 'auto_repair' ? '3% с ремонта' : `${job.salary} ₽`}</div>
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
  { id: 'background_brick', name: 'Фон «Кирпичный дом»', price: 40, icon: '🧱', description: 'Тёплая кирпичная кладка на фоне всей игры' },
  { id: 'background_panelka', name: 'Фон «Панелька»', price: 80, icon: '🏢', description: 'Фасад панельного дома на фоне всей игры' },
  { id: 'market_slots_2', name: '+2 слота рынка', price: 80, icon: '🛒', description: 'Постоянно увеличивает число объявлений; максимум 9 слотов' },
];

const frameStyle = (frame: string) => frame === 'frame_test'
  ? { border: '3px solid #63e6be', boxShadow: '0 0 0 2px #152d2b, 0 0 18px rgba(99,230,190,.65)' }
  : frame === 'frame_amber'
    ? { border: '3px solid #e69a32', boxShadow: '0 0 0 2px #6f3d0d, 0 0 14px rgba(230,154,50,.45)' }
    : { border: '3px solid rgba(90,70,40,.28)' };

const PublicProfileModal = ({ profile, loading, vehicleState, onClose }: { profile: any, loading: boolean, vehicleState?: any, onClose: () => void }) => {
  const frameNames: Record<string, string> = { frame_test: 'Рамка TEST', frame_amber: 'Янтарная рамка' };
  const backgroundNames: Record<string, string> = PROFILE_BACKGROUND_NAMES;
  const businessNames: Record<string, string> = {
    coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк',
    construction: 'Стройтрест', phone_factory: 'Телефонный цех',
  };
  const avatar = getAvatar(profile ? Number(profile.avatar_id) || 1 : 1);
  const profileBackground = getProfileBackground(profile?.profile_background);

  return (
    <Modal open={loading || !!profile} onClose={onClose} contentStyle={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      {loading ? <p style={{ color: '#6b5f45' }}>Загружаю профиль…</p> : profile && <>
        <div style={{ ...S.card, textAlign: 'center', padding: 18, marginBottom: 12, ...profileBackground }}>
          <div style={{ width: 76, height: 76, margin: '0 auto 10px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 40, background: avatar.bg, ...frameStyle(profile.profile_frame) }}>{avatar.emoji}</div>
          {profile.profile_frame === 'frame_test' && <div style={{ display: 'inline-block', marginBottom: 6, padding: '3px 10px', borderRadius: 12, color: '#073b35', background: '#63e6be', fontFamily: 'Russo One', fontSize: 11, letterSpacing: 1 }}>TEST</div>}
          <h3 style={{ margin: 0, fontFamily: 'Russo One' }}>{profile.nickname}</h3>
          {profile.family && <div style={{ marginTop: 7, color: '#3f9d65', fontWeight: 700 }}>[{profile.family.tag}] {profile.family.name}</div>}
          {(profile.family_awards || []).map((award: any) => <span key={`${award.season_no}-${award.place}`} className="family-profile-badge">🏆 Семья #{award.place} · сезон {award.season_no}</span>)}
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 10px' }}>Показатели</h4>
          <div>💰 Баланс: <b>{Number(profile.money || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>Уровень: <b>{Number(profile.player_level || 1)}</b></div>
          <div>Профессия: <b>{PLAYER_PROFESSIONS.find(item => item.id === profile.active_profession)?.name || 'Шахтёр'}</b></div>
          <div>👥 Приглашено: <b>{Number(profile.referral_count || 0)}</b></div>
          <div>🎁 Реферальный баланс: <b>{Number(profile.referral_balance || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>📱 Телефоны: <b>{Number(profile.phone_count || 0)}</b></div>
          <div>🚗 Машина: <b>{profile.has_car ? (vehicleState?.models?.find((model: any) => model.model_id === profile.car_model)?.model_name || (profile.car_model === 'lada' ? 'Ока' : 'Тойота')) : 'Нет'}</b></div>
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
  const [section, setSection] = useState<'stats' | 'businesses' | 'cosmetics'>('stats');
  const [familyProfile, setFamilyProfile] = useState<any>(null);
  const [familyAwards, setFamilyAwards] = useState<any[]>([]);
  const avatar = getAvatar(app.avatarId);
  const background = getProfileBackground(app.profileBackground);
  useEffect(() => {
    let cancelled = false;
    if (!app.pid) return;
    void app.supabase.rpc('family_state_rpc', { p_player_id: app.pid }).then(({ data, error }: any) => {
      if (!cancelled && !error && !data?.error) {
        setFamilyProfile(data.family || null);
        setFamilyAwards(data.awards || []);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [app.pid, app.supabase]);
  return <div style={{ maxWidth: 420, margin: '0 auto', animation: 'fadeIn .3s' }}>
    <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 0, color: '#6b5f45', cursor: 'pointer', margin: '8px 0 16px' }}>← На главную</button>
    <h2>Профиль</h2>
    <div style={{ ...S.card, textAlign: 'center', padding: 24, ...background }}>
      <div style={{ width: 92, height: 92, margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 48, background: avatar.bg, ...frameStyle(app.profileFrame) }}>{avatar.emoji}</div>
      {app.profileFrame === 'frame_test' && <div style={{ display: 'inline-block', marginBottom: 8, padding: '3px 10px', borderRadius: 12, color: '#073b35', background: '#63e6be', fontFamily: 'Russo One', fontSize: 11, letterSpacing: 1 }}>TEST</div>}
      <div style={{ fontSize: 23, fontFamily: 'Russo One' }}>{app.nick}</div>
      {familyProfile && <div style={{ marginTop: 6, color: '#3f9d65', fontWeight: 700 }}>[{familyProfile.tag}] {familyProfile.name}</div>}
      {familyAwards.map((award: any) => <span key={`${award.season_no}-${award.place}`} className="family-profile-badge">🏆 Семья #{award.place} · сезон {award.season_no}</span>)}
      <div style={{ color: '#6b5f45', marginTop: 6 }}>ID: {app.tgId.slice(0, 6)} · имя нельзя менять</div>
      <div style={{ marginTop: 12, fontWeight: 700 }}>💰 {Number(app.money || 0).toLocaleString('ru-RU')} ₽</div>
      <div style={{ marginTop: 12, textAlign: 'left' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><b>Уровень {app.career?.level || 1} · {PLAYER_PROFESSIONS.find(item => item.id === app.career?.profession)?.name || 'Шахтёр'}</b><span>{Number(app.career?.xp || 0)} / {Number(app.career?.xp_to_next || 100)} XP</span></div><div className="profession-xp-track"><span style={{ width: `${Math.min(100, Number(app.career?.xp || 0) / Math.max(1, Number(app.career?.xp_to_next || 100)) * 100)}%` }} /></div></div>
      <div style={{ marginTop: 5, color: '#6b5f45' }}>🎨 {PROFILE_BACKGROUND_NAMES[app.profileBackground] || 'Стандартный фон'}</div>
      <div style={{ marginTop: 12, fontWeight: 700, color: '#7656a8' }}>◆ {app.premiumBalance} жетонов</div>
    </div>
    <div className="profile-section-tabs" role="tablist" aria-label="\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043F\u0440\u043E\u0444\u0438\u043B\u044F">
      <button type="button" role="tab" aria-selected={section === 'stats'} className={section === 'stats' ? 'active' : ''} onClick={() => setSection('stats')}>{'\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430'}</button>
      <button type="button" role="tab" aria-selected={section === 'businesses'} className={section === 'businesses' ? 'active' : ''} onClick={() => setSection('businesses')}>{'\u0411\u0438\u0437\u043D\u0435\u0441\u044B'}</button>
      <button type="button" role="tab" aria-selected={section === 'cosmetics'} className={section === 'cosmetics' ? 'active' : ''} onClick={() => setSection('cosmetics')}>{'\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430'}</button>
    </div>
    {section === 'stats' && <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u041C\u043E\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430'}</h3>
      <p>{'\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u043E'}: <b>{app.myRefs.length}</b></p>
      <p>{'\u0420\u0435\u0444\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441'}: <b>{Number(app.refBalance || 0).toLocaleString('ru-RU')} {'\u20BD'}</b></p>
      <p>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u0439'}: <b>{(app.career?.unlocked || ['miner']).length}</b> / {PLAYER_PROFESSIONS.length}</p>
      <button onClick={() => app.setTab('inventory')} style={{ ...S.btnSecondary, width: '100%' }}>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C'}</button>
    </div>}
    {section === 'businesses' && <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u041C\u043E\u0438 \u0431\u0438\u0437\u043D\u0435\u0441\u044B'} {'\u00B7'} {app.myBizs.length}/3</h3>
      {app.myBizs.length ? app.myBizs.map((business: any) => <div key={business.id} className="profile-business-row">
        <b>{'\uD83C\uDFE2'} {business.business_name}</b>
        <button onClick={() => { app.setActiveBizType(business.biz_type); app.setActiveBizId(business.id); app.setTab('business'); }}>{'\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C'}</button>
      </div>) : <p style={{ color: '#6b5f45' }}>{'\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0431\u0438\u0437\u043D\u0435\u0441\u043E\u0432'}</p>}
      <button onClick={() => { app.loadBusinessCatalog(); app.setTab('business'); }} style={{ ...S.btnSecondary, width: '100%', marginTop: 12 }}>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0442\u043E\u0447\u0435\u043A'}</button>
    </div>}
    {section === 'cosmetics' && <>
      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>{'\u041F\u0440\u0438\u043C\u0435\u043D\u0451\u043D\u043D\u0430\u044F \u043A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430'}</h3>
        <p>{'\u0420\u0430\u043C\u043A\u0430'}: <b>{app.profileFrame === 'frame_test' ? 'TEST' : app.profileFrame === 'frame_amber' ? '\u042F\u043D\u0442\u0430\u0440\u043D\u0430\u044F' : '\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F'}</b></p>
        <p>{'Фон'}: <b>{PROFILE_BACKGROUND_NAMES[app.profileBackground] || 'Стандартный'}</b></p>
        {['frame_test', 'frame_amber'].filter(id => app.ownedCosmetics.includes(id)).map(id => <button key={id} onClick={() => app.donateAction('equip', { item_id: id })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8, ...frameStyle(id) }}>{id === 'frame_test' ? '\uD83E\uDDEA TEST' : '\uD83D\uDFE0'}</button>)}
        {['background_concrete', 'background_brick', 'background_panelka'].filter(id => app.ownedCosmetics.includes(id)).map(id => <button key={id} onClick={() => app.donateAction('equip', { item_id: id })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8, ...getProfileBackground(id) }}>Установить: {PROFILE_BACKGROUND_NAMES[id]}</button>)}
        <button onClick={() => app.donateAction('equip', { item_id: 'default' })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%' }}>{'\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0432\u0438\u0434'}</button>
      </div>
      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>{'\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0438'}</h3>
        {PREMIUM_ITEMS.filter(item => item.id !== 'market_slots_2').map(item => {
          const owned = app.ownedCosmetics.includes(item.id);
          return <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid rgba(90,70,40,.12)', textAlign: 'left' }}>
            <span style={item.id.startsWith('background_') ? { width: 54, height: 40, flexShrink: 0, borderRadius: 8, border: '1px solid rgba(90,70,40,.3)', ...getProfileBackground(item.id) } : { fontSize: 27 }}>{item.id.startsWith('background_') ? null : item.icon}</span><div style={{ flex: 1 }}><b>{item.name}</b><div style={{ color: '#6b5f45', fontSize: 12 }}>{item.description}</div></div>
            <button onClick={() => app.donateAction('purchase', { item_id: item.id })} disabled={app.proc || owned || app.premiumBalance < item.price} style={{ ...S.btnPurple, padding: '8px 10px', opacity: owned ? .55 : 1 }}>{owned ? '\u041A\u0443\u043F\u043B\u0435\u043D\u043E' : item.price + ' \u25C6'}</button>
          </div>;
        })}
      </div>
    </>}

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

export const InventoryTab = ({ app }: { app: any }) => {
  const [selected, setSelected] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [confirmRareSale, setConfirmRareSale] = useState(false);
  useEffect(() => {
    try { localStorage.removeItem('zhituha_inventory_new'); } catch {}
    window.dispatchEvent(new Event('zhituha:inventory-seen'));
  }, []);
  const inventory = Array.isArray(app.career?.inventory) ? app.career.inventory : [];
  const rarityRank: Record<string, number> = { epic: 4, rare: 3, uncommon: 2, common: 1 };
  const sorted = [...inventory].sort((a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0) || a.item_name.localeCompare(b.item_name, 'ru'));
  const openStack = (item: any) => { setSelected(item); setQuantity(1); setConfirmRareSale(false); };
  const closeStack = () => { setSelected(null); setConfirmRareSale(false); };
  const proceedSale = () => {
    if (!selected) return;
    if (['rare','epic'].includes(selected.rarity) && !confirmRareSale) { setConfirmRareSale(true); return; }
    const amount = Math.max(1, Math.min(Number(selected.quantity) || 1, Math.floor(Number(quantity) || 1)));
    app.sellInventory(selected.item_id, amount);
    closeStack();
  };
  return <div style={{ maxWidth: 440, margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <h2>Инвентарь</h2>
    <div className="inventory-capacity-card"><Backpack size={19} /><div><b>Материалы и находки</b><span>{Number(app.career?.inventory_slots || 0)} / 200 слотов</span></div><div className="inventory-capacity-track"><i style={{ width: `${Math.min(100, Number(app.career?.inventory_slots || 0) / 2)}%` }} /></div></div>
    {sorted.length ? <div className="inventory-stack-grid">{sorted.map(item => {
      const rarity = PROFESSION_RARITIES[item.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common;
      return <button type="button" className="inventory-stack" key={item.item_id} onClick={() => openStack(item)} style={{ '--rarity-color': rarity.color } as React.CSSProperties}>
        <span className="inventory-stack-icon"><ItemArtwork item={item} size={54} /></span><b>{item.item_name}</b><span className="inventory-stack-count">×{item.quantity}</span><small>{rarity.name}</small>
      </button>;
    })}</div> : <div className="inventory-empty"><Backpack size={38} /><b>Пока пусто</b><span>Предметы из профессий будут появляться здесь.</span></div>}
    {app.phone ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#6b5f45" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('phone'); app.setSellPrice(String(DEFAULT_SELL_PHONE)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить</Btn><Btn variant="primary" onClick={() => app.buyPhone(false)} disabled={app.proc}>Сдать (+1400)</Btn></div> : null}
    {app.hasCar ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Car size={32} color="#3d7ea6" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>{app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.model_name || (app.carModel === 'lada' ? 'Ока' : app.carModel === 'toyota' ? 'Тойота' : 'Автомобиль')}</div><div style={{ fontSize: 12, color: '#3f9d55', marginTop: 4 }}>Состояние: {app.carHealth}%</div></div></div>{app.carHealth < 100 && <Btn variant="secondary" onClick={() => { app.setMarketTab('shops'); app.setTab('market'); }}>Найти автомастерскую</Btn>}<Btn variant="purple" onClick={() => { const base = Number(app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.base_price || 0); app.setSellItemType('car'); app.setSellItemData(app.carModel); app.setSellPrice(String(base || (app.carModel === 'lada' ? DEFAULT_SELL_LADA : DEFAULT_SELL_TOYOTA))); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    {app.hasHouse ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Building size={32} color="#b06a15" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Квартира</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('house'); app.setSellItemData(app.houseType); app.setSellPrice(String(DEFAULT_SELL_APARTMENT)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    <Modal open={!!selected} onClose={closeStack} contentStyle={{ maxWidth: 360 }}>
      {selected && (() => { const rarity = PROFESSION_RARITIES[selected.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common; const amount = Math.max(1, Math.min(Number(selected.quantity) || 1, Number(quantity) || 1)); return <div className="inventory-item-detail">
        <div className="inventory-item-model" style={{ '--rarity-color': rarity.color } as React.CSSProperties}><ItemArtwork item={selected} size={140} /></div>
        <div className="inventory-item-rarity" style={{ color: rarity.color }}>{rarity.name}</div><h3>{selected.item_name}</h3>
        <div className="inventory-item-quantity">В наличии: ×{selected.quantity}</div>
        <label htmlFor="inventory-sell-quantity">Количество для продажи</label>
        <input id="inventory-sell-quantity" type="number" min={1} max={selected.quantity} value={quantity} onChange={event => { setQuantity(Math.max(1, Math.min(Number(selected.quantity), Number(event.target.value) || 1))); setConfirmRareSale(false); }} />
        <div className="inventory-item-total">Государство заплатит · {(amount * Number(selected.sell_price)).toLocaleString('ru-RU')} ₽</div>
        {confirmRareSale && <p className="inventory-rare-confirm">Подтверди продажу редкой находки. Её нельзя будет вернуть.</p>}
        <div className="inventory-detail-actions"><Btn variant={confirmRareSale ? 'danger' : 'primary'} disabled={app.proc} onClick={proceedSale}>{confirmRareSale ? 'Подтвердить продажу' : 'Продать государству'}</Btn><Btn variant="secondary" disabled={app.proc} onClick={closeStack}>Назад</Btn></div>
      </div>; })()}
    </Modal>
  </div>;
};
