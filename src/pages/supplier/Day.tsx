import { Ban, Check, ChevronLeft, ChevronRight, MapPin, PauseCircle, Phone, Printer, RefreshCw, Search, Truck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router';
import { Button, Card, cx, Empty, ErrorBox, Modal, PageHeader, Select, Spinner, StatusBadge, TextArea, useToast } from '../../components/ui';
import { errorText } from '../../lib/api';
import { istDate, istHour, money, prettyDate, shiftDate } from '../../lib/format';
import { useBulkStatus, useDay, useMyZones, useSetStatus, type Delivery, type DeliveryTag, type NotToday } from '../../lib/queries';

const OPEN = ['scheduled', 'pending', 'out_for_delivery'];
type Tab = 'deliver' | 'not' | 'done';

/** Morning: today's round. Afternoon onwards: plan tomorrow's load. */
const defaultDate = () => (istHour() < 12 ? istDate() : istDate(1));
/** "near Temple", but not "near Near metro". */
const near = (landmark: string) => (landmark ? (/^near/i.test(landmark) ? ` · ${landmark}` : ` · near ${landmark}`) : '');
/** "today" / "tomorrow" / "Wed, 21 Oct" for use inside a sentence. */
const dayPhrase = (iso: string) => { const p = prettyDate(iso); return ['Today', 'Tomorrow', 'Yesterday'].includes(p) ? p.toLowerCase() : p; };
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const TAG: Record<DeliveryTag, { label: string; cls: string }> = {
  new_customer: { label: 'New customer: first delivery', cls: 'bg-lime-300 text-forest-900' },
  back_from_pause: { label: 'Back from pause', cls: 'bg-sky-100 text-sky-900' },
  last_prepaid: { label: 'Last prepaid delivery: renewal due', cls: 'bg-amber-100 text-amber-900' },
  pausing_from_tomorrow: { label: 'Pausing from tomorrow', cls: 'bg-amber-100 text-amber-900' },
  skipping_tomorrow: { label: 'Skipping tomorrow', cls: 'bg-gray-100 text-gray-700' },
};

export function notTodayReason(n: NotToday): string {
  switch (n.reason) {
    case 'paused': return n.pausedUntil ? `Paused until ${shortDate(n.pausedUntil)}` : 'Paused until they resume';
    case 'skipped': return 'Skipped this day';
    case 'stopped': return n.stoppedOn ? `Stopped: cancelled on ${shortDate(n.stoppedOn)}` : 'Stopped: cancelled';
    case 'renewal_due': return 'Plan ended: renewal not paid';
    case 'holiday': return 'Holiday: no delivery';
  }
}

export default function Day() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? defaultDate();
  const zoneId = params.get('zone') ?? undefined;
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('deliver');
  const [failing, setFailing] = useState<Delivery | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  // The paper route sheet is only rendered while printing (also when printing from the browser menu).
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => setPrinting(true);
    const off = () => setPrinting(false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
    };
  }, []);
  const print = () => {
    flushSync(() => setPrinting(true));
    window.print();
  };
  const zones = useMyZones();
  const day = useDay(date, zoneId);
  const toast = useToast();
  const setStatus = useSetStatus();
  const bulk = useBulkStatus();

  const go = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  const all = day.data?.deliveries ?? [];
  const notToday = day.data?.notToday ?? [];
  const open = all.filter((d) => OPEN.includes(d.status));
  const done = all.filter((d) => !OPEN.includes(d.status));
  const delivered = all.filter((d) => d.status === 'delivered').length;
  const isFuture = date > istDate();

  const q = search.trim().toLowerCase();
  const match = (vals: (string | null | undefined)[]) => !q || vals.some((v) => v?.toLowerCase().includes(q));
  const visibleDeliveries = useMemo(
    () => (tab === 'deliver' ? open : done).filter((d) => match([d.customerName, d.recipientName, d.line1, d.line2, d.landmark, d.postalCode, d.phone])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, day.data, q],
  );
  const visibleNot = notToday.filter((n) => match([n.customerName, n.recipientName, n.line1, n.line2, n.landmark, n.postalCode, n.phone]));
  const groups = useMemo(() => {
    const m = new Map<string, Delivery[]>();
    for (const d of visibleDeliveries) {
      const k = `${d.zoneName} · ${d.postalCode}`;
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [visibleDeliveries]);

  const reasonCount = (r: NotToday['reason']) => notToday.filter((n) => n.reason === r).length;
  const notSummary = [
    reasonCount('paused') && `${reasonCount('paused')} paused`,
    reasonCount('skipped') && `${reasonCount('skipped')} skipped`,
    reasonCount('stopped') && `${reasonCount('stopped')} stopped`,
    reasonCount('renewal_due') && `${reasonCount('renewal_due')} renewal due`,
    reasonCount('holiday') && `${reasonCount('holiday')} holiday`,
  ].filter(Boolean).join(' · ');

  const act = async (d: Delivery, status: 'out_for_delivery' | 'delivered') => {
    try {
      await setStatus.mutateAsync({ id: d.id, status });
      toast('success', `${d.customerName || d.recipientName}: ${status === 'delivered' ? 'delivered' : 'out for delivery'}`);
    } catch (e) {
      toast('error', errorText(e));
    }
  };
  const markAll = async () => {
    try {
      const r = await bulk.mutateAsync({ ids: open.map((d) => d.id), status: 'delivered' });
      setConfirmAll(false);
      toast(r.updated === open.length ? 'success' : 'error', `${r.updated} of ${open.length} marked delivered`);
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={`${prettyDate(date)}'s deliveries`}
        subtitle={new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => day.refetch()} loading={day.isFetching}><RefreshCw className="size-4" />Refresh</Button>
            <Button variant="secondary" size="sm" onClick={print} disabled={!day.data}><Printer className="size-4" />Print route sheet</Button>
          </>
        }
      />

      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-forest-200 bg-white">
          <button className="rounded-l-xl p-2.5 hover:bg-forest-50" aria-label="Previous day" onClick={() => go({ date: shiftDate(date, -1) })}><ChevronLeft className="size-5" /></button>
          <input type="date" aria-label="Date" value={date} onChange={(e) => e.target.value && go({ date: e.target.value })} className="h-10 bg-transparent px-1 outline-none" />
          <button className="rounded-r-xl p-2.5 hover:bg-forest-50" aria-label="Next day" onClick={() => go({ date: shiftDate(date, 1) })}><ChevronRight className="size-5" /></button>
        </div>
        {[['Today', istDate()], ['Tomorrow', istDate(1)]].map(([l, d]) => (
          <Button key={l} size="sm" variant={date === d ? 'primary' : 'secondary'} onClick={() => go({ date: d })}>{l}</Button>
        ))}
        {(zones.data?.length ?? 0) > 1 ? (
          <Select aria-label="Area" value={zoneId ?? ''} onChange={(e) => go({ zone: e.target.value || undefined })} className="h-10 w-auto">
            <option value="">All my areas</option>
            {zones.data!.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
        ) : null}
      </div>

      {zones.data && zones.data.length === 0 ? (
        <Empty title="No areas assigned yet" message="Ask the DailyDairy owner to assign you an area. Your deliveries will appear here." />
      ) : day.isLoading ? <Spinner label="Preparing the delivery list" /> : day.isError ? (
        <ErrorBox message={errorText(day.error)} onRetry={() => day.refetch()} />
      ) : (
        <>
          {/* The three numbers that matter, as big buttons that also switch the list */}
          <div className="no-print mb-4 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Delivery lists">
            <SummaryTab active={tab === 'deliver'} onClick={() => setTab('deliver')} tone="deliver" icon={<Truck className="size-6" />}
              label={isFuture ? 'To deliver' : 'Still to deliver'} value={isFuture ? all.length : open.length}
              sub={isFuture ? `${money(day.data!.valueMinor)} worth` : `${delivered} of ${all.length} delivered`} />
            <SummaryTab active={tab === 'not'} onClick={() => setTab('not')} tone="not" icon={<Ban className="size-6" />}
              label="Do NOT deliver" value={notToday.length} sub={notSummary || 'Everyone is getting milk'} />
            <SummaryTab active={tab === 'done'} onClick={() => setTab('done')} tone="done" icon={<Check className="size-6" />}
              label="Done" value={done.length} sub={`${delivered} delivered · ${day.data!.counts.failed ?? 0} failed`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <Card className="no-print h-fit">
              <h2 className="font-display text-xl">Load sheet</h2>
              <p className="mb-3 text-sm text-gray-600">
                Pack for {all.filter((d) => d.status !== 'failed').length} customers.
                {isFuture ? ' Customers can still pause or skip until the evening cutoff: check again after 9 PM.' : ''}
              </p>
              {day.data!.totals.length ? (
                <table className="w-full text-sm">
                  <tbody>
                    {day.data!.totals.map((t) => (
                      <tr key={t.variantId} className="border-t border-forest-100">
                        <td className="py-2 pr-2">{t.name}</td>
                        <td className="py-2 text-right font-display text-2xl">{t.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-gray-500">Nothing to load.</p>}
              {notToday.length ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900">{notToday.length} regular customer{notToday.length > 1 ? 's are' : ' is'} not included ({notSummary}).</p> : null}
            </Card>

            <div className="no-print">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-3 left-3 size-4 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, address, PIN" aria-label="Search"
                    className="h-10 w-full rounded-xl border border-forest-200 bg-white pr-3 pl-9 outline-none focus:border-forest-600" />
                </label>
                {tab === 'deliver' && open.length && !isFuture ? <Button size="sm" variant="success" onClick={() => setConfirmAll(true)}><Check className="size-4" />Mark all delivered</Button> : null}
              </div>

              {tab === 'not' ? (
                !visibleNot.length ? (
                  <Empty title={notToday.length ? 'No match' : 'No one to skip'} message={notToday.length ? 'Try a different search.' : 'Every regular customer gets milk on this day.'} />
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-900">Do not deliver to these customers {['Today', 'Tomorrow', 'Yesterday'].includes(prettyDate(date)) ? dayPhrase(date) : `on ${dayPhrase(date)}`}.</p>
                    {visibleNot.map((n) => <NotTodayRow key={n.subscriptionId} n={n} />)}
                  </div>
                )
              ) : !visibleDeliveries.length ? (
                <Empty
                  title={tab === 'deliver' ? (all.length ? 'All delivered' : 'No deliveries on this day') : 'Nothing completed yet'}
                  message={tab === 'deliver' && all.length ? 'Every delivery for this day is done. Well done!' : tab === 'deliver' ? 'Active subscriptions in your area appear here automatically.' : undefined}
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map(([group, items]) => (
                    <section key={group} aria-label={group}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600"><MapPin className="size-4" />{group} <span className="text-gray-400">· {items.length}</span></h3>
                      <div className="flex flex-col gap-2">
                        {items.map((d) => <DeliveryRow key={d.id} d={d} isFuture={isFuture} busy={setStatus.isPending && setStatus.variables?.id === d.id} onAct={act} onFail={() => setFailing(d)} />)}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>

          {printing ? <PrintSheet date={date} deliveries={all} notToday={notToday} totals={day.data!.totals} /> : null}
        </>
      )}

      <FailDialog delivery={failing} onClose={() => setFailing(null)} />
      <Modal open={confirmAll} title="Mark all delivered?" onClose={() => setConfirmAll(false)}
        footer={<><Button variant="secondary" onClick={() => setConfirmAll(false)}>Cancel</Button><Button loading={bulk.isPending} onClick={markAll}>Mark {open.length} delivered</Button></>}>
        <p>{open.length} remaining deliveries for {dayPhrase(date)} will be marked delivered and customers will be notified. Mark any failed ones first.</p>
      </Modal>
    </div>
  );
}

function SummaryTab({ active, onClick, tone, icon, label, value, sub }: { active: boolean; onClick: () => void; tone: 'deliver' | 'not' | 'done'; icon: React.ReactNode; label: string; value: number; sub: string }) {
  const tones = {
    deliver: active ? 'bg-forest-700 text-white border-forest-700' : 'bg-white border-forest-200 text-forest-900',
    not: active ? 'bg-red-700 text-white border-red-700' : 'bg-white border-red-200 text-red-900',
    done: active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-forest-200 text-forest-900',
  };
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={cx('flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors', tones[tone])}>
      <span className={cx('rounded-xl p-2', active ? 'bg-white/15' : tone === 'not' ? 'bg-red-50' : 'bg-forest-50')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <span className="block font-display text-3xl leading-tight">{value}</span>
        <span className="block truncate text-sm opacity-80">{sub}</span>
      </span>
    </button>
  );
}

function DeliveryRow({ d, isFuture, busy, onAct, onFail }: { d: Delivery; isFuture: boolean; busy: boolean; onAct: (d: Delivery, s: 'out_for_delivery' | 'delivered') => void; onFail: () => void }) {
  const open = OPEN.includes(d.status);
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{d.customerName || d.recipientName}</p>
            <StatusBadge status={d.displayStatus} />
          </div>
          {d.tags?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.tags.map((t) => <span key={t} className={cx('rounded-full px-2 py-0.5 text-xs font-bold', TAG[t].cls)}>{TAG[t].label}</span>)}
            </div>
          ) : null}
          <p className="mt-1 text-sm text-gray-700">{[d.line1, d.line2].filter(Boolean).join(', ')}{near(d.landmark)}</p>
          {d.recipientName && d.recipientName !== d.customerName ? <p className="text-sm text-gray-600">Receiver: {d.recipientName}</p> : null}
          {d.instructions ? <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-900">Note: {d.instructions}</p> : null}
          <p className="mt-2 text-base font-semibold text-forest-800">{d.items.map((i) => `${i.quantity} × ${i.name}`).join('  ·  ')}</p>
          {d.failureReason ? <p className="mt-1 text-sm text-red-700">Failed: {d.failureReason}</p> : null}
          {d.editableByCustomer ? <p className="mt-1 text-xs text-gray-500">The customer can still change this until the evening cutoff.</p> : null}
        </div>
        <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 rounded-xl border border-forest-200 px-3 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Phone className="size-4" />Call</a>
      </div>
      {open && !isFuture ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-forest-100 pt-3">
          {d.status !== 'out_for_delivery' ? <Button size="sm" variant="secondary" loading={busy} onClick={() => onAct(d, 'out_for_delivery')}><Truck className="size-4" />Out for delivery</Button> : null}
          <Button size="sm" loading={busy} onClick={() => onAct(d, 'delivered')}><Check className="size-4" />Delivered</Button>
          <Button size="sm" variant="danger" onClick={onFail}><X className="size-4" />Failed</Button>
        </div>
      ) : null}
    </Card>
  );
}

function NotTodayRow({ n }: { n: NotToday }) {
  const paused = n.reason === 'paused';
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-200 border-l-4 border-l-red-600 bg-white p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-gray-800">{n.customerName || n.recipientName}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
            {paused ? <PauseCircle className="size-3.5" /> : <Ban className="size-3.5" />}
            {notTodayReason(n)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{[n.line1, n.line2].filter(Boolean).join(', ')} · {n.postalCode}{near(n.landmark)}</p>
        <p className="mt-1 text-sm text-gray-500">Usually gets: <span className="line-through">{n.items}</span></p>
      </div>
      <a href={`tel:${n.phone}`} className="inline-flex items-center gap-1.5 rounded-xl border border-forest-200 px-3 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Phone className="size-4" />Call</a>
    </div>
  );
}

/** Paper version: load sheet, numbered route with tick boxes, and the do-not-deliver list. */
function PrintSheet({ date, deliveries, notToday, totals }: { date: string; deliveries: Delivery[]; notToday: NotToday[]; totals: { variantId: string; name: string; quantity: number }[] }) {
  const route = deliveries.filter((d) => d.status !== 'failed');
  return (
    <div className="print-only text-[12px]">
      <h2 className="mb-1 text-lg font-bold">Route sheet · {new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h2>
      <p className="mb-2"><strong>Load:</strong> {totals.map((t) => `${t.name} × ${t.quantity}`).join('   ')}</p>
      <table className="mb-4 w-full border-collapse">
        <thead><tr className="border-b-2 border-black text-left"><th className="w-6">#</th><th>Customer</th><th>Address</th><th>Items</th><th className="w-10">Done</th></tr></thead>
        <tbody>
          {route.map((d, i) => (
            <tr key={d.id} className="print-break border-b border-gray-400 align-top">
              <td className="py-1">{i + 1}</td>
              <td className="py-1">{d.customerName || d.recipientName}<br />{d.phone}{d.tags?.includes('new_customer') ? <><br /><strong>NEW</strong></> : null}</td>
              <td className="py-1">{[d.line1, d.line2].filter(Boolean).join(', ')}, {d.postalCode}{d.landmark ? ` (near ${d.landmark})` : ''}{d.instructions ? <><br /><em>Note: {d.instructions}</em></> : null}</td>
              <td className="py-1">{d.items.map((x) => `${x.quantity} × ${x.name}`).join(', ')}</td>
              <td className="py-1">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notToday.length ? (
        <>
          <h3 className="mb-1 text-base font-bold">DO NOT DELIVER ({notToday.length})</h3>
          <table className="w-full border-collapse">
            <tbody>
              {notToday.map((n) => (
                <tr key={n.subscriptionId} className="print-break border-b border-gray-400 align-top">
                  <td className="py-1 pr-2 font-semibold">{n.customerName || n.recipientName}</td>
                  <td className="py-1 pr-2">{[n.line1, n.line2].filter(Boolean).join(', ')}, {n.postalCode}</td>
                  <td className="py-1 font-semibold">{notTodayReason(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

const REASONS = ['Customer not at home', 'House locked', 'Address not found', 'Customer refused', 'Stock shortage'];
function FailDialog({ delivery, onClose }: { delivery: Delivery | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const setStatus = useSetStatus();
  const toast = useToast();
  const submit = async () => {
    if (!delivery || !reason.trim()) return;
    try {
      await setStatus.mutateAsync({ id: delivery.id, status: 'failed', reason: reason.trim() });
      toast('success', 'Marked failed. The customer is notified and the delivery is credited back to their plan.');
      setReason('');
      onClose();
    } catch (e) {
      toast('error', errorText(e));
    }
  };
  return (
    <Modal open={!!delivery} title="Delivery failed" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} loading={setStatus.isPending} onClick={submit}>Mark failed</Button></>}>
      <p className="mb-3 text-gray-700">{delivery?.customerName}: the customer is told why, and this delivery is credited back to their plan.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS.map((r) => <Button key={r} size="sm" variant={reason === r ? 'primary' : 'secondary'} onClick={() => setReason(r)}>{r}</Button>)}
      </div>
      <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="What happened?" />
    </Modal>
  );
}
