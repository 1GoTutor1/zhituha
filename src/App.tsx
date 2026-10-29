import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';
import { Send, ShieldAlert, Wrench } from 'lucide-react';
import { isUiSoundEnabled, playUiSound, setUiSoundEnabled, type UiSound } from './sound';
import { getUiTheme, isUiVibrationEnabled, persistUiTheme, setUiVibrationEnabled, type UiTheme } from './preferences';
import { 
  BOT_USERNAME, CHANNEL_LINK, POLL, 
  AVATARS,
  getStock, S, APARTMENTS_PER_BUILD, BUTTON_BATCH_SIZE,
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
const ProfileTab = lazy(() => loadTabs().then((module) => ({ default: module.ProfileTab })));
const CasinoTab = lazy(() => import('./casino').then((module) => ({ default: module.CasinoTab })));
const BankTab = lazy(() => import('./BankTab').then((module) => ({ default: module.BankTab })));

export default function App() {
  const { user, hapticFeedback, tg, startParam } = useTelegram();

  // Ждём ответа /api/auth (серверная проверка подписи initData), но не дольше 5 сек.
  const [authChecked, setAuthChecked] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceAdmin, setMaintenanceAdmin] = useState(false);
  const [maintenanceBypass, setMaintenanceBypass] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isUiSoundEnabled);
  const [vibrationEnabled, setVibrationEnabledState] = useState(isUiVibrationEnabled);
  const [uiTheme, setUiThemeState] = useState<UiTheme>(getUiTheme);

  const changeSoundEnabled = (enabled: boolean) => {
    setUiSoundEnabled(enabled);
    setSoundEnabledState(enabled);
  };
  const changeVibrationEnabled = (enabled: boolean) => {
    setUiVibrationEnabled(enabled);
    setVibrationEnabledState(enabled);
    if (enabled) hapticFeedback('light');
  };
  const changeUiTheme = (theme: UiTheme) => {
    persistUiTheme(theme);
    setUiThemeState(theme);
  };

  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    document.body.dataset.uiTheme = uiTheme;
    const themeColor = uiTheme === 'dark' ? '#171a18' : '#efe3c8';
    try {
      (window as any).Telegram?.WebApp?.setHeaderColor(themeColor);
      (window as any).Telegram?.WebApp?.setBackgroundColor(themeColor);
    } catch { /* CSS theme still works outside Telegram. */ }
  }, [uiTheme]);
  useEffect(() => {
    const playButtonTap = (event: MouseEvent) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      if (event.target.closest('button:not(:disabled), [role="button"]')) playUiSound('tap');
    };
    document.addEventListener('click', playButtonTap, true);
    return () => document.removeEventListener('click', playButtonTap, true);
  }, []);
  useEffect(() => {
    if (!user) return;
    if (user.verified) { setAuthChecked(true); return; }
    const to = setTimeout(() => setAuthChecked(true), 5000);
    return () => clearTimeout(to);
  }, [user]);

  const refreshMaintenance = async () => {
    setMaintenanceError('');
    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось проверить режим техработ');
      setMaintenanceEnabled(Boolean(result.enabled));
      setMaintenanceAdmin(Boolean(result.is_admin));
      if (!result.enabled) setMaintenanceBypass(false);
      setMaintenanceChecked(true);
    } catch (error) {
      setMaintenanceError(error instanceof Error ? error.message : 'Не удалось проверить режим техработ');
      setMaintenanceEnabled(false);
      setMaintenanceAdmin(false);
      setMaintenanceChecked(true);
    }
  };

  useEffect(() => {
    void refreshMaintenance();
    const timer = window.setInterval(() => { void refreshMaintenance(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [user]);

  const setMaintenance = async (enabled: boolean) => {
    setMaintenanceBusy(true);
    setMaintenanceError('');
    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', enabled, init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось изменить режим техработ');
      setMaintenanceEnabled(Boolean(result.enabled));
      setMaintenanceAdmin(Boolean(result.is_admin));
      if (!enabled) setMaintenanceBypass(false);
    } catch (error) {
      setMaintenanceError(error instanceof Error ? error.message : 'Не удалось изменить режим техработ');
    } finally { setMaintenanceBusy(false); }
  };
  
  const [loading, setLoading] = useState(!!(window as any).Telegram?.WebApp?.initDataUnsafe?.user);
  const [isCheckingSub, setIsCheckingSub] = useState(Boolean(user?.id));
  const [subscriptionError, setSubscriptionError] = useState('');
  const [proc, setProc] = useState(false);
  const [pid, setPid] = useState<string | null>(null);
  const [tgId, setTgId] = useState('');
  const [toast, setToast] = useState<{ msg: string, err: boolean, id: number } | null>(null);
  const [tab, setTab] = useState<'home' | 'shop' | 'inventory' | 'market' | 'business' | 'jobs' | 'cafe' | 'casino' | 'bank' | 'profile' | 'admin'>('home');
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
  const [premiumBalance, setPremiumBalance] = useState(0);
  const [ownedCosmetics, setOwnedCosmetics] = useState<string[]>([]);
  const [profileFrame, setProfileFrame] = useState('');
  const [profileBackground, setProfileBackground] = useState('');
  const [career, setCareer] = useState<any>({ level: 1, xp: 0, xp_to_next: 100, profession: 'miner', unlocked: ['miner'], active_cycle: null, pending_reward: null, inventory: [], inventory_slots: 0, inventory_capacity: 200 });
  // undefined = ещё не прочитали из БД; true/false — реальное значение.
  // Раньше стартовало с false → при каждом заходе на секунду мелькал экран
  // «Подпишись на канал», пока loadData не дочитает is_subscribed=true.
  const [isSubscribed, setIsSubscribed] = useState<boolean | undefined>(undefined);

  const [money, setMoney] = useState(3500);
  const [phone, setPhone] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [carModel, setCarModel] = useState('none');
  const [carHealth, setCarHealth] = useState(100);
  const [hasHouse, setHasHouse] = useState(false);
  const [houseType, setHouseType] = useState('none');
  const [refBalance, setRefBalance] = useState(0);
  const [tipBalance, setTipBalance] = useState(0);
  const [myRefs, setMyRefs] = useState<any[]>([]);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [boostEnd, setBoostEnd] = useState(0);

  const [brewEnd, setBrewEnd] = useState(0);
  const [bLeft, setBLeft] = useState(0);
  const [carOrderEnd, setCarOrderEnd] = useState(0);
  const [carTimeLeft, setCarTimeLeft] = useState(0);
  const [buildEnd, setBuildEnd] = useState(0);
  const [buildTimeLeft, setBuildTimeLeft] = useState(0);
  const [phoneProdEnd, setPhoneProdEnd] = useState(0);
  const [phoneProdTimeLeft, setPhoneProdTimeLeft] = useState(0);

  const [myBizs, setMyBizs] = useState<any[]>([]);
  const [activeBizType, setActiveBizType] = useState<'coffee' | 'salon' | 'construction' | 'taxi' | 'minimarket' | 'auto_repair'>('coffee');
  const [activeBizId, setActiveBizId] = useState<string | null>(null);
  const [businessCatalog, setBusinessCatalog] = useState<any>({ owned_count: 0, limit: 3, locations: [] });
  const [vehicleState, setVehicleState] = useState<any>({ models: [], dealers: [] });
  const chooseBizType = (type: typeof activeBizType) => { setActiveBizType(type); setActiveBizId(null); };
  const [marketTab, setMarketTab] = useState<'items' | 'cars' | 'realestate' | 'shops'>('items');
  const [businessOffers, setBusinessOffers] = useState<any>({ products: [], shops: [], repair_shops: [] });
  const [players, setPlayers] = useState<any[]>([]);
  const [referralLeaderboard, setReferralLeaderboard] = useState<any[]>([]);
  const [referralLeaderboardUnavailable, setReferralLeaderboardUnavailable] = useState(false);
  const [market, setMarket] = useState<any[]>([]);
  
  const [myJob, setMyJob] = useState<any>(null);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [allBiz, setAllBiz] = useState<any[]>([]);
  const [selCafe, setSelCafe] = useState<any>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'players' | 'promos' | 'logs' | 'market'>('players');

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

  const dayMod = getDayModifier();
  
  let bizBonusPercent = 0;
  myBizs.forEach(b => {
    if (b.biz_type === 'coffee') bizBonusPercent += 5;
    else if (b.biz_type === 'salon') bizBonusPercent += 10;
    else if (b.biz_type === 'taxi') bizBonusPercent += 15;
    else if (b.biz_type === 'phone_factory') bizBonusPercent += 20;
    else if (b.biz_type === 'construction') bizBonusPercent += 25;
  });

  const baseWorkPay = JOB_WORK;
  const workPay = Math.floor(baseWorkPay * (1 + bizBonusPercent / 100));

  const showMsg = (msg: string, err = false, sound?: UiSound) => {
    setToast({ msg, err, id: Date.now() });
    playUiSound(sound || (err ? 'error' : 'success'));
  };
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
    if (!pid || !brewEnd || brewEnd > Date.now()) return;
    setBrewEnd(0);
    setBLeft(0);
    showMsg('Кофе готов: можно пить!');
    hapticFeedback('heavy');
  };
  const pollMyBizs = async () => {
    if (!pid) return;
    const { data } = await supabase.from('businesses')
      .select('id, owner_id, biz_type, business_name, location_key, cash_balance, taxi_owner_cut_percent, stock, coffee_balance, build_end, car_order_end, last_collected, created_at, passive_level, passive_balance, passive_updated_at')
      .eq('owner_id', pid);
    if (data) setMyBizs(data);
  };

  const pollWorkers = async () => {
    if (!pid) return;
    const { data, error } = await supabase.from('business_workers').select('*');
    if (error || !data) return;
    setAllWorkers(data);
    setMyJob(data.find((worker: any) => worker.player_id === pid) || null);
  };

  const loadData = async (silent = false) => {
    if (lock.current && !silent) return;
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
        supabase.from('businesses').select('id, owner_id, owner_name, biz_type, business_name, worker_id, worker_name, coffee_balance, last_collected'),
        supabase.from('business_workers').select('*')
      ]);

      if (d.is_banned) { setIsBanned(true); setLoading(false); return; }
      
      setPid(d.id); setNick(d.nickname); setGender(d.gender); setAvatarId(d.avatar_id || 1);
      setRole(d.role || 'player'); setMoney(Number(d.money));
      setPhone(Number(d.phone_count) > 0); setHasCar(d.has_car || false); setCarModel(d.car_model || 'none'); setCarHealth(Number(d.car_health ?? 100));
      setHasHouse(d.has_house || false); setHouseType(d.house_type || 'none');
      setRefBalance(Number(d.referral_balance) || 0); setDailyStreak(Number(d.daily_streak) || 0);
      setBoostEnd(Number(d.boost_end) || 0); setOnboardStep(Number(d.onboarding_step) || 0);
      setMarketSlots(Number(d.market_slots) || 3);
      setPremiumBalance(Number(d.premium_balance) || 0);
      setOwnedCosmetics(Array.isArray(d.owned_cosmetics) ? d.owned_cosmetics : []);
      setProfileFrame(d.profile_frame || '');
      setProfileBackground(d.profile_background || '');
      if (profileResult.profession) setCareer(profileResult.profession);
      setBrewEnd(Number(d.brew_end) || 0);
      setTipBalance(Number(d.tip_balance) || 0);
      setIsSubscribed(d.is_subscribed !== false); // undefined -> true/false из БД, без мигания окна подписки

      // Показываем основной экран сразу после профиля; бизнесы и вакансии дозагружаются параллельно.
      if (!silent) setLoading(false);

      if (!silent) {
        const timeDiff = Date.now() - (Number(d.last_claim) || 0);
        if (timeDiff > 86400000) { 
           if (timeDiff > 172800000 && Number(d.daily_streak) !== 0) {
             setDailyStreak(0);
           }
           setIsDailyOpen(true);
        }
      }
      
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
    if (pid) {
      const [shopState, vehicleData] = await Promise.all([
        supabase.rpc('business_shop_state_rpc', { p_player_id: pid }),
        supabase.rpc('business_vehicle_state_rpc', { p_player_id: pid }),
      ]);
      if (!shopState.error && shopState.data) { setBusinessOffers(shopState.data); setCarHealth(Number(shopState.data.personal_car_health ?? 100)); }
      if (!vehicleData.error && vehicleData.data) setVehicleState(vehicleData.data);
    }
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
    if (result.profession) setCareer(result.profession);
    if (data.is_banned) { setIsBanned(true); return; }
    setMoney(Number(data.money));
    setRefBalance(Number(data.referral_balance) || 0); setTipBalance(Number(data.tip_balance) || 0);
    setBoostEnd(Number(data.boost_end) || 0); setBrewEnd(Number(data.brew_end) || 0);
    // Имущество/слоты — чтобы после покупки/продажи телефона, машины, квартиры
    // цифры на экране сходились с БД без полного reload.
    setPhone(Number(data.phone_count) > 0);
    setHasCar(!!data.has_car); setCarModel(data.car_model || 'none'); setCarHealth(Number(data.car_health ?? 100));
    setHasHouse(!!data.has_house); setHouseType(data.house_type || 'none');
    setMarketSlots(Number(data.market_slots) || 3);
    setPremiumBalance(Number(data.premium_balance) || 0);
    setOwnedCosmetics(Array.isArray(data.owned_cosmetics) ? data.owned_cosmetics : []);
    setProfileFrame(data.profile_frame || '');
    setProfileBackground(data.profile_background || '');
    return data;
  };

  const donationAction = async (action: string, extra: Record<string, unknown> = {}) => {
    const response = await fetch('/api/donations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, init_data: (window as any).Telegram?.WebApp?.initData || '', ...extra }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ошибка донат-магазина');
    return result;
  };

  const buyStars = (packageId: string) => action(async () => {
    const result = await donationAction('create_invoice', { package_id: packageId });
    if (!tg?.openInvoice || !result.invoice_url) throw new Error('Открой игру в Telegram, чтобы оплатить Stars');
    tg.openInvoice(result.invoice_url, async (status: string) => {
      if (status === 'paid') {
        const expectedCredits: Record<string, number> = { starter: 50, popular: 250, big: 650 };
        const expectedBalance = premiumBalance + (expectedCredits[packageId] || 0);
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          let updated;
          try { updated = await refreshProfile(); } catch { /* Retry while Telegram delivers the payment webhook. */ }
          if (Number(updated?.premium_balance) >= expectedBalance) {
            showMsg('Stars получены! Жетоны начислены');
            return;
          }
        }
        showMsg('Оплата прошла. Баланс синхронизируется, зайди в игру чуть позже.');
      } else if (status === 'failed' || status === 'cancelled') {
        try { await donationAction('close_invoice', { order_id: result.order_id }); }
        catch (error) { console.error('Не удалось закрыть неоплаченный счёт:', error); }
        showMsg(status === 'failed' ? 'Платёж не прошёл. Новый счёт можно открыть сразу.' : 'Счёт закрыт. Новый можно открыть сразу.');
      }
    });
  });

  const donateAction = (actionType: string, extra: Record<string, unknown> = {}) => action(async () => {
    const result = await donationAction(actionType, extra);
    if (result.player) {
      setPremiumBalance(Number(result.player.premium_balance) || 0);
      setMoney(Number(result.player.money) || 0);
      setMarketSlots(Number(result.player.market_slots) || 3);
      setOwnedCosmetics(Array.isArray(result.player.owned_cosmetics) ? result.player.owned_cosmetics : []);
      setProfileFrame(result.player.profile_frame || '');
      setProfileBackground(result.player.profile_background || '');
    }
    showMsg(result.message || 'Готово!');
  });

  // После каждого успешного действия подтягиваем актуальные цифры с сервера,
  // чтобы интерфейс обновлялся мгновенно (деньги/энергия/таймеры/склады).
  const afterAction = async () => {
    try { await Promise.all([refreshProfile(), pollMyBizs()]); } catch {}
  };

  const loadBusinessCatalog = async () => {
    const { data, error } = await supabase.rpc('business_catalog_rpc', { p_player_id: pid });
    if (!error && data) setBusinessCatalog(data);
  };

  useEffect(() => {
    if (tab === 'market') { loadMarket(); refreshProfile(); pollMyBizs(); }
    if (tab === 'business') { refreshBusinessOffers(); refreshVehicleState(); }
    if (tab === 'shop' || tab === 'inventory') { refreshProfile(); pollMyBizs(); }
    if (['business', 'jobs', 'cafe'].includes(tab)) {
      refreshProfile(); pollMyBizs(); pollWorkers();
      if (tab === 'business') loadBusinessCatalog();
      const int = setInterval(() => { refreshProfile(); pollMyBizs(); pollWorkers(); if (tab === 'business') loadBusinessCatalog(); }, POLL);
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
      showMsg(msg, false, 'reward'); hapticFeedback('heavy'); loadData(true); sendNotification(notifyText);
      return true;
    } catch (e) { return false; }
  };

  useEffect(() => {
    const int = setInterval(() => {
      const now = Date.now();
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
            const modelName = vehicleState.models.find((item: any) => item.model_id === model)?.model_name || model;
            finishOrder(salon,
              'Машины приехали!', `🚗 В автосалон приехали ${modelName} ×${amount}!`);
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
  }, [brewEnd, carOrderEnd, buildEnd, phoneProdEnd, pid, myBizs, vehicleState]);

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
    let result: any;
    try {
      result = await response.json();
    } catch {
      if (import.meta.env.DEV && response.status === 404) {
        throw new Error('Локальный Vite не запускает серверный /api/register. Для регистрации нужен backend через Vercel Dev.');
      }
      throw new Error('Сервер регистрации вернул пустой или некорректный ответ.');
    }
    if (!response.ok || !result.player) throw new Error(result.error || 'Не удалось создать аккаунт');
    const data = result.player;
    setPid(data.id); setNick(data.nickname || final); setGender(data.gender || selG); setAvatarId(data.avatar_id || avatarId);
    setMoney(Number(data.money) || 0);
    window.setTimeout(() => { void loadData(true); }, 0);
    if (result.referred) showMsg("Бонус +1000 монет за приглашение!");
  });

  const checkSubOnLoad = async () => {
    if (!user?.id) { setIsCheckingSub(false); setIsSubscribed(undefined); return; }
    setIsCheckingSub(true);
    setSubscriptionError('');
    try {
      const response = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscription_check', init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Проверка подписки временно недоступна');
      const subscribed = result.is_subscribed === true;
      setIsSubscribed(subscribed);
      return subscribed;
    } catch (error) {
      setIsSubscribed(undefined);
      setSubscriptionError(error instanceof Error ? error.message : 'Не удалось проверить подписку');
      return null;
    } finally { setIsCheckingSub(false); }
  };

  useEffect(() => { 
    if (user) checkSubOnLoad(); 
    else { setIsCheckingSub(false); setIsSubscribed(undefined); setSubscriptionError(''); }
  }, [user]);

  const verifySubscription = async () => {
    if (!user?.id) return;
    hapticFeedback('medium');
    const subscribed = await checkSubOnLoad();
    if (subscribed === true) showMsg("Подписка подтверждена. Добро пожаловать!");
    else if (subscribed === false) showMsg("Подписка пока не найдена. Подпишись на канал и попробуй ещё раз.", true);
  };

  const drinkTutorialCoffee = () => action(async () => {
    await advanceTutorial(3);
    showMsg('Продолжаем обучение');
    hapticFeedback('light');
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
    if (typeof data.boost_end === 'number') setBoostEnd(data.boost_end);
    if (data.reward_type === 'money') showMsg(data.boost_awarded ? `Награда: +${data.reward_amount} монет и БУСТ x1.1!` : `Награда: +${data.reward_amount} монет!`, false, 'reward');
    else showMsg(`Награда: +${data.reward_amount} монет!`, false, 'reward');
    hapticFeedback('heavy');
    await afterAction();
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
      setMyBizs(prev => prev.map(b => b.id === taxi.id ? { ...b, stock: data.stock } : b));
      showMsg(`Собрано ${data.income} монет!`, false, 'reward');
      await afterAction();
    }
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

  // Сколько мест роли уже нанято в бизнесе (для проверки обязательных ролей на клиенте;
  // сервер всё равно перепроверяет в start_*_rpc).
  const roleCount = (bizId: string | undefined, role: string) =>
    allWorkers.filter(w => w.business_id === bizId && w.role === role).length;

  const purchaseBusinessLocation = (locationKey: string) => action(async () => {
    const { data, error } = await supabase.rpc('purchase_business_location_rpc', { p_player_id: pid, p_location_key: locationKey });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    setActiveBizType(data.biz_type);
    setActiveBizId(data.business_id);
    showMsg(`${data.business_name} куплен за ${Number(data.price).toLocaleString('ru-RU')} ₽`);
    await Promise.all([loadData(true), loadBusinessCatalog()]);
  });

  const refreshBusinessOffers = async () => {
    if (!pid) return;
    const { data, error } = await supabase.rpc('business_shop_state_rpc', { p_player_id: pid });
    if (!error && data) { setBusinessOffers(data); setCarHealth(Number(data.personal_car_health ?? 100)); }
  };

  const refreshVehicleState = async () => {
    if (!pid) return;
    const { data, error } = await supabase.rpc('business_vehicle_state_rpc', { p_player_id: pid });
    if (!error && data) setVehicleState(data);
  };

  const buyTaxiVehicle = (dealerId: string, modelId: string) => action(async () => {
    const taxi = myBizs.find(b => b.id === activeBizId && b.biz_type === 'taxi') || myBizs.find(b => b.biz_type === 'taxi');
    if (!taxi) throw new Error('Таксопарк не найден');
    const { data, error } = await supabase.rpc('taxi_purchase_vehicle_rpc', {
      p_player_id: pid, p_taxi_business_id: taxi.id, p_dealer_id: dealerId, p_model_id: modelId,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMyBizs(current => current.map(b => b.id === taxi.id ? {
      ...b, stock: { ...(b.stock || {}), taxi_cars: data.cars }, cash_balance: Number(data.taxi_cash),
    } : b));
    showMsg(`${data.model_name} куплен для автопарка за ${Number(data.price).toLocaleString('ru-RU')} ₽`);
    await Promise.all([loadData(true), refreshVehicleState()]);
  });

  const transferBusinessCash = (businessId: string, amount: number, direction: 'deposit' | 'withdraw') => action(async () => {
    if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Введи сумму целым числом больше нуля');
    const { data, error } = await supabase.rpc('business_cash_transfer_rpc', {
      p_player_id: pid, p_business_id: businessId, p_amount: amount, p_direction: direction,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    setMyBizs(current => current.map(b => b.id === businessId ? { ...b, cash_balance: Number(data.cash_balance) } : b));
    showMsg(direction === 'deposit' ? 'Деньги внесены в кассу бизнеса' : 'Деньги сняты из кассы бизнеса');
  });

  const buyBusinessProduct = (businessId: string, productId: string, quantity: number) => action(async () => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Количество должно быть от 1 до 20');
    const { data, error } = await supabase.rpc('business_shop_buy_rpc', {
      p_player_id: pid, p_business_id: businessId, p_product_id: productId, p_quantity: quantity,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    showMsg(`${data.product_name} ×${data.quantity}: −${Number(data.total).toLocaleString('ru-RU')} ₽`);
    await Promise.all([refreshBusinessOffers(), refreshProfile()]);
  });

  const restockBusinessProduct = (businessId: string, productId: string, quantity: number) => action(async () => {
    const { data, error } = await supabase.rpc('business_shop_restock_rpc', {
      p_player_id: pid, p_business_id: businessId, p_product_id: productId, p_quantity: quantity,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMyBizs(current => current.map(b => b.id === businessId ? { ...b, cash_balance: Number(data.cash_balance) } : b));
    showMsg(`Закупка выполнена: осталось ${data.quantity} шт.`);
    await Promise.all([refreshBusinessOffers(), pollMyBizs()]);
  });

  const setBusinessProductPrice = (businessId: string, productId: string, price: number) => action(async () => {
    const { data, error } = await supabase.rpc('business_shop_set_price_rpc', {
      p_player_id: pid, p_business_id: businessId, p_product_id: productId, p_price: price,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    showMsg(`Цена сохранена: ${Number(data.retail_price).toLocaleString('ru-RU')} ₽`);
    await refreshBusinessOffers();
  });

  const repairPersonalCarAtShop = (shopId: string) => action(async () => {
    const { data, error } = await supabase.rpc('business_repair_personal_car_rpc', { p_player_id: pid, p_shop_id: shopId });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money)); setCarHealth(Number(data.car_health));
    showMsg(`Машина отремонтирована за ${Number(data.cost).toLocaleString('ru-RU')} ₽`);
    await refreshProfile();
  });

  const repairTaxiCarAtShop = (shopId: string, taxiBusinessId: string, carIndex: number) => action(async () => {
    const { data, error } = await supabase.rpc('business_repair_taxi_car_rpc', {
      p_player_id: pid, p_shop_id: shopId, p_taxi_business_id: taxiBusinessId, p_car_index: carIndex,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMyBizs(current => current.map(b => b.id === taxiBusinessId ? { ...b, stock: { ...(b.stock || {}), taxi_cars: data.cars }, cash_balance: Number(data.cash_balance) } : b));
    showMsg(`Машина таксопарка отремонтирована за ${Number(data.cost).toLocaleString('ru-RU')} ₽`);
    await refreshBusinessOffers();
  });

  const createBusinessAuction = (bizId: string, startingPrice: number) => action(async () => {
    if (!Number.isSafeInteger(startingPrice) || startingPrice < 1) throw new Error('Укажи начальную цену целым числом');
    const { data, error } = await supabase.rpc('create_business_auction_rpc', { p_player_id: pid, p_biz_id: bizId, p_starting_price: startingPrice });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    showMsg(`Бизнес выставлен на торги на 24 часа · от ${Number(data.starting_price).toLocaleString('ru-RU')} ₽`);
    await loadBusinessCatalog();
  });

  const bidBusinessAuction = (auctionId: string, bid: number) => action(async () => {
    if (!Number.isSafeInteger(bid) || bid < 1) throw new Error('Укажи ставку целым числом');
    const { data, error } = await supabase.rpc('bid_business_auction_rpc', { p_player_id: pid, p_auction_id: auctionId, p_bid: bid });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    showMsg(`Ставка ${Number(data.highest_bid).toLocaleString('ru-RU')} ₽ принята`);
    await Promise.all([refreshProfile(), loadBusinessCatalog()]);
  });

  const sellBusiness = (biz: any) => action(async () => {
    if (!window.confirm("Продать бизнес за 50%?")) return;
    const { data, error } = await supabase.rpc('sell_business_to_state_rpc', { p_player_id: pid, p_biz_id: biz.id });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    showMsg(`Бизнес продан государству за ${Number(data?.refund ?? 0).toLocaleString('ru-RU')} ₽`); loadData(true); loadBusinessCatalog(); loadMarket(); await afterAction();
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

  const adminDeleteMarketLot = (item: any) => action(async () => {
    if (!window.confirm(`Удалить лот игрока ${item.seller_name || 'без имени'}? Выставленная вещь вернётся владельцу.`)) return;
    const { data, error } = await supabase.rpc('admin_delete_market_lot_rpc', {
      p_admin_id: pid,
      p_item_id: item.id,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setMarket((current: any[]) => current.filter((lot) => lot.id !== item.id));
    showMsg('Лот удалён, вещь возвращена владельцу');
  });

  const orderCar = (model: string, amount: number) => action(async () => {
    const salon = myBizs.find(b => b.id === activeBizId && b.biz_type === 'salon') || myBizs.find(b => b.biz_type === 'salon');
    if (!salon || carOrderEnd > 0) return showMsg("У тебя уже едут машины!", true);
    // По дизайн-доку без Механика заказ не оформить (сервер тоже проверяет).
    if (!roleCount(salon.id, 'Механик')) return showMsg("Нужен хотя бы один механик!", true);

    // Цену партии, время (15/45 мин) и штрафы (Продавец) считает сервер (start_car_order_rpc).
    const { data, error } = await supabase.rpc('start_car_order_rpc', { p_biz_id: salon.id, p_player_id: pid, p_model: model, p_amount: amount });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    if (data) {
      setMyBizs(prev => prev.map(b => b.id === salon.id ? { ...b, cash_balance: Number(data.cash_balance) } : b));
      setCarOrderEnd(Number(data.car_order_end));
      if (Number(data.fine) > 0) showMsg(`Нет продавца: x3 времени + ${data.fine}₽ таможни`, true);
    }
    const modelName = vehicleState.models.find((item: any) => item.model_id === model)?.model_name || model;
    showMsg(`Заказ: ${modelName} ×${amount}`); hapticFeedback('heavy');
    await afterAction();
    await refreshVehicleState();
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
    const { data, error } = await supabase.rpc('work_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) return showMsg(data.error, true);
    setMoney(Number(data.money));
    window.dispatchEvent(new CustomEvent('zhituha:work-reward', { detail: Number(data.work_pay) }));
    hapticFeedback('medium');
    await afterAction(); // мгновенное обновление цифр с сервера
    if (onboardStep === 0) { if (tutorialWorkClicks >= 2) { setTutorialWorkClicks(0); await advanceTutorial(1); } else setTutorialWorkClicks(c => c + 1); }
  });

  const selectProfession = (profession: string) => action(async () => {
    const { data, error } = await supabase.rpc('select_profession_rpc', { p_player_id: pid, p_profession: profession });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setCareer((current: any) => ({ ...current, profession: data.profession }));
    showMsg('Профессия выбрана');
  });

  const selectTaxiCar = (carIndex: number) => action(async () => {
    const { data, error } = await supabase.rpc('select_taxi_car_rpc', { p_player_id: pid, p_car_index: carIndex });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setCareer((current: any) => ({ ...current, taxi_fleet: data.fleet }));
    showMsg('Машина выбрана для смены');
  });

  const startProfessionCycle = () => action(async () => {
    const { data, error } = await supabase.rpc('start_profession_cycle_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setCareer((current: any) => ({ ...current, active_cycle: data.active_cycle }));
    hapticFeedback('medium');
  });

  const completeProfessionCycle = async () => {
    const { data, error } = await supabase.rpc('finish_profession_cycle_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await refreshProfile();
    if (data.pending_reward) {
      showMsg('Находка готова — выбери, что с ней сделать');
      hapticFeedback('heavy');
    } else {
      showMsg(`+${data.cash_reward} ₽ и ${data.xp_gained} XP`, false, 'reward');
      hapticFeedback('heavy');
    }
    if (onboardStep === 0) await advanceTutorial(1);
  };

  const stepProfessionCycle = (step: number) => action(async () => {
    const { data, error } = await supabase.rpc('profession_step_rpc', { p_player_id: pid, p_step: step });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setCareer((current: any) => ({ ...current, active_cycle: { ...current.active_cycle, actions_done: data.actions_done } }));
    const professionSounds: Record<string, UiSound> = { miner: 'mine', lumberjack: 'woodcut', fisherman: 'fishing', farmer: 'harvest', courier: 'delivery', taxi: 'taxi' };
    playUiSound(professionSounds[career.profession] || 'tap');
    hapticFeedback(step === 3 ? 'medium' : 'light');
    if (data.actions_done === 3) await completeProfessionCycle();
  });

  const finishProfessionCycle = () => action(completeProfessionCycle);
  const claimProfessionReward = (choice: 'inventory' | 'sell') => action(async () => {
    const { data, error } = await supabase.rpc('claim_profession_reward_rpc', { p_player_id: pid, p_choice: choice });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await refreshProfile();
    if (choice === 'sell') setMoney(Number(data.money));
    if (choice === 'inventory') {
      try { localStorage.setItem('zhituha_inventory_new', '1'); } catch {}
      window.dispatchEvent(new Event('zhituha:inventory-new'));
    }
    const item = data.item;
    showMsg(choice === 'sell' ? `${item?.item_name || 'Предмет'} продан за ${data.proceeds} ₽` : `${item?.item_name || 'Предмет'} отправлен в инвентарь`, false, 'reward');
    hapticFeedback('heavy');
    if (onboardStep === 1) await advanceTutorial(2);
  });

  const sellInventory = (itemId: string, quantity: number) => action(async () => {
    const { data, error } = await supabase.rpc('sell_inventory_rpc', { p_player_id: pid, p_item_id: itemId, p_quantity: quantity });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    setMoney(Number(data.money));
    await refreshProfile();
    showMsg(`Продано за ${Number(data.proceeds).toLocaleString('ru-RU')} ₽`, false, 'reward');
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
      showMsg(`Собрано ${data.collected}`, false, 'reward'); hapticFeedback('medium');
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
    showMsg(`Пассивный доход собран: ${Number(data.collected).toLocaleString('ru-RU')} ₽`, false, 'reward');
    await afterAction();
  });

  const hire = (bizId: string, roleName: string, salary: number) => action(async () => {
    if (myJob) return showMsg("Вы уже работаете", true);
    const { data, error } = await supabase.rpc('hire_worker_rpc', { p_player_id: pid, p_player_name: nick, p_business_id: bizId, p_role: roleName, p_salary: salary });
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    const hiredWorker = data?.workers?.find((worker: any) => worker.player_id === pid);
    if (hiredWorker) setMyJob(hiredWorker);
    if (Array.isArray(data?.workers)) setAllWorkers((current) => [...current.filter((worker) => worker.business_id !== bizId), ...data.workers]);
    showMsg("Вы устроены!"); setBoardOpen(false); hapticFeedback('medium');
    await Promise.all([pollWorkers(), afterAction()]);
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
    setAllWorkers((current) => current.filter((worker) => worker.player_id !== pid));
    setQuitOpen(false); setBoardOpen(false); showMsg("Вы уволились."); hapticFeedback('heavy');
    await afterAction();
  });

  const buyPhone = (buy: boolean) => action(async () => {
    if (buy) return showMsg('Телефоны производит телефонный цех — ищи их на рынке.', true);
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
    showMsg(`Собрано ${data.collected} с рефералов!`, false, 'reward'); hapticFeedback('heavy'); setRefOpen(false);
    await afterAction();
  });

  const collectTips = () => action(async () => {
    const { data, error } = await supabase.rpc('collect_tips_rpc', { p_player_id: pid });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    
    setMoney(data.money);
    setTipBalance(0);
    showMsg(`Собрано ${data.collected}₽ чаевых!`, false, 'reward'); hapticFeedback('heavy');
    await afterAction();
  });

  const handleAvatar = () => {
    setTab('profile');
    hapticFeedback('light');
  };

  const openAdmin = () => {
    if (role !== 'superadmin' && role !== 'admin') return;
    setAdminTab('players');
    setTab('admin');
    hapticFeedback('heavy');
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
  
    const quickBuyBiz = (type: 'coffee' | 'salon' | 'taxi' | 'construction') => {
    setActiveBizType(type); setActiveBizId(myBizs.find(b => b.biz_type === type)?.id || null); setTab('business');
  };

  const app = useMemo(() => ({
    user, tg, startParam, proc, toast, tab, setTab, hapticFeedback, nick, money, setMoney, phone, hasCar, carModel, hasHouse, houseType, refBalance, tipBalance, myRefs, myBizs, activeBizType, setActiveBizType: chooseBizType, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, setMarketTab, businessOffers, refreshBusinessOffers, vehicleState, refreshVehicleState, buyTaxiVehicle, buyBusinessProduct, restockBusinessProduct, setBusinessProductPrice, transferBusinessCash, repairPersonalCarAtShop, repairTaxiCarAtShop, carHealth, players, referralLeaderboard, referralLeaderboardUnavailable, market, myJob, allWorkers, setAllWorkers, allBiz, setAllBiz, selCafe, setSelCafe, boardOpen, setBoardOpen, sellOpen, setSellOpen, sellPrice, setSellPrice, sellItemType, setSellItemType, sellItemData, setSellItemData, sellSource, setSellSource, quitOpen, setQuitOpen, refOpen, setRefOpen, avatarId, tgId, setInNick, selG, inNick, brewEnd, bLeft, pid, onboardStep, tutorialWorkClicks, marketSlots, premiumBalance, ownedCosmetics, profileFrame, profileBackground, donateAction, buyStars, workPay, bizBonusPercent, modifierOpen, setModifierOpen, isDailyOpen, setIsDailyOpen, dailyStreak, boostEnd, claimDaily, promoOpen, setPromoOpen, promoInput, setPromoInput, redeemPromo, adminTab, setAdminTab, role, supabase, showMsg, skipTutorial, drinkTutorialCoffee, action, work, buyCoffee, collect, orderCar, startBuild, hire, fire, quit, buyPhone, listItem, buyLot, inviteFriend, collectRefBonus, collectTips, handleAvatar, openAdmin, verifySubscription, selectGender, reg, claimTutorialReward, cancelLot, sellBusiness, collectTaxi, orderPhones, loadData,
    maintenanceEnabled, maintenanceAdmin, maintenanceBypass, maintenanceBusy, maintenanceError, setMaintenance,
    settingsOpen, setSettingsOpen, soundEnabled, changeSoundEnabled, vibrationEnabled, changeVibrationEnabled, uiTheme, changeUiTheme,
    bugOpen, setBugOpen, bugText, setBugText, submitBug, resetGame, quickBuyBiz, upgradeBusinessPassive, collectBusinessPassive, businessCatalog, loadBusinessCatalog, purchaseBusinessLocation, createBusinessAuction, bidBusinessAuction, activeBizId, setActiveBizId,
    career, selectProfession, selectTaxiCar, startProfessionCycle, stepProfessionCycle, finishProfessionCycle, claimProfessionReward, sellInventory,
    adminDeleteMarketLot, loadMarket
  }), [
    user, tg, startParam, proc, toast, tab, nick, money, phone, hasCar, carModel, hasHouse, houseType, refBalance, tipBalance, myRefs, myBizs, activeBizType, chooseBizType, activeBizId, businessCatalog, loadBusinessCatalog, purchaseBusinessLocation, createBusinessAuction, bidBusinessAuction, vehicleState, refreshVehicleState, buyTaxiVehicle, carOrderEnd, carTimeLeft, buildEnd, buildTimeLeft, phoneProdEnd, phoneProdTimeLeft, marketTab, businessOffers, refreshBusinessOffers, buyBusinessProduct, restockBusinessProduct, setBusinessProductPrice, transferBusinessCash, repairPersonalCarAtShop, repairTaxiCarAtShop, carHealth, players, referralLeaderboard, referralLeaderboardUnavailable, market, myJob, allWorkers, allBiz, selCafe, boardOpen, sellOpen, sellPrice, sellItemType, sellItemData, sellSource, quitOpen, refOpen, avatarId, tgId, selG, inNick, brewEnd, bLeft, pid, onboardStep, tutorialWorkClicks, marketSlots, premiumBalance, ownedCosmetics, profileFrame, profileBackground, donateAction, buyStars, openAdmin, workPay, bizBonusPercent, modifierOpen, isDailyOpen, dailyStreak, boostEnd, promoOpen, promoInput, adminTab, role, bugOpen, bugText, showMsg, maintenanceEnabled, maintenanceAdmin, maintenanceBypass, maintenanceBusy, maintenanceError, setMaintenance, settingsOpen, setSettingsOpen, soundEnabled, changeSoundEnabled, vibrationEnabled, changeVibrationEnabled, uiTheme, changeUiTheme, career, selectProfession, selectTaxiCar, startProfessionCycle, stepProfessionCycle, finishProfessionCycle, claimProfessionReward, sellInventory
  ]);

  const activeBiz = myBizs.find(b => b.id === activeBizId) || myBizs.find(b => b.biz_type === activeBizType);
  const currentStock = getStock(activeBiz);

  // Быстрая покупка бизнеса прямо с главной. Название спрашиваем в модалке (как в BusinessTab),
  // чтобы не вставлять пустую строку и не падать на NOT NULL / уникальности имени.


  const pageStyle: any = { padding: 'calc(100px + env(safe-area-inset-top, 20px)) 20px calc(90px + env(safe-area-inset-bottom, 20px))', textAlign: 'center', minHeight: '100vh', width: '100vw', overflowX: 'hidden', background: profileBackground === 'background_concrete' ? 'linear-gradient(145deg, #d2d6d3, #a3aaa7)' : 'transparent', transition: 'background 0.35s ease', color: '#2f2a1d' };
  const authPageStyle: any = { ...pageStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

  if (!maintenanceChecked) return <div style={authPageStyle}><ShieldAlert size={48} color="#3d7ea6" style={{ marginBottom: 18 }} /><h2>{maintenanceError ? 'Не удалось проверить доступ' : 'Проверяем доступ…'}</h2>{maintenanceError && <><p style={{ color: '#6b5f45', maxWidth: 320 }}>{maintenanceError}</p><Btn variant="primary" onClick={() => void refreshMaintenance()}>Повторить</Btn></>}</div>;
  if (maintenanceEnabled && !maintenanceAdmin) return <div style={authPageStyle}><Wrench size={56} color="#3d7ea6" style={{ marginBottom: 18 }} /><h1 style={{ marginBottom: 8 }}>Технические работы</h1><p style={{ color: '#6b5f45', maxWidth: 320 }}>Игра временно закрыта. Загляни чуть позже.</p></div>;
  if (maintenanceEnabled && maintenanceAdmin && !maintenanceBypass) return <div style={authPageStyle}><Wrench size={56} color="#3d7ea6" style={{ marginBottom: 18 }} /><h1 style={{ marginBottom: 8 }}>Игра закрыта</h1><p style={{ color: '#6b5f45', maxWidth: 320 }}>Игроки не могут войти. Ты можешь зайти и проверить обновление, пока игра закрыта для остальных.</p><div style={{ display: 'flex', width: 'min(100%, 360px)', gap: 10, marginTop: 10 }}><Btn variant="secondary" onClick={() => setMaintenanceBypass(true)}>Войти для теста</Btn><Btn variant="primary" disabled={maintenanceBusy} onClick={() => void setMaintenance(false)}>{maintenanceBusy ? 'Открываем…' : 'Открыть всем'}</Btn></div>{maintenanceError && <p role="alert" style={{ color: '#c0453a', marginTop: 12 }}>{maintenanceError}</p>}</div>;

  if (loading) return <div style={{ color: '#2f2a1d', textAlign: 'center', marginTop: 'calc(100px + env(safe-area-inset-top, 20px))' }}>Загрузка...</div>;
  // Gate: в Telegram без успешно проверенной сервером подписи initData игру не показываем.
  if (isTgEnv && user && !authChecked) {
    return <div style={authPageStyle}><ShieldAlert size={50} color="#3d7ea6" style={{ marginBottom: 20 }} /><h2>Проверка аккаунта…</h2><p style={{ color: '#6b5f45', maxWidth: 300 }}>Telegram-безопасность: подтверждаем подпись.</p></div>;
  }
  if (isCheckingSub) return <div style={authPageStyle}><Send size={50} color="#3d7ea6" style={{ marginBottom: 20, animation: 'pulse 1.5s infinite' }} /><h2>Проверяем подписку...</h2></div>;
  if (user && subscriptionError) return <div style={authPageStyle}><ShieldAlert size={50} color="#3d7ea6" style={{ marginBottom: 20 }} /><h2>Не удалось проверить подписку</h2><p style={{ color: '#6b5f45', maxWidth: 320 }}>{subscriptionError}</p><Btn variant="primary" onClick={verifySubscription}>Повторить</Btn></div>;
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
      {maintenanceEnabled && maintenanceAdmin && maintenanceBypass && <div className="maintenance-testing-banner"><div><b>ТЕХРАБОТЫ · ТЕСТОВЫЙ ВХОД</b><span>Игра пока закрыта для остальных</span></div><Btn variant="primary" disabled={maintenanceBusy} onClick={() => void setMaintenance(false)}>{maintenanceBusy ? 'Открываем…' : 'Открыть для всех'}</Btn></div>}
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
        {tab === 'bank' && <BankTab app={app} />}
        {tab === 'profile' && <ProfileTab app={app} />}
        {tab === 'admin' && <AdminTab app={app} />}
      </Suspense>
      {tab !== 'admin' && <BottomNav app={app} />}
    </div>
  );
}
