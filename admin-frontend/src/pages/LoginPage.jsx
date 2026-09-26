import React, { useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

export default function LoginPage() {
  const { login } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password, mfaStep ? otp : '');
      const destination = location.state?.from || '/';
      navigate(destination, { replace: true });
    } catch (loginError) {
      if (loginError.mfaRequired) {
        setMfaStep(true);
        setOtp('');
        setError('Enter the six-digit authenticator code or a recovery code to continue.');
      } else {
        setError(loginError.message || 'Unable to sign in.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-creator-surface">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-creator-black px-12 py-12 text-creator-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div>
            <div className="text-base font-semibold tracking-tight">CREATOR'S DESK</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">Administration</div>
          </div>
          <div className="max-w-lg pb-12">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-white/15 bg-white/5">
              <ShieldCheck size={21} strokeWidth={1.6} />
            </div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-[-0.03em] xl:text-5xl">
              Run the store with clarity.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/55">
              A dedicated operational workspace for catalog, pricing, orders, finance, customers and system administration.
            </p>
          </div>
          <div className="text-xs text-white/35">Private administration environment</div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <div className="text-base font-semibold tracking-tight text-creator-black">CREATOR'S DESK</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-creator-muted">Admin Console</div>
            </div>

            <div className="border border-creator-border bg-creator-white p-7 shadow-panel sm:p-9">
              <div className="mb-8">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-creator-muted">
                  {mfaStep ? 'Second-factor verification' : 'Secure access'}
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-creator-black">
                  {mfaStep ? 'Verify your identity' : 'Sign in to CD_ADMIN'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-creator-muted">
                  {mfaStep
                    ? 'Your administrator account has MFA enabled. Complete the second factor to create the session.'
                    : 'Use your administrator credentials to continue.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!mfaStep ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-creator-black">Email</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="admin@example.com"
                        required
                        className="h-12 w-full rounded-md border border-creator-border bg-creator-white px-3.5 text-sm outline-none transition placeholder:text-creator-faint focus:border-creator-black"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-creator-black">Password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        required
                        className="h-12 w-full rounded-md border border-creator-border bg-creator-white px-3.5 text-sm outline-none transition placeholder:text-creator-faint focus:border-creator-black"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-creator-black">
                      <KeyRound size={15} />
                      {useRecoveryCode ? 'Recovery code' : 'Authenticator code'}
                    </span>
                    <input
                      type={useRecoveryCode ? 'text' : 'text'}
                      inputMode={useRecoveryCode ? 'text' : 'numeric'}
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      placeholder={useRecoveryCode ? 'ABCDE-12345' : '123456'}
                      required
                      autoFocus
                      className="h-12 w-full rounded-md border border-creator-border bg-creator-white px-3.5 text-sm tracking-[0.15em] outline-none focus:border-creator-black"
                    />
                  </label>
                )}

                {mfaStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecoveryCode((value) => !value);
                      setOtp('');
                      setError('');
                    }}
                    className="text-left text-xs font-medium text-creator-muted underline underline-offset-4 hover:text-creator-black"
                  >
                    {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code instead'}
                  </button>
                ) : null}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-creator-black text-sm font-medium text-creator-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (mfaStep ? 'Verifying…' : 'Signing in…') : (mfaStep ? 'Verify and sign in' : 'Sign in')}
                </button>

                {mfaStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMfaStep(false);
                      setOtp('');
                      setError('');
                    }}
                    className="w-full text-center text-xs font-medium text-creator-muted hover:text-creator-black"
                  >
                    Back to credentials
                  </button>
                ) : null}
              </form>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-creator-muted">
              Admin access is provisioned internally. There is no public admin registration.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
