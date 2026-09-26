import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminShell from './components/AdminShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ActivateAdminPage from './pages/ActivateAdminPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import PaymentsPage from './pages/PaymentsPage.jsx';
import InvoicesPage from './pages/InvoicesPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AuditLogPage from './pages/AuditLogPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function ProtectedApp() {
  return <ProtectedRoute><AdminShell /></ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate-admin" element={<ActivateAdminPage />} />
          <Route element={<ProtectedApp />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/products" element={<Navigate to="/catalog" replace />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/admin-users" element={<AdminUsersPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
