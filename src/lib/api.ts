import { config } from '../config';
import { session } from './session';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Body = Record<string, unknown> | unknown[];

async function request<T>(method: string, path: string, body?: Body, retried = false): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const s = session.get();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (s) headers.Authorization = `Bearer ${s.accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your internet connection.');
  }
  if (res.status === 401 && s && !retried && (await session.refresh())) return request<T>(method, path, body, true);
  if (res.status === 401 && s) session.clear(); // expired: back to sign-in
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } }).error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong. Please try again.', e?.details);
  }
  return json as { data: T; meta?: Record<string, unknown> };
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p).then((r) => r.data),
  post: <T>(p: string, b: Body = {}) => request<T>('POST', p, b).then((r) => r.data),
  patch: <T>(p: string, b: Body) => request<T>('PATCH', p, b).then((r) => r.data),
};

/** Friendly message for any error, using the first validation detail when present. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details as { message?: string }[] | undefined;
    if (e.code === 'VALIDATION_ERROR' && Array.isArray(d) && d[0]?.message) return d[0].message;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
