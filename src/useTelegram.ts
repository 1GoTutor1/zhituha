import { useEffect, useState } from 'react';

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    if (telegram) {
      telegram.ready(); 
      telegram.expand(); 
      
      // Делаем шапку темной под цвет игры
      try {
        telegram.setHeaderColor('#121212');
        telegram.setBackgroundColor('#121212');
      } catch (e) {}

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