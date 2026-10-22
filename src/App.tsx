import { useState, useEffect } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { 
  Smartphone, Coins, Zap, Briefcase, Globe, Store, Backpack, 
  Home, Coffee, Users, ShieldAlert, CheckCircle2, Settings, Trash2, Lock 
} from 'lucide-react';

// --- КОНСТАНТЫ ---
const PHONE_PRICE = 2000;
const BUSINESS_PRICE = 10000;
const WORKER_SALARY = 300;
const WORKER_BONUS = 100;
const ADMIN_CODE = "admin2026";

// --- СТИЛИ (Вынесены для сокращения кода) ---
const S = {
  card: { backgroundColor: 'rgba(30, 30, 36, 0.8)', backdropFilter: 'blur(10px)', color: 'white', padding: 20, borderRadius: 20, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', transition: '0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', transition: '0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)', transition: '0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)', transition: '0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: 'none', transition: '0.1s' },
  flexCol: { display: 'flex', flexDirection: 'column' as const, gap: '15px', alignItems: 'center' },
  hudBar: { display: 'flex', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e1e24 0%, #121212 100%)', padding: '15px 25px', borderRadius: '16px', maxWidth: '350px', margin: '0 auto 25px auto', border: '1px solid #333', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20 },
  modalBox: { backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #333', textAlign: 'center' as const },
  input: { width: '100%', padding: 15, borderRadius: 12, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center' as const, fontSize: 18, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none' }
};

interface Player { id: string; nickname: string; money: number; }
interface MarketItem { id: string; seller_id: string; seller_name: string; item_type: string; price: number; }
interface Business { id: string; owner_id: string; owner_name: string; worker_id: string | null; worker_name: string | null; last_collected: string; }

export default function App() {
  const { user, hapticFeedback } = useTelegram();

  // --- СОСТОЯНИЯ ---
  const [loading, setLoading] = useState(true);
  const [pid, setPid] = useState<string | null>(null);
  const [nick, setNick] = useState('');
  const [inputNick, setInputNick] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selGender, setSelGender] = useState<'male' | 'female' | null>(null);
  
  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phone, setPhone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [pendingInc, setPendingInc] = useState(0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [market, setMarket] = useState<MarketItem[]>([]);
  const [biz, setBiz] = useState<Business | null>(null);
  const [job, setJob] = useState<Business | null>(null);
  const [allBiz, setAllBiz] = useState<Business[]>([]);

  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business'>('home');
  const [toast, setToast] = useState<{msg: string, err: boolean} | null>(null);
  
  // Админка
  const [clicks, setClicks] = useState(0);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPanel, setAdminPanel] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  // Модалки
  const [sellModal, setSellModal] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');

  // --- ХЕЛПЕРЫ ---
  const showMsg = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2500);
  };

  const getUid = () => {
    if (user?.id) return user.id.toString();
    let bid = localStorage.getItem('zhituha_id');
    if (!bid) { bid = 'user_' + Math.random().toString(36).substring(2, 9); localStorage.setItem('zhituha_id', bid); }
    return bid;
  };

  // --- ЗАГРУЗКА (Оптимизирована) ---
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data }: any = await supabase.from('players').select('*').eq('telegram_id', getUid()).maybeSingle();
      if (data) {
        setPid(data.id); setNick(data.nickname); setGender(data.gender);
        setMoney(Number(data.money)); setEnergy(Number(data.energy));
        setPhone(Number(data.phone_count) > 0);
        setTimeLeft(Math.max(0, Math.ceil(((Number(data.last_rest_time)||0) + 60000 - Date.now()) / 1000)));
        
        const { data: bData }: any = await supabase.from('businesses').select('*');
        if (bData) {
          setAllBiz(bData);
          setBiz(bData.find((b: any) => b.owner_id === data.id) || null);
          setJob(bData.find((b: any) => b.worker_id === data.id) || null);
        }
      } else if (user?.first_name) setInputNick(user.first_name);
    } catch (e: any) { if (!silent) showMsg("Ошибка сети: " + e.message, true); }
    finally { if (!silent) setLoading(false); }
  };

  const loadMarket = async () => {
    const { data: p }: any = await supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10);
    if (p) setPlayers(p);
    const { data: m }: any = await supabase.from('market_items').select('*').order('created_at', { ascending: false });
    if (m) setMarket(m);
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { if (tab === 'market') loadMarket(); }, [tab]);
  
  // Таймеры
  useEffect(() => {
    if (timeLeft > 0) { const t = setTimeout(() => setTimeLeft(p => p - 1), 1000); return () => clearTimeout(t); }
  }, [timeLeft]);

  useEffect(() => {
    if (!biz || !biz.worker_id || !biz.last_collected) return setPendingInc(0);
    const int = setInterval(() => {
      const sec = Math.max(0, (Date.now() - new Date(biz.last_collected).getTime()) / 1000);
      setPendingInc(Math.floor(sec * (100 / 60)));
    }, 1000);
    return () => clearInterval(int);
  }, [biz]);

  // --- ДЕЙСТВИЯ (Optimistic UI - мгновенно) ---
  const syncPlayer = async (updates: any) => {
    if (!pid) return;
    const { error } = await supabase.from('players').update(updates).eq('id', pid);
    if (error) {
      showMsg("Ошибка базы!", true);
      loadData(true); // Откатываем состояние при ошибке
    }
  };

  const register = async () => {
    if (!inputNick.trim() || !selGender) return showMsg("Заполни все поля!", true);
    hapticFeedback('medium');
    const { data, error }: any = await supabase.from('players').insert([{
      telegram_id: getUid(), nickname: inputNick, gender: selGender, money: 3500, energy: 80, phone_count: 0, last_rest_time: 0
    }]).select().single();
    
    if (error) showMsg("Ошибка БД: " + error.message, true);
    else if (data) { setPid(data.id); setNick(inputNick); setGender(selGender); }
  };

  const doWork = (isJanitor: boolean) => {
    if (energy < 20 || (!phone && !isJanitor)) return showMsg("Не хватает условий!", true);
    hapticFeedback('medium');
    
    const addMoney = isJanitor ? 200 : 500;
    const nM = Number(money) + addMoney;
    const nE = Number(energy) - 20;
    
    // Мгновенно обновляем UI
    setMoney(nM); setEnergy(nE); showMsg(`+${addMoney} монет`);
    // В фоне сохраняем
    syncPlayer({ money: nM, energy: nE });
  };

  const doRest = () => {
    if (timeLeft > 0 || energy === 100) return;
    hapticFeedback('light');
    const now = Date.now();
    setEnergy(100); setTimeLeft(60); showMsg("Энергия восстановлена!");
    syncPlayer({ energy: 100, last_rest_time: now });
  };

  const doPhone = (buy: boolean) => {
    if (buy && money < PHONE_PRICE) return showMsg("Мало денег!", true);
    if (!buy && !phone) return;
    hapticFeedback('heavy');
    
    const nM = buy ? money - PHONE_PRICE : money + 1400;
    const nP = buy ? 1 : 0;
    
    setMoney(nM); setPhone(buy); showMsg(buy ? "Телефон куплен!" : "Сдан за 1400");
    syncPlayer({ money: nM, phone_count: nP });
  };

  const listPhone = async () => {
    const p = Number(sellPrice);
    if (isNaN(p) || p <= 0 || !phone) return;
    hapticFeedback('medium');
    setPhone(false); setSellModal(false);
    
    const { error } = await supabase.from('market_items').insert([{ seller_id: pid, seller_name: nick, item_type: 'phone', price: p }]);
    if (error) { setPhone(true); showMsg("Ошибка выставления", true); }
    else { syncPlayer({ phone_count: 0 }); setTab('market'); loadMarket(); showMsg("Выставлено!"); }
  };

  const buyLot = async (item: MarketItem) => {
    if (money < item.price) return showMsg("Мало денег!", true);
    hapticFeedback('heavy');
    
    const nM = money - item.price;
    setMoney(nM); setPhone(true); showMsg("Покупка успешна!");
    
    try {
      await supabase.from('players').update({ money: nM, phone_count: 1 }).eq('id', pid);
      await supabase.from('market_items').delete().eq('id', item.id);
      const { data: seller }: any = await supabase.from('players').select('money').eq('id', item.seller_id).single();
      if (seller) await supabase.from('players').update({ money: Number(seller.money) + item.price }).eq('id', item.seller_id);
      loadMarket(); 
    } catch (e) { loadData(true); }
  };

  const buyBusiness = async () => {
    if (money < BUSINESS_PRICE || biz) return showMsg("Мало денег!", true);
    hapticFeedback('heavy');
    const nM = money - BUSINESS_PRICE;
    setMoney(nM); showMsg("Кофейня открыта!");
    
    await syncPlayer({ money: nM });
    await supabase.from('businesses').insert([{ owner_id: pid, owner_name: nick, worker_id: null }]);
    loadData(true);
  };

  const collectIncome = () => {
    if (pendingInc <= 0) return;
    hapticFeedback('medium');
    const nM = money + pendingInc;
    const inc = pendingInc;
    
    setMoney(nM); setPendingInc(0); showMsg(`Собрано ${inc}`);
    syncPlayer({ money: nM });
    supabase.from('businesses').update({ last_collected: new Date().toISOString() }).eq('id', biz?.id);
    loadData(true);
  };

  const hireWorker = async (bId: string) => {
    hapticFeedback('medium');
    await supabase.from('businesses').update({ worker_id: pid, worker_name: nick, last_collected: new Date().toISOString() }).eq('id', bId);
    showMsg("Вы наняты!"); loadData(true);
  };

  const fireWorker = async () => {
    if (!biz) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', biz.id);
    showMsg("Уволен."); loadData(true);
  };

  const workShift = () => {
    if (!job || energy < 20) return;
    hapticFeedback('medium');
    const nM = money + WORKER_SALARY;
    const nE = energy - 20;
    setMoney(nM); setEnergy(nE); showMsg(`+${WORKER_SALARY} за смену`);
    
    syncPlayer({ money: nM, energy: nE });
    supabase.from('players').select('money').eq('id', job.owner_id).single().then(({data}) => {
      if(data) supabase.from('players').update({ money: Number(data.money) + WORKER_BONUS }).eq('id', job.owner_id);
    });
  };

  // --- АДМИНКА ---
  const handleAvatar = () => {
    setClicks(c => c + 1);
    if (clicks >= 4) { setAdminAuth(true); setClicks(0); setAdminCode(''); hapticFeedback('heavy'); }
    setTimeout(() => setClicks(0), 2000);
  };

  const checkAuth = () => {
    if (adminCode === ADMIN_CODE) { setAdminAuth(false); setAdminPanel(true); }
    else showMsg("Неверный код!", true);
  };

  const adminMoney = () => {
    const nM = money + 100000;
    setMoney(nM); setAdminPanel(false); showMsg("+100 000 монет");
    syncPlayer({ money: nM });
  };

  const adminReset = async () => {
    if (!window.confirm("Удалить ВСЕХ игроков и данные?")) return;
    setLoading(true);
    await supabase.from('market_items').delete().gte('created_at', '2000-01-01');
    await supabase.from('businesses').delete().gte('created_at', '2000-01-01');
    await supabase.from('players').delete().gte('created_at', '2000-01-01');
    localStorage.removeItem('zhituha_id');
    window.location.reload();
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка...</div>;

  if (!nick || !gender) return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {toast && <div style={{ position: 'fixed', top: 20, background: toast.err ? '#ef4444' : '#10b981', padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000 }}>{toast.msg}</div>}
      <h1>Житуха</h1>
      <p style={{ color: '#888', marginBottom: '30px' }}>Создай своего персонажа</p>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => setSelGender('male')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selGender === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selGender === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>🧑</button>
        <button onClick={() => setSelGender('female')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selGender === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selGender === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16 }}>👩</button>
      </div>
      <input type="text" value={inputNick} onChange={(e) => setInputNick(e.target.value)} placeholder="Твой ник..." style={{ ...S.input, maxWidth: '280px' }} />
      <button onClick={register} style={{ ...S.btnPrimary, maxWidth: '280px' }}>Начать жизнь</button>
    </div>
  );

  return (
    <div style={{ padding: '20px 20px 90px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
      
      {/* ТОСТ */}
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.err ? '#ef4444' : '#10b981', color: 'white', padding: '15px 25px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '300px' }}>{toast.msg}</div>}

      {/* МОДАЛКИ */}
      {adminAuth && <div style={S.modalBg}><div style={S.modalBox}><Lock size={40} color="#f59e0b" style={{ marginBottom: 15 }} /><h3>Код доступа</h3><input type="password" value={adminCode} onChange={e => setAdminCode(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setAdminAuth(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={checkAuth} style={S.btnYellow}>Войти</button></div></div></div>}
      
      {adminPanel && <div style={S.modalBg}><div style={{ ...S.modalBox, border: '1px solid #ef4444' }}><h3 style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', gap: 10 }}><Settings size={24}/> ADMIN PANEL</h3><button onClick={adminMoney} style={{ ...S.btnYellow, marginBottom: 10 }}><Coins size={20}/> +100 000</button><button onClick={adminReset} style={{ ...S.btnDanger, marginBottom: 15 }}><Trash2 size={20}/> Сброс игры</button><button onClick={() => setAdminPanel(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Закрыть</button></div></div>}
      
      {sellModal && <div style={S.modalBg}><div style={S.modalBox}><h3>Продажа</h3><input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setSellModal(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={listPhone} style={S.btnPurple}>Выставить</button></div></div></div>}

      {/* ШАПКА */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <h2 onClick={handleAvatar} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, cursor: 'pointer', userSelect: 'none' }}>
          {user?.photo_url ? <img src={user.photo_url} alt="ava" style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #3b82f6', pointerEvents: 'none' }} /> : <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#1e1e24', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #333', pointerEvents: 'none' }}>{gender === 'male' ? '🧑' : '👩'}</div>}
          {nick}
        </h2>
      </div>

      {/* HUD */}
      <div style={S.hudBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold' }}><Coins size={22} color="#fbbf24" /> {money}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 'bold' }}><Zap size={22} color="#3b82f6" /> {energy}/100</div>
      </div>

      {/* ГЛАВНАЯ */}
      {tab === 'home' && (
        <div style={S.flexCol}>
          {!phone && <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 12, padding: 15, maxWidth: '320px', margin: '0 auto 10px auto', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}><ShieldAlert size={20} /> Нужен телефон для работы.</div>}
          <button onClick={() => doWork(false)} disabled={!phone || energy < 20} style={{ ...S.btnPrimary, opacity: (!phone || energy < 20) ? 0.5 : 1 }}><Briefcase size={20}/> Работать (+500)</button>
          <button onClick={() => doWork(true)} disabled={energy < 20} style={{ ...S.btnSecondary, opacity: energy < 20 ? 0.5 : 1 }}><Users size={20}/> Дворником (+200)</button>
          <button onClick={doRest} disabled={timeLeft > 0 || energy === 100} style={{ ...S.btnSecondary, background: timeLeft > 0 ? '#333' : '#1e1e24', color: timeLeft > 0 ? '#888' : 'white', border: '1px solid #333', boxShadow: 'none' }}><Zap size={20} color={timeLeft > 0 ? '#888' : '#3b82f6'}/> {timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть'}</button>
        </div>
      )}

      {/* БИЗНЕС */}
      {tab === 'business' && (
        <div>
          <h2>Бизнес</h2>
          {biz ? (
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 'bold', marginBottom: 15 }}><Coffee size={28} color="#d97706"/> Кофейня</div>
              <p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0' }}>Сотрудник: <b style={{ color: '#3b82f6' }}>{biz.worker_name || 'Нет'}</b></p>
              {biz.worker_id ? <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 12, margin: '15px 0', border: '1px solid rgba(16, 185, 129, 0.2)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#10b981' }}>Доход: 100 монет / мин</p><p style={{ margin: 0, fontSize: 22, color: '#10b981', fontWeight: 'bold' }}>В кассе: {pendingInc} <Coins size={18} style={{ display: 'inline', verticalAlign: 'middle' }}/></p></div> : <p style={{ color: '#fbbf24', fontSize: 14, marginTop: 15 }}>Найми сотрудника!</p>}
              <button onClick={collectIncome} disabled={pendingInc <= 0} style={{ ...S.btnPrimary, opacity: pendingInc <= 0 ? 0.5 : 1, marginBottom: 10 }}>Собрать доход</button>
              {biz.worker_id && <button onClick={fireWorker} style={{ ...S.btnDanger, background: 'rgba(239, 68, 68, 0.1)', boxShadow: 'none' }}>Уволить</button>}
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: 'center' }}>
              <Store size={48} color="#8b5cf6" style={{ marginBottom: 15 }}/>
              <h3>Открыть Кофейню</h3>
              <button onClick={buyBusiness} disabled={money < BUSINESS_PRICE} style={{ ...S.btnPurple, opacity: money < BUSINESS_PRICE ? 0.5 : 1 }}>{money < BUSINESS_PRICE ? 'Мало денег' : 'Открыть за 10 000'}</button>
            </div>
          )}

          {!job && <div style={{ marginTop: 30 }}><h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Вакансии</h3>{allBiz.filter(b => !b.worker_id && b.owner_id !== pid).map(b => (<div key={b.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', marginBottom: 10, maxWidth: '350px', margin: '0 auto 10px auto' }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16}/> Кофейня</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div></div><button onClick={() => hireWorker(b.id)} style={{ ...S.btnSecondary, width: 'auto', padding: '8px 14px', fontSize: 13 }}>Устроиться</button></div>))}</div>}

          {job && <div style={{ marginTop: 30 }}><h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Моя работа</h3><div style={{ backgroundColor: '#1e1e24', padding: 20, borderRadius: 16, border: '1px solid #333', maxWidth: '350px', margin: '0 auto' }}><p style={{ margin: '0 0 15px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Coffee size={18}/> Кофейня ({job.owner_name})</p><button onClick={workShift} disabled={energy < 20} style={{ ...S.btnPrimary, opacity: energy < 20 ? 0.5 : 1 }}>Смена (+300)</button></div></div>}
        </div>
      )}

      {/* МАГАЗИН */}
      {tab === 'shop' && (
        <div><h2>Гос. Магазин</h2><div style={{ ...S.card, textAlign: 'center' }}><Smartphone size={48} color="#a1a1aa" style={{ marginBottom: 15 }}/><h3>Смартфон</h3>{phone ? <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={20}/> Куплено</div> : <button onClick={() => doPhone(true)} disabled={money < PHONE_PRICE} style={{ ...S.btnPurple, opacity: money < PHONE_PRICE ? 0.5 : 1 }}>Купить за 2000</button>}</div></div>
      )}

      {/* РЫНОК */}
      {tab === 'market' && (
        <div>
          <h2>Барахолка</h2>
          <div style={{ marginBottom: 30 }}><h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>{players.map((p, i) => (<div key={p.id} style={{ backgroundColor: '#1e1e24', padding: '12px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', marginBottom: 8, maxWidth: '350px', margin: '0 auto 8px auto' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#a1a1aa' }}>#{i + 1}</span><span style={{ fontWeight: 'bold' }}>{p.nickname}</span></div><span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{p.money} <Coins size={14}/></span></div>))}</div>
          <h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Лоты</h3>
          {market.length === 0 && <p style={{ color: '#666' }}>Пусто...</p>}
          {market.map(item => (<div key={item.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 16, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '350px', margin: '0 auto 10px auto' }}><div style={{ textAlign: 'left' }}><div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Smartphone size={18}/> Телефон</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Продавец: {item.seller_name}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price}</span>{item.seller_id !== pid ? <button onClick={() => buyLot(item)} style={{ ...S.btnPrimary, width: 'auto', padding: '6px 12px', fontSize: 13 }}>Купить</button> : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}</div></div>))}
        </div>
      )}

      {/* ИНВЕНТАРЬ */}
      {tab === 'inventory' && (
        <div><h2>Инвентарь</h2>{phone ? (<div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#a1a1aa"/><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><button onClick={() => setSellModal(true)} style={S.btnPurple}>Выставить на рынок</button><button onClick={() => doPhone(false)} style={S.btnPrimary}>Сдать в ломбард (+1400)</button></div>) : <div style={{ color: '#52525b', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }}/><br/>Пусто...</div>}</div>
      )}

      {/* НИЖНЕЕ МЕНЮ */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(30, 30, 36, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        {[{ id: 'home', icon: Home, text: 'Главная' }, { id: 'business', icon: Briefcase, text: 'Бизнес' }, { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'shop', icon: Store, text: 'Магазин' }, { id: 'inventory', icon: Backpack, text: 'Сумка' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as any); hapticFeedback('light'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: tab === t.id ? '#3b82f6' : '#a1a1aa' }}>
            <t.icon size={22} style={{ marginBottom: 4 }} />
            <span style={{ fontSize: 11, fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}