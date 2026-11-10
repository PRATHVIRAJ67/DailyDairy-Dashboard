import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarDays, LayoutDashboard, LogOut, MapPin, Package, Truck, Users, UserCog } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { session } from '../lib/session';
import type { Me } from '../lib/queries';
import { cx } from './ui';

interface Item { to: string; label: string; icon: ReactNode }

export default function Layout({ me }: { me: Me }) {
  const qc = useQueryClient();
  const owner = me.role === 'admin';
  const work: Item[] = [
    { to: '/day', label: 'Deliveries', icon: <Truck className="size-5" /> },
    { to: '/customers', label: 'Customers', icon: <Users className="size-5" /> },
    { to: '/reports', label: 'Reports', icon: <BarChart3 className="size-5" /> },
  ];
  const manage: Item[] = owner
    ? [
        { to: '/owner', label: 'Overview', icon: <LayoutDashboard className="size-5" /> },
        { to: '/owner/areas', label: 'Areas', icon: <MapPin className="size-5" /> },
        { to: '/owner/suppliers', label: 'Suppliers', icon: <UserCog className="size-5" /> },
        { to: '/owner/products', label: 'Products', icon: <Package className="size-5" /> },
      ]
    : [];
  const signOut = () => {
    session.clear();
    qc.clear();
  };
  const link = (i: Item, compact = false) => (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.to === '/owner'}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl font-medium transition-colors',
          compact ? 'flex-col gap-0.5 px-2 py-1.5 text-[11px]' : 'px-3 py-2.5',
          isActive ? 'bg-forest-700 text-white' : 'text-forest-900 hover:bg-forest-100',
        )
      }
    >
      {i.icon}
      {i.label}
    </NavLink>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-forest-100 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src="/favicon.svg" alt="" className="size-9" />
          <div>
            <p className="font-display text-xl leading-none">{me.dairy?.name ?? 'DailyDairy'}</p>
            <p className="text-xs text-gray-500">{owner ? 'Owner' : 'Supplier'} dashboard</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Daily work</p>
          {work.map((i) => link(i))}
          {manage.length ? <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Manage</p> : null}
          {manage.map((i) => link(i))}
        </nav>
        <div className="mt-auto rounded-xl bg-forest-50 p-3">
          <p className="truncate font-semibold">{me.fullName || 'Partner'}</p>
          <p className="text-sm text-gray-600">{me.phone}</p>
          <button onClick={signOut} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:underline">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-forest-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="font-display text-lg">{me.dairy?.name ?? 'DailyDairy'}</span>
        </div>
        <button onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 hover:bg-forest-50"><LogOut className="size-5" /></button>
      </header>

      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav: daily work first; owners get a second row of management links */}
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-forest-100 bg-white px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] md:hidden">
        <div className="grid grid-cols-3 gap-1">{work.map((i) => link(i, true))}</div>
        {manage.length ? <div className="mt-1 grid grid-cols-4 gap-1">{manage.map((i) => link(i, true))}</div> : null}
      </nav>
    </div>
  );
}

export const CalendarIcon = CalendarDays;
