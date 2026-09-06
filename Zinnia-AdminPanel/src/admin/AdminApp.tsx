import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { RequireRole } from './auth/RequireRole';
import { AdminLayout } from './AdminLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Events } from './pages/Events';
import { Payments } from './pages/Payments';
import { Exports } from './pages/Exports';
import { Settings } from './pages/Settings';
import { AuditLog } from './pages/AuditLog';

export const AdminApp: React.FC = () => {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <RequireRole>
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<Dashboard />} />
          <Route
            path="payments"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN', 'TREASURER']}>
                <Payments />
              </RequireRole>
            }
          />
          <Route
            path="events"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN', 'EVENT_COORDINATOR']}>
                <Events />
              </RequireRole>
            }
          />
          <Route path="exports" element={<Exports />} />
          <Route
            path="settings"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <Settings />
              </RequireRole>
            }
          />
          <Route
            path="audit"
            element={
              <RequireRole allowedRoles={['SUPER_ADMIN']}>
                <AuditLog />
              </RequireRole>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
};

export default AdminApp;
