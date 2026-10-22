import { useState, useEffect } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { 
  Smartphone, Coins, Zap, Briefcase, Globe, Store, Backpack, 
  Home, Coffee, Users, ShieldAlert, CheckCircle2, Settings, Trash2, Lock
} from 'lucide-react';

const PHONE_PRICE = 2000;
const SELL_TO_GAME_MULTIPLIER = 0.7; 
const ENERGY_COOLDOWN_MS = 60000; 
const BUSINESS_PRICE = 10000; 
const WORKER_SALARY = 300; 
const WORKER_BONUS_TO_OWNER = 100; 
const ADMIN_SECRET_CODE = "admin2026"; 

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

  const [clickCount, setClickCount] = useState(0);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false); 
  const [isAdminOpen, setIsAdminOpen] = useState(false); 
  const [authInput, setAuthInput] = useState('');

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
    setNotifColor(isError ? '#ef4444' : '#10b981');
    setTimeout(() => setNotification(null), 3000);
  };

  const getUniqueId = () => {
    if (user?.id) return user.id.toString();
    let browserId = localStorage.getItem('zhituha_browser_id');
    if (!browserId) {
      browserId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('zhituha_browser_id', browserId);
    }
    return browserId;
  };

  const loadPlayerData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const tgId = getUniqueId(); 
      const { data, error }: any = await supabase.from('players').select('*').eq('telegram_id', tgId).maybeSingle();
      
      if (error) throw error;

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
    } catch (e: any) {
      if (!silent) showNotification("Ошибка загрузки: " + e.message, true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const loadMarketData = async () => {
    try {
      const { data: players, error: err1 }: any = await supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10);
      if (err1) throw err1;
      if (players) setGlobalPlayers(players);

      const { data: lots, error: err2 }: any = await supabase.from('market_items').select('*').order('created_at', { ascending: false });
      if (err2) throw err2;
      if (lots) setMarketItems(lots);
    } catch (e: any) {
      showNotification("Ошибка рынка: " + e.message, true);
    }
  };

  useEffect(() => { loadPlayerData(); }, [user]);

  useEffect(() => {
    if (activeTab === 'market') loadMarketData();
    if (activeTab === 'business' || activeTab === 'home') loadPlayerData(true); 
  }, [activeTab, playerId]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

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

  const saveProgress = async (newData: Record<string, unknown>) => {
    if (!playerId) return false;
    const { error } = await supabase.from('players').update(newData).eq('id', playerId);
    if (error) { showNotification("Ошибка БД: " + error.message, true); return false; }
    return true;
  };

  const handleAvatarClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setIsAdminAuthOpen(true);
      setClickCount(0);
      setAuthInput('');
      hapticFeedback('heavy');
    }
    setTimeout(() => setClickCount(0), 2000);
  };

  const handleAuthSubmit = () => {
    if (authInput === ADMIN_SECRET_CODE) {
      setIsAdminAuthOpen(false);
      setIsAdminOpen(true);
      hapticFeedback('medium');
    } else {
      showNotification("Неверный код!", true);
      setAuthInput('');
    }
  };

  const handleRegister = async () => {
    hapticFeedback('medium');
    if (inputName.trim() === '') return showNotification('Введи никнейм!', true);
    if (!selectedGender) return showNotification('Выбери пол!', true);

    setIsLoading(true);
    const tgId = getUniqueId();
    const { data, error }: any = await supabase.from('players').insert([{
      telegram_id: tgId, nickname: inputName, gender: selectedGender, money: 3500, energy: 80, phone_count: 0, last_rest_time: 0
    }]).select().single();

    if (error) { 
      showNotification("Ошибка базы: " + error.message, true); 
      setIsLoading(false);
    } else if (data) { 
      setPlayerId(data.id); setNickname(inputName); setGender(selectedGender); 
      setIsLoading(false);
    }
  };

  const handleWork = async () => {
    if (isSaving || !hasPhone || energy < 20) return;
    setIsSaving(true); hapticFeedback('medium');
    
    const newMoney = Number(money) + 500;
    const newEnergy = Math.max(0, Number(energy) - 20);
    setMoney(newMoney); setEnergy(newEnergy);
    
    const success = await saveProgress({ money: newMoney, energy: newEnergy });
    if (success) showNotification("Работа +500");
    else { setMoney(money); setEnergy(energy); }

    setIsSaving(false);
  };

  const handleWorkJanitor = async () => {
    if (isSaving || energy < 20) return;
    setIsSaving(true); hapticFeedback('light');
    
    const newMoney = Number(money) + 200;
    const newEnergy = Math.max(0, Number(energy) - 20);
    setMoney(newMoney); setEnergy(newEnergy);
    
    const success = await saveProgress({ money: newMoney, energy: newEnergy });
    if (success) showNotification("Подработка +200");
    else { setMoney(money); setEnergy(energy); }
    
    setIsSaving(false);
  };

  const handleRest = async () => {
    if (isSaving || timeLeft > 0 || energy === 100) return;
    setIsSaving(true); hapticFeedback('light');
    
    const now = Date.now();
    setEnergy(100); setTimeLeft(ENERGY_COOLDOWN_MS / 1000);
    
    const success = await saveProgress({ energy: 100, last_rest_time: now });
    if (success) showNotification("Энергия восстановлена!");
    else { setEnergy(energy); setTimeLeft(0); }
    
    setIsSaving(false);
  };

  const handleBuyPhone = async () => {
    if (isSaving || money < PHONE_PRICE) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const newMoney = Number(money) - PHONE_PRICE;
    setMoney(newMoney); setHasPhone(true);
    
    const success = await saveProgress({ money: newMoney, phone_count: 1 });
    if (success) showNotification("Телефон куплен!");
    else { setMoney(money); setHasPhone(false); }
    
    setIsSaving(false);
  };

  const handleSellToGame = async () => {
    if (isSaving || !hasPhone) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const sellPrice = Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER);
    const newMoney = Number(money) + sellPrice;
    setMoney(newMoney); setHasPhone(false);
    
    const success = await saveProgress({ money: newMoney, phone_count: 0 });
    if (success) showNotification(`Сдан за ${sellPrice}`);
    else { setMoney(money); setHasPhone(true); }
    
    setIsSaving(false);
  };

  const handleConfirmSellToMarket = async () => {
    if (isSaving || !hasPhone || !playerId) return;
    const price = Number(sellPriceInput);
    if (isNaN(price) || price <= 0) return showNotification("Некорректная цена!", true);
    
    setIsSaving(true); hapticFeedback('medium');
    setHasPhone(false);
    
    const { error } = await supabase.from('market_items').insert([{ seller_id: playerId, seller_name: nickname, item_type: 'phone', price: price }]);
    
    if (!error) {
      await saveProgress({ phone_count: 0 });
      setIsSellModalOpen(false); setActiveTab('market'); showNotification("Выставлено!");
    } else {
      setHasPhone(true); showNotification("Ошибка выставления", true);
    }
    setIsSaving(false);
  };

  const handleBuyLot = async (item: MarketItem) => {
    if (isSaving || money < item.price) return showNotification("Мало денег!", true);
    setIsSaving(true); hapticFeedback('heavy');
    
    const newMoney = Number(money) - item.price;
    setMoney(newMoney);
    
    try {
      // ФИКС ОШИБКИ TS6133: добавил _ перед buyerRes и deleteRes
      const [_, sellerRes, _buyerRes, _deleteRes] = await Promise.all([
        supabase.from('players').update({ money: newMoney }).eq('id', playerId),
        supabase.from('players').select('money').eq('id', item.seller_id).single(),
        supabase.from('players').update({ phone_count: 1 }).eq('id', playerId),
        supabase.from('market_items').delete().eq('id', item.id)
      ]);

      if (sellerRes.error) throw sellerRes.error;
      if (sellerRes.data) {
        await supabase.from('players').update({ money: Number(sellerRes.data.money) + item.price }).eq('id', item.seller_id);
      }

      setHasPhone(true);
      await loadPlayerData(true);
      setActiveTab('market'); 
      showNotification("Покупка успешна!");
    } catch (e: any) { 
      setMoney(money);
      showNotification("Ошибка: " + e.message, true); 
    }
    setIsSaving(false);
  };

  const handleBuyBusiness = async () => {
    if (isSaving || money < BUSINESS_PRICE || myBusiness) return;
    setIsSaving(true); hapticFeedback('heavy');
    
    const newMoney = Number(money) - BUSINESS_PRICE;
    setMoney(newMoney);
    
    const success = await saveProgress({ money: newMoney });
    if (success) {
      const { error } = await supabase.from('businesses').insert([{ owner_id: playerId, owner_name: nickname, worker_id: null }]);
      if (error) {
        showNotification("Ошибка БД: " + error.message, true);
        setMoney(money);
      } else {
        await loadPlayerData(true); 
        showNotification("Кофейня открыта!");
      }
    } else {
      setMoney(money);
    }
    setIsSaving(false);
  };

  const handleCollectIncome = async () => {
    if (isSaving || !myBusiness || pendingIncome <= 0) return;
    setIsSaving(true); hapticFeedback('medium');
    
    const incomeToCollect = pendingIncome;
    const newMoney = Number(money) + incomeToCollect;
    
    setMoney(newMoney);
    setPendingIncome(0);
    
    const success = await saveProgress({ money: newMoney });
    if (success) {
      await supabase.from('businesses').update({ last_collected: new Date().toISOString() }).eq('id', myBusiness.id);
      showNotification(`Собрано ${incomeToCollect}`);
      await loadPlayerData(true); 
    } else {
      setMoney(money);
    }
    setIsSaving(false);
  };

  const handleHireWorker = async (bizId: string, workerId: string, workerName: string) => {
    if (isSaving) return;
    setIsSaving(true); hapticFeedback('medium');
    
    await supabase.from('businesses').update({ worker_id: workerId, worker_name: workerName, last_collected: new Date().toISOString() }).eq('id', bizId);
    await loadPlayerData(true); 
    showNotification("Нанят!"); 
    setIsSaving(false);
  };

  const handleFireWorker = async () => {
    if (isSaving || !myBusiness) return;
    setIsSaving(true);
    
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', myBusiness.id);
    await loadPlayerData(true); 
    showNotification("Уволен."); 
    setIsSaving(false);
  };

  const handleWorkShift = async () => {
    if (isSaving || !myJob || energy < 20) return;
    setIsSaving(true); hapticFeedback('medium');
    
    const newEnergy = Math.max(0, Number(energy) - 20);
    const newMoney = Number(money) + WORKER_SALARY;
    
    setEnergy(newEnergy); setMoney(newMoney);
    
    const success = await saveProgress({ energy: newEnergy, money: newMoney });
    if (success) {
      const { data: ownerData } = await supabase.from('players').select('money').eq('id', myJob.owner_id).single();
      if (ownerData) await supabase.from('players').update({ money: Number(ownerData.money) + WORKER_BONUS_TO_OWNER }).eq('id', myJob.owner_id);
      showNotification(`Заработано ${WORKER_SALARY}`);
    } else {
      setEnergy(energy); setMoney(money);
    }
    setIsSaving(false);
  };

  const adminGiveMoney = async () => {
    hapticFeedback('heavy');
    const newMoney = Number(money) + 100000;
    setMoney(newMoney);
    if (await saveProgress({ money: newMoney })) {
      showNotification("Админ: +100 000 монет");
      setIsAdminOpen(false);
    } else {
      setMoney(money);
    }
  };

  const adminResetGame = async () => {
    if (!window.confirm("ВНИМАНИЕ! Это удалит ВСЕХ игроков, лоты и бизнесы. Уверен?")) return;
    hapticFeedback('heavy');
    setIsLoading(true);

    try {
      await supabase.from('market_items').delete().gte('created_at', '2000-01-01');
      await supabase.from('businesses').delete().gte('created_at', '2000-01-01');
      await supabase.from('players').delete().gte('created_at', '2000-01-01');
      
      localStorage.removeItem('zhituha_browser_id');
      window.location.reload();
    } catch (e: any) {
      showNotification("Ошибка сброса: " + e.message, true);
      setIsLoading(false);
    }
  };

  const cardStyle = { 
    backgroundColor: 'rgba(30, 30, 36, 0.8)', backdropFilter: 'blur(10px)',
    color: 'white', padding: 20, borderRadius: 20, margin: '0 auto 20px auto', 
    maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, 
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)'
  };

  const btnPrimary = { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    fontSize: 16, padding: 16, width: '320px', cursor: 'pointer', 
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
    color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', 
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s'
  };

  const btnSecondary = { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    fontSize: 16, padding: 16, width: '320px', cursor: 'pointer', 
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
    color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', 
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', transition: 'transform 0.1s'
  };

  if (isLoading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка...</div>;

  if (!nickname || !gender) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
        {notification && <div style={{ position: 'fixed', top: 20, backgroundColor: notifColor, padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000 }}>{notification}</div>}
        <h1>Житуха</h1>
        <p style={{ color: '#888', marginBottom: '30px' }}>Создай своего персонажа</p>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <button onClick={() => setSelectedGender('male')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selectedGender === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>🧑</button>
          <button onClick={() => setSelectedGender('female')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selectedGender === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>👩</button>
        </div>
        <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="Твой ник..." style={{ fontSize: 18, padding: 15, marginBottom: 20, width: '280px', borderRadius: 12, backgroundColor: '#1e1e24', color: 'white', border: '1px solid #333', textAlign: 'center', outline: 'none' }} />
        <button onClick={handleRegister} disabled={isSaving} style={{ ...btnPrimary, width: '280px' }}>Начать жизнь</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 20px 90px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
      
      {notification && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: notifColor, color: 'white', padding: '15px 25px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>{notification}</div>
      )}

      {isAdminAuthOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20 }}>
          <div style={{ backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #333', textAlign: 'center' }}>
            <Lock size={40} color="#f59e0b" style={{ marginBottom: 15 }} />
            <h3 style={{ marginTop: 0, fontSize: 20 }}>Код доступа</h3>
            <input type="password" value={authInput} onChange={(e) => setAuthInput(e.target.value)} placeholder="••••••" style={{ width: '100%', padding: 12, borderRadius: 8, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center', fontSize: 18, marginBottom: 15, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsAdminAuthOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#333', color: 'white', border: 'none', fontWeight: 'bold' }}>Отмена</button>
              <button onClick={handleAuthSubmit} style={{ flex: 1, padding: 12, borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', border: 'none', fontWeight: 'bold' }}>Войти</button>
            </div>
          </div>
        </div>
      )}

      {isAdminOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20 }}>
          <div style={{ backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #ef4444', boxShadow: '0 0 40px rgba(239, 68, 68, 0.2)' }}>
            <h3 style={{ marginTop: 0, fontSize: 22, textAlign: 'center', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Settings size={24} /> ADMIN PANEL
            </h3>
            <button onClick={adminGiveMoney} style={{ ...btnPrimary, width: '100%', marginBottom: 10, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: 'none' }}>
              <Coins size={20} /> Выдать 100 000 монет
            </button>
            <button onClick={adminResetGame} style={{ ...btnPrimary, width: '100%', marginBottom: 15, background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: 'none' }}>
              <Trash2 size={20} /> Полный сброс игры
            </button>
            <button onClick={() => setIsAdminOpen(false)} style={{ width: '100%', padding: 14, borderRadius: 12, backgroundColor: '#333', color: 'white', border: 'none', fontWeight: 'bold' }}>Закрыть</button>
          </div>
        </div>
      )}

      {isSellModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500, padding: 20 }}>
          <div style={{ backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, fontSize: 22, textAlign: 'center' }}>Продажа</h3>
            <input type="number" value={sellPriceInput} onChange={(e) => setSellPriceInput(e.target.value)} style={{ width: '100%', padding: 15, borderRadius: 12, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center', fontSize: 18, marginBottom: 20, boxSizing: 'border-box', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsSellModalOpen(false)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#333', color: 'white', border: 'none', fontWeight: 'bold' }}>Отмена</button>
              <button onClick={handleConfirmSellToMarket} disabled={isSaving} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', border: 'none', fontWeight: 'bold' }}>Выставить</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '350px', margin: '0 auto', paddingBottom: 15, marginBottom: 20 }}>
        <h2 onClick={handleAvatarClick} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
          {user?.photo_url ? (
            <img src={user.photo_url} alt="avatar" style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #3b82f6', pointerEvents: 'none' }} />
          ) : (
            <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333', pointerEvents: 'none' }}>
              {gender === 'male' ? '🧑' : '👩'}
            </div>
          )}
          {nickname}
        </h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e1e24 0%, #121212 100%)', padding: '15px 25px', borderRadius: '16px', maxWidth: '350px', margin: '0 auto 25px auto', border: '1px solid #333', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 18, fontWeight: 'bold' }}>
          <Coins size={22} color="#fbbf24" /> {money}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 18, fontWeight: 'bold' }}>
          <Zap size={22} color="#3b82f6" /> {energy}/100
        </div>
      </div>

      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          {!hasPhone && (
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 12, padding: 15, maxWidth: '320px', margin: '0 auto 10px auto', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '10px', fontSize: 14 }}>
              <ShieldAlert size={20} /> У тебя нет телефона. Купи его в магазине!
            </div>
          )}
          <button onClick={handleWork} disabled={isSaving || !hasPhone || energy < 20} style={{ ...btnPrimary, opacity: (isSaving || !hasPhone || energy < 20) ? 0.5 : 1, cursor: (isSaving || !hasPhone || energy < 20) ? 'not-allowed' : 'pointer' }}>
            <Briefcase size={20} /> Работать (+500)
          </button>
          <button onClick={handleWorkJanitor} disabled={isSaving || energy < 20} style={{ ...btnSecondary, opacity: (isSaving || energy < 20) ? 0.5 : 1, cursor: (isSaving || energy < 20) ? 'not-allowed' : 'pointer' }}>
            <Users size={20} /> Дворником (+200)
          </button>
          <button onClick={handleRest} disabled={isSaving || timeLeft > 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '320px', cursor: (isSaving || timeLeft > 0) ? 'not-allowed' : 'pointer', backgroundColor: timeLeft > 0 ? '#333' : '#1e1e24', color: timeLeft > 0 ? '#888' : 'white', borderRadius: 14, fontWeight: 'bold', border: '1px solid #333', transition: '0.2s' }}>
            <Zap size={20} color={timeLeft > 0 ? '#888' : '#3b82f6'} /> {timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть (Полная энергия)'}
          </button>
        </div>
      )}

      {activeTab === 'business' && (
        <div>
          <h2 style={{ marginBottom: 20 }}>Бизнес</h2>
          {myBusiness ? (
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 24, fontWeight: 'bold', marginBottom: 15 }}>
                <Coffee size={28} color="#d97706" /> Кофейня
              </div>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0' }}>Владелец: <b>Ты</b></p>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0' }}>Сотрудник: <b style={{ color: '#3b82f6' }}>{myBusiness.worker_name || 'Нет'}</b></p>
              
              {myBusiness.worker_id ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 12, marginTop: 15, marginBottom: 15, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#10b981' }}>Доход: 100 монет / мин</p>
                  <p style={{ margin: 0, fontSize: 22, color: '#10b981', fontWeight: 'bold' }}>
                    В кассе: {pendingIncome} <Coins size={18} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </p>
                </div>
              ) : (
                <p style={{ color: '#fbbf24', fontSize: 14, marginTop: 15 }}>Найми сотрудника, чтобы бизнес приносил доход!</p>
              )}

              <button onClick={handleCollectIncome} disabled={isSaving || pendingIncome <= 0} style={{ ...btnPrimary, width: '100%', opacity: (isSaving || pendingIncome <= 0) ? 0.5 : 1 }}>
                Собрать доход
              </button>

              {myBusiness.worker_id && (
                <button onClick={handleFireWorker} disabled={isSaving} style={{ marginTop: 10, fontSize: 14, padding: 12, width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, fontWeight: 'bold' }}>Уволить</button>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}><Store size={48} color="#8b5cf6" /></div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 22 }}>Открыть Кофейню</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 20 }}>Бизнес приносит пассивный доход, если в нем есть сотрудник.</p>
              <button onClick={handleBuyBusiness} disabled={isSaving || money < BUSINESS_PRICE} style={{ ...btnSecondary, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', width: '100%', opacity: money < BUSINESS_PRICE ? 0.5 : 1 }}>
                {money < BUSINESS_PRICE ? 'Мало денег' : `Открыть за 10 000`}
              </button>
            </div>
          )}

          {!myJob && (
            <div style={{ marginTop: 30 }}>
              <h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Свободные вакансии</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
                {allBusinesses.filter(b => !b.worker_id && b.owner_id !== playerId).map(b => (
                  <div key={b.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Coffee size={16}/> Кофейня</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div>
                    </div>
                    <button onClick={() => handleHireWorker(b.id, playerId!, nickname)} disabled={isSaving} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>Устроиться</button>
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
              <h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Моя работа</h3>
              <div style={{ backgroundColor: '#1e1e24', padding: 20, borderRadius: 16, border: '1px solid #333', maxWidth: '350px', margin: '0 auto' }}>
                <p style={{ margin: '0 0 15px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: '8px' }}><Coffee size={18} /> Кофейня (Владелец: {myJob.owner_name})</p>
                <button onClick={handleWorkShift} disabled={isSaving || energy < 20} style={{ ...btnPrimary, width: '100%', opacity: (isSaving || energy < 20) ? 0.5 : 1 }}>
                  Смена (+{WORKER_SALARY})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'shop' && (
        <div>
          <h2 style={{ marginBottom: 20 }}>Гос. Магазин</h2>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}><Smartphone size={48} color="#a1a1aa" /></div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 22 }}>Смартфон</h3>
            <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>Необходим для поиска нормальной работы.</p>
            {hasPhone ? (
              <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><CheckCircle2 size={20} /> Куплено</div>
            ) : (
              <button onClick={handleBuyPhone} disabled={isSaving || money < PHONE_PRICE} style={{ ...btnSecondary, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', width: '100%', opacity: money < PHONE_PRICE ? 0.5 : 1 }}>
                Купить за 2000
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div>
          <h2 style={{ marginBottom: 20 }}>Барахолка</h2>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '350px', margin: '0 auto' }}>
              {globalPlayers.map((p, index) => (
                <div key={p.id} style={{ backgroundColor: '#1e1e24', padding: '12px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 14, fontWeight: 'bold', color: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : '#a1a1aa' }}>#{index + 1}</span>
                    <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>{p.money} <Coins size={14} /></span>
                </div>
              ))}
            </div>
          </div>
          <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Лоты игроков</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
            {marketItems.length === 0 && <p style={{ color: '#666' }}>Никто ничего не продает...</p>}
            {marketItems.map((item) => (
              <div key={item.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={18} /> Смартфон</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Продавец: {item.seller_name}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price}</span>
                  {item.seller_id !== playerId ? (
                    <button onClick={() => handleBuyLot(item)} disabled={isSaving} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>Купить</button>
                  ) : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <h2 style={{ marginBottom: 20 }}>Инвентарь</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '350px', margin: '0 auto' }}>
            {hasPhone ? (
              <div style={{ backgroundColor: '#1e1e24', padding: 20, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <Smartphone size={32} color="#a1a1aa" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => setIsSellModalOpen(true)} disabled={isSaving} style={{ ...btnSecondary, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', width: '100%', padding: 14, fontSize: 14 }}>Выставить на рынок</button>
                  <button onClick={handleSellToGame} disabled={isSaving} style={{ ...btnPrimary, width: '100%', padding: 14, fontSize: 14 }}>Сдать в ломбард (+{Math.floor(PHONE_PRICE * SELL_TO_GAME_MULTIPLIER)})</button>
                </div>
              </div>
            ) : <div style={{ color: '#52525b', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }}/><br/>Пусто...</div>}
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(30, 30, 36, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        <button onClick={() => { setActiveTab('home'); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: activeTab === 'home' ? '#3b82f6' : '#a1a1aa' }}>
          <Home size={22} style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'home' ? 'bold' : 'normal' }}>Главная</span>
        </button>
        <button onClick={() => { setActiveTab('business'); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: activeTab === 'business' ? '#3b82f6' : '#a1a1aa' }}>
          <Briefcase size={22} style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'business' ? 'bold' : 'normal' }}>Бизнес</span>
        </button>
        <button onClick={() => { setActiveTab('market'); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: activeTab === 'market' ? '#3b82f6' : '#a1a1aa' }}>
          <Globe size={22} style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'market' ? 'bold' : 'normal' }}>Рынок</span>
        </button>
        <button onClick={() => { setActiveTab('shop'); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: activeTab === 'shop' ? '#3b82f6' : '#a1a1aa' }}>
          <Store size={22} style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'shop' ? 'bold' : 'normal' }}>Магазин</span>
        </button>
        <button onClick={() => { setActiveTab('inventory'); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: activeTab === 'inventory' ? '#3b82f6' : '#a1a1aa' }}>
          <Backpack size={22} style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: activeTab === 'inventory' ? 'bold' : 'normal' }}>Сумка</span>
        </button>
      </div>
    </div>
  );
}

export default App;