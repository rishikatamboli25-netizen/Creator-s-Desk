import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
  X,
} from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import {
  ConnectedState,
  ErrorState,
  LoadingState,
} from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';

const PAGE_SIZE = 25;

const formatMoney = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusClasses = {
  GENERATED:
    'border-creator-border bg-creator-surface text-creator-black',
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-800',
  NOT_GENERATED:
    'border-creator-border bg-white text-creator-muted',
};

const statusLabel = {
  GENERATED: 'Generated',
  PENDING: 'Pending',
  NOT_GENERATED: 'Not generated',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        statusClasses[status] ||
        statusClasses.NOT_GENERATED
      }`}
    >
      {statusLabel[status] || status}
    </span>
  );
}

function InvoiceDetails({ invoice, onClose, onDownload }) {
  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/20 p-4">
      <button
        type="button"
        aria-label="Close invoice details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section className="relative z-10 flex h-full w-full max-w-xl flex-col border border-creator-border bg-creator-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-creator-border px-6 py-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">
              Invoice detail
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-creator-black">
              {invoice.invoiceNumber || 'Invoice pending'}
            </h2>
            <div className="mt-2">
              <StatusBadge status={invoice.invoiceStatus} />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-creator-border p-2 text-creator-muted transition hover:bg-creator-surface hover:text-creator-black"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Order ID', invoice.orderId],
              ['Customer', invoice.customerName || '—'],
              ['Payment', invoice.paymentMethod || '—'],
              ['Order status', invoice.orderStatus || '—'],
              ['Items', invoice.itemCount],
              ['Order total', formatMoney(invoice.totalAmount)],
              ['Provider', invoice.provider || '—'],
              ['Generated', formatDate(invoice.generatedAt)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-creator-border bg-creator-surface p-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">
                  {label}
                </div>
                <div className="mt-2 break-words text-sm font-medium text-creator-black">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-creator-border bg-creator-white p-5">
            <div className="flex items-start gap-3">
              <FileText size={17} className="mt-0.5 text-creator-muted" />
              <div>
                <div className="text-sm font-semibold text-creator-black">
                  Document handling
                </div>
                <p className="mt-2 text-sm leading-6 text-creator-muted">
                  Invoice generation remains owned by the Invoice Service. CD_ADMIN only exposes invoice metadata and an authorized download path.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-creator-border px-6 py-4">
          {invoice.invoiceStatus === 'GENERATED' ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-creator-black px-4 py-3 text-sm font-semibold text-creator-white transition hover:opacity-90"
            >
              <Download size={16} />
              Download invoice
            </button>
          ) : (
            <div className="border border-creator-border bg-creator-surface px-4 py-3 text-center text-xs leading-5 text-creator-muted">
              The PDF is not available yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function InvoicesPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    items: [],
    summary: {
      total: 0,
      generated: 0,
      pending: 0,
      notGenerated: 0,
    },
    pagination: {
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    adminApi
      .invoices({
        q: search,
        status,
        sort,
        page,
        limit: PAGE_SIZE,
      })
      .then((response) => {
        if (!cancelled) {
          setData({
            items: Array.isArray(response.items)
              ? response.items
              : [],
            summary: response.summary || {
              total: 0,
              generated: 0,
              pending: 0,
              notGenerated: 0,
            },
            pagination: response.pagination || {
              page,
              limit: PAGE_SIZE,
              total: 0,
              totalPages: 0,
            },
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Unable to load invoices.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, status, sort, page]);

  const canGoPrevious = page > 1;
  const canGoNext =
    page < (data.pagination.totalPages || 0);

  const rangeLabel = useMemo(() => {
    const total = Number(data.pagination.total || 0);

    if (!total) return '0 invoices';

    const start =
      (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(
      page * PAGE_SIZE,
      total
    );

    return `${start}–${end} of ${total}`;
  }, [data.pagination.total, page]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  const clearSearch = () => {
    setQuery('');
    setSearch('');
    setPage(1);
  };

  const openDownload = (invoice) => {
    window.open(
      adminApi.invoiceDownloadUrl(invoice.orderId),
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (loading && !data.items.length) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <ModuleHeader
          eyebrow="Finance"
          title="Invoices"
          description="Search and manage access to invoices generated by the Invoice Service."
        />
        <LoadingState label="Loading invoice workspace…" />
      </div>
    );
  }

  if (error && !data.items.length) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <ModuleHeader
          eyebrow="Finance"
          title="Invoices"
          description="Search and manage access to invoices generated by the Invoice Service."
        />
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Finance"
        title="Invoices"
        description="Search invoice records, inspect generation status and download generated PDFs through the controlled admin path."
        action={<ConnectedState label="Invoice records connected" />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total records', data.summary.total],
          ['Generated', data.summary.generated],
          ['Pending', data.summary.pending],
          ['Not generated', data.summary.notGenerated],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border border-creator-border bg-creator-white p-5 shadow-panel"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">
              {label}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-creator-black">
              {Number(value || 0).toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 border border-creator-border bg-creator-white p-4 shadow-panel">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="invoice-search"
              className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint"
            >
              Search
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint"
              />
              <input
                id="invoice-search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Invoice number, order ID, customer or user ID"
                className="w-full border border-creator-border bg-creator-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-creator-black"
              />
            </div>
          </div>

          <div className="w-full lg:w-48">
            <label
              htmlFor="invoice-status"
              className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint"
            >
              Status
            </label>
            <select
              id="invoice-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-full border border-creator-border bg-creator-white px-3 py-2.5 text-sm outline-none focus:border-creator-black"
            >
              <option value="">All statuses</option>
              <option value="GENERATED">Generated</option>
              <option value="PENDING">Pending</option>
              <option value="NOT_GENERATED">Not generated</option>
            </select>
          </div>

          <div className="w-full lg:w-56">
            <label
              htmlFor="invoice-sort"
              className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint"
            >
              Sort
            </label>
            <select
              id="invoice-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="w-full border border-creator-border bg-creator-white px-3 py-2.5 text-sm outline-none focus:border-creator-black"
            >
              <option value="createdAt_desc">Newest orders</option>
              <option value="createdAt_asc">Oldest orders</option>
              <option value="generatedAt_desc">Recently generated</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
              <option value="invoiceNumber_asc">Invoice number</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white transition hover:opacity-90"
            >
              <Search size={15} />
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted transition hover:bg-creator-surface hover:text-creator-black"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="flex flex-col gap-2 border-b border-creator-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-creator-black">
            Invoice records
          </div>
          <div className="text-xs text-creator-muted">
            {rangeLabel}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-left">
            <thead className="border-b border-creator-border bg-creator-surface">
              <tr>
                {[
                  'Invoice',
                  'Order',
                  'Customer',
                  'Amount',
                  'Payment',
                  'Status',
                  'Generated',
                  '',
                ].map((heading) => (
                  <th
                    key={heading || 'actions'}
                    className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-creator-border">
              {data.items.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="transition hover:bg-creator-surface/60"
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedInvoice(invoice)
                      }
                      className="text-left"
                    >
                      <div className="text-sm font-semibold text-creator-black hover:underline">
                        {invoice.invoiceNumber || 'Pending'}
                      </div>
                      <div className="mt-1 text-xs text-creator-faint">
                        {invoice.itemCount} item{invoice.itemCount === 1 ? '' : 's'}
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="max-w-[150px] truncate font-mono text-xs text-creator-muted">
                      {invoice.orderId}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-creator-black">
                      {invoice.customerName || '—'}
                    </div>
                    <div className="mt-1 max-w-[180px] truncate text-xs text-creator-faint">
                      {invoice.userId || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-creator-black">
                    {formatMoney(invoice.totalAmount)}
                  </td>
                  <td className="px-5 py-4 text-xs text-creator-muted">
                    {invoice.paymentMethod || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      status={invoice.invoiceStatus}
                    />
                  </td>
                  <td className="px-5 py-4 text-xs text-creator-muted">
                    {formatDate(invoice.generatedAt)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {invoice.invoiceStatus === 'GENERATED' ? (
                      <button
                        type="button"
                        onClick={() =>
                          openDownload(invoice)
                        }
                        className="inline-flex items-center gap-2 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black transition hover:bg-creator-surface"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedInvoice(invoice)
                        }
                        className="inline-flex items-center gap-2 rounded-md border border-creator-border px-3 py-2 text-xs font-medium text-creator-muted transition hover:bg-creator-surface hover:text-creator-black"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!data.items.length && (
            <div className="flex min-h-52 items-center justify-center px-6 text-center">
              <div>
                <FileText size={22} className="mx-auto text-creator-muted" />
                <div className="mt-3 text-sm font-semibold text-creator-black">
                  No invoice records found
                </div>
                <p className="mt-2 text-sm text-creator-muted">
                  Adjust the search or status filter and try again.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-creator-border px-5 py-4">
          <div className="text-xs text-creator-muted">
            Page {data.pagination.totalPages ? page : 0} of{' '}
            {data.pagination.totalPages || 0}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
              className="rounded-md border border-creator-border p-2 text-creator-muted transition hover:bg-creator-surface hover:text-creator-black disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() =>
                setPage((current) =>
                  current + 1
                )
              }
              className="rounded-md border border-creator-border p-2 text-creator-muted transition hover:bg-creator-surface hover:text-creator-black disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          onClose={() =>
            setSelectedInvoice(null)
          }
          onDownload={() =>
            openDownload(selectedInvoice)
          }
        />
      )}
    </div>
  );
}
