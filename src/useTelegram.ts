import { useEffect, useState } from 'react';

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    if (telegram) {
      telegram.ready(); 
      telegram.expand(); 
      
      try {
        telegram.setHeaderColor('#121212');
        telegram.setBackgroundColor('#121212');
        if (telegram.requestFullscreen) telegram.requestFullscreen();
      } catch (e) {}

      setTg(telegram);
      if (telegram.initDataUnsafe?.user) {
        setUser(telegram.initDataUnsafe.user);
      }
      if (telegram.initDataUnsafe?.start_param) {
        setStartParam(telegram.initDataUnsafe.start_param);
      }
    }
  }, []);

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
  };

  return { tg, user, hapticFeedback, startParam };
}