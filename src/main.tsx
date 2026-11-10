import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, lazy, Suspense, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import Layout from './components/Layout';
import { Button, Spinner, ToastProvider } from './components/ui';
import { ApiError } from './lib/api';
import { useMe, type Me } from './lib/queries';
import { session } from './lib/session';
import Login from './pages/Login';
import './index.css';

// Pages load on demand so the first screen is small and fast.
const Day = lazy(() => import('./pages/supplier/Day'));
const Customers = lazy(() => import('./pages/supplier/Customers'));
const Reports = lazy(() => import('./pages/supplier/Reports'));
const Overview = lazy(() => import('./pages/owner/Overview'));
const Areas = lazy(() => import('./pages/owner/Areas'));
const Suppliers = lazy(() => import('./pages/owner/Suppliers'));
const Products = lazy(() => import('./pages/owner/Products'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

const page = (el: ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;

function Routes({ me }: { me: Me }) {
  const owner = me.role === 'admin';
  // Built once per role; owners get the management pages, suppliers never see their routes.
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: '/',
          element: <Layout me={me} />,
          children: [
            { index: true, element: <Navigate to={owner ? '/owner' : '/day'} replace /> },
            { path: 'day', element: page(<Day />) },
            { path: 'customers', element: page(<Customers />) },
            { path: 'reports', element: page(<Reports />) },
            ...(owner
              ? [
                  { path: 'owner', element: page(<Overview />) },
                  { path: 'owner/areas', element: page(<Areas />) },
                  { path: 'owner/suppliers', element: page(<Suppliers />) },
                  { path: 'owner/products', element: page(<Products />) },
                ]
              : []),
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, me.id],
  );
  return <RouterProvider router={router} />;
}

function App() {
  const s = useSyncExternalStore(session.subscribe, session.get, () => null);
  const me = useMe(!!s);
  // Signing out (or an expired session) must never leave the previous partner's data in memory.
  useEffect(() => {
    if (!s) queryClient.clear();
  }, [s]);
  if (!s) return <Login />;
  if (me.isLoading) return <Spinner label="Signing in" />;
  if (me.isError || !me.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p>We could not load your account.</p>
        <Button onClick={() => session.clear()}>Sign in again</Button>
      </div>
    );
  }
  const signOut = () => { session.clear(); queryClient.clear(); };
  if (me.data.role === 'customer' || me.data.role === 'super_admin') {
    return (
      <Notice title={me.data.role === 'super_admin' ? 'Platform admins use the super admin console' : 'This number is not a partner account'}>
        {me.data.role === 'super_admin'
          ? `${me.data.phone} is a platform admin. This dashboard is for dairy owners and suppliers.`
          : `${me.data.phone} is registered as a customer. Ask your dairy's owner to add you as a supplier, then sign in again.`}
        <Button onClick={signOut}>Use a different number</Button>
      </Notice>
    );
  }
  if (me.data.dairy?.status === 'suspended') {
    return (
      <Notice title={`${me.data.dairy.name} is suspended`}>
        Your dairy's account is on hold, so deliveries and settings cannot be managed right now. Contact DailyDairy support to restore access.
        <Button onClick={signOut}>Sign out</Button>
      </Notice>
    );
  }
  return <Routes me={me.data} />;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-2xl">{title}</p>
      <div className="flex max-w-md flex-col items-center gap-4 text-gray-600">{children}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
