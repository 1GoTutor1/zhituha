import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl as string, supabaseAnonKey as string);

export const supabase = new Proxy(client, {
  get(target, property) {
    if (property === 'rpc') {
      return async (name: string, args: Record<string, unknown> = {}) => {
        const initData = (window as any).Telegram?.WebApp?.initData || '';
        try {
          const response = await fetch('/api/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, args, init_data: initData }),
          });
          const result = await response.json();
          if (!response.ok) return { data: null, error: { message: result?.error || 'RPC request failed' } };
          return { data: result.data, error: null };
        } catch (error) {
          return { data: null, error: { message: error instanceof Error ? error.message : 'RPC request failed' } };
        }
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as typeof client;
