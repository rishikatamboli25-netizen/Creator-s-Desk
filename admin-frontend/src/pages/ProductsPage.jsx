import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, PackageOpen, Search, SlidersHorizontal, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { gatewayApi } from '../lib/api.js';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    gatewayApi.products()
      .then((data) => {
        if (active) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => active && setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/products' })))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText = !q || [product.name, product.slug, product.category, product.sku, product._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      const matchesStock = stock === 'all' || (stock === 'in' ? product.inStock : !product.inStock);
      return matchesText && matchesStock;
    });
  }, [products, search, stock]);

  if (loading) return <LoadingState label="Loading product catalog…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Catalog"
        title="Products"
        description="Live product visibility with safe operational detail. Product writes remain owned by the Product Service and pricing actions remain in Pricing."
        action={<ConnectedState label={`${products.length} catalog items`} />}
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug, SKU or category" className="h-11 w-full border border-creator-border bg-creator-white pl-9 pr-4 text-sm outline-none focus:border-creator-black" />
        </div>
        <div className="relative w-full md:w-48">
          <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
          <select value={stock} onChange={(e) => setStock(e.target.value)} className="h-11 w-full appearance-none border border-creator-border bg-creator-white pl-9 pr-4 text-sm outline-none focus:border-creator-black">
            <option value="all">All stock states</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left">
            <thead className="border-b border-creator-border bg-creator-surface">
              <tr className="text-[10px] uppercase tracking-[0.15em] text-creator-muted">
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Updated</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creator-border">
              {filtered.map((product) => (
                <tr key={product._id} className="hover:bg-creator-surface/60">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden border border-creator-border bg-creator-surface">
                        {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <PackageOpen size={18} className="m-3 text-creator-faint" />}
                      </div>
                      <div className="min-w-0">
                        <button type="button" onClick={() => setSelected(product)} className="truncate text-left text-sm font-semibold text-creator-black hover:underline hover:underline-offset-4">{product.name}</button>
                        <div className="mt-1 truncate text-xs text-creator-faint">/{product.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-creator-muted">{product.category || '—'}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-creator-black">₹{Number(product.price || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4">
                    {product.inStock ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-creator-black"><CheckCircle2 size={14} /> In stock</span> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-creator-muted"><XCircle size={14} /> Out of stock</span>}
                  </td>
                  <td className="px-5 py-4 text-xs text-creator-muted">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-5 py-4"><button type="button" onClick={() => setSelected(product)} className="inline-flex items-center gap-1.5 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface">View <ArrowUpRight size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="px-6 py-14 text-center text-sm text-creator-muted">No products match the current filters.</div>}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onMouseDown={() => setSelected(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-creator-border bg-creator-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-creator-border pb-5">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Product detail</div><h2 className="mt-2 text-xl font-semibold tracking-tight text-creator-black">{selected.name}</h2><div className="mt-1 text-xs text-creator-muted">{selected.slug || selected._id}</div></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-creator-border p-2 text-creator-muted hover:bg-creator-surface"><X size={16} /></button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Product ID', selected._id],
                ['SKU', selected.sku],
                ['Category', selected.category],
                ['Price', `₹${Number(selected.price || 0).toLocaleString('en-IN')}`],
                ['Stock state', selected.inStock ? 'In stock' : 'Out of stock'],
                ['Updated', formatDate(selected.updatedAt)],
              ].map(([label, value]) => <div key={label} className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">{label}</div><div className="mt-2 break-words text-sm font-medium text-creator-black">{value || '—'}</div></div>)}
            </div>

            {selected.description ? <div className="mt-5 border border-creator-border p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Description</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-creator-muted">{selected.description}</p></div> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setSelected(null); navigate('/pricing'); }} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-semibold text-creator-black hover:bg-creator-surface">Open pricing</button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white">Close</button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
