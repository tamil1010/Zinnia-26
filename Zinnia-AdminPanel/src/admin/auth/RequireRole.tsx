import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthProvider';
import { AdminRole } from '../types';
import { ShieldAlert } from 'lucide-react';

interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles?: AdminRole[];
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Verifying Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = user.role === 'SUPER_ADMIN' || allowedRoles.includes(user.role);
    if (!hasRole) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-slate-400 text-sm">
            Your role (<span className="text-amber-400 font-semibold">{user.role}</span>) does not have permission to access this module.
          </p>
          <div className="pt-2">
            <a href="/admin" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg inline-block transition">
              Return to Dashboard
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
