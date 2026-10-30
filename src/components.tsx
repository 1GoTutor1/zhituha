import { useState, useEffect } from 'react';
import { Home, Briefcase, Globe, Backpack, Dices, Landmark, MoreHorizontal, X, Users, Sprout } from 'lucide-react';
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
  const items = [
    { id: 'home', icon: Home, text: 'Главная' }, { id: 'jobs', icon: Briefcase, text: 'Работа' },
    { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'casino', icon: Dices, text: 'Казино' },
  ];
  const navigate = (id: string) => { app.setTab(id); app.hapticFeedback('light'); app.setBoardOpen(false); setMoreOpen(false); };
  return (
    <>
      {moreOpen && <><button className="more-menu-scrim" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)} /><div className="more-menu-sheet"><div className="more-menu-heading"><b>Ещё</b><button aria-label="Закрыть" onClick={() => setMoreOpen(false)}><X size={18} /></button></div>
        <button onClick={() => navigate('inventory')}><Backpack size={20} /> Инвентарь {inventoryNew && <i className="inventory-new-dot" />}</button>
        <button onClick={() => navigate('bank')}><Landmark size={20} /> Банк</button>
        <button onClick={() => navigate('family')}><Users size={20} /> Семья</button>
        <button onClick={() => navigate('black_market')}><Sprout size={20} /> Чёрный рынок</button>
      </div></>}
      <div className="bottom-nav-bar">
        {items.map(t => (
          <button key={t.id} onClick={() => navigate(t.id)} className={`bottom-nav-item${app.tab === t.id ? ' is-active' : ''}`}>
            <t.icon size={22} /><span>{t.text}</span>
          </button>
        ))}
        <button onClick={() => setMoreOpen(current => !current)} className={`bottom-nav-item${moreOpen || ['inventory','bank','family','black_market'].includes(app.tab) ? ' is-active' : ''}`} aria-expanded={moreOpen}>
          <span className="bottom-nav-more-icon"><MoreHorizontal size={22} />{inventoryNew && <i className="inventory-new-dot" />}</span><span>Ещё</span>
        </button>
      </div>
    </>
  );
};
