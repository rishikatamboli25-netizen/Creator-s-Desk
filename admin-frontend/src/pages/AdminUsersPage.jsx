import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';
import ModuleHeader from '../components/ModuleHeader.jsx';
import { ConnectedState, ErrorState, LoadingState } from '../components/ModuleState.jsx';
import { adminApi } from '../lib/api.js';
import ActionGuard from '../components/ActionGuard.jsx';
import { toUserFacingMessage } from '../lib/userFacingError.js';

const formatDate = (value) => {
  if (!value) return 'Never';
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

const formatRemaining = (value) => {
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Expired';
  const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
};

const statusClasses = {
  ACTIVE: 'border-creator-border bg-creator-surface text-creator-black',
  SUSPENDED: 'border-amber-200 bg-amber-50 text-amber-800',
  INVITED: 'border-blue-200 bg-blue-50 text-blue-800',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClasses[status] || statusClasses.SUSPENDED}`}>
      {status}
    </span>
  );
}

function InviteModal({ roles, initialUser = null, onClose, onCreated }) {
  const [name, setName] = useState(initialUser?.name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [roleKey, setRoleKey] = useState(initialUser?.roleKey || roles[0]?.key || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await adminApi.inviteAdminUser({ name, email, roleKey });
      const url = new URL(data.invitation.invitationUrl, window.location.origin).toString();
      setCreated({ ...data.invitation, invitationUrl: url });
      onCreated(data.invitation);
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/admin-users' }));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!created?.invitationUrl) return;
    await navigator.clipboard.writeText(created.invitationUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <button type="button" aria-label="Close invitation dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative z-10 w-full max-w-lg border border-creator-border bg-creator-white shadow-2xl">
        <div className="border-b border-creator-border px-6 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">Administration</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-creator-black">{initialUser ? 'Reissue administrator invitation' : 'Invite administrator'}</h2>
          <p className="mt-2 text-sm leading-6 text-creator-muted">Create a one-time invitation. The email delivery provider is intentionally not coupled to CD_ADMIN yet.</p>
        </div>

        {!created ? (
          <form onSubmit={submit} className="space-y-4 px-6 py-6">
            <div>
              <label htmlFor="invite-name" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Name</label>
              <input id="invite-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="Administrator name" />
            </div>
            <div>
              <label htmlFor="invite-email" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Email</label>
              <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full border border-creator-border px-3 py-3 text-sm outline-none focus:border-creator-black" placeholder="admin@example.com" />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-creator-faint">Role</label>
              <select id="invite-role" value={roleKey} onChange={(event) => setRoleKey(event.target.value)} required className="w-full border border-creator-border bg-creator-white px-3 py-3 text-sm outline-none focus:border-creator-black">
                {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
              </select>
            </div>
            {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-md border border-creator-border px-4 py-3 text-sm font-medium text-creator-muted hover:bg-creator-surface">Cancel</button>
              <button type="submit" disabled={submitting || !roleKey} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-creator-black px-4 py-3 text-sm font-semibold text-creator-white disabled:cursor-not-allowed disabled:opacity-50">
                {submitting && <LoaderCircle size={15} className="animate-spin" />}
                Create invitation
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-6">
            <div className="flex items-start gap-3 border border-creator-border bg-creator-surface p-4">
              <ShieldCheck size={18} className="mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-creator-black">Invitation created</div>
                <p className="mt-1 text-sm leading-6 text-creator-muted">Share this one-time link with {created.email}. It expires in 48 hours.</p>
              </div>
            </div>
            <div className="mt-5 border border-creator-border bg-creator-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">Invitation link</div>
              <div className="mt-2 break-all text-xs leading-5 text-creator-muted">{created.invitationUrl}</div>
              <button type="button" onClick={copy} className="mt-4 inline-flex items-center gap-2 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface"><Clipboard size={14} /> Copy link</button>
            </div>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-md bg-creator-black px-4 py-3 text-sm font-semibold text-creator-white">Done</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminUsersPage() {
  const { admin } = useAdminAuth();
  const canWrite = admin?.permissions?.includes('admin_users.write');
  const [data, setData] = useState({ users: [], invitations: [] });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [guard, setGuard] = useState(null);

  const load = async () => {
    setError('');
    setNotice('');
    try {
      const [usersData, rolesData] = await Promise.all([
        adminApi.adminUsers(),
        adminApi.roles(),
      ]);
      setData({ users: usersData.users || [], invitations: usersData.invitations || [] });
      setRoles(rolesData.roles || []);
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/admin-users' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const roleName = useMemo(() => Object.fromEntries(roles.map((role) => [role.key, role.name])), [roles]);
  const activeCount = data.users.filter((user) => user.status === 'ACTIVE').length;
  const suspendedCount = data.users.filter((user) => user.status === 'SUSPENDED').length;
  const invitedCount = data.users.filter((user) => user.status === 'INVITED').length;

  const runAction = async (key, fn, successMessage) => {
    setBusyKey(key);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      setNotice(successMessage);
      return true;
    } catch (err) {
      setError(toUserFacingMessage(err, { status: err?.status, code: err?.code, url: '/api/admin/admin-users' }));
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const changeRole = (user, nextRoleKey) => {
    if (nextRoleKey === user.roleKey || !canWrite) return;
    setError('');
    setGuard({
      variant: 'confirm',
      title: `Change ${user.name}’s role?`,
      description: `This will change this administrator’s role and therefore their effective permissions.`,
      details: `Current: ${roleName[user.roleKey] || user.roleKey} · New: ${roleName[nextRoleKey] || nextRoleKey}`,
      actionLabel: 'Change role',
      execute: () => runAction(
        `role:${user.id}`,
        () => adminApi.updateAdminUserRole(user.id, nextRoleKey),
        `Role updated for ${user.name}.`
      ),
    });
  };

  const toggleStatus = (user) => {
    if (!canWrite || user.status === 'INVITED') return;
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setError('');
    setGuard({
      variant: nextStatus === 'SUSPENDED' ? 'slide' : 'confirm',
      title: `${nextStatus === 'SUSPENDED' ? 'Suspend' : 'Enable'} ${user.name}’s admin account?`,
      description: nextStatus === 'SUSPENDED'
        ? 'Suspension blocks this administrator from using the admin console until their account is enabled again.'
        : 'This will restore this administrator’s ability to sign in to the admin console.',
      details: `Current status: ${user.status}.`,
      actionLabel: nextStatus === 'SUSPENDED' ? 'Suspend account' : 'Enable account',
      execute: () => runAction(
        `status:${user.id}`,
        () => adminApi.updateAdminUserStatus(user.id, nextStatus),
        `${user.name} is now ${nextStatus === 'SUSPENDED' ? 'suspended' : 'active'}.`
      ),
    });
  };

  const revokeSessions = (user) => {
    if (!canWrite || !user.activeSessionCount) return;
    setError('');
    setGuard({
      variant: 'slide',
      title: `Revoke ${user.name}’s active sessions?`,
      description: 'Every current session for this administrator will be invalidated. They will need to sign in again.',
      details: `${user.activeSessionCount} active session${user.activeSessionCount === 1 ? '' : 's'} will be revoked.`,
      actionLabel: 'Revoke sessions',
      execute: () => runAction(
        `sessions:${user.id}`,
        () => adminApi.revokeAdminUserSessions(user.id),
        `Active sessions revoked for ${user.name}.`
      ),
    });
  };

  const confirmGuard = async () => {
    if (!guard?.execute || busyKey) return;
    const succeeded = await guard.execute();
    if (succeeded) setGuard(null);
  };

  const reinvite = (user) => {
    if (!canWrite) return;
    setInviteTarget(user);
    setInviteOpen(true);
  };

  if (loading) return <LoadingState label="Loading administrator access…" />;
  if (error && !data.users.length) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <ModuleHeader
        eyebrow="Administration"
        title="Admin Users"
        description="Manage internal administrator access, role assignment, account status and active sessions. Security controls are enforced server-side."
        action={(
          <div className="flex flex-wrap gap-2">
            <ConnectedState label={`${data.users.length} admin accounts`} />
            {canWrite && <button type="button" onClick={() => { setInviteTarget(null); setInviteOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-creator-black px-4 py-2.5 text-sm font-semibold text-creator-white hover:opacity-90"><Plus size={15} /> Invite admin</button>}
          </div>
        )}
      />

      {error && <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
      {notice && <div className="mb-4 border border-creator-border bg-creator-white px-4 py-3 text-sm text-creator-black" role="status">{notice}</div>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="border border-creator-border bg-creator-white p-6 shadow-panel"><UsersRound size={18} /><div className="mt-6 text-2xl font-semibold tracking-tight">{activeCount}</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-creator-muted">Active administrators</div></div>
        <div className="border border-creator-border bg-creator-white p-6 shadow-panel"><Ban size={18} /><div className="mt-6 text-2xl font-semibold tracking-tight">{suspendedCount}</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-creator-muted">Suspended accounts</div></div>
        <div className="border border-creator-border bg-creator-white p-6 shadow-panel"><KeyRound size={18} /><div className="mt-6 text-2xl font-semibold tracking-tight">{invitedCount}</div><div className="mt-1 text-xs uppercase tracking-[0.14em] text-creator-muted">Pending activation</div></div>
      </div>

      <div className="overflow-hidden border border-creator-border bg-creator-white shadow-panel">
        <div className="border-b border-creator-border px-5 py-4"><div className="text-sm font-semibold text-creator-black">Administrator directory</div><div className="mt-1 text-xs text-creator-muted">Passwords and session tokens are never exposed.</div></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="border-b border-creator-border bg-creator-surface">
              <tr>{['Administrator', 'Role', 'MFA', 'Status', 'Sessions', 'Last login', 'Created', 'Actions'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-creator-faint">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-creator-border">
              {data.users.map((user) => {
                const isSelf = user.id === admin?.id;
                const busy = busyKey.includes(`:${user.id}`);
                return (
                  <tr key={user.id} className="hover:bg-creator-surface/60">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full border border-creator-border bg-creator-surface"><UserRound size={15} /></div><div><div className="text-sm font-semibold text-creator-black">{user.name}{isSelf && <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.12em] text-creator-faint">You</span>}</div><div className="mt-1 text-xs text-creator-muted">{user.email}</div></div></div></td>
                    <td className="px-5 py-4">{user.status === 'INVITED' ? <span className="text-sm text-creator-black">{roleName[user.roleKey] || user.roleKey}</span> : <select value={user.roleKey} disabled={!canWrite || isSelf || busy} onChange={(event) => changeRole(user, event.target.value)} className="border border-creator-border bg-creator-white px-2.5 py-2 text-xs outline-none focus:border-creator-black disabled:opacity-50">{roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select>}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${user.mfaEnabled ? 'border-creator-border bg-creator-black text-creator-white' : 'border-creator-border bg-creator-surface text-creator-muted'}`}>
                        {user.mfaEnabled ? 'Enabled' : 'Off'}
                      </span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={user.status} /></td>
                    <td className="px-5 py-4"><div className="text-sm font-medium text-creator-black">{user.activeSessionCount}</div>{user.activeSessionCount > 0 && <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-creator-faint">Active</div>}</td>
                    <td className="px-5 py-4 text-xs text-creator-muted">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-5 py-4 text-xs text-creator-muted">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-4"><div className="flex flex-wrap justify-end gap-2">
                      {user.status === 'INVITED' ? <button type="button" disabled={!canWrite} onClick={() => reinvite(user)} className="inline-flex items-center gap-1.5 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface disabled:opacity-40"><RefreshCw size={13} /> Re-invite</button> : <>
                        <button type="button" disabled={!canWrite || isSelf || busy} onClick={() => toggleStatus(user)} className="rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface disabled:opacity-40">{user.status === 'ACTIVE' ? 'Suspend' : 'Enable'}</button>
                        {user.activeSessionCount > 0 && <button type="button" disabled={!canWrite || isSelf || busy} onClick={() => revokeSessions(user)} className="inline-flex items-center gap-1.5 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface disabled:opacity-40"><KeyRound size={13} /> Revoke sessions</button>}
                      </>}
                      {busy && <LoaderCircle size={15} className="mt-2 animate-spin text-creator-muted" />}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!data.users.length && <div className="flex min-h-52 items-center justify-center px-6 text-center text-sm text-creator-muted">No administrator accounts found.</div>}
        </div>
      </div>

      <div className="mt-6 border border-creator-border bg-creator-white shadow-panel">
        <div className="border-b border-creator-border px-5 py-4"><div className="text-sm font-semibold text-creator-black">Pending invitations</div><div className="mt-1 text-xs text-creator-muted">Invitation tokens are hashed at rest and never shown by the API after creation.</div></div>
        <div className="divide-y divide-creator-border">
          {data.invitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div><div className="text-sm font-semibold text-creator-black">{invitation.email}</div><div className="mt-1 text-xs text-creator-muted">{roleName[invitation.roleKey] || invitation.roleKey} · expires {formatDate(invitation.expiresAt)} · {formatRemaining(invitation.expiresAt)}</div></div>
              {canWrite && <button type="button" onClick={() => { setInviteTarget(data.users.find((user) => user.id === invitation.adminUserId) || null); setInviteOpen(true); }} className="inline-flex w-fit items-center gap-2 rounded-md border border-creator-border px-3 py-2 text-xs font-semibold text-creator-black hover:bg-creator-surface"><RefreshCw size={13} /> Issue new link</button>}
            </div>
          ))}
          {!data.invitations.length && <div className="px-5 py-8 text-sm text-creator-muted">No pending invitations.</div>}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 border border-creator-border bg-creator-white p-5 shadow-panel"><Check size={17} className="mt-0.5" /><div><div className="text-sm font-semibold text-creator-black">Access controls</div><p className="mt-1 text-sm leading-6 text-creator-muted">Only administrators with <span className="font-medium text-creator-black">admin_users.write</span> can mutate another admin account. Self-lockout and last-active-SUPER_ADMIN protections are enforced by the backend.</p></div></div>

      {guard && (
        <ActionGuard
          open
          variant={guard.variant}
          title={guard.title}
          description={guard.description}
          details={guard.details}
          actionLabel={guard.actionLabel}
          processing={Boolean(busyKey)}
          error={error}
          onConfirm={confirmGuard}
          onCancel={() => !busyKey && setGuard(null)}
        />
      )}
      {inviteOpen && <InviteModal roles={roles} initialUser={inviteTarget} onClose={() => { setInviteOpen(false); setInviteTarget(null); load(); }} onCreated={() => {}} />}
    </div>
  );
}
