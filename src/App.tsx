import { useState, useEffect } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';

const PHONE_PRICE = 2000;
const SELL_TO_GAME_MULTIPLIER = 0.7; 
const ENERGY_COOLDOWN_MS = 60000; 
const BUSINESS_PRICE = 10000; 
const WORKER_SALARY = 300; 
const WORKER_BONUS_TO_OWNER = 100; 

interface Player { id: string; nickname: string; money: number; }
interface MarketItem { id: string; seller_id: string; seller_name: string; item_type: string; price: number; }
interface Business { 
  id: string; owner_id: string; owner_name: string; worker_id: string | null; worker_name: string | null; last_collected: string;
}

function App() {
  const { user, hapticFeedback } = useTelegram();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  const [playerId, setPlayerId] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [hasPhone, setHasPhone] = useState(false); 
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  
  const [myBusiness, setMyBusiness] = useState<Business | null>(null);
  const [myJob, setMyJob] = useState<Business | null>(null); 
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [pendingIncome, setPendingIncome] = useState(0);

  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellPriceInput, setSellPriceInput] = useState('2000');

  const [activeTab, setActiveTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business'>('home');
  const [notification, setNotification] = useState<string | null>(null);
  const [notifColor, setNotifColor] = useState('#10b981');

  const getUniqueId = () => {
    if (user?.id) return user.id.toString();
    let browserId = localStorage.getItem('zhituha_browser_id');
    if (!browserId) {
      browserId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('zhituha_browser_id', browserId);
    }
    return browserId;
  };

  const loadPlayerData = async () => {
    const tgId = getUniqueId(); 
    const { data }: any = await supabase.from('players').select('*').eq('telegram_id', tgId).maybeSingle();

    if (data) {
      setPlayerId(data.id);
      setNickname(data.nickname);
      setGender(data.gender);
      setMoney(Number(data.money));
      setEnergy(Number(data.energy));
      setHasPhone(Number(data.phone_count) > 0); 
      
      const now = Date.now();
      const lastRest = Number(data.last_rest_time) || 0;
      const diff = Math.max(0, Math.ceil((lastRest + ENERGY_COOLDOWN_MS - now) / 1000));
      setTimeLeft(diff);
      
      const { data: bizData }: any = await supabase.from('businesses').select('*');
      if (bizData) {
        setAllBusinesses(bizData);
        setMyBusiness(bizData.find((b: any) => b.owner_id === data.id) || null);
        setMyJob(bizData.find((b: any) => b.worker_id === data.id) || null);
      }
    } else if (user?.first_name) {
      setInputName(user.first_name);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadPlayerData(); }, [user]);

  // Умный расчет кассы на клиенте (только для отображения)
  useEffect(() => {
    if (!myBusiness || !myBusiness.worker_id || !myBusiness.last_collected) {
      setPendingIncome(0);
      return;
    }

    const updateIncome = () => {
      const lastCollected = new Date(myBusiness.last_collected).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, (now - lastCollected) / 1000); 
      const income = Math.floor(diffSeconds * (100 / 60)); 
      setPendingIncome(isNaN(income) ? 0 : income);
    };

    updateIncome(); 
    const interval = setInterval(updateIncome, 1000); 
    return () => clearInterval(interval);
  }, [myBusiness]);

  useEffect(() => {
    if (activeTab === 'market') {
      const fetchMarket = async () => {
        const { data: players }: any = await supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10);
        if (players) setGlobalPlayers(players);
        const { data: lots }: any = await supabase.from('market_items').select('*').order('created_at', { ascending: false });
        if (lots) setMarketItems(lots);
      };
      fetchMarket();
    }
    
    if (activeTab === 'business' && playerId) {
      const fetchBiz = async () => {
        const { data }: any = await supabase.from('businesses').select('*');
        if (data) {
          setAllBusinesses(data);
          setMyBusiness(data.find((b: any) => b.owner_id === playerId) || null);
          setMyJob(data.find((b: any) => b.worker_id === playerId) || null);
        }
      };
      fetchBiz();
    }
  }, [activeTab, playerId]);

  const saveProgress = async (newData: Record<string, unknown>) => {
    if (!playerId) return false;
    const { error } = await supabase.from('players').update(newData).eq('id', playerId);
    if (error) {
      showNotification("Ошибка БД: " + error.message, true);
      return false;
    }
    return true;
  };

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
    setNotifColor(isError ? '#ef4444' : '#10b981');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRegister = async () => {
    hapticFeedback('medium');
    if (inputName.trim() === '') return showNotification('Введи никнейм!', true);
    if (!selectedGender) return showNotification('Выбери пол!', true);

    const tgId = getUniqueId();
    const { data, error }: any = await supabase.from('players').insert([{
      telegram_id: tgId, nickname: inputName, gender: selectedGender, money: 3500, energy: 80, phone_count: 0, last_rest_time: 0
    }]).select().single();

    if (error) {
      showNotification("Ошибка базы: " + error.message, true);
    } else if (data) {
      setPlayerId(data.id); setNickname(inputName); setGender(selectedGender);
    }
  };

  const handleWork = async () => {
    if (isSaving) return;
    if (!hasPhone) return showNotification("Без телефона не найти работу!", true);
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    setIsSaving(true); hapticFeedback('medium');
    
    const newMoney = Number(money) + 500;
    const newEnergy = Math.max(0, Number(energy) - 20);
    
    if (await saveProgress({ money: newMoney, energy: newEnergy })) {
      setMoney(newMoney); setEnergy(newEnergy); showNotification("Работа +500 монет");
    }
    setIsSaving(false);
  };

  const handleWorkJanitor = async () => {
    if (isSaving) return;
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    setIsSaving(true); hapticFeedback('light');
    
    const newMoney = Number(money) + 200;
    const newEnergy = Math.max(0, Number(energy) - 20);
    
    if (await saveProgress({ money: newMoney, energy: newEnergy })) {
      setMoney(newMoney); setEnergy(newEnergy); showNotification("Подработка +200 монет");
    }
    setIsSaving(false);
  };

  const handleRest = async () => {
    if (isSaving || timeLeft > 0) return;
    if (energy === 100) return showNotification("Полная энергия!", true);
    setIsSaving(true); hapticFeedback('light');
    
    const now = Date.now();
    if (await saveProgress({ energy: 100, last_rest_time: now })) {
      setEnergy(100); setTimeLeft(ENERGY_COOLDOWN_MS / 1000); showNotification("Энергия восстановлена!");
    }
    setIsSaving(false);
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleBuyPhone = async () => {
    if (isSaving || money < PHONE_PRICE) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const newMoney = Number(money) - PHONE_PRICE;
    if (await saveProgress({ money: newMoney, phone_count: 1 })) {
      setMoney(newMoney); setHasPhone(true); showNotification("Телефон куплен!");
    }
    setIsSaving(false);
  };

  const handleSellToGame = async () => {
    if (isSaving || !hasPhone) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const sellPrice = Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER);
    const newMoney = Number(money) + sellPrice;
    
    if (await saveProgress({ money: newMoney, phone_count: 0 })) {
      setMoney(newMoney); setHasPhone(false); showNotification(`Сдан за ${sellPrice} монет.`);
    }
    setIsSaving(false);
  };

  const handleConfirmSellToMarket = async () => {
    if (isSaving || !hasPhone || !playerId) return;
    const price = Number(sellPriceInput);
    if (isNaN(price) || price <= 0) return showNotification("Некорректная цена!", true);
    setIsSaving(true); hapticFeedback('medium');
    
    const { error } = await supabase.from('market_items').insert([{ seller_id: playerId, seller_name: nickname, item_type: 'phone', price: price }]);
    if (!error) {
      await saveProgress({ phone_count: 0 });
      setHasPhone(false); showNotification("Выставлено на рынок!"); setIsSellModalOpen(false); setActiveTab('market');
    } else { showNotification("Ошибка выставления", true); }
    setIsSaving(false);
  };

  const handleBuyLot = async (lotId: string) => {
    if (isSaving) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const { data }: any = await supabase.rpc('buy_market_item', { buyer_id: playerId, lot_id: lotId });
    if (!data) { showNotification("Не хватает денег или лот продан!", true); } 
    else { showNotification("Покупка успешна!"); await loadPlayerData(); setActiveTab('market'); }
    setIsSaving(false);
  };

  const handleBuyBusiness = async () => {
    if (isSaving || money < BUSINESS_PRICE || myBusiness) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const newMoney = Number(money) - BUSINESS_PRICE;
    if (await saveProgress({ money: newMoney })) {
      setMoney(newMoney);
      const { error }: any = await supabase.from('businesses').insert([{ owner_id: playerId, owner_name: nickname, worker_id: null }]);
      if (error) { showNotification("Ошибка БД: " + error.message, true); } 
      else { showNotification("Кофейня открыта!"); await loadPlayerData(); }
    }
    setIsSaving(false);
  };

  // ИДЕАЛЬНЫЙ СБОР ДОХОДА (Вызывает SQL, база сама начисляет деньги)
  const handleCollectIncome = async () => {
    if (isSaving || !myBusiness) return;
    setIsSaving(true); hapticFeedback('medium');
    
    const { data, error }: any = await supabase.rpc('collect_business_income', { 
      biz_id: myBusiness.id, 
      p_id: playerId 
    });
    
    if (error) {
      showNotification("Ошибка сбора: " + error.message, true);
    } else if (data && Number(data) > 0) {
      showNotification(`Собрано ${data} монет!`);
      await loadPlayerData(); // Обновляем всё из БД
    } else {
      showNotification("В кассе пока нет монет. Подожди немного!", true);
    }
    setIsSaving(false);
  };

  const handleHireWorker = async (bizId: string, workerId: string, workerName: string) => {
    if (isSaving) return;
    setIsSaving(true); hapticFeedback('medium');
    await supabase.from('businesses').update({ worker_id: workerId, worker_name: workerName, last_collected: new Date().toISOString() }).eq('id', bizId);
    showNotification("Сотрудник нанят!"); await loadPlayerData(); setIsSaving(false);
  };

  const handleFireWorker = async () => {
    if (isSaving || !myBusiness) return;
    setIsSaving(true);
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', myBusiness.id);
    showNotification("Сотрудник уволен."); await loadPlayerData(); setIsSaving(false);
  };

  const handleWorkShift = async () => {
    if (isSaving || !myJob || energy < 20) return;
    setIsSaving(true); hapticFeedback('medium');
    
    const newEnergy = Math.max(0, Number(energy) - 20);
    const newMoney = Number(money) + WORKER_SALARY;
    
    if (await saveProgress({ energy: newEnergy, money: newMoney })) {
      setEnergy(newEnergy); setMoney(newMoney);
      const { data: ownerData }: any = await supabase.from('players').select('money').eq('id', myJob.owner_id).single();
      if (ownerData) { 
        await supabase.from('players').update({ money: Number(ownerData.money) + WORKER_BONUS_TO_OWNER }).eq('id', myJob.owner_id); 
      }
      showNotification(`Ты заработал ${WORKER_SALARY} монет!`);
    }
    setIsSaving(false);
  };

  const cardStyle = { backgroundColor: '#1e1e24', color: 'white', padding: 20, borderRadius: 16, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, boxShadow: '0 8px 16px rgba(0,0,0,0.4)' };

  if (isLoading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка...</div>;

  if (!nickname || !gender) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
        {notification && <div style={{ position: 'fixed', top: 20, backgroundColor: notifColor, padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000 }}>{notification}</div>}
        <h1>Создание персонажа</h1>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <button onClick={() => setSelectedGender('male')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'male' ? '#3b82f6' : '#1e1e24', borderRadius: 12 }}>🧑</button>
          <button onClick={() => setSelectedGender('female')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'female' ? '#3b82f6' : '#1e1e24', borderRadius: 12 }}>👩</button>
        </div>
        <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="Ник..." style={{ fontSize: 18, padding: 14, marginBottom: 20, width: '250px', borderRadius: 10, backgroundColor: '#1e1e24', color: 'white', textAlign: 'center' }} />
        <button onClick={handleRegister} disabled={isSaving} style={{ fontSize: 18, padding: 15, width: '250px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', borderRadius: 10, fontWeight: 'bold' }}>Начать</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 90px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
      
      {notification && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: notifColor, color: 'white', padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '300px' }}>{notification}</div>
      )}

      {isSellModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500, padding: 20 }}>
          <div style={{ backgroundColor: '#1e1e24', padding: 20, borderRadius: 16, width: '100%', maxWidth: '320px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, fontSize: 20 }}>Продажа телефона</h3>
            <input type="number" value={sellPriceInput} onChange={(e) => setSellPriceInput(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center', fontSize: 18, marginBottom: 20, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsSellModalOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#333', color: 'white', border: 'none', fontWeight: 'bold' }}>Отмена</button>
              <button onClick={handleConfirmSellToMarket} disabled={isSaving} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 'bold' }}>{isSaving ? '...' : 'Выставить'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '350px', margin: '0 auto', borderBottom: '1px solid #333', paddingBottom: 15, marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px' }}>
          {user?.photo_url ? <img src={user.photo_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} /> : <span style={{ fontSize: '28px' }}>{gender === 'male' ? '🧑' : '👩'}</span>}
          {nickname}
        </h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1e1e24', padding: '15px 25px', borderRadius: '12px', maxWidth: '350px', margin: '0 auto 20px auto', border: '1px solid #333' }}>
        <div style={{ fontSize: 18 }}>💰 <b>{money}</b></div>
        <div style={{ fontSize: 18 }}>⚡ <b>{energy}</b>/100</div>
      </div>

      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          <button onClick={handleWork} disabled={isSaving || !hasPhone} style={{ fontSize: 18, padding: 16, width: '320px', cursor: (isSaving || !hasPhone) ? 'not-allowed' : 'pointer', backgroundColor: hasPhone ? '#10b981' : '#333', color: hasPhone ? 'white' : '#888', borderRadius: 12, fontWeight: 'bold', border: 'none', opacity: isSaving ? 0.7 : 1 }}>Работать (💰+500, ⚡-20)</button>
          <button onClick={handleWorkJanitor} disabled={isSaving} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: '#f59e0b', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none', opacity: isSaving ? 0.7 : 1 }}>Дворником (💰+200, ⚡-20)</button>
          <button onClick={handleRest} disabled={isSaving || timeLeft > 0} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: timeLeft > 0 ? '#333' : '#3b82f6', color: timeLeft > 0 ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', border: 'none', opacity: isSaving ? 0.7 : 1 }}>{timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть'}</button>
        </div>
      )}

      {activeTab === 'business' && (
        <div>
          <h2>💼 Бизнес</h2>
          {myBusiness ? (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>☕ Кофейня</div>
              <p>Владелец: <b>Ты</b></p>
              <p>Сотрудник: <b>{myBusiness.worker_name || 'Нет'}</b></p>
              
              {myBusiness.worker_id ? (
                <div style={{ backgroundColor: '#121212', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid #333' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#a1a1aa' }}>Доход: <b>100 монет / мин</b></p>
                  <p style={{ margin: 0, fontSize: 20, color: '#10b981', fontWeight: 'bold' }}>
                    В кассе: {pendingIncome} 💰
                  </p>
                </div>
              ) : (
                <p style={{ color: '#fbbf24', fontSize: 14 }}>Найми сотрудника, чтобы бизнес начал приносить доход!</p>
              )}

              <button onClick={handleCollectIncome} disabled={isSaving || pendingIncome <= 0} style={{ fontSize: 16, padding: 15, width: '100%', backgroundColor: pendingIncome > 0 ? '#10b981' : '#333', color: pendingIncome > 0 ? 'white' : '#888', borderRadius: 12, fontWeight: 'bold', border: 'none', marginBottom: 10, opacity: isSaving ? 0.7 : 1 }}>
                Собрать пассивный доход
              </button>

              {myBusiness.worker_id ? (
                <button onClick={handleFireWorker} disabled={isSaving} style={{ fontSize: 14, padding: 12, width: '100%', backgroundColor: '#ef4444', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none', opacity: isSaving ? 0.7 : 1 }}>Уволить сотрудника</button>
              ) : null}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
              <h3>Открыть Кофейню</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa' }}>Бизнес приносит пассивный доход, если в нем есть сотрудник.</p>
              <button onClick={handleBuyBusiness} disabled={isSaving || money < BUSINESS_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', backgroundColor: money < BUSINESS_PRICE ? '#333' : '#8b5cf6', color: money < BUSINESS_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10, border: 'none', opacity: isSaving ? 0.7 : 1 }}>
                {money < BUSINESS_PRICE ? 'Мало денег' : `Открыть за 💰 ${BUSINESS_PRICE}`}
              </button>
            </div>
          )}

          {!myJob && (
            <div style={{ marginTop: 30 }}>
              <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Свободные вакансии</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
                {allBusinesses.filter(b => !b.worker_id && b.owner_id !== playerId).map(b => (
                  <div key={b.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold' }}>☕ Кофейня</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa' }}>Владелец: {b.owner_name}</div>
                    </div>
                    <button onClick={() => handleHireWorker(b.id, playerId!, nickname)} disabled={isSaving} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold', opacity: isSaving ? 0.7 : 1 }}>Устроиться</button>
                  </div>
                ))}
                {allBusinesses.filter(b => !b.worker_id && b.owner_id !== playerId).length === 0 && (
                  <p style={{ color: '#666', fontSize: 14 }}>Пока нет свободных мест...</p>
                )}
              </div>
            </div>
          )}

          {myJob && (
            <div style={{ marginTop: 30 }}>
              <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Моя работа</h3>
              <div style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 12, border: '1px solid #333', maxWidth: '350px', margin: '0 auto' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: 16 }}>☕ Кофейня (Владелец: {myJob.owner_name})</p>
                <button onClick={handleWorkShift} disabled={isSaving || energy < 20} style={{ backgroundColor: energy < 20 ? '#333' : '#10b981', color: energy < 20 ? '#888' : 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: (isSaving || energy < 20) ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%', fontSize: 16, opacity: isSaving ? 0.7 : 1 }}>
                  Отработать смену (+{WORKER_SALARY} 💰, ⚡-20)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'shop' && (
        <div>
          <h2>🏪 Гос. магазин</h2>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>📱</div>
            <h3>Смартфон</h3>
            {hasPhone ? <div style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Куплено</div> : (
              <button onClick={handleBuyPhone} disabled={isSaving || money < PHONE_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', backgroundColor: money < PHONE_PRICE ? '#333' : '#8b5cf6', color: money < PHONE_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10, border: 'none', opacity: isSaving ? 0.7 : 1 }}>
                {money < PHONE_PRICE ? 'Мало денег' : `Купить за 💰 ${PHONE_PRICE}`}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div>
          <h2>🌍 Барахолка</h2>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Топ богачей</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
              {globalPlayers.map((p, index) => (
                <div key={p.id} style={{ backgroundColor: '#1e1e24', padding: '10px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 16, color: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : '#a1a1aa' }}>{index + 1}.</span>
                    <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{p.money} 💰</span>
                </div>
              ))}
            </div>
          </div>
          <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Лоты игроков</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
            {marketItems.map((item) => (
              <div key={item.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 12, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 24 }}>📱 Смартфон</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa' }}>Продавец: {item.seller_name}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price} 💰</span>
                  {item.seller_id !== playerId ? (
                    <button onClick={() => handleBuyLot(item.id)} disabled={isSaving} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold', opacity: isSaving ? 0.7 : 1 }}>Купить</button>
                  ) : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <h2>🎒 Инвентарь</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '350px', margin: '0 auto' }}>
            {hasPhone ? (
              <div style={{ backgroundColor: '#1e1e24', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: 32 }}>📱</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setIsSellModalOpen(true)} disabled={isSaving} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14, width: '100%', opacity: isSaving ? 0.7 : 1 }}>Выставить на рынок</button>
                  <button onClick={handleSellToGame} disabled={isSaving} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14, width: '100%', opacity: isSaving ? 0.7 : 1 }}>Сдать в ломбард (+{Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER)})</button>
                </div>
              </div>
            ) : <div style={{ color: '#52525b', padding: 40 }}>Пусто...</div>}
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1e1e24', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', fontSize: 11, color: activeTab === 'home' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
          <span style={{ fontSize: 20 }}>🏠</span> Главная
        </button>
        <button onClick={() => setActiveTab('business')} style={{ background: 'none', border: 'none', fontSize: 11, color: activeTab === 'business' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
          <span style={{ fontSize: 20 }}>💼</span> Бизнес
        </button>
        <button onClick={() => setActiveTab('market')} style={{ background: 'none', border: 'none', fontSize: 11, color: activeTab === 'market' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
          <span style={{ fontSize: 20 }}>🌍</span> Рынок
        </button>
        <button onClick={() => setActiveTab('shop')} style={{ background: 'none', border: 'none', fontSize: 11, color: activeTab === 'shop' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
          <span style={{ fontSize: 20 }}>🏪</span> Магазин
        </button>
        <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', fontSize: 11, color: activeTab === 'inventory' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
          <span style={{ fontSize: 20 }}>🎒</span> Сумка
        </button>
      </div>
    </div>
  );
}

export default App;