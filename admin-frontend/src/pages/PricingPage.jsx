import React, { useEffect, useState } from 'react';
import { ArrowRight, History, Loader2, X } from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi, gatewayApi } from '../lib/api.js';
import ActionGuard from '../components/ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

const REASONS = [
  ['REGULAR_UPDATE', 'Regular update'], ['SALE', 'Sale'], ['PROMOTION', 'Promotion'],
  ['CLEARANCE', 'Clearance'], ['FLASH_SALE', 'Flash sale'], ['CORRECTION', 'Correction'],
];
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PricingPage() {
  const { admin } = useAdminAuth();
  const canWrite = admin?.permissions?.includes('products.price.write');
  const [products, setProducts] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editing, setEditing] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState('');
  const [history, setHistory] = useState(null), [historyLoading, setHistoryLoading] = useState(false);
  const [priceGuardOpen, setPriceGuardOpen] = useState(false);

  useEffect(() => {
    gatewayApi.products().then((data) => setProducts(Array.isArray(data) ? data : [])).catch((e) => setError(toUserFacingMessage(e, { status: e?.status, code: e?.code, url: '/api/admin/pricing' }))).finally(() => setLoading(false));
  }, []);

  const savePrice = () => {
    const price = Number(editing.priceInput);
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) return setSaveError('Enter a valid price with at most two decimal places.');
    setSaveError('');
    setPriceGuardOpen(true);
  };

  const confirmPriceSave = async () => {
    if (!editing || saving) return;
    const price = Number(editing.priceInput);
    setSaving(true); setSaveError('');
    try {
      const result = await adminApi.updatePrice(editing._id, { price, reason: editing.reason });
      setProducts((current) => current.map((p) => p._id === editing._id ? { ...p, price: result.product.price } : p));
      setPriceGuardOpen(false);
      setEditing(null);
    } catch (e) {
      setSaveError(toUserFacingMessage(e, { status: e?.status, code: e?.code, url: '/api/admin/pricing' }));
    } finally {
      setSaving(false);
    }
  };

  const showHistory = async (product) => {
    setHistory({ product, entries: [] }); setHistoryLoading(true);
    try { const data = await adminApi.priceHistory(product._id); setHistory({ product: data.product, entries: data.history || [] }); }
    catch (e) { setHistory({ product, entries: [], error: toUserFacingMessage(e, { status: e?.status, code: e?.code, url: '/api/admin/pricing/history' }) }); }
    finally { setHistoryLoading(false); }
  };

  if (loading) return <LoadingState label="Loading pricing workspace…" />;
  if (error) return <ErrorState message={error} />;

  return <div className="mx-auto max-w-[1500px]">
    <ModuleHeader eyebrow="Catalog" title="Pricing" description="Manage catalog pricing with explicit reasons, server-side history and an admin audit trail." action={<ConnectedState label="Pricing service connected" />} />
    <div className="border border-creator-border bg-creator-white shadow-panel">
      <div className="flex items-center justify-between border-b border-creator-border px-5 py-4"><div className="text-sm font-semibold">Price board</div><div className="text-xs text-creator-muted">{canWrite ? 'Write access enabled' : 'Read only'}</div></div>
      <div className="divide-y divide-creator-border">
        {products.slice(0, 100).map((product) => <div key={product._id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div><div className="text-sm font-medium">{product.name}</div><div className="mt-1 text-xs text-creator-faint">{product.category}</div></div>
          <div className="flex items-center gap-3"><div className="text-sm font-semibold">{money(product.price)}</div><button type="button" onClick={() => showHistory(product)} className="inline-flex items-center gap-2 border border-creator-border px-3 py-2 text-xs">History</button>{canWrite && <button type="button" onClick={() => { setEditing({ ...product, priceInput: String(product.price ?? ''), reason: 'REGULAR_UPDATE' }); setSaveError(''); }} className="inline-flex items-center gap-2 bg-creator-black px-3 py-2 text-xs font-medium text-white">Edit price <ArrowRight size={13} /></button>}</div>
        </div>)}
      </div>
    </div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg border border-creator-border bg-creator-white shadow-2xl"><div className="flex justify-between border-b border-creator-border p-5"><div><div className="text-xs uppercase tracking-[0.14em] text-creator-muted">Update price</div><h2 className="mt-2 text-xl font-semibold">{editing.name}</h2></div><button type="button" onClick={() => setEditing(null)}><X size={20} /></button></div><div className="space-y-5 p-5"><input value={editing.priceInput} onChange={(e) => setEditing((c) => ({ ...c, priceInput: e.target.value }))} inputMode="decimal" className="w-full border border-creator-border px-3 py-3 text-sm" /><select value={editing.reason} onChange={(e) => setEditing((c) => ({ ...c, reason: e.target.value }))} className="w-full border border-creator-border px-3 py-3 text-sm">{REASONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>{saveError && <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</div>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="border border-creator-border px-4 py-2">Cancel</button><button type="button" disabled={saving} onClick={savePrice} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2 text-white">{saving && <Loader2 size={15} className="animate-spin" />}Save price</button></div></div></div></div>}
    {priceGuardOpen && editing && (
      <ActionGuard
        open
        title="Save this price change?"
        description="The new price will become the catalog price for this product."
        details={`${money(editing.price)} → ${money(Number(editing.priceInput))} · Reason: ${(REASONS.find(([value]) => value === editing.reason)?.[1] || editing.reason)}`}
        actionLabel="Save price"
        processing={saving}
        error={saveError}
        onConfirm={confirmPriceSave}
        onCancel={() => !saving && setPriceGuardOpen(false)}
      />
    )}
    {history && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-2xl border border-creator-border bg-creator-white shadow-2xl"><div className="flex justify-between border-b border-creator-border p-5"><div><div className="text-xs uppercase tracking-[0.14em] text-creator-muted">Price history</div><h2 className="mt-2 text-xl font-semibold">{history.product.name}</h2></div><button type="button" onClick={() => setHistory(null)}><X size={20} /></button></div><div className="max-h-[60vh] overflow-y-auto p-5">{historyLoading ? <LoadingState label="Loading price history…" /> : history.error ? <ErrorState message={history.error} /> : history.entries.length ? history.entries.map((e) => <div key={e._id} className="grid gap-2 border-b border-creator-border px-3 py-4 md:grid-cols-3"><div><div className="text-sm font-medium">{e.reason.replaceAll('_',' ')}</div><div className="text-xs text-creator-muted">{e.changedByEmail}</div></div><div className="text-sm text-creator-muted">{money(e.oldPrice)} → <strong className="text-creator-black">{money(e.newPrice)}</strong></div><div className="text-xs text-creator-faint">{new Date(e.effectiveAt).toLocaleString('en-IN')}</div></div>) : <div className="py-10 text-center text-sm text-creator-muted">No recorded price changes yet.</div>}</div></div></div>}
  </div>;
}
