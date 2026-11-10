# DailyDairy Partner Dashboard

Website for **suppliers** (daily deliveries) and the **owner** (areas, suppliers, products).
Live: https://dailydairy-dashboard.prathviholla67.workers.dev

Stack: Vite 8, React 19, TypeScript, TanStack Query, React Router, Tailwind CSS 4. Data comes from the DailyDairy
Node.js + Express API (`services/api` in the main project), the same API the customer app uses.

## Who sees what

| Role | Pages |
| --- | --- |
| Supplier | Deliveries (load sheet, route list, mark out-for-delivery / delivered / failed, print), Customers, Reports |
| Owner | Everything above for all areas, plus Overview, Areas, Suppliers, Products |

Roles are stored in the database and checked by the API on every request. Suppliers only ever receive their own areas' data.

DailyDairy hosts many dairies. Each owner and supplier belongs to one dairy and only ever sees that dairy's areas,
suppliers, products and customers; the sidebar shows the dairy's name. A PIN code can belong to only one dairy, so
adding a PIN another dairy already serves is refused. If the platform suspends a dairy, its team sees a "suspended"
screen until it is reactivated. Dairies and their first owner are added in the super admin console
(`DailyDairy Super admin`).

## Sign in

Partners sign in with their mobile number. While the backend is in test mode, the code is the shared test code
(`TEST_LOGIN_CODE` in the main project's `.env`); with `VITE_TEST_LOGIN=0` it uses real SMS OTP via Supabase.

- New dairies and their owners: add them in the super admin console. To make someone an owner from the command line: `node services/api/scripts/make-owner.mjs +91XXXXXXXXXX "Name" [dairy-id]` (run in the main project).
- Add suppliers from the dashboard: Owner > Suppliers > Add supplier.

## Commands

```bash
npm install
npm run dev        # http://localhost:5174 (uses .env)
npm test           # unit + component tests
npm run build
npm run deploy     # build + deploy to Cloudflare (needs `npx wrangler login` once)
```

`.env.production` holds only public values (API URL, Supabase URL, publishable key). The API must allow this site's
origin: `EXTRA_CORS_ORIGINS` in the main project's `.env`, then `npm run cf:deploy` there.
