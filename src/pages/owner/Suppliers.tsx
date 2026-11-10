import { Pencil, Phone, Plus, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Spinner, useToast } from '../../components/ui';
import { errorText } from '../../lib/api';
import { useCreateSupplier, useSuppliers, useUpdateSupplier, useZones, type Supplier } from '../../lib/queries';

export default function Suppliers() {
  const suppliers = useSuppliers();
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [removing, setRemoving] = useState<Supplier | null>(null);
  const update = useUpdateSupplier();
  const toast = useToast();

  const remove = async () => {
    if (!removing) return;
    try {
      await update.mutateAsync({ id: removing.id, active: false });
      toast('success', `${removing.fullName} removed. They can no longer open the dashboard.`);
      setRemoving(null);
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Each supplier sees and delivers only their assigned areas."
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" />Add supplier</Button>} />
      {suppliers.isLoading ? <Spinner /> : suppliers.isError ? <ErrorBox message={errorText(suppliers.error)} onRetry={() => suppliers.refetch()} /> : !suppliers.data!.length ? (
        <Empty title="No suppliers yet" message="Add a supplier with their mobile number and choose their areas. They sign in with that number." action={<Button onClick={() => setEditing('new')}>Add supplier</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.data!.map((s) => (
            <Card key={s.id}>
              <p className="font-display text-xl">{s.fullName}</p>
              <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-sm text-forest-700"><Phone className="size-4" />{s.phone}</a>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.zones.length ? s.zones.map((z) => <span key={z.id} className="rounded-lg bg-forest-50 px-2 py-0.5 text-sm font-medium text-forest-800">{z.name}</span>)
                  : <span className="text-sm font-semibold text-amber-700">No areas assigned</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(s)}><Pencil className="size-4" />Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setRemoving(s)}><UserMinus className="size-4" />Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing ? <SupplierForm supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <Modal open={!!removing} title="Remove supplier?" onClose={() => setRemoving(null)}
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" loading={update.isPending} onClick={remove}>Remove</Button></>}>
        <p>{removing?.fullName} loses dashboard access immediately. Their areas need another supplier. Deliveries and history are kept.</p>
      </Modal>
    </div>
  );
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const zones = useZones();
  const [fullName, setName] = useState(supplier?.fullName ?? '');
  const [digits, setDigits] = useState(supplier?.phone.replace('+91', '') ?? '');
  const [zoneIds, setZoneIds] = useState<string[]>(supplier?.zones.map((z) => z.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const toast = useToast();
  const toggle = (id: string) => setZoneIds((z) => (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.name = 'Enter the supplier or business name';
    if (!supplier && !/^[6-9]\d{9}$/.test(digits)) e.phone = 'Enter a valid 10-digit mobile number';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      if (supplier) await update.mutateAsync({ id: supplier.id, fullName: fullName.trim(), zoneIds });
      else await create.mutateAsync({ phone: `+91${digits}`, fullName: fullName.trim(), zoneIds });
      toast('success', supplier ? 'Supplier updated' : `${fullName.trim()} added. They can sign in with +91${digits}.`);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    }
  };

  return (
    <Modal open title={supplier ? `Edit ${supplier.fullName}` : 'New supplier'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={submit}>{supplier ? 'Save' : 'Add supplier'}</Button></>}>
      {errors.form ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-red-800">{errors.form}</p> : null}
      <Input label="Name" value={fullName} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Ravi Milk Agency" maxLength={80} />
      {supplier ? <p className="mb-4 text-sm text-gray-600">Mobile: {supplier.phone}</p> : (
        <Input label="Mobile number (they sign in with this)" inputMode="numeric" maxLength={10} value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))} error={errors.phone} placeholder="98765 43210" />
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Areas</legend>
        {zones.isLoading ? <Spinner /> : !zones.data?.length ? <p className="text-sm text-gray-600">Create an area first.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {zones.data.map((z) => (
              <label key={z.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-forest-100 px-3 py-2 hover:bg-forest-50">
                <input type="checkbox" checked={zoneIds.includes(z.id)} onChange={() => toggle(z.id)} className="size-4 accent-forest-700" />
                <span className="flex-1">{z.name}{!z.isActive ? ' (paused)' : ''}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
