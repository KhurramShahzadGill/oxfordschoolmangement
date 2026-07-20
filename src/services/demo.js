/*
 * Demo mode flag.
 *
 * The demo build is deployed as its own Cloudflare project with
 * VITE_DEMO_MODE=true and, deliberately, NO Supabase credentials. That means a
 * demo visitor cannot reach the real database even if something in the code
 * went wrong — the connection details simply are not present in that build.
 *
 * In demo mode all data lives in the visitor's own browser (localStorage), so
 * every prospective school gets a private sandbox that resets when they clear
 * their browser, and nothing they do can touch a real school's records.
 */
export const IS_DEMO = String(import.meta.env.VITE_DEMO_MODE || '').toLowerCase() === 'true';
