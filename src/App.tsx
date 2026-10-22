import { useState, useEffect, useRef } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { 
  Smartphone, Coins, Zap, Briefcase, Globe, Store, Backpack, 
  Home, Coffee, Users, CheckCircle2, Settings, Trash2, Lock, User
} from 'lucide-react';

// --- КОНСТАНТЫ ИГРЫ ---
const PHONE_PRICE = 2000;
const BUSINESS_PRICE = 10000;
const WORKER_SALARY = 300;
const COFFEE_PRICE = 500;
const ADMIN_CODE = "admin2026";
const REST_COOLDOWN_MS = 90000; 
const BREW_TIME_MS = 15000; 
const POLL_INTERVAL_MS = 5000; 

// --- СТИЛИ ---
const S = {
  card: { backgroundColor: 'rgba(30, 30, 36, 0.8)', backdropFilter: 'blur(10px)', color: 'white', padding: 20, borderRadius: 20, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', transition: '0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', transition: '0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)', transition: '0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)', transition: '0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: 'none', transition: '0.1s' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20 },
  modalBox: { backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #333', textAlign: 'center' as const },
  input: { width: '100%', padding: 15, borderRadius: 12, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center' as const, fontSize: 18, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none' }
};

interface Player { id: string; nickname: string; money: number; }
interface MarketItem { id: string; seller_id: string; seller_name: string; item_type: string; price: number; }
interface Business { id: string; owner_id: string; owner_name: string; worker_id: string | null; worker_name: string | null; coffee_balance?: number; }

