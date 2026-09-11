import React, { useEffect, useMemo, useState } from 'react';

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 30000;

const InvoiceModal = ({ order, token, onClose }) => {
  const [invoiceUrl, setInvoiceUrl] = useState(order?.document?.url || null);
  const [isLoading, setIsLoading] = useState(!order?.document?.url);
  const [error, setError] = useState(null);

  const BASE_URL =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  const orderId = useMemo(
    () => order?.orderId || order?._id,
    [order]
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    let intervalId = null;

    const fetchLatestOrder = async () => {
      if (!orderId) {
        setError('Order ID is missing.');
        setIsLoading(false);
        return;
      }

      if (!token) {
        setError('Authentication required to retrieve the invoice.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${BASE_URL}/api/orders/${orderId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch order (${response.status})`
          );
        }

        const latestOrder = await response.json();
        const url = latestOrder?.document?.url;

        if (url) {
          if (cancelled) return;

          setInvoiceUrl(url);
          setIsLoading(false);

          if (intervalId) clearInterval(intervalId);
          if (timeoutId) clearTimeout(timeoutId);

          return;
        }

        if (Date.now() - startedAt >= MAX_WAIT_MS) {
          if (cancelled) return;

          setError(
            'Invoice is still being generated. Please close and try again shortly.'
          );
          setIsLoading(false);

          if (intervalId) clearInterval(intervalId);
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (requestError) {
        if (Date.now() - startedAt >= MAX_WAIT_MS && !cancelled) {
          console.error('Invoice retrieval error:', requestError);

          setError('Unable to retrieve the invoice right now.');
          setIsLoading(false);

          if (intervalId) clearInterval(intervalId);
          if (timeoutId) clearTimeout(timeoutId);
        }
      }
    };

    const startedAt = Date.now();

    fetchLatestOrder();

    if (!cancelled && !invoiceUrl) {
      intervalId = setInterval(fetchLatestOrder, POLL_INTERVAL_MS);

      timeoutId = setTimeout(() => {
        if (cancelled) return;

        setError(
          'Invoice is still being generated. Please close and try again shortly.'
        );
        setIsLoading(false);

        if (intervalId) clearInterval(intervalId);
      }, MAX_WAIT_MS);
    }

    return () => {
      cancelled = true;

      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [BASE_URL, orderId, token]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl h-[90vh] flex flex-col border border-creator-border shadow-xl relative">

        <div className="flex justify-between items-center p-4 border-b border-creator-border">
          <h2 className="text-lg font-medium tracking-tight">
            Invoice: {orderId}
          </h2>

          <button
            onClick={onClose}
            className="text-creator-muted hover:text-black"
          >
            &times; Close
          </button>
        </div>

        <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden p-4">
          {isLoading ? (
            <span className="text-sm uppercase tracking-widest text-creator-muted animate-pulse">
              Waiting for invoice service...
            </span>
          ) : error ? (
            <span className="text-sm text-red-600 text-center px-6">
              {error}
            </span>
          ) : invoiceUrl ? (
            <iframe
              src={invoiceUrl}
              className="w-full h-full border-none shadow-sm"
              title="Invoice Preview"
            />
          ) : (
            <span className="text-sm text-creator-muted">
              Invoice unavailable.
            </span>
          )}
        </div>

        <div className="p-4 border-t border-creator-border flex gap-4 justify-end">
          <button
            onClick={() => {
              if (!invoiceUrl) return;

              const printWindow = window.open(
                invoiceUrl,
                '_blank'
              );

              if (printWindow) {
                printWindow.addEventListener('load', () => {
                  printWindow.print();
                });
              }
            }}
            disabled={isLoading || !invoiceUrl}
            className="px-6 py-3 border border-creator-border text-sm uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Print
          </button>

          <a
            href={invoiceUrl || '#'}
            target="_blank"
            rel="noreferrer"
            download={`invoice-${orderId}.pdf`}
            className={`px-6 py-3 bg-creator-black text-white text-sm uppercase tracking-widest hover:bg-gray-900 transition-colors ${
              isLoading || !invoiceUrl
                ? 'opacity-50 pointer-events-none'
                : ''
            }`}
          >
            Download
          </a>
        </div>

      </div>
    </div>
  );
};

export default InvoiceModal;

