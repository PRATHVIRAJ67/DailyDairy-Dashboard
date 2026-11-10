import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Spinner, TextArea, Toggle, useToast } from '../../components/ui';
import { errorText } from '../../lib/api';
import { parsePins } from '../../lib/format';
import { useSaveZone, useZones, type Zone } from '../../lib/queries';

export default function Areas() {
  const zones = useZones();
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  return (
    <div>
      <PageHeader title="Areas" subtitle="Where you deliver. Customers with these PIN codes can subscribe immediately."
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" />Add area</Button>} />
      {zones.isLoading ? <Spinner /> : zones.isError ? <ErrorBox message={errorText(zones.error)} onRetry={() => zones.refetch()} /> : !zones.data!.length ? (
        <Empty title="No areas yet" message="Add an area with a name and its PIN codes." action={<Button onClick={() => setEditing('new')}>Add area</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {zones.data!.map((z) => (
            <Card key={z.id} className={z.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl">{z.name}</p>
                  {!z.isActive ? <p className="text-sm font-semibold text-gray-500">Paused: not taking orders</p> : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(z)} aria-label={`Edit ${z.name}`}><Pencil className="size-4" />Edit</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {z.postalCodes.map((p) => <span key={p} className="rounded-lg bg-forest-50 px-2 py-0.5 text-sm font-medium text-forest-800">{p}</span>)}
              </div>
              <p className="mt-3 text-sm text-gray-600">Delivery {z.windowStart}–{z.windowEnd} · changes close {z.cutoffTime} the day before</p>
              <p className="text-sm text-gray-600">{z.activeSubscriptions} active subscriptions · {z.customers ?? 0} customers</p>
              <p className="text-sm text-gray-600">Supplier: {z.suppliers?.length ? z.suppliers.map((s) => s.name).join(', ') : <span className="font-semibold text-amber-700">none</span>}</p>
            </Card>
          ))}
        </div>
      )}
      {editing ? <AreaForm zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function AreaForm({ zone, onClose }: { zone: Zone | null; onClose: () => void }) {
  const [name, setName] = useState(zone?.name ?? '');
  const [pins, setPins] = useState(zone?.postalCodes.join(', ') ?? '');
  const [windowStart, setWindowStart] = useState(zone?.windowStart ?? '06:00');
  const [windowEnd, setWindowEnd] = useState(zone?.windowEnd ?? '08:00');
  const [cutoffTime, setCutoff] = useState(zone?.cutoffTime ?? '21:00');
  const [isActive, setActive] = useState(zone?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSaveZone();
  const toast = useToast();
  const parsed = parsePins(pins);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter the area name';
    if (parsed.invalid.length) e.pins = `Not valid PIN codes: ${parsed.invalid.join(', ')}`;
    else if (!parsed.pins.length) e.pins = 'Add at least one 6-digit PIN code';
    if (windowEnd <= windowStart) e.window = 'The delivery window must end after it starts';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({ id: zone?.id, name: name.trim(), postalCodes: parsed.pins, windowStart, windowEnd, cutoffTime, isActive });
      toast('success', zone ? 'Area updated' : `${name.trim()} added. Customers in these PIN codes can now subscribe.`);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    }
  };

  return (
    <Modal open title={zone ? `Edit ${zone.name}` : 'New area'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={submit}>{zone ? 'Save' : 'Add area'}</Button></>}>
      {errors.form ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-red-800">{errors.form}</p> : null}
      <Input label="Area name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Jayanagar" maxLength={60} />
      <TextArea label="PIN codes" value={pins} onChange={(e) => setPins(e.target.value)} error={errors.pins}
        hint={parsed.pins.length ? `${parsed.pins.length} PIN code${parsed.pins.length > 1 ? 's' : ''}: separate with commas or spaces` : 'Separate with commas or spaces'}
        placeholder="560011, 560041, 560069" />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Delivery from" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
        <Input label="Delivery until" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
        <Input label="Cutoff (day before)" type="time" value={cutoffTime} onChange={(e) => setCutoff(e.target.value)} />
      </div>
      {errors.window ? <p role="alert" className="-mt-2 mb-3 text-sm text-red-700">{errors.window}</p> : null}
      <Toggle checked={isActive} onChange={setActive} label="Taking orders" />
      {!isActive ? <p className="text-sm text-amber-800">Paused areas stop new subscriptions. Existing customers keep their prepaid deliveries.</p> : null}
    </Modal>
  );
}
