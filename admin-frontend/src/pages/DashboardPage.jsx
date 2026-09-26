import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { adminApi, gatewayApi } from '../lib/api.js';
import { ErrorState, LoadingState } from '../components/ModuleState.jsx';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const cardClass = 'border border-creator-border bg-creator-white p-5 shadow-panel';

export default function DashboardPage() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    error: '',
    products: [],
    orders: null,
    invoices: null,
    audit: null,
    admins: null,
  });

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      gatewayApi.products(),
      adminApi.orders({ page: 1, limit: 50 }),
      adminApi.invoices({ page: 1, limit: 50 }),
      adminApi.auditLogs({ page: 1, limit: 5, outcome: 'FAILED' }),
      adminApi.adminUsers(),
    ]).then((results) => {
      if (!active) return;

      const [products, orders, invoices, audit, admins] = results;
      const fatal = [products, orders, invoices, audit, admins].every((item) => item.status === 'rejected');

      setState({
        loading: false,
        error: fatal ? 'Unable to load the admin dashboard.' : '',
        products: products.status === 'fulfilled' && Array.isArray(products.value) ? products.value : [],
        orders: orders.status === 'fulfilled' ? orders.value : null,
        invoices: invoices.status === 'fulfilled' ? invoices.value : null,
        audit: audit.status === 'fulfilled' ? audit.value : null,
        admins: admins.status === 'fulfilled' ? admins.value : null,
      });
    });

    return () => { active = false; };
  }, []);

  const computed = useMemo(() => {
    const products = state.products;
    const orders = Array.isArray(state.orders?.orders) ? state.orders.orders : [];
    const inStock = products.filter((item) => item.inStock).length;
    const categories = new Set(products.map((item) => item.category).filter(Boolean));
    const recentOrderValue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const paymentMix = orders.reduce((map, order) => {
      const key = String(order.paymentMethod || 'Unknown').toUpperCase();
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});
    const activeAdmins = (state.admins?.users || []).filter((item) => item.status === 'ACTIVE').length;
    const outOfStock = products.length - inStock;

    return { products, orders, inStock, categories, recentOrderValue, paymentMix, activeAdmins, outOfStock };
  }, [state]);

  if (state.loading) return <LoadingState label="Loading operational dashboard…" />;
  if (state.error) return <ErrorState message={state.error} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-creator-faint">Operations overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-creator-black">Good to see you, {admin?.name?.split(' ')[0] || 'Admin'}.</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-creator-muted">Live operational signals across catalog, orders, invoices, administrator security and payment mix.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-creator-border bg-creator-white px-3 py-2 text-xs font-semibold text-creator-black">
          <CheckCircle2 size={14} /> {admin?.role || 'ADMIN'} access
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Orders', value: state.orders?.pagination?.total ?? '—', detail: 'Total orders', icon: ClipboardList, to: '/orders' },
          { label: 'Recent order value', value: money(computed.recentOrderValue), detail: `${computed.orders.length} most recent loaded`, icon: WalletCards, to: '/orders' },
          { label: 'Invoices', value: state.invoices?.summary?.generated ?? '—', detail: 'Generated invoices', icon: FileText, to: '/invoices' },
          { label: 'Catalog', value: computed.products.length, detail: `${computed.inStock} in stock · ${computed.categories.size} categories`, icon: Box, to: '/catalog' },
          { label: 'Active admins', value: computed.activeAdmins, detail: 'Current active accounts', icon: Users, to: '/admin-users' },
        ].map(({ label, value, detail, icon: Icon, to }) => (
          <button key={label} type="button" onClick={() => navigate(to)} className={`${cardClass} text-left transition hover:-translate-y-0.5 hover:shadow-lg`}>
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-muted">{label}</div>
              <Icon size={17} className="text-creator-muted" />
            </div>
            <div className="mt-7 text-2xl font-semibold tracking-tight text-creator-black">{String(value).replace(/^undefined$/, '—')}</div>
            <div className="mt-2 text-xs text-creator-faint">{detail}</div>
          </button>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className={cardClass}>
          <div className="flex items-center justify-between border-b border-creator-border pb-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Operational health</div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-creator-black">What needs attention</h2>
            </div>
            <ArrowUpRight size={17} className="text-creator-muted" />
          </div>
          <div className="mt-5 space-y-3">
            <button type="button" onClick={() => navigate('/audit-log')} className="flex w-full items-center justify-between border border-creator-border px-4 py-4 text-left hover:bg-creator-surface">
              <div className="flex items-center gap-3"><AlertTriangle size={17} /><div><div className="text-sm font-semibold text-creator-black">Failed admin actions</div><div className="mt-1 text-xs text-creator-muted">Recent security or operational failures</div></div></div>
              <span className="text-sm font-semibold text-creator-black">{state.audit?.summary?.failed ?? 0}</span>
            </button>
            <button type="button" onClick={() => navigate('/invoices')} className="flex w-full items-center justify-between border border-creator-border px-4 py-4 text-left hover:bg-creator-surface">
              <div className="flex items-center gap-3"><FileText size={17} /><div><div className="text-sm font-semibold text-creator-black">Pending invoices</div><div className="mt-1 text-xs text-creator-muted">Invoices awaiting generation or completion</div></div></div>
              <span className="text-sm font-semibold text-creator-black">{state.invoices?.summary?.pending ?? 0}</span>
            </button>
            <button type="button" onClick={() => navigate('/catalog')} className="flex w-full items-center justify-between border border-creator-border px-4 py-4 text-left hover:bg-creator-surface">
              <div className="flex items-center gap-3"><Box size={17} /><div><div className="text-sm font-semibold text-creator-black">Out-of-stock catalog items</div><div className="mt-1 text-xs text-creator-muted">Current product availability signal</div></div></div>
              <span className="text-sm font-semibold text-creator-black">{computed.outOfStock}</span>
            </button>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-3"><ShieldCheck size={18} /><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Payment operations</div><h2 className="mt-2 text-lg font-semibold tracking-tight text-creator-black">Payment mix in recent orders</h2></div></div>
          <div className="mt-6 space-y-4">
            {Object.entries(computed.paymentMix).length ? Object.entries(computed.paymentMix).map(([method, count]) => {
              const percentage = computed.orders.length ? Math.round((count / computed.orders.length) * 100) : 0;
              return <div key={method}><div className="flex items-center justify-between text-xs"><span className="font-medium text-creator-black">{method}</span><span className="text-creator-muted">{count} · {percentage}%</span></div><div className="mt-2 h-1.5 bg-creator-surface"><div className="h-full bg-creator-black" style={{ width: `${Math.max(percentage, 2)}%` }} /></div></div>;
            }) : <div className="border border-creator-border bg-creator-surface px-4 py-4 text-sm text-creator-muted">No recent payment mix data is available.</div>}
          </div>
          <button type="button" onClick={() => navigate('/payments')} className="mt-6 text-xs font-semibold text-creator-black underline underline-offset-4">Open Payments & Refunds</button>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Invoice operations</div><h2 className="mt-2 text-lg font-semibold tracking-tight text-creator-black">Generation status</h2></div><button type="button" onClick={() => navigate('/invoices')} className="text-xs font-semibold text-creator-black underline underline-offset-4">View invoices</button></div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[['Generated', state.invoices?.summary?.generated ?? 0], ['Pending', state.invoices?.summary?.pending ?? 0], ['Missing', state.invoices?.summary?.notGenerated ?? 0]].map(([label, value]) => <div key={label} className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-creator-faint">{label}</div><div className="mt-3 text-xl font-semibold text-creator-black">{value}</div></div>)}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Security posture</div><h2 className="mt-2 text-lg font-semibold tracking-tight text-creator-black">Admin control plane</h2></div><button type="button" onClick={() => navigate('/settings')} className="text-xs font-semibold text-creator-black underline underline-offset-4">Open settings</button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['Server-side RBAC', 'Enabled'],
              ['Audit trail', 'Enabled'],
              ['MFA coverage', `${(state.admins?.users || []).filter((item) => item.mfaEnabled).length} / ${(state.admins?.users || []).length || 0} admins`],
              ['Session control', 'Managed'],
            ].map(([label, value]) => <div key={label} className="flex items-center justify-between border border-creator-border px-4 py-4"><span className="text-sm text-creator-black">{label}</span><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-creator-black">{value}</span></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
