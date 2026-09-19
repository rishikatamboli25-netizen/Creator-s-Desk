import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';

const PAGE_SIZE = 25;

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
};

const badgeClass = (outcome) =>
  outcome === 'FAILED'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-creator-border bg-creator-surface text-creator-black';

export default function AuditLogPage() {
  const [data, setData] = useState(null);
  const [actors, setActors] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    entityType: '',
    outcome: '',
    actorAdminUserId: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (nextPage = page, nextFilters = appliedFilters) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await adminApi.auditLogs({
        page: nextPage,
        limit: PAGE_SIZE,
        ...nextFilters,
      });
      setData(result);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load audit records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadActors = async () => {
      try {
        const result = await adminApi.auditActors();
        if (!cancelled) setActors(result.actors || []);
      } catch {
        if (!cancelled) setActors([]);
      }
    };

    loadActors();
    load(1, appliedFilters);

    return () => {
      cancelled = true;
    };
  }, []);

  const actionOptions = useMemo(() => {
    const unique = new Set((data?.items || []).map((item) => item.action).filter(Boolean));
    return [...unique].sort();
  }, [data]);

  const entityOptions = useMemo(() => {
    const unique = new Set((data?.items || []).map((item) => item.entityType).filter(Boolean));
    return [...unique].sort();
  }, [data]);

  const applyFilters = async (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
    await load(1, filters);
  };

  const clearFilters = async () => {
    const reset = {
      search: '',
      action: '',
      entityType: '',
      outcome: '',
      actorAdminUserId: '',
      from: '',
      to: '',
    };
    setFilters(reset);
    setAppliedFilters(reset);
    setPage(1);
    await load(1, reset);
  };

  const changePage = async (nextPage) => {
    if (!data || nextPage < 1 || nextPage > data.totalPages || nextPage === page) return;
    setPage(nextPage);
    await load(nextPage, appliedFilters);
  };

  if (isLoading && !data) return <LoadingState label="Loading audit records…" />;
  if (error && !data) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Security"
        title="Audit Log"
        description="A protected, append-oriented record of sensitive administrative activity, including actor, action, target, outcome and request traceability."
        action={
          <ConnectedState label={`${data?.total || 0} audit records`} />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-creator-border bg-creator-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-creator-muted">
            <span>Total</span>
            <Activity size={15} />
          </div>
          <div className="mt-4 text-2xl font-semibold">{data?.total || 0}</div>
        </div>
        <div className="border border-creator-border bg-creator-white p-5 shadow-panel">
          <div className="text-xs uppercase tracking-[0.16em] text-creator-muted">Successful</div>
          <div className="mt-4 text-2xl font-semibold">{data?.summary?.success || 0}</div>
        </div>
        <div className="border border-creator-border bg-creator-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-creator-muted">
            <span>Failed</span>
            <ShieldAlert size={15} />
          </div>
          <div className="mt-4 text-2xl font-semibold">{data?.summary?.failed || 0}</div>
        </div>
      </div>

      <form onSubmit={applyFilters} className="mt-6 border border-creator-border bg-creator-white p-5 shadow-panel">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter size={16} /> Filters
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">Search</span>
            <div className="flex items-center border border-creator-border px-3">
              <Search size={15} className="text-creator-muted" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                placeholder="Action, entity, request ID, reason…"
                className="w-full border-0 bg-transparent px-2 py-2.5 text-sm outline-none"
              />
            </div>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">Actor</span>
            <select
              value={filters.actorAdminUserId}
              onChange={(e) => setFilters((current) => ({ ...current, actorAdminUserId: e.target.value }))}
              className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All actors</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.name} · {actor.email}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">Outcome</span>
            <select
              value={filters.outcome}
              onChange={(e) => setFilters((current) => ({ ...current, outcome: e.target.value }))}
              className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">Action</span>
            <select
              value={filters.action}
              onChange={(e) => setFilters((current) => ({ ...current, action: e.target.value }))}
              className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All actions</option>
              {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">Entity</span>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters((current) => ({ ...current, entityType: e.target.value }))}
              className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All entities</option>
              {entityOptions.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilters((current) => ({ ...current, from: e.target.value }))} className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none" />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-creator-muted">To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilters((current) => ({ ...current, to: e.target.value }))} className="w-full border border-creator-border bg-white px-3 py-2.5 text-sm outline-none" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="inline-flex items-center gap-2 bg-creator-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
            <Search size={15} /> Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="border border-creator-border px-4 py-2.5 text-sm font-medium hover:bg-creator-surface">
            Clear
          </button>
          <button type="button" onClick={() => load(page, appliedFilters)} className="ml-auto inline-flex items-center gap-2 border border-creator-border px-4 py-2.5 text-sm font-medium hover:bg-creator-surface">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </form>

      {error && <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-creator-border bg-creator-surface text-[11px] uppercase tracking-[0.12em] text-creator-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold">Outcome</th>
                <th className="px-4 py-3 font-semibold">Trace</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item) => (
                <tr key={item.id} className="border-b border-creator-border last:border-0 hover:bg-creator-surface/60">
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-creator-muted">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-creator-black">{item.actor?.name || 'System / unauthenticated'}</div>
                    <div className="mt-1 text-xs text-creator-muted">{item.actor?.email || '—'}{item.actorRoleKey ? ` · ${item.actorRoleKey}` : ''}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-creator-black">{item.action}</td>
                  <td className="px-4 py-4 text-xs">
                    <div className="font-medium">{item.entityType}</div>
                    <div className="mt-1 text-creator-muted">{item.entityId || '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${badgeClass(item.outcome)}`}>{item.outcome}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-creator-muted">{item.requestId || '—'}</td>
                  <td className="px-4 py-4 text-right">
                    <button type="button" onClick={() => setSelected(item)} className="inline-flex items-center gap-1.5 border border-creator-border px-3 py-2 text-xs font-medium hover:bg-creator-surface">
                      <Eye size={14} /> Details
                    </button>
                  </td>
                </tr>
              ))}
              {!data?.items?.length && (
                <tr><td colSpan="7" className="px-6 py-16 text-center text-sm text-creator-muted">No audit records match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-creator-border px-4 py-3">
          <div className="text-xs text-creator-muted">Page {data?.page || 1} of {data?.totalPages || 1} · {data?.total || 0} records</div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={(data?.page || 1) <= 1} onClick={() => changePage((data?.page || 1) - 1)} className="border border-creator-border p-2 disabled:opacity-40"><ChevronLeft size={15} /></button>
            <button type="button" disabled={(data?.page || 1) >= (data?.totalPages || 1)} onClick={() => changePage((data?.page || 1) + 1)} className="border border-creator-border p-2 disabled:opacity-40"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-creator-border bg-creator-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-creator-border pb-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">Audit Record</div>
                <h2 className="mt-2 text-xl font-semibold">{selected.action}</h2>
                <p className="mt-1 text-xs text-creator-muted">{formatDateTime(selected.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md p-2 hover:bg-creator-surface"><X size={18} /></button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Actor', selected.actor?.email || 'System / unauthenticated'],
                ['Role snapshot', selected.actorRoleKey || '—'],
                ['Entity', `${selected.entityType}${selected.entityId ? ` · ${selected.entityId}` : ''}`],
                ['Outcome', selected.outcome],
                ['Request ID', selected.requestId || '—'],
                ['IP', selected.ipAddress || '—'],
                ['Reason', selected.reason || '—'],
              ].map(([label, value]) => (
                <div key={label} className="border border-creator-border px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-creator-muted">{label}</div>
                  <div className="mt-2 break-words text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-4">
              {[['Before', selected.before], ['After', selected.after], ['Metadata', selected.metadata]].map(([label, value]) => (
                <section key={label}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-creator-muted">{label}</div>
                  <pre className="overflow-x-auto border border-creator-border bg-creator-surface p-4 text-xs leading-5">{value == null ? '—' : JSON.stringify(value, null, 2)}</pre>
                </section>
              ))}
            </div>

            <div className="mt-5 border border-creator-border px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-creator-muted">User agent</div>
              <div className="mt-2 break-words text-xs leading-5 text-creator-muted">{selected.userAgent || '—'}</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
