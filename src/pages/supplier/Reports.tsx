import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Empty, ErrorBox, PageHeader, Select, Spinner, Stat } from '../../components/ui';
import { errorText } from '../../lib/api';
import { download, istDate, money, prettyDate, shiftDate, toCsv } from '../../lib/format';
import { useMyZones, useReport } from '../../lib/queries';

const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;

export default function Reports() {
  const today = istDate();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [zoneId, setZoneId] = useState('');
  const zones = useMyZones();
  const r = useReport(from, to, zoneId || undefined);
  const maxValue = Math.max(1, ...(r.data?.days.map((d) => d.valueMinor) ?? [0]));

  const presets: [string, string, string][] = [
    ['This month', monthStart(today), today],
    ['Last 7 days', shiftDate(today, -6), today],
    ['Last 30 days', shiftDate(today, -29), today],
  ];
  const exportCsv = () =>
    download(`report-${from}-to-${to}.csv`, toCsv((r.data?.days ?? []).map((d) => ({
      Date: d.date, Delivered: d.delivered, Failed: d.failed, Skipped: d.skipped, 'Value (Rs)': (d.valueMinor / 100).toFixed(2),
    }))));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Delivered orders and value"
        actions={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={!r.data?.days.length}><Download className="size-4" />Export CSV</Button>} />
      <div className="mb-5 flex flex-wrap items-end gap-2">
        {presets.map(([l, f, t]) => <Button key={l} size="sm" variant={from === f && to === t ? 'primary' : 'secondary'} onClick={() => { setFrom(f); setTo(t); }}>{l}</Button>)}
        <label className="text-sm">From <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="ml-1 h-10 rounded-xl border border-forest-200 bg-white px-2" /></label>
        <label className="text-sm">To <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="ml-1 h-10 rounded-xl border border-forest-200 bg-white px-2" /></label>
        {(zones.data?.length ?? 0) > 1 ? (
          <Select aria-label="Area" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-10 w-auto">
            <option value="">All areas</option>
            {zones.data!.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
        ) : null}
      </div>
      {r.isLoading ? <Spinner /> : r.isError ? <ErrorBox message={errorText(r.error)} onRetry={() => r.refetch()} /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Delivered" value={r.data!.totals.delivered} tone="good" />
            <Stat label="Value delivered" value={money(r.data!.totals.valueMinor)} />
            <Stat label="Failed" value={r.data!.totals.failed} tone={r.data!.totals.failed ? 'bad' : undefined} />
            <Stat label="Skipped by customers" value={r.data!.totals.skipped} />
          </div>
          {!r.data!.days.length ? <Empty title="No deliveries in this period" /> : (
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <Card>
                <h2 className="mb-3 font-display text-xl">By day</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead><tr className="text-left text-gray-500"><th className="py-2">Date</th><th>Delivered</th><th>Failed</th><th>Skipped</th><th className="text-right">Value</th></tr></thead>
                    <tbody>
                      {r.data!.days.map((d) => (
                        <tr key={d.date} className="border-t border-forest-100">
                          <td className="py-2">{prettyDate(d.date)}</td>
                          <td>{d.delivered}</td>
                          <td className={d.failed ? 'text-red-700' : ''}>{d.failed}</td>
                          <td>{d.skipped}</td>
                          <td className="text-right">
                            <span className="mr-2 inline-block h-2 rounded bg-forest-200 align-middle" style={{ width: `${Math.round((d.valueMinor / maxValue) * 80)}px` }} aria-hidden />
                            {money(d.valueMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card className="h-fit">
                <h2 className="mb-3 font-display text-xl">Products delivered</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {r.data!.products.map((p) => (
                      <tr key={p.name} className="border-t border-forest-100"><td className="py-2 pr-2">{p.name}</td><td className="text-right font-semibold">{p.quantity}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
