export const BOT_USERNAME = "zhituha_bot"; 
export const CHANNEL_LINK = "https://t.me/zhituha_news";
export const PHONE_PRICE = 2000, COFFEE_CUP_PRICE = 500;
export const JOB_WORK = 150; 
export const ADMIN_CODE = "admin2026", BREW_TIME = 15000, POLL = 5000;

export const LADA_PRICE = 35000, LADA_TIME = 900000; // Ока, 15 минут
export const TOYOTA_PRICE = 50000, TOYOTA_TIME = 2700000; // 45 минут

export const BUILDING_PRICE = 350000, BUILDING_TIME = 3600000, APARTMENTS_PER_BUILD = 10; // 1 час

export const COFFEE_BIZ_PRICE = 15000;
export const SALON_BIZ_PRICE = 350000;
export const TAXI_BIZ_PRICE = 300000;
export const PHONE_FACTORY_BIZ_PRICE = 300000;
export const CONSTRUCTION_BIZ_PRICE = 850000;

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

export const DEFAULT_SELL_LADA = 40000;
export const DEFAULT_SELL_TOYOTA = 65000;
export const DEFAULT_SELL_APARTMENT = 50000;
export const DEFAULT_SELL_PHONE = 2000;
export const DEFAULT_SELL_BUTTON = 2000;
export const DEFAULT_SELL_SMARTPHONE = 15000;
export const PHONE_SELL_TO_SHOP = 1400;
export const COFFEE_OWNER_INCOME = 410;

export const PLAYER_PROFESSIONS = [
  { id: 'miner', name: 'Шахтёр', unlockLevel: 1, actionLabels: ['Удар по трещине', 'Ещё удар', 'Последний удар'], output: 'Руды и камни', minPrice: 200, maxPrice: 3000 },
  { id: 'lumberjack', name: 'Лесоруб', unlockLevel: 3, actionLabels: ['Замахнуться', 'Попасть в метку', 'Срубить дерево'], output: 'Древесина и находки', minPrice: 200, maxPrice: 3000 },
  { id: 'fisherman', name: 'Рыбак', unlockLevel: 5, actionLabels: ['Забросить удочку', 'Подсечь', 'Вытянуть улов'], output: 'Рыба', minPrice: 200, maxPrice: 3000 },
  { id: 'farmer', name: 'Фермер', unlockLevel: 7, actionLabels: ['Вспахать грядку', 'Полить росток', 'Собрать урожай'], output: 'Случайный урожай', minPrice: 200, maxPrice: 4000 },
  { id: 'courier', name: 'Курьер', unlockLevel: 9, actionLabels: ['Принять заказ', 'Забрать посылку', 'Доставить'], output: 'Выплата за заказ', minPrice: 380, maxPrice: 500 },
  { id: 'taxi', name: 'Таксист', unlockLevel: 12, actionLabels: ['Принять заказ', 'Начать поездку', 'Завершить поездку'], output: 'Тариф выбранной машины', minPrice: 350, maxPrice: 630 },
] as const;

export const PROFESSION_RARITIES = {
  common: { name: 'Обычный', color: '#84908a' },
  uncommon: { name: 'Необычный', color: '#3f9d65' },
  rare: { name: 'Редкий', color: '#3d7ea6' },
  epic: { name: 'Эпический', color: '#8b5cf6' },
} as const;

export const PROFESSION_LOOT: Record<string, { id: string; name: string; rarity: keyof typeof PROFESSION_RARITIES; price: number; icon: string }[]> = {
  miner: [
    { id: 'stone', name: 'Камень', rarity: 'common', price: 200, icon: '🪨' },
    { id: 'coal', name: 'Уголь', rarity: 'uncommon', price: 400, icon: '⚫' },
    { id: 'iron_ore', name: 'Железная руда', rarity: 'rare', price: 900, icon: '🧱' },
    { id: 'emerald', name: 'Изумруд', rarity: 'epic', price: 3000, icon: '💎' },
  ],
  lumberjack: [
    { id: 'branch', name: 'Ветка', rarity: 'common', price: 200, icon: '🌿' },
    { id: 'softwood', name: 'Мягкая древесина', rarity: 'uncommon', price: 400, icon: '🪵' },
    { id: 'hardwood', name: 'Твёрдая древесина', rarity: 'rare', price: 900, icon: '🪓' },
    { id: 'amber_wood', name: 'Янтарное дерево', rarity: 'epic', price: 3000, icon: '🌳' },
  ],
  fisherman: [
    { id: 'roach', name: 'Плотва', rarity: 'common', price: 200, icon: '🐟' },
    { id: 'perch', name: 'Окунь', rarity: 'uncommon', price: 400, icon: '🐠' },
    { id: 'pike', name: 'Щука', rarity: 'rare', price: 900, icon: '🐟' },
    { id: 'sturgeon', name: 'Осётр', rarity: 'epic', price: 3000, icon: '🦈' },
  ],
  farmer: [
    { id: 'potato', name: 'Картофель', rarity: 'common', price: 200, icon: '🥔' },
    { id: 'carrot', name: 'Морковь', rarity: 'common', price: 300, icon: '🥕' },
    { id: 'corn', name: 'Кукуруза', rarity: 'uncommon', price: 550, icon: '🌽' },
    { id: 'strawberry', name: 'Клубника', rarity: 'rare', price: 1000, icon: '🍓' },
    { id: 'watermelon', name: 'Арбуз', rarity: 'epic', price: 4000, icon: '🍉' },
  ],
};

