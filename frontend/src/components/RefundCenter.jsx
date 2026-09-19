import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-IN') : '—';

const emptyDetailsForMethod = (method) =>
  method === 'UPI'
    ? { upiId: '' }
    : { accountHolderName: '', accountNumber: '', ifsc: '' };

const profileDetailsForForm = (profile) => {
  if (!profile?.details) {
    return emptyDetailsForMethod(profile?.method || 'UPI');
  }

  return profile.details;
};

export default function RefundCenter() {
  const { token } = useAuth();

  const [refunds, setRefunds] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [method, setMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  const pendingCodRefunds = useMemo(
    () =>
      refunds.filter(
        (refund) =>
          refund.refundMethod === 'COD_PAYOUT' &&
          [
            'AWAITING_CUSTOMER_DETAILS',
            'PAYOUT_DETAILS_SUBMITTED'
          ].includes(refund.status)
      ),
    [refunds]
  );

  const awaitingDetails = pendingCodRefunds.some(
    (refund) => refund.status === 'AWAITING_CUSTOMER_DETAILS'
  );

  // Customer history intentionally contains only successfully completed refunds.
  const completedRefunds = useMemo(
    () => refunds.filter((refund) => refund.status === 'PROCESSED'),
    [refunds]
  );

  const hydrateForm = (nextProfile) => {
    if (!nextProfile) {
      setMethod('UPI');
      setUpiId('');
      setAccountHolderName('');
      setAccountNumber('');
      setIfsc('');
      return;
    }

    const details = profileDetailsForForm(nextProfile);

    setMethod(nextProfile.method || 'UPI');
    setUpiId(details.upiId || '');
    setAccountHolderName(details.accountHolderName || '');
    setAccountNumber(details.accountNumber || '');
    setIfsc(details.ifsc || '');
  };

  const load = async () => {
    if (!token) {
      setRefunds([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [refundResponse, profileResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/payment/refunds/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }),
        fetch(`${BACKEND_URL}/api/payment/payout-profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      ]);

      const refundData = await refundResponse.json().catch(() => ({}));
      const profileData = await profileResponse.json().catch(() => ({}));

      if (!refundResponse.ok) {
        throw new Error(
          refundData.error || 'Unable to load refund requests.'
        );
      }

      if (!profileResponse.ok) {
        throw new Error(
          profileData.error || 'Unable to load payout profile.'
        );
      }

      const nextProfile = profileData.profile || null;

      setRefunds(Array.isArray(refundData.refunds) ? refundData.refunds : []);
      setProfile(nextProfile);
      hydrateForm(nextProfile);
      setEditing(!nextProfile);
      setFocusedField('');
    } catch (err) {
      setError(err.message || 'Unable to load refund center.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleMethodChange = (nextMethod) => {
    setMethod(nextMethod);

    const nextDetails =
      profile?.method === nextMethod
        ? profileDetailsForForm(profile)
        : emptyDetailsForMethod(nextMethod);

    setUpiId(nextDetails.upiId || '');
    setAccountHolderName(nextDetails.accountHolderName || '');
    setAccountNumber(nextDetails.accountNumber || '');
    setIfsc(nextDetails.ifsc || '');
    setFocusedField('');
  };

  const handleEdit = () => {
    setError('');
    setSuccess('');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    hydrateForm(profile);
    setEditing(false);
    setFocusedField('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setError('Please sign in again to save payout details.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const details =
        method === 'UPI'
          ? { upiId: upiId.trim() }
          : {
              accountHolderName: accountHolderName.trim(),
              accountNumber: accountNumber.trim(),
              ifsc: ifsc.trim().toUpperCase()
            };

      const response = await fetch(
        `${BACKEND_URL}/api/payment/payout-profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ method, details })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to save payout details.'
        );
      }

      const nextProfile = data.profile || null;

      setProfile(nextProfile);
      hydrateForm(nextProfile);
      setEditing(false);
      setFocusedField('');
      setSuccess(
        'Your payout details were saved securely and will remain available for eligible COD refunds.'
      );

      await load();
    } catch (err) {
      setError(err.message || 'Unable to save payout details.');
    } finally {
      setSaving(false);
    }
  };

  const inputType = (field) =>
    editing && focusedField === field ? 'text' : 'password';

  const inputClass = (disabled) =>
    `w-full border border-creator-border bg-creator-white p-4 text-sm outline-none focus:border-creator-black ${
      disabled
        ? 'cursor-not-allowed bg-creator-surface text-creator-muted'
        : ''
    }`;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-creator-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading refund center…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 border-b border-creator-border pb-4">
        <h2 className="text-xl font-light tracking-tight text-creator-black">
          Refunds &amp; Payouts
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-creator-muted">
          Online refunds return to the original payment method. COD refunds use
          the payout details saved here.
        </p>
      </div>

      {error && (
        <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 border border-creator-border bg-creator-white px-4 py-3 text-sm text-creator-black">
          <Check size={16} />
          {success}
        </div>
      )}

      {/* Payout details stay above the customer-facing refund history. */}
      <div className="border border-creator-border bg-creator-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-creator-black">
                COD payout details
              </h3>
              <p className="mt-2 text-sm leading-6 text-creator-muted">
                Your saved payout details stay attached to your account. They
                are masked until you edit a field.
              </p>
              {profile?.maskedDisplay && (
                <div className="mt-2 text-xs text-creator-faint">
                  Saved {profile.method}: {profile.maskedDisplay}
                </div>
              )}
            </div>
          </div>

          {profile && !editing && (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex shrink-0 items-center gap-2 border border-creator-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-creator-black transition-colors hover:border-creator-black"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>

        {awaitingDetails && (
          <div className="mt-5 border border-creator-border bg-creator-surface p-4 text-xs leading-5 text-creator-black">
            A COD refund is waiting for these details. Save them here and the
            refund request will move forward.
          </div>
        )}

        <div className="mt-6 flex gap-2 border-b border-creator-border">
          {['UPI', 'BANK_ACCOUNT'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleMethodChange(value)}
              disabled={!editing}
              className={`border-b-2 px-3 pb-3 text-xs font-semibold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                method === value
                  ? 'border-creator-black text-creator-black'
                  : 'border-transparent text-creator-muted'
              }`}
            >
              {value === 'UPI' ? 'UPI' : 'Bank account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {method === 'UPI' ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-creator-muted">
                UPI ID
              </label>
              <input
                type={inputType('upiId')}
                autoComplete="off"
                readOnly={!editing}
                value={upiId}
                onFocus={() => editing && setFocusedField('upiId')}
                onBlur={() => setFocusedField('')}
                onChange={(event) => setUpiId(event.target.value)}
                placeholder={profile ? '••••••••' : 'name@upi'}
                className={inputClass(!editing)}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-creator-muted">
                  Account holder name
                </label>
                <input
                  type={inputType('accountHolderName')}
                  autoComplete="off"
                  readOnly={!editing}
                  value={accountHolderName}
                  onFocus={() =>
                    editing && setFocusedField('accountHolderName')
                  }
                  onBlur={() => setFocusedField('')}
                  onChange={(event) =>
                    setAccountHolderName(event.target.value)
                  }
                  placeholder={
                    profile ? '••••••••' : 'Account holder name'
                  }
                  className={inputClass(!editing)}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-creator-muted">
                  Account number
                </label>
                <input
                  type={inputType('accountNumber')}
                  inputMode="numeric"
                  autoComplete="off"
                  readOnly={!editing}
                  value={accountNumber}
                  onFocus={() =>
                    editing && setFocusedField('accountNumber')
                  }
                  onBlur={() => setFocusedField('')}
                  onChange={(event) =>
                    setAccountNumber(
                      event.target.value.replace(/\D/g, '')
                    )
                  }
                  placeholder={profile ? '••••••••' : 'Account number'}
                  className={inputClass(!editing)}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-creator-muted">
                  IFSC code
                </label>
                <input
                  type={inputType('ifsc')}
                  autoComplete="off"
                  maxLength={11}
                  readOnly={!editing}
                  value={ifsc}
                  onFocus={() => editing && setFocusedField('ifsc')}
                  onBlur={() => setFocusedField('')}
                  onChange={(event) =>
                    setIfsc(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder={profile ? '••••••••' : 'IFSC code'}
                  className={inputClass(!editing)}
                />
              </div>
            </>
          )}

          {editing && (
            <div className="flex flex-col gap-3 border-t border-creator-border pt-5 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 bg-creator-black px-6 py-4 text-xs font-medium uppercase tracking-widest text-creator-white transition-colors hover:bg-gray-900 disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {profile ? 'Save changes' : 'Save payout details'}
              </button>

              {profile && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="border border-creator-border px-6 py-4 text-xs font-medium uppercase tracking-widest text-creator-black transition-colors hover:border-creator-black disabled:opacity-60"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </form>

        <p className="mt-4 text-[11px] leading-5 text-creator-faint">
          Full payout details are encrypted at rest in the Payment Service and
          are returned only to the authenticated account that owns them.
        </p>
      </div>

      {/* Only the refund history scrolls; payout details remain visible above it. */}
      <div className="mt-8">
        <div className="mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-creator-black">
            Completed refunds
          </h3>
          <p className="mt-2 text-sm leading-6 text-creator-muted">
            Only refunds that have been successfully completed appear here.
          </p>
        </div>

        <div className="max-h-[420px] overflow-y-auto pr-2">
          <div className="space-y-4">
            {completedRefunds.length === 0 ? (
              <div className="border border-creator-border bg-creator-white p-8 text-sm text-creator-muted">
                No successfully completed refunds yet.
              </div>
            ) : (
              completedRefunds.map((refund) => (
                <div
                  key={refund._id}
                  className="border border-creator-border bg-creator-white p-6"
                >
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-creator-muted">
                        Amount
                      </div>
                      <div className="mt-2 text-lg font-medium text-creator-black">
                        {formatCurrency(refund.amount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-creator-muted">
                        Date received
                      </div>
                      <div className="mt-2 text-sm text-creator-black">
                        {formatDate(refund.processedAt || refund.createdAt)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-creator-muted">
                        Transaction ID
                      </div>
                      <div className="mt-2 break-all text-sm text-creator-black">
                        {refund.gatewayReference ||
                          refund.gatewayRefundId ||
                          refund.walletLedgerEntryId ||
                          '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-creator-muted">
                        Settled to
                      </div>
                      <div className="mt-2 text-sm text-creator-black">
                        {refund.refundMethod === 'ORIGINAL_PAYMENT'
                          ? 'Original payment'
                          : refund.refundMethod === 'WALLET'
                            ? "Creator's Desk wallet"
                            : 'COD payout'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
