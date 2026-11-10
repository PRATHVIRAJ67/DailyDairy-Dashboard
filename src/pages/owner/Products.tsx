import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Spinner, TextArea, Toggle, useToast } from '../../components/ui';
import { errorText } from '../../lib/api';
import { categoryLabel, money, paiseToRupees, rupeesToPaise } from '../../lib/format';
import { useAddVariant, useProducts, useSaveProduct, useUpdateVariant, type Product, type Variant } from '../../lib/queries';

export default function Products() {
  const products = useProducts();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [sizeFor, setSizeFor] = useState<{ product: Product; variant?: Variant } | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products.data ?? []) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [products.data]);
  const categories = groups.map(([c]) => c);

  return (
    <div>
      <PageHeader title="Products" subtitle="Changes show in the customer app immediately. Existing prepaid deliveries keep the price that was paid."
        actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" />Add product</Button>} />
      {products.isLoading ? <Spinner /> : products.isError ? <ErrorBox message={errorText(products.error)} onRetry={() => products.refetch()} /> : !groups.length ? (
        <Empty title="No products yet" action={<Button onClick={() => setEditing('new')}>Add product</Button>} />
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="mb-6">
            <h2 className="mb-2 font-display text-2xl">{categoryLabel(cat)}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((p) => (
                <Card key={p.id} className={p.isActive ? '' : 'opacity-60'}>
                  <div className="flex items-start gap-3">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-14 rounded-xl object-cover" /> : <div className="size-14 rounded-xl bg-forest-50" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{p.name}</p>
                        {!p.isActive ? <span className="rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-600">Hidden</span> : null}
                        {p.isFeatured ? <span className="rounded-full bg-lime-300 px-2 text-xs font-semibold text-forest-900">Featured</span> : null}
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-600">{p.description}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil className="size-4" /></Button>
                  </div>
                  <table className="mt-3 w-full text-sm">
                    <thead><tr className="text-left text-gray-500"><th className="py-1">Size</th><th>Price</th><th>MRP</th><th>Stock</th><th /></tr></thead>
                    <tbody>
                      {p.variants.map((v) => (
                        <tr key={v.id} className="border-t border-forest-100">
                          <td className="py-2">{v.sizeLabel}<span className="block text-xs text-gray-500">{v.name}</span></td>
                          <td className="font-semibold">{money(v.priceMinor)}</td>
                          <td className="text-gray-500">{money(v.mrpMinor)}</td>
                          <td>{v.isAvailable ? <span className="text-forest-700">In stock</span> : <span className="text-red-700">Out</span>}</td>
                          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setSizeFor({ product: p, variant: v })}>Edit</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => setSizeFor({ product: p })}><Plus className="size-4" />Add size</Button>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
      {editing ? <ProductForm product={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} /> : null}
      {sizeFor ? <SizeForm product={sizeFor.product} variant={sizeFor.variant} onClose={() => setSizeFor(null)} /> : null}
    </div>
  );
}

interface SizeRow { name: string; sizeLabel: string; price: string; mrp: string; isAvailable: boolean }
const emptySize = (): SizeRow => ({ name: '', sizeLabel: '', price: '', mrp: '', isAvailable: true });

function sizeErrors(s: SizeRow): string | null {
  const price = rupeesToPaise(s.price);
  const mrp = rupeesToPaise(s.mrp || s.price);
  if (!s.sizeLabel.trim()) return 'Enter the size, e.g. 500 ml';
  if (price === null) return 'Enter a valid price, e.g. 30 or 30.50';
  if (mrp === null) return 'Enter a valid MRP';
  if (mrp < price) return 'MRP cannot be lower than the price';
  return null;
}
const toVariant = (s: SizeRow) => ({
  name: s.name.trim() || s.sizeLabel.trim(), sizeLabel: s.sizeLabel.trim(),
  priceMinor: rupeesToPaise(s.price)!, mrpMinor: rupeesToPaise(s.mrp || s.price)!, isAvailable: s.isAvailable,
});

function ProductForm({ product, categories, onClose }: { product: Product | null; categories: string[]; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [isActive, setActive] = useState(product?.isActive ?? true);
  const [isFeatured, setFeatured] = useState(product?.isFeatured ?? false);
  const [sizes, setSizes] = useState<SizeRow[]>([emptySize()]);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveProduct();
  const toast = useToast();
  const slug = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const submit = async () => {
    if (name.trim().length < 2) return setError('Enter the product name');
    if (!/^[a-z][a-z0-9-]{1,29}$/.test(slug)) return setError('Enter a category, e.g. Milk, Curd, Ghee, Paneer');
    if (imageUrl && !/^https:\/\//.test(imageUrl)) return setError('The image link must start with https://');
    if (!product) {
      const filled = sizes.filter((s) => s.sizeLabel || s.price);
      if (!filled.length) return setError('Add at least one size with a price');
      const bad = filled.map(sizeErrors).find(Boolean);
      if (bad) return setError(bad);
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: product?.id, name: name.trim(), category: slug, description: description.trim(), imageUrl: imageUrl.trim(), isActive, isFeatured,
        ...(product ? {} : { variants: sizes.filter((s) => s.sizeLabel || s.price).map(toVariant) }),
      });
      toast('success', product ? 'Product updated' : `${name.trim()} is now in the app`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Modal open wide title={product ? `Edit ${product.name}` : 'New product'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={submit}>{product ? 'Save' : 'Add product'}</Button></>}>
      {error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-red-800">{error}</p> : null}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input label="Product name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pure Cow Ghee" maxLength={80} />
        <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} list="categories" placeholder="Milk, Curd, Ghee…"
          hint={categories.length ? `Existing: ${categories.map(categoryLabel).join(', ')}. Type a new one to create it.` : 'Type any category'} />
        <datalist id="categories">{categories.map((c) => <option key={c} value={categoryLabel(c)} />)}</datalist>
      </div>
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
      <Input label="Photo link (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" hint="Without a photo the app shows an illustration." />
      <div className="mb-4 flex flex-wrap gap-6">
        <Toggle checked={isActive} onChange={setActive} label="Show in app" />
        <Toggle checked={isFeatured} onChange={setFeatured} label="Featured on home screen" />
      </div>
      {!product ? (
        <fieldset>
          <legend className="mb-2 font-semibold">Sizes and prices</legend>
          {sizes.map((s, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_90px_90px_auto] items-end gap-2">
              <Input label="Size" value={s.sizeLabel} onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, sizeLabel: e.target.value } : x)))} placeholder="500 ml" />
              <Input label="Pack name" value={s.name} onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Pouch" />
              <Input label="Price ₹" inputMode="decimal" value={s.price} onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <Input label="MRP ₹" inputMode="decimal" value={s.mrp} onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, mrp: e.target.value } : x)))} />
              <Button variant="ghost" className="mb-4" aria-label="Remove size" disabled={sizes.length === 1} onClick={() => setSizes(sizes.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setSizes([...sizes, emptySize()])}><Plus className="size-4" />Another size</Button>
        </fieldset>
      ) : <p className="text-sm text-gray-600">Edit sizes and prices from the product card.</p>}
    </Modal>
  );
}

