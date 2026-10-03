import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgeIndianRupee,
  Box,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

const navItems = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard.read', group: 'Workspace' },
  { label: 'Catalog', to: '/catalog', icon: Box, permission: 'products.read', group: 'Catalog' },
  { label: 'Pricing', to: '/pricing', icon: BadgeIndianRupee, permission: 'products.price.read', group: 'Catalog' },
  { label: 'Orders', to: '/orders', icon: ClipboardList, permission: 'orders.read', group: 'Operations' },
  { label: 'Customers', to: '/customers', icon: Users, permission: 'customers.read', group: 'Operations' },
  { label: 'Payments & Refunds', to: '/payments', icon: ReceiptIndianRupee, permission: 'refunds.read', group: 'Finance' },
  { label: 'Invoices', to: '/invoices', icon: FileText, permission: 'orders.read', group: 'Finance' },
  { label: 'Admin Users', to: '/admin-users', icon: ShieldCheck, permission: 'admin_users.read', group: 'Administration' },
  { label: 'Audit Log', to: '/audit-log', icon: Activity, permission: 'audit.read', group: 'Administration' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'Administration' },
];

function Navigation({ onNavigate }) {
  const { admin } = useAdminAuth();
  const grouped = useMemo(() => navItems.reduce((acc, item) => {
    if (!item.permission || admin?.permissions?.includes(item.permission)) {
      (acc[item.group] ||= []).push(item);
    }
    return acc;
  }, {}), [admin]);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="mb-6">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-creator-faint">{group}</div>
          <div className="space-y-1">
            {items.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${isActive ? 'bg-creator-black text-creator-white' : 'text-creator-muted hover:bg-creator-surface hover:text-creator-black'}`}>
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
                <ChevronRight size={14} className="ml-auto opacity-0 transition group-hover:opacity-60" />
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ mobile = false, onNavigate }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-creator-border px-6">
        <div><div className="text-[15px] font-semibold tracking-tight text-creator-black">CREATOR'S DESK</div><div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-creator-muted">Admin Console</div></div>
        {mobile && <button type="button" onClick={onNavigate} className="ml-auto rounded-md p-2 hover:bg-creator-surface"><X size={18} /></button>}
      </div>
      <Navigation onNavigate={onNavigate} />
      <div className="border-t border-creator-border p-4">
        <div className="mb-3 rounded-md bg-creator-surface px-3 py-3"><div className="truncate text-sm font-medium text-creator-black">{admin?.name || 'Admin'}</div><div className="mt-1 truncate text-xs text-creator-muted">{admin?.email}</div><div className="mt-2 inline-flex rounded-full border border-creator-border bg-creator-white px-2 py-1 text-[10px] font-semibold tracking-wide text-creator-black">{admin?.role || 'ADMIN'}</div></div>
        <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-creator-muted transition hover:bg-creator-surface hover:text-creator-black"><LogOut size={16} strokeWidth={1.8} />Sign out</button>
      </div>
    </div>
  );
}

export default function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-creator-surface text-creator-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-creator-border bg-creator-white lg:block"><SidebarContent /></aside>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-black/20" aria-label="Close menu" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-72 border-r border-creator-border bg-creator-white shadow-2xl"><SidebarContent mobile onNavigate={() => setMobileOpen(false)} /></aside></div>}
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-creator-border bg-creator-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><button type="button" className="rounded-md border border-creator-border p-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div><div className="text-xs uppercase tracking-[0.18em] text-creator-faint">Creator's Desk</div><div className="mt-1 text-lg font-semibold tracking-tight text-creator-black">Admin Console</div></div></div>
          <div className="hidden items-center gap-2 text-xs text-creator-muted sm:flex"><span className="h-2 w-2 rounded-full bg-black" />Secure admin session</div>
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
