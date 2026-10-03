import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { adminApi } from '../lib/api.js';
import ActionGuard from './ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const money = (value) =>
  Number.isFinite(Number(value))
    ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : '—';

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const rowsToCsv = (rows) => {
  const headers = ['sku', 'name', 'slug', 'category', 'price', 'quantity', 'image', 'description', 'features'];
  return [
    headers.join(','),
    ...rows.map((row) => [
      row.sku,
      row.name,
      row.slug,
      row.category,
      row.price,
      row.quantity,
      row.image,
      row.description,
      Array.isArray(row.features) ? row.features.join('|') : row.features || '',
    ].map(csvEscape).join(',')),
  ].join('\n');
};

const downloadTextFile = (filename, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const defaultForm = {
  brief: 'computer accessories and useful tech products',
  count: 10,
  category: 'Accessories',
  markupPercent: 20,
  roundTo: 50,
  quantity: 10,
  minSellingPrice: '',
  maxSellingPrice: '',
};

export default function ProductResearchModal({ open, onClose, onImported }) {
  const [step, setStep] = useState('form');
  const [form, setForm] = useState(defaultForm);
  const [products, setProducts] = useState([]);
  const [preparedRows, setPreparedRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reason, setReason] = useState('Add products researched and approved through CD_ADMIN.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importGuardOpen, setImportGuardOpen] = useState(false);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds]
  );

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setStep('form');
    setForm(defaultForm);
    setProducts([]);
    setPreparedRows([]);
    setSelectedIds(new Set());
    setReason('Add products researched and approved through CD_ADMIN.');
    setLoading(false);
    setError('');
    setNotice('');
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  if (!open) return null;

  const updateProduct = (id, key, value) => {
    setProducts((current) => current.map((product) => (
      product.id === id ? { ...product, [key]: value } : product
    )));
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(products.map((product) => product.id)));
  };

  const runResearch = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.researchCatalog({
        brief: form.brief,
        count: Number(form.count),
        category: form.category,
        markupPercent: Number(form.markupPercent),
        roundTo: Number(form.roundTo),
        quantity: Number(form.quantity),
        minSellingPrice: form.minSellingPrice === '' ? undefined : Number(form.minSellingPrice),
        maxSellingPrice: form.maxSellingPrice === '' ? undefined : Number(form.maxSellingPrice),
      });
      const researched = Array.isArray(data.products) ? data.products : [];
      setProducts(researched);
      setSelectedIds(new Set(researched.map((product) => product.id)));
      setPreparedRows([]);
      setStep('review');
      setNotice(`${researched.length} product candidates found using ${data.aiProvider || 'AI'}${data.model ? ` (${data.model})` : ''}.`);
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog/research', fallback: 'Product research is temporarily unavailable. Please try again in a moment.' }));
    } finally {
      setLoading(false);
    }
  };

  const prepareSelected = async () => {
    if (!selectedProducts.length) {
      setError('Select at least one product to prepare.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.prepareCatalogResearch(
        selectedProducts.map((product) => ({
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          category: product.category,
          price: Number(product.price),
          quantity: Number(product.quantity),
          imageUrl: product.imageUrl,
          description: product.description,
          features: product.features,
          sourceUrl: product.sourceUrl,
          sourceName: product.sourceName,
        }))
      );
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setPreparedRows(rows);
      setStep('prepared');
      setNotice(`${rows.length} approved products are ready with Cloudinary image URLs.`);
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog/research/prepare', fallback: 'We couldn’t prepare one or more product images right now. Try again or choose another image source.' }));
    } finally {
      setLoading(false);
    }
  };

  const importPrepared = () => {
    if (!preparedRows.length) {
      setError('Prepare at least one product before importing.');
      return;
    }
    if (!reason.trim()) {
      setError('Enter a reason for this catalog import.');
      return;
    }
    setError('');
    setImportGuardOpen(true);
  };

  const executeImportPrepared = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await adminApi.bulkImportCatalog(preparedRows, reason.trim());
      setNotice(`${result.createdCount || 0} catalog products imported successfully.`);
      setImportGuardOpen(false);
      onImported?.(result);
      setStep('complete');
      return true;
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog/bulk-import', fallback: 'We couldn’t import the researched products right now. Please review the prepared rows and try again.' }));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const downloadPreparedCsv = () => {
    if (!preparedRows.length) return;
    downloadTextFile('cd-admin-researched-products.csv', rowsToCsv(preparedRows));
  };

  const changeStepBack = () => {
    setError('');
    setNotice('');
    if (step === 'prepared') {
      setStep('review');
      return;
    }
    if (step === 'review') {
      setStep('form');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden border border-creator-border bg-creator-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-creator-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-creator-muted">
              <Sparkles size={14} /> Catalog Researcher
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-creator-black">Find, prepare and import products</h2>
          </div>
          <button type="button" onClick={close} className="rounded-md border border-creator-border p-2 text-creator-muted hover:bg-creator-surface" title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="border-b border-creator-border bg-creator-surface px-5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {['form', 'review', 'prepared', 'complete'].map((item, index) => {
              const activeIndex = ['form', 'review', 'prepared', 'complete'].indexOf(step);
              const complete = index < activeIndex;
              const active = item === step;
              return (
                <React.Fragment key={item}>
                  {index > 0 && <span className="text-creator-faint">/</span>}
                  <span className={active ? 'text-creator-black' : complete ? 'text-creator-muted' : 'text-creator-faint'}>
                    {complete ? <Check size={12} className="mr-1 inline" /> : null}
                    {item === 'form' ? 'Research' : item === 'review' ? 'Review' : item === 'prepared' ? 'Prepare images' : 'Imported'}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 'form' && (
            <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.13em] text-creator-muted">What are you looking for?</div>
                  <textarea
                    value={form.brief}
                    onChange={(event) => setField('brief', event.target.value)}
                    rows={4}
                    placeholder="Example: mechanical keyboards, USB-C hubs, Wi-Fi adapters, webcams"
                    className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Products</span>
                    <input value={form.count} min="1" max="30" type="number" onChange={(event) => setField('count', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Catalog category</span>
                    <input value={form.category} onChange={(event) => setField('category', event.target.value)} placeholder="Accessories" className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Markup %</span>
                    <input value={form.markupPercent} min="0" max="500" type="number" onChange={(event) => setField('markupPercent', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Price round-to</span>
                    <input value={form.roundTo} min="0" type="number" onChange={(event) => setField('roundTo', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Opening quantity</span>
                    <input value={form.quantity} min="0" type="number" onChange={(event) => setField('quantity', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Min selling price</span>
                    <input value={form.minSellingPrice} min="0" type="number" placeholder="Any" onChange={(event) => setField('minSellingPrice', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Max selling price</span>
                    <input value={form.maxSellingPrice} min="0" type="number" placeholder="Any" onChange={(event) => setField('maxSellingPrice', event.target.value)} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  </label>
                </div>
              </div>

              <div className="border border-creator-border bg-creator-surface p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><Search size={15} /> How this works</div>
                <div className="mt-4 space-y-4 text-xs leading-5 text-creator-muted">
                  <div><strong className="text-creator-black">1. Search:</strong> Google Shopping results are gathered for India and de-duplicated.</div>
                  <div><strong className="text-creator-black">2. Write:</strong> Groq GPT-OSS 120B normalizes names, categories, descriptions and evidence-backed features.</div>
                  <div><strong className="text-creator-black">3. Price:</strong> your markup rule turns the reference price into a suggested selling price.</div>
                  <div><strong className="text-creator-black">4. Review:</strong> edit or reject anything you do not want.</div>
                  <div><strong className="text-creator-black">5. Prepare:</strong> approved images are fetched through Cloudinary, producing the final catalog image URL.</div>
                  <div><strong className="text-creator-black">6. Import:</strong> the existing audited bulk-import endpoint creates the products.</div>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border border-creator-border bg-creator-surface px-4 py-3">
                <div className="text-xs text-creator-muted"><strong className="text-creator-black">{selectedProducts.length}</strong> of {products.length} selected</div>
                <button type="button" onClick={toggleAll} className="text-xs font-semibold text-creator-black underline underline-offset-4">{selectedIds.size === products.length ? 'Clear all' : 'Select all'}</button>
              </div>

              <div className="overflow-x-auto border border-creator-border">
                <table className="min-w-[1280px] w-full text-left">
                  <thead className="border-b border-creator-border bg-creator-surface text-[10px] uppercase tracking-[0.12em] text-creator-muted">
                    <tr>
                      <th className="w-10 px-3 py-3" />
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Reference</th>
                      <th className="px-3 py-3">Selling price</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Description / features</th>
                      <th className="px-3 py-3">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-creator-border align-top">
                    {products.map((product) => (
                      <tr key={product.id} className={selectedIds.has(product.id) ? 'bg-creator-white' : 'bg-creator-surface/30'}>
                        <td className="px-3 py-4">
                          <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelected(product.id)} className="h-4 w-4" />
                        </td>
                        <td className="w-[300px] px-3 py-4">
                          <div className="flex gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden border border-creator-border bg-creator-surface">
                              {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={18} className="m-5 text-creator-faint" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <input value={product.name} onChange={(event) => updateProduct(product.id, 'name', event.target.value)} className="w-full border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-creator-black" />
                              <div className="mt-1 text-[10px] text-creator-faint">{product.sku}</div>
                              {product.warnings?.length ? <div className="mt-2 text-[10px] leading-4 text-amber-700">{product.warnings.join(' ')}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="w-[150px] px-3 py-4">
                          <input value={product.category} onChange={(event) => updateProduct(product.id, 'category', event.target.value)} className="w-full border border-creator-border px-2 py-2 text-xs outline-none focus:border-creator-black" />
                        </td>
                        <td className="w-[110px] px-3 py-4 text-sm font-semibold">{money(product.referencePriceInr)}</td>
                        <td className="w-[130px] px-3 py-4">
                          <input value={product.price ?? ''} type="number" min="1" onChange={(event) => updateProduct(product.id, 'price', event.target.value)} className="w-full border border-creator-border px-2 py-2 text-xs outline-none focus:border-creator-black" />
                        </td>
                        <td className="w-[90px] px-3 py-4">
                          <input value={product.quantity ?? 0} type="number" min="0" onChange={(event) => updateProduct(product.id, 'quantity', event.target.value)} className="w-full border border-creator-border px-2 py-2 text-xs outline-none focus:border-creator-black" />
                        </td>
                        <td className="w-[420px] px-3 py-4">
                          <textarea value={product.description} onChange={(event) => updateProduct(product.id, 'description', event.target.value)} rows={3} className="w-full border border-creator-border px-2 py-2 text-xs leading-5 outline-none focus:border-creator-black" />
                          <input value={(product.features || []).join(', ')} onChange={(event) => updateProduct(product.id, 'features', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} className="mt-2 w-full border border-creator-border px-2 py-2 text-xs outline-none focus:border-creator-black" placeholder="Feature one, Feature two" />
                        </td>
                        <td className="w-[160px] px-3 py-4">
                          {product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-creator-black underline underline-offset-4"><ExternalLink size={12} /> {product.sourceName || 'View source'}</a> : <span className="text-xs text-creator-faint">No source</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'prepared' && (
            <div className="space-y-5 p-5">
              <div className="border border-creator-border bg-creator-surface px-4 py-4 text-sm text-creator-muted">
                Images have been transferred to Cloudinary. The rows below are now in the same shape your existing catalog bulk importer accepts.
              </div>
              <div className="overflow-x-auto border border-creator-border">
                <table className="min-w-[1050px] w-full text-left">
                  <thead className="border-b border-creator-border bg-creator-surface text-[10px] uppercase tracking-[0.12em] text-creator-muted"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Cloudinary image</th></tr></thead>
                  <tbody className="divide-y divide-creator-border">
                    {preparedRows.map((row) => (
                      <tr key={row.sku}>
                        <td className="px-3 py-4"><div className="text-sm font-semibold">{row.name}</div><div className="mt-1 text-[10px] text-creator-faint">{row.sku}</div></td>
                        <td className="px-3 py-4 text-xs">{row.category}</td>
                        <td className="px-3 py-4 text-sm font-semibold">{money(row.price)}</td>
                        <td className="px-3 py-4 text-xs">{row.quantity}</td>
                        <td className="px-3 py-4"><a href={row.image} target="_blank" rel="noreferrer" className="max-w-[500px] truncate text-xs font-medium text-creator-black underline underline-offset-4">{row.image}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <div className="border border-creator-border p-4 text-xs leading-5 text-creator-muted">
                  <strong className="text-creator-black">Before import:</strong> download the CSV as a backup if you want a portable copy. The actual import remains protected by your existing `products.bulk.create` permission and backend audit trail.
                </div>
                <div className="border border-creator-border p-4">
                  <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Import reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex min-h-[420px] items-center justify-center p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-creator-border bg-creator-surface"><Check size={22} /></div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">Research import complete</h3>
                <p className="mt-3 text-sm leading-6 text-creator-muted">The approved product rows were handed to the existing catalog bulk-import endpoint.</p>
              </div>
            </div>
          )}

          {error && <div className="mx-5 mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <div className="mx-5 mb-5 border border-creator-border bg-creator-surface px-4 py-3 text-sm text-creator-black">{notice}</div>}

          <ActionGuard
            open={importGuardOpen}
            title={`Import ${preparedRows.length} approved products?`}
            description="This will create the reviewed rows in the live catalog through the audited bulk-import endpoint."
            details={`Import reason: ${reason.trim()}`}
            actionLabel="Import approved products"
            processing={loading}
            error={error}
            onConfirm={executeImportPrepared}
            onCancel={() => !loading && setImportGuardOpen(false)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-creator-border bg-creator-white px-5 py-4">
          <div className="text-[11px] text-creator-faint">
            {step === 'form' ? 'Research uses Google Shopping + Groq GPT-OSS 120B.' : step === 'review' ? `${selectedProducts.length} selected for image preparation.` : step === 'prepared' ? `${preparedRows.length} rows ready for import.` : 'Catalog refreshed after import.'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step !== 'form' && step !== 'complete' && <button type="button" disabled={loading} onClick={changeStepBack} className="border border-creator-border px-4 py-2.5 text-sm">Back</button>}
            {step === 'form' && <button type="button" disabled={loading || !form.brief.trim()} onClick={runResearch} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Research products</button>}
            {step === 'review' && <button type="button" disabled={loading || !selectedProducts.length} onClick={prepareSelected} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Prepare selected images</button>}
            {step === 'prepared' && <><button type="button" onClick={downloadPreparedCsv} className="inline-flex items-center gap-2 border border-creator-border px-4 py-2.5 text-sm font-semibold"><Download size={15} /> Download CSV</button><button type="button" disabled={loading || !preparedRows.length || !reason.trim()} onClick={importPrepared} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Import approved products</button></>}
            {step === 'complete' && <button type="button" onClick={close} className="bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white">Done</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
