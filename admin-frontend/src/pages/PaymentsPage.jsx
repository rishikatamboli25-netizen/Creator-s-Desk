import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Loader2, Search, ShieldCheck, WalletCards, X } from 'lucide-react';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';
import ActionGuard from '../components/ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const REASON_OPTIONS = [
  ['CUSTOMER_REQUESTED', 'Customer requested refund'],
  ['ORDER_CANCELLED', 'Order cancelled'],
  ['DAMAGED_ITEM', 'Item damaged / defective'],
  ['WRONG_ITEM', 'Incorrect item delivered'],
  ['DELIVERY_ISSUE', 'Delivery issue'],
  ['DUPLICATE_PAYMENT', 'Duplicate payment'],
  ['PRICE_ADJUSTMENT', 'Price adjustment'],
  ['GOODWILL', 'Goodwill refund'],
  ['OTHER', 'Other'],
];

const REASON_LABELS = Object.fromEntries(REASON_OPTIONS);
const MAX_REASON_NOTE_LENGTH = 250;

const formatCurrency = (amount) => {
  const value = Number(amount);
  return Number.isFinite(value)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
    : '₹0.00';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN');
};

const displayValue = (value) => value === undefined || value === null || value === '' ? '—' : value;

const statusLabel = (status, refundMethod = 'ORIGINAL_PAYMENT') => ({
  REQUESTED: 'Requested',
  AWAITING_CUSTOMER_DETAILS: 'Awaiting payout details',
  PAYOUT_DETAILS_SUBMITTED: 'Payout details submitted',
  PROCESSING: refundMethod === 'COD_PAYOUT' ? 'Payout processing' : 'Refund processing',
  PENDING: refundMethod === 'COD_PAYOUT' ? 'Waiting for payout response' : 'Waiting for Razorpay response',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}[status] || status || 'Requested');

const statusClass = (status) => status === 'PROCESSED' ? 'text-emerald-700' : ['FAILED', 'CANCELLED'].includes(status) ? 'text-red-700' : 'text-amber-700';

