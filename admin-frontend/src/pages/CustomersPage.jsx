import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { toUserFacingMessage } from '../lib/userFacingError.js';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN');
};

const displayValue = (value) =>
  value === undefined || value === null || value === ''
    ? '—'
    : value;

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    adminApi
      .customers({
        page: pagination.page,
        limit: pagination.limit,
        search,
      })
      .then((data) => {
        if (!active) return;

        setCustomers(data.customers || []);
        setPagination(
          data.pagination || {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
            totalPages: 1,
          }
        );
      })
      .catch((err) => {
        if (active) setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/customers' }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pagination.page, pagination.limit, search]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
    setSearch(searchInput.trim());
  };

  const openCustomer = async (customer) => {
    setSelectedId(customer._id);
    setSelectedCustomer(null);
    setDetailError('');
    setDetailLoading(true);

    try {
      const data = await adminApi.customer(customer._id);
      setSelectedCustomer(data.customer || null);
    } catch (err) {
      setDetailError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/customers/:id' }));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeCustomer = () => {
    setSelectedId(null);
    setSelectedCustomer(null);
    setDetailError('');
  };

  const rangeLabel = useMemo(() => {
    if (!pagination.total) return '0 customers';

    const start =
      (pagination.page - 1) * pagination.limit + 1;

    const end = Math.min(
      pagination.page * pagination.limit,
      pagination.total
    );

    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Operations"
        title="Customers"
        description="Read customer identity records from the Auth Service through a protected admin adapter."
        action={<ConnectedState label="Customer directory connected" />}
      />

      <div className="mb-5 flex flex-col gap-3 border border-creator-border bg-creator-white p-4 shadow-panel md:flex-row md:items-center md:justify-between">
        <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint"
            />
            <input
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="Search name, email or phone"
              className="w-full border border-creator-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-creator-black"
            />
          </div>

          <button
            type="submit"
            className="bg-creator-black px-4 py-2.5 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>

        <div className="text-xs text-creator-muted">
          {rangeLabel}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading customer directory…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="border border-creator-border bg-creator-white shadow-panel">
          <div className="grid grid-cols-[minmax(220px,2fr)_minmax(160px,1.2fr)_minmax(160px,1.2fr)_100px_130px] gap-4 border-b border-creator-border px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">
            <div>Customer</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Role</div>
            <div>Created</div>
          </div>

          {customers.length ? (
            <div className="divide-y divide-creator-border">
              {customers.map((customer) => (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => openCustomer(customer)}
                  className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition hover:bg-creator-surface md:grid-cols-[minmax(220px,2fr)_minmax(160px,1.2fr)_minmax(160px,1.2fr)_100px_130px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-creator-border bg-creator-surface">
                      <UserRound size={16} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-creator-black">
                        {displayValue(customer.name)}
                      </div>
                      <div className="mt-1 truncate text-xs text-creator-muted">
                        ID {customer._id}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-creator-muted">
                    {displayValue(customer.phone)}
                  </div>

                  <div className="truncate text-sm text-creator-muted">
                    {displayValue(customer.email)}
                  </div>

                  <div className="text-xs font-semibold uppercase tracking-wide text-creator-black">
                    {displayValue(customer.role)}
                  </div>

                  <div className="text-xs text-creator-faint">
                    {formatDate(customer.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14 text-center text-sm text-creator-muted">
              No customers match this search.
            </div>
          )}

          <div className="flex items-center justify-between border-t border-creator-border px-5 py-3">
            <div className="text-xs text-creator-muted">
              Page {pagination.page} of {pagination.totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
                className="border border-creator-border p-2 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                disabled={
                  pagination.page >= pagination.totalPages
                }
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                className="border border-creator-border p-2 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close customer details"
            className="absolute inset-0 bg-black/25"
            onClick={closeCustomer}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-creator-border bg-creator-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-creator-border px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">
                  Customer record
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-creator-black">
                  {selectedCustomer?.name || 'Customer details'}
                </div>
              </div>

              <button
                type="button"
                onClick={closeCustomer}
                className="rounded-md p-2 hover:bg-creator-surface"
                aria-label="Close details"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-creator-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Loading customer details…
                </div>
              ) : detailError ? (
                <ErrorState message={detailError} />
              ) : selectedCustomer ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['Name', selectedCustomer.name],
                      ['Phone', selectedCustomer.phone],
                      ['Email', selectedCustomer.email],
                      ['Role', selectedCustomer.role],
                      ['Customer ID', selectedCustomer._id],
                      ['Created', formatDate(selectedCustomer.createdAt)],
                      ['Updated', formatDate(selectedCustomer.updatedAt)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="border border-creator-border bg-creator-surface p-4"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">
                          {label}
                        </div>
                        <div className="mt-2 break-words text-sm text-creator-black">
                          {displayValue(value)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-creator-border pt-5 text-xs leading-5 text-creator-muted">
                    Customer identity data remains owned by the Auth Service.
                    This Admin module currently provides protected read access only.
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
