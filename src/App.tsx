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
interface Business { id: string; owner_id: string; owner_name: string; worker_id: string | null; worker_name: string | null; }

function App() {
  const { user, hapticFeedback } = useTelegram();

  const [isLoading, setIsLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phoneCount, setPhoneCount] = useState(0); 
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  
  const [myBusiness, setMyBusiness] = useState<Business | null>(null);
  const [myJob, setMyJob] = useState<Business | null>(null); 
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);

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
    // maybeSingle безопаснее, чем single, если данных еще нет
    const { data, error }: any = await supabase.from('players').select('*').eq('telegram_id', tgId).maybeSingle();

    if (error) {
      showNotification("Ошибка загрузки данных", true);
      setIsLoading(false);
      return;
    }

    if (data) {
      setPlayerId(data.id);
      setNickname(data.nickname);
      setGender(data.gender);
      setMoney(data.money);
      setEnergy(data.energy);
      setPhoneCount(data.phone_count || 0);
      
      const now = Date.now();
      const lastRest = data.last_rest_time || 0;
      const diff = Math.max(0, Math.ceil((lastRest + ENERGY_COOLDOWN_MS - now) / 1000));
      setTimeLeft(diff);
    } else if (user?.first_name) {
      setInputName(user.first_name);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadPlayerData(); }, [user]);

  // Загружаем данные только для конкретной вкладки (чтобы не перезаписать деньги старыми данными)
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

  // Универсальная функция сохранения (возвращает true, если сохранилось)
  const saveProgress = async (newData: Record<string, unknown>) => {
    if (!playerId) return false;
    const { error } = await supabase.from('players').update(newData).eq('id', playerId);
    if (error) {
      showNotification("Ошибка сохранения", true);
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
    hapticFeedback('medium');
    if (phoneCount === 0) return showNotification("Без телефона не найти работу!", true);
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    
    const newMoney = money + 500;
    const newEnergy = Math.max(0, energy - 20);
    
    // Сначала сохраняем в БД, потом обновляем экран
    const success = await saveProgress({ money: newMoney, energy: newEnergy });
    if (success) {
      setMoney(newMoney); setEnergy(newEnergy); 
      showNotification("Работа +500 монет");
    }
  };

  const handleWorkJanitor = async () => {
    hapticFeedback('light');
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    
    const newMoney = money + 200;
    const newEnergy = Math.max(0, energy - 20);
    
    const success = await saveProgress({ money: newMoney, energy: newEnergy });
    if (success) {
      setMoney(newMoney); setEnergy(newEnergy); 
      showNotification("Подработка +200 монет");
    }
  };

  const handleRest = async () => {
    hapticFeedback('light');
    if (timeLeft > 0) return showNotification(`Жди ${timeLeft} сек.`, true);
    if (energy === 100) return showNotification("Полная энергия!", true);
    
    const now = Date.now();
    const success = await saveProgress({ energy: 100, last_rest_time: now });
    if (success) {
      setEnergy(100); 
      setTimeLeft(ENERGY_COOLDOWN_MS / 1000);
      showNotification("Энергия восстановлена!");
    }
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleBuyPhone = async () => {
    hapticFeedback('heavy');
    if (money < PHONE_PRICE) return;
    
    const newMoney = money - PHONE_PRICE;
    const newCount = phoneCount + 1; 
    
    const success = await saveProgress({ money: newMoney, phone_count: newCount });
    if (success) {
      setMoney(newMoney); setPhoneCount(newCount); 
      showNotification("Телефон куплен! Он в сумке.");
    }
  };

  const handleSellToGame = async () => {
    hapticFeedback('heavy');
    if (phoneCount <= 0) return;
    
    const sellPrice = Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER);
    const newMoney = money + sellPrice;
    const newCount = phoneCount - 1; 
    
    const success = await saveProgress({ money: newMoney, phone_count: newCount });
    if (success) {
      setMoney(newMoney); setPhoneCount(newCount); 
      showNotification(`Сдан за ${sellPrice} монет.`);
    }
  };

  const handleConfirmSellToMarket = async () => {
    hapticFeedback('medium');
    if (phoneCount <= 0 || !playerId) return;
    const price = Number(sellPriceInput);
    if (isNaN(price) || price <= 0) return showNotification("Некорректная цена!", true);

    setIsSellModalOpen(false);
    const { error } = await supabase.from('market_items').insert([{ seller_id: playerId, seller_name: nickname, item_type: 'phone', price: price }]);
    
    if (!error) {
      const newCount = phoneCount - 1;
      await saveProgress({ phone_count: newCount });
      setPhoneCount(newCount); 
      showNotification("Выставлено на рынок!"); 
      setActiveTab('market');
    }
  };

  const handleBuyLot = async (lotId: string) => {
    hapticFeedback('heavy');
    const { data }: any = await supabase.rpc('buy_market_item', { buyer_id: playerId, lot_id: lotId });
    if (!data) { showNotification("Не хватает денег или лот продан!", true); } 
    else { 
      showNotification("Покупка успешна! Телефон в сумке."); 
      // Обновляем данные из базы после покупки
      await loadPlayerData();
      setActiveTab('market'); 
    }
  };

  const handleBuyBusiness = async () => {
    hapticFeedback('heavy');
    if (money < BUSINESS_PRICE) return showNotification("Нужно 10 000 монет!", true);
    if (myBusiness) return showNotification("У тебя уже есть бизнес!", true);

    const newMoney = money - BUSINESS_PRICE;
    
    const success = await saveProgress({ money: newMoney });
    if (success) {
      setMoney(newMoney);
      const { error }: any = await supabase.from('businesses').insert([{
        owner_id: playerId, owner_name: nickname, worker_id: null
      }]);

      if (error) {
        showNotification("Ошибка БД: " + error.message, true);
      } else {
        showNotification("Кофейня открыта!"); 
        // Подгружаем бизнесы заново
        const { data }: any = await supabase.from('businesses').select('*');
        if (data) {
          setAllBusinesses(data);
          setMyBusiness(data.find((b: any) => b.owner_id === playerId) || null);
        }
      }
    }
  };

  const handleCollectIncome = async () => {
    if (!myBusiness) return;
    const { data, error }: any = await supabase.rpc('collect_business_income', { biz_id: myBusiness.id });
    if (error) {
      showNotification("Ошибка сбора: " + error.message, true);
    } else if (data > 0) {
      const newMoney = money + data;
      await saveProgress({ money: newMoney });
      setMoney(newMoney);
      showNotification(`Собрано ${data} монет (пассивка)!`);
    } else {
      showNotification("Нет прибыли или нет сотрудника.", true);
    }
  };

  const handleHireWorker = async (bizId: string, workerId: string, workerName: string) => {
    hapticFeedback('medium');
    await supabase.from('businesses').update({ worker_id: workerId, worker_name: workerName }).eq('id', bizId);
    showNotification("Сотрудник нанят!");
    
    // Обновляем список вакансий
    const { data }: any = await supabase.from('businesses').select('*');
    if (data) {
      setAllBusinesses(data);
      setMyBusiness(data.find((b: any) => b.owner_id === playerId) || null);
      setMyJob(data.find((b: any) => b.worker_id === playerId) || null);
    }
  };

  const handleFireWorker = async () => {
    if (!myBusiness) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', myBusiness.id);
    showNotification("Сотрудник уволен.");
    
    const { data }: any = await supabase.from('businesses').select('*');
    if (data) {
      setAllBusinesses(data);
      setMyBusiness(data.find((b: any) => b.owner_id === playerId) || null);
    }
  };

  const handleWorkShift = async () => {
    hapticFeedback('medium');
    if (!myJob) return;
    if (energy < 20) return showNotification("Ты устал!", true);

    const newEnergy = Math.max(0, energy - 20);
    const newMoney = money + WORKER_SALARY;
    
    const success = await saveProgress({ energy: newEnergy, money: newMoney });
    if (success) {
      setEnergy(newEnergy); setMoney(newMoney);
      
      const { data: ownerData }: any = await supabase.from('players').select('money').eq('id', myJob.owner_id).single();
      if (ownerData) {
        await supabase.from('players').update({ money: ownerData.money + WORKER_BONUS_TO_OWNER }).eq('id', myJob.owner_id);
      }
      showNotification(`Ты заработал ${WORKER_SALARY} монет за смену!`);
    }
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
        <button onClick={handleRegister} style={{ fontSize: 18, padding: 15, width: '250px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', borderRadius: 10, fontWeight: 'bold' }}>Начать</button>
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
              <button onClick={handleConfirmSellToMarket} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 'bold' }}>Выставить</button>
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
          <button onClick={handleWork} style={{ fontSize: 18, padding: 16, width: '320px', cursor: phoneCount > 0 ? 'pointer' : 'not-allowed', backgroundColor: phoneCount > 0 ? '#10b981' : '#333', color: phoneCount > 0 ? 'white' : '#888', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>Работать (💰+500, ⚡-20)</button>
          <button onClick={handleWorkJanitor} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: '#f59e0b', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>Дворником (💰+200, ⚡-20)</button>
          <button onClick={handleRest} disabled={timeLeft > 0} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: timeLeft > 0 ? '#333' : '#3b82f6', color: timeLeft > 0 ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>{timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть'}</button>
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
              <button onClick={handleCollectIncome} style={{ fontSize: 16, padding: 15, width: '100%', backgroundColor: '#10b981', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none', marginBottom: 10 }}>Собрать пассивный доход</button>
              {myBusiness.worker_id ? (
                <button onClick={handleFireWorker} style={{ fontSize: 14, padding: 12, width: '100%', backgroundColor: '#ef4444', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>Уволить сотрудника</button>
              ) : <p style={{ color: '#fbbf24', fontSize: 14 }}>Найди сотрудника в списке ниже!</p>}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
              <h3>Открыть Кофейню</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa' }}>Бизнес приносит пассивный доход, если в нем есть сотрудник.</p>
              <button onClick={handleBuyBusiness} disabled={money < BUSINESS_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', backgroundColor: money < BUSINESS_PRICE ? '#333' : '#8b5cf6', color: money < BUSINESS_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10, border: 'none' }}>
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
                    <button onClick={() => handleHireWorker(b.id, playerId!, nickname)} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold' }}>Устроиться</button>
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
                <button onClick={handleWorkShift} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: 16 }}>
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
            {phoneCount > 0 ? <div style={{ color: '#10b981', fontWeight: 'bold' }}>✅ У тебя уже есть {phoneCount} шт.</div> : null}
            <button onClick={handleBuyPhone} disabled={money < PHONE_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', backgroundColor: money < PHONE_PRICE ? '#333' : '#8b5cf6', color: money < PHONE_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10, border: 'none' }}>
              {money < PHONE_PRICE ? 'Мало денег' : `Купить еще за 💰 ${PHONE_PRICE}`}
            </button>
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
                    <button onClick={() => handleBuyLot(item.id)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>Купить</button>
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
            {phoneCount > 0 ? (
              <div style={{ backgroundColor: '#1e1e24', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: 32 }}>📱</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон <b style={{color: '#3b82f6'}}>x{phoneCount}</b></div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setIsSellModalOpen(true)} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14, width: '100%' }}>Выставить 1 шт. на рынок</button>
                  <button onClick={handleSellToGame} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14, width: '100%' }}>Сдать 1 шт. в ломбард (+{Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER)})</button>
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