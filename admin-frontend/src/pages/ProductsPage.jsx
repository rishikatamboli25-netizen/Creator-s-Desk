import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, PackageOpen, CheckCircle2, XCircle } from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { gatewayApi } from '../lib/api.js';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    gatewayApi.products()
      .then((data) => {
        if (active) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText = !q || [product.name, product.slug, product.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
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
        description="Live catalog visibility from the existing Product Service. Product editing and pricing writes will be routed through the Admin Backend in the next integration slice."
        action={<ConnectedState label={`${products.length} catalog items`} />}
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug or category" className="h-11 w-full border border-creator-border bg-creator-white pl-9 pr-4 text-sm outline-none focus:border-creator-black" />
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
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-creator-border bg-creator-surface">
              <tr className="text-[10px] uppercase tracking-[0.15em] text-creator-muted">
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Stock</th>
                <th className="px-5 py-3.5">Updated</th>
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
                        <div className="truncate text-sm font-semibold text-creator-black">{product.name}</div>
                        <div className="mt-1 truncate text-xs text-creator-faint">/{product.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-creator-muted">{product.category}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-creator-black">₹{Number(product.price || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4">
                    {product.inStock ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-creator-black"><CheckCircle2 size={14} /> In stock</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-creator-muted"><XCircle size={14} /> Out of stock</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-creator-muted">{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="px-6 py-14 text-center text-sm text-creator-muted">No products match the current filters.</div>}
      </div>
    </div>
  );
}
