import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { STATUS_LABEL } from '../lib/format';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  const v: Record<Variant, string> = {
    primary: 'bg-forest-700 text-white hover:bg-forest-800',
    secondary: 'bg-white text-forest-800 border border-forest-200 hover:bg-forest-50',
    ghost: 'text-forest-800 hover:bg-forest-50',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
    success: 'bg-lime-400 text-forest-900 hover:bg-lime-300',
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4',
        v[variant],
        className,
      )}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-forest-100 bg-white p-4 shadow-[0_1px_2px_rgba(23,48,31,0.06)]', className)}>{children}</div>;
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-forest-900">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-sm text-red-700">{error}</p> : hint ? <p className="mt-1 text-sm text-gray-500">{hint}</p> : null}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-forest-200 bg-white px-3 h-11 text-base outline-none focus:border-forest-600';
export function Input({ label, error, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input id={id} aria-invalid={!!error || undefined} className={cx(inputCls, error && 'border-red-400', className)} {...rest} />
    </Field>
  );
}
export function TextArea({ label, error, hint, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <textarea id={id} aria-invalid={!!error || undefined} className={cx(inputCls, 'h-auto py-2 min-h-20', error && 'border-red-400')} {...rest} />
    </Field>
  );
}
export function Select({ label, children, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  // Inline selects (filters) size to their content; form selects fill the width.
  const base = className?.includes('w-auto') ? inputCls.replace('w-full ', '') : inputCls;
  const el = <select id={id} className={cx(base, 'pr-8', className)} {...rest}>{children}</select>;
  return label ? <Field label={label} id={id}>{el}</Field> : el;
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-forest-600 peer-focus-visible:outline-3 peer-focus-visible:outline-lime-400 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

const statusTone: Record<string, string> = {
  delivered: 'bg-forest-100 text-forest-800', active: 'bg-forest-100 text-forest-800',
  out_for_delivery: 'bg-sky-100 text-sky-800', pending: 'bg-amber-100 text-amber-800', scheduled: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-800', past_due: 'bg-red-100 text-red-800', skipped: 'bg-gray-100 text-gray-500 line-through',
  paused: 'bg-amber-100 text-amber-800', pending_payment: 'bg-amber-100 text-amber-800', cancelled: 'bg-gray-100 text-gray-500',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', statusTone[status] ?? 'bg-gray-100')}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cx('mt-1 font-display text-2xl', tone === 'good' && 'text-forest-700', tone === 'warn' && 'text-amber-700', tone === 'bad' && 'text-red-700')}>{value}</p>
    </Card>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-gray-500">
      <span className="size-5 animate-spin rounded-full border-2 border-forest-600 border-r-transparent" />
      {label}…
    </div>
  );
}
export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-forest-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-xl">{title}</p>
      {message ? <p className="mx-auto mt-1 max-w-md text-gray-600">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      <span>{message}</span>
      {onRetry ? <Button size="sm" variant="danger" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-gray-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Accessible modal dialog built on <dialog>: focus trap, Escape to close. */
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      aria-labelledby="modal-title"
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl p-0 backdrop:bg-black/40', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      <div className="flex items-center justify-between border-b border-forest-100 px-5 py-4">
        <h2 id="modal-title" className="font-display text-xl">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-forest-50"><X className="size-5" /></button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-forest-100 px-5 py-3">{footer}</div> : null}
    </dialog>
  );
}

// ---- toasts
interface Toast { id: number; tone: 'success' | 'error'; text: string }
const ToastCtx = createContext<(tone: Toast['tone'], text: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="no-print fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx('rounded-xl px-4 py-3 text-sm font-medium shadow-lg', t.tone === 'success' ? 'bg-forest-800 text-white' : 'bg-red-700 text-white')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export { cx };