export default function App() {
  const { user, hapticFeedback } = useTelegram();

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [pid, setPid] = useState<string | null>(null);
  const [tgId, setTgId] = useState<string>('');
  const [toast, setToast] = useState<{msg: string, err: boolean} | null>(null);
  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business' | 'jobs' | 'cafe'>('home');

  const [nick, setNick] = useState('');
  const [inputNick, setInputNick] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selGender, setSelGender] = useState<'male' | 'female' | null>(null);
  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phone, setPhone] = useState(false);
  
  const [restEndTime, setRestEndTime] = useState(0);
  const [brewEndTime, setBrewEndTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [brewTimeLeft, setBrewTimeLeft] = useState(0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [job, setJob] = useState<Business | null>(null);
  const [allBiz, setAllBiz] = useState<Business[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Business | null>(null);
  const [isJobBoardOpen, setIsJobBoardOpen] = useState(false);

  // Модалка для увольнения
  const [isQuitModalOpen, setIsQuitModalOpen] = useState(false);

  const [clicks, setClicks] = useState(0);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPanel, setAdminPanel] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  const [sellModal, setSellModal] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');

  const lockRef = useRef(false);

  const showMsg = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const getUid = () => {
    if (user?.id) return user.id.toString();
    let bid = localStorage.getItem('zhituha_id');
    if (!bid) { bid = 'user_' + Math.random().toString(36).substring(2, 8); localStorage.setItem('zhituha_id', bid); }
    return bid;
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (lockRef.current) return; 

    try {
      const uid = getUid();
      setTgId(uid);

      const { data }: any = await supabase.from('players').select('*').eq('telegram_id', uid).maybeSingle();
      if (data) {
        setPid(data.id); setNick(data.nickname); setGender(data.gender);
        setMoney(Number(data.money)); setEnergy(Number(data.energy));
        setPhone(Number(data.phone_count) > 0);
        
        const now = Date.now();
        const lastRest = Number(data.last_rest_time) || 0;
        if (lastRest + REST_COOLDOWN_MS > now) setRestEndTime(lastRest + REST_COOLDOWN_MS);
        else setRestEndTime(0);

        const { data: bData }: any = await supabase.from('businesses').select('*');
        if (bData) {
          setAllBiz(bData);
          setBiz(bData.find((b: any) => b.owner_id === data.id) || null);
          setJob(bData.find((b: any) => b.worker_id === data.id) || null);
        }
      } else if (user?.first_name) {
        setInputNick(user.first_name);
      }
    } catch (e) {
      console.error(e);
      if (!silent) showMsg("Ошибка сети", true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMarket = async () => {
    const { data: p }: any = await supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10);
    if (p) setPlayers(p);
    const { data: m }: any = await supabase.from('market_items').select('*').order('created_at', { ascending: false });
    if (m) setMarket(m);
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => { 
    if (tab === 'market') loadMarket(); 
    let interval: any;
    if (tab === 'business' || tab === 'jobs' || tab === 'home' || tab === 'cafe') {
      interval = setInterval(() => { loadData(true); }, POLL_INTERVAL_MS);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [tab]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (restEndTime > 0) {
        const rem = Math.max(0, Math.ceil((restEndTime - now) / 1000));
        setTimeLeft(rem);
        if (rem === 0) setRestEndTime(0);
      }
      if (brewEndTime > 0) {
        const rem = Math.max(0, Math.ceil((brewEndTime - now) / 1000));
        setBrewTimeLeft(rem);
        if (rem === 0) {
          setBrewEndTime(0);
          setEnergy(100);
          if (pid) supabase.from('players').update({ energy: 100 }).eq('id', pid);
          showMsg("Кофе готов! Энергия восстановлена!");
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [restEndTime, brewEndTime, pid]);

  const safeSyncPlayer = async (updates: any) => {
    if (!pid) return false;
    const { error } = await supabase.from('players').update(updates).eq('id', pid);
    if (error) { showMsg("Ошибка: " + error.message, true); return false; }
    return true;
  };

  const register = async () => {
    if (lockRef.current) return;
    const finalNick = user?.first_name || inputNick;
    if (!finalNick.trim() || !selGender) return showMsg("Выбери пол и ник!", true);
    
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');
    
    try {
      const { data, error }: any = await supabase.from('players').insert([{
        telegram_id: getUid(), nickname: finalNick, gender: selGender, money: 3500, energy: 80, phone_count: 0, last_rest_time: 0
      }]).select().single();
      
      if (error) showMsg("Ошибка БД: " + error.message, true);
      else if (data) { setPid(data.id); setNick(finalNick); setGender(selGender); }
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const doWork = async (isJanitor: boolean) => {
    if (lockRef.current || energy < 20 || (!phone && !isJanitor)) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');

    try {
      const addMoney = isJanitor ? 200 : 500;
      const nM = Number(money) + addMoney;
      const nE = Number(energy) - 20;
      
      setMoney(nM); setEnergy(nE);
      const success = await safeSyncPlayer({ money: nM, energy: nE });
      
      if (success) showMsg(`+${addMoney} монет`);
      else { setMoney(money); setEnergy(energy); }
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const doRest = async () => {
    if (lockRef.current || timeLeft > 0 || energy === 100) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('light');

    try {
      const now = Date.now();
      setEnergy(100); setRestEndTime(now + REST_COOLDOWN_MS);
      const success = await safeSyncPlayer({ energy: 100, last_rest_time: now });
      
      if (!success) { setEnergy(energy); setRestEndTime(0); }
      else showMsg("Энергия восстановлена!");
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const buyCoffee = async (cafe: Business) => {
    if (lockRef.current || !cafe.worker_id || money < COFFEE_PRICE || energy === 100) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('heavy');

    try {
      const nM = money - COFFEE_PRICE;
      setMoney(nM);
      await safeSyncPlayer({ money: nM });
      
      const { data: ownerBiz, error: fetchErr }: any = await supabase.from('businesses').select('coffee_balance').eq('id', cafe.id).single();
      if (ownerBiz && !fetchErr) {
        const currentBal = Number(ownerBiz.coffee_balance) || 0;
        await supabase.from('businesses').update({ coffee_balance: currentBal + 450 }).eq('id', cafe.id);
      }

      setBrewEndTime(Date.now() + BREW_TIME_MS);
      showMsg("Заказ принят! Кофе готовится...");
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const collectCoffeeIncome = async () => {
    if (lockRef.current || !biz || !biz.coffee_balance || biz.coffee_balance <= 0) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');
    
    try {
      const inc = biz.coffee_balance;
      const nM = money + inc;
      
      setMoney(nM);
      await safeSyncPlayer({ money: nM });
      await supabase.from('businesses').update({ coffee_balance: 0 }).eq('id', biz.id);
      
      showMsg(`Собрано ${inc} с продаж кофе!`);
      await loadData(true);
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const buyBusiness = async () => {
    if (lockRef.current || money < BUSINESS_PRICE || biz) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('heavy');
    
    try {
      const nM = money - BUSINESS_PRICE;
      setMoney(nM); 
      
      const success = await safeSyncPlayer({ money: nM });
      if (!success) throw new Error("Не удалось списать деньги");

      const { error } = await supabase.from('businesses').insert([{ 
        owner_id: pid, 
        owner_name: nick, 
        worker_id: null, 
        coffee_balance: 0 
      }]);

      if (error) {
        await safeSyncPlayer({ money: money });
        setMoney(money);
        showMsg("Ошибка создания: " + error.message, true);
      } else {
        showMsg("Кофейня открыта!");
        await loadData(true);
      }
    } catch (e: any) {
      setMoney(money);
      showMsg(e.message || "Ошибка", true);
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const hireWorker = async (bId: string) => {
    if (lockRef.current || job) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');
    
    try {
      await supabase.from('businesses').update({ worker_id: pid, worker_name: nick }).eq('id', bId);
      showMsg("Вы устроены!"); 
      setIsJobBoardOpen(false);
      await loadData(true);
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const fireWorker = async () => {
    if (lockRef.current || !biz) return;
    lockRef.current = true; setIsProcessing(true);
    
    try {
      await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', biz.id);
      showMsg("Вы уволили сотрудника."); 
      await loadData(true);
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  // УВОЛЬНЕНИЕ (ВЫЗЫВАЕТСЯ ИЗ МОДАЛКИ)
  const confirmQuitJob = async () => {
    if (lockRef.current || !job) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('heavy');

    try {
      await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', job.id);
      showMsg("Вы уволились.");
      setIsJobBoardOpen(false);
      setIsQuitModalOpen(false); // Закрываем модалку
      await loadData(true);
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const workShift = async () => {
    if (lockRef.current || !job || energy < 20) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');
    
    try {
      const nM = money + WORKER_SALARY;
      const nE = energy - 20;
      
      setMoney(nM); setEnergy(nE); showMsg(`+${WORKER_SALARY} за смену`);
      await safeSyncPlayer({ money: nM, energy: nE });
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const doPhone = async (buy: boolean) => {
    if (lockRef.current || (buy && money < PHONE_PRICE) || (!buy && !phone)) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('heavy');
    
    try {
      const nM = buy ? money - PHONE_PRICE : money + 1400;
      const nP = buy ? 1 : 0;
      
      setMoney(nM); setPhone(buy); showMsg(buy ? "Куплено!" : "Сдан за 1400");
      await safeSyncPlayer({ money: nM, phone_count: nP });
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const listPhone = async () => {
    const p = Number(sellPrice);
    if (lockRef.current || isNaN(p) || p <= 0 || !phone) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('medium');
    
    try {
      setPhone(false); setSellModal(false);
      const { error } = await supabase.from('market_items').insert([{ seller_id: pid, seller_name: nick, item_type: 'phone', price: p }]);
      
      if (error) { setPhone(true); showMsg("Ошибка", true); }
      else { await safeSyncPlayer({ phone_count: 0 }); setTab('market'); loadMarket(); showMsg("Выставлено!"); }
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const buyLot = async (item: MarketItem) => {
    if (lockRef.current || money < item.price) return;
    lockRef.current = true; setIsProcessing(true); hapticFeedback('heavy');
    
    try {
      const nM = money - item.price;
      setMoney(nM); setPhone(true); showMsg("Покупка успешна!");
      
      await supabase.from('players').update({ money: nM, phone_count: 1 }).eq('id', pid);
      await supabase.from('market_items').delete().eq('id', item.id);
      const { data: seller }: any = await supabase.from('players').select('money').eq('id', item.seller_id).single();
      if (seller) await supabase.from('players').update({ money: Number(seller.money) + item.price }).eq('id', item.seller_id);
      loadMarket(); 
    } catch (e) { 
      console.error(e); loadData(true); 
    } finally {
      lockRef.current = false; setIsProcessing(false);
    }
  };

  const handleAvatar = () => {
    setClicks(c => c + 1);
    if (clicks >= 4) { setAdminAuth(true); setClicks(0); setAdminCode(''); hapticFeedback('heavy'); }
    setTimeout(() => setClicks(0), 2000);
  };
  const checkAuth = () => {
    if (adminCode === ADMIN_CODE) { setAdminAuth(false); setAdminPanel(true); }
    else showMsg("Неверный код!", true);
  };
  const adminMoney = async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const nM = money + 100000;
      setMoney(nM); setAdminPanel(false); showMsg("+100 000");
      await safeSyncPlayer({ money: nM });
    } finally {
      lockRef.current = false;
    }
  };
  const adminReset = async () => {
    if (!window.confirm("Удалить ВСЕХ?")) return;
    setLoading(true);
    await supabase.from('market_items').delete().gte('created_at', '2000-01-01');
    await supabase.from('businesses').delete().gte('created_at', '2000-01-01');
    await supabase.from('players').delete().gte('created_at', '2000-01-01');
    localStorage.removeItem('zhituha_id');
    window.location.reload();
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка...</div>;

  if (!nick || !gender) return (
    <div style={{ padding: 20, textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {toast && <div style={{ position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#ef4444' : '#10b981', color: 'white', padding: '15px 25px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '300px' }}>{toast.msg}</div>}
      <h1>Житуха</h1>
      <p style={{ color: '#888', marginBottom: '30px' }}>Создай своего персонажа</p>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => setSelGender('male')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selGender === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selGender === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>🧑</button>
        <button onClick={() => setSelGender('female')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selGender === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selGender === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>👩</button>
      </div>
      {user?.first_name ? (
        <div style={{ ...S.input, maxWidth: '280px', backgroundColor: 'transparent', border: 'none', fontSize: 22, fontWeight: 'bold' }}>Ник: {user.first_name}</div>
      ) : (
        <input type="text" value={inputNick} onChange={(e) => setInputNick(e.target.value)} placeholder="Твой ник..." style={{ ...S.input, maxWidth: '280px' }} />
      )}
      <button onClick={register} disabled={isProcessing} style={{ ...S.btnPrimary, maxWidth: '280px', opacity: isProcessing ? 0.5 : 1 }}>Начать жизнь</button>
    </div>
  );

  return (
    <div style={{ padding: '20px 20px 90px 20px', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', backgroundColor: '#121212', color: 'white' }}>
      
      {toast && <div style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.err ? '#ef4444' : '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '280px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>{toast.msg}</div>}

      {/* МОДАЛКА УВОЛЬНЕНИЯ */}
      {isQuitModalOpen && (
        <div style={S.modalBg}>
          <div style={S.modalBox}>
            <h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3>
            <p style={{ color: '#a1a1aa', fontSize: 15, marginBottom: 20 }}>Ты уверен, что хочешь уволиться с этой работы?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setIsQuitModalOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button>
              <button onClick={confirmQuitJob} disabled={isProcessing} style={{ ...S.btnDanger, opacity: isProcessing ? 0.5 : 1 }}>Уволиться</button>
            </div>
          </div>
        </div>
      )}

      {adminAuth && <div style={S.modalBg}><div style={S.modalBox}><Lock size={40} color="#f59e0b" style={{ marginBottom: 15 }} /><h3>Код доступа</h3><input type="password" value={adminCode} onChange={e => setAdminCode(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setAdminAuth(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={checkAuth} style={S.btnYellow}>Войти</button></div></div></div>}
      {adminPanel && <div style={S.modalBg}><div style={{ ...S.modalBox, border: '1px solid #ef4444' }}><h3 style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', gap: 10 }}><Settings size={24}/> ADMIN PANEL</h3><button onClick={adminMoney} style={{ ...S.btnYellow, marginBottom: 10 }}><Coins size={20}/> +100 000</button><button onClick={adminReset} style={{ ...S.btnDanger, marginBottom: 15 }}><Trash2 size={20}/> Сброс игры</button><button onClick={() => setAdminPanel(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Закрыть</button></div></div>}
      {sellModal && <div style={S.modalBg}><div style={S.modalBox}><h3>Продажа</h3><input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setSellModal(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={listPhone} style={S.btnPurple}>Выставить</button></div></div></div>}

      {tab === 'home' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
            <div style={{ textAlign: 'left' }}>
              <div onClick={handleAvatar} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                {user?.photo_url ? (
                  <img src={user.photo_url} alt="ava" style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid #3b82f6', pointerEvents: 'none' }} />
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: '#1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333', pointerEvents: 'none' }}>{gender === 'male' ? '🧑' : '👩'}</div>
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 'bold' }}>{nick}</div>
                  <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}><User size={12}/> ID: {tgId.slice(0, 6)}</div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 'bold' }}>
              <div style={{ color: '#fbbf24', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Coins size={16}/> {money}</div>
              <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Zap size={16}/> {energy}/100</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
            <button onClick={() => setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 16, backgroundColor: '#1e1e24', border: '1px solid #8b5cf6', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Briefcase size={24} color="#8b5cf6"/>
              <span style={{ fontSize: 12, textAlign: 'center' }}>Бизнес<br/>стартапы</span>
            </button>
            <button onClick={() => setTab('cafe')} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 16, backgroundColor: '#1e1e24', border: '1px solid #f97316', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Coffee size={24} color="#f97316"/>
              <span style={{ fontSize: 12, textAlign: 'center' }}>Кафе</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center', marginBottom: 40 }}>
            <button onClick={() => doWork(true)} disabled={isProcessing || energy < 20} style={{ ...S.btnSecondary, opacity: (isProcessing || energy < 20) ? 0.5 : 1 }}>
              <Users size={20}/> Подработка (+200)
            </button>
            <button onClick={doRest} disabled={isProcessing || timeLeft > 0 || energy === 100} style={{ ...S.btnPrimary, background: '#1e1e24', border: '1px solid #10b981', color: timeLeft > 0 ? '#888' : '#10b981', boxShadow: 'none', opacity: (isProcessing || timeLeft > 0 || energy === 100) ? 0.5 : 1 }}>
              <Zap size={20}/> {timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдых (90 сек)'}
            </button>
          </div>
        </div>
      )}

      {tab === 'cafe' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <button onClick={() => { setTab('home'); setSelectedCafe(null); }} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
          <h2>Кафе города</h2>
          
          {brewTimeLeft > 0 ? (
            <div style={{ ...S.card, textAlign: 'center' }}>
              <Coffee size={48} color="#f97316" style={{ marginBottom: 15 }}/>
              <h3>Готовим кофе...</h3>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#f97316' }}>{brewTimeLeft} сек.</p>
              <p style={{ fontSize: 14, color: '#a1a1aa' }}>Пожалуйста, подождите.</p>
            </div>
          ) : selectedCafe ? (
            <div style={{ ...S.card, textAlign: 'center' }}>
              <Coffee size={48} color="#f97316" style={{ marginBottom: 15 }}/>
              <h3 style={{ marginBottom: 5 }}>Кофейня</h3>
              <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>Владелец: {selectedCafe.owner_name}</p>
              
              <button 
                onClick={() => buyCoffee(selectedCafe)} 
                disabled={isProcessing || money < COFFEE_PRICE || energy === 100 || !selectedCafe.worker_id} 
                style={{ 
                  ...S.btnYellow, 
                  background: (money < COFFEE_PRICE || energy === 100 || !selectedCafe.worker_id) ? '#333' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: (money < COFFEE_PRICE || energy === 100 || !selectedCafe.worker_id) ? '#888' : 'white',
                  opacity: (isProcessing || money < COFFEE_PRICE || energy === 100 || !selectedCafe.worker_id) ? 0.5 : 1,
                  cursor: (isProcessing || money < COFFEE_PRICE || energy === 100 || !selectedCafe.worker_id) ? 'not-allowed' : 'pointer',
                  marginBottom: 10 
                }}
              >
                {!selectedCafe.worker_id ? 'Нет бариста (закрыто)' : energy === 100 ? 'Энергия уже полная' : money < COFFEE_PRICE ? 'Недостаточно средств' : `Купить кофе за ${COFFEE_PRICE}`}
              </button>

              <button onClick={() => setSelectedCafe(null)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Назад к списку</button>
            </div>
          ) : (
            <div>
              <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 15 }}>Выбери заведение</h3>
              {allBiz.filter(b => b.worker_id !== null).length === 0 && <p style={{ color: '#666' }}>Все кафе закрыты (нет баристы)...</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allBiz.filter(b => b.worker_id !== null).map(b => (
                  <div key={b.id} onClick={() => setSelectedCafe(b)} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16}/> Кофейня</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div>
                    </div>
                    <span style={{ color: '#f97316', fontWeight: 'bold' }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'business' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <button onClick={() => setTab('home')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
          <h2>Мой Бизнес</h2>
          {biz ? (
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 'bold', marginBottom: 15 }}><Coffee size={28} color="#d97706"/> Кофейня</div>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0 15px 0' }}>Сотрудник: <b style={{ color: '#3b82f6' }}>{biz.worker_name || 'Нет'}</b></p>
              
              <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#f97316' }}>Выручка с продаж кофе</p>
                <p style={{ margin: '0 0 10px 0', fontSize: 22, color: '#f97316', fontWeight: 'bold' }}>В кассе: {biz.coffee_balance || 0} <Coins size={18} style={{ display: 'inline' }}/></p>
                <button onClick={collectCoffeeIncome} disabled={isProcessing || !biz.coffee_balance || biz.coffee_balance <= 0} style={{ ...S.btnYellow, opacity: (isProcessing || !biz.coffee_balance || biz.coffee_balance <= 0) ? 0.5 : 1, padding: 12 }}>Собрать выручку</button>
              </div>

              {biz.worker_id && <button onClick={fireWorker} disabled={isProcessing} style={{ ...S.btnDanger, background: 'rgba(239, 68, 68, 0.1)', boxShadow: 'none' }}>Уволить баристу</button>}
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: 'center' }}>
              <Store size={48} color="#8b5cf6" style={{ marginBottom: 15 }}/>
              <h3>Открыть Кофейню</h3>
              <button onClick={buyBusiness} disabled={isProcessing || money < BUSINESS_PRICE} style={{ ...S.btnPurple, background: money < BUSINESS_PRICE ? '#333' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: money < BUSINESS_PRICE ? '#888' : 'white', opacity: (isProcessing || money < BUSINESS_PRICE) ? 0.5 : 1, cursor: (isProcessing || money < BUSINESS_PRICE) ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? 'Обработка...' : `Купить за ${BUSINESS_PRICE}`}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2>Работа</h2>
          
          {isJobBoardOpen ? (
            <div>
              <button onClick={() => setIsJobBoardOpen(false)} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
              <h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Свободные вакансии</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allBiz.filter(b => !b.worker_id && b.owner_id !== pid).map(b => (
                  <div key={b.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16}/> Кофейня</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div>
                    </div>
                    {job ? (
                      <button disabled style={{ ...S.btnSecondary, width: 'auto', padding: '8px 14px', fontSize: 13, opacity: 0.5, cursor: 'not-allowed' }}>Уже работаете</button>
                    ) : (
                      <button onClick={() => hireWorker(b.id)} disabled={isProcessing} style={{ ...S.btnSecondary, width: 'auto', padding: '8px 14px', fontSize: 13, opacity: isProcessing ? 0.5 : 1 }}>Устроиться</button>
                    )}
                  </div>
                ))}
                {allBiz.filter(b => !b.worker_id && b.owner_id !== pid).length === 0 && (
                  <p style={{ color: '#666', fontSize: 14 }}>Пока нет свободных мест...</p>
                )}
              </div>
            </div>
          ) : job ? (
            <div>
              <h3 style={{ color: '#10b981', fontSize: 18, marginBottom: 15 }}>Текущее место работы</h3>
              <div style={{ backgroundColor: '#1e1e24', padding: 20, borderRadius: 16, border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                  <Coffee size={24} color="#f97316" />
                  <span style={{ fontSize: 18, fontWeight: 'bold' }}>Кофейня</span>
                </div>
                <p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#a1a1aa' }}>Владелец: <b style={{ color: 'white' }}>{job.owner_name}</b></p>
                <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#a1a1aa' }}>Должность: <b style={{ color: '#3b82f6' }}>Бариста</b></p>
                
                <button onClick={workShift} disabled={isProcessing || energy < 20} style={{ ...S.btnPrimary, opacity: (isProcessing || energy < 20) ? 0.5 : 1, marginBottom: 10 }}>Смена (+300)</button>
                
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setIsJobBoardOpen(true)} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: '#333', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>Вакансии</button>
                  <button onClick={() => setIsQuitModalOpen(true)} disabled={isProcessing} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, fontWeight: 'bold', opacity: isProcessing ? 0.5 : 1 }}>Уволиться</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', marginTop: 50 }}>
              <div style={{ fontSize: 50, marginBottom: 10 }}>📉</div>
              <h3 style={{ marginBottom: 10 }}>Вы безработный</h3>
              <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>Пора найти работу, чтобы зарабатывать монеты!</p>
              <button onClick={() => setIsJobBoardOpen(true)} style={S.btnSecondary}>
                <Briefcase size={20} /> Биржа труда
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'shop' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}><h2>Гос. Магазин</h2><div style={{ ...S.card, textAlign: 'center' }}><Smartphone size={48} color="#a1a1aa" style={{ marginBottom: 15 }}/><h3>Смартфон</h3>{phone ? <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={20}/> Куплено</div> : <button onClick={() => doPhone(true)} disabled={isProcessing || money < PHONE_PRICE} style={{ ...S.btnPurple, opacity: (isProcessing || money < PHONE_PRICE) ? 0.5 : 1 }}>Купить за 2000</button>}</div></div>
      )}

      {tab === 'market' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2>Рынок</h2>
          <div style={{ marginBottom: 30 }}><h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>{players.map((p, i) => (<div key={p.id} style={{ backgroundColor: '#1e1e24', padding: '12px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#a1a1aa' }}>#{i + 1}</span><span style={{ fontWeight: 'bold' }}>{p.nickname}</span></div><span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{p.money} <Coins size={14}/></span></div>))}</div>
          <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Лоты</h3>
          {market.length === 0 && <p style={{ color: '#666' }}>Пусто...</p>}
          {market.map(item => (<div key={item.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ textAlign: 'left' }}><div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Smartphone size={18}/> Телефон</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Продавец: {item.seller_name}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price}</span>{item.seller_id !== pid ? <button onClick={() => buyLot(item)} disabled={isProcessing} style={{ ...S.btnPrimary, width: 'auto', padding: '6px 12px', fontSize: 13, opacity: isProcessing ? 0.5 : 1 }}>Купить</button> : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}</div></div>))}
        </div>
      )}

      {tab === 'inventory' && (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}><h2>Инвентарь</h2>{phone ? (<div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#a1a1aa"/><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><button onClick={() => setSellModal(true)} disabled={isProcessing} style={{ ...S.btnPurple, opacity: isProcessing ? 0.5 : 1 }}>Выставить на рынок</button><button onClick={() => doPhone(false)} disabled={isProcessing} style={{ ...S.btnPrimary, opacity: isProcessing ? 0.5 : 1 }}>Сдать в ломбард (+1400)</button></div>) : <div style={{ color: '#52525b', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }}/><br/>Пусто...</div>}</div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(30, 30, 36, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        {[
          { id: 'home', icon: Home, text: 'Главная' }, 
          { id: 'jobs', icon: Briefcase, text: 'Работа' }, 
          { id: 'market', icon: Globe, text: 'Рынок' }, 
          { id: 'shop', icon: Store, text: 'Магазин' }, 
          { id: 'inventory', icon: Backpack, text: 'Сумка' }
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as any); hapticFeedback('light'); setIsJobBoardOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: tab === t.id ? '#3b82f6' : '#a1a1aa' }}>
            <t.icon size={22} style={{ marginBottom: 4 }} />
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}