export const DAILY_REWARDS = [
  { type: 'money', amount: 500 },
  { type: 'money', amount: 250 },
  { type: 'money', amount: 1000 },
  { type: 'money', amount: 250 },
  { type: 'money', amount: 1500 },
  { type: 'money', amount: 250 },
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
  { id: 1, icon: "⛏️", name: "Богатая жила", desc: "Шахтёрам на 20% чаще попадается редкая и эпическая руда", type: "miner_luck", mult: 1.2, color: "#b7791f" },
  { id: 2, icon: "🌲", name: "Лесной завал", desc: "Лесорубам на 20% чаще попадается редкая древесина", type: "lumberjack_luck", mult: 1.2, color: "#328357" },
  { id: 3, icon: "🎣", name: "Большой клёв", desc: "Рыбакам на 20% чаще попадается редкий улов", type: "fisherman_luck", mult: 1.2, color: "#337ca5" },
  { id: 4, icon: "🌱", name: "Урожайный день", desc: "Фермерам на 20% чаще попадается редкий урожай", type: "farmer_luck", mult: 1.2, color: "#638c3d" },
  { id: 5, icon: "📦", name: "Курьерский ажиотаж", desc: "Выплата за доставку сегодня на 20% выше", type: "courier_pay", mult: 1.2, color: "#a45b35" },
  { id: 6, icon: "🚕", name: "Час пик", desc: "Выплата водителю такси сегодня на 20% выше", type: "taxi_pay", mult: 1.2, color: "#7956a8" },
  { id: 7, icon: "🛒", name: "Большой рынок", desc: "На 2 дополнительных объявления и комиссия при покупке 0%", type: "market_slots", mult: 2, color: "#b0306a" },
];

export const getDayModifier = () => {
  try {
    // Единый календарный день с московской полуночью, совпадающий с SQL-модификатором.
    const moscowNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const dayNumber = Math.floor(Date.parse(`${moscowNow.toISOString().slice(0, 10)}T00:00:00Z`) / 86400000);
    const index = ((dayNumber % DAY_MODIFIERS.length) + DAY_MODIFIERS.length) % DAY_MODIFIERS.length;
    return DAY_MODIFIERS[index] || DAY_MODIFIERS[0];
  } catch (e) {
    return DAY_MODIFIERS[0];
  }
};


// Экономика по дизайн-доку (сервер считает ЗП/штрафы, клиент только показывает):
// COFFEE: чашка 500₽ -> Бариста 60 + Помощник 30 (если нет — 30 забирает владелец), владельцу 410.
// SALON: каждый механик получает 3%, продавец — 5% от цены продажи машины со склада.
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
  minimarket: [{ role: 'Кассир', salary: 5, max: 1 }],
  auto_repair: [{ role: 'Механик', salary: 3, max: 1 }],
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
  card: { backgroundColor: 'var(--surface-raised)', backgroundImage: 'linear-gradient(160deg, var(--surface-raised), var(--surface-soft))', color: 'var(--text-main)', padding: 18, borderRadius: 17, margin: '0 auto 14px auto', width: '100%', maxWidth: 'none', fontSize: 15, textAlign: 'left' as const, border: '1px solid var(--surface-line)', boxShadow: 'var(--surface-shadow)' },
  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #63bd76 0%, #3f9d55 100%)', color: '#f4fbe8', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #5b9ec4 0%, #3d7ea6 100%)', color: '#f0f7fb', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnPurple: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #9a7fd0 0%, #7a5cb8 100%)', color: '#f6f2fc', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.5)', transition: 'transform 0.1s' },
  btnDanger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #d4574a 0%, #c0453a 100%)', color: '#fdf1ec', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.4)', transition: 'transform 0.1s' },
  btnYellow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 16, padding: 16, width: '100%', cursor: 'pointer', background: 'linear-gradient(180deg, #f7cf6a 0%, #f2b632 100%)', color: '#3a2c08', borderRadius: 8, fontWeight: 'bold', border: '2px solid rgba(60,45,20,0.6)', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.6px', boxShadow: '0 4px 0 rgba(90,70,40,0.45), inset 0 1px 0 rgba(255,255,255,0.55)', transition: 'transform 0.1s' },
  modalBg: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,20,17,0.58)', backdropFilter: 'blur(7px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 20, animation: 'fadeIn 0.2s ease-out' },
  modalBox: { backgroundColor: 'var(--surface-raised)', backgroundImage: 'linear-gradient(160deg, var(--surface-raised), var(--surface-soft))', color: 'var(--text-main)', padding: 22, borderRadius: 20, width: '100%', maxWidth: '380px', border: '1px solid var(--surface-line)', boxShadow: '0 22px 60px rgba(0,0,0,.28)', textAlign: 'center' as const, animation: 'slideUp 0.3s ease-out' },
  input: { width: '100%', padding: '13px 15px', borderRadius: 12, backgroundColor: 'var(--surface-soft)', color: 'var(--text-main)', border: '1px solid var(--surface-line)', boxShadow: 'inset 0 1px 2px rgba(30,35,30,.06)', textAlign: 'center' as const, fontSize: 17, marginBottom: 16, boxSizing: 'border-box' as const, fontFamily: "'Rubik', sans-serif" }
};
