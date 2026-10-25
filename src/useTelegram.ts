import { useEffect, useState } from 'react';

export interface VerifiedUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  verified: boolean; // true = сервер проверил подпись initData
}

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<VerifiedUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    if (telegram) {
      telegram.ready(); 
      telegram.expand(); 
      
      try {
        telegram.setHeaderColor('#efe3c8');
        telegram.setBackgroundColor('#efe3c8');
        if (telegram.requestFullscreen) telegram.requestFullscreen();
      } catch (e) {}

      setTg(telegram);
      if (telegram.initDataUnsafe?.user) {
        setStartParam(telegram.initDataUnsafe?.start_param ?? null);
        const u = telegram.initDataUnsafe.user;
        // Серверная проверка подписи Telegram initData.
        // Пока ответ не пришёл — считаем пользователя непроверенным.
        setUser({ id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name, verified: false });
        const rawInitData: string = telegram.initData || '';
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ init_data: rawInitData }),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('auth http ' + r.status))))
          .then((d: any) => {
            if (d?.ok && d?.user?.id) {
              setUser({ ...u, id: Number(d.user.id), verified: true });
            } else {
              console.warn('[auth] initData не прошёл проверку сервера');
            }
          })
          .catch((e) => console.warn('[auth] сервер проверки недоступен:', e?.message));
      }
    }
  }, []);

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
  };

  return { tg, user, hapticFeedback, startParam };
}