import { config } from '../config';

/**
 * Sign-in session kept in localStorage. Two ways in, chosen by VITE_TEST_LOGIN:
 *  - test login: phone + the shared test code -> API /auth/test-login (server-gated, testing only)
 *  - Supabase phone OTP: /auth/v1/otp then /auth/v1/verify (real SMS)
 * Roles are never trusted from the client: the API reads them from the database on every request.
 */
export interface Session { accessToken: string; refreshToken?: string; expiresAt: number; phone: string }

const KEY = 'dd-dashboard-session';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// React's useSyncExternalStore needs the same object back while nothing changed, so cache by the raw string.
let cachedRaw: string | null | undefined;
let cached: Session | null = null;
function read(): Session | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cached = null;
    }
  }
  if (cached && cached.expiresAt <= Date.now() && !cached.refreshToken) return null;
  return cached;
}
function write(s: Session | null) {
  cachedRaw = s ? JSON.stringify(s) : null;
  cached = s;
  try {
    if (s) localStorage.setItem(KEY, cachedRaw!);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: session lasts for this tab only */
  }
  emit();
}

async function supabase(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.msg ?? json.error_description ?? json.message ?? 'Sign-in failed');
  return json;
}

export const session = {
  get: read,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  clear: () => write(null),

  /** Step 1. Test login sends nothing; Supabase sends an SMS. */
  async sendCode(phone: string) {
    if (config.testLogin) return;
    await supabase('otp', { phone });
  },

  /** Step 2. Exchanges the code for a session. Throws a readable message on failure. */
  async verify(phone: string, code: string) {
    if (config.testLogin) {
      const res = await fetch(`${config.apiUrl}/auth/test-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      }).catch(() => null);
      if (!res) throw new Error('Cannot reach the server. Check your internet connection.');
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error('Too many attempts. Try again in 15 minutes.');
      if (!res.ok) throw new Error(res.status === 401 ? 'That code is incorrect.' : json?.error?.message ?? 'Sign-in failed.');
      write({ accessToken: json.data.accessToken, expiresAt: Date.parse(json.data.expiresAt), phone });
      return;
    }
    const j = await supabase('verify', { type: 'sms', phone, token: code });
    write({ accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + j.expires_in * 1000, phone });
  },

  /** Supabase sessions expire hourly; refresh once on a 401. Test sessions cannot be refreshed. */
  async refresh(): Promise<boolean> {
    const s = read();
    if (!s?.refreshToken || config.testLogin) return false;
    try {
      const j = await supabase('token?grant_type=refresh_token', { refresh_token: s.refreshToken });
      write({ ...s, accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + j.expires_in * 1000 });
      return true;
    } catch {
      write(null);
      return false;
    }
  },
};
