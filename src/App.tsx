import { useState, useEffect, useRef } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';

import { Send, Lock, Settings, Trash2, Coins, UserPlus, Gift, Coffee, Smartphone, CheckCircle2, Backpack, Car, Building, Briefcase, Store } from 'lucide-react';
import { 
  BOT_USERNAME, CHANNEL_LINK, PHONE_PRICE, WORKER_SALARY, COFFEE_CUP_PRICE, ADMIN_CODE, 
  BREW_TIME, POLL, BASE_MAX_ENERGY, HOUSE_MAX_ENERGY, BASE_REST_TIME, LADA_REST_TIME, 
  TOYOTA_REST_TIME, AVATARS, getStock, S, BUILDING_PRICE, BUILDING_TIME, APARTMENTS_PER_BUILD,
  TAXI_BIZ_PRICE, TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS,
  COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, CONSTRUCTION_BIZ_PRICE, LADA_PRICE, TOYOTA_PRICE
} from './constants';
import { Btn, Modal, Toast, BottomNav } from './components';
import { HomeTab, MarketTab, BusinessTab, DailyRewardModal } from './tabs';

export default function App() {
  const { user, hapticFeedback, tg, startParam } = useTelegram();
  
  const [loading, setLoading] = useState(true);
  const [isCheckingSub, setIsCheckingSub] = useState(true);
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
  const [hasCar, setHasCar] = useState(false);
  const [carModel, setCarModel] = useState('none');
  const [hasHouse, setHasHouse] = useState(false);
  const [houseType, setHouseType] = useState('none');
  const [isSubscribed, setIsSubscribed] = useState(false); 
  const [refBalance, setRefBalance] = useState(0);
  const [myRefs, setMyRefs] = useState<any[]>([]);
  
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [boostEnd, setBoostEnd] = useState(0);

  const [restEnd, setRestEnd] = useState(0);
  const [brewEnd, setBrewEnd] = useState(0);
  const [tLeft, setTLeft] = useState(0);
  const [bLeft, setBLeft] = useState(0);

  const [myBizs, setMyBizs] = useState<any[]>([]);
  const [activeBizType, setActiveBizType] = useState<'coffee' | 'salon' | 'construction' | 'taxi'>('coffee');
  
  const [buyingType, setBuyingType] = useState<string | null>(null);
  const [bizNameInput, setBizNameInput] = useState('');
  
  const [carOrderEnd, setCarOrderEnd] = useState(0);
  const [carTimeLeft, setCarTimeLeft] = useState(0);
  const [buildEnd, setBuildEnd] = useState(0);
  const [buildTimeLeft, setBuildTimeLeft] = useState(0);
  const [marketTab, setMarketTab] = useState<'items' | 'cars' | 'realestate'>('items');

  const [players, setPlayers] = useState<any[]>([]);
  const [market, setMarket] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [selCafe, setSelCafe] = useState<any>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  
  const [, setClicks] = useState(0);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');
  const [sellItemType, setSellItemType] = useState<'phone' | 'car' | 'house'>('phone');
  const [sellItemData, setSellItemData] = useState('none');
  const [quitOpen, setQuitOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  const lock = useRef(false);

  const maxEnergy = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
  const restTime = carModel === 'toyota' ? TOYOTA_REST_TIME : carModel === 'lada' ? LADA_REST_TIME : BASE_REST_TIME;

  const showMsg = (msg: string, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 3000); };
  const getUid = () => user?.id?.toString() || localStorage.getItem('zhituha_id') || (() => { const id = 'user_' + Math.random().toString(36).substring(2, 8); localStorage.setItem('zhituha_id', id); return id; })();

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

  const addReferralBonus = async (amount: number) => {
    const { data: me } = await supabase.from('players').select('referred_by').eq('id', pid).single();
    if (!me || !me.referred_by) return;
    const bonus = Math.floor(amount * 0.05);
    if (bonus > 0) await supabase.rpc('add_referral_balance', { p_telegram_id: me.referred_by, p_amount: bonus });
  };

  const checkSubOnLoad = async () => {
    if (!user?.id) { setIsCheckingSub(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', { body: { telegram_id: user.id.toString() } });
      if (error) throw error;
      setIsSubscribed(data && data.is_member);
    } catch (e) { setIsSubscribed(true); } finally { setIsCheckingSub(false); }
  };

  const verifySubscription = async () => {
    if (!user?.id) return;
    setIsCheckingSub(true); hapticFeedback('medium');
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', { body: { telegram_id: user.id.toString() } });
      if (error) throw error;
      if (data && data.is_member) {
        setIsSubscribed(true);
        if (pid) await sync({ is_subscribed: true });
        showMsg("Спасибо за подписку! Добро пожаловать!");
      } else showMsg("Ты еще не подписался на канал!", true);
    } catch (e) { showMsg("Ошибка проверки. Попробуй позже.", true); } finally { setIsCheckingSub(false); }
  };

  useEffect(() => { if (user) checkSubOnLoad(); }, [user]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (lock.current) return;
    try {
      const uid = getUid(); setTgId(uid);
      if (user?.id) {
        const [pRes, rRes, bRes] = await Promise.all([
          supabase.from('players').select('*').eq('telegram_id', uid).maybeSingle(),
          supabase.from('players').select('nickname').eq('referred_by', uid),
          supabase.from('businesses').select('*')
        ]);
        if (pRes.data) {
          const data = pRes.data;
          setPid(data.id); setNick(data.nickname); setGender(data.gender); setAvatarId(data.avatar_id || 1);
          setMoney(Number(data.money)); setEnergy(Number(data.energy)); setPhone(Number(data.phone_count) > 0);
          setHasCar(data.has_car || false); setCarModel(data.car_model || 'none');
          setHasHouse(data.has_house || false); setHouseType(data.house_type || 'none');
          setRefBalance(Number(data.referral_balance) || 0);
          setDailyStreak(Number(data.daily_streak) || 0);
          setBoostEnd(Number(data.boost_end) || 0);

          if (!silent) {
            const now = Date.now();
            const timeDiff = now - (Number(data.last_claim) || 0);
            if (timeDiff > 86400000) { 
               if (timeDiff > 172800000) { 
                  setDailyStreak(0);
                  await supabase.from('players').update({ daily_streak: 0 }).eq('id', data.id);
               }
               setIsDailyOpen(true);
            }
          }
          
          const last = Number(data.last_rest_time) || 0;
          setRestEnd(last + (data.car_model === 'toyota' ? TOYOTA_REST_TIME : data.car_model === 'lada' ? LADA_REST_TIME : BASE_REST_TIME) > Date.now() ? last + (data.car_model === 'toyota' ? TOYOTA_REST_TIME : data.car_model === 'lada' ? LADA_REST_TIME : BASE_REST_TIME) : 0);

          const savedBrew = localStorage.getItem('zhituha_brew_end');
          if (savedBrew) {
            const bEnd = Number(savedBrew);
            if (bEnd > Date.now()) setBrewEnd(bEnd);
            else { localStorage.removeItem('zhituha_brew_end'); setEnergy(data.has_house ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY); await supabase.from('players').update({ energy: data.has_house ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY }).eq('id', data.id); }
          }
          if (rRes.data) setMyRefs(rRes.data);
          if (bRes.data) {
            const myBs = bRes.data.filter((x: any) => x.owner_id === data.id);
            setAllBiz(bRes.data); setMyBizs(myBs);
            setJob(bRes.data.find((x: any) => x.worker_id === data.id) || null);
            const salon = myBs.find((x: any) => x.biz_type === 'salon');
            if (salon) setCarOrderEnd(Number(salon.car_order_end) || 0);
            const constr = myBs.find((x: any) => x.biz_type === 'construction');
            if (constr) setBuildEnd(Number(constr.build_end) || 0);
          }
        } else if (user?.first_name) setInNick(user.first_name);
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
      if (restEnd > 0) { const r = Math.max(0, Math.ceil((restEnd - now) / 1000)); setTLeft(r); if (r === 0) setRestEnd(0); }
      if (brewEnd > 0) {
        const r = Math.max(0, Math.ceil((brewEnd - now) / 1000)); setBLeft(r);
        if (r === 0) {
          setBrewEnd(0); 
          const targetEnergy = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
          setEnergy(targetEnergy); localStorage.removeItem('zhituha_brew_end');
          if (pid) supabase.from('players').update({ energy: targetEnergy }).eq('id', pid);
          showMsg("Кофе готов! Энергия восстановлена!"); hapticFeedback('heavy');
        }
      }
      if (carOrderEnd > 0) {
        const r = Math.max(0, Math.ceil((carOrderEnd - now) / 1000)); setCarTimeLeft(r);
        if (r === 0) {
          setCarOrderEnd(0);
          const salon = myBizs.find(b => b.biz_type === 'salon');
          if (salon) {
            supabase.from('businesses').select('stock').eq('id', salon.id).single().then(({ data }) => {
              if (data) {
                const currentStock = getStock(data);
                const model = currentStock.current_model || 'lada';
                const newStock = { ...currentStock, [model]: (currentStock[model] || 0) + 1, current_model: 'none' };
                supabase.from('businesses').update({ car_order_end: 0, stock: newStock }).eq('id', salon.id).then(({ error }) => {
                  if (!error) { showMsg(`Машина приехала на склад!`); hapticFeedback('heavy'); loadData(true); }
                });
              }
            });
          }
        }
      } else { setCarTimeLeft(0); }

      if (buildEnd > 0) {
        const r = Math.max(0, Math.ceil((buildEnd - now) / 1000)); setBuildTimeLeft(r);
        if (r === 0) {
          setBuildEnd(0);
          const constr = myBizs.find(b => b.biz_type === 'construction');
          if (constr) {
            supabase.from('businesses').select('stock').eq('id', constr.id).single().then(({ data }) => {
              if (data) {
                const currentStock = getStock(data);
                const newStock = { ...currentStock, apartments: (currentStock.apartments || 0) + APARTMENTS_PER_BUILD };
                supabase.from('businesses').update({ build_end: 0, stock: newStock }).eq('id', constr.id).then(({ error }) => {
                  if (!error) { showMsg(`Дом построен! ${APARTMENTS_PER_BUILD} квартир на складе.`); hapticFeedback('heavy'); loadData(true); }
                });
              }
            });
          }
        }
      } else { setBuildTimeLeft(0); }
    }, 1000);
    return () => clearInterval(int);
  }, [restEnd, brewEnd, carOrderEnd, buildEnd, pid, myBizs, hasHouse]);

  const selectGender = (g: 'male' | 'female') => { setSelG(g); setAvatarId(AVATARS.find(a => a.gender === g)?.id || 1); hapticFeedback('light'); };
  const reg = () => action(async () => {
    const final = user?.first_name || inNick;
    if (!final.trim() || !selG) return showMsg("Заполни поля!", true);
    let refBy = null;
    if (startParam) { refBy = startParam.startsWith('ref_') ? startParam.split('_')[1] : startParam; if (refBy === getUid()) refBy = null; }
    let { data, error } = await supabase.from('players').insert([{ telegram_id: getUid(), nickname: final, gender: selG, avatar_id: avatarId, money: refBy ? 4500 : 3500, energy: 80, phone_count: 0, has_car: false, has_house: false, last_rest_time: 0, referred_by: refBy, is_subscribed: true }]).select().single();
    if (error) throw error;
    if (refBy && data) {
      const { data: rUser } = await supabase.from('players').select('money').eq('telegram_id', refBy).single();
      if (rUser) await supabase.from('players').update({ money: Number(rUser.money) + 500 }).eq('telegram_id', refBy);
    }
    setPid(data.id); setNick(final); setGender(selG);
    if (refBy) showMsg("Бонус +1000 монет за приглашение!");
  });

  const claimDaily = () => action(async () => {
    if (dailyStreak >= 7) return showMsg("Приходи завтра!", true);
    const rw = DAILY_REWARDS[dailyStreak];
    const now = Date.now();
    const newStreak = dailyStreak + 1;
    
    setDailyStreak(newStreak); setIsDailyOpen(false);
    
    let updates: any = { daily_streak: newStreak, last_claim: now };
    
    if (rw.type === 'money') {
      const boostActive = boostEnd > now;
      const finalAmount = boostActive ? Math.floor(rw.amount * 1.1) : rw.amount;
      setMoney(m => m + finalAmount);
      updates.money = money + finalAmount;
      
      if (rw.boost) {
        const newBoostEnd = now + 86400000;
        setBoostEnd(newBoostEnd);
        updates.boost_end = newBoostEnd;
        showMsg(`Награда: +${finalAmount} монет и БУСТ x1.1 на 24ч!`);
      } else {
        showMsg(`Награда: +${finalAmount} монет!`);
      }
    } else if (rw.type === 'coffee') {
      const targetEnergy = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
      setEnergy(targetEnergy);
      updates.energy = targetEnergy;
      showMsg(`Награда: Кофе! Энергия восстановлена!`);
    }
    
    await sync(updates);
    hapticFeedback('heavy');
  });

  const addTaxiCar = (model: 'lada' | 'toyota') => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const price = model === 'lada' ? LADA_PRICE : TOYOTA_PRICE;
    if (money < price) return showMsg("Мало денег!", true);
    
    const nM = money - price;
    setMoney(nM); await sync({ money: nM });
    
    const currentStock = getStock(taxi);
    const cars = currentStock.taxi_cars || [];
    cars.push({ model, health: 100, last_claim: Date.now() });
    
    await supabase.from('businesses').update({ stock: { ...currentStock, taxi_cars: cars } }).eq('id', taxi.id);
    showMsg(`Машина добавлена в таксопарк!`); loadData(true);
  });

  const collectTaxi = () => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const currentStock = getStock(taxi);
    let cars = currentStock.taxi_cars || [];
    if (!cars.length) return;
    
    const now = Date.now();
    let totalIncome = 0;
    let updatedCars = cars.map((car: any) => {
      if (car.health <= 0) return car;
      const hours = (now - car.last_claim) / 3600000;
      const income = Math.floor(hours * (car.model === 'lada' ? 500 : 1500));
      let healthDrop = Math.floor(hours * 10);
      let newHealth = Math.max(0, car.health - healthDrop);
      totalIncome += income;
      return { ...car, health: newHealth, last_claim: now };
    });
    
    if (totalIncome === 0) return showMsg("Еще рано собирать доход", true);
    
    const nM = money + totalIncome;
    setMoney(nM); await sync({ money: nM });
    await supabase.from('businesses').update({ stock: { ...currentStock, taxi_cars: updatedCars } }).eq('id', taxi.id);
    showMsg(`Собрано ${totalIncome} монет!`); loadData(true);
  });

  const repairTaxiCar = (index: number) => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const currentStock = getStock(taxi);
    const cars = [...(currentStock.taxi_cars || [])];
    const car = cars[index];
    const repairCost = car.model === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA;
    
    if (money < repairCost) return showMsg("Мало денег на ремонт", true);
    
    const nM = money - repairCost;
    setMoney(nM); await sync({ money: nM });
    
    cars[index] = { ...car, health: 100, last_claim: Date.now() };
    await supabase.from('businesses').update({ stock: { ...currentStock, taxi_cars: cars } }).eq('id', taxi.id);
    showMsg("Машина отремонтирована!"); loadData(true);
  });

  const submitBizName = () => action(async () => {
    if (!buyingType) return;
    const name = bizNameInput.trim();
    if (!/^[A-Za-z0-9 ]{3,20}$/.test(name)) return showMsg("Только англ. буквы и цифры (3-20 символов)", true);
    
    const price = buyingType === 'coffee' ? COFFEE_BIZ_PRICE : buyingType === 'salon' ? SALON_BIZ_PRICE : buyingType === 'construction' ? CONSTRUCTION_BIZ_PRICE : TAXI_BIZ_PRICE;
    if (money < price) return showMsg("Не хватает денег", true);
    
    const { data, error } = await supabase.rpc('buy_business_rpc', { 
      p_owner_id: pid, p_owner_name: nick, p_biz_type: buyingType, p_biz_name: name, p_price: price 
    });
    
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(m => m - price);
    setBuyingType(null);
    setBizNameInput('');
    showMsg("Бизнес открыт!"); loadData(true);
  });

  const sellBusiness = (biz: any) => action(async () => {
    if (!window.confirm("Продать бизнес за 50% от стоимости?")) return;
    
    await supabase.from('market_items').delete().eq('seller_id', pid).in('item_type', ['car', 'house']);
    
    const refund = biz.biz_type === 'coffee' ? COFFEE_BIZ_PRICE/2 : biz.biz_type === 'salon' ? SALON_BIZ_PRICE/2 : biz.biz_type === 'construction' ? CONSTRUCTION_BIZ_PRICE/2 : TAXI_BIZ_PRICE/2;
    
    const nM = money + refund;
    setMoney(nM); await sync({ money: nM });
    
    await supabase.from('businesses').delete().eq('id', biz.id);
    showMsg(`Бизнес продан за ${refund}!`); loadData(true);
  });

  const cancelLot = (item: any) => action(async () => {
    if (!window.confirm("Снять лот с продажи?")) return;
    
    const { error } = await supabase.from('market_items').delete().eq('id', item.id);
    if (error) throw error;
    
    if (item.item_type === 'phone') {
      setPhone(true); await sync({ phone_count: 1 });
    } else if (item.item_type === 'car' || item.item_type === 'house') {
      const bType = item.item_type === 'car' ? 'salon' : 'construction';
      const biz = myBizs.find(b => b.biz_type === bType);
      if (biz) {
        const currentStock = getStock(biz);
        const key = item.item_type === 'car' ? item.item_data : 'apartments';
        const newStock = { ...currentStock, [key]: (currentStock[key] || 0) + 1 };
        await supabase.from('businesses').update({ stock: newStock }).eq('id', biz.id);
        showMsg("Товар возвращен на склад бизнеса!"); loadData(true);
      } else {
        showMsg("Ошибка: бизнес не найден, товар потерян", true);
      }
    }
  });

  const orderCar = (model: 'lada' | 'toyota') => action(async () => {
    const salon = myBizs.find(b => b.biz_type === 'salon');
    if (!salon || carOrderEnd > 0) return showMsg("У тебя уже едет машина!", true);
    const price = model === 'lada' ? LADA_PRICE : TOYOTA_PRICE, time = model === 'lada' ? 30000 : 120000;
    if (money < price) return showMsg("Мало денег!", true);
    const nM = money - price, end = Date.now() + time;
    const newStock = { ...getStock(salon), current_model: model };
    const { error: bErr } = await supabase.from('businesses').update({ car_order_end: end, stock: newStock }).eq('id', salon.id);
    if (bErr) throw new Error("Ошибка автосалона: " + bErr.message);
    const { error: mErr } = await supabase.from('players').update({ money: nM }).eq('id', pid);
    if (mErr) { await supabase.from('businesses').update({ car_order_end: salon.car_order_end || 0, stock: salon.stock }).eq('id', salon.id); throw new Error("Ошибка списания: " + mErr.message); }
    setMoney(nM); setCarOrderEnd(end); setMyBizs(prev => prev.map(b => b.id === salon.id ? { ...b, car_order_end: end, stock: newStock } : b));
    showMsg(`Заказ на ${model === 'lada' ? 'Ладу' : 'Тойоту'} оформлен!`); hapticFeedback('heavy');
  });

  const startBuild = () => action(async () => {
    const constr = myBizs.find(b => b.biz_type === 'construction');
    if (!constr || buildEnd > 0) return showMsg("Стройка уже идет!", true);
    if (money < BUILDING_PRICE) return showMsg("Мало денег!", true);
    const nM = money - BUILDING_PRICE, end = Date.now() + BUILDING_TIME;
    const { error: bErr } = await supabase.from('businesses').update({ build_end: end }).eq('id', constr.id);
    if (bErr) throw new Error("Ошибка стройки: " + bErr.message);
    const { error: mErr } = await supabase.from('players').update({ money: nM }).eq('id', pid);
    if (mErr) { await supabase.from('businesses').update({ build_end: 0 }).eq('id', constr.id); throw new Error("Ошибка денег: " + mErr.message); }
    setMoney(nM); setBuildEnd(end); setMyBizs(prev => prev.map(b => b.id === constr.id ? { ...b, build_end: end } : b));
    showMsg("Стройка дома началась!"); hapticFeedback('heavy');
  });

  const work = () => action(async () => {
    if (energy < 20) return showMsg("Ты слишком устал!", true);
    const baseAmount = 200;
    const boostActive = boostEnd > Date.now();
    const amount = boostActive ? 220 : baseAmount;
    const nM = money + amount, nE = energy - 20;
    setMoney(nM); setEnergy(nE); await sync({ money: nM, energy: nE });
    addReferralBonus(amount); showMsg(`+${amount} монет${boostActive ? ' (Буст!)' : ''}`); hapticFeedback('medium');
  });

  const rest = () => action(async () => {
    if (tLeft > 0 || energy >= maxEnergy) return;
    const now = Date.now();
    setEnergy(maxEnergy); setRestEnd(now + restTime);
    await sync({ energy: maxEnergy, last_rest_time: now });
    showMsg(`Энергия восстановлена!`); hapticFeedback('light');
  });

  const buyCoffee = (cafe: any) => action(async () => {
    if (!cafe.worker_id || money < COFFEE_CUP_PRICE || energy >= maxEnergy) return showMsg("Нельзя купить", true);
    const nM = money - COFFEE_CUP_PRICE; setMoney(nM); await sync({ money: nM });
    const { data } = await supabase.from('businesses').select('coffee_balance').eq('id', cafe.id).single();
    if (data) await supabase.from('businesses').update({ coffee_balance: (Number(data.coffee_balance) || 0) + 450 }).eq('id', cafe.id);
    const { data: bOwn } = await supabase.from('businesses').select('owner_id').eq('id', cafe.id).single();
    if (bOwn) {
      const { data: pOwn } = await supabase.from('players').select('referred_by').eq('id', bOwn.owner_id).single();
      if (pOwn && pOwn.referred_by) await supabase.rpc('add_referral_balance', { p_telegram_id: pOwn.referred_by, p_amount: Math.floor(450 * 0.05) });
    }
    const end = Date.now() + BREW_TIME; setBrewEnd(end); localStorage.setItem('zhituha_brew_end', end.toString());
    showMsg("Кофе готовится..."); hapticFeedback('heavy');
  });

  const collect = () => action(async () => {
    const coffeeBiz = myBizs.find(b => b.biz_type === 'coffee');
    if (!coffeeBiz?.coffee_balance) return;
    const inc = coffeeBiz.coffee_balance, nM = money + inc;
    setMoney(nM); await sync({ money: nM }); await supabase.from('businesses').update({ coffee_balance: 0 }).eq('id', coffeeBiz.id);
    addReferralBonus(inc); showMsg(`Собрано ${inc}`); hapticFeedback('medium'); loadData(true);
  });

  const hire = (bId: string) => action(async () => {
    if (job) return showMsg("Вы уже работаете", true);
    const { error } = await supabase.from('businesses').update({ worker_id: pid, worker_name: nick }).eq('id', bId);
    if (error) throw error;
    showMsg("Вы устроены!"); setBoardOpen(false); hapticFeedback('medium'); loadData(true);
  });

  const fire = () => action(async () => {
    const activeBiz = myBizs.find(b => b.biz_type === activeBizType);
    if (!activeBiz) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', activeBiz.id);
    showMsg("Вы уволили сотрудника."); hapticFeedback('heavy'); loadData(true);
  });

  const quit = () => action(async () => {
    if (!job) return;
    await supabase.from('businesses').update({ worker_id: null, worker_name: null }).eq('id', job.id);
    setQuitOpen(false); setBoardOpen(false); showMsg("Вы уволились."); hapticFeedback('heavy'); loadData(true);
  });

  const shift = () => action(async () => {
    if (!job || energy < 20) return;
    const boostActive = boostEnd > Date.now();
    const amount = boostActive ? 330 : WORKER_SALARY;
    const nM = money + amount, nE = energy - 20;
    setMoney(nM); setEnergy(nE); showMsg(`+${amount} за смену${boostActive ? ' (Буст!)' : ''}`); hapticFeedback('medium');
    await sync({ money: nM, energy: nE }); addReferralBonus(amount);
  });

  const buyPhone = (buy: boolean) => action(async () => {
    if (buy && money < PHONE_PRICE) return showMsg("Мало денег", true);
    const nM = buy ? money - PHONE_PRICE : money + 1400;
    setMoney(nM); setPhone(buy); showMsg(buy ? "Куплено!" : "Сдан за 1400"); hapticFeedback('heavy');
    await sync({ money: nM, phone_count: buy ? 1 : 0 });
  });

  const listItem = () => action(async () => {
    const p = Number(sellPrice); if (isNaN(p) || p <= 0) return;
    
    let bizName = nick;
    
    if (sellItemType === 'car' || sellItemType === 'house') {
      const activeBiz = myBizs.find(b => b.biz_type === (sellItemType === 'car' ? 'salon' : 'construction'));
      if (activeBiz) bizName = activeBiz.business_name;
    }

    const currentStock = getStock(myBizs.find(b => b.biz_type === (sellItemType === 'car' ? 'salon' : 'construction')));
    if (sellItemType === 'phone' && !phone) return;
    if (sellItemType === 'car' && !hasCar && !(sellItemData === 'lada' && currentStock.lada > 0) && !(sellItemData === 'toyota' && currentStock.toyota > 0)) return;
    if (sellItemType === 'house' && !(currentStock.apartments > 0)) return;

    const { error } = await supabase.from('market_items').insert([{ seller_id: pid, seller_name: bizName, item_type: sellItemType, item_data: sellItemData, price: p }]);
    if (error) throw error;
    
    if (sellItemType === 'phone') { setPhone(false); await sync({ phone_count: 0 }); } 
    else if (sellItemType === 'car') {
      const activeBiz = myBizs.find(b => b.biz_type === 'salon');
      if (hasCar) { setHasCar(false); await sync({ has_car: false, car_model: 'none' }); setCarModel('none'); }
      else if (activeBiz) { const nS = { ...currentStock, [sellItemData]: currentStock[sellItemData] - 1 }; await supabase.from('businesses').update({ stock: nS }).eq('id', activeBiz.id); setMyBizs(prev => prev.map(b => b.id === activeBiz.id ? { ...b, stock: nS } : b)); }
    } else if (sellItemType === 'house') {
      const activeBiz = myBizs.find(b => b.biz_type === 'construction');
      if (hasHouse) { setHasHouse(false); await sync({ has_house: false, house_type: 'none' }); setHouseType('none'); }
      else if (activeBiz) { const nS = { ...currentStock, apartments: currentStock.apartments - 1 }; await supabase.from('businesses').update({ stock: nS }).eq('id', activeBiz.id); setMyBizs(prev => prev.map(b => b.id === activeBiz.id ? { ...b, stock: nS } : b)); }
    }
    setSellOpen(false); setTab('market'); loadMarket(); showMsg("Выставлено!"); hapticFeedback('medium');
  });

  const buyLot = (item: any) => action(async () => {
    const { data, error } = await supabase.rpc('buy_market_item', { p_buyer_id: pid, p_item_id: item.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    setMoney(m => m - item.price); 
    if (item.item_type === 'phone') setPhone(true);
    if (item.item_type === 'car') { setHasCar(true); setCarModel(item.item_data); }
    if (item.item_type === 'house') { setHasHouse(true); setHouseType(item.item_data); }
    showMsg("Покупка успешна!"); hapticFeedback('heavy'); loadMarket();
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
    setClicks(c => { if (c + 1 >= 5) { setAuthOpen(true); setAdminCode(''); hapticFeedback('heavy'); return 0; } return c + 1; });
    if (clickTimeout.current) clearTimeout(clickTimeout.current);
    clickTimeout.current = setTimeout(() => setClicks(0), 2000);
  };
  const checkAuth = () => { if (adminCode === ADMIN_CODE) { setAuthOpen(false); setAdminOpen(true); } else showMsg("Неверный код!", true); };
  const adminMoney = () => action(async () => { setAdminOpen(false); showMsg("+100 000"); setMoney(m => m + 100000); await sync({ money: money + 100000 }); });
  const adminReset = async () => {
    if (!window.confirm("Удалить ВСЕХ?")) return; setLoading(true);
    await supabase.from('market_items').delete().gte('created_at', '2000-01-01');
    await supabase.from('businesses').delete().gte('created_at', '2000-01-01');
    await supabase.from('players').delete().gte('created_at', '2000-01-01');
    localStorage.removeItem('zhituha_id'); window.location.reload();
  };

  const app = {
    user, tg, startParam, proc, toast, tab, setTab, hapticFeedback, nick, money, energy, phone, hasCar, carModel, hasHouse, houseType, refBalance, myRefs, myBizs, activeBizType, setActiveBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, marketTab, setMarketTab, players, market, job, allBiz, selCafe, setSelCafe, boardOpen, setBoardOpen, authOpen, setAuthOpen, adminOpen, setAdminOpen, adminCode, setAdminCode, sellOpen, setSellOpen, sellPrice, setSellPrice, sellItemType, setSellItemType, sellItemData, setSellItemData, quitOpen, setQuitOpen, refOpen, setRefOpen, avatarId, tgId, setInNick, selG, inNick, restEnd, brewEnd, tLeft, bLeft, pid, maxEnergy, restTime,
    isDailyOpen, setIsDailyOpen, dailyStreak, boostEnd, claimDaily, buyingType, setBuyingType, bizNameInput, setBizNameInput, submitBizName,
    action, work, rest, buyCoffee, collect, orderCar, startBuild, hire, fire, quit, shift, buyPhone, listItem, buyLot, inviteFriend, collectRefBonus, handleAvatar, checkAuth, adminMoney, adminReset, verifySubscription, selectGender, reg,
    cancelLot, sellBusiness, addTaxiCar, collectTaxi, repairTaxiCar
  };

  const bgColors: Record<string, string> = { home: '#16161a', jobs: '#16161a', market: '#16161a', cafe: '#16161a', shop: '#16161a', inventory: '#16161a' };
  const activeBiz = myBizs.find(b => b.biz_type === activeBizType);
  const currentStock = getStock(activeBiz);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '90px' }}>Загрузка...</div>;
  if (isCheckingSub) return <div style={{ padding: '90px 20px 50px 20px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Send size={50} color="#3b82f6" style={{ marginBottom: 20, animation: 'pulse 1.5s infinite' }} /><h2>Проверяем подписку...</h2></div>;

  if (user && !isSubscribed) return (
    <div style={{ padding: '90px 20px 50px 20px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Toast toast={toast} /><Send size={60} color="#3b82f6" style={{ marginBottom: 20 }} /><h1 style={{ marginBottom: 10 }}>Подпишись на канал!</h1>
      <p style={{ color: '#8B899A', marginBottom: 30, maxWidth: '300px' }}>Чтобы играть в Житуху, нужно быть подписанным на наш новостной канал.</p>
      <Btn variant="secondary" onClick={() => tg?.openTelegramLink(CHANNEL_LINK)} style={{ maxWidth: '280px', marginBottom: 15 }}><Send size={20} /> Подписаться</Btn>
      <Btn variant="primary" onClick={verifySubscription} style={{ maxWidth: '280px' }}>Я подписался</Btn>
    </div>
  );

  if (!nick || !gender) return (
    <div style={{ padding: '90px 20px 50px 20px', textAlign: 'center', minHeight: '100vh', backgroundColor: '#16161a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Toast toast={toast} /><h1>Житуха</h1><p style={{ color: '#8B899A', marginBottom: '30px' }}>Создай персонажа</p>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => selectGender('male')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'male' ? 'rgba(59, 130, 246, 0.2)' : '#161324', border: selG === 'male' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Парень</button>
        <button onClick={() => selectGender('female')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'female' ? 'rgba(59, 130, 246, 0.2)' : '#161324', border: selG === 'female' ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: 16, color: 'white' }}>Девушка</button>
      </div>
      {selG && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', marginBottom: '20px' }}>
          {AVATARS.filter(a => a.gender === selG).map(a => (
            <button key={a.id} onClick={() => { setAvatarId(a.id); hapticFeedback('light'); }} style={{ width: 60, height: 60, borderRadius: '50%', background: a.bg, fontSize: 30, cursor: 'pointer', border: avatarId === a.id ? '3px solid white' : '3px solid transparent', boxShadow: avatarId === a.id ? '0 0 15px rgba(255,255,255,0.5)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>{a.emoji}</button>
          ))}
        </div>
      )}
      {user?.first_name ? <div style={{ ...S.input, maxWidth: '280px', backgroundColor: 'transparent', border: 'none', fontSize: 22, fontWeight: 'bold' }}>Ник: {user.first_name}</div> : <input type="text" value={inNick} onChange={(e: any) => setInNick(e.target.value)} placeholder="Ник..." style={{ ...S.input, maxWidth: '280px' }} />}
      <Btn variant="primary" onClick={reg} disabled={proc} style={{ maxWidth: '280px' }}>Начать жизнь</Btn>
    </div>
  );

  return (
    <div style={{ padding: '90px 20px 90px 20px', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', background: bgColors[tab] || '#16161a', color: 'white', transition: 'background 0.5s ease' }}>
      <Toast toast={toast} />
      <DailyRewardModal app={app} />

      <Modal open={refOpen} onClose={() => setRefOpen(false)}>
        <Gift size={40} color="#ec4899" style={{ marginBottom: 15 }} /><h3 style={{ marginTop: 0, fontSize: 20 }}>Рефералка</h3>
        <Btn variant="purple" onClick={inviteFriend} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', marginBottom: 15, padding: 12 }}><UserPlus size={20} /> Пригласить друга</Btn>
        <p style={{ color: '#8B899A', fontSize: 14, marginBottom: 10 }}>Приглашено друзей: <b>{myRefs.length}</b></p>
        <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, border: '1px solid rgba(236, 72, 153, 0.2)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#ec4899' }}>Накоплено 5% с доходов:</p><p style={{ margin: 0, fontSize: 24, color: '#ec4899', fontWeight: 'bold', fontFamily: 'Space Grotesk' }}>{refBalance} <Coins size={18} style={{ display: 'inline' }} /></p></div>
        <Btn variant="primary" onClick={collectRefBonus} disabled={proc || refBalance <= 0} style={{ background: refBalance > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#333', marginBottom: 10 }}>Собрать 5%</Btn>
        <Btn variant="secondary" onClick={() => setRefOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Закрыть</Btn>
      </Modal>

      <Modal open={quitOpen} onClose={() => setQuitOpen(false)}>
        <h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3><p style={{ color: '#8B899A', fontSize: 15, marginBottom: 20 }}>Ты уверен?</p>
        <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => setQuitOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="danger" onClick={quit} disabled={proc}>Уволиться</Btn></div>
      </Modal>

      <Modal open={authOpen} onClose={() => setAuthOpen(false)}>
        <Lock size={40} color="#f59e0b" style={{ marginBottom: 15 }} /><h3>Код</h3>
        <input type="password" value={adminCode} onChange={(e: any) => setAdminCode(e.target.value)} style={S.input} />
        <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => setAuthOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="yellow" onClick={checkAuth}>Войти</Btn></div>
      </Modal>

      <Modal open={adminOpen} onClose={() => setAdminOpen(false)}>
        <div style={{ border: '1px solid #ef4444', padding: 10, borderRadius: 16 }}>
          <h3 style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', gap: 10 }}><Settings size={24} /> ADMIN</h3>
          <Btn variant="yellow" onClick={adminMoney} style={{ marginBottom: 10 }}><Coins size={20} /> +100 000</Btn>
          <Btn variant="danger" onClick={adminReset} style={{ marginBottom: 15 }}><Trash2 size={20} /> Сброс</Btn>
          <Btn variant="secondary" onClick={() => setAdminOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Закрыть</Btn>
        </div>
      </Modal>

      <Modal open={sellOpen} onClose={() => setSellOpen(false)}>
        <h3>Продажа {sellItemType === 'phone' ? 'телефона' : sellItemType === 'car' ? 'машины' : 'квартиры'}</h3>
        <input type="number" value={sellPrice} onChange={(e: any) => setSellPrice(e.target.value)} style={S.input} />
        <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => setSellOpen(false)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="purple" onClick={listItem}>Выставить</Btn></div>
      </Modal>

      <Modal open={buyingType !== null} onClose={() => setBuyingType(null)}>
        <Store size={40} color="#C084FC" style={{ marginBottom: 15 }} />
        <h3>Название бизнеса</h3>
        <p style={{ color: '#8B899A', fontSize: 13, marginBottom: 15 }}>Только английские буквы и цифры</p>
        <input type="text" value={bizNameInput} onChange={e => setBizNameInput(e.target.value)} placeholder="Speed Motors" style={S.input} />
        <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => setBuyingType(null)} style={{ background: '#333', boxShadow: 'none' }}>Отмена</Btn><Btn variant="purple" onClick={submitBizName}>Купить</Btn></div>
      </Modal>

      {tab === 'home' && <HomeTab app={app} />}
      
      {tab === 'cafe' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
          <button onClick={() => { setTab('home'); setSelCafe(null); }} style={{ background: 'none', border: 'none', color: '#8B899A', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Кафе</h2>
          {bLeft > 0 ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#f97316" style={{ marginBottom: 15 }} /><h3>Готовим...</h3><p style={{ fontSize: 24, fontWeight: 'bold', color: '#f97316', fontFamily: 'Space Grotesk' }}>{bLeft} сек.</p></div>
          : selCafe ? <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={48} color="#f97316" style={{ marginBottom: 15 }} /><h3 style={{ marginBottom: 5 }}>{selCafe.business_name}</h3><p style={{ color: '#8B899A', fontSize: 14, marginBottom: 20 }}>Владелец: {selCafe.owner_name}</p><Btn variant="yellow" onClick={() => buyCoffee(selCafe)} disabled={proc || money < COFFEE_CUP_PRICE || energy >= maxEnergy || !selCafe.worker_id} style={{ background: (money < COFFEE_CUP_PRICE || energy >= maxEnergy || !selCafe.worker_id) ? '#333' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: (money < COFFEE_CUP_PRICE || energy >= maxEnergy || !selCafe.worker_id) ? '#8B899A' : 'white', marginBottom: 10 }}>{!selCafe.worker_id ? 'Нет бариста' : energy >= maxEnergy ? 'Полная энергия' : money < COFFEE_CUP_PRICE ? 'Мало денег' : `Купить кофе за ${COFFEE_CUP_PRICE}`}</Btn><Btn variant="secondary" onClick={() => setSelCafe(null)} style={{ background: '#333', boxShadow: 'none' }}>Назад</Btn></div>
          : <div>
              {allBiz.filter((b: any) => b.biz_type === 'coffee').map((b: any) => (
                <div key={b.id} onClick={() => setSelCafe(b)} style={{ backgroundColor: '#161324', padding: 15, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', marginBottom: 10 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Coffee size={16} /> {b.business_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8B899A', marginTop: 4 }}>Владелец: {b.owner_name}</div>
                    {!b.worker_id && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Нет бариста</div>}
                  </div>
                  <span style={{ color: '#f97316', fontWeight: 'bold' }}>→</span>
                </div>
              ))}
              {allBiz.filter((b: any) => b.biz_type === 'coffee').length === 0 && <p style={{ color: '#8B899A' }}>Нет открытых кафе.</p>}
            </div>
          }
        </div>
      )}

      {tab === 'business' && <BusinessTab app={app} activeBiz={activeBiz} currentStock={currentStock} />}

      {tab === 'jobs' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Работа</h2>
          {boardOpen ? <div><button onClick={() => setBoardOpen(false)} style={{ background: 'none', border: 'none', color: '#8B899A', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h3 style={{ color: '#8B899A', fontSize: 18, marginBottom: 15 }}>Вакансии</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{allBiz.filter((b: any) => !b.worker_id && b.owner_id !== pid && b.biz_type === 'coffee').map((b: any) => <div key={b.id} style={{ backgroundColor: '#161324', padding: 15, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={16} /> {b.business_name}</div><div style={{ fontSize: 12, color: '#8B899A', marginTop: 4 }}>Владелец: {b.owner_name}</div></div>{job ? <Btn variant="secondary" disabled style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>Уже работаете</Btn> : <Btn variant="secondary" onClick={() => hire(b.id)} disabled={proc} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>Устроиться</Btn>}</div>)}{allBiz.filter((b: any) => !b.worker_id && b.owner_id !== pid && b.biz_type === 'coffee').length === 0 && <p style={{ color: '#8B899A', fontSize: 14 }}>Пока нет мест...</p>}</div></div>
          : job ? <div><h3 style={{ color: '#10b981', fontSize: 18, marginBottom: 15 }}>Моя работа</h3><div style={{ backgroundColor: '#161324', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}><Coffee size={24} color="#f97316" /><span style={{ fontSize: 18, fontWeight: 'bold' }}>{job.business_name}</span></div><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#8B899A' }}>Владелец: <b style={{ color: 'white' }}>{job.owner_name}</b></p><p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#8B899A' }}>Должность: <b style={{ color: '#3b82f6' }}>Бариста</b></p><Btn variant="primary" onClick={shift} disabled={proc || energy < 20} style={{ marginBottom: 10 }}>Смена (+{boostEnd > Date.now() ? 330 : 300})</Btn><div style={{ display: 'flex', gap: 10 }}><button onClick={() => setBoardOpen(true)} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: '#333', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none' }}>Вакансии</button><Btn variant="danger" onClick={() => setQuitOpen(true)} disabled={proc} style={{ flex: 1, fontSize: 14, padding: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Уволиться</Btn></div></div></div>
          : <div style={{ ...S.card, textAlign: 'center', marginTop: 50 }}><div style={{ fontSize: 50, marginBottom: 10 }}>📉</div><h3>Вы безработный</h3><p style={{ color: '#8B899A', fontSize: 14, marginBottom: 20 }}>Пора найти работу!</p><Btn variant="secondary" onClick={() => setBoardOpen(true)}><Briefcase size={20} /> Биржа труда</Btn></div>}
        </div>
      )}

      {tab === 'shop' && <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}><h2>Магазин</h2><div style={{ ...S.card, textAlign: 'center' }}><Smartphone size={48} color="#8B899A" style={{ marginBottom: 15 }} /><h3>Смартфон</h3>{phone ? <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={20} /> Куплено</div> : <Btn variant="purple" onClick={() => buyPhone(true)} disabled={proc || money < PHONE_PRICE}>Купить за 2000</Btn>}</div></div>}

      {tab === 'market' && <MarketTab app={app} />}

      {tab === 'inventory' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
          <h2>Инвентарь</h2>
          {phone ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Smartphone size={32} color="#8B899A" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div></div><Btn variant="purple" onClick={() => { setSellItemType('phone'); setSellItemData('phone'); setSellPrice('2000'); setSellOpen(true); }} disabled={proc}>Выставить</Btn><Btn variant="primary" onClick={() => buyPhone(false)} disabled={proc}>Сдать (+1400)</Btn></div> : null}
          {hasCar ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Car size={32} color="#3b82f6" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>{carModel === 'lada' ? 'Лада' : carModel === 'toyota' ? 'Тойота' : 'Автомобиль'}</div><div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Отдых: {restTime / 1000} сек.</div></div></div><Btn variant="purple" onClick={() => { setSellItemType('car'); setSellItemData(carModel); setSellPrice('30000'); setSellOpen(true); }} disabled={proc}>Выставить на рынок</Btn></div> : null}
          {hasHouse ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Building size={32} color="#f97316" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Квартира</div><div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Макс. энергия: {maxEnergy}</div></div></div><Btn variant="purple" onClick={() => { setSellItemType('house'); setSellItemData(houseType); setSellPrice('50000'); setSellOpen(true); }} disabled={proc}>Выставить на рынок</Btn></div> : null}
          {!phone && !hasCar && !hasHouse && <div style={{ color: '#8B899A', padding: 40, textAlign: 'center' }}><Backpack size={48} style={{ opacity: 0.5, marginBottom: 10 }} /><br />Пусто...</div>}
        </div>
      )}

      <BottomNav app={app} />
    </div>
  );
}