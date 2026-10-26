export const BOT_USERNAME = "zhituha_bot"; 
export const CHANNEL_LINK = "https://t.me/zhituha_news";
export const PHONE_PRICE = 2000, COFFEE_CUP_PRICE = 500;
export const JOB_WORK = 150; 
export const ADMIN_CODE = "admin2026", BREW_TIME = 15000, POLL = 5000;

export const BASE_MAX_ENERGY = 100;
export const HOUSE_MAX_ENERGY = 150;

export const REST_CD = 90000; 
export const BASE_REST_TIME = REST_CD; 
export const LADA_REST_TIME = 80000; 
export const TOYOTA_REST_TIME = 70000; 

export const LADA_PRICE = 20000, LADA_TIME = 900000; // 15 минут
export const TOYOTA_PRICE = 50000, TOYOTA_TIME = 2700000; // 45 минут

export const BUILDING_PRICE = 350000, BUILDING_TIME = 3600000, APARTMENTS_PER_BUILD = 10; // 1 час

export const COFFEE_BIZ_PRICE = 15000;
export const SALON_BIZ_PRICE = 150000;
export const TAXI_BIZ_PRICE = 300000;
export const PHONE_FACTORY_BIZ_PRICE = 300000;
export const CONSTRUCTION_BIZ_PRICE = 500000;

export const BUSINESS_PASSIVE_TIERS = {
  coffee: [{ cost: 5000, incomePerMinute: 15 }, { cost: 20000, incomePerMinute: 40 }, { cost: 60000, incomePerMinute: 100 }, { cost: 150000, incomePerMinute: 250 }],
  salon: [{ cost: 50000, incomePerMinute: 60 }, { cost: 150000, incomePerMinute: 150 }, { cost: 400000, incomePerMinute: 350 }, { cost: 1000000, incomePerMinute: 800 }],
  phone_factory: [{ cost: 100000, incomePerMinute: 100 }, { cost: 300000, incomePerMinute: 250 }, { cost: 800000, incomePerMinute: 600 }, { cost: 2000000, incomePerMinute: 1400 }],
  construction: [{ cost: 150000, incomePerMinute: 150 }, { cost: 500000, incomePerMinute: 400 }, { cost: 1500000, incomePerMinute: 900 }, { cost: 3000000, incomePerMinute: 2000 }],
  taxi: [{ cost: 100000, incomePerMinute: 30 }, { cost: 300000, incomePerMinute: 80 }, { cost: 700000, incomePerMinute: 200 }, { cost: 1500000, incomePerMinute: 500 }],
} as const;

export const BUTTON_BATCH_SIZE = 10;
export const BUTTON_BATCH_COST = 7000;
export const BUTTON_BATCH_TIME = 600000; // 10 минут

export const SMARTPHONE_BATCH_SIZE = 5;
export const SMARTPHONE_BATCH_COST = 25000;
export const SMARTPHONE_BATCH_TIME = 1800000; // 30 минут

export const TAXI_LADA_INCOME = 1000;
export const TAXI_TOYOTA_INCOME = 1500;
export const TAXI_MAX_OFFLINE_HOURS = 8;
export const TAXI_REPAIR_LADA = 3000;
export const TAXI_REPAIR_TOYOTA = 10000;
export const TAXI_HEALTH_DROP_RATE = 8;

export const DEFAULT_SELL_LADA = 28000;
export const DEFAULT_SELL_TOYOTA = 65000;
export const DEFAULT_SELL_APARTMENT = 50000;
export const DEFAULT_SELL_PHONE = 2000;
export const DEFAULT_SELL_BUTTON = 2000;
export const DEFAULT_SELL_SMARTPHONE = 15000;
export const PHONE_SELL_TO_SHOP = 1400;
export const COFFEE_OWNER_INCOME = 410;

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
  { id: 1, gender: 'male', emoji: '🧑‍💻', bg: 'linear-gradient(135deg, #3d7ea6, #1d4ed8)' },
  { id: 2, gender: 'male', emoji: '🧑‍🎨', bg: 'linear-gradient(135deg, #8b5cf6, #5b21b6)' },
  { id: 3, gender: 'male', emoji: '🧑‍🚀', bg: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { id: 4, gender: 'female', emoji: '👩‍💻', bg: 'linear-gradient(135deg, #ec4899, #be185d)' },
  { id: 5, gender: 'female', emoji: '👩‍🎨', bg: 'linear-gradient(135deg, #3f9d55, #047857)' },
  { id: 6, gender: 'female', emoji: '👩‍🚀', bg: 'linear-gradient(135deg, #c0453a, #b91c1c)' },
];

export const getAvatar = (id: number) => AVATARS.find(a => a.id === id) || AVATARS[0];

export const getStock = (biz: any) => {
  if (!biz || !biz.stock) return {};
  try { return typeof biz.stock === 'string' ? JSON.parse(biz.stock) : biz.stock; } catch (e) { return {}; }
};

