import { useState, useEffect } from 'react';
import { Home, Briefcase, Globe, Backpack, Dices, Landmark } from 'lucide-react';
import { S } from './constants';

export const Btn = ({ variant = 'primary', onClick, disabled, children, style = {} }: any) => {
  const baseStyle = variant === 'primary' ? S.btnPrimary : variant === 'secondary' ? S.btnSecondary : variant === 'purple' ? S.btnPurple : variant === 'danger' ? S.btnDanger : S.btnYellow;
  return <button className="soviet-btn" onClick={onClick} disabled={disabled} style={{ ...baseStyle, opacity: disabled ? 0.45 : 1, filter: disabled ? 'saturate(0.4)' : undefined, ...style }}>{children}</button>;
};

export const Modal = ({ open, onClose, children, contentStyle = {} }: any) => {
  if (!open) return null;
  return <div style={S.modalBg} onClick={onClose}><div style={{ ...S.modalBox, ...contentStyle }} onClick={(e: any) => e.stopPropagation()}>{children}</div></div>;
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
  const items = [
    { id: 'home', icon: Home, text: 'Главная' }, { id: 'jobs', icon: Briefcase, text: 'Работа' },
    { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'casino', icon: Dices, text: 'Казино' }, { id: 'inventory', icon: Backpack, text: 'Сумка' },
    { id: 'bank', icon: Landmark, text: 'Банк' }
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(251, 244, 228, 0.96)', backdropFilter: 'blur(10px)', borderTop: '2px solid rgba(90,70,40,0.25)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 calc(20px + env(safe-area-inset-bottom, 20px)) 0', zIndex: 100 }}>
      {items.map(t => (
        <button key={t.id} onClick={() => { app.setTab(t.id); app.hapticFeedback('light'); app.setBoardOpen(false); }} style={{ backgroundColor: app.tab === t.id ? 'rgba(242,182,50,0.22)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', borderRadius: 10, padding: '4px 0', color: app.tab === t.id ? '#c98a10' : '#6b5f45', transition: 'all 0.2s' }}>
          <t.icon size={22} style={{ marginBottom: 4 }} /><span style={{ fontSize: 10, fontWeight: app.tab === t.id ? 'bold' : 'normal', fontFamily: "'Russo One', sans-serif", textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t.text}</span>
        </button>
      ))}
    </div>
  );
};
