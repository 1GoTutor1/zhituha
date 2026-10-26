import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();

// Защита от частой ошибки: ключ случайно вставляют с ДВОЙНОЙ префиксной частью,
// например "sb_publishable_sb_publishable_XXXX". Supabase отвергает такой ключ
// (HTTP 401 "Invalid API key") и вся игра висит на загрузке. Чиним на лету.
function normalizeKey(raw: string | undefined): string {
  let k = String(raw || '').trim();
  const prefixes = ['sb_publishable', 'sb_secret'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prefixes) {
      if (k.startsWith(p + '_' + p + '_')) { k = k.slice(p.length + 1); changed = true; }
    }
  }
  return k;
}

const supabaseAnonKey = normalizeKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY в .env.local — игра не сможет работать с сервером.');
} else if (!/^eyJ/.test(supabaseAnonKey) && !/^sb_publishable_/.test(supabaseAnonKey)) {
  console.warn('[supabase] Ключ выглядит необычно (обычно начинается с "eyJ" или "sb_publishable_"). Проверь VITE_SUPABASE_ANON_KEY в .env.local.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);