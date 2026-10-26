import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { Send, ShieldAlert } from 'lucide-react';
import { 
  BOT_USERNAME, CHANNEL_LINK, POLL, 
  BASE_MAX_ENERGY, HOUSE_MAX_ENERGY, getRestTime, AVATARS,
  getStock, S, APARTMENTS_PER_BUILD, TAXI_BIZ_PRICE, 
  COFFEE_BIZ_PRICE, SALON_BIZ_PRICE, 
  CONSTRUCTION_BIZ_PRICE, PHONE_FACTORY_BIZ_PRICE, BUTTON_BATCH_SIZE,
  SMARTPHONE_BATCH_SIZE, 
  JOB_WORK, getDayModifier
} from './constants';
import { Btn, Toast, BottomNav, Modal } from './components';
const loadTabs = () => import('./tabs');
const HomeTab = lazy(() => loadTabs().then((module) => ({ default: module.HomeTab })));
const MarketTab = lazy(() => loadTabs().then((module) => ({ default: module.MarketTab })));
const BusinessTab = lazy(() => loadTabs().then((module) => ({ default: module.BusinessTab })));
const DailyRewardModal = lazy(() => loadTabs().then((module) => ({ default: module.DailyRewardModal })));
const AdminTab = lazy(() => loadTabs().then((module) => ({ default: module.AdminTab })));
const AppModals = lazy(() => loadTabs().then((module) => ({ default: module.AppModals })));
const CafeTab = lazy(() => loadTabs().then((module) => ({ default: module.CafeTab })));
const JobsTab = lazy(() => loadTabs().then((module) => ({ default: module.JobsTab })));
const ShopTab = lazy(() => loadTabs().then((module) => ({ default: module.ShopTab })));
const InventoryTab = lazy(() => loadTabs().then((module) => ({ default: module.InventoryTab })));
const CasinoTab = lazy(() => import('./casino').then((module) => ({ default: module.CasinoTab })));

