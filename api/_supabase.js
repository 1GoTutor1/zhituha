import { createClient } from '@supabase/supabase-js';

let client = null;
let clientUrl = '';
let clientKey = '';

// Reuse the stateless service client across warm Vercel invocations.
export function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials are missing');

  if (!client || clientUrl !== url || clientKey !== key) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientUrl = url;
    clientKey = key;
  }
  return client;
}
