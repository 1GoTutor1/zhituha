import { Home, Briefcase, Globe, Store, Backpack } from 'lucide-react';
import { S } from './constants';

export const Btn = ({ variant = 'primary', onClick, disabled, children, style = {} }: any) => {
  const baseStyle = variant === 'primary' ? S.btnPrimary : variant === 'secondary' ? S.btnSecondary : variant === 'purple' ? S.btnPurple : variant === 'danger' ? S.btnDanger : S.btnYellow;
  return <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
};

export const Modal = ({ open, onClose, children }: any) => {
  if (!open) return null;
  return <div style={S.modalBg} onClick={onClose}><div style={S.modalBox} onClick={(e: any) => e.stopPropagation()}>{children}</div></div>;
};

export const Toast = ({ toast }: { toast: any }) => {
  if (!toast) return null;
  return <div style={{ position: 'fixed', top: 90, left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.err ? '#ef4444' : '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', zIndex: 2000, width: '80%', maxWidth: '280px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'center' }}>{toast.msg}</div>;
};

export const BottomNav = ({ app }: { app: any }) => {
  const items = [
    { id: 'home', icon: Home, text: 'Главная' }, { id: 'jobs', icon: Briefcase, text: 'Работа' }, 
    { id: 'market', icon: Globe, text: 'Рынок' }, { id: 'shop', icon: Store, text: 'Магазин' }, { id: 'inventory', icon: Backpack, text: 'Сумка' }
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
      {items.map(t => (
        <button key={t.id} onClick={() => { app.setTab(t.id); app.hapticFeedback('light'); app.setBoardOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px', color: app.tab === t.id ? '#3b82f6' : '#a1a1aa', transition: 'color 0.2s' }}>
          <t.icon size={22} style={{ marginBottom: 4 }} /><span style={{ fontSize: 10, fontWeight: app.tab === t.id ? 'bold' : 'normal' }}>{t.text}</span>
        </button>
      ))}
    </div>
  );
};