import { useState, useEffect, useRef, useMemo } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { Send, ShieldAlert } from 'lucide-react';
import { 
  BOT_USERNAME, CHANNEL_LINK, PHONE_PRICE, WORKER_SALARY, COFFEE_CUP_PRICE, BREW_TIME, POLL, 
  BASE_MAX_ENERGY, HOUSE_MAX_ENERGY, BASE_REST_TIME, LADA_REST_TIME, TOYOTA_REST_TIME, AVATARS, 
  getStock, S, BUILDING_PRICE, BUILDING_TIME, APARTMENTS_PER_BUILD, TAXI_BIZ_PRICE, 
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, 
  CONSTRUCTION_BIZ_PRICE, LADA_PRICE, TOYOTA_PRICE, PHONE_FACTORY_BIZ_PRICE, BUTTON_BATCH_SIZE, 
  BUTTON_BATCH_COST, BUTTON_BATCH_TIME, SMARTPHONE_BATCH_SIZE, SMARTPHONE_BATCH_COST, 
  SMARTPHONE_BATCH_TIME, JOB_WORK, getDayModifier, COFFEE_OWNER_INCOME, PHONE_SELL_TO_SHOP, TAXI_HEALTH_DROP_RATE
} from './constants';
import { Btn, Toast, BottomNav, Modal } from './components';
import { HomeTab, MarketTab, BusinessTab, DailyRewardModal, AdminTab, AppModals, CafeTab, JobsTab, ShopTab, InventoryTab } from './tabs';

