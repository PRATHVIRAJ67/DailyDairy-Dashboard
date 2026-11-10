import { Download, Phone, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Empty, ErrorBox, PageHeader, Select, Spinner, StatusBadge } from '../../components/ui';
import { errorText } from '../../lib/api';
import { download, prettyDate, toCsv } from '../../lib/format';
import { useCustomers, useMyZones } from '../../lib/queries';

const FREQ: Record<string, string> = { daily: 'Every day', alternate_days: 'Alternate days', weekdays: 'Selected days' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Customers() {
  const [zoneId, setZoneId] = useState('');
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const zones = useMyZones();
  const list = useCustomers({ zoneId: zoneId || undefined, status: status || undefined, q: q || undefined });

  const exportCsv = () =>
    download(`customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv((list.data ?? []).map((c) => ({
      Name: c.customerName, Receiver: c.recipientName, Phone: c.phone, Address: [c.line1, c.line2].filter(Boolean).join(', '), Landmark: c.landmark,
      PIN: c.postalCode, Area: c.zoneName, Items: c.items, Schedule: FREQ[c.frequency] ?? c.frequency, Status: c.status,
      'Next delivery': c.nextDelivery ?? '', 'Prepaid deliveries left': c.deliveryBalance, Instructions: c.deliveryInstructions,
    }))));

  return (
    <div>
      <PageHeader title="Customers" subtitle="Subscriptions in your areas"
        actions={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={!list.data?.length}><Download className="size-4" />Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, address, phone" aria-label="Search customers"
            className="h-10 w-full rounded-xl border border-forest-200 bg-white pl-9 pr-3 outline-none focus:border-forest-600" />
        </label>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="past_due">Renewal due</option>
          <option value="pending_payment">Awaiting payment</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        {(zones.data?.length ?? 0) > 1 ? (
          <Select aria-label="Area" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-10 w-auto">
            <option value="">All areas</option>
            {zones.data!.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
        ) : null}
      </div>
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorBox message={errorText(list.error)} onRetry={() => list.refetch()} /> : !list.data!.length ? (
        <Empty title="No customers found" message="Customers appear here once they subscribe with an address in your area." />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-600">{list.data!.length} customers</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.data!.map((c) => (
              <Card key={c.subscriptionId}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.customerName || c.recipientName}</p>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-sm text-gray-700">{[c.line1, c.line2].filter(Boolean).join(', ')} · {c.postalCode}</p>
                {c.landmark ? <p className="text-sm text-gray-600">Near {c.landmark}</p> : null}
                <p className="mt-2 text-sm font-medium">{c.items}</p>
                <p className="text-sm text-gray-600">
                  {FREQ[c.frequency] ?? c.frequency}{c.frequency === 'weekdays' && c.weekdays ? ` (${c.weekdays.map((d) => DAYS[d]).join(', ')})` : ''}
                  {' · '}{c.deliveryBalance} prepaid left
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{c.nextDelivery ? `Next: ${prettyDate(c.nextDelivery)}` : 'No upcoming delivery'}</span>
                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700"><Phone className="size-4" />{c.phone}</a>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
