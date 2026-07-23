// Supabase client — single shared instance for the whole app.
// Keys come from environment variables (.env locally, Vercel env in production).
import { createClient } from '@supabase/supabase-js';

import { IS_DEMO } from './demo';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // The demo build ships without credentials on purpose — that is what makes it
  // impossible for a demo visitor to reach a real school's data.
  if (!IS_DEMO) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env / hosting env settings.');
  }
}

// Null when credentials are absent, so importing this module never throws.
// Demo mode never calls into it; the cloud layer is simply not used there.
export const supabase = (url && anonKey) ? createClient(url, anonKey) : null;
