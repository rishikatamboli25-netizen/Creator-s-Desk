import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Box, ClipboardList, IndianRupee, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import { gatewayApi } from '../lib/api.js';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';

export default function DashboardPage() {
  const { admin } = useAdminAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    gatewayApi.products()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  }, []);

  if (products === null && !error) return <LoadingState label="Loading dashboard overview…" />;
  if (error) return <ErrorState message={error} />;

  const inStock = products.filter((p) => p.inStock).length;
  const categories = new Set(products.map((p) => p.category).filter(Boolean)).size;

  const metrics = [
    { label: 'Catalog items', value: products.length.toLocaleString('en-IN'), icon: Box, detail: 'Live from Product Service', to: '/products' },
    { label: 'In-stock items', value: inStock.toLocaleString('en-IN'), icon: ShieldCheck, detail: `${products.length ? Math.round((inStock / products.length) * 100) : 0}% of catalog`, to: '/products' },
    { label: 'Categories', value: categories.toLocaleString('en-IN'), icon: Users, detail: 'Current catalog taxonomy', to: '/products' },
    { label: 'Orders', value: 'Admin API', icon: ClipboardList, detail: 'Read endpoint next', to: '/orders' },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="text-xs uppercase tracking-[0.18em] text-creator-faint">Overview</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-creator-black">Good to see you, {admin?.name?.split(' ')[0] || 'Admin'}.</h1><p className="mt-2 text-sm text-creator-muted">Your workspace is connected to live catalog data and the CD_ADMIN security layer.</p></div>
        <ConnectedState label={`${admin?.role || 'ADMIN'} access`} />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, detail, to }) => (
          <button type="button" key={label} onClick={() => navigate(to)} className="border border-creator-border bg-creator-white p-5 text-left shadow-panel transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between"><div className="text-xs uppercase tracking-[0.14em] text-creator-muted">{label}</div><Icon size={18} strokeWidth={1.7} className="text-creator-muted" /></div>
            <div className="mt-8 text-3xl font-semibold tracking-tight text-creator-black">{value}</div><div className="mt-2 text-xs text-creator-faint">{detail}</div>
          </button>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="border border-creator-border bg-creator-white p-6 shadow-panel">
          <div className="flex items-center justify-between border-b border-creator-border pb-5"><div><div className="text-xs uppercase tracking-[0.16em] text-creator-faint">Catalog pulse</div><h2 className="mt-1 text-lg font-semibold tracking-tight text-creator-black">Current product mix</h2></div><ArrowUpRight size={18} className="text-creator-muted" /></div>
          <div className="mt-6 space-y-4">
            {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).slice(0, 6).map((category) => {
              const count = products.filter((p) => p.category === category).length;
              const percentage = products.length ? Math.round((count / products.length) * 100) : 0;
              return <div key={category}><div className="flex items-center justify-between text-xs"><span className="font-medium text-creator-black">{category}</span><span className="text-creator-muted">{count}</span></div><div className="mt-2 h-1.5 bg-creator-surface"><div className="h-full bg-creator-black" style={{ width: `${Math.max(percentage, 2)}%` }} /></div></div>;
            })}
          </div>
        </div>
        <div className="border border-creator-border bg-creator-white p-6 shadow-panel">
          <div className="flex items-center gap-3"><IndianRupee size={18} /><div><div className="text-xs uppercase tracking-[0.16em] text-creator-faint">Control plane</div><h2 className="mt-1 text-lg font-semibold tracking-tight">Access context</h2></div></div>
          <div className="mt-6 space-y-3 text-sm">{(admin?.permissions || []).slice(0, 8).map((permission) => <div key={permission} className="flex items-center justify-between border-b border-creator-border pb-3"><span className="text-creator-muted">{permission}</span><span className="text-xs font-medium text-creator-black">Allowed</span></div>)}</div>
        </div>
      </section>
    </div>
  );
}