export default function App() {
  const { user, hapticFeedback, tg, startParam } = useTelegram();

  // Ждём ответа /api/auth (серверная проверка подписи initData), но не дольше 5 сек.
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    if (!user) return;
    if (user.verified) { setAuthChecked(true); return; }
    const to = setTimeout(() => setAuthChecked(true), 5000);
    return () => clearTimeout(to);
  }, [user]);
  
  const [loading, setLoading] = useState(!!(window as any).Telegram?.WebApp?.initDataUnsafe?.user);
  // Подписку больше НЕ проверяем на клиенте (раньше вызывался несуществующий
  // supabase edge-функция 'check-subscription' — всегда была ошибка).
  // Проверка подписки сделана на стороне бота: /start без подписки не даёт аккаунт.
  const [isCheckingSub, setIsCheckingSub] = useState(false);
  const [proc, setProc] = useState(false);
  const [pid, setPid] = useState<string | null>(null);
  const [tgId, setTgId] = useState('');
  const [toast, setToast] = useState<{ msg: string, err: boolean, id: number } | null>(null);
  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business' | 'jobs' | 'cafe' | 'casino' | 'admin'>('home');
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
  // undefined = ещё не прочитали из БД; true/false — реальное значение.
  // Раньше стартовало с false → при каждом заходе на секунду мелькал экран
  // «Подпишись на канал», пока loadData не дочитает is_subscribed=true.
  const [isSubscribed, setIsSubscribed] = useState<boolean | undefined>(undefined);

  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [phone, setPhone] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [carModel, setCarModel] = useState('none');
  const [hasHouse, setHasHouse] = useState(false);
  const [houseType, setHouseType] = useState('none');
  const [refBalance, setRefBalance] = useState(0);
  const [tipBalance, setTipBalance] = useState(0);
  const [myRefs, setMyRefs] = useState<any[]>([]);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [boostEnd, setBoostEnd] = useState(0);

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

  const [myBizs, setMyBizs] = useState<any[]>([]);
  const [activeBizType, setActiveBizType] = useState<'coffee' | 'salon' | 'construction' | 'taxi' | 'phone_factory'>('coffee');
  const [buyingType, setBuyingType] = useState<string | null>(null);
  const [bizNameInput, setBizNameInput] = useState('');
  const [marketTab, setMarketTab] = useState<'items' | 'cars' | 'realestate'>('items');
  const [players, setPlayers] = useState<any[]>([]);
  const [referralLeaderboard, setReferralLeaderboard] = useState<any[]>([]);
  const [referralLeaderboardUnavailable, setReferralLeaderboardUnavailable] = useState(false);
  const [market, setMarket] = useState<any[]>([]);
  
  const [myJob, setMyJob] = useState<any>(null);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [selCafe, setSelCafe] = useState<any>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'players' | 'promos' | 'logs'>('players');

  const [, setClicks] = useState(0);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modifierOpen, setModifierOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  
  const [bugOpen, setBugOpen] = useState(false);
  const [bugText, setBugText] = useState('');

  const [sellOpen, setSellOpen] = useState(false);
  const [sellPrice, setSellPrice] = useState('2000');
  const [sellItemType, setSellItemType] = useState<'phone' | 'car' | 'house'>('phone');
  const [sellItemData, setSellItemData] = useState('none');
  const [sellSource, setSellSource] = useState<'personal' | 'stock' | null>(null);
  const [quitOpen, setQuitOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const lock = useRef(false);

  const maxEnergy = hasHouse ? HOUSE_MAX_ENERGY : BASE_MAX_ENERGY;
  const dayMod = getDayModifier();
  const restTime = getRestTime(hasCar, carModel, dayMod);
  
  let bizBonusPercent = 0;
  myBizs.forEach(b => {
    if (b.biz_type === 'coffee') bizBonusPercent += 5;
    else if (b.biz_type === 'salon') bizBonusPercent += 10;
    else if (b.biz_type === 'taxi') bizBonusPercent += 15;
    else if (b.biz_type === 'phone_factory') bizBonusPercent += 20;
    else if (b.biz_type === 'construction') bizBonusPercent += 25;
  });

  const baseWorkPay = dayMod?.type === 'work' ? Math.floor(JOB_WORK * 1.5) : JOB_WORK;
  const workPay = Math.floor(baseWorkPay * (1 + bizBonusPercent / 100));

  const showMsg = (msg: string, err = false) => { setToast({ msg, err, id: Date.now() }); };
  const closeToast = () => setToast(null);
  // Идентификатор игрока = Telegram id. В браузере вне Telegram (dev-режим) разрешаем
  // локальную заглушку, но в самом Telegram — только реальный id из initDataUnsafe.
  const isTgEnv = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const getUid = () => {
    if (user?.id) return user.id.toString();
    if (isTgEnv) return ''; // без настоящего TG-id работать нельзя (см. gate ниже)
    const saved = localStorage.getItem('zhituha_id');
    if (saved) return saved;
    const id = 'user_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('zhituha_id', id);
    return id;
  };

  const sendNotification = (text: string) => {
    // Пуш отправляем только реальным пользователям Telegram (числовной id).
    // Для localStorage-заглушки ("user_xxxx") уведомления не шлем.
    if (!user?.id) return;
    fetch('/api/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: (window as any).Telegram?.WebApp?.initData || '', text })
    }).catch(err => console.error('Ошибка пуша:', err));
  };

  const submitBug = () => action(async () => {
    if (!bugText.trim()) return showMsg("Напиши текст сообщения", true);
    try {
      const res = await fetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: (window as any).Telegram?.WebApp?.initData || '', message: bugText })
      });
      if (!res.ok) throw new Error('Ошибка сервера');
      showMsg("Баг отправлен! Спасибо."); 
      setBugOpen(false); setBugText(''); hapticFeedback('heavy');
    } catch (e: any) {
      throw new Error(e.message || "Не удалось связаться с сервером");
    }
  });

  const action = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setProc(true);
    try { await fn(); } catch (e: any) { showMsg(e.message || "Ошибка", true); } finally { lock.current = false; setProc(false); }
  };

  // Обновление ТОЛЬКО безопасных полей профиля игрока.
  // Деньги/энергия — исключительно через RPC change_stats.
  const SYNC_ALLOWED_FIELDS = ['nickname', 'gender', 'avatar_id', 'onboarding_step'];

  const sync = async (updates: any) => {
    if (!pid) return false;
    // has_car/has_house прилетают в camelCase из кода — нормализуем в колонки БД.
    const normalized: any = { ...updates };
    if ('has_car' in normalized && !('car_model' in normalized)) normalized.car_model = normalized.has_car;
    if ('has_house' in normalized && !('house_type' in normalized)) normalized.house_type = normalized.has_house;
    delete normalized.has_car;
    delete normalized.has_house;
    const safe: any = {};
    for (const key of SYNC_ALLOWED_FIELDS) {
      if (key in normalized) safe[key] = normalized[key];
    }
    if (Object.keys(safe).length === 0) return false;
    const { error } = await supabase.rpc('update_profile_rpc', { p_player_id: pid, p_updates: safe });
    if (error) throw new Error("Ошибка БД: " + error.message);
    return true;
  };

  const advanceTutorial = async (step: number) => { setOnboardStep(step); await sync({ onboarding_step: step }); };
  const skipTutorial = () => { advanceTutorial(onboardStep + 1); hapticFeedback('light'); };

  const checkCoffee = async () => {
    if (!pid) return;
    const { data, error } = await supabase.rpc('collect_coffee_energy_rpc', { p_player_id: pid });
    if (error) return;
    if (data && data.success) {
      setEnergy(data.energy);
      setBrewEnd(0);
      showMsg("Кофе готов! Энергия восстановлена!");
      hapticFeedback('heavy');
      sendNotification("☕ Твой кофе готов! Энергия восстановлена, залетай в игру!");
      loadData(true);
    } else if (data && data.brew_end) {
      setBrewEnd(data.brew_end);
    }
  };

  // Лёгкий поллинг своих бизнесов (без worker_id/name, без чужих складов).
  const pollMyBizs = async () => {
    if (!pid) return;
    const { data } = await supabase.from('businesses')
      .select('id, owner_id, biz_type, business_name, stock, coffee_balance, build_end, car_order_end, last_collected, created_at, passive_level, passive_balance, passive_updated_at')
      .eq('owner_id', pid);
    if (data) setMyBizs(data);
  };

  const loadData = async (silent = false) => {
    if (lock.current) return;
    if (!silent) setLoading(true);
    try {
      const uid = getUid(); setTgId(uid);
      if (!uid) return; // в Telegram без реального user.id данные не грузим

      // Ранняя проверка подписки (до основного экрана): читаем только is_subscribed,
      // снимаем loading и НЕ даём мелькнуть окну «Подпишись на канал», если игрок
      // уже подписан. Остальные данные дозагрузятся в основном запросе ниже.
      if (!silent && !user?.id) {
        setLoading(false);
      }
      
      // Экономия трафика: свои бизнесы берём целиком (нужен owner_id для маппинга),
      // чужие — только карточки кафе (id/имя/воркер) + все воркеры.
      const profileResponse = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'me', init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const profileResult = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileResult.error || 'Profile request failed');
      const d = profileResult.player;
      if (!d) { if (user?.first_name) setInNick(user.first_name); return; }
      const [myBRes, allBizRes, wRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('owner_id', d.id),
        supabase.from('businesses').select('id, owner_id, biz_type, business_name, worker_id, worker_name, coffee_balance, last_collected'),
        supabase.from('business_workers').select('*')
      ]);

      if (d.is_banned) { setIsBanned(true); setLoading(false); return; }
      
      setPid(d.id); setNick(d.nickname); setGender(d.gender); setAvatarId(d.avatar_id || 1);
      setRole(d.role || 'player'); setMoney(Number(d.money)); setEnergy(Number(d.energy)); 
      setPhone(Number(d.phone_count) > 0); setHasCar(d.has_car || false); setCarModel(d.car_model || 'none');
      setHasHouse(d.has_house || false); setHouseType(d.house_type || 'none');
      setRefBalance(Number(d.referral_balance) || 0); setDailyStreak(Number(d.daily_streak) || 0);
      setBoostEnd(Number(d.boost_end) || 0); setOnboardStep(Number(d.onboarding_step) || 0);
      setMarketSlots(Number(d.market_slots) || 3);
      setBrewEnd(Number(d.brew_end) || 0);
      setTipBalance(Number(d.tip_balance) || 0);
      setIsSubscribed(d.is_subscribed !== false); // undefined -> true/false из БД, без мигания окна подписки

      if (!silent) {
        const timeDiff = Date.now() - (Number(d.last_claim) || 0);
        if (timeDiff > 86400000) { 
           if (timeDiff > 172800000 && Number(d.daily_streak) !== 0) {
             setDailyStreak(0);
           }
           setIsDailyOpen(true);
        }
      }
      
      const last = Number(d.last_rest_time) || 0;
      const cRestTime = getRestTime(Boolean(d.has_car), d.car_model || 'none');
      const end = last + cRestTime > Date.now() ? last + cRestTime : 0;
      setRestEnd(end); if (end > 0) setTLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));

      if (profileResult.referrals) setMyRefs(profileResult.referrals);
      
      if (myBRes.data) {
        setMyBizs(myBRes.data);
        setCarOrderEnd(Number(myBRes.data.find((x: any) => x.biz_type === 'salon')?.car_order_end) || 0);
        setBuildEnd(Number(myBRes.data.find((x: any) => x.biz_type === 'construction')?.build_end) || 0);
        setPhoneProdEnd(Number(myBRes.data.find((x: any) => x.biz_type === 'phone_factory')?.build_end) || 0);
      }
      if (allBizRes.data) setAllBiz(allBizRes.data);
      
      if (wRes.data) {
        setAllWorkers(wRes.data);
        setMyJob(wRes.data.find((w: any) => w.player_id === d.id) || null);
      }
    } catch (e) {
      console.error(e);
      if (!silent) showMsg(e instanceof Error ? e.message : 'Не удалось загрузить профиль. Проверьте настройки Vercel.', true);
    } finally { if (!silent) setLoading(false); }
  };

  const loadMarket = async () => {
    const [leaderboardResponse, referralsResponse, mRes] = await Promise.all([
      fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leaderboard', init_data: (window as any).Telegram?.WebApp?.initData || '' }) }),
      fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ init_data: (window as any).Telegram?.WebApp?.initData || '' }) }),
      supabase.from('market_items').select('*').order('created_at', { ascending: false })
    ]);
    const [leaderboard, referrals] = await Promise.all([leaderboardResponse.json(), referralsResponse.json()]);
    if (leaderboardResponse.ok) setPlayers(leaderboard.players || []);
    setReferralLeaderboardUnavailable(!referralsResponse.ok);
    if (referralsResponse.ok) setReferralLeaderboard(referrals.players || []);
    if (mRes.data) setMarket(mRes.data);
  };

  useEffect(() => { 
    if (user) loadData(); 
    else setLoading(false); 
  }, [user]);

  // Обновление профиля игрока (деньги/энергия/таймеры) — отдельный лёгкий запрос,
  // чтобы не тянуть ради этого все бизнесы.
  const refreshProfile = async () => {
    if (!user?.id || !pid) return;
    const response = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me', init_data: (window as any).Telegram?.WebApp?.initData || '' }) });
    const result = await response.json();
    const data = response.ok ? result.player : null;
    if (!data) return;
    if (data.is_banned) { setIsBanned(true); return; }
    setMoney(Number(data.money)); setEnergy(Number(data.energy));
    setRefBalance(Number(data.referral_balance) || 0); setTipBalance(Number(data.tip_balance) || 0);
    setBoostEnd(Number(data.boost_end) || 0); setBrewEnd(Number(data.brew_end) || 0);
    // Имущество/слоты — чтобы после покупки/продажи телефона, машины, квартиры
    // цифры на экране сходились с БД без полного reload.
    setPhone(Number(data.phone_count) > 0);
    setHasCar(!!data.has_car); setCarModel(data.car_model || 'none');
    setHasHouse(!!data.has_house); setHouseType(data.house_type || 'none');
    setMarketSlots(Number(data.market_slots) || 3);
  };

  // После каждого успешного действия подтягиваем актуальные цифры с сервера,
  // чтобы интерфейс обновлялся мгновенно (деньги/энергия/таймеры/склады).
  const afterAction = async () => {
    try { await Promise.all([refreshProfile(), pollMyBizs()]); } catch {}
  };

  useEffect(() => {
    if (tab === 'market') { loadMarket(); refreshProfile(); pollMyBizs(); }
    if (tab === 'shop' || tab === 'inventory') { refreshProfile(); pollMyBizs(); }
    if (['business', 'jobs', 'cafe'].includes(tab)) {
      refreshProfile(); pollMyBizs();
      const int = setInterval(() => { refreshProfile(); pollMyBizs(); }, POLL);
      return () => clearInterval(int);
    }
  }, [tab, pid]);

  useEffect(() => {
    if (onboardStep === 3 && tab === 'business') advanceTutorial(4);
    if (onboardStep === 4 && tab === 'market') advanceTutorial(5);
  }, [tab, onboardStep]);

  const finishOrder = async (biz: any, msg: string, notifyText: string) => {
    // Атомарно завершаем таймер бизнеса на сервере: списываем заказ/стройку на склад.
    // Возвращает true, если завершили впервые (защита от повторного срабатывания).
    try {
      const { data, error } = await supabase.rpc('finish_business_timer_rpc', { p_biz_id: biz.id, p_player_id: pid });
      if (error || !data || !data.success) return false;
      showMsg(msg); hapticFeedback('heavy'); loadData(true); sendNotification(notifyText);
      return true;
    } catch (e) { return false; }
  };

  useEffect(() => {
    const int = setInterval(() => {
      const now = Date.now();
      if (restEnd > 0) { const r = Math.max(0, Math.ceil((restEnd - now) / 1000)); setTLeft(r); if (r === 0) setRestEnd(0); }
      
      if (brewEnd > 0) {
        const r = Math.max(0, Math.ceil((brewEnd - now) / 1000)); setBLeft(r);
        if (r === 0) checkCoffee();
      } else { setBLeft(0); }
      
      if (carOrderEnd > 0) {
        const r = Math.max(0, Math.ceil((carOrderEnd - now) / 1000)); setCarTimeLeft(r);
        if (r === 0) {
          setCarOrderEnd(0);
          const salon = myBizs.find(b => b.biz_type === 'salon');
          if (salon) {
            const s = getStock(salon); const model = s.current_model || 'lada'; const amount = s.order_amount || 1;
            finishOrder(salon,
              'Машины приехали!', `🚗 В автосалон приехали ${amount} ${model === 'lada' ? 'Лада' : 'Тойота'}!`);
          }
        }
      } else { setCarTimeLeft(0); }

      if (buildEnd > 0) {
        const r = Math.max(0, Math.ceil((buildEnd - now) / 1000)); setBuildTimeLeft(r);
        if (r === 0) {
          setBuildEnd(0);
          const constr = myBizs.find(b => b.biz_type === 'construction');
          if (constr) {
            finishOrder(constr,
              'Дом построен!', `🏗 Дом построен! +${APARTMENTS_PER_BUILD} квартир.`);
          }
        }
      } else { setBuildTimeLeft(0); }

      if (phoneProdEnd > 0) {
        const r = Math.max(0, Math.ceil((phoneProdEnd - now) / 1000)); setPhoneProdTimeLeft(r);
        if (r === 0) {
          setPhoneProdEnd(0);
          const factory = myBizs.find(b => b.biz_type === 'phone_factory');
          if (factory) {
            const s = getStock(factory); const model = s.current_phone_model || 'button';
            const amount = model === 'button' ? BUTTON_BATCH_SIZE : SMARTPHONE_BATCH_SIZE;
            finishOrder(factory,
              'Партия готова!', `📱 Партия телефонов (${amount} шт.) готова!`);
          }
        }
      } else { setPhoneProdTimeLeft(0); }
    }, 1000);
    return () => clearInterval(int);
  }, [restEnd, brewEnd, carOrderEnd, buildEnd, phoneProdEnd, pid, myBizs, hasHouse]);

  const selectGender = (g: 'male' | 'female') => { setSelG(g); setAvatarId(AVATARS.find(a => a.gender === g)?.id || 1); hapticFeedback('light'); };
  
  const reg = () => action(async () => {
    const final = user?.first_name || inNick;
    if (!final.trim() || !selG) return showMsg("Заполни поля!", true);
    let refBy = startParam ? (startParam.startsWith('ref_') ? startParam.split('_')[1] : startParam) : null;
    if (refBy === getUid()) refBy = null;
    
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        init_data: (window as any).Telegram?.WebApp?.initData || '',
        nickname: final,
        gender: selG,
        avatar_id: avatarId,
        referrer_id: refBy,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.player) throw new Error(result.error || 'Не удалось создать аккаунт');
    const data = result.player;
    setPid(data.id); setNick(data.nickname || final); setGender(data.gender || selG); setAvatarId(data.avatar_id || avatarId);
    setMoney(Number(data.money) || 0); setEnergy(Number(data.energy) || 0);
    window.setTimeout(() => { void loadData(true); }, 0);
    if (result.referred) showMsg("Бонус +1000 монет за приглашение!");
  });

  // Подписка: берём из БД (столбец is_subscribed пишет бот при /start).
  // Раньше здесь дергалась несуществующая edge-функция 'check-subscription'.
  const checkSubOnLoad = async () => { setIsCheckingSub(false); };

  useEffect(() => { 
    if (user) checkSubOnLoad(); 
    else setIsCheckingSub(false); 
  }, [user]);

  const verifySubscription = async () => {
    // Кнопка «Я подписался»: отмечаем подписку в БД и пускаем в игру.
    // Реальную проверку членства в канале делает бот (/start → getChatMember).
    if (!user?.id) return;
    setIsCheckingSub(true); hapticFeedback('medium');
    try {
      setIsSubscribed(true); if (pid) await sync({ is_subscribed: true });
      showMsg("Спасибо за подписку! Добро пожаловать!");
    } catch (e) { showMsg("Ошибка. Попробуй позже.", true); } finally { setIsCheckingSub(false); }
  };

  const drinkTutorialCoffee = () => action(async () => {
    const { data, error } = await supabase.rpc('drink_tutorial_coffee_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) return showMsg(data.error, true);
    setEnergy(Number(data.energy)); setOnboardStep(3);
    showMsg("Кофе выпит! Энергия восстановлена."); hapticFeedback('heavy');
    await afterAction();
  });

  const claimTutorialReward = () => action(async () => {
    if (onboardStep !== 5) return;
    const { data, error } = await supabase.rpc('claim_tutorial_reward_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) return showMsg(data.error, true);
    setMoney(Number(data.money)); setOnboardStep(6);
    showMsg("Туториал пройден! +2000 монет"); hapticFeedback('heavy');
    await afterAction();
  });

  const claimDaily = () => action(async () => {
    const { data, error } = await supabase.rpc('claim_daily_reward_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) return showMsg(data.error, true);
    setDailyStreak(Number(data.daily_streak) || 0);
    setIsDailyOpen(false);
    if (typeof data.money === 'number') setMoney(data.money);
    if (typeof data.energy === 'number') setEnergy(data.energy);
    if (typeof data.boost_end === 'number') setBoostEnd(data.boost_end);
    if (data.reward_type === 'money') showMsg(data.boost_awarded ? `Награда: +${data.reward_amount} монет и БУСТ x1.1!` : `Награда: +${data.reward_amount} монет!`);
    else showMsg('Награда: кофе! Энергия восстановлена!');
    hapticFeedback('heavy');
    await afterAction();
  });
  const addTaxiCar = (model: 'lada' | 'toyota') => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;

    // Цену и списание денег считает сервер (taxi_add_car_rpc).
    const { data, error } = await supabase.rpc('taxi_add_car_rpc', { p_biz_id: taxi.id, p_player_id: pid, p_model: model });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) { setMoney(Number(data.money)); }
    showMsg(`Машина добавлена в таксопарк!`); loadData(true);
  });

  const collectTaxi = () => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;
    const s = getStock(taxi); const cars = s.taxi_cars || [];
    if (!cars.length) return;

    // Доход, износ и last_claim считаются на сервере (защита от фрода времени/двойного сбора).
    const { data, error } = await supabase.rpc('taxi_collect_rpc', { p_biz_id: taxi.id, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) return showMsg(data.error, true);
    if (data) {
      setMoney(Number(data.money));
      setMyBizs(prev => prev.map(b => b.id === taxi.id ? { ...b, stock: data.stock } : b));
      showMsg(`Собрано ${data.income} монет!`);
      await afterAction();
    }
  });

  const repairTaxiCar = (index: number) => action(async () => {
    const taxi = myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) return;

    // Стоимость ремонта и списание — на сервере (taxi_repair_rpc).
    const { data, error } = await supabase.rpc('taxi_repair_rpc', { p_biz_id: taxi.id, p_player_id: pid, p_car_index: index });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) setMoney(Number(data.money));
    showMsg("Машина отремонтирована!"); loadData(true);
  });

  const orderPhones = (model: 'button' | 'smartphone') => action(async () => {
    const factory = myBizs.find(b => b.biz_type === 'phone_factory');
    if (!factory || phoneProdEnd > 0) return showMsg("Производство уже идет!", true);
    // По дизайн-доку без Сборщика станок стоит (сервер тоже проверяет).
    if (!roleCount(factory.id, 'Сборщик')) return showMsg("Нужен хотя бы один сборщик!", true);

    // Цену партии, длительность и штрафы (Инженер) считает сервер (start_phone_order_rpc).
    const { data, error } = await supabase.rpc('start_phone_order_rpc', { p_biz_id: factory.id, p_player_id: pid, p_model: model });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) {
      setMoney(Number(data.money));
      setPhoneProdEnd(Number(data.build_end));
      setMyBizs(prev => prev.map(b => b.id === factory.id ? { ...b, build_end: Number(data.build_end) } : b));
      if (Number(data.fine) > 0) showMsg(`Нет инженера: x3 времени + ${data.fine}₽ простоя станка`, true);
    }
    showMsg(`Заказана партия: ${model === 'button' ? 'Кнопочные' : 'Смартфоны'}`); hapticFeedback('heavy');
    await afterAction();
  });

  // Единый источник цены бизнеса (клиент = сервер: buy_business_rpc игнорирует цену клиента,
  // цена зашита в SQL). Числа должны совпадать с константами в supabase_schema.sql.
  const BIZ_PRICES: Record<string, number> = {
    coffee: COFFEE_BIZ_PRICE, salon: SALON_BIZ_PRICE, construction: CONSTRUCTION_BIZ_PRICE,
    taxi: TAXI_BIZ_PRICE, phone_factory: PHONE_FACTORY_BIZ_PRICE,
  };

  // Сколько мест роли уже нанято в бизнесе (для проверки обязательных ролей на клиенте;
  // сервер всё равно перепроверяет в start_*_rpc).
  const roleCount = (bizId: string | undefined, role: string) =>
    allWorkers.filter(w => w.business_id === bizId && w.role === role).length;

  const submitBizName = () => action(async () => {
    if (!buyingType) return;
    const name = bizNameInput.trim();
    if (!/^[A-Za-z0-9 ]{3,20}$/.test(name)) return showMsg("Только англ. буквы и цифры (3-20)", true);
    
    const price = BIZ_PRICES[buyingType];
    if (!price) return showMsg("Неизвестный тип бизнеса", true);
    if (money < price) return showMsg("Не хватает денег", true);
    
    const { data, error } = await supabase.rpc('buy_business_rpc', { p_owner_id: pid, p_owner_name: nick, p_biz_type: buyingType, p_biz_name: name });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setBuyingType(null); setBizNameInput('');
    showMsg("Бизнес открыт!"); loadData(true); await afterAction();
  });

  const sellBusiness = (biz: any) => action(async () => {
    if (!window.confirm("Продать бизнес за 50%?")) return;
    const { data, error } = await supabase.rpc('sell_business_rpc', { p_owner_id: pid, p_biz_id: biz.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    showMsg(`Бизнес продан за ${data?.refund ?? 0}!`); loadData(true); loadMarket(); await afterAction();
  });

  const cancelLot = (item: any) => action(async () => {
    if (!window.confirm("Снять лот?")) return;
    // Возврат товара на склад/в инвентарь делает сервер внутри cancel_lot_rpc (после p_add_stock).
    const { data, error } = await supabase.rpc('cancel_lot_rpc', { p_player_id: pid, p_item_id: item.id, p_add_stock: true });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    if (data.item_type === 'phone' && data.item_data === 'phone') {
      setPhone(true); await sync({ phone_count: 1 });
    } else if (data.item_type === 'car') {
      // Лот был снят из личного гаража — возвращаем машину владельцу.
      setHasCar(true); setCarModel(data.item_data);
      await sync({ car_model: data.item_data });
      showMsg("Машина вернулась в гараж!");
    } else if (data.item_type === 'house') {
      setHasHouse(true); setHouseType(data.item_data);
      await sync({ house_type: data.item_data });
      showMsg("Квартира вернулась к тебе!");
    } else {
      showMsg("Товар на складе!");
    }
    loadData(true); loadMarket();
  });

  const orderCar = (model: 'lada' | 'toyota', amount: number) => action(async () => {
    const salon = myBizs.find(b => b.biz_type === 'salon');
    if (!salon || carOrderEnd > 0) return showMsg("У тебя уже едут машины!", true);
    // По дизайн-доку без Механика заказ не оформить (сервер тоже проверяет).
    if (!roleCount(salon.id, 'Механик')) return showMsg("Нужен хотя бы один механик!", true);

    // Цену партии, время (15/45 мин) и штрафы (Продавец) считает сервер (start_car_order_rpc).
    const { data, error } = await supabase.rpc('start_car_order_rpc', { p_biz_id: salon.id, p_player_id: pid, p_model: model, p_amount: amount });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) {
      setMoney(Number(data.money));
      setCarOrderEnd(Number(data.car_order_end));
      if (Number(data.fine) > 0) showMsg(`Нет продавца: x3 времени + ${data.fine}₽ таможни`, true);
    }
    showMsg(`Заказ на ${amount} ${model === 'lada' ? 'Лад' : 'Тойот'} оформлен!`); hapticFeedback('heavy');
    await afterAction();
  });

  const startBuild = () => action(async () => {
    const constr = myBizs.find(b => b.biz_type === 'construction');
    if (!constr || buildEnd > 0) return showMsg("Стройка уже идет!", true);
    // По дизайн-доку без Строителя стройка не запускается (сервер тоже проверяет).
    if (!roleCount(constr.id, 'Строитель')) return showMsg("Нужен хотя бы один строитель!", true);

    // Стоимость (350к), время (база 1 час) и штраф без Прораба считает сервер (start_build_rpc).
    const { data, error } = await supabase.rpc('start_build_rpc', { p_biz_id: constr.id, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) {
      setMoney(Number(data.money));
      setBuildEnd(Number(data.build_end));
      setMyBizs(prev => prev.map(b => b.id === constr.id ? { ...b, build_end: Number(data.build_end) } : b));
      if (Number(data.fine) > 0) showMsg(`Нет прораба: x3 времени + ${data.fine}₽/час простоя`, true);
    }
    showMsg("Стройка началась!"); hapticFeedback('heavy');
    await afterAction();
  });

  const work = () => action(async () => {
    const energyCost = hasCar ? 10 : 20;
    if (energy < energyCost) return showMsg("Ты слишком устал!", true);
    const { data, error } = await supabase.rpc('work_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) return showMsg(data.error, true);
    setMoney(Number(data.money)); setEnergy(Number(data.energy));
    showMsg(`+${data.work_pay} монет`); hapticFeedback('medium');
    await afterAction(); // мгновенное обновление цифр с сервера
    if (onboardStep === 0) { if (tutorialWorkClicks >= 2) { setTutorialWorkClicks(0); await advanceTutorial(1); } else setTutorialWorkClicks(c => c + 1); }
  });

  const rest = () => action(async () => {
    if (tLeft > 0 || energy >= maxEnergy) return;
    const { data, error } = await supabase.rpc('rest_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setEnergy(maxEnergy);
    // Кулдаун отдыха считает СЕРВЕР (rest_end = now + реальный CD). Клиент просто
    // показывает таймер до этой метки — раньше тут был рассинхрон (клиент 70с / сервер 90с).
    setRestEnd(Number(data.rest_end) || (Date.now() + restTime));
    setTLeft(Math.max(0, Math.ceil(((Number(data.rest_end) || Date.now() + restTime) - Date.now()) / 1000)));
    showMsg(`Энергия восстановлена!`); hapticFeedback('light');
    if (onboardStep === 1) await advanceTutorial(2);
    await afterAction();
  });

  const buyCoffee = (cafe: any) => action(async () => {
    const { data, error } = await supabase.rpc('buy_coffee_rpc', { p_buyer_id: pid, p_cafe_id: cafe.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    
    setBrewEnd(data.brew_end);
    if (data.money != null) setMoney(Number(data.money)); // деньги списывает сервер — синхронизируем баланс сразу
    showMsg(`Кофе готовится (15 сек)...`); hapticFeedback('heavy');
    await afterAction();
  });

  const collect = () => action(async () => {
    const coffeeBiz = myBizs.find(b => b.biz_type === 'coffee');
    if (!coffeeBiz?.coffee_balance) return;
    // Сервер атомарно: начисляет кассу игроку, обнуляет coffee_balance, возвращает сумму.
    const { data, error } = await supabase.rpc('collect_coffee_cash_rpc', { p_biz_id: coffeeBiz.id, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) {
      setMoney(Number(data.money));
      setMyBizs(prev => prev.map(b => b.id === coffeeBiz.id ? { ...b, coffee_balance: 0 } : b));
      showMsg(`Собрано ${data.collected}`); hapticFeedback('medium');
      await afterAction();
    }
  });

  const upgradeBusinessPassive = (bizId: string) => action(async () => {
    const { data, error } = await supabase.rpc('upgrade_business_passive_rpc', { p_biz_id: bizId, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    setMyBizs(prev => prev.map(b => b.id === bizId ? { ...b, passive_level: Number(data.level), passive_balance: Number(data.passive_balance), passive_updated_at: data.passive_updated_at } : b));
    showMsg(`Пассивный доход улучшен до уровня ${data.level}!`);
    await afterAction();
  });

  const collectBusinessPassive = (bizId: string) => action(async () => {
    const { data, error } = await supabase.rpc('collect_business_passive_rpc', { p_biz_id: bizId, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    setMyBizs(prev => prev.map(b => b.id === bizId ? { ...b, passive_balance: 0, passive_updated_at: data.passive_updated_at } : b));
    showMsg(`Пассивный доход собран: ${Number(data.collected).toLocaleString('ru-RU')} ₽`);
    await afterAction();
  });

  const hire = (bizId: string, roleName: string, salary: number) => action(async () => {
    if (myJob) return showMsg("Вы уже работаете", true);
    const { data, error } = await supabase.rpc('hire_worker_rpc', { p_player_id: pid, p_player_name: nick, p_business_id: bizId, p_role: roleName, p_salary: salary });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    showMsg("Вы устроены!"); setBoardOpen(false); hapticFeedback('medium'); loadData(true); await afterAction();
  });

  const fire = (workerId: string) => action(async () => {
    const { data, error } = await supabase.rpc('fire_worker_rpc', { p_worker_id: workerId, p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    setAllWorkers(data.workers || []);
    showMsg("Сотрудник уволен."); hapticFeedback('heavy');
    await afterAction();
  });

  const quit = () => action(async () => {
    if (!myJob) return;
    const { data, error } = await supabase.rpc('quit_job_rpc', { p_player_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    setMyJob(null); 
    setQuitOpen(false); setBoardOpen(false); showMsg("Вы уволились."); hapticFeedback('heavy');
    await afterAction();
  });

  const buyPhone = (buy: boolean) => action(async () => {
    const { data, error } = await supabase.rpc('buy_phone_rpc', { p_player_id: pid, p_is_buying: buy });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(data.money);
    setMarketSlots(data.market_slots);
    setPhone(buy);
    await sync({ phone_count: buy ? 1 : 0 }); // синхронизируем счётчик телефонов с БД
    showMsg(buy ? "Куплено! +1 слот" : `Сдан за 1400`); hapticFeedback('heavy');
    await afterAction();
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
    await afterAction();
  });

  const buyLot = (item: any) => action(async () => {
    if (item.item_type === 'phone' && item.item_data === 'phone' && phone) return showMsg("У тебя уже есть телефон", true);
    const commission = dayMod?.type === 'market_slots' ? 0 : 5;
    const { data, error } = await supabase.rpc('buy_market_item', { p_buyer_id: pid, p_item_id: item.id, p_commission_percent: commission });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    if (item.item_type === 'phone') { setPhone(true); await sync({ phone_count: 1 }); }
    if (item.item_type === 'car') { setHasCar(true); setCarModel(item.item_data); await sync({ car_model: item.item_data }); }
    if (item.item_type === 'house') { setHasHouse(true); setHouseType(item.item_data); await sync({ house_type: item.item_data }); }

    showMsg(`Покупка успешна!`); hapticFeedback('heavy');
    await loadData(true);
    loadMarket(); await afterAction();
  });

  const inviteFriend = () => {
    if (!tg || !pid) return; hapticFeedback('medium');
    const refLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${getUid()}`;
    const text = "Смотри какая Житуха залетай и ты! По моему приглашению ты получишь +1000 валюты:";
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`);
  };

  const collectRefBonus = () => action(async () => {
    const { data, error } = await supabase.rpc('collect_ref_bonus_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(data.money);
    setRefBalance(0);
    showMsg(`Собрано ${data.collected} с рефералов!`); hapticFeedback('heavy'); setRefOpen(false);
    await afterAction();
  });

  const collectTips = () => action(async () => {
    const { data, error } = await supabase.rpc('collect_tips_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(data.money);
    setTipBalance(0);
    showMsg(`Собрано ${data.collected}₽ чаевых!`); hapticFeedback('heavy');
    await afterAction();
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
    // Деньги начисляет сервер — ставим точный баланс из ответа (сервер возвращает money).
    setMoney(Number(data.money != null ? data.money : money + data.amount));
    showMsg(`+${data.amount} монет!`); setPromoOpen(false); setPromoInput('');
    await afterAction();
  });

  const resetGame = () => action(async () => {
    const c1 = window.confirm("ВНИМАНИЕ! Ты собираешься ПОЛНОСТЬЮ ОБНУЛИТЬ игру (деньги, бизнесы, машины, квартиры у ВСЕХ игроков). Продолжить?");
    if (!c1) return;
    const c2 = window.confirm("ТОЧНО-ТОЧНО? Это действие нельзя будет отменить!");
    if (!c2) return;

    const { data, error } = await supabase.rpc('reset_game_rpc', { p_admin_id: pid });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);

    showMsg("Игра полностью сброшена!"); hapticFeedback('heavy');
    loadData(true);
    loadMarket();
  });
  
    const quickBuyBiz = (type: 'coffee' | 'salon' | 'taxi' | 'phone_factory' | 'construction') => {
    if (myBizs.some(b => b.biz_type === type)) { setActiveBizType(type); setTab('business'); return; }
    const price = BIZ_PRICES[type];
    if (!price) return showMsg("Неизвестный тип бизнеса", true);
    if (money < price) return showMsg(`Нужно ${price.toLocaleString('ru-RU')}₽`, true);
    setBuyingType(type); // открывает модалку ввода названия -> submitBizName делает покупку
  };

  const app = useMemo(() => ({
    user, tg, startParam, proc, toast, tab, setTab, hapticFeedback, nick, money, setMoney, energy, phone, hasCar, carModel, hasHouse, houseType, refBalance, tipBalance, myRefs, myBizs, activeBizType, setActiveBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, setMarketTab, players, referralLeaderboard, referralLeaderboardUnavailable, market, myJob, allWorkers, allBiz, selCafe, setSelCafe, boardOpen, setBoardOpen, sellOpen, setSellOpen, sellPrice, setSellPrice, sellItemType, setSellItemType, sellItemData, setSellItemData, sellSource, setSellSource, quitOpen, setQuitOpen, refOpen, setRefOpen, avatarId, tgId, setInNick, selG, inNick, restEnd, brewEnd, tLeft, bLeft, pid, maxEnergy, restTime, onboardStep, tutorialWorkClicks, marketSlots, workPay, bizBonusPercent, modifierOpen, setModifierOpen, isDailyOpen, setIsDailyOpen, dailyStreak, boostEnd, claimDaily, buyingType, setBuyingType, bizNameInput, setBizNameInput, submitBizName, promoOpen, setPromoOpen, promoInput, setPromoInput, redeemPromo, adminTab, setAdminTab, role, supabase, showMsg, skipTutorial, drinkTutorialCoffee, action, work, rest, buyCoffee, collect, orderCar, startBuild, hire, fire, quit, buyPhone, listItem, buyLot, inviteFriend, collectRefBonus, collectTips, handleAvatar, verifySubscription, selectGender, reg, claimTutorialReward, cancelLot, sellBusiness, addTaxiCar, collectTaxi, repairTaxiCar, orderPhones, loadData,
    bugOpen, setBugOpen, bugText, setBugText, submitBug, resetGame, quickBuyBiz, upgradeBusinessPassive, collectBusinessPassive
  }), [
    user, tg, startParam, proc, toast, tab, nick, money, energy, phone, hasCar, carModel, hasHouse, houseType, refBalance, tipBalance, myRefs, myBizs, activeBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, players, referralLeaderboard, referralLeaderboardUnavailable, market, myJob, allWorkers, allBiz, selCafe, boardOpen, sellOpen, sellPrice, sellItemType, sellItemData, sellSource, quitOpen, refOpen, avatarId, tgId, selG, inNick, restEnd, brewEnd, tLeft, bLeft, pid, maxEnergy, restTime, onboardStep, tutorialWorkClicks, marketSlots, workPay, bizBonusPercent, modifierOpen, isDailyOpen, dailyStreak, boostEnd, buyingType, bizNameInput, promoOpen, promoInput, adminTab, role, bugOpen, bugText, showMsg
  ]);

  const activeBiz = myBizs.find(b => b.biz_type === activeBizType);
  const currentStock = getStock(activeBiz);

  // Быстрая покупка бизнеса прямо с главной. Название спрашиваем в модалке (как в BusinessTab),
  // чтобы не вставлять пустую строку и не падать на NOT NULL / уникальности имени.


  const pageStyle: any = { padding: 'calc(100px + env(safe-area-inset-top, 20px)) 20px calc(90px + env(safe-area-inset-bottom, 20px))', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', background: 'transparent', color: '#2f2a1d' };
  const authPageStyle: any = { ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

  if (loading) return <div style={{ color: '#2f2a1d', textAlign: 'center', marginTop: 'calc(100px + env(safe-area-inset-top, 20px))' }}>Загрузка...</div>;
  // Gate: в Telegram без успешно проверенной сервером подписи initData игру не показываем.
  if (isTgEnv && user && !authChecked) {
    return <div style={authPageStyle}><ShieldAlert size={50} color="#3d7ea6" style={{ marginBottom: 20 }} /><h2>Проверка аккаунта…</h2><p style={{ color: '#6b5f45', maxWidth: 300 }}>Telegram-безопасность: подтверждаем подпись.</p></div>;
  }
  if (isCheckingSub) return <div style={authPageStyle}><Send size={50} color="#3d7ea6" style={{ marginBottom: 20, animation: 'pulse 1.5s infinite' }} /><h2>Проверяем подписку...</h2></div>;
  if (isBanned) return <div style={authPageStyle}><ShieldAlert size={80} color="#c0453a" style={{ marginBottom: 20 }} /><h1>Вы забанены!</h1><p style={{ color: '#6b5f45', maxWidth: '300px' }}>Администрация заблокировала ваш аккаунт.</p></div>;
  
  // Окно подписки показываем ТОЛЬКО когда точно знаем (из БД), что не подписан.
  // isSubscribed === undefined (данные ещё грузятся) — не мигаем экраном.
  if (user && isSubscribed === false) return (
    <div style={authPageStyle}>
      <Toast toast={toast} onClose={closeToast} /><Send size={60} color="#3d7ea6" style={{ marginBottom: 20 }} /><h1>Подпишись на канал!</h1>
      <p style={{ color: '#6b5f45', marginBottom: 30, maxWidth: '300px' }}>Чтобы играть в Житуху, нужно быть подписанным на наш канал.</p>
      <Btn variant="secondary" onClick={() => tg?.openTelegramLink(CHANNEL_LINK)} style={{ maxWidth: '280px', marginBottom: 15 }}><Send size={20} /> Подписаться</Btn>
      <Btn variant="primary" onClick={verifySubscription} style={{ maxWidth: '280px' }}>Я подписался</Btn>
    </div>
  );

  if (!nick || !gender) return (
    <div style={authPageStyle}>
      <Toast toast={toast} onClose={closeToast} /><h1>Житуха</h1><p style={{ color: '#6b5f45', marginBottom: '30px' }}>Создай персонажа</p>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button onClick={() => selectGender('male')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'male' ? 'rgba(61,126,166,0.15)' : '#fbf4e4', border: selG === 'male' ? '2px solid #3d7ea6' : '2px solid transparent', borderRadius: 8, color: '#2f2a1d' }}>Парень</button>
        <button onClick={() => selectGender('female')} style={{ fontSize: 20, padding: '10px 20px', cursor: 'pointer', backgroundColor: selG === 'female' ? 'rgba(61,126,166,0.15)' : '#fbf4e4', border: selG === 'female' ? '2px solid #3d7ea6' : '2px solid transparent', borderRadius: 8, color: '#2f2a1d' }}>Девушка</button>
      </div>
      {selG && <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', marginBottom: '20px' }}>{AVATARS.filter(a => a.gender === selG).map(a => <button key={a.id} onClick={() => { setAvatarId(a.id); hapticFeedback('light'); }} style={{ width: 60, height: 60, borderRadius: '50%', background: a.bg, fontSize: 30, cursor: 'pointer', border: avatarId === a.id ? '3px solid white' : '3px solid transparent', boxShadow: avatarId === a.id ? '0 0 15px rgba(90,70,40,0.5)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>{a.emoji}</button>)}</div>}
      {user?.first_name ? <div style={{ ...S.input, maxWidth: '280px', backgroundColor: 'transparent', border: 'none', fontSize: 22, fontWeight: 'bold' }}>Ник: {user.first_name}</div> : <input type="text" value={inNick} onChange={(e: any) => setInNick(e.target.value)} placeholder="Ник..." style={{ ...S.input, maxWidth: '280px' }} />}
      <Btn variant="primary" onClick={reg} disabled={proc} style={{ maxWidth: '280px' }}>Начать жизнь</Btn>
    </div>
  );

  return (
    <div style={pageStyle}>
      <Toast toast={toast} onClose={closeToast} />
      <Suspense fallback={null}><DailyRewardModal app={app} /><AppModals app={app} /></Suspense>
      <Modal open={modifierOpen} onClose={() => setModifierOpen(false)}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔥</div>
        <h3 style={{ marginTop: 0, color: dayMod?.color || '#2f2a1d' }}>{dayMod?.name || 'Событие'}</h3>
        <p style={{ fontSize: 16 }}>{dayMod?.desc || 'Описание'}</p>
        <p style={{ color: '#6b5f45', fontSize: 12, marginBottom: 20 }}>Модификатор действует до полуночи по серверному времени.</p>
        <Btn variant="secondary" onClick={() => setModifierOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Понятно</Btn>
      </Modal>

      <Suspense fallback={<div className="loading">Загрузка…</div>}>
        {tab === 'home' && <HomeTab app={app} />}
        {tab === 'cafe' && <CafeTab app={app} />}
        {tab === 'business' && <BusinessTab app={app} activeBiz={activeBiz} currentStock={currentStock} />}
        {tab === 'jobs' && <JobsTab app={app} />}
        {tab === 'shop' && <ShopTab app={app} />}
        {tab === 'market' && <MarketTab app={app} />}
        {tab === 'inventory' && <InventoryTab app={app} />}
        {tab === 'casino' && <CasinoTab app={app} />}
        {tab === 'admin' && <AdminTab app={app} />}
      </Suspense>
      {tab !== 'admin' && <BottomNav app={app} />}
    </div>
  );
}
