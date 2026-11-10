import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type Role = 'customer' | 'supplier' | 'admin' | 'super_admin';
/** The dairy this owner or supplier works for (each dairy has its own areas, suppliers and products). */
export interface Dairy { id: string; name: string; status: 'active' | 'suspended' }
export interface Me { id: string; fullName: string; phone: string | null; role: Role; dairy: Dairy | null }
export interface Zone {
  id: string; name: string; postalCodes: string[]; windowStart: string; windowEnd: string; cutoffTime: string; isActive: boolean;
  activeSubscriptions: number; customers?: number; suppliers?: { id: string; name: string; phone: string }[];
}
export interface DeliveryItem { variantId: string; name: string; quantity: number }
export interface Delivery {
  id: string; subscriptionId: string; deliveryDate: string; status: string; displayStatus: string; editableByCustomer: boolean;
  totalMinor: number; instructions: string | null; deliveredAt: string | null; failureReason: string | null;
  windowStart: string; windowEnd: string; zoneId: string; zoneName: string; customerName: string; recipientName: string; phone: string;
  addressLabel: string; line1: string; line2: string; landmark: string; city: string; postalCode: string; items: DeliveryItem[];
  tags: DeliveryTag[];
}
export type DeliveryTag = 'new_customer' | 'back_from_pause' | 'last_prepaid' | 'pausing_from_tomorrow' | 'skipping_tomorrow';
export type NotTodayReason = 'paused' | 'skipped' | 'holiday' | 'renewal_due' | 'stopped';
/** A customer who normally gets a delivery on this day but must NOT get one, and why. */
export interface NotToday {
  subscriptionId: string; reason: NotTodayReason; pausedUntil: string | null; stoppedOn: string | null;
  customerName: string; recipientName: string; phone: string; line1: string; line2: string; landmark: string;
  postalCode: string; zoneId: string; zoneName: string; items: string;
}
export interface Day { date: string; prepared: number; valueMinor: number; counts: Record<string, number>; totals: DeliveryItem[]; deliveries: Delivery[]; notToday: NotToday[] }
export interface Customer {
  subscriptionId: string; status: string; frequency: string; weekdays: number[] | null; startDate: string; deliveryBalance: number;
  customerName: string; recipientName: string; phone: string; line1: string; line2: string; landmark: string; city: string; postalCode: string;
  zoneName: string; deliveryInstructions: string; items: string; nextDelivery: string | null;
}
export interface Report {
  days: { date: string; delivered: number; failed: number; skipped: number; valueMinor: number }[];
  products: { name: string; quantity: number }[];
  totals: { delivered: number; failed: number; skipped: number; valueMinor: number };
}
export interface Supplier { id: string; fullName: string; phone: string; zones: { id: string; name: string }[] }
export interface Variant { id: string; sku: string; name: string; sizeLabel: string; priceMinor: number; mrpMinor: number; isAvailable: boolean; sortOrder: number }
export interface Product {
  id: string; slug: string; name: string; description: string; category: string; imageUrl: string | null;
  isActive: boolean; isFeatured: boolean; sortOrder: number; variants: Variant[];
}

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const useMe = (enabled: boolean) => useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/me'), enabled, retry: false });
export const useMyZones = () => useQuery({ queryKey: ['zones', 'mine'], queryFn: () => api.get<Zone[]>('/supplier/zones') });
export const useDay = (date: string, zoneId?: string) =>
  useQuery({ queryKey: ['day', date, zoneId ?? 'all'], queryFn: () => api.get<Day>(`/supplier/day${qs({ date, zoneId })}`), refetchInterval: 60_000 });
export const useCustomers = (f: { zoneId?: string; status?: string; q?: string }) =>
  useQuery({ queryKey: ['customers', f], queryFn: () => api.get<Customer[]>(`/supplier/customers${qs(f)}`) });
export const useReport = (from: string, to: string, zoneId?: string) =>
  useQuery({ queryKey: ['report', from, to, zoneId ?? 'all'], queryFn: () => api.get<Report>(`/supplier/reports${qs({ from, to, zoneId })}`) });

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: 'out_for_delivery' | 'delivered' | 'failed'; reason?: string }) =>
      api.patch(`/supplier/deliveries/${v.id}/status`, { status: v.status, ...(v.reason ? { reason: v.reason } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day'] }),
  });
}
export function useBulkStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ids: string[]; status: 'out_for_delivery' | 'delivered' }) =>
      api.post<{ updated: number; results: { id: string; ok: boolean; error?: string }[] }>('/supplier/deliveries/bulk-status', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day'] }),
  });
}

// ---- owner
export const useZones = () => useQuery({ queryKey: ['zones', 'all'], queryFn: () => api.get<Zone[]>('/admin/zones') });
export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/admin/suppliers') });
export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: () => api.get<Product[]>('/admin/products') });

function useOwnerMutation<V>(fn: (v: V) => Promise<unknown>, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })) });
}
export interface ZoneInput { name: string; postalCodes: string[]; windowStart: string; windowEnd: string; cutoffTime: string; isActive: boolean }
export const useSaveZone = () =>
  useOwnerMutation((v: ZoneInput & { id?: string }) => {
    const { id, ...body } = v;
    return id ? api.patch(`/admin/zones/${id}`, { ...body }) : api.post('/admin/zones', { ...body });
  }, [['zones'], ['suppliers']]);
export const useCreateSupplier = () =>
  useOwnerMutation((v: { phone: string; fullName: string; zoneIds: string[] }) => api.post('/admin/suppliers', v), [['suppliers'], ['zones']]);
export const useUpdateSupplier = () =>
  useOwnerMutation((v: { id: string; fullName?: string; zoneIds?: string[]; active?: boolean }) => {
    const { id, ...body } = v;
    return api.patch(`/admin/suppliers/${id}`, body);
  }, [['suppliers'], ['zones']]);
export interface VariantInput { name: string; sizeLabel: string; priceMinor: number; mrpMinor: number; isAvailable: boolean; sku?: string }
export interface ProductInput { name: string; description: string; category: string; imageUrl: string; isActive: boolean; isFeatured: boolean; variants?: VariantInput[] }
export const useSaveProduct = () =>
  useOwnerMutation((v: ProductInput & { id?: string }) => {
    const { id, ...body } = v;
    const payload = { ...body, imageUrl: body.imageUrl || null };
    if (id) {
      const { variants: _v, ...rest } = payload;
      return api.patch(`/admin/products/${id}`, rest);
    }
    return api.post('/admin/products', payload);
  }, [['products']]);
export const useAddVariant = () =>
  useOwnerMutation((v: VariantInput & { productId: string }) => {
    const { productId, ...body } = v;
    return api.post(`/admin/products/${productId}/variants`, { ...body });
  }, [['products']]);
export const useUpdateVariant = () =>
  useOwnerMutation((v: Partial<VariantInput> & { id: string }) => {
    const { id, ...body } = v;
    return api.patch(`/admin/variants/${id}`, body);
  }, [['products']]);
