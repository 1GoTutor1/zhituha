import { Coins, Zap, UserPlus, User, Briefcase, Coffee, Users, Smartphone, Car, Building, Store, Hammer, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAvatar, LADA_PRICE, TOYOTA_PRICE, BUILDING_PRICE, BUSINESS_PRICE, S } from './constants';
import { Btn } from './components';

export const HomeTab = ({ app }: { app: any }) => {
  const av = getAvatar(app.avatarId);
  const maxEnergy = app.hasHouse ? 150 : 100;

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={app.handleAvatar} style={{ width: 50, height: 50, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '2px solid rgba(255,255,255,0.2)', cursor: 'pointer', userSelect: 'none' }}>{av.emoji}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>{app.nick}</div>
              <button onClick={() => app.setRefOpen(true)} style={{ background: 'rgba(236, 72, 153, 0.15)', border: '1px solid #ec4899', color: '#ec4899', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><UserPlus size={16} /></button>
            </div>
            <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><User size={12} /> ID: {app.tgId.slice(0, 6)}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 'bold' }}>
          <div style={{ color: '#fbbf24', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Coins size={16} /> {app.money}</div>
          {/* Выводим новую шкалу энергии */}
          <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Zap size={16} /> {app.energy}/{maxEnergy}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 16, backgroundColor: 'rgba(30, 30, 36, 0.6)', border: '1px solid #8b5cf6', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', backdropFilter: 'blur(10px)' }}><Briefcase size={24} color="#8b5cf6" /><span style={{ fontSize: 12 }}>Бизнес<br />стартапы</span></button>
        <button onClick={() => app.setTab('cafe')} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 16, backgroundColor: 'rgba(30, 30, 36, 0.6)', border: '1px solid #f97316', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', backdropFilter: 'blur(10px)' }}><Coffee size={24} color="#f97316" /><span style={{ fontSize: 12 }}>Кафе</span></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center' }}>
        <Btn variant="secondary" onClick={app.work} disabled={app.proc || app.energy < 20}><Users size={20} /> Подработка (+200)</Btn>
        <Btn variant="primary" onClick={app.rest} disabled={app.proc || app.tLeft > 0 || app.energy >= maxEnergy} style={{ background: 'rgba(30, 30, 36, 0.8)', border: '1px solid #10b981', color: app.tLeft > 0 ? '#888' : '#10b981', boxShadow: 'none' }}><Zap size={20} /> {app.tLeft > 0 ? `Ждать ${app.tLeft} сек.` : `Отдых (${app.restTime / 1000} сек)`}</Btn>
      </div>
    </div>
  );
};

export const MarketItem = ({ item, app, type }: any) => (
  <div style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: 15, borderRadius: 16, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
        {type === 'phone' ? <Smartphone size={18} /> : type === 'car' ? <Car size={18} /> : <Building size={18} />} 
        {type === 'car' ? (item.item_data === 'lada' ? 'Лада' : 'Тойота') : type === 'house' ? 'Квартира' : 'Телефон'}
      </div>
      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Продавец: {item.seller_name}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price}</span>
      {item.seller_id !== app.pid ? <Btn variant="primary" onClick={() => app.buyLot(item)} disabled={app.proc} style={{ width: 'auto', padding: '6px 12px', fontSize: 13 }}>Купить</Btn> : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}
    </div>
  </div>
);

export const MarketTab = ({ app }: any) => (
  <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <h2>Рынок</h2>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'rgba(30, 30, 36, 0.8)', padding: 5, borderRadius: 12 }}>
      {['items', 'cars', 'realestate'].map((t: any) => (
        <button key={t} onClick={() => app.setMarketTab(t)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, backgroundColor: app.marketTab === t ? '#3b82f6' : 'transparent', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          {t === 'items' ? '📱 Предметы' : t === 'cars' ? '🚗 Авто' : '🏠 Жильё'}
        </button>
      ))}
    </div>
    <div style={{ marginBottom: 30 }}>
      <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>
      {app.players.map((p: any, i: number) => (
        <div key={p.id} style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: '12px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#a1a1aa' }}>#{i + 1}</span>
            <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
          </div>
          <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{p.money} <Coins size={14} /></span>
        </div>
      ))}
    </div>
    <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>{app.marketTab === 'items' ? 'Лоты (Предметы)' : app.marketTab === 'cars' ? 'Лоты (Авто)' : 'Лоты (Жилье)'}</h3>
    {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).length === 0 && <p style={{ color: '#666' }}>Пусто...</p>}
    {app.market.filter((m: any) => m.item_type === (app.marketTab === 'items' ? 'phone' : app.marketTab === 'cars' ? 'car' : 'house')).map((item: any) => (
      <MarketItem key={item.id} item={item} app={app} type={item.item_type} />
    ))}
  </div>
);

