// Supabase client — single shared instance for the whole app.
// Keys come from environment variables (.env locally, Vercel env in production).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Helpful message during setup if the env vars are missing.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env / Vercel env settings.');
}

export const supabase = createClient(url, anonKey);
