import { useEffect, useState } from 'react';
import { isUiVibrationEnabled } from './preferences';

export interface VerifiedUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  verified: boolean;
}

export type TelegramAuthStatus = 'checking' | 'verified' | 'failed' | 'not_required';

export function useTelegram() {
  const [tg, setTg] = useState<any>(null);
  const [user, setUser] = useState<VerifiedUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<TelegramAuthStatus>(() =>
    typeof window !== 'undefined' && (window as any).Telegram?.WebApp ? 'checking' : 'not_required'
  );
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);

  useEffect(() => {
    const telegram = (window as any).Telegram?.WebApp;
    if (!telegram) {
      setAuthStatus('not_required');
      return;
    }

    try {
      telegram.ready();
      telegram.expand();
      const themeColor = document.documentElement.dataset.uiTheme === 'dark' ? '#171a18' : '#efe3c8';
      telegram.setHeaderColor(themeColor);
      telegram.setBackgroundColor(themeColor);
      if (telegram.requestFullscreen) telegram.requestFullscreen();
    } catch { /* The signature check still runs if optional Telegram UI calls fail. */ }

    setTg(telegram);
    const unsafeUser = telegram.initDataUnsafe?.user;
    if (!unsafeUser) {
      setAuthStatus('failed');
      setAuthError('Открой игру из Telegram, чтобы подтвердить аккаунт.');
      return;
    }

    setStartParam(telegram.initDataUnsafe?.start_param ?? null);
    setUser({
      id: Number(unsafeUser.id),
      username: unsafeUser.username,
      first_name: unsafeUser.first_name,
      last_name: unsafeUser.last_name,
      verified: false,
    });
  }, []);

  useEffect(() => {
    if (!tg) return;
    const unsafeUser = tg.initDataUnsafe?.user;
    if (!unsafeUser) return;
    let cancelled = false;

    setAuthStatus('checking');
    setAuthError('');
    void (async () => {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ init_data: tg.initData || '' }),
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true || Number(result?.user?.id) !== Number(unsafeUser.id)) {
          throw new Error(result?.error || 'Сервер не подтвердил Telegram-аккаунт.');
        }
        if (cancelled) return;
        setUser({ ...unsafeUser, id: Number(result.user.id), verified: true });
        setAuthStatus('verified');
      } catch (error) {
        if (cancelled) return;
        setUser({ ...unsafeUser, id: Number(unsafeUser.id), verified: false });
        setAuthError(error instanceof Error ? error.message : 'Не удалось проверить Telegram-аккаунт.');
        setAuthStatus('failed');
      }
    })();

    return () => { cancelled = true; };
  }, [tg, authAttempt]);

  const retryAuth = () => {
    const currentTelegram = tg || (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null);
    const unsafeUser = currentTelegram?.initDataUnsafe?.user;
    if (!currentTelegram || !unsafeUser) {
      setAuthError('Открой игру из Telegram, чтобы подтвердить аккаунт.');
      setAuthStatus('failed');
      return;
    }
    if (!tg) setTg(currentTelegram);
    setUser({ id: Number(unsafeUser.id), username: unsafeUser.username, first_name: unsafeUser.first_name, last_name: unsafeUser.last_name, verified: false });
    setAuthStatus('checking');
    setAuthError('');
    setAuthAttempt(current => current + 1);
  };

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!isUiVibrationEnabled()) return;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(style);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(style === 'heavy' ? 35 : style === 'medium' ? 22 : 12);
    }
  };

  return { tg, user, hapticFeedback, startParam, authStatus, authError, retryAuth };
}
