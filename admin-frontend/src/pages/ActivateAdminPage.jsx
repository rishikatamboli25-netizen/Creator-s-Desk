import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api.js';

export default function ActivateAdminPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invitation token is missing.');
      setLoading(false);
      return;
    }

    adminApi.invitation(token)
      .then((data) => setInvitation(data.invitation))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const activate = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.activateInvitation(token, { password, confirmPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-creator-surface px-4 py-10 text-creator-ink">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <div className="text-sm font-semibold tracking-tight text-creator-black">CREATOR'S DESK</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-creator-muted">Admin Console</div>
        </div>

        <div className="border border-creator-border bg-creator-white p-7 shadow-panel md:p-9">
          {loading && (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-creator-muted">
              <LoaderCircle size={17} className="animate-spin" /> Validating invitation…
            </div>
          )}

          {!loading && !success && invitation && (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-creator-border bg-creator-surface">
                <ShieldCheck size={18} />
              </div>
              <div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-creator-faint">Administrator invitation</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-creator-black">Activate your admin account</h1>
              <p className="mt-3 text-sm leading-6 text-creator-muted">
                Set a permanent password to activate access for {invitation.email}.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="border border-creator-border bg-creator-surface p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">Name</div>
                  <div className="mt-2 text-sm font-medium text-creator-black">{invitation.name}</div>
                </div>
                <div className="border border-creator-border bg-creator-surface p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">Role</div>
                  <div className="mt-2 text-sm font-medium text-creator-black">{invitation.roleName}</div>
                </div>
              </div>

              <form onSubmit={activate} className="mt-7 space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint" htmlFor="admin-password">New password</label>
                  <input id="admin-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border border-creator-border bg-creator-white px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="Minimum 12 characters" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint" htmlFor="admin-password-confirm">Confirm password</label>
                  <input id="admin-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full border border-creator-border bg-creator-white px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="Repeat your password" />
                </div>
                {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-md bg-creator-black px-4 py-3 text-sm font-semibold text-creator-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting && <LoaderCircle size={15} className="animate-spin" />}
                  Activate account
                </button>
              </form>
            </>
          )}

          {!loading && !success && !invitation && (
            <div className="py-12 text-center">
              <div className="text-sm font-semibold text-creator-black">Invitation unavailable</div>
              <p className="mt-2 text-sm leading-6 text-creator-muted">{error || 'This invitation is invalid or has expired.'}</p>
              <button type="button" onClick={() => navigate('/login')} className="mt-6 rounded-md border border-creator-border px-4 py-2.5 text-sm font-semibold text-creator-black transition hover:bg-creator-surface">Go to sign in</button>
            </div>
          )}

          {success && (
            <div className="py-12 text-center">
              <CheckCircle2 size={28} className="mx-auto" />
              <div className="mt-4 text-lg font-semibold text-creator-black">Account activated</div>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-creator-muted">Your administrator account is active. Sign in with your email and new password.</p>
              <button type="button" onClick={() => navigate('/login')} className="mt-7 rounded-md bg-creator-black px-5 py-3 text-sm font-semibold text-creator-white">Go to sign in</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
