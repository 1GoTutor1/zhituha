import { Coins, Zap, UserPlus, Briefcase, Coffee, Users, Smartphone, Car, Building, Store, Hammer, ChevronLeft, ChevronRight, Gift, Wrench } from 'lucide-react';
import { 
  getAvatar, LADA_PRICE, TOYOTA_PRICE, BUILDING_PRICE, COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, TAXI_BIZ_PRICE, CONSTRUCTION_BIZ_PRICE,
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, S 
} from './constants';
import { Btn } from './components';

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
        {type === 'phone' ? <Smartphone size={18} /> : type === 'car' ? <Car size={18} /> : <Building size={18} />} 
        {type === 'car' ? (item.item_data === 'lada' ? 'Лада' : 'Тойота') : type === 'house' ? 'Квартира' : 'Телефон'}
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

export const MarketTab = ({ app }: any) => (
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
  // ИЗМЕНЕН ПОРЯДОК ПО ЦЕНЕ: Кофейня -> Автосалон -> Таксопарк -> Стройтрест
  const bizTypes = ['coffee', 'salon', 'taxi', 'construction'];
  const currentIndex = bizTypes.indexOf(app.activeBizType);
  const prevType = bizTypes[(currentIndex - 1 + 4) % 4];
  const nextType = bizTypes[(currentIndex + 1) % 4];

  const getPrice = (type: string) => type === 'coffee' ? COFFEE_BIZ_PRICE : type === 'salon' ? SALON_BIZ_PRICE : type === 'taxi' ? TAXI_BIZ_PRICE : CONSTRUCTION_BIZ_PRICE;
  const getBizName = (type: string) => type === 'coffee' ? 'Кофейня' : type === 'salon' ? 'Автосалон' : type === 'taxi' ? 'Таксопарк' : 'Стройтрест';

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
              : (<Btn variant="secondary" onClick={app.startBuild} disabled={app.proc || app.money < BUILDING_PRICE} style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid #f97316', marginBottom: 15 }}><Hammer size={20}/> Построить дом (300 000)</Btn>)}
              {currentStock.apartments > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('house'); app.setSellItemData('apartment'); app.setSellPrice('50000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Building size={18}/> Продать квартиру</Btn>}
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