const sanitizeAmount = (value) => {
  let normalized = String(value).replace(',', '.').replace(/[^\d.]/g, '');
  const dotIndex = normalized.indexOf('.');
  if (dotIndex === -1) return normalized;
  const whole = normalized.slice(0, dotIndex);
  const decimals = normalized.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}.${decimals}`;
};

const ACTIVE_REFUND_STATUSES = ['REQUESTED', 'AWAITING_CUSTOMER_DETAILS', 'PAYOUT_DETAILS_SUBMITTED', 'PROCESSING', 'PENDING'];
const RELEASED_REFUND_STATUSES = ['FAILED', 'CANCELLED'];

const activeRefundForOrder = (refunds) =>
  refunds.find((refund) => ACTIVE_REFUND_STATUSES.includes(refund.status));

const totalRefundedOrReserved = (refunds) =>
  refunds
    .filter((refund) => !RELEASED_REFUND_STATUSES.includes(refund.status))
    .reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('CUSTOMER_REQUESTED');
  const [reasonNote, setReasonNote] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [guard, setGuard] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.orders({ page: pagination.page, limit: pagination.limit, search });
      setOrders(data.orders || []);
      const p = data.pagination || {};
      setPagination({ page: p.page || pagination.page, limit: p.limit || pagination.limit, total: p.total || 0, totalPages: p.pages || p.totalPages || 1 });
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPayments(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pagination.page, pagination.limit, search]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setSearch(searchInput.trim());
  };

  const refreshRefunds = async (orderId) => {
    const data = await adminApi.refundHistory(orderId);
    const next = data.refunds || [];
    setRefunds(next);
    return next;
  };

  const openPayment = async (order) => {
    setSelectedOrder(order);
    setRefunds([]);
    setRefundError('');
    setRefundAmount('');
    setReasonCode('CUSTOMER_REQUESTED');
    setReasonNote('');
    setRefundsLoading(true);
    try {
      const next = await refreshRefunds(order._id);
      const active = activeRefundForOrder(next);
      const refundedOrReserved = totalRefundedOrReserved(next);
      const remaining = Math.max(
        0,
        Math.round((Number(order.totalAmount || 0) - refundedOrReserved) * 100) / 100
      );
      setRefundAmount(remaining > 0 ? remaining.toFixed(2) : '');
      if (active) {
        const rail = active.refundMethod === 'COD_PAYOUT' ? 'payout' : 'gateway refund';
        setRefundError(`A refund is currently ${statusLabel(active.status, active.refundMethod).toLowerCase()}. A second refund is blocked until the current ${rail} reaches a final state.`);
      }
    } catch (err) {
      setRefundError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments/refunds' }));
    } finally {
      setRefundsLoading(false);
    }
  };

  const closePayment = () => {
    if (refundSubmitting) return;
    setSelectedOrder(null);
    setRefunds([]);
    setRefundError('');
    setRefundAmount('');
    setReasonCode('CUSTOMER_REQUESTED');
    setReasonNote('');
  };

  const activeRefund = useMemo(() => activeRefundForOrder(refunds), [refunds]);
  const refundedOrReservedAmount = useMemo(() => totalRefundedOrReserved(refunds), [refunds]);
  const remainingRefundableAmount = useMemo(
    () => Math.max(0, Math.round((Number(selectedOrder?.totalAmount || 0) - refundedOrReservedAmount) * 100) / 100),
    [selectedOrder, refundedOrReservedAmount]
  );

  const submitRefund = () => {
    if (!selectedOrder || refundSubmitting) return;
    const cleanAmount = sanitizeAmount(refundAmount);
    const amount = Number(cleanAmount);
    if (!cleanAmount || !Number.isFinite(amount) || amount <= 0) return setRefundError('Enter a valid refund amount.');
    if (amount > Number(selectedOrder.totalAmount)) return setRefundError('Refund amount cannot exceed the order total.');
    if (amount > remainingRefundableAmount) return setRefundError(`Refund amount cannot exceed the remaining refundable balance of ${formatCurrency(remainingRefundableAmount)}.`);
    if (!reasonCode) return setRefundError('Choose a refund reason.');
    if (reasonNote.length > MAX_REASON_NOTE_LENGTH) return setRefundError(`Additional note must be ${MAX_REASON_NOTE_LENGTH} characters or fewer.`);
    if (activeRefund) {
      const rail = activeRefund.refundMethod === 'COD_PAYOUT' ? 'COD payout' : 'Razorpay refund';
      return setRefundError(`A refund is already ${statusLabel(activeRefund.status, activeRefund.refundMethod).toLowerCase()}. Wait for the current ${rail} to reach a final state before requesting another refund.`);
    }

    const refundMethod = selectedOrder.paymentMethod === 'ONLINE' ? 'ORIGINAL_PAYMENT' : 'COD_PAYOUT';
    setRefundError('');
    setGuard({
      variant: 'slide',
      title: refundMethod === 'COD_PAYOUT' ? 'Create this COD refund?' : 'Issue this refund?',
      description: refundMethod === 'COD_PAYOUT'
        ? 'This will create a customer payout request and block a second refund while it is active.'
        : 'This will submit a refund request against the original payment. Check refund history if the gateway response is delayed.',
      details: `${formatCurrency(amount)} · ${reasonCode.replaceAll('_', ' ').toLowerCase()} · Order ${selectedOrder._id}`,
      actionLabel: refundMethod === 'COD_PAYOUT' ? 'Create COD refund' : 'Issue refund',
      execute: () => executeRefund({ amount, refundMethod }),
    });
  };

  const executeRefund = async ({ amount, refundMethod }) => {
    setRefundSubmitting(true);
    setRefundError('');
    const idempotencyKey = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const result = await adminApi.createRefund({
        orderId: selectedOrder._id,
        amount,
        reasonCode,
        reasonNote: reasonNote.trim(),
        refundMethod,
        idempotencyKey,
      });
      const updated = await refreshRefunds(selectedOrder._id);
      const latest = result?.refund || updated[0];
      setRefundAmount('');
      setReasonCode('CUSTOMER_REQUESTED');
      setReasonNote('');
      if (latest?.refundMethod === 'COD_PAYOUT') {
        if (latest?.status === 'PROCESSED') setRefundError('The COD payout was processed. The refund is recorded as processed.');
        else if (latest?.status === 'FAILED') setRefundError(latest.failureReason || 'The COD payout failed.');
        else if (latest?.status === 'PROCESSING' || latest?.status === 'PENDING') setRefundError('The COD payout is processing. A second refund request remains blocked until the payout reaches a final state.');
        else if (result.nextAction === 'PAYOUT_READY_FOR_PROCESSING') setRefundError('COD refund created. The customer’s saved payout profile is already attached and the payout is ready for processing.');
        else if (result.nextAction === 'CUSTOMER_MUST_SUBMIT_PAYOUT_DETAILS') setRefundError('COD refund created. No saved payout profile was available, so the customer must add payout details before the payout can proceed.');
      } else if (latest?.status === 'PROCESSED') setRefundError('Razorpay returned a processed response. The refund is recorded as processed.');
      else if (latest?.status === 'FAILED') setRefundError(latest.failureReason || 'Razorpay returned a failed response.');
      else if (latest?.status === 'PROCESSING' || latest?.status === 'PENDING') setRefundError('Razorpay has not returned a final response yet. The refund remains processing and a second request is blocked.');
      await loadPayments();
      setGuard(null);
      return true;
    } catch (err) {
      setRefundError(err.data?.refund?.failureReason || toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments/refunds' }));
      try { await refreshRefunds(selectedOrder._id); } catch { /* preserve original error */ }
      return false;
    } finally {
      setRefundSubmitting(false);
    }
  };

  const reconcileRefund = (refundId) => {
    setRefundError('');
    setGuard({
      variant: 'confirm',
      title: 'Reconcile this Razorpay refund?',
      description: 'This asks the system to re-check the gateway state of the selected refund.',
      details: 'Use this when a refund is still processing or pending.',
      actionLabel: 'Reconcile refund',
      execute: async () => {
        setRefundSubmitting(true);
        try {
          const result = await adminApi.reconcileRefund(refundId);
          await refreshRefunds(selectedOrder._id);
          setRefundError(result.message || 'Gateway state reconciled.');
          setGuard(null);
          return true;
        } catch (err) {
          setRefundError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments/refunds' }));
          return false;
        } finally {
          setRefundSubmitting(false);
        }
      },
    });
  };

  const processCodPayout = (refundId) => {
    setRefundError('');
    setGuard({
      variant: 'slide',
      title: 'Process this COD payout?',
      description: 'This will submit the saved customer payout details to the payout flow. Verify the refund record before continuing.',
      details: 'A successful payout request may move the refund into processing and cannot be undone from this screen.',
      actionLabel: 'Process COD payout',
      execute: async () => {
        setRefundSubmitting(true);
        try {
          const result = await adminApi.processCodPayout(refundId);
          await refreshRefunds(selectedOrder._id);
          setRefundError(
            result.message ||
              (result?.refund?.status === 'PROCESSED'
                ? 'The COD payout was processed.'
                : 'COD payout request sent. Awaiting the final payout response.')
          );
          setGuard(null);
          return true;
        } catch (err) {
          setRefundError(err.data?.refund?.failureReason || toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments/refunds' }));
          try { await refreshRefunds(selectedOrder._id); } catch { /* preserve original error */ }
          return false;
        } finally {
          setRefundSubmitting(false);
        }
      },
    });
  };

  const reconcileCodPayout = (refundId) => {
    setRefundError('');
    setGuard({
      variant: 'confirm',
      title: 'Reconcile this COD payout?',
      description: 'This asks the payout service to re-check the current state of the selected COD refund.',
      details: 'No new payout is created by this operation.',
      actionLabel: 'Reconcile payout',
      execute: async () => {
        setRefundSubmitting(true);
        try {
          const result = await adminApi.reconcileCodPayout(refundId);
          await refreshRefunds(selectedOrder._id);
          setRefundError(result.message || 'COD payout state reconciled.');
          setGuard(null);
          return true;
        } catch (err) {
          setRefundError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/payments/refunds' }));
          return false;
        } finally {
          setRefundSubmitting(false);
        }
      },
    });
  };

  const rangeLabel = useMemo(() => {
    if (!pagination.total) return '0 orders';
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Finance"
        title="Payments & Refunds"
        description="Review payment-linked orders and manage refunds with a gateway-response lifecycle."
        action={<ConnectedState label="Refund orchestration connected" />}
      />

      <div className="mb-5 border border-creator-border bg-creator-white p-4 shadow-panel">
        <div className="mb-3 flex items-start gap-2 text-xs leading-5 text-creator-muted">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <span>Online refunds return to the original payment method. COD refunds require customer payout details. An online refund is shown as processed only after Razorpay returns a processed response.</span>
        </div>
        <form onSubmit={submitSearch} className="flex max-w-xl gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-creator-faint" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search order, customer, invoice or payment" className="w-full border border-creator-border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-creator-black" />
          </div>
          <button type="submit" className="bg-creator-black px-4 py-2.5 text-sm font-medium text-white">Search</button>
        </form>
      </div>

      {loading ? <LoadingState label="Loading payment records…" /> : error ? <ErrorState message={error} /> : (
        <div className="border border-creator-border bg-creator-white shadow-panel">
          <div className="hidden grid-cols-[minmax(190px,1.5fr)_120px_minmax(170px,1.3fr)_minmax(150px,1fr)_120px_120px] gap-4 border-b border-creator-border px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint md:grid">
            <div>Order</div><div>Rail</div><div>Payment ID</div><div>Customer</div><div>Amount</div><div>Created</div>
          </div>
          {orders.length ? <div className="divide-y divide-creator-border">
            {orders.map((order) => {
              const online = order.paymentMethod === 'ONLINE';
              return <button key={order._id} type="button" onClick={() => openPayment(order)} className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition hover:bg-creator-surface md:grid-cols-[minmax(190px,1.5fr)_120px_minmax(170px,1.3fr)_minmax(150px,1fr)_120px_120px] md:items-center md:gap-4">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center border border-creator-border bg-creator-surface">{online ? <CreditCard size={16} /> : <WalletCards size={16} />}</div><div><div className="text-sm font-medium text-creator-black">{order._id}</div><div className="mt-1 text-xs text-creator-muted">{displayValue(order.document?.invoiceNumber)}</div></div></div>
                <div className="text-xs font-semibold uppercase tracking-wide text-creator-black">{displayValue(order.paymentMethod)}</div>
                <div className="truncate text-xs text-creator-muted">{displayValue(order.paymentId)}</div>
                <div className="truncate text-sm text-creator-muted">{displayValue(order.customerName)}</div>
                <div className="text-sm font-medium text-creator-black">{formatCurrency(order.totalAmount)}</div>
                <div className="text-xs text-creator-faint">{formatDate(order.createdAt)}</div>
              </button>;
            })}
          </div> : <div className="px-5 py-14 text-center text-sm text-creator-muted">No payment-linked orders found.</div>}
          <div className="flex items-center justify-between border-t border-creator-border px-5 py-3"><div className="text-xs text-creator-muted">{rangeLabel}</div><div className="flex items-center gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => setPagination((c) => ({ ...c, page: c.page - 1 }))} className="border border-creator-border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((c) => ({ ...c, page: c.page + 1 }))} className="border border-creator-border p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        </div>
      )}

      {selectedOrder && <div className="fixed inset-0 z-50"><button type="button" aria-label="Close payment details" className="absolute inset-0 bg-black/25" onClick={closePayment} /><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-creator-border bg-creator-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-creator-border px-6 py-5"><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">Refund record</div><div className="mt-2 text-xl font-semibold tracking-tight text-creator-black">{selectedOrder._id}</div></div><button type="button" onClick={closePayment} className="rounded-md p-2 hover:bg-creator-surface"><X size={19} /></button></div>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">{[['Payment method', selectedOrder.paymentMethod], ['Payment ID', selectedOrder.paymentId], ['Order total', formatCurrency(selectedOrder.totalAmount)], ['Customer', selectedOrder.customerName], ['Invoice', selectedOrder.document?.invoiceNumber], ['Order date', formatDate(selectedOrder.createdAt)]].map(([label, value]) => <div key={label} className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">{label}</div><div className="mt-2 break-words text-sm text-creator-black">{displayValue(value)}</div></div>)}</div>

          <div className="border-t border-creator-border pt-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Refund history</div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="border border-creator-border bg-creator-surface p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Order total</div>
                <div className="mt-2 text-sm font-semibold text-creator-black">{formatCurrency(selectedOrder.totalAmount)}</div>
              </div>
              <div className="border border-creator-border bg-creator-surface p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Refunded / reserved</div>
                <div className="mt-2 text-sm font-semibold text-creator-black">{formatCurrency(refundedOrReservedAmount)}</div>
              </div>
              <div className={`border p-4 ${remainingRefundableAmount > 0 ? 'border-creator-border bg-creator-surface' : 'border-amber-200 bg-amber-50'}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Remaining refundable</div>
                <div className="mt-2 text-sm font-semibold text-creator-black">{formatCurrency(remainingRefundableAmount)}</div>
              </div>
            </div>
            {refundsLoading ? <div className="flex items-center gap-2 text-sm text-creator-muted"><Loader2 size={16} className="animate-spin" />Loading refund history…</div> : refunds.length ? <div className="space-y-2">{refunds.map((refund) => <div key={refund._id} className="border border-creator-border p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-medium text-creator-black">{formatCurrency(refund.amount)}</div><div className="mt-1 text-xs text-creator-muted">{refund.refundMethod === 'ORIGINAL_PAYMENT' ? 'Original payment' : refund.refundMethod === 'COD_PAYOUT' ? 'COD payout' : 'Wallet credit'}</div></div><div className={`text-right text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass(refund.status)}`}>{statusLabel(refund.status)}</div></div><div className="mt-3 text-xs text-creator-muted">{REASON_LABELS[refund.reasonCode] || displayValue(refund.reasonCode)}</div>{refund.reasonNote && <div className="mt-1 text-xs text-creator-muted">{refund.reasonNote}</div>}{refund.gatewayRefundId && <div className="mt-3 break-all text-[11px] text-creator-faint">Razorpay refund: {refund.gatewayRefundId}</div>}{refund.gatewayReference && <div className="mt-1 break-all text-[11px] text-creator-faint">Gateway reference: {refund.gatewayReference}</div>}{refund.failureReason && <div className="mt-2 text-xs text-red-700">{refund.failureReason}</div>}<div className="mt-2 text-[11px] text-creator-faint">{formatDate(refund.createdAt)}</div>{refund.status === 'PAYOUT_DETAILS_SUBMITTED' && refund.refundMethod === 'COD_PAYOUT' && <button type="button" disabled={refundSubmitting} onClick={() => processCodPayout(refund._id)} className="mt-3 border border-creator-border px-3 py-2 text-xs font-medium hover:bg-creator-surface disabled:opacity-50">Process COD payout</button>}{(refund.status === 'PROCESSING' || refund.status === 'PENDING') && refund.refundMethod === 'COD_PAYOUT' && <button type="button" disabled={refundSubmitting} onClick={() => reconcileCodPayout(refund._id)} className="mt-3 border border-creator-border px-3 py-2 text-xs font-medium hover:bg-creator-surface disabled:opacity-50">Reconcile COD payout</button>}{(refund.status === 'PROCESSING' || refund.status === 'PENDING') && refund.refundMethod === 'ORIGINAL_PAYMENT' && <button type="button" disabled={refundSubmitting} onClick={() => reconcileRefund(refund._id)} className="mt-3 border border-creator-border px-3 py-2 text-xs font-medium hover:bg-creator-surface disabled:opacity-50">Reconcile with Razorpay</button>}</div>)}</div> : <div className="text-sm text-creator-muted">No refund requests recorded for this order.</div>}
          </div>

          <div className="border-t border-creator-border pt-5"><div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Create refund request</div>{activeRefund ? <div className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">A refund is currently <strong>{statusLabel(activeRefund.status, activeRefund.refundMethod).toLowerCase()}</strong>. A new request is blocked until the current {activeRefund.refundMethod === 'COD_PAYOUT' ? 'COD payout' : 'Razorpay refund'} reaches a final processed, failed, or cancelled state.</div> : <div className="space-y-4">
            {remainingRefundableAmount <= 0 && <div className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">This payment has no remaining refundable amount. Review the refund history above for previously processed or reserved refunds.</div>}
            <div><label htmlFor="refund-amount" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Refund amount</label><input id="refund-amount" type="text" inputMode="decimal" autoComplete="off" value={refundAmount} onChange={(event) => setRefundAmount(sanitizeAmount(event.target.value))} placeholder="0.00" disabled={remainingRefundableAmount <= 0} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black disabled:cursor-not-allowed disabled:bg-creator-surface disabled:text-creator-muted" /><div className="mt-1 text-[11px] text-creator-faint">Remaining refundable: {formatCurrency(remainingRefundableAmount)}</div></div>
            <div><label htmlFor="refund-reason" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Refund reason</label><select id="refund-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={remainingRefundableAmount <= 0} className="w-full appearance-none border border-creator-border bg-creator-white px-3 py-3 text-sm outline-none focus:border-creator-black disabled:cursor-not-allowed disabled:bg-creator-surface disabled:text-creator-muted">{REASON_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><div className="mb-2 flex items-center justify-between"><label htmlFor="refund-note" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Additional note <span className="font-normal normal-case tracking-normal text-creator-faint">(optional)</span></label><span className="text-[11px] text-creator-faint">{reasonNote.length}/{MAX_REASON_NOTE_LENGTH}</span></div><textarea id="refund-note" rows={3} maxLength={MAX_REASON_NOTE_LENGTH} disabled={remainingRefundableAmount <= 0} value={reasonNote} onChange={(event) => setReasonNote(event.target.value.slice(0, MAX_REASON_NOTE_LENGTH))} placeholder="Add useful context (optional)." className="w-full resize-none border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black disabled:cursor-not-allowed disabled:bg-creator-surface disabled:text-creator-muted" /></div>
            <div className="border border-creator-border bg-creator-surface p-4 text-xs leading-5 text-creator-muted">{selectedOrder.paymentMethod === 'ONLINE' ? 'This refunds the original Razorpay payment. Bank details are not required. The refund is marked processed only after Razorpay returns a processed response.' : 'COD refunds automatically reuse the customer’s saved payout profile. If no usable payout profile exists, the refund will wait for the customer to add one. The customer does not need to enter payout details for every refund.'}</div>
            {refundError && <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{refundError}</div>}
            <button type="button" disabled={refundSubmitting || remainingRefundableAmount <= 0} onClick={submitRefund} className="flex w-full items-center justify-center gap-2 bg-creator-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{refundSubmitting && <Loader2 size={16} className="animate-spin" />}{remainingRefundableAmount <= 0 ? 'No refundable balance' : selectedOrder.paymentMethod === 'ONLINE' ? 'Issue refund' : 'Create COD refund'}</button>
          </div>}</div>
        </div>
      </aside></div>}

      {guard && (
        <ActionGuard
          open
          variant={guard.variant}
          title={guard.title}
          description={guard.description}
          details={guard.details}
          actionLabel={guard.actionLabel}
          processing={refundSubmitting}
          error={refundError}
          onConfirm={() => guard.execute?.()}
          onCancel={() => !refundSubmitting && setGuard(null)}
        />
      )}
    </div>
  );
}
