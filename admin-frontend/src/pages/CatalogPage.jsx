import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FilePlus2,
  History,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import ActionGuard from '../components/ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
};

const EMPTY_FORM = {
  sku: '',
  name: '',
  slug: '',
  category: '',
  price: '',
  quantity: '',
  image: '',
  description: '',
  features: '',
  reason: '',
};

const csvParse = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
  if (rows.length < 2) throw new Error('CSV must include a header row and at least one product row.');

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const required = ['sku', 'name', 'category', 'price', 'quantity', 'image', 'description'];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`);

  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => { record[header] = (values[index] || '').trim(); });
    return {
      sku: record.sku,
      name: record.name,
      slug: record.slug || '',
      category: record.category,
      price: record.price,
      quantity: record.quantity,
      image: record.image,
      description: record.description,
      features: record.features ? record.features.split('|').map((item) => item.trim()).filter(Boolean) : [],
    };
  });
};

const csvTemplate = [
  'sku,name,slug,category,price,quantity,image,description,features',
  'CD-EXAMPLE-001,Example Product,example-product,Accessories,99.00,25,https://example.com/product.jpg,Example product description.,Feature one|Feature two',
].join('\n');

export default function CatalogPage() {
  const { admin } = useAdminAuth();
  const canWrite = admin?.permissions?.includes('products.write');
  const canStock = admin?.permissions?.includes('products.stock.write');
  const canAvailability = admin?.permissions?.includes('products.availability.write');
  const canBulk = admin?.permissions?.includes('products.bulk.create');

  const [products, setProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [stockState, setStockState] = useState('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [availabilityReason, setAvailabilityReason] = useState('');
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkName, setBulkName] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [guard, setGuard] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.catalog({ page, limit: 20, search, stockState, category });
      setProducts(Array.isArray(data.products) ? data.products : []);
      setAvailableCategories(Array.isArray(data.categories) ? data.categories : []);
      setPagination(data.pagination || { page, pages: 1, total: 0, limit: 20 });
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' }));
    } finally {
      setLoading(false);
    }
  }, [page, search, stockState, category]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const categories = useMemo(() => {
    const values = new Set([
      ...availableCategories,
      ...products.map((product) => product.category).filter(Boolean),
    ]);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [availableCategories, products]);

  const closeOverlays = () => {
    setSelected(null);
    setHistory(null);
    setAddOpen(false);
    setEditOpen(false);
    setStockOpen(false);
    setBulkOpen(false);
    setActionMessage('');
    setActionError('');
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setActionMessage('');
    setActionError('');
    setAddOpen(true);
  };

  const openEdit = (product) => {
    setForm({
      sku: product.sku || '',
      name: product.name || '',
      slug: product.slug || '',
      category: product.category || '',
      price: String(product.price ?? ''),
      quantity: String(product.quantity ?? 0),
      image: product.image || '',
      description: product.description || '',
      features: Array.isArray(product.features) ? product.features.join(', ') : '',
      reason: '',
    });
    setActionMessage('');
    setActionError('');
    setEditOpen(true);
  };

  const saveNewProduct = async () => {
    setSaving(true); setActionError(''); setActionMessage('');
    try {
      const data = await adminApi.createCatalogProduct({
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        features: String(form.features || '').split(',').map((item) => item.trim()).filter(Boolean),
      });
      setActionMessage(`Catalog product “${data.product?.name || form.name}” created successfully.`);
      setAddOpen(false);
      await loadCatalog();
    } catch (err) { setActionError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' })); } finally { setSaving(false); }
  };

  const saveEditedProduct = async () => {
    setSaving(true); setActionError(''); setActionMessage('');
    try {
      await adminApi.updateCatalogProduct(selected._id, {
        name: form.name,
        slug: form.slug,
        category: form.category,
        image: form.image,
        description: form.description,
        features: String(form.features || '').split(',').map((item) => item.trim()).filter(Boolean),
        reason: form.reason,
      });
      setActionMessage('Catalog details updated successfully.');
      setEditOpen(false);
      const data = await adminApi.catalog({ page, limit: 20, search, stockState, category });
      setProducts(Array.isArray(data.products) ? data.products : []);
      setAvailableCategories(Array.isArray(data.categories) ? data.categories : []);
      setSelected((data.products || []).find((item) => item._id === selected._id) || null);
    } catch (err) { setActionError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' })); } finally { setSaving(false); }
  };

  const applyStockAdjustment = () => {
    const delta = Number(stockDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      setActionError('Enter a non-zero whole-number stock adjustment.');
      return;
    }
    setActionError('');
    setGuard({
      variant: 'confirm',
      title: 'Apply this stock adjustment?',
      description: 'This changes the physical stock quantity in the catalog.',
      details: `${selected?.name || 'Product'} · ${delta > 0 ? '+' : ''}${delta} units · Reason: ${stockReason.trim() || 'Not provided'}`,
      actionLabel: 'Apply adjustment',
      execute: () => executeStockAdjustment(delta),
    });
  };

  const executeStockAdjustment = async (delta) => {
    setSaving(true); setActionError(''); setActionMessage('');
    try {
      const data = await adminApi.adjustCatalogStock(selected._id, delta, stockReason);
      setActionMessage(`Stock updated to ${data.product?.quantity ?? 0} units.`);
      setStockOpen(false);
      setSelected(data.product);
      await loadCatalog();
      setGuard(null);
      return true;
    } catch (err) {
      setActionError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setAvailability = (available) => {
    setActionError('');
    setGuard({
      variant: 'confirm',
      title: available ? 'Mark product available?' : 'Mark product out of stock?',
      description: available
        ? 'This clears the manual out-of-stock override. The product still needs positive quantity to be available.'
        : 'This manually blocks the product from being available without changing its physical quantity.',
      details: `${selected?.name || 'Product'} · Reason: ${availabilityReason.trim() || 'Not provided'}`,
      actionLabel: available ? 'Mark available' : 'Mark out of stock',
      execute: () => executeAvailabilityChange(available),
    });
  };

  const executeAvailabilityChange = async (available) => {
    setSaving(true); setActionError(''); setActionMessage('');
    try {
      const data = await adminApi.setCatalogAvailability(selected._id, available, availabilityReason);
      setActionMessage(available ? 'Product marked available.' : 'Product marked manually out of stock.');
      setAvailabilityReason('');
      setSelected(data.product);
      await loadCatalog();
      setGuard(null);
      return true;
    } catch (err) {
      setActionError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (product) => {
    setHistory({ product, entries: [] });
    setHistoryLoading(true);
    try {
      const data = await adminApi.catalogInventoryHistory(product._id);
      setHistory({ product: data.product, entries: data.history || [] });
    } catch (err) {
      setHistory({ product, entries: [], error: toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog/:id/inventory-history' }) });
    } finally { setHistoryLoading(false); }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'creators-desk-catalog-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkError('');
    setBulkName(file.name);
    try {
      const rows = csvParse(await file.text());
      if (rows.length > 500) throw new Error('Bulk import is limited to 500 products per operation.');
      setBulkRows(rows);
    } catch (err) {
      setBulkRows([]);
      setBulkError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' }));
    }
  };

  const runBulkImport = () => {
    if (!bulkRows.length) return setBulkError('Upload a valid CSV file first.');
    if (!bulkReason.trim()) return setBulkError('Enter a reason for this import.');
    setBulkError('');
    setGuard({
      variant: 'confirm',
      title: `Import ${bulkRows.length} catalog products?`,
      description: 'The approved rows will be sent to the catalog bulk-import endpoint and recorded in the audit trail.',
      details: `File: ${bulkName || 'CSV'} · ${bulkRows.length} rows · Reason: ${bulkReason.trim()}`,
      actionLabel: 'Import catalog',
      execute: executeBulkImport,
    });
  };

  const executeBulkImport = async () => {
    setSaving(true); setBulkError(''); setActionError(''); setActionMessage('');
    try {
      const result = await adminApi.bulkImportCatalog(bulkRows, bulkReason);
      setActionMessage(`${result.createdCount || 0} catalog products imported successfully.`);
      setBulkOpen(false);
      setBulkRows([]); setBulkName(''); setBulkReason('');
      await loadCatalog();
      setGuard(null);
      return true;
    } catch (err) {
      setBulkError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/catalog' }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const availabilityLabel = (product) => {
    if (Number(product.quantity || 0) <= 0) return 'Out of stock';
    if (product.manualOutOfStock) return 'Manually unavailable';
    return 'Available';
  };

  if (loading && !products.length) return <LoadingState label="Loading catalog…" />;
  if (error && !products.length) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Catalog"
        title="Catalog"
        description="Manage products, inventory and availability. Product Service remains the authoritative source for catalog truth."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ConnectedState label={`${pagination.total || 0} catalog items`} />
            {canBulk && (
              <button
                type="button"
                onClick={() => { setBulkOpen(true); setBulkError(''); }}
                className="inline-flex items-center gap-2 border border-creator-border bg-creator-white px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface"
              >
                <Upload size={14} /> Bulk import
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 bg-creator-black px-3 py-2 text-xs font-semibold text-creator-white"
              >
                <Plus size={14} /> Add product
              </button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search product, SKU, slug or category" className="h-11 w-full border border-creator-border bg-creator-white pl-9 pr-4 text-sm outline-none focus:border-creator-black" />
        </div>
        <div className="relative w-full md:w-52">
          <SlidersHorizontal size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
          <select value={stockState} onChange={(event) => { setStockState(event.target.value); setPage(1); }} className="h-11 w-full appearance-none border border-creator-border bg-creator-white pl-9 pr-4 text-sm outline-none focus:border-creator-black">
            <option value="all">All stock states</option>
            <option value="available">Available</option>
            <option value="low">Low stock · 1–5</option>
            <option value="out">Out / manually unavailable</option>
          </select>
        </div>
        <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-11 w-full border border-creator-border bg-creator-white px-4 text-sm outline-none focus:border-creator-black md:w-52">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {error && <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionMessage && <div className="mb-5 border border-creator-border bg-creator-white px-4 py-3 text-sm text-creator-black">{actionMessage}</div>}
      {actionError && <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      <div className="overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] table-fixed text-left">
            <colgroup>
              <col className="w-[31%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="border-b border-creator-border bg-creator-surface">
              <tr className="text-[10px] uppercase tracking-[0.15em] text-creator-muted">
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">SKU</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Availability</th>
                <th className="px-5 py-3.5">Updated</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creator-border">
              {products.map((product) => (
                <tr key={product._id} className="hover:bg-creator-surface/60">
                  <td className="px-5 py-4 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden border border-creator-border bg-creator-surface">
                        {product.image ? (
                          <img src={product.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <PackageOpen size={18} className="m-3 text-creator-faint" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => { setSelected(product); setActionMessage(''); setActionError(''); }}
                          title={product.name || ''}
                          className="max-w-full overflow-hidden text-left text-sm font-semibold leading-5 text-creator-black hover:underline [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                        >
                          {product.name}
                        </button>
                        <div className="mt-1 max-w-full truncate text-xs text-creator-faint" title={product.slug ? `/${product.slug}` : ''}>
                          /{product.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-xs font-medium text-creator-black">
                    <div className="truncate" title={product.sku || ''}>{product.sku || '—'}</div>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm text-creator-muted">
                    <div className="truncate" title={product.category || ''}>{product.category || '—'}</div>
                  </td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-creator-black whitespace-nowrap">{money(product.price)}</td>
                  <td className="px-5 py-4 align-middle text-sm font-semibold text-creator-black whitespace-nowrap">{Number(product.quantity || 0).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 align-middle">
                    <div className="truncate" title={availabilityLabel(product)}>
                      {Number(product.quantity || 0) > 0 && !product.manualOutOfStock ? (
                        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium text-creator-black">
                          <CheckCircle2 size={14} className="shrink-0" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-medium text-creator-muted">
                          <XCircle size={14} className="shrink-0" /> {availabilityLabel(product)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-middle text-xs text-creator-muted">
                    <div className="truncate" title={formatDate(product.updatedAt)}>{formatDate(product.updatedAt)}</div>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <button
                      type="button"
                      onClick={() => { setSelected(product); setActionMessage(''); setActionError(''); }}
                      className="inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface"
                    >
                      Manage <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!products.length && <div className="px-6 py-14 text-center text-sm text-creator-muted">No products match the current filters.</div>}
      </div>

      {pagination.pages > 1 && <div className="mt-4 flex items-center justify-between text-xs text-creator-muted"><span>Page {pagination.page} of {pagination.pages} · {pagination.total} products</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="border border-creator-border px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="border border-creator-border px-3 py-2 disabled:opacity-40">Next</button></div></div>}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onMouseDown={() => setSelected(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-creator-border bg-creator-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-creator-border pb-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Catalog management</div><h2 className="mt-2 text-xl font-semibold tracking-tight text-creator-black">{selected.name}</h2><div className="mt-1 text-xs text-creator-muted">{selected.sku || selected.slug || selected._id}</div></div><button type="button" onClick={() => setSelected(null)} className="rounded-md border border-creator-border p-2 text-creator-muted hover:bg-creator-surface"><X size={16} /></button></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{[['SKU', selected.sku], ['Category', selected.category], ['Price', money(selected.price)], ['Quantity', Number(selected.quantity || 0).toLocaleString('en-IN')], ['Availability', availabilityLabel(selected)], ['Updated', formatDate(selected.updatedAt)]].map(([label, value]) => <div key={label} className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">{label}</div><div className="mt-2 break-words text-sm font-medium text-creator-black">{value || '—'}</div></div>)}</div>
            {selected.description && <div className="mt-5 border border-creator-border p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Description</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-creator-muted">{selected.description}</p></div>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {canWrite && <button type="button" onClick={() => openEdit(selected)} className="inline-flex items-center justify-center gap-2 bg-creator-black px-4 py-3 text-sm font-semibold text-creator-white">Edit catalog details</button>}
              {canStock && <button type="button" onClick={() => { setStockDelta(''); setStockReason(''); setActionError(''); setStockOpen(true); }} className="inline-flex items-center justify-center gap-2 border border-creator-border px-4 py-3 text-sm font-semibold text-creator-black hover:bg-creator-surface">Adjust stock</button>}
              <button type="button" onClick={() => openHistory(selected)} className="inline-flex items-center justify-center gap-2 border border-creator-border px-4 py-3 text-sm font-semibold text-creator-black hover:bg-creator-surface"><History size={15} /> Inventory history</button>
            </div>
            {canAvailability && <div className="mt-3 border border-creator-border bg-creator-surface p-4"><div className="text-xs font-semibold text-creator-black">Availability control</div><div className="mt-1 text-xs leading-5 text-creator-muted">A product can only be made available when quantity is above zero. Manual out-of-stock overrides availability without changing physical quantity.</div><div className="mt-3 flex gap-2"><input value={availabilityReason} onChange={(event) => setAvailabilityReason(event.target.value)} placeholder="Reason for availability change" className="min-w-0 flex-1 border border-creator-border bg-creator-white px-3 py-2.5 text-xs outline-none focus:border-creator-black" />{Number(selected.quantity || 0) > 0 && !selected.manualOutOfStock ? <button type="button" disabled={saving || !availabilityReason.trim()} onClick={() => setAvailability(false)} className="border border-creator-border bg-creator-white px-3 py-2.5 text-xs font-semibold disabled:opacity-40">Mark out of stock</button> : selected.manualOutOfStock ? <button type="button" disabled={saving || !availabilityReason.trim()} onClick={() => setAvailability(true)} className="bg-creator-black px-3 py-2.5 text-xs font-semibold text-creator-white disabled:opacity-40">Mark available</button> : <button type="button" disabled className="border border-creator-border px-3 py-2.5 text-xs text-creator-muted opacity-60">Restock to enable</button>}</div></div>}
            <div className="mt-6 flex justify-end"><button type="button" onClick={() => { setSelected(null); closeOverlays(); }} className="border border-creator-border px-4 py-2.5 text-sm">Close</button></div>
          </aside>
        </div>
      )}

      {addOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-creator-border bg-creator-white shadow-2xl"><ModalHeader title="Add catalog product" onClose={() => setAddOpen(false)} /><ProductForm form={form} setForm={setForm} creating saving={saving} error={actionError} onSave={saveNewProduct} onCancel={() => setAddOpen(false)} /></div></div>}
      {editOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-creator-border bg-creator-white shadow-2xl"><ModalHeader title="Edit catalog details" onClose={() => setEditOpen(false)} /><ProductForm form={form} setForm={setForm} editing saving={saving} error={actionError} onSave={saveEditedProduct} onCancel={() => setEditOpen(false)} /></div></div>}
      {stockOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg border border-creator-border bg-creator-white shadow-2xl"><ModalHeader title="Adjust stock" onClose={() => setStockOpen(false)} /><div className="space-y-5 p-5"><div className="text-sm font-semibold">{selected?.name}</div><div className="grid grid-cols-2 gap-3"><div className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-creator-faint">Current quantity</div><div className="mt-2 text-xl font-semibold">{Number(selected?.quantity || 0).toLocaleString('en-IN')}</div></div><div className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-creator-faint">Example</div><div className="mt-2 text-xs text-creator-muted">+20 restock · -5 correction</div></div></div><input value={stockDelta} onChange={(event) => setStockDelta(event.target.value)} inputMode="numeric" placeholder="Adjustment (+/- whole units)" className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /><textarea value={stockReason} onChange={(event) => setStockReason(event.target.value)} placeholder="Reason" rows={3} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />{actionError && <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setStockOpen(false)} className="border border-creator-border px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={saving || !stockReason.trim()} onClick={applyStockAdjustment} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{saving && <Loader2 size={15} className="animate-spin" />}Apply adjustment</button></div></div></div></div>}
      {bulkOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-creator-border bg-creator-white shadow-2xl"><ModalHeader title="Bulk import catalog" onClose={() => setBulkOpen(false)} /><div className="space-y-5 p-5"><div className="border border-creator-border bg-creator-surface p-4 text-sm text-creator-muted">Use the CSV template. Required columns: SKU, name, category, price, quantity, image and description. Separate multiple features with <strong className="text-creator-black">|</strong>.</div><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 border border-creator-border px-3 py-2 text-xs font-semibold"><Download size={14} /> Download template</button><label className="inline-flex cursor-pointer items-center gap-2 bg-creator-black px-3 py-2 text-xs font-semibold text-creator-white"><FilePlus2 size={14} /> Choose CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBulkFile} /></label></div>{bulkName && <div className="text-xs text-creator-muted">{bulkName} · {bulkRows.length} rows parsed</div>}{bulkError && <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{bulkError}</div>}{bulkRows.length > 0 && <div className="max-h-64 overflow-auto border border-creator-border"><table className="min-w-full text-left"><thead className="sticky top-0 border-b border-creator-border bg-creator-surface text-[10px] uppercase tracking-[0.12em] text-creator-muted"><tr><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Qty</th></tr></thead><tbody>{bulkRows.slice(0, 25).map((row, index) => <tr key={`${row.sku}-${index}`} className="border-b border-creator-border text-xs"><td className="px-3 py-2">{row.sku}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.category}</td><td className="px-3 py-2">{row.price}</td><td className="px-3 py-2">{row.quantity}</td></tr>)}</tbody></table>{bulkRows.length > 25 && <div className="p-3 text-xs text-creator-muted">Showing first 25 rows of {bulkRows.length}.</div>}</div>}<textarea value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Reason for this import" rows={3} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /><div className="flex justify-end gap-3"><button type="button" onClick={() => setBulkOpen(false)} className="border border-creator-border px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={saving || !bulkRows.length || !bulkReason.trim()} onClick={runBulkImport} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{saving && <Loader2 size={15} className="animate-spin" />}Import catalog</button></div></div></div></div>}
      {history && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-3xl border border-creator-border bg-creator-white shadow-2xl"><ModalHeader title="Inventory history" onClose={() => setHistory(null)} /><div className="max-h-[70vh] overflow-y-auto p-5">{historyLoading ? <LoadingState label="Loading inventory history…" /> : history.error ? <ErrorState message={history.error} /> : history.entries.length ? history.entries.map((entry) => <div key={entry._id} className="grid gap-3 border-b border-creator-border py-4 md:grid-cols-[1fr_auto_1fr]"><div><div className="text-sm font-semibold">{entry.movementType.replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-creator-muted">{entry.reason || '—'}</div></div><div className="text-sm font-semibold">{entry.quantityDelta > 0 ? '+' : ''}{entry.quantityDelta}</div><div className="text-xs text-creator-muted">{entry.beforeQuantity} → {entry.afterQuantity}<br />{formatDate(entry.createdAt)}</div></div>) : <div className="py-10 text-center text-sm text-creator-muted">No inventory movements yet.</div>}</div></div></div>}

      {guard && (
        <ActionGuard
          open
          variant={guard.variant}
          title={guard.title}
          description={guard.description}
          details={guard.details}
          actionLabel={guard.actionLabel}
          processing={saving}
          error={actionError || bulkError}
          onConfirm={() => guard.execute?.()}
          onCancel={() => !saving && setGuard(null)}
        />
      )}
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return <div className="flex items-center justify-between border-b border-creator-border p-5"><div><div className="text-xs uppercase tracking-[0.14em] text-creator-muted">Catalog</div><h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2></div><button type="button" onClick={onClose} className="rounded-md border border-creator-border p-2 text-creator-muted hover:bg-creator-surface"><X size={17} /></button></div>;
}

function ProductForm({ form, setForm, creating = false, editing = false, saving, error, onSave, onCancel }) {
  const field = (key, label, props = {}) => <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">{label}</span><input {...props} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>;
  return <div className="space-y-5 p-5">
    <div className="grid gap-4 md:grid-cols-2">
      {field('name', 'Product name', { placeholder: 'Product name' })}
      {field('sku', 'SKU', { placeholder: creating ? 'Leave blank to generate' : 'SKU', disabled: editing })}
      {field('slug', 'Slug', { placeholder: 'product-slug' })}
      {field('category', 'Category', { placeholder: 'Accessories' })}
      {creating ? field('price', 'Initial price', { placeholder: '0.00', inputMode: 'decimal' }) : <div><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Price</span><div className="border border-creator-border bg-creator-surface px-3 py-3 text-sm text-creator-muted">{money(form.price)} · manage price in Pricing</div></div>}
      {creating ? field('quantity', 'Opening quantity', { placeholder: '0', inputMode: 'numeric' }) : <div><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Quantity</span><div className="border border-creator-border bg-creator-surface px-3 py-3 text-sm text-creator-muted">{Number(form.quantity || 0).toLocaleString('en-IN')} · use Adjust stock</div></div>}
      {field('image', 'Image URL', { placeholder: 'https://...' })}
      {field('features', 'Features', { placeholder: 'Feature one, Feature two' })}
    </div>
    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={5} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Reason</span><textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} rows={3} placeholder="Why is this catalog change being made?" className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
    {error && <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
    <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="border border-creator-border px-4 py-2.5 text-sm">Cancel</button><button type="button" disabled={saving} onClick={onSave} className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{saving && <Loader2 size={15} className="animate-spin" />}{creating ? 'Create product' : 'Save changes'}</button></div>
  </div>;
}