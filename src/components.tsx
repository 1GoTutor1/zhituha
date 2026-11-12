import { useState, useEffect, useRef } from 'react';
import { Home, Briefcase, Globe, Backpack, Dices, Landmark, MoreHorizontal, X, Users, Sprout, Ticket, MapPinned, Pickaxe, Star } from 'lucide-react';
import { S } from './constants';

export const Btn = ({ variant = 'primary', onClick, disabled, children, style = {} }: any) => {
  const baseStyle = variant === 'primary' ? S.btnPrimary : variant === 'secondary' ? S.btnSecondary : variant === 'purple' ? S.btnPurple : variant === 'danger' ? S.btnDanger : S.btnYellow;
  return <button className={`soviet-btn soviet-btn-${variant}`} onClick={onClick} disabled={disabled} style={{ ...baseStyle, opacity: disabled ? 0.45 : 1, filter: disabled ? 'saturate(0.4)' : undefined, ...style }}>{children}</button>;
};

export const Modal = ({ open, onClose, children, contentStyle = {} }: any) => {
  if (!open) return null;
  return <div className="app-modal-backdrop" style={S.modalBg} onClick={onClose}><div className="app-modal-card" style={{ ...S.modalBox, ...contentStyle }} onClick={(e: any) => e.stopPropagation()}>{children}</div></div>;
};

export const Toast = ({ toast, onClose }: { toast: any, onClose: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      setLeaving(false);
      const hideTimer = setTimeout(() => setLeaving(true), 2500);
      const removeTimer = setTimeout(() => {
        setVisible(false);
        onClose();
      }, 2800);

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast]);

  if (!visible || !toast) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(90px + env(safe-area-inset-bottom, 20px))',
      left: '50%',
      transform: leaving ? 'translate(-50%, 20px)' : 'translate(-50%, 0)',
      opacity: leaving ? 0 : 1,
      transition: 'all 0.3s ease-in-out',
      backgroundColor: toast.err ? 'rgba(178, 45, 45, 0.96)' : 'rgba(63, 168, 82, 0.96)',
      color: '#fff4e0',
      padding: '12px 24px',
      borderRadius: '6px',
      fontWeight: 'bold',
      fontFamily: "'Russo One', sans-serif",
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontSize: 14,
      zIndex: 9999,
      width: 'auto',
      minWidth: '200px',
      maxWidth: '90vw',
      boxShadow: '0 4px 0 rgba(0,0,0,0.6), 0 10px 25px rgba(0,0,0,0.6)',
      textAlign: 'center',
      pointerEvents: 'none',
      border: `2px solid ${toast.err ? '#8f1f1f' : '#2c7a3c'}`,
    }}>
      {toast.msg}
    </div>
  );
};

