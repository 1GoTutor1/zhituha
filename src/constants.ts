export const BOT_USERNAME = "zhituha_bot"; 
export const CHANNEL_LINK = "https://t.me/zhituha_news";
export const PHONE_PRICE = 2000, WORKER_SALARY = 300, COFFEE_CUP_PRICE = 500;
export const ADMIN_CODE = "admin2026", BREW_TIME = 15000, POLL = 5000;

export const BASE_MAX_ENERGY = 100;
export const HOUSE_MAX_ENERGY = 150;
export const BASE_REST_TIME = 90000;
export const LADA_REST_TIME = 70000;
export const TOYOTA_REST_TIME = 50000;

export const LADA_PRICE = 20000, LADA_TIME = 30000;
export const TOYOTA_PRICE = 50000, TOYOTA_TIME = 120000;

// Стройтрест: 300к за 10 квартир, 15 минут
export const BUILDING_PRICE = 300000, BUILDING_TIME = 900000, APARTMENTS_PER_BUILD = 10;

export const COFFEE_BIZ_PRICE = 15000;
export const SALON_BIZ_PRICE = 150000;
export const CONSTRUCTION_BIZ_PRICE = 300000;
export const TAXI_BIZ_PRICE = 300000; // Новый Таксопарк

// Таксопарк
export const TAXI_LADA_INCOME = 500; // в час
export const TAXI_TOYOTA_INCOME = 1500; // в час
export const TAXI_REPAIR_LADA = 3000;
export const TAXI_REPAIR_TOYOTA = 10000;

// Ежедневные награды
export const DAILY_REWARDS = [
  { type: 'money', amount: 500 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 1000 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 1500 },
  { type: 'coffee', amount: 1 },
  { type: 'money', amount: 3500, boost: true } // На 7-й день буст
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