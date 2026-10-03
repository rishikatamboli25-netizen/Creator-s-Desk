import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Copy,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  UserCircle2,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { adminApi } from '../lib/api.js';
import MfaQrCode from '../components/MfaQrCode.jsx';

const SETTING_ORDER = [
  'ADMIN_SESSION_HOURS',
  'INVITATION_EXPIRY_HOURS',
  'PASSWORD_MIN_LENGTH',
];

const formatDate = (value) => {
  if (!value) return 'Not customised';
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

export default function SettingsPage() {
  const { admin, refreshAdmin } = useAdminAuth();
  const canRead = admin?.permissions?.includes('settings.read');
  const canWrite = admin?.permissions?.includes('settings.write');

  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [editingSettings, setEditingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');

  const [editingAccount, setEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
    currentPassword: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');

  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaCurrentPassword, setMfaCurrentPassword] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showMfaSetupKey, setShowMfaSetupKey] = useState(false);
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState([]);
  const [mfaRecoveryVisible, setMfaRecoveryVisible] = useState(false);
  const [mfaRecoveryPassword, setMfaRecoveryPassword] = useState('');
  const [mfaRecoveryOtp, setMfaRecoveryOtp] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.settings();
      const ordered = [...(data.settings || [])].sort(
        (a, b) => SETTING_ORDER.indexOf(a.key) - SETTING_ORDER.indexOf(b.key)
      );
      setSettings(ordered);
      setDraft(Object.fromEntries(ordered.map((item) => [item.key, String(item.value)])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canRead) {
      setSettings([]);
      setDraft({});
      setEditingSettings(false);
      setLoading(false);
      return;
    }

    load();
  }, [canRead, load]);

  useEffect(() => {
    setAccountDraft((current) => ({
      ...current,
      name: admin?.name || '',
      email: admin?.email || '',
    }));
  }, [admin?.name, admin?.email]);

  const dirty = useMemo(
    () => settings.some((item) => Number(draft[item.key]) !== Number(item.value)),
    [draft, settings]
  );

  const passwordMinLength = Number(
    settings.find((item) => item.key === 'PASSWORD_MIN_LENGTH')?.value || 12
  );

  const updateDraft = (key, value) => {
    setNotice('');
    setError('');
    setDraft((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!canWrite || !dirty || saving) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const changedSettings = {};
      settings.forEach((item) => {
        const nextValue = Number(draft[item.key]);
        if (nextValue !== Number(item.value)) changedSettings[item.key] = nextValue;
      });

      const data = await adminApi.updateSettings(changedSettings, reason.trim());
      const ordered = [...(data.settings || [])].sort(
        (a, b) => SETTING_ORDER.indexOf(a.key) - SETTING_ORDER.indexOf(b.key)
      );
      setSettings(ordered);
      setDraft(Object.fromEntries(ordered.map((item) => [item.key, String(item.value)])));
      setReason('');
      setEditingSettings(false);
      setNotice(data.changed?.length ? 'Settings updated and audit entries recorded.' : 'No settings changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelSettingsEdit = () => {
    setDraft(Object.fromEntries(settings.map((item) => [item.key, String(item.value)])));
    setReason('');
    setError('');
    setEditingSettings(false);
  };

  const updateAccountDraft = (key, value) => {
    setError('');
    setNotice('');
    setAccountDraft((current) => ({ ...current, [key]: value }));
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!editingAccount || accountSaving) return;

    const name = accountDraft.name.trim();
    const email = accountDraft.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 100) {
      setError('Admin name must be between 2 and 100 characters.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid admin email address.');
      return;
    }
    if (!accountDraft.currentPassword) {
      setError('Enter your current password to update account credentials.');
      return;
    }

    setAccountSaving(true);
    setError('');
    setNotice('');

    try {
      const data = await adminApi.updateMyAccount({
        name,
        email,
        currentPassword: accountDraft.currentPassword,
      });
      setAccountDraft({ name: data.admin?.name || name, email: data.admin?.email || email, currentPassword: '' });
      setEditingAccount(false);
      setNotice('Admin account updated and the change was recorded in Audit Log.');
      await refreshAdmin();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccountSaving(false);
    }
  };

  const cancelAccountEdit = () => {
    setAccountDraft({ name: admin?.name || '', email: admin?.email || '', currentPassword: '' });
    setEditingAccount(false);
    setError('');
  };

  const updatePasswordDraft = (key, value) => {
    setError('');
    setNotice('');
    setPasswordError('');
    setPasswordNotice('');
    setPasswordDraft((current) => ({ ...current, [key]: value }));
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!changingPassword || passwordSaving) return;

    setError('');
    setNotice('');
    setPasswordError('');
    setPasswordNotice('');

    if (!passwordDraft.currentPassword || !passwordDraft.newPassword) {
      setPasswordError('Current password and new password are required.');
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (canRead && passwordDraft.newPassword.length < passwordMinLength) {
      setPasswordError(`New password must be at least ${passwordMinLength} characters.`);
      return;
    }

    setPasswordSaving(true);

    try {
      const data = await adminApi.changeMyPassword({
        currentPassword: passwordDraft.currentPassword,
        newPassword: passwordDraft.newPassword,
      });
      setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
      setNotice(data.message || 'Password changed successfully.');
      setPasswordNotice(data.message || 'Password changed successfully.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const cancelPasswordChange = () => {
    setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setChangingPassword(false);
    setError('');
    setPasswordError('');
    setPasswordNotice('');
  };


  const startMfaSetup = async () => {
    if (!mfaCurrentPassword || mfaLoading) {
      setError('Enter your current password to start MFA setup.');
      return;
    }

    setMfaLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.mfaSetup(mfaCurrentPassword);
      setMfaSetup(data);
      setShowMfaSetupKey(false);
      setMfaOtp('');
      setNotice('MFA setup is ready. Add the account to your authenticator app and verify the code.');
    } catch (err) {
      setError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const enableMfa = async (event) => {
    event.preventDefault();
    if (!mfaSetup || !mfaCurrentPassword || !mfaOtp || mfaLoading) return;

    setMfaLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.enableMfa({
        currentPassword: mfaCurrentPassword,
        otp: mfaOtp,
      });
      setMfaSetup(null);
      setMfaCurrentPassword('');
      setMfaOtp('');
      setMfaRecoveryCodes(data.recoveryCodes || []);
      setMfaRecoveryVisible(true);
      setNotice('MFA is enabled. Save the recovery codes before leaving this page.');
      await refreshAdmin();
    } catch (err) {
      setError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!mfaCurrentPassword || !mfaOtp || mfaLoading) {
      setError('Enter your current password and MFA code to disable MFA.');
      return;
    }

    setMfaLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.disableMfa({
        currentPassword: mfaCurrentPassword,
        otp: mfaOtp,
      });
      setMfaCurrentPassword('');
      setMfaOtp('');
      setNotice(data.message || 'MFA disabled.');
      await refreshAdmin();
    } catch (err) {
      setError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const regenerateRecoveryCodes = async (event) => {
    event.preventDefault();
    if (!mfaRecoveryPassword || !mfaRecoveryOtp || mfaLoading) return;

    setMfaLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await adminApi.regenerateMfaRecoveryCodes({
        currentPassword: mfaRecoveryPassword,
        otp: mfaRecoveryOtp,
      });
      setMfaRecoveryPassword('');
      setMfaRecoveryOtp('');
      setMfaRecoveryCodes(data.recoveryCodes || []);
      setMfaRecoveryVisible(true);
      setNotice('New MFA recovery codes generated. Previous recovery codes are no longer valid.');
    } catch (err) {
      setError(err.message);
    } finally {
      setMfaLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <ModuleHeader eyebrow="Administration" title="Settings" description="Admin policies and configuration." />
        <div className="border border-creator-border bg-creator-white p-8 text-sm text-creator-muted shadow-panel">
          Loading settings…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <ModuleHeader
        eyebrow="Settings"
        title="Settings"
        description="Manage your admin account and security. Administrative policies appear only when your role permits them."
        action={
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${canWrite ? 'border-creator-border bg-creator-white text-creator-black' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <ShieldCheck size={14} />
            {canWrite ? 'Settings write access' : canRead ? 'Read only' : 'Personal settings'}
          </span>
        }
      />

      {error && <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 flex items-center gap-2 border border-creator-border bg-creator-white px-4 py-3 text-sm text-creator-black"><CheckCircle2 size={16} />{notice}</div>}

      {canRead ? (
        <form onSubmit={save}>
          <section className="border border-creator-border bg-creator-white shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-creator-border px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Admin policy</div>
                <h2 className="mt-2 text-base font-semibold text-creator-black">Access and account policy</h2>
                <p className="mt-1 text-sm leading-6 text-creator-muted">These values preserve the current defaults while making the policies explicitly manageable from CD_ADMIN.</p>
              </div>
              {canWrite && !editingSettings && (
                <button
                  type="button"
                  onClick={() => { setEditingSettings(true); setNotice(''); setError(''); }}
                  className="rounded-md border border-creator-border bg-creator-white px-4 py-2.5 text-sm font-semibold text-creator-black hover:bg-creator-surface"
                >
                  Edit settings
                </button>
              )}
              {editingSettings && (
                <button
                  type="button"
                  onClick={cancelSettingsEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40"
                >
                  <X size={15} />
                  Cancel
                </button>
              )}
            </div>

            <div className="divide-y divide-creator-border">
              {settings.map((item) => (
                <div key={item.key} className="grid gap-5 px-6 py-6 md:grid-cols-[1fr_220px] md:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-creator-black">
                      {item.key === 'ADMIN_SESSION_HOURS' && <Clock3 size={16} />}
                      {item.key === 'INVITATION_EXPIRY_HOURS' && <KeyRound size={16} />}
                      {item.key === 'PASSWORD_MIN_LENGTH' && <ShieldCheck size={16} />}
                      {item.label}
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-creator-muted">{item.description}</p>
                    <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-creator-faint">
                      Applies to {item.appliesTo.toLowerCase()} · default {item.defaultValue} {item.unit}
                    </div>
                    <div className="mt-2 text-[10px] text-creator-faint">Last customised: {formatDate(item.updatedAt)}</div>
                  </div>

                  <div>
                    <label htmlFor={item.key} className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">Value</label>
                    <div className="flex items-center gap-2">
                      <input
                        id={item.key}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={draft[item.key] ?? ''}
                        readOnly={!editingSettings}
                        disabled={!canWrite && !editingSettings}
                        onChange={(event) => updateDraft(item.key, event.target.value)}
                        className="w-full border border-creator-border bg-creator-white px-3 py-3 text-sm font-medium text-creator-black outline-none focus:border-creator-black read-only:cursor-default read-only:bg-creator-surface read-only:text-creator-black disabled:bg-creator-surface disabled:text-creator-muted"
                      />
                      <span className="min-w-[82px] text-xs text-creator-muted">{item.unit}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-creator-faint">Allowed: {item.min}–{item.max}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {editingSettings && (
            <section className="mt-4 border border-creator-border bg-creator-white p-6 shadow-panel">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-creator-faint">Change control</div>
              <h2 className="mt-2 text-sm font-semibold text-creator-black">Why are you changing these settings?</h2>
              <p className="mt-1 text-sm leading-6 text-creator-muted">A reason is required so the change appears in Audit Log with actor, role snapshot, request ID, before/after values and operator note.</p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={!canWrite || saving || !dirty}
                maxLength={500}
                rows={3}
                placeholder={dirty ? 'For example: Tighten admin session policy for internal access review.' : 'Make a setting change to add an audit reason.'}
                className="mt-4 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black disabled:bg-creator-surface disabled:text-creator-faint"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={cancelSettingsEdit} disabled={saving} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40">Cancel</button>
                <button type="submit" disabled={!canWrite || !dirty || saving || reason.trim().length < 3} className="inline-flex items-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:cursor-not-allowed disabled:opacity-40">
                  {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                  Save settings
                </button>
              </div>
            </section>
          )}
        </form>
      ) : (
        <section className="border border-creator-border bg-creator-white p-6 shadow-panel">
          <div className="flex items-start gap-3">
            <LockKeyhole size={18} className="mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-creator-black">Administrative settings</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-creator-muted">Your account can use the personal settings below, but your role does not include access to global administrator policies.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-4 border border-creator-border bg-creator-white p-6 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><UserCircle2 size={18} /><h2 className="text-sm font-semibold text-creator-black">My admin account</h2></div>
            {!editingAccount && !changingPassword && (
              <button
                type="button"
                onClick={() => { setEditingAccount(true); setNotice(''); setError(''); }}
                className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-semibold text-creator-black hover:bg-creator-surface"
              >
                Edit account
              </button>
            )}
          </div>

          {!editingAccount ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Name', admin?.name],
                ['Email', admin?.email],
                ['Role', admin?.role],
                ['Last login', admin?.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString('en-IN') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="border border-creator-border bg-creator-surface px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">{label}</div>
                  <div className="mt-2 text-sm font-medium text-creator-black">{value || '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={saveAccount} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-creator-black">
                Name
                <input value={accountDraft.name} onChange={(event) => updateAccountDraft('name', event.target.value)} className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
              </label>
              <label className="text-sm font-medium text-creator-black">
                Email
                <input type="email" value={accountDraft.email} onChange={(event) => updateAccountDraft('email', event.target.value)} className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
              </label>
              <label className="text-sm font-medium text-creator-black md:col-span-2">
                Current password
                <input type="password" value={accountDraft.currentPassword} onChange={(event) => updateAccountDraft('currentPassword', event.target.value)} autoComplete="current-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="Required to change account credentials" />
              </label>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button type="button" onClick={cancelAccountEdit} disabled={accountSaving} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40">Cancel</button>
                <button type="submit" disabled={accountSaving} className="inline-flex items-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">
                  {accountSaving && <LoaderCircle size={15} className="animate-spin" />}
                  Save account
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-creator-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-creator-black"><LockKeyhole size={16} /> Password</div>
                <p className="mt-1 text-sm text-creator-muted">Change the password for the currently signed-in admin account.</p>
              </div>
              {!changingPassword && (
                <button
                  type="button"
                  onClick={() => { setChangingPassword(true); setEditingAccount(false); setNotice(''); setError(''); setPasswordError(''); setPasswordNotice(''); }}
                  className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-semibold text-creator-black hover:bg-creator-surface"
                >
                  Change password
                </button>
              )}
            </div>

            {(passwordError && changingPassword) && <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{passwordError}</div>}
            {passwordNotice && <div className="mt-4 border border-creator-border bg-creator-white px-4 py-3 text-sm text-creator-black" role="status">{passwordNotice}</div>}

            {changingPassword && (
              <>
                <form onSubmit={savePassword} className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-creator-black">
                  Current password
                  <input type="password" value={passwordDraft.currentPassword} onChange={(event) => updatePasswordDraft('currentPassword', event.target.value)} autoComplete="current-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                </label>
                <label className="text-sm font-medium text-creator-black">
                  New password
                  <input type="password" value={passwordDraft.newPassword} onChange={(event) => updatePasswordDraft('newPassword', event.target.value)} autoComplete="new-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                  <span className="mt-2 block text-[10px] text-creator-faint">
                    {canRead
                      ? `Minimum ${passwordMinLength} characters`
                      : 'Minimum length is enforced by your administrator.'}
                  </span>
                </label>
                <label className="text-sm font-medium text-creator-black">
                  Confirm new password
                  <input type="password" value={passwordDraft.confirmPassword} onChange={(event) => updatePasswordDraft('confirmPassword', event.target.value)} autoComplete="new-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" />
                </label>
                <div className="flex justify-end gap-2 md:col-span-3">
                  <button type="button" onClick={cancelPasswordChange} disabled={passwordSaving} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-surface disabled:opacity-40">Cancel</button>
                  <button type="submit" disabled={passwordSaving} className="inline-flex items-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">
                    {passwordSaving && <LoaderCircle size={15} className="animate-spin" />}
                    Change password
                  </button>
                </div>
              </form>
              </>
            )}
          </div>
        </section>

  
      <section className="mt-4 border border-creator-border bg-creator-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3"><ShieldCheck size={18} /><h2 className="text-sm font-semibold text-creator-black">Multi-factor authentication</h2></div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-creator-muted">Protect the admin account with a time-based one-time password. Recovery codes are shown only when generated and are never stored in plaintext.</p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${admin?.mfaEnabled ? 'border-creator-border bg-creator-black text-creator-white' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <ShieldCheck size={14} /> {admin?.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
          </span>
        </div>

        {!admin?.mfaEnabled ? (
          <div className="mt-5 border border-creator-border bg-creator-surface p-5">
            {!mfaSetup ? (
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="text-sm font-medium text-creator-black">
                  Current password
                  <input type="password" value={mfaCurrentPassword} onChange={(event) => setMfaCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full border border-creator-border bg-creator-white px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="Required to begin MFA setup" />
                </label>
                <button type="button" onClick={startMfaSetup} disabled={mfaLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-creator-black px-5 text-sm font-semibold text-creator-white disabled:opacity-40">
                  {mfaLoading ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  Set up MFA
                </button>
              </div>
            ) : (
              <form onSubmit={enableMfa} className="space-y-6">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">Authenticator setup</div>
                  <h3 className="mt-2 text-base font-semibold text-creator-black">Secure your admin account with an authenticator app</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-creator-muted">Scan the QR code with your authenticator app, then enter the six-digit verification code it generates. MFA becomes active only after verification succeeds.</p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                  <div className="flex min-h-[260px] items-center justify-center border border-creator-border bg-white p-5">
                    <MfaQrCode value={mfaSetup.otpauthUri} />
                  </div>

                  <div className="space-y-5 border border-creator-border bg-creator-white p-5">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">1 · Scan this code</div>
                      <p className="mt-2 text-sm leading-6 text-creator-muted">Open your authenticator app and scan the QR code shown here.</p>
                    </div>

                    <div className="border-t border-creator-border pt-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">2 · Can't scan?</div>
                      <button
                        type="button"
                        onClick={() => setShowMfaSetupKey((current) => !current)}
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-creator-black hover:underline"
                        aria-expanded={showMfaSetupKey}
                      >
                        {showMfaSetupKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        {showMfaSetupKey ? 'Hide setup key' : 'Show setup key'}
                      </button>

                      {showMfaSetupKey && (
                        <div className="mt-3 border border-creator-border bg-creator-surface p-4">
                          <div className="break-all font-mono text-sm font-semibold tracking-[0.1em] text-creator-black">{mfaSetup.secret}</div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(mfaSetup.secret)}
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-creator-muted hover:text-creator-black"
                          >
                            <Copy size={13} /> Copy setup key
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-creator-border pt-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Account</div>
                      <div className="mt-2 text-sm font-medium text-creator-black">{admin?.email}</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-creator-border pt-5">
                  <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
                    <label className="text-sm font-medium text-creator-black">
                      3 · Verification code
                      <input value={mfaOtp} onChange={(event) => setMfaOtp(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full border border-creator-border bg-creator-white px-3 py-3 text-sm tracking-[0.15em] outline-none focus:border-creator-black" placeholder="Enter 6-digit code" aria-describedby="mfa-verification-help" />
                    </label>
                    <div id="mfa-verification-help" className="text-xs leading-5 text-creator-muted">Use the code currently displayed in your authenticator app.</div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setMfaSetup(null); setShowMfaSetupKey(false); setMfaOtp(''); }} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-medium text-creator-muted hover:bg-creator-white">Cancel setup</button>
                  <button type="submit" disabled={mfaLoading || mfaOtp.length !== 6} className="inline-flex items-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white disabled:opacity-40">{mfaLoading && <LoaderCircle size={15} className="animate-spin" />} Enable MFA</button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Account</div><div className="mt-2 text-sm font-semibold text-creator-black">Protected with TOTP</div></div>
              <div className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Recovery codes</div><div className="mt-2 text-sm font-semibold text-creator-black">{mfaRecoveryCodes.length ? 'Available in this session' : 'Stored as one-time hashes'}</div></div>
              <div className="border border-creator-border bg-creator-surface p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-creator-faint">Session safety</div><div className="mt-2 text-sm font-semibold text-creator-black">Other sessions revoked on disable</div></div>
            </div>

            {mfaRecoveryVisible && mfaRecoveryCodes.length ? (
              <div className="border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center justify-between gap-4"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">Save these now</div><p className="mt-2 text-sm text-amber-900">Each recovery code can be used once. This screen will not show them again after you leave it.</p></div><button type="button" onClick={() => setMfaRecoveryVisible(false)} className="text-xs font-semibold text-amber-900">Hide</button></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{mfaRecoveryCodes.map((code) => <div key={code} className="border border-amber-200 bg-white px-3 py-2 text-center font-mono text-sm font-semibold tracking-[0.08em] text-amber-950">{code}</div>)}</div>
              </div>
            ) : null}

            <div className="border-t border-creator-border pt-5">
              <div className="text-sm font-semibold text-creator-black">Regenerate recovery codes</div>
              <p className="mt-1 text-sm text-creator-muted">This invalidates every previous recovery code.</p>
              <form onSubmit={regenerateRecoveryCodes} className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-creator-black">Current password<input type="password" value={mfaRecoveryPassword} onChange={(event) => setMfaRecoveryPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
                <label className="text-sm font-medium text-creator-black">Authenticator code<input value={mfaRecoveryOtp} onChange={(event) => setMfaRecoveryOtp(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm tracking-[0.15em] outline-none focus:border-creator-black" /></label>
                <div className="flex justify-end md:col-span-2"><button type="submit" disabled={mfaLoading || mfaRecoveryOtp.length !== 6} className="rounded-md border border-creator-border px-4 py-2.5 text-sm font-semibold text-creator-black hover:bg-creator-surface disabled:opacity-40">Regenerate codes</button></div>
              </form>
            </div>

            <div className="border-t border-red-200 pt-5">
              <div className="text-sm font-semibold text-creator-black">Disable MFA</div>
              <p className="mt-1 text-sm text-creator-muted">Requires the current password and a valid authenticator or recovery code. Other admin sessions are revoked.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-end">
                <label className="text-sm font-medium text-creator-black">Current password<input type="password" value={mfaCurrentPassword} onChange={(event) => setMfaCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
                <label className="text-sm font-medium text-creator-black">Authenticator / recovery code<input value={mfaOtp} onChange={(event) => setMfaOtp(event.target.value)} autoComplete="one-time-code" className="mt-2 w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" /></label>
                <button type="button" onClick={disableMfa} disabled={mfaLoading} className="h-11 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-40">Disable MFA</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 border border-creator-border bg-creator-white p-6 shadow-panel">
          <div className="flex items-center gap-3"><ShieldCheck size={18} /><h2 className="text-sm font-semibold text-creator-black">Security posture</h2></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['HttpOnly session cookie', 'Enabled'],
              ['Server-side RBAC', 'Enabled'],
              ['Audit trail for settings', 'Enabled'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border border-creator-border px-4 py-4">
                <span className="text-sm text-creator-black">{label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-creator-black">{value}</span>
              </div>
            ))}
          </div>
      </section>
    </div>
  );
}