import { useEffect, useState } from 'react';

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    if (telegram) {
      telegram.ready(); 
      telegram.expand(); 
      
      setTg(telegram);
      if (telegram.initDataUnsafe?.user) {
        setUser(telegram.initDataUnsafe.user);
      }
    }
  }, []);

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(style);
    }
  };

  return { tg, user, hapticFeedback };
}