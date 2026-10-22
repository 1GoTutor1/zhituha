import { useState, useEffect, useRef } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { 
  Smartphone, Coins, Zap, Briefcase, Globe, Store, Backpack, 
  Home, Coffee, Users, CheckCircle2, Settings, Trash2, Lock, User, Share2, Gift
} from 'lucide-react';

// --- КОНСТАНТЫ ---
const BOT_USERNAME = "zhituha_bot"; 
const PHONE_PRICE = 2000, BUSINESS_PRICE = 10000, WORKER_SALARY = 300, COFFEE_PRICE = 500;
const ADMIN_CODE = "admin2026", REST_CD = 90000, BREW_TIME = 15000, POLL = 5000;

// --- АВАТАРКИ ---
const AVATARS = [
  { id: 1, gender: 'male', emoji: '🧑‍💻', bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { id: 2, gender: 'male', emoji: '🧑‍🎨', bg: 'linear-gradient(135deg, #8b5cf6, #5b21b6)' },
  { id: 3, gender: 'male', emoji: '🧑‍🚀', bg: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { id: 4, gender: 'female', emoji: '👩‍💻', bg: 'linear-gradient(135deg, #ec4899, #be185d)' },
  { id: 5, gender: 'female', emoji: '👩‍🎨', bg: 'linear-gradient(135deg, #10b981, #047857)' },
  { id: 6, gender: 'female', emoji: '👩‍🚀', bg: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
];

const getAvatar = (id: number) => AVATARS.find(a => a.id === id) || AVATARS[0];

const S = {
  card: { backgroundColor: 'rgba(30, 30, 36, 0.8)', backdropFilter: 'blur(10px)', color: 'white', padding: 20, borderRadius: 20, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)', transition: 'transform 0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)', transition: 'transform 0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)', transition: 'transform 0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderRadius: 14, fontWeight: 'bold', border: 'none', boxShadow: 'none', transition: 'transform 0.1s' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20, animation: 'fadeIn 0.2s ease-out' },
  modalBox: { backgroundColor: '#1e1e24', padding: 25, borderRadius: 20, width: '100%', maxWidth: '320px', border: '1px solid #333', textAlign: 'center' as const, animation: 'slideUp 0.3s ease-out' },
  input: { width: '100%', padding: 15, borderRadius: 12, backgroundColor: '#121212', color: '#fff', border: '1px solid #444', textAlign: 'center' as const, fontSize: 18, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none' }
};

export default function App() {
  const { user, hapticFeedback, tg, startParam } = useTelegram();
  
  const [loading, setLoading] = useState(true);
  const [proc, setProc] = useState(false);
  const [pid, setPid] = useState<string | null>(null);
  const [tgId, setTgId] = useState('');
  const [toast, setToast] = useState<{ msg: string, err: boolean } | null>(null);
  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business' | 'jobs' | 'cafe'>('home');

  const [nick, setNick] = useState('');
  const [inNick, setInNick] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selG, setSelG] = useState<'male' | 'female' | null>(null);
  const [avatarId, setAvatarId] = useState(1);
  
  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phone, setPhone] = useState(false);
  
  const [refBalance, setRefBalance] = useState(0);
  const [myRefs, setMyRefs] = useState<any[]>([]);
  
  const [restEnd, setRestEnd] = useState(0);
  const [brewEnd, setBrewEnd] = useState(0);
  const [tLeft, setTLeft] = useState(0);
  const [bLeft, setBLeft] = useState(0);

  const [players, setPlayers] = useState<any[]>([]);
  const [market, setMarket] = useState<any[]>([]);
  const [biz, setBiz] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [selCafe, setSelCafe] = useState<any>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  
  const [clicks, setClicks] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');
  const [quitOpen, setQuitOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  const lock = useRef(false);

  const showMsg = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); };
  const getUid = () => user?.id?.toString() || localStorage.getItem('zhituha_id') || (() => { const id = 'user_' + Math.random().toString(36).substring(2, 8); localStorage.setItem('zhituha_id', id); return id; })();

  const action = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setProc(true);
    try { await fn(); } 
    catch (e: any) { showMsg(e.message || "Ошибка", true); } 
    finally { lock.current = false; setProc(false); }
  };

  const sync = async (updates: any) => {
    if (!pid) return false;
    const { error } = await supabase.from('players').update(updates).eq('id', pid);
    if (error) { showMsg("Ошибка БД", true); return false; }
    return true;
  };

  const addReferralBonus = async (amount: number) => {
    const { data: me } = await supabase.from('players').select('referred_by').eq('id', pid).single();
    if (!me || !me.referred_by) return;

    const bonus = Math.floor(amount * 0.05);
    if (bonus <= 0) return;

    const { data: ref } = await supabase.from('players').select('referral_balance').eq('telegram_id', me.referred_by).single();
    if (ref) {
      await supabase.from('players').update({ referral_balance: (Number(ref.referral_balance) || 0) + bonus }).eq('telegram_id', me.referred_by);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (lock.current) return;
    try {
      const uid = getUid(); setTgId(uid);
      const { data } = await supabase.from('players').select('*').eq('telegram_id', uid).maybeSingle();
      if (data) {
        setPid(data.id); setNick(data.nickname); setGender(data.gender);
        setAvatarId(data.avatar_id || 1);
        setMoney(Number(data.money)); setEnergy(Number(data.energy));
        setPhone(Number(data.phone_count) > 0);
        setRefBalance(Number(data.referral_balance) || 0);
        const last = Number(data.last_rest_time) || 0;
        setRestEnd(last + REST_CD > Date.now() ? last + REST_CD : 0);
        
        const { data: refs } = await supabase.from('players').select('nickname').eq('referred_by', uid);
        if (refs) setMyRefs(refs);

        const { data: b } = await supabase.from('businesses').select('*');
        if (b) {
          setAllBiz(b);
          setBiz(b.find((x: any) => x.owner_id === data.id) || null);
          setJob(b.find((x: any) => x.worker_id === data.id) || null);
        }
      } else if (user?.first_name) setInNick(user.first_name);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  };

  const loadMarket = async () => {
    const { data: p } = await supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10);
    if (p) setPlayers(p);
    const { data: m } = await supabase.from('market_items').select('*').order('created_at', { ascending: false });
    if (m) setMarket(m);
  };

  useEffect(() => { loadData(); }, [user]);
  
  useEffect(() => {
    if (tab === 'market') loadMarket();
    if (['business', 'jobs', 'cafe'].includes(tab)) {
      loadData(true);
      const int = setInterval(() => loadData(true), POLL);
      return () => clearInterval(int);
    }
  }, [tab]);

  useEffect(() => {
    const int = setInterval(() => {
      const now = Date.now();
      if (restEnd > 0) {
        const r = Math.max(0, Math.ceil((restEnd - now) / 1000));
        setTLeft(r); if (r === 0) setRestEnd(0);
      }
      if (brewEnd > 0) {
        const r = Math.max(0, Math.ceil((brewEnd - now) / 1000));
        setBLeft(r);
        if (r === 0) {
          setBrewEnd(0); setEnergy(100);
          if (pid) supabase.from('players').update({ energy: 100 }).eq('id', pid);
          showMsg("Кофе готов! Энергия восстановлена!"); hapticFeedback('heavy');
        }
      }
    }, 1000);
    return () => clearInterval(int);
  }, [restEnd, brewEnd, pid]);

  const selectGender = (g: 'male' | 'female') => {
    setSelG(g);
    const firstAvatar = AVATARS.find(a => a.gender === g)?.id || 1;
    setAvatarId(firstAvatar);
    hapticFeedback('light');
  };

  const reg = () => action(async () => {
    const final = user?.first_name || inNick;
    if (!final.trim() || !selG) return showMsg("Заполни поля!", true);
    
    let refBy = null;
    if (startParam && startParam.startsWith('ref_')) {
      refBy = startParam.split('_')[1];
      if (refBy === getUid()) refBy = null; 
    }

    const { data, error } = await supabase.from('players').insert([{ 
      telegram_id: getUid(), 
      nickname: final, 
      gender: selG, 
      avatar_id: avatarId, 
      money: refBy ? 4500 : 3500,
      energy: 80, 
      phone_count: 0, 
      last_rest_time: 0,
      referred_by: refBy
    }]).select().single();

    if (error) throw error;
    
    if (refBy && data) {
      const { data: refUser } = await supabase.from('players').select('money').eq('telegram_id', refBy).single();
      if (refUser) {
        await supabase.from('players').update({ money: Number(refUser.money) + 500 }).eq('telegram_id', refBy);
      }
    }

    setPid(data.id); setNick(final); setGender(selG);
    if (refBy) showMsg("Бонус +1000 монет за приглашение!");
  });

  const work = (janitor: boolean) => action(async () => {
    if (energy < 20 || (!phone && !janitor)) return showMsg("Нет условий", true);
    const amount = janitor ? 200 : 500;
    const nM = money + amount, nE = energy - 20;
    setMoney(nM); setEnergy(nE);
    if (!(await sync({ money: nM, energy: nE }))) throw new Error("Ошибка синхронизации");
    addReferralBonus(amount);
    showMsg(`+${amount} монет`); hapticFeedback('medium');
  });

  const rest = () => action(async () => {
    if (tLeft > 0 || energy === 100) return;
    const now = Date.now();
    setEnergy(100); setRestEnd(now + REST_CD);
    if (!(await sync({ energy: 100, last_rest_time: now }))) throw new Error("Ошибка");
    showMsg("Энергия восстановлена!"); hapticFeedback('light');
  });

  const buyCoffee = (cafe: any) => action(async () => {
    if (!cafe.worker_id || money < COFFEE_PRICE || energy === 100) return showMsg("Нельзя купить", true);
    const nM = money - COFFEE_PRICE;
    setMoney(nM); await sync({ money: nM });
    const { data } = await supabase.from('businesses').select('coffee_balance').eq('id', cafe.id).single();
    if (data) await supabase.from('businesses').update({ coffee_balance: (Number(data.coffee_balance) || 0) + 450 }).eq('id', cafe.id);
    
    const { data: bizOwner } = await supabase.from('businesses').select('owner_id').eq('id', cafe.id).single();
    if (bizOwner) {
      const { data: ownerPlayer } = await supabase.from('players').select('referred_by').eq('id', bizOwner.owner_id).single();
      if (ownerPlayer && ownerPlayer.referred_by) {
        const bonus = Math.floor(450 * 0.05);
        const { data: ref } = await supabase.from('players').select('referral_balance').eq('telegram_id', ownerPlayer.referred_by).single();
        if (ref) await supabase.from('players').update({ referral_balance: (Number(ref.referral_balance) || 0) + bonus }).eq('telegram_id', ownerPlayer.referred_by);
      }
    }

    setBrewEnd(Date.now() + BREW_TIME);
    showMsg("Кофе готовится..."); hapticFeedback('heavy');
  });

  const collect = () => action(async () => {
    if (!biz?.coffee_balance) return;
    const inc = biz.coffee_balance;
    const nM = money + inc;
    setMoney(nM); await sync({ money: nM });
    await supabase.from('businesses').update({ coffee_balance: 0 }).eq('id', biz.id);
    addReferralBonus(inc);
    showMsg(`Собрано ${inc}`); hapticFeedback('medium');
    loadData(true);
  });

  const buyBiz = () => action(async () => {
    if (money < BUSINESS_PRICE || biz) return showMsg("Не хватает денег", true);
    const nM = money - BUSINESS_PRICE;
    setMoney(nM);
    if (!(await sync({ money: nM }))) throw new Error("Ошибка");
    const { error } = await supabase.from('businesses').insert([{ owner_id: pid, owner_name: nick, worker_id: null, coffee_balance: 0 }]);
    if (error) { await sync({ money }); setMoney(money); throw error; }
    showMsg("Кофейня открыта!"); hapticFeedback('heavy'); loadData(true);
  });

  const hire = (bId: string) => action(async () => {
    if (job) return showMsg("Вы уже работаете", true);
    await supabase.from('businesses').update({ worker_id: pid, worker_name: nick }).eq('id', bId);
    showMsg("Вы устроены!"); setBoardOpen(false); hapticFeedback('medium'); loadData(true);
  });

  const fire = () => action(async () => {
    if (!biz) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', biz.id);
    showMsg("Вы уволили сотрудника."); hapticFeedback('heavy'); loadData(true);
  });

  const quit = () => action(async () => {
    if (!job) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', job.id);
    setQuitOpen(false); setBoardOpen(false); showMsg("Вы уволились."); hapticFeedback('heavy'); loadData(true);
  });

  const shift = () => action(async () => {
    if (!job || energy < 20) return;
    const nM = money + WORKER_SALARY, nE = energy - 20;
    setMoney(nM); setEnergy(nE); showMsg(`+${WORKER_SALARY} за смену`); hapticFeedback('medium');
    await sync({ money: nM, energy: nE });
    addReferralBonus(WORKER_SALARY);
  });

  const buyPhone = (buy: boolean) => action(async () => {
    if (buy && money < PHONE_PRICE) return showMsg("Мало денег", true);
    const nM = buy ? money - PHONE_PRICE : money + 1400;
    setMoney(nM); setPhone(buy); showMsg(buy ? "Куплено!" : "Сдан за 1400"); hapticFeedback('heavy');
    await sync({ money: nM, phone_count: buy ? 1 : 0 });
  });

  const listPhone = () => action(async () => {
    const p = Number(sellPrice);
    if (isNaN(p) || p <= 0 || !phone) return;
    setPhone(false); setSellOpen(false);
    const { error } = await supabase.from('market_items').insert([{ seller_id: pid, seller_name: nick, item_type: 'phone', price: p }]);
    if (error) { setPhone(true); throw error; }
    await sync({ phone_count: 0 }); setTab('market'); loadMarket(); showMsg("Выставлено!"); hapticFeedback('medium');
  });

  const buyLot = (item: any) => action(async () => {
    if (money < item.price) return showMsg("Мало денег", true);
    const nM = money - item.price;
    setMoney(nM); setPhone(true); showMsg("Покупка успешна!"); hapticFeedback('heavy');
    await supabase.from('players').update({ money: nM, phone_count: 1 }).eq('id', pid);
    await supabase.from('market_items').delete().eq('id', item.id);
    const { data: s } = await supabase.from('players').select('money').eq('id', item.seller_id).single();
    if (s) await supabase.from('players').update({ money: Number(s.money) + item.price }).eq('id', item.seller_id);
    loadMarket();
  });

  const inviteFriend = () => {
    if (!tg || !pid) return;
    hapticFeedback('medium');
    const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${getUid()}`;
    const text = "Смотри какая Житуха залетай и ты! По моему приглашению ты получишь +1000 валюты:";
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`);
  };

  const collectRefBonus = () => action(async () => {
    if (refBalance <= 0) return;
    const nM = money + refBalance;
    setMoney(nM);
    setRefBalance(0);
    await sync({ money: nM, referral_balance: 0 });
    showMsg(`Собрано ${refBalance} с рефералов!`); hapticFeedback('heavy');
    setRefOpen(false);
  });

  const handleAvatar = () => {
    setClicks(c => c + 1);
    if (clicks >= 4) { setAuthOpen(true); setClicks(0); setAdminCode(''); hapticFeedback('heavy'); }
    setTimeout(() => setClicks(0), 2000);
  };
  const checkAuth = () => {
    if (adminCode === ADMIN_CODE) { setAuthOpen(false); setAdminOpen(true); }
    else showMsg("Неверный код!", true);
  };
  const adminMoney = () => action(async () => { setAdminOpen(false); showMsg("+100 000"); setMoney(m => m + 100000); await sync({ money: money + 100000 }); });
  const adminReset = async () => {
    if (!window.confirm("Удалить ВСЕХ?")) return;
    setLoading(true);
    await supabase.from('market_items').delete().gte('created_at', '2000-01-01');
    await supabase.from('businesses').delete().gte('created_at', '2000-01-01');
    await supabase.from('players').delete().gte('created_at', '2000-01-01');
    localStorage.removeItem('zhituha_id'); window.location.reload();
  };

  const bgColors: Record<string, string> = {
    home: 'linear-gradient(180deg, #121212 0%, #1a1a2e 100%)',
    jobs: 'linear-gradient(180deg, #121212 0%, #0f2e1a 100%)',
    market: 'linear-gradient(180deg, #121212 0%, #2e140f 100%)',
    cafe: 'linear-gradient(180deg, #121212 0%, #2e230f 100%)',
    shop: 'linear-gradient(180deg, #121212 0%, #1a1a1a 100%)',
    inventory: 'linear-gradient(180deg, #121212 0%, #221430 100%)',
  };

  const av = getAvatar(avatarId);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка...</div>;

  if (!nick || !gender) return (
    <div style={{ padding: 20, textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {toast && <div style={{ position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#ef4444' : '#10b981', padding: '15px 25px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>{toast.msg}</div>}
      <h1>Житуха</h1><p style={{ color: '#888', marginBottom: '30px' }}>Создай персонажа</p>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => selectGender('male')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selG === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Парень</button>
        <button onClick={() => selectGender('female')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#1e1e24', border: selG === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Девушка</button>
      </div>

      {selG && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', marginBottom: '20px' }}>
          {AVATARS.filter(a => a.gender === selG).map(a => (
            <button key={a.id} onClick={() => { setAvatarId(a.id); hapticFeedback('light'); }} style={{ width: 60, height: 60, borderRadius: '50%', background: a.bg, fontSize: 30, cursor: 'pointer', border: avatarId === a.id ? '3px solid white' : '3px solid transparent', boxShadow: avatarId === a.id ? '0 0 15px rgba(255,255,255,0.5)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>
              {a.emoji}
            </button>
          ))}
        </div>
      )}

      {user?.first_name ? <div style={{ ...S.input, maxWidth: '280px', backgroundColor: 'transparent', border: 'none', fontSize: 22, fontWeight: 'bold' }}>Ник: {user.first_name}</div> : <input type="text" value={inNick} onChange={(e) => setInNick(e.target.value)} placeholder="Ник..." style={{ ...S.input, maxWidth: '280px' }} />}
      <button onClick={reg} disabled={proc} style={{ ...S.btnPrimary, maxWidth: '280px', opacity: proc ? 0.5 : 1 }}>Начать жизнь</button>
    </div>
  );

  return (
    <div style={{ padding: '20px 20px 90px 20px', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', background: bgColors[tab] || '#121212', color: 'white', transition: 'background 0.5s ease' }}>
      
      {toast && <div style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.err ? '#ef4444' : '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '280px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>{toast.msg}</div>}

      {refOpen && <div style={S.modalBg}><div style={S.modalBox}><Gift size={40} color="#ec4899" style={{ marginBottom: 15 }} /><h3 style={{ marginTop: 0, fontSize: 20 }}>Рефералка</h3><p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 15 }}>Приглашено друзей: <b>{myRefs.length}</b></p><div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid rgba(236, 72, 153, 0.2)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#ec4899' }}>Накоплено 5% с доходов:</p><p style={{ margin: 0, fontSize: 24, color: '#ec4899', fontWeight: 'bold' }}>{refBalance} <Coins size={18} style={{ display: 'inline' }} /></p></div><button onClick={collectRefBonus} disabled={proc || refBalance <= 0} style={{ ...S.btnPurple, background: refBalance > 0 ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' : '#333', opacity: (proc || refBalance <= 0) ? 0.5 : 1, marginBottom: 10 }}>Собрать</button><button onClick={() => setRefOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Закрыть</button></div></div>}

      {quitOpen && <div style={S.modalBg}><div style={S.modalBox}><h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3><p style={{ color: '#a1a1aa', fontSize: 15, marginBottom: 20 }}>Ты уверен?</p><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setQuitOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={quit} disabled={proc} style={{ ...S.btnDanger, opacity: proc ? 0.5 : 1 }}>Уволиться</button></div></div></div>}
      {authOpen && <div style={S.modalBg}><div style={S.modalBox}><Lock size={40} color="#f59e0b" style={{ marginBottom: 15 }} /><h3>Код</h3><input type="password" value={adminCode} onChange={e => setAdminCode(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setAuthOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={checkAuth} style={S.btnYellow}>Войти</button></div></div></div>}
      {adminOpen && <div style={S.modalBg}><div style={{ ...S.modalBox, border: '1px solid #ef4444' }}><h3 style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', gap: 10 }}><Settings size={24} /> ADMIN</h3><button onClick={adminMoney} style={{ ...S.btnYellow, marginBottom: 10 }}><Coins size={20} /> +100 000</button><button onClick={adminReset} style={{ ...S.btnDanger, marginBottom: 15 }}><Trash2 size={20} /> Сброс</button><button onClick={() => setAdminOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Закрыть</button></div></div>}
      {sellOpen && <div style={S.modalBg}><div style={S.modalBox}><h3>Продажа</h3><input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setSellOpen(false)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Отмена</button><button onClick={listPhone} style={S.btnPurple}>Выставить</button></div></div></div>}

      {tab === 'home' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
            <div style={{ textAlign: 'left' }} onClick={handleAvatar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '2px solid rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
                  {av.emoji}
                </div>
                <div><div style={{ fontSize: 18, fontWeight: 'bold' }}>{nick}</div><div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> ID: {tgId.slice(0, 6)}</div></div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 'bold' }}>
              <div style={{ color: '#fbbf24', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Coins size={16} /> {money}</div>
              <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}><Zap size={16} /> {energy}/100</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 16, backgroundColor: 'rgba(30, 30, 36, 0.6)', border: '1px solid #8b5cf6', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', backdropFilter: 'blur(10px)' }}><Briefcase size={24} color="#8b5cf6" /><span style={{ fontSize: 12 }}>Бизнес<br />стартапы</span></button>
            <button onClick={() => setTab('cafe')} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 16, backgroundColor: 'rgba(30, 30, 36, 0.6)', border: '1px solid #f97316', color: 'white', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', backdropFilter: 'blur(10px)' }}><Coffee size={24} color="#f97316" /><span style={{ fontSize: 12 }}>Кафе</span></button>
          </div>
          
          <div style={{ display: 'flex', gap: 10, marginBottom: 30 }}>
            <button onClick={inviteFriend} style={{ ...S.btnPurple, flex: 1, background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', padding: 12, fontSize: 14 }}>
              <Share2 size={18} /> Позвать друга
            </button>
            <button onClick={() => setRefOpen(true)} style={{ ...S.btnSecondary, flex: 1, padding: 12, fontSize: 14 }}>
              <Gift size={18} /> Рефералка
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center' }}>
            <button onClick={() => work(true)} disabled={proc || energy < 20} style={{ ...S.btnSecondary, opacity: (proc || energy < 20) ? 0.5 : 1 }}><Users size={20} /> Подработка (+200)</button>
            <button onClick={rest} disabled={proc || tLeft > 0 || energy === 100} style={{ ...S.btnPrimary, background: 'rgba(30, 30, 36, 0.8)', border: '1px solid #10b981', color: tLeft > 0 ? '#888' : '#10b981', boxShadow: 'none', opacity: (proc || tLeft > 0 || energy === 100) ? 0.5 : 1 }}><Zap size={20} /> {tLeft > 0 ? `Ждать ${tLeft} сек.` : 'Отдых (90 сек)'}</button>
          </div>
        </div>
      )}

      {tab === 'cafe' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
          <button onClick={() => { setTab('home'); setSelCafe(null); }} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Кафе</h2>
          {bLeft > 0 ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#f97316" style={{ marginBottom: 15 }} /><h3>Готовим...</h3><p style={{ fontSize: 24, fontWeight: 'bold', color: '#f97316' }}>{bLeft} сек.</p></div>
          : selCafe ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#f97316" style={{ marginBottom: 15 }} /><h3 style={{ marginBottom: 5 }}>Кофейня</h3><p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>Владелец: {selCafe.owner_name}</p><button onClick={() => buyCoffee(selCafe)} disabled={proc || money < COFFEE_PRICE || energy === 100 || !selCafe.worker_id} style={{ ...S.btnYellow, background: (money < COFFEE_PRICE || energy === 100 || !selCafe.worker_id) ? '#333' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: (money < COFFEE_PRICE || energy === 100 || !selCafe.worker_id) ? '#888' : 'white', opacity: (proc || money < COFFEE_PRICE || energy === 100 || !selCafe.worker_id) ? 0.5 : 1, marginBottom: 10 }}>{!selCafe.worker_id ? 'Нет бариста' : energy === 100 ? 'Полная энергия' : money < COFFEE_PRICE ? 'Мало денег' : `Купить кофе за ${COFFEE_PRICE}`}</button><button onClick={() => setSelCafe(null)} style={{ ...S.btnSecondary, background: '#333', boxShadow: 'none' }}>Назад</button></div>
          : <div>{allBiz.filter(b => b.worker_id !== null).map(b => <div key={b.id} onClick={() => setSelCafe(b)} style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', cursor: 'pointer', marginBottom: 10 }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16} /> Кофейня</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div></div><span style={{ color: '#f97316', fontWeight: 'bold' }}>→</span></div>)}{allBiz.filter(b => b.worker_id !== null).length === 0 && <p style={{ color: '#666' }}>Нет открытых кафе.</p>}</div>}
        </div>
      )}

      {tab === 'business' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
          <button onClick={() => setTab('home')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Мой Бизнес</h2>
          {biz ? <div style={S.card}><div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 'bold', marginBottom: 15 }}><Coffee size={28} color="#d97706" /> Кофейня</div><p style={{ color: '#a1a1aa', fontSize: 15, margin: '5px 0 15px 0' }}>Сотрудник: <b style={{ color: '#3b82f6' }}>{biz.worker_name || 'Нет'}</b></p><div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: 15, borderRadius: 12, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#f97316' }}>Выручка</p><p style={{ margin: '0 0 10px 0', fontSize: 22, color: '#f97316', fontWeight: 'bold' }}>В кассе: {biz.coffee_balance || 0} <Coins size={18} style={{ display: 'inline' }} /></p><button onClick={collect} disabled={proc || !biz.coffee_balance || biz.coffee_balance <= 0} style={{ ...S.btnYellow, opacity: (proc || !biz.coffee_balance || biz.coffee_balance <= 0) ? 0.5 : 1, padding: 12 }}>Собрать</button></div>{biz.worker_id && <button onClick={fire} disabled={proc} style={{ ...S.btnDanger, background: 'rgba(239, 68, 68, 0.1)', boxShadow: 'none' }}>Уволить</button>}</div>
          : <div style={{ ...S.card, textAlign: 'center' }}><Store size={48} color="#8b5cf6" style={{ marginBottom: 15 }} /><h3>Открыть Кофейню</h3><button onClick={buyBiz} disabled={proc || money < BUSINESS_PRICE} style={{ ...S.btnPurple, background: money < BUSINESS_PRICE ? '#333' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: money < BUSINESS_PRICE ? '#888' : 'white', opacity: (proc || money < BUSINESS_PRICE) ? 0.5 : 1 }}>{proc ? 'Обработка...' : `Купить за ${BUSINESS_PRICE}`}</button></div>}
        </div>
      )}

      {tab === 'jobs' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Работа</h2>
          {boardOpen ? <div><button onClick={() => setBoardOpen(false)} style={{ background: 'none', border: 'none', color: '#888', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h3 style={{ color: '#a1a1aa', fontSize: 18, marginBottom: 15 }}>Вакансии</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{allBiz.filter(b => !b.worker_id && b.owner_id !== pid).map(b => <div key={b.id} style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: 15, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16} /> Кофейня</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Владелец: {b.owner_name}</div></div>{job ? <button disabled style={{ ...S.btnSecondary, width: 'auto', padding: '8px 14px', fontSize: 13, opacity: 0.5 }}>Уже работаете</button> : <button onClick={() => hire(b.id)} disabled={proc} style={{ ...S.btnSecondary, width: 'auto', padding: '8px 14px', fontSize: 13, opacity: proc ? 0.5 : 1 }}>Устроиться</button>}</div>)}{allBiz.filter(b => !b.worker_id && b.owner_id !== pid).length === 0 && <p style={{ color: '#666', fontSize: 14 }}>Пока нет мест...</p>}</div></div>
          : job ? <div><h3 style={{ color: '#10b981', fontSize: 18, marginBottom: 15 }}>Моя работа</h3><div style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: 20, borderRadius: 16, border: '1px solid #333' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}><Coffee size={24} color="#f97316" /><span style={{ fontSize: 18, fontWeight: 'bold' }}>Кофейня</span></div><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#a1a1aa' }}>Владелец: <b style={{ color: 'white' }}>{job.owner_name}</b></p><p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#a1a1aa' }}>Должность: <b style={{ color: '#3b82f6' }}>Бариста</b></p><button onClick={shift} disabled={proc || energy < 20} style={{ ...S.btnPrimary, opacity: (proc || energy < 20) ? 0.5 : 1, marginBottom: 10 }}>Смена (+300)</button><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setBoardOpen(true)} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: '#333', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>Вакансии</button><button onClick={() => setQuitOpen(true)} disabled={proc} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, fontWeight: 'bold', opacity: proc ? 0.5 : 1 }}>Уволиться</button></div></div></div>
          : <div style={{ ...S.card, textAlign: 'center', marginTop: 50 }}><div style={{ fontSize: 50, marginBottom: 10 }}>📉</div><h3>Вы безработный</h3><p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 20 }}>Пора найти работу!</p><button onClick={() => setBoardOpen(true)} style={S.btnSecondary}><Briefcase size={20} /> Биржа труда</button></div>}
        </div>
      )}

      {tab === 'shop' && <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Магазин</h2><div style={{ ...S.card, textAlign: 'center' }}><Smartphone size={48} color="#a1a1aa" style={{ marginBottom: 15 }} /><h3>Смартфон</h3>{phone ? <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={20} /> Куплено</div> : <button onClick={() => buyPhone(true)} disabled={proc || money < PHONE_PRICE} style={{ ...S.btnPurple, opacity: (proc || money < PHONE_PRICE) ? 0.5 : 1 }}>Купить за 2000</button>}</div></div>}

      {tab === 'market' && <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Рынок</h2><div style={{ marginBottom: 30 }}><h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Топ богачей</h3>{players.map((p, i) => <div key={p.id} style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: '12px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#a1a1aa' }}>#{i + 1}</span><span style={{ fontWeight: 'bold' }}>{p.nickname}</span></div><span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{p.money} <Coins size={14} /></span></div>)}</div><h3 style={{ color: '#a1a1aa', fontSize: 16, marginBottom: 10 }}>Лоты</h3>{market.length === 0 && <p style={{ color: '#666' }}>Пусто...</p>}{market.map(item => <div key={item.id} style={{ backgroundColor: 'rgba(30, 30, 36, 0.6)', backdropFilter: 'blur(10px)', padding: 15, borderRadius: 16, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ textAlign: 'left' }}><div style={{ fontSize: 16, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Smartphone size={18} /> Телефон</div><div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>Продавец: {item.seller_name}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price}</span>{item.seller_id !== pid ? <button onClick={() => buyLot(item)} disabled={proc} style={{ ...S.btnPrimary, width: 'auto', padding: '6px 12px', fontSize: 13, opacity: proc ? 0.5 : 1 }}>Купить</button> : <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>}</div></div>)}</div>}

      {tab === 'inventory' && <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Инвентарь</h2>{phone ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#a1a1aa" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><button onClick={() => setSellOpen(true)} disabled={proc} style={{ ...S.btnPurple, opacity: proc ? 0.5 : 1 }}>Выставить</button><button onClick={() => buyPhone(false)} disabled={proc} style={{ ...S.btnPrimary, opacity: proc ? 0.5 : 1 }}>Сдать (+1400)</button></div> : <div style={{ color: '#52525b', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }} /><br />Пусто...</div>}</div>}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        {[{ id: 'home', icon: Home, text: 'Главная' }, { id: 'jobs', icon: Briefcase, text: 'Работа' }, { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'shop', icon: Store, text: 'Магазин' }, { id: 'inventory', icon: Backpack, text: 'Сумка' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as any); hapticFeedback('light'); setBoardOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: tab === t.id ? '#3b82f6' : '#a1a1aa', transition: 'color 0.2s' }}><t.icon size={22} style={{ marginBottom: 4 }} /><span style={{ fontSize: 10, fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.text}</span></button>
        ))}
      </div>
    </div>
  );
}