import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const AdminApp = React.lazy(() => import('./admin/AdminApp'));

export const App: React.FC = () => {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-400">Loading Zinnia Admin Panel...</p>
          </div>
        </div>
      }
    >
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </React.Suspense>
  );
};

export default App;
