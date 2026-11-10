import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui';
import { parsePins, rupeesToPaise, money, toCsv } from '../lib/format';
import { session } from '../lib/session';

vi.mock('../config', () => ({ config: { apiUrl: 'https://api.test/api/v1', supabaseUrl: '', supabaseAnonKey: '', testLogin: true } }));

describe('format helpers', () => {
  it('converts rupees to paise without floating point errors', () => {
    expect(rupeesToPaise('42.5')).toBe(4250);
    expect(rupeesToPaise('0.10')).toBe(10);
    expect(rupeesToPaise('180')).toBe(18000);
    expect(rupeesToPaise('1.234')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(money(4250)).toBe('₹42.50');
  });
  it('parses PIN codes from free text and reports bad ones', () => {
    expect(parsePins('560041, 560011 560011;  560069')).toEqual({ pins: ['560011', '560041', '560069'], invalid: [] });
    expect(parsePins('560011, 12345, 0560011').invalid).toEqual(['12345', '0560011']);
  });
  it('escapes CSV cells', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"' }])).toBe('a,b\n"x,y","say ""hi"""');
  });
});

describe('session', () => {
  beforeEach(() => localStorage.clear());
  it('returns the same object until it changes (required by React)', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'test.a.b', expiresAt: new Date(Date.now() + 3600_000).toISOString() } }), { status: 200 })) as never;
    await session.verify('+919811100001', '482916');
    const a = session.get();
    expect(a?.accessToken).toBe('test.a.b');
    expect(session.get()).toBe(a);
    session.clear();
    expect(session.get()).toBeNull();
  });
  it('turns a wrong code into a clear message', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as never;
    await expect(session.verify('+919811100001', '000000')).rejects.toThrow('That code is incorrect.');
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 429 })) as never;
    await expect(session.verify('+919811100001', '000000')).rejects.toThrow(/Too many attempts/);
  });
});

// ---------------------------------------------------------------- delivery screen with a fake API
const delivery = (over: Record<string, unknown> = {}) => ({
  id: 'd1', subscriptionId: 's1', deliveryDate: '2026-10-19', status: 'scheduled', displayStatus: 'pending', editableByCustomer: false,
  totalMinor: 6000, instructions: 'Ring once', deliveredAt: null, failureReason: null, windowStart: '05:30', windowEnd: '07:30',
  zoneId: 'z1', zoneName: 'Jayanagar', customerName: 'Asha Rao', recipientName: 'Asha Rao', phone: '+919876543210',
  addressLabel: 'Home', line1: '12 4th Block', line2: '', landmark: 'Temple', city: 'Bengaluru', postalCode: '560011',
  items: [{ variantId: 'v1', name: 'Cow Milk - 500 ml', quantity: 2 }], tags: [] as string[], ...over,
});

function fakeApi() {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let deliveries = [delivery({ tags: ['new_customer'] }), delivery({ id: 'd2', customerName: 'Ravi K', recipientName: 'Ravi K', line1: '5 9th Block', postalCode: '560041', instructions: null, tags: ['pausing_from_tomorrow'] })];
  const notToday = [
    { subscriptionId: 's9', reason: 'paused', pausedUntil: '2026-10-25', stoppedOn: null, customerName: 'Meena S', recipientName: 'Meena S', phone: '+919800000009', line1: '7 3rd Block', line2: '', landmark: '', postalCode: '560011', zoneId: 'z1', zoneName: 'Jayanagar', items: '1 x Curd 400 g' },
    { subscriptionId: 's8', reason: 'paused', pausedUntil: null, stoppedOn: null, customerName: 'Kiran P', recipientName: 'Kiran P', phone: '+919800000008', line1: '2 5th Block', line2: '', landmark: '', postalCode: '560041', zoneId: 'z1', zoneName: 'Jayanagar', items: '2 x Cow Milk 500 ml' },
    { subscriptionId: 's7', reason: 'skipped', pausedUntil: null, stoppedOn: null, customerName: 'Dev R', recipientName: 'Dev R', phone: '+919800000007', line1: '9 1st Block', line2: '', landmark: '', postalCode: '560011', zoneId: 'z1', zoneName: 'Jayanagar', items: '1 x Cow Milk 500 ml' },
  ];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
    if (url.includes('/supplier/zones')) return ok([{ id: 'z1', name: 'Jayanagar', postalCodes: ['560011'], activeSubscriptions: 2 }]);
    if (url.includes('/supplier/day')) {
      const counts: Record<string, number> = {};
      deliveries.forEach((d) => { counts[d.displayStatus as string] = (counts[d.displayStatus as string] ?? 0) + 1; });
      return ok({ date: '2026-10-19', prepared: 0, valueMinor: 12000, counts, totals: [{ variantId: 'v1', name: 'Cow Milk - 500 ml', quantity: 4 }], deliveries, notToday });
    }
    const m = /\/supplier\/deliveries\/(\w+)\/status/.exec(url);
    if (m && method === 'PATCH') {
      deliveries = deliveries.map((d) => (d.id === m[1] ? { ...d, status: body.status, displayStatus: body.status, failureReason: body.reason ?? null } : d));
      return ok({ id: m[1], status: body.status });
    }
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 });
  }) as never;
  return calls;
}

async function renderDay() {
  const { default: Day } = await import('../pages/supplier/Day');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/day', element: <Day /> }], { initialEntries: ['/day?date=2026-10-19'] });
  render(<QueryClientProvider client={qc}><ToastProvider><RouterProvider router={router} /></ToastProvider></QueryClientProvider>);
}

describe('supplier day screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T01:00:00Z')); // 06:30 IST: the morning round
    localStorage.setItem('dd-dashboard-session', JSON.stringify({ accessToken: 'test.t.s', expiresAt: Date.now() + 3600_000, phone: '+919811100001' }));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the load sheet and the delivery list grouped by PIN code', async () => {
    fakeApi();
    await renderDay();
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Ravi K')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Jayanagar · 560011/ })).toBeInTheDocument();
    expect(screen.getByText('Note: Ring once')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0); // load sheet total
    expect(screen.getByText('New customer: first delivery')).toBeInTheDocument();
    expect(screen.getByText('Pausing from tomorrow')).toBeInTheDocument();
  });

  it('lists who NOT to deliver to, with the reason, in its own tab', async () => {
    fakeApi();
    await renderDay();
    const tab = await screen.findByRole('tab', { name: /Do NOT deliver/ });
    expect(tab).toHaveTextContent('3');
    expect(tab).toHaveTextContent('2 paused · 1 skipped');
    expect(screen.queryByText('Meena S')).toBeNull(); // not in the delivery list
    fireEvent.click(tab);
    expect(await screen.findByText('Meena S')).toBeInTheDocument();
    expect(screen.getByText('Paused until they resume')).toBeInTheDocument();
    expect(screen.getByText(/Paused until Sun, 25 Oct|Paused until Sun 25 Oct/)).toBeInTheDocument();
    expect(screen.getByText('Skipped this day')).toBeInTheDocument();
    expect(screen.getByText(/regular customers are not included/)).toBeInTheDocument();
  });

  it('marks a delivery delivered and refreshes the list', async () => {
    const calls = fakeApi();
    await renderDay();
    const row = (await screen.findByText('Asha Rao')).closest('div.rounded-2xl') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /^Delivered$/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && (c.body as { status: string }).status === 'delivered')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.url).toContain('/supplier/deliveries/d1/status');
    // it leaves the "still to deliver" list and shows under Done
    await waitFor(() => expect(screen.queryByText('Asha Rao')).toBeNull());
    expect(screen.getByRole('tab', { name: /Still to deliver/ })).toHaveTextContent('1 of 2 delivered');
    fireEvent.click(screen.getByRole('tab', { name: /Done/ }));
    const done = (await screen.findByText('Asha Rao')).closest('div.rounded-2xl') as HTMLElement;
    expect(within(done).getByText('Delivered')).toBeInTheDocument();
    expect(within(done).queryByRole('button', { name: /^Delivered$/ })).toBeNull();
  });

  it('requires a reason before marking a delivery failed', async () => {
    const calls = fakeApi();
    await renderDay();
    const row = (await screen.findByText('Ravi K')).closest('div.rounded-2xl') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /Failed/ }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    const submit = within(dialog).getByRole('button', { name: 'Mark failed', hidden: true });
    expect(submit).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'House locked', hidden: true }));
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && (c.body as { reason?: string }).reason === 'House locked')).toBe(true));
  });

  it('hides delivery actions on future days (nothing can be delivered yet)', async () => {
    fakeApi();
    const { default: Day } = await import('../pages/supplier/Day');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: '/day', element: <Day /> }], { initialEntries: ['/day?date=2026-10-25'] });
    render(<QueryClientProvider client={qc}><ToastProvider><RouterProvider router={router} /></ToastProvider></QueryClientProvider>);
    await screen.findByText('Asha Rao');
    expect(screen.queryByRole('button', { name: /^Delivered$/ })).toBeNull();
    expect(screen.getByText(/check again after 9 PM/)).toBeInTheDocument();
  });
});