// --- ИСПРАВЛЕННЫЙ BUSINESS TAB (Круглые стрелочки) ---
export const BusinessTab = ({ app, activeBiz, currentStock }: any) => {
  const bizTypes = ['coffee', 'salon', 'construction'];
  const currentIndex = bizTypes.indexOf(app.activeBizType);
  const prevType = bizTypes[(currentIndex - 1 + 3) % 3];
  const nextType = bizTypes[(currentIndex + 1) % 3];

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Мой Бизнес</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => app.setActiveBizType(prevType)} style={{ background: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 8, padding: 8, cursor: 'pointer' }}><ChevronLeft size={20} color="white" /></button>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{app.activeBizType === 'coffee' ? '☕ Кофейня' : app.activeBizType === 'salon' ? '🚗 Автосалон' : '🏗️ Стройтрест'}</div>
        <button onClick={() => app.setActiveBizType(nextType)} style={{ background: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 8, padding: 8, cursor: 'pointer' }}><ChevronRight size={20} color="white" /></button>
      </div>
      {activeBiz ? (
        <div style={S.card}>
          {app.activeBizType === 'salon' && (<>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Лада ({currentStock.lada || 0}) | Тойота ({currentStock.toyota || 0})</b></p>
              {app.carOrderEnd > 0 ? (<div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid rgba(59, 130, 246, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#3b82f6' }}>Едет: <b>{currentStock.current_model === 'lada' ? 'Лада' : 'Тойота'}</b></p><p style={{ margin: 0, fontSize: 22, color: '#3b82f6', fontWeight: 'bold' }}>{app.carTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}><Btn variant="secondary" onClick={() => app.orderCar('lada')} disabled={app.proc || app.money < LADA_PRICE} style={{ background: '#333', border: '1px solid #3b82f6' }}>Заказать Ладу (20 000)</Btn><Btn variant="secondary" onClick={() => app.orderCar('toyota')} disabled={app.proc || app.money < TOYOTA_PRICE} style={{ background: '#333', border: '1px solid #3b82f6' }}>Заказать Тойоту (50 000)</Btn></div>)}
              {currentStock.lada > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('lada'); app.setSellPrice('25000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Ладу со склада</Btn>}
              {currentStock.toyota > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData('toyota'); app.setSellPrice('60000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Car size={18}/> Продать Тойоту со склада</Btn>}
          </>)}
          {app.activeBizType === 'construction' && (<>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0 15px 0' }}>Склад квартир: <b>{currentStock.apartments || 0} шт.</b></p>
              {app.buildEnd > 0 ? (<div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#f97316' }}>Строится дом...</p><p style={{ margin: 0, fontSize: 22, color: '#f97316', fontWeight: 'bold' }}>{app.buildTimeLeft} сек.</p></div>)
              : (<Btn variant="secondary" onClick={app.startBuild} disabled={app.proc || app.money < BUILDING_PRICE} style={{ background: '#333', border: '1px solid #f97316', marginBottom: 15 }}><Hammer size={20}/> Построить дом (30 000)</Btn>)}
              {currentStock.apartments > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('house'); app.setSellItemData('apartment'); app.setSellPrice('50000'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Building size={18}/> Продать квартиру</Btn>}
          </>)}
          {app.activeBizType === 'coffee' && (
            <div style={{ marginTop: 15 }}>
              <p style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 10 }}>Касса кафе: <b style={{ color: '#10b981' }}>{activeBiz.coffee_balance || 0}</b> монет</p>
              <Btn variant="primary" onClick={app.collect} disabled={app.proc || !activeBiz.coffee_balance} style={{ marginBottom: 15 }}>Собрать кассу (+{activeBiz.coffee_balance || 0})</Btn>
              {activeBiz.worker_name ? (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 }}><span style={{ fontSize: 14 }}>Бариста: {activeBiz.worker_name}</span><Btn variant="danger" onClick={app.fire} disabled={app.proc} style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}>Уволить</Btn></div>) 
              : <p style={{ fontSize: 14, color: '#f97316', margin: 0 }}>Нет бариста. Кафе не приносит доход!</p>}
            </div>
          )}
        </div>
      ) : (<div style={{ ...S.card, textAlign: 'center' }}><Store size={48} color="#8b5cf6" style={{ marginBottom: 15 }} /><h3>Купить {app.activeBizType === 'coffee' ? 'Кофейню' : app.activeBizType === 'salon' ? 'Автосалон' : 'Стройтрест'}</h3><Btn variant="purple" onClick={() => app.buyBiz(app.activeBizType)} disabled={app.proc || app.money < BUSINESS_PRICE} style={{ background: app.money < BUSINESS_PRICE ? '#333' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: app.money < BUSINESS_PRICE ? '#888' : 'white' }}>{app.proc ? 'Обработка...' : `Купить за ${BUSINESS_PRICE}`}</Btn></div>)}
    </div>
  );
};