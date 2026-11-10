/** Money arrives in paise (integer minor units). */
export function money(minor: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
}
/** Rupee input ("42.5") -> paise (4250); null when invalid. */
export function rupeesToPaise(v: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return null;
  const [r, p = ''] = v.trim().split('.');
  return Number(r) * 100 + Number((p + '00').slice(0, 2));
}
export const paiseToRupees = (minor: number) => (minor % 100 ? (minor / 100).toFixed(2) : String(minor / 100));

/** Calendar date in India (the business timezone), as YYYY-MM-DD. */
export function istDate(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function istHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
}
export function shiftDate(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
export function prettyDate(iso: string): string {
  const today = istDate();
  if (iso === today) return 'Today';
  if (iso === istDate(1)) return 'Tomorrow';
  if (iso === istDate(-1)) return 'Yesterday';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export const categoryLabel = (c: string) => c.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', pending: 'Preparing', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled',
  active: 'Active', paused: 'Paused', pending_payment: 'Awaiting payment', past_due: 'Renewal due',
};

/** Parses "560011, 560041 560069" into a clean, de-duplicated list; returns the invalid entries too. */
export function parsePins(text: string): { pins: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  const pins = [...new Set(parts.filter((p) => /^[1-9]\d{5}$/.test(p)))].sort();
  return { pins, invalid: parts.filter((p) => !/^[1-9]\d{5}$/.test(p)) };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}
export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
