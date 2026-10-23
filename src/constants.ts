export const BOT_USERNAME = "zhituha_bot"; 
export const CHANNEL_LINK = "https://t.me/zhituha_news";
export const PHONE_PRICE = 2000, WORKER_SALARY = 600, COFFEE_CUP_PRICE = 500;
export const JOB_WORK = 150; 
export const ADMIN_CODE = "admin2026", BREW_TIME = 15000, POLL = 5000;

export const BASE_MAX_ENERGY = 100;
export const HOUSE_MAX_ENERGY = 150;

// 90 СЕКУНД БАЗОВЫЙ ОТДЫХ
export const REST_CD = 90000; 
export const BASE_REST_TIME = REST_CD; 
export const LADA_REST_TIME = 80000; // -10 сек
export const TOYOTA_REST_TIME = 70000; // -20 сек

export const LADA_PRICE = 20000, LADA_TIME = 30000;
export const TOYOTA_PRICE = 50000, TOYOTA_TIME = 120000;

export const BUILDING_PRICE = 500000, BUILDING_TIME = 900000, APARTMENTS_PER_BUILD = 10;

export const COFFEE_BIZ_PRICE = 15000;
export const SALON_BIZ_PRICE = 150000;
export const TAXI_BIZ_PRICE = 300000;
export const PHONE_FACTORY_BIZ_PRICE = 300000;
export const CONSTRUCTION_BIZ_PRICE = 500000;

export const BUTTON_BATCH_SIZE = 10;
export const BUTTON_BATCH_COST = 5000;
export const BUTTON_BATCH_TIME = 180000;

export const SMARTPHONE_BATCH_SIZE = 5;
export const SMARTPHONE_BATCH_COST = 25000;
export const SMARTPHONE_BATCH_TIME = 600000;

export const TAXI_LADA_INCOME = 1000;
export const TAXI_TOYOTA_INCOME = 1500;
export const TAXI_MAX_OFFLINE_HOURS = 8;
export const TAXI_REPAIR_LADA = 3000;
export const TAXI_REPAIR_TOYOTA = 10000;

// ==== Дефолтные цены для продажи (используются в UI как стартовое значение) ====
export const DEFAULT_SELL_LADA = 25000;
export const DEFAULT_SELL_TOYOTA = 60000;
export const DEFAULT_SELL_APARTMENT = 50000;
export const DEFAULT_SELL_PHONE = 2000;
export const DEFAULT_SELL_BUTTON = 2000;
export const DEFAULT_SELL_SMARTPHONE = 15000;
export const PHONE_SELL_TO_SHOP = 1400;
export const COFFEE_OWNER_INCOME = 450;

export const DAILY_REWARDS = [
  { type: 'money', amount: 500 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 1000 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 1500 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 3500, boost: true } 
];

export const AVATARS = [
  { id: 1, gender: 'male', emoji: '🧑‍💻', bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { id: 2, gender: 'male', emoji: '🧑‍🎨', bg: 'linear-gradient(135deg, #8b5cf6, #5b21b6)' },
  { id: 3, gender: 'male', emoji: '🧑‍🚀', bg: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { id: 4, gender: 'female', emoji: '👩‍💻', bg: 'linear-gradient(135deg, #ec4899, #be185d)' },
  { id: 5, gender: 'female', emoji: '👩‍🎨', bg: 'linear-gradient(135deg, #10b981, #047857)' },
  { id: 6, gender: 'female', emoji: '👩‍🚀', bg: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
];

export const getAvatar = (id: number) => AVATARS.find(a => a.id === id) || AVATARS[0];

export const getStock = (biz: any) => {
  if (!biz || !biz.stock) return {};
  try { return typeof biz.stock === 'string' ? JSON.parse(biz.stock) : biz.stock; } catch (e) { return {}; }
};

export const DAY_MODIFIERS = [
  { id: 1, name: "День студентов", desc: "Смена в кафе x2", type: "shift", mult: 2, color: "#10b981" },
  { id: 2, name: "Час пик", desc: "Таксопарк x2", type: "taxi", mult: 2, color: "#3b82f6" },
  { id: 3, name: "Хайп на телефоны", desc: "Продажа телефонов +30%", type: "phone_sell", mult: 1.3, color: "#8b5cf6" },
  { id: 4, name: "Автошоу", desc: "Продажа машин +30%", type: "car_sell", mult: 1.3, color: "#f97316" },
  { id: 5, name: "Ажиотаж", desc: "Слоты рынка +2", type: "market_slots", mult: 2, color: "#ec4899" },
  { id: 6, name: "Кофейный бум", desc: "Кофе дает +30% энергии", type: "coffee_energy", mult: 1.3, color: "#f59e0b" },
  { id: 7, name: "День друзей", desc: "Реферальные бонусы x2", type: "ref", mult: 2, color: "#ef4444" },
  { id: 8, name: "Стройка века", desc: "Стройтрест x1.5", type: "build", mult: 1.5, color: "#d97706" },
  { id: 9, name: "Тихий день", desc: "Работа x1.5, но Смена x0.5", type: "work", mult: 1.5, color: "#6b7280" },
  { id: 10, name: "Госзаказ", desc: "Цех и Автосалон x1.5", type: "factory", mult: 1.5, color: "#0ea5e9" },
];

export const getDayModifier = () => {
  try {
    const today = new Date().toISOString().slice(0, 10); 
    let hash = 0;
    for (let i = 0; i < today.length; i++) hash = today.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % DAY_MODIFIERS.length;
    return DAY_MODIFIERS[index] || DAY_MODIFIERS[0]; 
  } catch (e) {
    return DAY_MODIFIERS[0];
  }
};

export const S = {
  card: { backgroundColor: '#161324', color: 'white', padding: 20, borderRadius: 24, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 16, textAlign: 'left' as const, border: '1px solid rgba(255,255,255,0.05)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none', fontFamily: 'Space Grotesk, sans-serif', transition: 'transform 0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none', fontFamily: 'Space Grotesk, sans-serif', transition: 'transform 0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none', fontFamily: 'Space Grotesk, sans-serif', transition: 'transform 0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none', fontFamily: 'Space Grotesk, sans-serif', transition: 'transform 0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', borderRadius: 16, fontWeight: 'bold', border: 'none', fontFamily: 'Space Grotesk, sans-serif', transition: 'transform 0.1s' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20, animation: 'fadeIn 0.2s ease-out' },
  modalBox: { backgroundColor: '#161324', padding: 25, borderRadius: 24, width: '100%', maxWidth: '320px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' as const, animation: 'slideUp 0.3s ease-out' },
  input: { width: '100%', padding: 15, borderRadius: 12, backgroundColor: '#0B0914', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' as const, fontSize: 18, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'Space Grotesk, sans-serif' }
};