function SizeForm({ product, variant, onClose }: { product: Product; variant?: Variant; onClose: () => void }) {
  const [s, setS] = useState<SizeRow>(variant
    ? { name: variant.name, sizeLabel: variant.sizeLabel, price: paiseToRupees(variant.priceMinor), mrp: paiseToRupees(variant.mrpMinor), isAvailable: variant.isAvailable }
    : emptySize());
  const [error, setError] = useState<string | null>(null);
  const add = useAddVariant();
  const update = useUpdateVariant();
  const toast = useToast();
  const submit = async () => {
    const e = sizeErrors(s);
    if (e) return setError(e);
    try {
      if (variant) await update.mutateAsync({ id: variant.id, ...toVariant(s) });
      else await add.mutateAsync({ productId: product.id, ...toVariant(s) });
      toast('success', variant ? 'Size updated' : 'Size added');
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Modal open title={`${variant ? 'Edit' : 'Add'} size · ${product.name}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={add.isPending || update.isPending} onClick={submit}>Save</Button></>}>
      {error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-red-800">{error}</p> : null}
      <div className="grid grid-cols-2 gap-x-3">
        <Input label="Size" value={s.sizeLabel} onChange={(e) => setS({ ...s, sizeLabel: e.target.value })} placeholder="500 ml" />
        <Input label="Pack name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Pouch" />
        <Input label="Price ₹" inputMode="decimal" value={s.price} onChange={(e) => setS({ ...s, price: e.target.value })} />
        <Input label="MRP ₹" inputMode="decimal" value={s.mrp} onChange={(e) => setS({ ...s, mrp: e.target.value })} />
      </div>
      <Toggle checked={s.isAvailable} onChange={(v) => setS({ ...s, isAvailable: v })} label="In stock" />
      {variant ? <p className="mt-2 text-sm text-gray-600">New prices apply to new subscriptions and renewals.</p> : null}
    </Modal>
  );
}
