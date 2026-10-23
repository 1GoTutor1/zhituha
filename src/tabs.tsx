import { useState } from 'react';
import { Coins, Zap, UserPlus, Briefcase, Coffee, Users, Smartphone, Phone, Car, Building, Store, Hammer, ChevronLeft, ChevronRight, Gift, Wrench, Search, ShieldAlert, Ban, Trash2, ArrowLeft } from 'lucide-react';
import { 
  getAvatar, LADA_PRICE, TOYOTA_PRICE, BUILDING_PRICE, COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, TAXI_BIZ_PRICE, CONSTRUCTION_BIZ_PRICE, PHONE_FACTORY_BIZ_PRICE,
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, S,
  BUTTON_BATCH_COST, SMARTPHONE_BATCH_COST
} from './constants';
import { Btn, Modal } from './components';

export const AppModals = ({ app }: { app: any }) => (
  <>
    <Modal open={app.refOpen} onClose={() => app.setRefOpen(false)}>
      <Gift size={40} color="#ec4899" style={{ marginBottom: 15 }} /><h3 style={{ marginTop: 0, fontSize: 20 }}>Рефералка</h3>
      <Btn variant="purple" onClick={app.inviteFriend} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', marginBottom: 15, padding: 12 }}><UserPlus size={20} /> Пригласить друга</Btn>
      <p style={{ color: '#8B899A', fontSize: 14, marginBottom: 10 }}>Приглашено друзей: <b>{app.myRefs.length}</b></p>
      <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, border: '1px solid rgba(236, 72, 153, 0.2)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#ec4899' }}>Накоплено 5% с доходов:</p><p style={{ margin: 0, fontSize: 24, color: '#ec4899', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{app.refBalance} <Coins size={18} style={{ display: 'inline' }} /></p></div>
      <Btn variant="primary" onClick={app.collectRefBonus} disabled={app.proc || app.refBalance <= 0} style={{ background: app.refBalance > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#333', marginBottom: 10 }}>Собрать 5%</Btn>
      <Btn variant="secondary" onClick={() => app.setRefOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Закрыть</Btn>
    </Modal>

    <Modal open={app.quitOpen} onClose={() => app.setQuitOpen(false)}>
      <h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3><p style={{ color: '#8B899A', fontSize: 15, marginBottom: 20 }}>Ты уверен?</p>
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setQuitOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="danger" onClick={app.quit} disabled={app.proc}>Уволиться</Btn></div>
    </Modal>

    <Modal open={app.sellOpen} onClose={() => app.setSellOpen(false)}>
      <h3>Продажа {app.sellItemType === 'phone' ? 'телефона' : app.sellItemType === 'car' ? 'машины' : 'квартиры'}</h3>
      <input type="number" value={app.sellPrice} onChange={(e: any) => app.setSellPrice(e.target.value)} style={S.input} />
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setSellOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="purple" onClick={app.listItem}>Выставить</Btn></div>
    </Modal>

    <Modal open={app.buyingType !== null} onClose={() => app.setBuyingType(null)}>
      <Store size={40} color="#C084FC" style={{ marginBottom: 15 }} />
      <h3>Название бизнеса</h3>
      <p style={{ color: '#8B899A', fontSize: 13, marginBottom: 15 }}>Только английские буквы и цифры</p>
      <input type="text" value={app.bizNameInput} onChange={e => app.setBizNameInput(e.target.value)} placeholder="Speed Motors" style={S.input} />
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setBuyingType(null)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="purple" onClick={app.submitBizName}>Купить</Btn></div>
    </Modal>

    <Modal open={app.promoOpen} onClose={() => app.setPromoOpen(false)}>
      <Gift size={40} color="#10b981" style={{ marginBottom: 15 }} />
      <h3>Активация промокода</h3>
      <input type="text" value={app.promoInput} onChange={e => app.setPromoInput(e.target.value.toUpperCase())} placeholder="ALPHA100" style={S.input} />
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setPromoOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="primary" onClick={app.redeemPromo}>Активировать</Btn></div>
    </Modal>
  </>
);

export const DailyRewardModal = ({ app }: { app: any }) => {
  if (!app.isDailyOpen) return null;
  return (
    <div style={S.modalBg}>
      <div style={{ ...S.modalBox, maxWidth: '360px' }}>
        <Gift size={40} color="#ec4899" style={{ marginBottom: 10 }} />
        <h3 style={{ marginTop: 0, marginBottom: 15 }}>Ежедневный доход</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {DAILY_REWARDS.map((rw, i) => {
            const isClaimed = app.dailyStreak > i;
            const isCurrent = app.dailyStreak === i;
            return (
              <div key={i} style={{ 
                backgroundColor: isCurrent ? 'rgba(236, 72, 153, 0.2)' : '#0B0914', 
                border: isCurrent ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.05)', 
                borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isClaimed ? 0.5 : 1
              }}>
                <div style={{ fontSize: 10, color: '#8B899A', marginBottom: 5 }}>День {i + 1}</div>
                {rw.type === 'money' ? <Coins size={20} color="#F97316" /> : <Coffee size={20} color="#10B981" />}
                <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 5 }}>{rw.amount} {rw.type === 'money' ? 'монет' : 'шт.'}</div>
                {rw.boost && <div style={{ fontSize: 10, color: '#ec4899' }}>+Буст x1.1</div>}
              </div>
            );
          })}
        </div>
        <Btn variant="primary" onClick={app.claimDaily} disabled={app.proc || app.dailyStreak >= 7} style={{ marginBottom: 10 }}>
          {app.dailyStreak >= 7 ? 'Приходи завтра' : 'Забрать награду'}
        </Btn>
        <Btn variant="secondary" onClick={() => app.setIsDailyOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Закрыть</Btn>
      </div>
    </div>
  );
};

export const HomeTab = ({ app }: { app: any }) => {
  const av = getAvatar(app.avatarId);
  const maxEnergy = app.hasHouse ? 150 : 100;
  const myCoffee = app.myBizs?.find((b: any) => b.biz_type === 'coffee');

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={app.handleAvatar} style={{ width: 55, height: 55, borderRadius: '20px', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer', userSelect: 'none' }}>{av.emoji}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', fontFamily: 'Space Grotesk, sans-serif' }}>{app.nick}</div>
              <button onClick={() => app.setRefOpen(true)} style={{ background: 'rgba(236, 72, 153, 0.15)', border: '1px solid #ec4899', color: '#ec4899', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><UserPlus size={16} /></button>
              <button onClick={() => app.setPromoOpen(true)} style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Gift size={16} /></button>
            </div>
            <div style={{ fontSize: 13, color: '#8B899A', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              ID: {app.tgId.slice(0, 6)}
              {app.boostEnd > Date.now() && <span style={{ color: '#ec4899', fontWeight: 'bold', marginLeft: 5, fontSize: 11, border: '1px solid #ec4899', padding: '1px 4px', borderRadius: 4 }}>x1.1 БУСТ</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <div style={{ color: '#F97316', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, fontFamily: 'Space Grotesk, sans-serif' }}><Coins size={18} /> {app.money.toLocaleString('ru-RU')}</div>
          <div style={{ color: '#C084FC', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 14 }}><Zap size={16} /> {app.energy}/{maxEnergy}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 20, backgroundColor: '#161324', border: '1px solid rgba(192, 132, 252, 0.3)', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Briefcase size={24} color="#C084FC" /><span style={{ fontSize: 13 }}>Мои бизнесы</span>
        </button>
        <button onClick={() => app.setTab('cafe')} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 20, backgroundColor: '#161324', border: '1px solid rgba(249, 115, 22, 0.3)', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Coffee size={24} color="#F97316" /><span style={{ fontSize: 13 }}>Пить кофе</span>
        </button>
      </div>

      {myCoffee && (
        <div style={{ backgroundColor: '#161324', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 20, padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: 12 }}><Coins size={24} color="#10B981" /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>Касса: {myCoffee.business_name}</div>
              <div style={{ fontSize: 12, color: '#8B899A' }}>Доход: <span style={{color: '#10B981', fontWeight: 'bold'}}>{myCoffee.coffee_balance || 0}</span> монет</div>
            </div>
          </div>
          <Btn variant="primary" onClick={app.collect} disabled={app.proc || !myCoffee.coffee_balance} style={{ width: 'auto', padding: '10px 15px', fontSize: 14 }}>Собрать</Btn>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn variant="purple" onClick={app.work} disabled={app.proc || app.energy < 20} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', padding: 20, fontSize: 18 }}>
          <Users size={24} /> Вкалывать на смене (+{app.boostEnd > Date.now() ? 220 : 200})
        </Btn>
        <Btn variant="secondary" onClick={app.rest} disabled={app.proc || app.tLeft > 0 || app.energy >= maxEnergy} style={{ background: '#161324', border: '1px solid rgba(255,255,255,0.1)', color: app.tLeft > 0 ? '#8B899A' : 'white', padding: 20, fontSize: 18 }}>
          <Zap size={24} color={app.tLeft > 0 ? '#8B899A' : '#10B981'} /> {app.tLeft > 0 ? `Отдыхаем ${app.tLeft} сек...` : `Отдых (${app.restTime / 1000} сек)`}
        </Btn>
      </div>
    </div>
  );
};

export const MarketItem = ({ item, app, type }: any) => (
  <div style={{ backgroundColor: '#161324', padding: 15, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
        {type === 'phone' ? (item.item_data === 'button' ? <Phone size={18} color="#8B899A" /> : <Smartphone size={18} color="#8B899A" />) 
        : type === 'car' ? <Car size={18} /> : <Building size={18} />} 
        {type === 'car' ? (item.item_data === 'lada' ? 'Лада' : 'Тойота') 
        : type === 'house' ? 'Квартира' 
        : (item.item_data === 'button' ? 'Кнопочный тел.' : item.item_data === 'smartphone' ? 'Смартфон' : 'Телефон')}
      </div>
      <div style={{ fontSize: 12, color: '#8B899A', marginTop: 4 }}>Продавец: {item.seller_name}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <span style={{ color: '#F97316', fontWeight: 'bold', fontFamily: 'Space Grotesk, sans-serif' }}>{item.price.toLocaleString('ru-RU')}</span>
      {item.seller_id !== app.pid ? (
        <Btn variant="primary" onClick={() => app.buyLot(item)} disabled={app.proc} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>Купить</Btn>
      ) : (
        <button onClick={() => app.cancelLot(item)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Снять с продажи</button>
      )}
    </div>
  </div>
);

export const MarketTab = ({ app }: { app: any }) => (
  <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <h2>Рынок</h2>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#161324', padding: 5, borderRadius: 16 }}>
      {['items', 'cars', 'realestate'].map((t: any) => (
        <button key={t} onClick={() => app.setMarketTab(t)} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 12, backgroundColor: app.marketTab === t ? '#3b82f6' : 'transparent', color: app.marketTab === t ? 'white' : '#8B899A', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
          {t === 'items' ? '📱 Предметы' : t === 'cars' ? '🚗 Авто' : '🏠 Жильё'}
        </button>
      ))}
    </div>
    <div style={{ marginBottom: 30 }}>
      <h3 style={{ color: '#8B899A', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>
      {app.players.map((p: any, i: number) => (
        <div key={p.id} style={{ backgroundColor: '#161324', padding: '12px 15px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#F97316' : i === 1 ? '#C084FC' : i === 2 ? '#3b82f6' : '#8B899A' }}>#{i + 1}</span>
            <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
          </div>
          <span style={{ color: '#10B981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{p.money.toLocaleString('ru-RU')} <Coins size={14} /></span>
        </div>
      ))}
    </div>
    <h3 style={{ color: '#8B899A', fontSize: 16, marginBottom: 10 }}>{app.marketTab === 'items' ? 'Лоты (Предметы)' : app.marketTab === 'cars' ? 'Лоты (Авто)' : 'Лоты (Жилье)'}</h3>
    {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).length === 0 && <p style={{ color: '#8B899A' }}>Пусто...</p>}
    {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).map((item: any) => (
      <MarketItem key={item.id} item={item} app={app} type={item.item_type} />
    ))}
  </div>
);

export const BusinessTab = ({ app, activeBiz, currentStock }: any) => {
  const bizTypes = ['coffee', 'salon', 'taxi', 'phone_factory', 'construction'];
  const currentIndex = bizTypes.indexOf(app.activeBizType);
  const prevType = bizTypes[(currentIndex - 1 + 5) % 5];
  const nextType = bizTypes[(currentIndex + 1) % 5];

  const getPrice = (type: string) => type === 'coffee' ? COFFEE_BIZ_PRICE : type === 'salon' ? SALON_BIZ_PRICE : type === 'taxi' ? TAXI_BIZ_PRICE : type === 'phone_factory' ? PHONE_FACTORY_BIZ_PRICE : CONSTRUCTION_BIZ_PRICE;
  const getBizName = (type: string) => type === 'coffee' ? 'Кофейня' : type === 'salon' ? 'Автосалон' : type === 'taxi' ? 'Таксопарк' : type === 'phone_factory' ? 'Телефонный цех' : 'Стройтрест';

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#8B899A', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Мой Бизнес</h2>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setActiveBizType(prevType)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}><ChevronLeft size={20} color="white" /></button>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{activeBiz ? activeBiz.business_name : getBizName(app.activeBizType)}</div>
        <button onClick={() => app.setActiveBizType(nextType)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer' }}><ChevronRight size={20} color="white" /></button>
      </div>

      {activeBiz ? (
        <div style={S.card}>
          {app.activeBizType === 'salon' && (<>
              <p style={{ color: '#8B899A', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Лада ({currentStock.lada || 0}) | Тойота ({currentStock.toyota || 0})</b></p>
              {app.carOrderEnd > 0 ? (<div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, border: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#3b82f6' }}>Едет: <b>{currentStock.current_model === 'lada' ? 'Лада' : 'Тойота'}</b></p><p style={{ margin: 0, fontSize: 22, color: '#3b82f6', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{app.carTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}><Btn variant="secondary" onClick={() => app.orderCar('lada')} disabled={app.proc || app.money < LADA_PRICE} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6' }}>Заказать Ладу (20 000)</Btn><Btn variant="secondary" onClick={() => app.orderCar('toyota')} disabled={app.proc || app.money < TOYOTA_PRICE} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6' }}>Заказать Тойоту (50 000)</Btn></div>)}
              {currentStock.lada > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('lada'); app.setSellPrice('25000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Ладу со склада</Btn>}
              {currentStock.toyota > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('toyota'); app.setSellPrice('60000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Тойоту со склада</Btn>}
          </>)}
          
          {app.activeBizType === 'construction' && (<>
              <p style={{ color: '#8B899A', fontSize: 15, margin: '5px 0 15px 0' }}>Склад квартир: <b>{currentStock.apartments || 0} шт.</b></p>
              {app.buildEnd > 0 ? (<div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#f97316' }}>Строится дом...</p><p style={{ margin: 0, fontSize: 22, color: '#f97316', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{app.buildTimeLeft} сек.</p></div>)
              : (<Btn variant="secondary" onClick={app.startBuild} disabled={app.proc || app.money < BUILDING_PRICE} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid #f97316', marginBottom: 15 }}><Hammer size={20}/> Построить дом (500 000)</Btn>)}
              {currentStock.apartments > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('house'); app.setSellItemData('apartment'); app.setSellPrice('50000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Building size={18}/> Продать квартиру</Btn>}
          </>)}

          {app.activeBizType === 'phone_factory' && (<>
              <p style={{ color: '#8B899A', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Кнопочные ({currentStock.button || 0}) | Смартфоны ({currentStock.smartphone || 0})</b></p>
              
              {app.phoneProdEnd > 0 ? (
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, border: '1px solid rgba(139, 92, 246, 0.2)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#8b5cf6' }}>Производится партия...</p>
                  <p style={{ margin: 0, fontSize: 22, color: '#8b5cf6', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{app.phoneProdTimeLeft} сек.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
                  <Btn variant="secondary" onClick={() => app.orderPhones('button')} disabled={app.proc || app.money < BUTTON_BATCH_COST} style={{ background: 'rgba(255,255,255,0.05)', color: '#8B899A', border: '1px solid #444', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Кнопочные (10 шт.)</span>
                    <span>5 000</span>
                  </Btn>
                  <Btn variant="secondary" onClick={() => app.orderPhones('smartphone')} disabled={app.proc || app.money < SMARTPHONE_BATCH_COST} style={{ background: 'rgba(255,255,255,0.05)', color: '#8B899A', border: '1px solid #444', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Смартфоны (5 шт.)</span>
                    <span>25 000</span>
                  </Btn>
                </div>
              )}
              
              {currentStock.button > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('button'); app.setSellPrice('2000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Phone size={18}/> Продать кнопочный</Btn>}
              {currentStock.smartphone > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('smartphone'); app.setSellPrice('15000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Smartphone size={18}/> Продать смартфон</Btn>}
          </>)}

          {app.activeBizType === 'taxi' && (<>
              <p style={{ color: '#8B899A', fontSize: 15, margin: '5px 0 15px 0' }}>Машин в парке: <b>{currentStock.taxi_cars?.length || 0}</b></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
                {currentStock.taxi_cars?.map((car: any, i: number) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontWeight: 'bold' }}>{car.model === 'lada' ? 'Лада' : 'Тойота'}</span>
                      <span style={{ color: car.health > 50 ? '#10b981' : car.health > 0 ? '#f59e0b' : '#ef4444' }}>{car.health}%</span>
                    </div>
                    {car.health <= 0 && <Btn variant="danger" onClick={() => app.repairTaxiCar(i)} disabled={app.proc} style={{ padding: 8, fontSize: 12, marginTop: 5 }}><Wrench size={14}/> Ремонт ({car.model === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA})</Btn>}
                  </div>
                ))}
              </div>
              <Btn variant="primary" onClick={app.collectTaxi} disabled={app.proc || !currentStock.taxi_cars?.length} style={{ marginBottom: 10 }}>Собрать доход</Btn>
              <p style={{ fontSize: 12, color: '#8B899A', marginBottom: 5 }}>Добавить машину в парк:</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="secondary" onClick={() => app.addTaxiCar('lada')} disabled={app.proc} style={{ padding: 10, fontSize: 12 }}>+ Лада</Btn>
                <Btn variant="secondary" onClick={() => app.addTaxiCar('toyota')} disabled={app.proc} style={{ padding: 10, fontSize: 12 }}>+ Тойота</Btn>
              </div>
          </>)}
          {app.activeBizType === 'coffee' && (
            <div style={{ marginTop: 15 }}>
              <p style={{ fontSize: 14, color: '#8B899A', marginBottom: 10 }}>Касса кафе: <b style={{ color: '#10b981', fontSize: 18, fontFamily: 'Space Grotesk' }}>{activeBiz.coffee_balance || 0}</b> монет</p>
              <Btn variant="primary" onClick={app.collect} disabled={app.proc || !activeBiz.coffee_balance} style={{ marginBottom: 15 }}>Собрать кассу</Btn>
              {activeBiz.worker_name ? (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16 }}><span style={{ fontSize: 14, color: '#8B899A' }}>Бариста: <b>{activeBiz.worker_name}</b></span><Btn variant="danger" onClick={app.fire} disabled={app.proc} style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}>Уволить</Btn></div>) 
              : <p style={{ fontSize: 14, color: '#f97316', margin: 0 }}>Нет бариста. Наймите сотрудника!</p>}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Btn variant="danger" onClick={() => app.sellBusiness(activeBiz)} disabled={app.proc} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}>
              Продать бизнес (за 50%)
            </Btn>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <Store size={48} color="#C084FC" style={{ marginBottom: 15 }} />
          <h3>Купить {getBizName(app.activeBizType)}</h3>
          <Btn variant="purple" onClick={() => app.setBuyingType(app.activeBizType)} disabled={app.proc || app.money < getPrice(app.activeBizType)} style={{ background: app.money < getPrice(app.activeBizType) ? '#333' : 'linear-gradient(135deg, #C084FC 0%, #8b5cf6 100%)', color: app.money < getPrice(app.activeBizType) ? '#8B899A' : 'white' }}>
            {app.proc ? 'Обработка...' : `Купить за ${getPrice(app.activeBizType).toLocaleString('ru-RU')}`}
          </Btn>
        </div>
      )}
    </div>
  );
};

export const AdminTab = ({ app }: { app: any }) => {
  const [searchQ, setSearchQ] = useState('');
  const [foundPlayers, setFoundPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerBizs, setPlayerBizs] = useState<any[]>([]);

  const [promoCode, setPromoCode] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoLimit, setPromoLimit] = useState('100');

  const handleSearch = async () => {
    if (!searchQ) return;
    const { data } = await app.supabase.from('players').select('*').ilike('nickname', `%${searchQ}%`).limit(5);
    setFoundPlayers(data || []);
  };

  const loadPlayerDetails = async (p: any) => {
    setSelectedPlayer(p);
    const { data } = await app.supabase.from('businesses').select('*').eq('owner_id', p.id);
    setPlayerBizs(data || []);
  };

  const handleGiveMoney = async (amount: number) => {
    if (!selectedPlayer) return;
    const newMoney = Math.max(0, selectedPlayer.money + amount);
    await app.supabase.from('players').update({ money: newMoney }).eq('id', selectedPlayer.id);
    setSelectedPlayer({ ...selectedPlayer, money: newMoney });
    app.showMsg(`Выдано ${amount}`);
    if (app.loadData) app.loadData(true); 
  };

  const handleBan = async () => {
    if (!selectedPlayer) return;
    const newStatus = !selectedPlayer.is_banned;
    await app.supabase.from('players').update({ is_banned: newStatus }).eq('id', selectedPlayer.id);
    setSelectedPlayer({ ...selectedPlayer, is_banned: newStatus });
    app.showMsg(newStatus ? "Забанен" : "Разбанен");
    if (app.loadData) app.loadData(true); 
  };

  const handleDeleteBiz = async (bizId: string) => {
    if (!window.confirm("Удалить этот бизнес?")) return;
    await app.supabase.from('businesses').delete().eq('id', bizId);
    setPlayerBizs(prev => prev.filter(b => b.id !== bizId));
    app.showMsg("Бизнес удален");
    if (app.loadData) app.loadData(true); 
  };

  const handleCreatePromo = async () => {
    if (!promoCode || !promoAmount) return;
    const { error } = await app.supabase.from('promo_codes').insert([{ 
      code: promoCode.toUpperCase(), 
      amount: parseInt(promoAmount), 
      max_uses: parseInt(promoLimit) 
    }]);
    if (error) return app.showMsg(error.message, true);
    app.showMsg("Промокод создан!");
    setPromoCode(''); setPromoAmount('');
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#8B899A', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}><ShieldAlert size={20}/> Админка</h2>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Btn variant={app.adminTab === 'players' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('players')} style={{ padding: 10, background: app.adminTab === 'players' ? '#ef4444' : '#161324' }}>Игроки</Btn>
        <Btn variant={app.adminTab === 'promos' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('promos')} style={{ padding: 10, background: app.adminTab === 'promos' ? '#ef4444' : '#161324' }}>Промокоды</Btn>
      </div>

      {app.adminTab === 'players' && (
        <div>
          {!selectedPlayer ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input type="text" placeholder="Поиск по нику..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ ...S.input, marginBottom: 0, flex: 1 }} />
                <Btn variant="primary" onClick={handleSearch} style={{ width: 'auto', padding: '0 15px' }}><Search size={20}/></Btn>
              </div>
              {foundPlayers.map(p => (
                <div key={p.id} onClick={() => loadPlayerDetails(p)} style={{ background: '#161324', padding: 15, borderRadius: 16, marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  <span style={{ color: '#10B981' }}>{p.money} <Coins size={12}/></span>
                </div>
              ))}
            </>
          ) : (
            <div style={S.card}>
              <button onClick={() => setSelectedPlayer(null)} style={{ background: 'none', border: 'none', color: '#8B899A', marginBottom: 10, cursor: 'pointer' }}>← К поиску</button>
              <h3 style={{ margin: '0 0 5px 0' }}>{selectedPlayer.nickname}</h3>
              <p style={{ color: '#8B899A', fontSize: 12, margin: '0 0 15px 0' }}>ID: {selectedPlayer.telegram_id}</p>
              
              <div style={{ background: '#0B0914', padding: 10, borderRadius: 12, marginBottom: 15 }}>
                <p style={{ margin: '0 0 5px 0' }}>Баланс: <b style={{ color: '#10B981' }}>{selectedPlayer.money}</b></p>
                <p style={{ margin: 0 }}>Статус: <b style={{ color: selectedPlayer.is_banned ? '#ef4444' : '#10B981' }}>{selectedPlayer.is_banned ? 'ЗАБАНЕН' : 'Активен'}</b></p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <Btn variant="primary" onClick={() => handleGiveMoney(10000)} style={{ padding: 10, fontSize: 13 }}>+10k</Btn>
                <Btn variant="danger" onClick={() => handleGiveMoney(-10000)} style={{ padding: 10, fontSize: 13 }}>-10k</Btn>
                <Btn variant={selectedPlayer.is_banned ? 'secondary' : 'danger'} onClick={handleBan} style={{ padding: 10, fontSize: 13 }}><Ban size={16}/> {selectedPlayer.is_banned ? 'Разбан' : 'Бан'}</Btn>
              </div>

              <h4 style={{ margin: '15px 0 10px 0', borderTop: '1px solid #333', paddingTop: 15 }}>Бизнесы ({playerBizs.length})</h4>
              {playerBizs.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{b.business_name} ({b.biz_type})</span>
                  <button onClick={() => handleDeleteBiz(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
              {playerBizs.length === 0 && <p style={{ color: '#8B899A', fontSize: 12 }}>Нет бизнесов.</p>}
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
          <Btn variant="primary" onClick={handleCreatePromo}>Создать</Btn>
        </div>
      )}
    </div>
  );
};