export const DAY_MODIFIERS = [
  { id: 1, name: "День студентов", desc: "Смена в кафе x2", type: "shift", mult: 2, color: "#3f9d55" },
  { id: 2, name: "Час пик", desc: "Таксопарк x2", type: "taxi", mult: 2, color: "#3d7ea6" },
  { id: 3, name: "Хайп на телефоны", desc: "Производство телефонов +50% скорости", type: "phone_sell", mult: 1.5, color: "#5f43a0" },
  { id: 4, name: "Автошоу", desc: "Отдых на машинах +20% быстрее", type: "car_sell", mult: 1.2, color: "#b06a15" },
  { id: 5, name: "Ажиотаж", desc: "Слоты рынка +2, комиссия 0%", type: "market_slots", mult: 2, color: "#b0306a" },
  { id: 6, name: "Кофейный бум", desc: "Кофе дает +30% энергии", type: "coffee_energy", mult: 1.3, color: "#b06a15" },
  { id: 7, name: "День друзей", desc: "Реферальные бонусы x2", type: "ref", mult: 2, color: "#c0453a" },
  { id: 8, name: "Стройка века", desc: "Стройка дома +50% скорости", type: "build", mult: 1.5, color: "#96600d" },
  { id: 9, name: "Тихий день", desc: "Работа x1.5", type: "work", mult: 1.5, color: "#5b5648" },
  { id: 10, name: "Госзаказ", desc: "Производство телефонов +50% скорости", type: "factory", mult: 1.5, color: "#2563a8" },
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

export const getRestTime = (hasCar: boolean, carModel: string, modifier = getDayModifier()) => {
  const baseTime = hasCar
    ? carModel === 'toyota' ? TOYOTA_REST_TIME : carModel === 'lada' ? LADA_REST_TIME : BASE_REST_TIME
    : BASE_REST_TIME;
  return hasCar && modifier?.type === 'car_sell' ? Math.floor(baseTime * 0.8) : baseTime;
};

// Экономика по дизайн-доку (сервер считает ЗП/штрафы, клиент только показывает):
// COFFEE: чашка 500₽ -> Бариста 60 + Помощник 30 (если нет — 30 забирает владелец), владельцу 410.
// SALON: партия — Механик 10000/место (макс 2, обязателен), Продавец 15000 (макс 1).
//        Без продавца: время x3 + 10% от стоимости партии.
// PHONE: партия — Сборщик 10000/место (макс 2, обязателен), Инженер 15000 (макс 1).
//        Без инженера: время x3 + 3000₽ простоя станка.
// CONSTRUCTION: дом — Строитель 10000/место (макс 3, обязателен), Прораб 20000 (макс 1).
//        Без прораба: время x3 + 5000₽/час из кассы.
// TAXI: Водитель 10% от кассы (макс 2, без них доход 0), Механик 5% (макс 1;
//        без него износ 50%/час вместо 8%/час).
export const BIZ_JOBS: Record<string, { role: string, salary: number, max: number }[]> = {
  coffee: [
    { role: 'Бариста', salary: 60, max: 1 },
    { role: 'Помощник бариста', salary: 30, max: 1 }
  ],
  salon: [{ role: 'Механик', salary: 10000, max: 2 }, { role: 'Продавец', salary: 15000, max: 1 }],
  phone_factory: [{ role: 'Сборщик', salary: 10000, max: 2 }, { role: 'Инженер', salary: 15000, max: 1 }],
  taxi: [{ role: 'Водитель', salary: 10, max: 2 }, { role: 'Механик', salary: 5, max: 1 }], // % от кассы
  construction: [{ role: 'Строитель', salary: 10000, max: 3 }, { role: 'Прораб', salary: 20000, max: 1 }]
};

// Время в пути машин на таможне при заказе партии (без штрафа за отсутствие ролей)
export const SALON_LADA_BASE_TIME = 900000;   // 15 мин
export const SALON_TOYOTA_BASE_TIME = 2700000; // 45 мин
export const FACTORY_BUTTON_BASE_TIME = 600000;   // 10 мин
export const FACTORY_SMARTPHONE_BASE_TIME = 1800000; // 30 мин
export const BUILD_BASE_TIME = 3600000; // 1 час

export const S = {
  card: { backgroundColor: '#fbf4e4', backgroundImage: 'linear-gradient(180deg, #fdf7e9 0%, #f3e8cd 100%)', color: '#2f2a1d', padding: 20, borderRadius: 12, margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 16, textAlign: 'left' as const, border: '2px solid rgba(90,70,40,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 5px 0 rgba(120,95,55,0.18), 0 10px 22px rgba(120,95,55,0.18)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #63bd76 0%, #3f9d55 100%)', color: '#f4fbe8', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #5b9ec4 0%, #3d7ea6 100%)', color: '#f0f7fb', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #9a7fd0 0%, #7a5cb8 100%)', color: '#f6f2fc', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #d4574a 0%, #c0453a 100%)', color: '#fdf1ec', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.4)', transition: 'transform 0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #f7cf6a 0%, #f2b632 100%)', color: '#3a2c08', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.55)', transition: 'transform 0.1s' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(70,55,30,0.55)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20, animation: 'fadeIn 0.2s ease-out' },
  modalBox: { backgroundColor: '#fbf4e4', backgroundImage: 'linear-gradient(180deg, #fdf7e9 0%, #f3e8cd 100%)', color: '#2f2a1d', padding: 25, borderRadius: 12, width: '100%', maxWidth: '320px', border: '2px solid rgba(90,70,40,0.4)', boxShadow: '0 10px 34px rgba(90,70,40,0.35), inset 0 1px 0 rgba(255,255,255,0.8)', textAlign: 'center' as const, animation: 'slideUp 0.3s ease-out' },
  input: { width: '100%', padding: 15, borderRadius: 8, backgroundColor: '#fffdf6', color: '#2f2a1d', border: '2px solid rgba(90,70,40,0.35)', boxShadow: 'inset 0 2px 4px rgba(120,95,55,0.15)', textAlign: 'center' as const, fontSize: 18, marginBottom: 20, boxSizing: 'border-box' as const, outline: 'none', fontFamily: "'Rubik', sans-serif" }
};