export const BottomNav = ({ app }: { app: any }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const favoriteKey = `zhituha_favorite_tabs_${app.pid || 'guest'}`;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const saved = localStorage.getItem(favoriteKey); return saved ? JSON.parse(saved).filter((id: unknown) => typeof id === 'string') : []; } catch { return []; }
  });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const [inventoryNew, setInventoryNew] = useState(() => { try { return localStorage.getItem('zhituha_inventory_new') === '1'; } catch { return false; } });
  useEffect(() => {
    const markNew = () => setInventoryNew(true);
    const markSeen = () => setInventoryNew(false);
    window.addEventListener('zhituha:inventory-new', markNew);
    window.addEventListener('zhituha:inventory-seen', markSeen);
    return () => {
      window.removeEventListener('zhituha:inventory-new', markNew);
      window.removeEventListener('zhituha:inventory-seen', markSeen);
    };
  }, []);
  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(favoriteKey) || '[]').filter((id: unknown) => typeof id === 'string')); }
    catch { setFavorites([]); }
  }, [favoriteKey]);
  const items = [
    { id: 'home', icon: Home, text: 'Главная' }, { id: 'jobs', icon: Briefcase, text: 'Работа' },
    { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'family', icon: Users, text: 'Семья' },
  ];
  const moreItems = [
    { id: 'cases', icon: Dices, text: 'Крутки' },
    { id: 'inventory', icon: Backpack, text: 'Инвентарь' }, { id: 'bank', icon: Landmark, text: 'Банк' },
    { id: 'mining', icon: Pickaxe, text: 'Майнинг' }, { id: 'casino', icon: Dices, text: 'Казино' },
    { id: 'black_market', icon: Sprout, text: 'Чёрный рынок' }, { id: 'season_pass', icon: Ticket, text: 'Сезонный пропуск' },
    { id: 'district_map', icon: MapPinned, text: 'Районы' },
  ];
  const allItems = [...items, ...moreItems];
  const toggleFavorite = (id: string) => {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
      try { localStorage.setItem(favoriteKey, JSON.stringify(next)); } catch { /* local favorites are optional */ }
      app.hapticFeedback('light');
      return next;
    });
  };
  const beginHold = (id: string) => {
    heldRef.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { heldRef.current = true; toggleFavorite(id); }, 550);
  };
  const endHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  const favoriteButtonProps = (id: string) => ({
    onPointerDown: () => beginHold(id), onPointerUp: endHold, onPointerLeave: endHold, onPointerCancel: endHold,
    onContextMenu: (event: React.MouseEvent) => { event.preventDefault(); endHold(); heldRef.current = true; toggleFavorite(id); },
  });
  const clickIfNotHeld = (id: string) => { if (heldRef.current) { heldRef.current = false; return; } navigate(id); };
  const navigate = (id: string) => { app.setTab(id); app.hapticFeedback('light'); app.setBoardOpen(false); setMoreOpen(false); };
  return (
    <>
      {moreOpen && <><button className="more-menu-scrim" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)} /><div className="more-menu-sheet"><div className="more-menu-heading"><b>Ещё</b><button aria-label="Закрыть" onClick={() => setMoreOpen(false)}><X size={18} /></button></div>
        {favorites.length > 0 && <div className="more-menu-favorites"><small>Избранное</small>{favorites.map(id => {
          const item = allItems.find(value => value.id === id);
          if (!item) return null;
          return <button key={`favorite-${id}`} {...favoriteButtonProps(id)} onClick={() => clickIfNotHeld(id)}><item.icon size={20} /> {item.text}<Star size={15} fill="currentColor" aria-label="Убрать из избранного" /></button>;
        })}</div>}
        {moreItems.map(item => <button key={item.id} {...favoriteButtonProps(item.id)} onClick={() => clickIfNotHeld(item.id)}><item.icon size={20} /> {item.text}{item.id === 'inventory' && inventoryNew && <i className="inventory-new-dot" />}{favorites.includes(item.id) && <Star size={15} fill="currentColor" aria-label="В избранном" />}</button>)}
      </div></>}
      <div className="bottom-nav-bar">
        {items.map(t => (
          <button key={t.id} {...favoriteButtonProps(t.id)} onClick={() => clickIfNotHeld(t.id)} className={`bottom-nav-item${app.tab === t.id ? ' is-active' : ''}`} aria-label={`${t.text}. Удерживайте, чтобы добавить или убрать из избранного`}>
            <t.icon size={22} /><span>{t.text}</span>{favorites.includes(t.id) && <Star size={10} fill="currentColor" aria-hidden="true" />}
          </button>
        ))}
        <button onClick={() => setMoreOpen(current => !current)} className={`bottom-nav-item${moreOpen || ['cases','inventory','bank','casino','black_market','season_pass','district_map','mining'].includes(app.tab) ? ' is-active' : ''}`} aria-expanded={moreOpen}>
          <span className="bottom-nav-more-icon"><MoreHorizontal size={22} />{inventoryNew && <i className="inventory-new-dot" />}</span><span>Ещё</span>
        </button>
      </div>
    </>
  );
};