export default function App() {
  const { user, hapticFeedback, tg, startParam } = useTelegram();
  
  // Состояния загрузки и профиля
  const [loading, setLoading] = useState(true);
  const [isCheckingSub, setIsCheckingSub] = useState(true);
  const [proc, setProc] = useState(false);
  const [pid, setPid] = useState<string | null>(null);
  const [tgId, setTgId] = useState('');
  const [toast, setToast] = useState<{ msg: string, err: boolean } | null>(null);
  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business' | 'jobs' | 'cafe' | 'admin'>('home');
  const [nick, setNick] = useState('');
  const [inNick, setInNick] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selG, setSelG] = useState<'male' | 'female' | null>(null);
  const [avatarId, setAvatarId] = useState(1);
  const [role, setRole] = useState('player');
  const [isBanned, setIsBanned] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [tutorialWorkClicks, setTutorialWorkClicks] = useState(0);
  const [marketSlots, setMarketSlots] = useState(3);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Экономика и инвентарь
  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phone, setPhone] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [carModel, setCarModel] = useState('none');
  const [hasHouse, setHasHouse] = useState(false);
  const [houseType, setHouseType] = useState('none');
  const [refBalance, setRefBalance] = useState(0);
  const [myRefs, setMyRefs] = useState<any[]>([]);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [boostEnd, setBoostEnd] = useState(0);

  // Таймеры
  const [restEnd, setRestEnd] = useState(0);
  const [brewEnd, setBrewEnd] = useState(0);
  const [tLeft, setTLeft] = useState(0);
  const [bLeft, setBLeft] = useState(0);
  const [carOrderEnd, setCarOrderEnd] = useState(0);
  const [carTimeLeft, setCarTimeLeft] = useState(0);
  const [buildEnd, setBuildEnd] = useState(0);
  const [buildTimeLeft, setBuildTimeLeft] = useState(0);
  const [phoneProdEnd, setPhoneProdEnd] = useState(0);
  const [phoneProdTimeLeft, setPhoneProdTimeLeft] = useState(0);

  // Бизнесы и рынок
  const [myBizs, setMyBizs] = useState<any[]>([]);
  const [activeBizType, setActiveBizType] = useState<'coffee' | 'salon' | 'construction' | 'taxi' | 'phone_factory'>('coffee');
  const [buyingType, setBuyingType] = useState<string | null>(null);
  const [bizNameInput, setBizNameInput] = useState('');
  const [marketTab, setMarketTab] = useState<'items' | 'cars' | 'realestate'>('items');
  const [players, setPlayers] = useState<any[]>([]);
  const [market, setMarket] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [selCafe, setSelCafe] = useState<any>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'players' | 'promos'>('players');

  // Модалки и UI
  const [, setClicks] = useState(0);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modifierOpen, setModifierOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');
  const [sellItemType, setSellItemType] = useState<'phone' | 'car' | 'house'>('phone');
  const [sellItemData, setSellItemData] = useState('none');
  const [sellSource, setSellSource] = useState<'personal' | 'stock' | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const lock = useRef(false);

  // Вычисления
  const maxEnergy = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
  const dayMod = getDayModifier();
  const baseRestTime = carModel === 'toyota' ? TOYOTA_REST_TIME : carModel === 'lada' ? LADA_REST_TIME : BASE_REST_TIME;
  const restTime = dayMod?.type === 'car_sell' ? Math.floor(baseRestTime * 0.8) : baseRestTime;
  const workPay = dayMod?.type === 'work' ? Math.floor(JOB_WORK * 1.5) : JOB_WORK;
  const shiftPay = dayMod?.type === 'shift' ? Math.floor(WORKER_SALARY * 2) : (dayMod?.type === 'work' ? Math.floor(WORKER_SALARY * 1.5) : WORKER_SALARY);

  const showMsg = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); };
  const getUid = () => user?.id?.toString() || localStorage.getItem('zhituha_id') || (() => { const id = 'user_' + Math.random().toString(36).substring(2, 8); localStorage.setItem('zhituha_id', id); return id; })();

  const sendNotification = (text: string) => {
    const uid = getUid();
    if (!uid) return;
    fetch('https://zhituha-ashen.vercel.app/api/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: uid, text })
    }).catch(err => console.error('Ошибка пуша:', err));
  };

  const action = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setProc(true);
    try { await fn(); } catch (e: any) { showMsg(e.message || "Ошибка", true); } finally { lock.current = false; setProc(false); }
  };

  const sync = async (updates: any) => {
    if (!pid) return false;
    const { error } = await supabase.from('players').update(updates).eq('id', pid);
    if (error) throw new Error("Ошибка БД: " + error.message);
    return true;
  };

  const advanceTutorial = async (step: number) => { setOnboardStep(step); await sync({ onboarding_step: step }); };
  const skipTutorial = () => { advanceTutorial(onboardStep + 1); hapticFeedback('light'); };

  // --- ЗАГРУЗКА ДАННЫХ ---
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (lock.current) return;
    try {
      const uid = getUid(); setTgId(uid);
      if (!user?.id) return;
      
      const [pRes, rRes, bRes] = await Promise.all([
        supabase.from('players').select('*').eq('telegram_id', uid).maybeSingle(),
        supabase.from('players').select('nickname').eq('referred_by', uid),
        supabase.from('businesses').select('*')
      ]);

      if (!pRes.data) { if (user?.first_name) setInNick(user.first_name); return; }
      
      const d = pRes.data;
      if (d.is_banned) { setIsBanned(true); setLoading(false); return; }
      
      setPid(d.id); setNick(d.nickname); setGender(d.gender); setAvatarId(d.avatar_id || 1);
      setRole(d.role || 'player'); setMoney(Number(d.money)); setEnergy(Number(d.energy)); 
      setPhone(Number(d.phone_count) > 0); setHasCar(d.has_car || false); setCarModel(d.car_model || 'none');
      setHasHouse(d.has_house || false); setHouseType(d.house_type || 'none');
      setRefBalance(Number(d.referral_balance) || 0); setDailyStreak(Number(d.daily_streak) || 0);
      setBoostEnd(Number(d.boost_end) || 0); setOnboardStep(Number(d.onboarding_step) || 0);
      setMarketSlots(Number(d.market_slots) || 3);

      if (!silent) {
        const timeDiff = Date.now() - (Number(d.last_claim) || 0);
        if (timeDiff > 86400000) { 
           if (timeDiff > 172800000) { setDailyStreak(0); await supabase.from('players').update({ daily_streak: 0 }).eq('id', d.id); }
           setIsDailyOpen(true);
        }
      }
      
      const last = Number(d.last_rest_time) || 0;
      const cRestTime = d.car_model === 'toyota' ? TOYOTA_REST_TIME : d.car_model === 'lada' ? LADA_REST_TIME : BASE_REST_TIME;
      const end = last + cRestTime > Date.now() ? last + cRestTime : 0;
      setRestEnd(end); if (end > 0) setTLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));

      const savedBrew = localStorage.getItem('zhituha_brew_end');
      if (savedBrew) {
        const bEnd = Number(savedBrew);
        if (bEnd > Date.now()) setBrewEnd(bEnd);
        else { 
          localStorage.removeItem('zhituha_brew_end'); 
          setEnergy(d.has_house ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY); 
          await supabase.from('players').update({ energy: d.has_house ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY }).eq('id', d.id); 
        }
      }
      if (rRes.data) setMyRefs(rRes.data);
      if (bRes.data) {
        const myBs = bRes.data.filter((x: any) => x.owner_id === d.id);
        setAllBiz(bRes.data); setMyBizs(myBs);
        setJob(bRes.data.find((x: any) => x.worker_id === d.id) || null);
        setCarOrderEnd(Number(myBs.find((x: any) => x.biz_type === 'salon')?.car_order_end) || 0);
        setBuildEnd(Number(myBs.find((x: any) => x.biz_type === 'construction')?.build_end) || 0);
        setPhoneProdEnd(Number(myBs.find((x: any) => x.biz_type === 'phone_factory')?.build_end) || 0);
      }
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };

  const loadMarket = async () => {
    const [pRes, mRes] = await Promise.all([
      supabase.from('players').select('id, nickname, money').order('money', { ascending: false }).limit(10),
      supabase.from('market_items').select('*').order('created_at', { ascending: false })
    ]);
    if (pRes.data) setPlayers(pRes.data);
    if (mRes.data) setMarket(mRes.data);
  };

  // --- ЭФФЕКТЫ ---
  useEffect(() => { if (user) loadData(); }, [user]);

  useEffect(() => {
    if (tab === 'market') loadMarket();
    if (['business', 'jobs', 'cafe'].includes(tab)) {
      loadData(true);
      const int = setInterval(() => loadData(true), POLL);
      return () => clearInterval(int);
    }
  }, [tab]);

  useEffect(() => {
    if (onboardStep === 3 && tab === 'business') advanceTutorial(4);
    if (onboardStep === 4 && tab === 'market') advanceTutorial(5);
  }, [tab, onboardStep]);

  // Таймеры
  useEffect(() => {
    const int = setInterval(() => {
      const now = Date.now();
      if (restEnd > 0) { const r = Math.max(0, Math.ceil((restEnd - now) / 1000)); setTLeft(r); if (r === 0) setRestEnd(0); }
      
      if (brewEnd > 0) {
        const r = Math.max(0, Math.ceil((brewEnd - now) / 1000)); setBLeft(r);
        if (r === 0) {
          setBrewEnd(0); const target = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
          setEnergy(target); localStorage.removeItem('zhituha_brew_end');
          if (pid) supabase.from('players').update({ energy: target }).eq('id', pid);
          showMsg("Кофе готов! Энергия восстановлена!"); hapticFeedback('heavy');
          sendNotification("☕ Твой кофе готов! Энергия восстановлена, залетай в игру!");
        }
      }
      
      if (carOrderEnd > 0) {
        const r = Math.max(0, Math.ceil((carOrderEnd - now) / 1000)); setCarTimeLeft(r);
        if (r === 0) {
          setCarOrderEnd(0);
          const salon = myBizs.find(b => b.biz_type === 'salon');
          if (salon) supabase.from('businesses').select('stock').eq('id', salon.id).single().then(({ data }) => {
            if (data) {
              const s = getStock(data); const model = s.current_model || 'lada';
              supabase.from('businesses').update({ car_order_end: 0, stock: { ...s, [model]: (s[model] || 0) + 1, current_model: 'none' } }).eq('id', salon.id).then(({ error }) => {
                if (!error) { showMsg(`Машина приехала!`); hapticFeedback('heavy'); loadData(true); sendNotification(`🚗 В автосалон приехала ${model === 'lada' ? 'Лада' : 'Тойота'}!`); }
              });
            }
          });
        }
      } else { setCarTimeLeft(0); }

      if (buildEnd > 0) {
        const r = Math.max(0, Math.ceil((buildEnd - now) / 1000)); setBuildTimeLeft(r);
        if (r === 0) {
          setBuildEnd(0);
          const constr = myBizs.find(b => b.biz_type === 'construction');
          if (constr) supabase.from('businesses').select('stock').eq('id', constr.id).single().then(({ data }) => {
            if (data) {
              const s = getStock(data);
              supabase.from('businesses').update({ build_end: 0, stock: { ...s, apartments: (s.apartments || 0) + APARTMENTS_PER_BUILD } }).eq('id', constr.id).then(({ error }) => {
                if (!error) { showMsg(`Дом построен!`); hapticFeedback('heavy'); loadData(true); sendNotification(`🏗 Дом построен! +${APARTMENTS_PER_BUILD} квартир.`); }
              });
            }
          });
        }
      } else { setBuildTimeLeft(0); }

      if (phoneProdEnd > 0) {
        const r = Math.max(0, Math.ceil((phoneProdEnd - now) / 1000)); setPhoneProdTimeLeft(r);
        if (r === 0) {
          setPhoneProdEnd(0);
          const factory = myBizs.find(b => b.biz_type === 'phone_factory');
          if (factory) supabase.from('businesses').select('stock').eq('id', factory.id).single().then(({ data }) => {
            if (data) {
              const s = getStock(data); const model = s.current_phone_model || 'button'; const amount = model === 'button' ? BUTTON_BATCH_SIZE : SMARTPHONE_BATCH_SIZE;
              supabase.from('businesses').update({ build_end: 0, stock: { ...s, [model]: (s[model] || 0) + amount, current_phone_model: 'none' } }).eq('id', factory.id).then(({ error }) => {
                if (!error) { showMsg(`Партия готова!`); hapticFeedback('heavy'); loadData(true); sendNotification(`📱 Партия телефонов (${amount} шт.) готова!`); }
              });
            }
          });
        }
      } else { setPhoneProdTimeLeft(0); }
    }, 1000);
    return () => clearInterval(int);
  }, [restEnd, brewEnd, carOrderEnd, buildEnd, phoneProdEnd, pid, myBizs, hasHouse]);

  // --- ДЕЙСТВИЯ ---
  const selectGender = (g: 'male' | 'female') => { setSelG(g); setAvatarId(AVATARS.find(a => a.gender === g)?.id || 1); hapticFeedback('light'); };
  
  const reg = () => action(async () => {
    const final = user?.first_name || inNick;
    if (!final.trim() || !selG) return showMsg("Заполни поля!", true);
    let refBy = startParam ? (startParam.startsWith('ref_') ? startParam.split('_')[1] : startParam) : null;
    if (refBy === getUid()) refBy = null;
    
    const { data, error } = await supabase.from('players').insert([{ 
      telegram_id: getUid(), nickname: final, gender: selG, avatar_id: avatarId, 
      money: refBy ? 4500 : 3500, energy: 80, phone_count: 0, has_car: false, has_house: false, 
      last_rest_time: 0, referred_by: refBy, is_subscribed: true, role: 'player', onboarding_step: 0, market_slots: 3 
    }]).select().single();
    
    if (error) throw error;
    if (refBy && data) {
      const { data: rUser } = await supabase.from('players').select('money').eq('telegram_id', refBy).single();
      if (rUser) await supabase.from('players').update({ money: Number(rUser.money) + 500 }).eq('telegram_id', refBy);
    }
    setPid(data.id); setNick(final); setGender(selG);
    if (refBy) showMsg("Бонус +1000 монет за приглашение!");
  });

  const checkSubOnLoad = async () => {
    if (!user?.id) { setIsCheckingSub(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', { body: { telegram_id: user.id.toString() } });
      if (error) throw error;
      setIsSubscribed(data && data.is_member);
    } catch (e) { setIsSubscribed(true); } finally { setIsCheckingSub(false); }
  };
  useEffect(() => { if (user) checkSubOnLoad(); }, [user]);

  const verifySubscription = async () => {
    if (!user?.id) return;
    setIsCheckingSub(true); hapticFeedback('medium');
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', { body: { telegram_id: user.id.toString() } });
      if (error) throw error;
      if (data && data.is_member) {
        setIsSubscribed(true); if (pid) await sync({ is_subscribed: true });
        showMsg("Спасибо за подписку! Добро пожаловать!");
      } else showMsg("Ты еще не подписался на канал!", true);
    } catch (e) { showMsg("Ошибка проверки. Попробуй позже.", true); } finally { setIsCheckingSub(false); }
  };

  const drinkTutorialCoffee = () => action(async () => {
    const target = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
    setEnergy(target); await sync({ energy: target }); await advanceTutorial(3);
    showMsg("Кофе выпит! Энергия восстановлена."); hapticFeedback('heavy');
  });

  const addReferralBonus = async (amount: number) => {
    const { data: me } = await supabase.from('players').select('referred_by').eq('id', pid).single();
    if (!me?.referred_by) return;
    let bonus = Math.floor(amount * 0.05);
    if (dayMod?.type === 'ref') bonus *= 2; 
    if (bonus > 0) await supabase.rpc('add_referral_balance', { p_telegram_id: me.referred_by, p_amount: bonus });
  };

  const claimTutorialReward = () => action(async () => {
    if (onboardStep !== 5) return;
    const nM = money + 2000;
    setMoney(nM); await advanceTutorial(6); await sync({ money: nM });
    showMsg("Туториал пройден! +2000 монет"); hapticFeedback('heavy');
  });

  const claimDaily = () => action(async () => {
    if (dailyStreak >= 7) return showMsg("Приходи завтра!", true);
    const rw = DAILY_REWARDS[dailyStreak]; const now = Date.now(); const newStreak = dailyStreak + 1;
    setDailyStreak(newStreak); setIsDailyOpen(false);
    let updates: any = { daily_streak: newStreak, last_claim: now };
    
    if (rw.type === 'money') {
      const finalAmount = boostEnd > now ? Math.floor(rw.amount * 1.1) : rw.amount;
      setMoney(m => m + finalAmount); updates.money = money + finalAmount;
      if (rw.boost) { const nb = now + 86400000; setBoostEnd(nb); updates.boost_end = nb; showMsg(`Награда: +${finalAmount} монет и БУСТ x1.1!`); }
      else showMsg(`Награда: +${finalAmount} монет!`);
    } else if (rw.type === 'coffee') {
      const target = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
      setEnergy(target); updates.energy = target; showMsg(`Награда: Кофе! Энергия восстановлена!`);
    }
    await sync(updates); hapticFeedback('heavy');
  });

  const addTaxiCar = (model: 'lada' | 'toyota') => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const price = model === 'lada' ? LADA_PRICE : TOYOTA_PRICE;
    if (money < price) return showMsg("Мало денег!", true);
    
    const nM = money - price; setMoney(nM); await sync({ money: nM });
    const s = getStock(taxi); const cars = s.taxi_cars || [];
    cars.push({ model, health: 100, last_claim: Date.now() });
    await supabase.from('businesses').update({ stock: { ...s, taxi_cars: cars } }).eq('id', taxi.id);
    showMsg(`Машина добавлена в таксопарк!`); loadData(true);
  });

  const collectTaxi = () => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const s = getStock(taxi); let cars = s.taxi_cars || [];
    if (!cars.length) return;
    
    const now = Date.now(); let totalIncome = 0;
    let updatedCars = cars.map((car: any) => {
      if (car.health <= 0) return car;
      const hours = Math.min((now - car.last_claim) / 3600000, 8); 
      let income = Math.floor(hours * (car.model === 'lada' ? 1000 : 1500));
      if (dayMod?.type === 'taxi') income *= 2;
      totalIncome += income;
      return { ...car, health: Math.max(0, car.health - Math.floor(hours * TAXI_HEALTH_DROP_RATE)), last_claim: now };
    });
    
    if (totalIncome === 0) return showMsg("Еще рано собирать доход", true);
    const nM = money + totalIncome; setMoney(nM);
    setMyBizs(prev => prev.map(b => b.id === taxi.id ? { ...b, stock: { ...s, taxi_cars: updatedCars } } : b));
    await sync({ money: nM });
    await supabase.from('businesses').update({ stock: { ...s, taxi_cars: updatedCars } }).eq('id', taxi.id);
    showMsg(`Собрано ${totalIncome} монет!`); 
  });

  const repairTaxiCar = (index: number) => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const s = getStock(taxi); const cars = [...(s.taxi_cars || [])]; const car = cars[index];
    const repairCost = car.model === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA;
    if (money < repairCost) return showMsg("Мало денег на ремонт", true);
    
    const nM = money - repairCost; setMoney(nM); await sync({ money: nM });
    cars[index] = { ...car, health: 100, last_claim: Date.now() };
    await supabase.from('businesses').update({ stock: { ...s, taxi_cars: cars } }).eq('id', taxi.id);
    showMsg("Машина отремонтирована!"); loadData(true);
  });

  const orderPhones = (model: 'button' | 'smartphone') => action(async () => {
    const factory = myBizs.find(b => b.biz_type === 'phone_factory');
    if (!factory || phoneProdEnd > 0) return showMsg("Производство уже идет!", true);
    
    const price = model === 'button' ? BUTTON_BATCH_COST : SMARTPHONE_BATCH_COST;
    if (money < price) return showMsg("Мало денег!", true);
    const time = (model === 'button' ? BUTTON_BATCH_TIME : SMARTPHONE_BATCH_TIME) / ((dayMod?.type === 'factory' || dayMod?.type === 'phone_sell') ? 1.5 : 1);
    
    const nM = money - price; setMoney(nM); await sync({ money: nM });
    const end = Date.now() + time; setPhoneProdEnd(end);
    const s = getStock(factory);
    await supabase.from('businesses').update({ build_end: end, stock: { ...s, current_phone_model: model } }).eq('id', factory.id);
    showMsg(`Заказана партия: ${model === 'button' ? 'Кнопочные' : 'Смартфоны'}`); hapticFeedback('heavy');
  });

  const submitBizName = () => action(async () => {
    if (!buyingType) return;
    const name = bizNameInput.trim();
    if (!/^[A-Za-z0-9 ]{3,20}$/.test(name)) return showMsg("Только англ. буквы и цифры (3-20)", true);
    
    const price = buyingType === 'coffee' ? COFFEE_BIZ_PRICE : buyingType === 'salon' ? SALON_BIZ_PRICE : buyingType === 'construction' ? CONSTRUCTION_BIZ_PRICE : buyingType === 'taxi' ? TAXI_BIZ_PRICE : PHONE_FACTORY_BIZ_PRICE;
    if (money < price) return showMsg("Не хватает денег", true);
    
    const { data, error } = await supabase.rpc('buy_business_rpc', { p_owner_id: pid, p_owner_name: nick, p_biz_type: buyingType, p_biz_name: name, p_price: price });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(m => m - price); setBuyingType(null); setBizNameInput('');
    showMsg("Бизнес открыт!"); loadData(true);
  });

  const sellBusiness = (biz: any) => action(async () => {
    if (!window.confirm("Продать бизнес за 50%?")) return;
    const { data, error } = await supabase.rpc('sell_business_rpc', { p_owner_id: pid, p_biz_id: biz.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    setMoney(m => m + data.refund); showMsg(`Бизнес продан за ${data.refund}!`); loadData(true); loadMarket();
  });

  const cancelLot = (item: any) => action(async () => {
    if (!window.confirm("Снять лот?")) return;
    const { data, error } = await supabase.rpc('cancel_lot_rpc', { p_player_id: pid, p_item_id: item.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    if (data.item_type === 'phone' && data.item_data === 'phone') {
      setPhone(true); await sync({ phone_count: 1 });
    } else if (data.item_type === 'phone') {
      const fac = myBizs.find(b => b.biz_type === 'phone_factory');
      if (fac) {
        const s = getStock(fac); const nS = { ...s, [data.item_data]: (s[data.item_data] || 0) + 1 };
        await supabase.from('businesses').update({ stock: nS }).eq('id', fac.id); showMsg("Телефон на складе цеха!");
      }
    } else if (data.item_type === 'car' || data.item_type === 'house') {
      const biz = myBizs.find(b => b.biz_type === (data.item_type === 'car' ? 'salon' : 'construction'));
      if (biz) {
        const s = getStock(biz); const key = data.item_type === 'car' ? data.item_data : 'apartments';
        const nS = { ...s, [key]: (s[key] || 0) + 1 };
        await supabase.from('businesses').update({ stock: nS }).eq('id', biz.id); showMsg("Товар на складе!");
      }
    }
    loadData(true); loadMarket();
  });

  const orderCar = (model: 'lada' | 'toyota') => action(async () => {
    const salon = myBizs.find(b => b.biz_type === 'salon');
    if (!salon || carOrderEnd > 0) return showMsg("У тебя уже едет машина!", true);
    const price = model === 'lada' ? LADA_PRICE : TOYOTA_PRICE;
    if (money < price) return showMsg("Мало денег!", true);
    
    const nM = money - price, end = Date.now() + (model === 'lada' ? 30000 : 120000);
    const nS = { ...getStock(salon), current_model: model };
    const { error: bErr } = await supabase.from('businesses').update({ car_order_end: end, stock: nS }).eq('id', salon.id);
    if (bErr) throw new Error("Ошибка: " + bErr.message);
    
    const { error: mErr } = await supabase.from('players').update({ money: nM }).eq('id', pid);
    if (mErr) { await supabase.from('businesses').update({ car_order_end: salon.car_order_end || 0, stock: salon.stock }).eq('id', salon.id); throw new Error("Ошибка: " + mErr.message); }
    setMoney(nM); setCarOrderEnd(end); setMyBizs(prev => prev.map(b => b.id === salon.id ? { ...b, car_order_end: end, stock: nS } : b));
    showMsg(`Заказ на ${model === 'lada' ? 'Ладу' : 'Тойоту'} оформлен!`); hapticFeedback('heavy');
  });

  const startBuild = () => action(async () => {
    const constr = myBizs.find(b => b.biz_type === 'construction');
    if (!constr || buildEnd > 0) return showMsg("Стройка уже идет!", true);
    if (money < BUILDING_PRICE) return showMsg("Мало денег!", true);
    
    const nM = money - BUILDING_PRICE, end = Date.now() + (BUILDING_TIME / (dayMod?.type === 'build' ? 1.5 : 1));
    const { error: bErr } = await supabase.from('businesses').update({ build_end: end }).eq('id', constr.id);
    if (bErr) throw new Error("Ошибка: " + bErr.message);
    
    const { error: mErr } = await supabase.from('players').update({ money: nM }).eq('id', pid);
    if (mErr) { await supabase.from('businesses').update({ build_end: 0 }).eq('id', constr.id); throw new Error("Ошибка: " + mErr.message); }
    setMoney(nM); setBuildEnd(end); setMyBizs(prev => prev.map(b => b.id === constr.id ? { ...b, build_end: end } : b));
    showMsg("Стройка началась!"); hapticFeedback('heavy');
  });

  const work = () => action(async () => {
    if (energy < 10) return showMsg("Ты слишком устал!", true);
    const nM = money + workPay, nE = energy - 10;
    setMoney(nM); setEnergy(nE); await sync({ money: nM, energy: nE });
    addReferralBonus(workPay); showMsg(`+${workPay} монет`); hapticFeedback('medium');
    if (onboardStep === 0) { if (tutorialWorkClicks >= 2) { setTutorialWorkClicks(0); await advanceTutorial(1); } else setTutorialWorkClicks(c => c + 1); }
  });

  const rest = () => action(async () => {
    if (tLeft > 0 || energy >= maxEnergy) return;
    setEnergy(maxEnergy); setRestEnd(Date.now() + restTime);
    await sync({ energy: maxEnergy, last_rest_time: Date.now() });
    showMsg(`Энергия восстановлена!`); hapticFeedback('light');
    if (onboardStep === 1) await advanceTutorial(2);
  });

  const buyCoffee = (cafe: any) => action(async () => {
    if (!cafe.worker_id || money < COFFEE_CUP_PRICE || energy >= maxEnergy) return showMsg("Нельзя купить", true);
    const coffeeEnergy = Math.floor(30 * (dayMod?.type === 'coffee_energy' ? (dayMod.mult || 1.3) : 1));
    
    const nM = money - COFFEE_CUP_PRICE; setMoney(nM); await sync({ money: nM });
    await supabase.from('businesses').update({ coffee_balance: (Number((await supabase.from('businesses').select('coffee_balance').eq('id', cafe.id).single()).data?.coffee_balance) || 0) + COFFEE_OWNER_INCOME }).eq('id', cafe.id);
    
    if (cafe.owner_id) {
      const { data: pOwn } = await supabase.from('players').select('referred_by').eq('id', cafe.owner_id).single();
      if (pOwn?.referred_by) await supabase.rpc('add_referral_balance', { p_telegram_id: pOwn.referred_by, p_amount: Math.floor(COFFEE_OWNER_INCOME * 0.05) });
    }
    const end = Date.now() + BREW_TIME; setBrewEnd(end); localStorage.setItem('zhituha_brew_end', end.toString());
    showMsg(`Кофе готовится (+${coffeeEnergy} энергии)...`); hapticFeedback('heavy');
    if (onboardStep === 2) await advanceTutorial(3);
  });

  const collect = () => action(async () => {
    const coffeeBiz = myBizs.find(b => b.biz_type === 'coffee');
    if (!coffeeBiz?.coffee_balance) return;
    const nM = money + coffeeBiz.coffee_balance;
    setMoney(nM); setMyBizs(prev => prev.map(b => b.id === coffeeBiz.id ? { ...b, coffee_balance: 0 } : b));
    await sync({ money: nM }); await supabase.from('businesses').update({ coffee_balance: 0 }).eq('id', coffeeBiz.id);
    addReferralBonus(coffeeBiz.coffee_balance); showMsg(`Собрано ${coffeeBiz.coffee_balance}`); hapticFeedback('medium'); 
  });

  const hire = (bId: string) => action(async () => {
    if (job) return showMsg("Вы уже работаете", true);
    await supabase.from('businesses').update({ worker_id: pid, worker_name: nick }).eq('id', bId);
    showMsg("Вы устроены!"); setBoardOpen(false); hapticFeedback('medium'); loadData(true);
  });

  const fire = () => action(async () => {
    const b = myBizs.find(b => b.biz_type === activeBizType); if (!b) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', b.id);
    showMsg("Сотрудник уволен."); hapticFeedback('heavy'); loadData(true);
  });

  const quit = () => action(async () => {
    if (!job) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', job.id);
    setQuitOpen(false); setBoardOpen(false); showMsg("Вы уволились."); hapticFeedback('heavy'); loadData(true);
  });

  const shift = () => action(async () => {
    if (!job || energy < 25) return;
    const nM = money + shiftPay, nE = energy - 25;
    setMoney(nM); setEnergy(nE); showMsg(`+${shiftPay} за смену`); hapticFeedback('medium');
    await sync({ money: nM, energy: nE }); addReferralBonus(shiftPay);
  });

  const buyPhone = (buy: boolean) => action(async () => {
    if (buy && money < PHONE_PRICE) return showMsg("Мало денег", true);
    if (buy && phone) return showMsg("У тебя уже есть телефон", true);
    if (buy && marketSlots >= 10) return showMsg("Максимум слотов", true);
    const nM = buy ? money - PHONE_PRICE : money + PHONE_SELL_TO_SHOP;
    const newSlots = buy ? marketSlots + 1 : Math.max(3, marketSlots - 1);
    setMarketSlots(newSlots); setMoney(nM); setPhone(buy); 
    showMsg(buy ? "Куплено! +1 слот" : `Сдан за ${PHONE_SELL_TO_SHOP}`); hapticFeedback('heavy');
    await sync({ money: nM, phone_count: buy ? 1 : 0, market_slots: newSlots });
  });

  const listItem = () => action(async () => {
    const p = Number(sellPrice); 
    if (isNaN(p) || p <= 0) return showMsg("Неверная цена", true);
    if (!sellItemData || sellItemData === 'none') return showMsg("Неверный предмет", true);
    if (!sellSource) return showMsg("Не выбран источник", true);

    const { data, error } = await supabase.rpc('list_item_rpc', {
      p_seller_id: pid, p_item_type: sellItemType, p_item_data: sellItemData, p_price: p, p_source: sellSource, p_bonus_slots: dayMod?.type === 'market_slots' ? 2 : 0
    });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    setSellOpen(false); setSellSource(null); setTab('market'); loadData(true); loadMarket();
    showMsg("Выставлено!"); hapticFeedback('medium');
  });

  const buyLot = (item: any) => action(async () => {
    if (item.item_type === 'phone' && item.item_data === 'phone' && phone) return showMsg("У тебя уже есть телефон", true);
    const { data, error } = await supabase.rpc('buy_market_item', { p_buyer_id: pid, p_item_id: item.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    const { data: fresh } = await supabase.from('players').select('money').eq('id', pid).single();
    if (fresh) setMoney(Number(fresh.money));

    if (item.item_type === 'phone') {
      const newSlots = Math.min(10, marketSlots + 1);
      setPhone(true); setMarketSlots(newSlots); await sync({ phone_count: 1, market_slots: newSlots });
    }
    if (item.item_type === 'car') { setHasCar(true); setCarModel(item.item_data); }
    if (item.item_type === 'house') { setHasHouse(true); setHouseType(item.item_data); }
    showMsg(`Покупка успешна!`); hapticFeedback('heavy'); loadMarket();
  });

  const inviteFriend = () => {
    if (!tg || !pid) return; hapticFeedback('medium');
    const refLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${getUid()}`;
    const text = "Смотри какая Житуха залетай и ты! По моему приглашению ты получишь +1000 валюты:";
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`);
  };

  const collectRefBonus = () => action(async () => {
    if (refBalance <= 0) return;
    const nM = money + refBalance; setMoney(nM); setRefBalance(0);
    await sync({ money: nM, referral_balance: 0 }); showMsg(`Собрано ${refBalance} с рефералов!`); hapticFeedback('heavy'); setRefOpen(false);
  });

  const handleAvatar = () => {
    if (role === 'superadmin' || role === 'admin') { setTab('admin'); hapticFeedback('heavy'); return; }
    setClicks(c => { 
      if (c + 1 >= 5) { if (role === 'superadmin' || role === 'admin') setTab('admin'); else showMsg("Вы не админ", true); return 0; } 
      return c + 1; 
    });
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => setClicks(0), 2000);
  };

  const redeemPromo = () => action(async () => {
    if (!promoInput) return;
    const { data, error } = await supabase.rpc('redeem_promo', { p_code: promoInput.toUpperCase(), p_player_id: pid });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    setMoney(m => m + data.amount); showMsg(`+${data.amount} монет!`); setPromoOpen(false); setPromoInput('');
  });

  // --- РЕНДЕР ---
  const app = useMemo(() => ({
    user, tg, startParam, proc, toast, tab, setTab, hapticFeedback, nick, money, energy, phone, hasCar, carModel, hasHouse, houseType, refBalance, myRefs, myBizs, activeBizType, setActiveBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, setMarketTab, players, market, job, allBiz, selCafe, setSelCafe, boardOpen, setBoardOpen, sellOpen, setSellOpen, sellPrice, setSellPrice, sellItemType, setSellItemType, sellItemData, setSellItemData, sellSource, setSellSource, quitOpen, setQuitOpen, refOpen, setRefOpen, avatarId, tgId, setInNick, selG, inNick, restEnd, brewEnd, tLeft, bLeft, pid, maxEnergy, restTime, onboardStep, tutorialWorkClicks, marketSlots, workPay, modifierOpen, setModifierOpen, isDailyOpen, setIsDailyOpen, dailyStreak, boostEnd, claimDaily, buyingType, setBuyingType, bizNameInput, setBizNameInput, submitBizName, shiftPay, promoOpen, setPromoOpen, promoInput, setPromoInput, redeemPromo, adminTab, setAdminTab, role, supabase, showMsg, skipTutorial, drinkTutorialCoffee, action, work, rest, buyCoffee, collect, orderCar, startBuild, hire, fire, quit, shift, buyPhone, listItem, buyLot, inviteFriend, collectRefBonus, handleAvatar, verifySubscription, selectGender, reg, claimTutorialReward, cancelLot, sellBusiness, addTaxiCar, collectTaxi, repairTaxiCar, orderPhones, loadData
  }), [
    user, tg, startParam, proc, toast, tab, nick, money, energy, phone, hasCar, carModel, hasHouse, houseType, refBalance, myRefs, myBizs, activeBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, players, market, job, allBiz, selCafe, boardOpen, sellOpen, sellPrice, sellItemType, sellItemData, sellSource, quitOpen, refOpen, avatarId, tgId, selG, inNick, restEnd, brewEnd, tLeft, bLeft, pid, maxEnergy, restTime, onboardStep, tutorialWorkClicks, marketSlots, workPay, modifierOpen, isDailyOpen, dailyStreak, boostEnd, buyingType, bizNameInput, shiftPay, promoOpen, promoInput, adminTab, role
  ]);

  const activeBiz = myBizs.find(b => b.biz_type === activeBizType);
  const currentStock = getStock(activeBiz);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '90px' }}>Загрузка...</div>;
  if (isCheckingSub) return <div style={{ padding: '90px 20px 50px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Send size={50} color="#3b82f6" style={{ marginBottom: 20, animation: 'pulse 1.5s infinite' }} /><h2>Проверяем подписку...</h2></div>;
  if (isBanned) return <div style={{ padding: '90px 20px 50px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><ShieldAlert size={80} color="#ef4444" style={{ marginBottom: 20 }} /><h1>Вы забанены!</h1><p style={{ color: '#8B899A', maxWidth: '300px' }}>Администрация заблокировала ваш аккаунт.</p></div>;
  
  if (user && !isSubscribed) return (
    <div style={{ padding: '90px 20px 50px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Toast toast={toast} /><Send size={60} color="#3b82f6" style={{ marginBottom: 20 }} /><h1>Подпишись на канал!</h1>
      <p style={{ color: '#8B899A', marginBottom: 30, maxWidth: '300px' }}>Чтобы играть в Житуху, нужно быть подписанным на наш канал.</p>
      <Btn variant="secondary" onClick={() => tg?.openTelegramLink(CHANNEL_LINK)} style={{ maxWidth: '280px', marginBottom: 15 }}><Send size={20} /> Подписаться</Btn>
      <Btn variant="primary" onClick={verifySubscription} style={{ maxWidth: '280px' }}>Я подписался</Btn>
    </div>
  );

  if (!nick || !gender) return (
    <div style={{ padding: '90px 20px 50px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Toast toast={toast} /><h1>Житуха</h1><p style={{ color: '#8B899A', marginBottom: '30px' }}>Создай персонажа</p>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => selectGender('male')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#161324', border: selG === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Парень</button>
        <button onClick={() => selectGender('female')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#161324', border: selG === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Девушка</button>
      </div>
      {selG && <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', marginBottom: '20px' }}>{AVATARS.filter(a => a.gender === selG).map(a => <button key={a.id} onClick={() => { setAvatarId(a.id); hapticFeedback('light'); }} style={{ width: 60, height: 60, borderRadius: '50%', background: a.bg, fontSize: 30, cursor: 'pointer', border: avatarId === a.id ? '3px solid white' : '3px solid transparent', boxShadow: avatarId === a.id ? '0 0 15px rgba(255,255,255,0.5)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>{a.emoji}</button>)}</div>}
      {user?.first_name ? <div style={{ ...S.input, maxWidth: '280px', backgroundColor: 'transparent', border: 'none', fontSize: 22, fontWeight: 'bold' }}>Ник: {user.first_name}</div> : <input type="text" value={inNick} onChange={(e: any) => setInNick(e.target.value)} placeholder="Ник..." style={{ ...S.input, maxWidth: '280px' }} />}
      <Btn variant="primary" onClick={reg} disabled={proc} style={{ maxWidth: '280px' }}>Начать жизнь</Btn>
    </div>
  );

  return (
    <div style={{ padding: '90px 20px 90px', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', background: '#16161a', color: 'white' }}>
      <Toast toast={toast} /><DailyRewardModal app={app} /><AppModals app={app} />
      <Modal open={modifierOpen} onClose={() => setModifierOpen(false)}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔥</div>
        <h3 style={{ marginTop: 0, color: dayMod?.color || '#fff' }}>{dayMod?.name || 'Событие'}</h3>
        <p style={{ fontSize: 16 }}>{dayMod?.desc || 'Описание'}</p>
        <p style={{ color: '#8B899A', fontSize: 12, marginBottom: 20 }}>Модификатор действует до полуночи по серверному времени.</p>
        <Btn variant="secondary" onClick={() => setModifierOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Понятно</Btn>
      </Modal>

      {tab === 'home' && <HomeTab app={app} />}
      {tab === 'cafe' && <CafeTab app={app} />}
      {tab === 'business' && <BusinessTab app={app} activeBiz={activeBiz} currentStock={currentStock} />}
      {tab === 'jobs' && <JobsTab app={app} />}
      {tab === 'shop' && <ShopTab app={app} />}
      {tab === 'market' && <MarketTab app={app} />}
      {tab === 'inventory' && <InventoryTab app={app} />}
      {tab === 'admin' && <AdminTab app={app} />}
      {tab !== 'admin' && <BottomNav app={app} />}
    </div>
  );
}