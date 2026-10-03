import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, X } from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { adminApi } from '../lib/api.js';
import ActionGuard from '../components/ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const STATUS_OPTIONS = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const statusClass = {
  Processing: 'bg-amber-50 text-amber-800 border-amber-200',
  Shipped: 'bg-blue-50 text-blue-800 border-blue-200',
  Delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-red-50 text-red-800 border-red-200',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusGuard, setStatusGuard] = useState(null);

  const loadOrders = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.orders({
        page,
        limit: 20,
        search,
        status: status === 'All' ? '' : status,
        paymentMethod: paymentMethod === 'All' ? '' : paymentMethod,
      });
      setOrders(data.orders || []);
      setPagination(data.pagination || { page, pages: 1, total: 0 });
    } catch (requestError) {
      setError(toUserFacingMessage(requestError, { status: requestError?.status, code: requestError?.code, url: '/api/admin/orders' }));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(1);
    // Filter values are intentionally captured when the screen first loads.
    // Explicit Apply below controls subsequent server requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openOrder = async (orderId) => {
    setSelectedOrder(null);
    setDetailLoading(true);
    try {
      const data = await adminApi.order(orderId);
      setSelectedOrder(data.order);
    } catch (requestError) {
      setError(toUserFacingMessage(requestError, { status: requestError?.status, code: requestError?.code, url: '/api/admin/orders/:id' }));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = (nextStatus) => {
    if (!selectedOrder || updating || selectedOrder.status === nextStatus) return;
    setError('');
    setStatusGuard({
      nextStatus,
      title: `Change order to ${nextStatus}?`,
      description: 'This updates the operational status shown to the team and downstream order workflows.',
      details: `Order ${selectedOrder._id} · Current status: ${selectedOrder.status} · New status: ${nextStatus}`,
      actionLabel: `Set ${nextStatus}`,
    });
  };

  const confirmStatusChange = async () => {
    if (!selectedOrder || !statusGuard || updating) return;
    setUpdating(true);
    setError('');
    try {
      const data = await adminApi.updateOrderStatus(selectedOrder._id, statusGuard.nextStatus);
      setSelectedOrder(data.order);
      setOrders((current) =>
        current.map((order) =>
          order._id === selectedOrder._id ? data.order : order
        )
      );
      setStatusGuard(null);
    } catch (requestError) {
      setError(toUserFacingMessage(requestError, { status: requestError?.status, code: requestError?.code, url: '/api/admin/orders/:id/status' }));
    } finally {
      setUpdating(false);
    }
  };

  const runFilter = () => loadOrders(1);

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Operations"
        title="Orders"
        description="Monitor customer orders from the authoritative Order Service, inspect order details and update operational status with RBAC protection."
      />

      <div className="border border-creator-border bg-creator-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && runFilter()}
              placeholder="Search order ID, customer, invoice or payment ID"
              className="h-11 w-full border border-creator-border bg-creator-white pl-10 pr-4 text-sm outline-none focus:border-black"
            />
          </div>

          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 border border-creator-border bg-creator-white px-3 text-sm outline-none">
            {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>

          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-11 border border-creator-border bg-creator-white px-3 text-sm outline-none">
            <option>All</option>
            <option>COD</option>
            <option>ONLINE</option>
          </select>

          <button onClick={runFilter} className="h-11 bg-black px-5 text-sm font-semibold text-white hover:opacity-90">
            Apply filters
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-6 overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-creator-border bg-creator-surface text-left text-xs uppercase tracking-wider text-creator-muted">
              <tr>
                <th className="px-5 py-4 font-semibold">Order</th>
                <th className="px-5 py-4 font-semibold">Customer</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Payment</th>
                <th className="px-5 py-4 font-semibold">Total</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-16 text-center text-creator-muted"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="7" className="px-5 py-16 text-center text-creator-muted">No orders match the current filters.</td></tr>
              ) : orders.map((order) => (
                <tr key={order._id} className="border-b border-creator-border last:border-b-0 hover:bg-creator-surface/60">
                  <td className="px-5 py-4 font-medium">#{String(order._id).slice(-8)}</td>
                  <td className="px-5 py-4">{order.customerName || '—'}</td>
                  <td className="px-5 py-4 text-creator-muted">{formatDate(order.createdAt)}</td>
                  <td className="px-5 py-4">{order.paymentMethod || '—'}</td>
                  <td className="px-5 py-4 font-medium">{formatMoney(order.totalAmount)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex border px-2.5 py-1 text-xs font-semibold ${statusClass[order.status] || 'border-creator-border bg-creator-surface'}`}>
                      {order.status || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => openOrder(order._id)} className="inline-flex items-center gap-2 text-xs font-semibold underline underline-offset-4">
                      View <ExternalLink size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-creator-border px-5 py-4 text-sm">
          <span className="text-creator-muted">{pagination.total || 0} orders</span>
          <div className="flex items-center gap-2">
            <button disabled={(pagination.page || 1) <= 1 || loading} onClick={() => loadOrders((pagination.page || 1) - 1)} className="border border-creator-border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="min-w-20 text-center">Page {pagination.page || 1} / {pagination.pages || 1}</span>
            <button disabled={(pagination.page || 1) >= (pagination.pages || 1) || loading} onClick={() => loadOrders((pagination.page || 1) + 1)} className="border border-creator-border p-2 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {(selectedOrder || detailLoading) && (
        <div className="fixed inset-0 z-[120] bg-black/30">
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-creator-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-creator-border bg-creator-white px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-creator-muted">Order detail</div>
                <div className="mt-1 text-xl font-semibold">#{selectedOrder?._id ? String(selectedOrder._id).slice(-10) : '…'}</div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="border border-creator-border p-2"><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" size={22} /></div>
            ) : selectedOrder && (
              <div className="space-y-6 p-6">
                <section className="border border-creator-border p-5">
                  <div className="text-xs uppercase tracking-wider text-creator-muted">Customer</div>
                  <div className="mt-2 font-semibold">{selectedOrder.customerName || '—'}</div>
                  <div className="mt-3 text-sm leading-6 text-creator-muted">{selectedOrder.shippingAddress?.street || ''}<br />{selectedOrder.shippingAddress?.city || ''}, {selectedOrder.shippingAddress?.state || ''} {selectedOrder.shippingAddress?.zip || ''}</div>
                </section>

                <section className="border border-creator-border p-5">
                  <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-wider text-creator-muted">Status</div><div className="mt-2 text-lg font-semibold">{selectedOrder.status}</div></div><div className="text-right"><div className="text-xs uppercase tracking-wider text-creator-muted">Total</div><div className="mt-2 text-lg font-semibold">{formatMoney(selectedOrder.totalAmount)}</div></div></div>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {STATUS_OPTIONS.filter((item) => item !== 'All').map((option) => (
                      <button key={option} disabled={updating || selectedOrder.status === option} onClick={() => changeStatus(option)} className={`border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${selectedOrder.status === option ? 'border-black bg-black text-white' : 'border-creator-border bg-white'}`}>{option}</button>
                    ))}
                  </div>
                </section>

                <section className="border border-creator-border p-5">
                  <div className="flex items-center justify-between"><div className="text-xs uppercase tracking-wider text-creator-muted">Items</div><div className="text-xs text-creator-muted">{selectedOrder.items?.length || 0} lines</div></div>
                  <div className="mt-4 divide-y divide-creator-border">
                    {(selectedOrder.items || []).map((item, index) => (
                      <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-4 py-3 text-sm">
                        <div><div className="font-medium">{item.name}</div><div className="mt-1 text-xs text-creator-muted">Qty {item.quantity} · Unit {formatMoney(item.price)}</div></div>
                        <div className="font-medium">{formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-creator-border p-5"><div className="text-xs uppercase tracking-wider text-creator-muted">Payment</div><div className="mt-2 font-semibold">{selectedOrder.paymentMethod || '—'}</div><div className="mt-2 break-all text-xs text-creator-muted">{selectedOrder.paymentId || 'No payment ID'}</div></div>
                  <div className="border border-creator-border p-5"><div className="text-xs uppercase tracking-wider text-creator-muted">Invoice</div><div className="mt-2 font-semibold">{selectedOrder.document?.invoiceNumber || 'Pending'}</div>{selectedOrder.document?.url && <a href={selectedOrder.document.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline">Open invoice <ExternalLink size={12} /></a>}</div>
                </section>

                <button onClick={() => setSelectedOrder(null)} className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"><ArrowLeft size={15} /> Back to orders</button>
              </div>
            )}
          </aside>
        </div>
      )}
      {statusGuard && (
        <ActionGuard
          open
          title={statusGuard.title}
          description={statusGuard.description}
          details={statusGuard.details}
          actionLabel={statusGuard.actionLabel}
          processing={updating}
          error={error}
          onConfirm={confirmStatusChange}
          onCancel={() => !updating && setStatusGuard(null)}
        />
      )}
    </div>
  );
}
