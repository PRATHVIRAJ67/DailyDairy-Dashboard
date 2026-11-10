import { ArrowRight, MapPin, Package, UserCog } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from '../../components/ui';
import { errorText } from '../../lib/api';
import { istDate, istHour, money, prettyDate } from '../../lib/format';
import { useDay, useProducts, useSuppliers, useZones } from '../../lib/queries';

export default function Overview() {
  const date = istHour() < 12 ? istDate() : istDate(1);
  const day = useDay(date);
  const zones = useZones();
  const suppliers = useSuppliers();
  const products = useProducts();

  const perZone = useMemo(() => {
    const m = new Map<string, { name: string; total: number; delivered: number; open: number; failed: number; valueMinor: number }>();
    for (const d of day.data?.deliveries ?? []) {
      const z = m.get(d.zoneId) ?? { name: d.zoneName, total: 0, delivered: 0, open: 0, failed: 0, valueMinor: 0 };
      if (d.status !== 'skipped') z.total++;
      if (d.status === 'delivered') z.delivered++;
      if (d.status === 'failed') z.failed++;
      if (['scheduled', 'pending', 'out_for_delivery'].includes(d.status)) z.open++;
      if (!['skipped', 'failed'].includes(d.status)) z.valueMinor += d.totalMinor;
      m.set(d.zoneId, z);
    }
    return m;
  }, [day.data]);

  const activeZones = (zones.data ?? []).filter((z) => z.isActive);
  const unassigned = activeZones.filter((z) => !z.suppliers?.length);
  const subs = activeZones.reduce((n, z) => n + z.activeSubscriptions, 0);

  return (
    <div>
      <PageHeader title="Overview" subtitle={`${prettyDate(date)} across all areas`} />
      {zones.isLoading || day.isLoading ? <Spinner /> : zones.isError ? <ErrorBox message={errorText(zones.error)} onRetry={() => zones.refetch()} /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`${prettyDate(date)}'s deliveries`} value={(day.data?.deliveries.length ?? 0) - (day.data?.counts.skipped ?? 0)} />
            <Stat label="Value" value={money(day.data?.valueMinor ?? 0)} />
            <Stat label="Active subscriptions" value={subs} tone="good" />
            <Stat label="Active areas" value={activeZones.length} />
          </div>

          {unassigned.length ? (
            <div role="alert" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <strong>{unassigned.length} area{unassigned.length > 1 ? 's have' : ' has'} no supplier:</strong> {unassigned.map((z) => z.name).join(', ')}.{' '}
              <Link to="/owner/suppliers" className="font-semibold underline">Assign a supplier</Link>
            </div>
          ) : null}

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { to: '/owner/areas', icon: <MapPin className="size-5" />, t: 'Areas', s: `${activeZones.length} active` },
              { to: '/owner/suppliers', icon: <UserCog className="size-5" />, t: 'Suppliers', s: `${suppliers.data?.length ?? 0} suppliers` },
              { to: '/owner/products', icon: <Package className="size-5" />, t: 'Products', s: `${products.data?.filter((p) => p.isActive).length ?? 0} on sale` },
            ].map((x) => (
              <Link key={x.to} to={x.to} className="group">
                <Card className="flex items-center gap-3 transition-colors group-hover:border-forest-500">
                  <span className="rounded-xl bg-forest-50 p-2.5 text-forest-700">{x.icon}</span>
                  <span className="flex-1"><span className="block font-semibold">{x.t}</span><span className="text-sm text-gray-600">{x.s}</span></span>
                  <ArrowRight className="size-5 text-gray-400" />
                </Card>
              </Link>
            ))}
          </div>

          <h2 className="mb-3 font-display text-2xl">Areas</h2>
          {!activeZones.length ? (
            <Empty title="No areas yet" message="Create your first delivery area with its PIN codes." action={<Link to="/owner/areas" className="font-semibold text-forest-700 underline">Add an area</Link>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeZones.map((z) => {
                const s = perZone.get(z.id);
                return (
                  <Card key={z.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-xl">{z.name}</p>
                      <Link to={`/day?date=${date}&zone=${z.id}`} className="text-sm font-semibold text-forest-700 underline">Open</Link>
                    </div>
                    <p className="text-sm text-gray-600">{z.suppliers?.length ? z.suppliers.map((x) => x.name).join(', ') : 'No supplier assigned'}</p>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                      <div><p className="font-display text-lg">{s?.total ?? 0}</p><p className="text-gray-500">orders</p></div>
                      <div><p className="font-display text-lg text-forest-700">{s?.delivered ?? 0}</p><p className="text-gray-500">done</p></div>
                      <div><p className="font-display text-lg text-amber-700">{s?.open ?? 0}</p><p className="text-gray-500">left</p></div>
                      <div><p className="font-display text-lg">{z.activeSubscriptions}</p><p className="text-gray-500">subs</p></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
