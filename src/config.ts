export const config = {
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** Server-gated: only works while the API has TEST_LOGIN_CODE set. */
  testLogin: import.meta.env.VITE_TEST_LOGIN === '1',
};
