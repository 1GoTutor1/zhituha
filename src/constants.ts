export const BOT_USERNAME = "zhituha_bot"; 
export const CHANNEL_LINK = "https://t.me/zhituha_news";
export const PHONE_PRICE = 2000, BUSINESS_PRICE = 10000, WORKER_SALARY = 300, COFFEE_PRICE = 500;
export const ADMIN_CODE = "admin2026", REST_CD = 90000, BREW_TIME = 15000, POLL = 5000;
export const LADA_PRICE = 20000, LADA_TIME = 30000;
export const TOYOTA_PRICE = 50000, TOYOTA_TIME = 120000;
export const BUILDING_PRICE = 30000, BUILDING_TIME = 60000;

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