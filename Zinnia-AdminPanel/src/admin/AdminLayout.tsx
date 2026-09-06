import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './auth/AdminAuthProvider';
import {
  LayoutDashboard,
  CreditCard,
  CalendarCheck,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  LogOut,
  Clock,
  Menu,
  X,
  Zap,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  // Target registration closing countdown: Sept 15, 2026 23:59:59 UTC
  useEffect(() => {
    const targetDate = new Date('2026-09-15T23:59:59Z').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        setCountdown('Registration Closed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'TREASURER', 'GATE_ADMIN', 'FOOD_ADMIN', 'EVENT_COORDINATOR'] },
    { label: 'Payments', path: '/admin/payments', icon: CreditCard, roles: ['SUPER_ADMIN', 'TREASURER'] },
    { label: 'Events', path: '/admin/events', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'EVENT_COORDINATOR'] },
    { label: 'Exports', path: '/admin/exports', icon: FileSpreadsheet, roles: ['SUPER_ADMIN', 'TREASURER', 'GATE_ADMIN', 'FOOD_ADMIN', 'EVENT_COORDINATOR'] },
    { label: 'Settings', path: '/admin/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
    { label: 'Audit Log', path: '/admin/audit', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  ];

  const role = user?.role || 'SUPER_ADMIN';
  const filteredNavItems = navItems.filter(item => role === 'SUPER_ADMIN' || item.roles.includes(role));

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Nav */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="text-indigo-500 fill-indigo-500" size={24} />
          <span className="font-extrabold text-lg tracking-wider text-white">ZINNIA <span className="text-indigo-400">2026</span></span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 space-y-6">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 px-2">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Zap size={24} className="fill-indigo-500/30" />
            </div>
            <div>
              <div className="font-black text-lg tracking-wider text-white">ZINNIA 2026</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Admin Console</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-4">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-xs'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Badge & Sign Out */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-3">
          <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate">{user?.name || 'Administrator'}</div>
              <div className="text-[10px] text-amber-400 font-mono font-semibold uppercase">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-lg transition"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-slate-900/70 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <Clock size={16} className="text-indigo-400" />
            <span>Registration Close:</span>
            <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {countdown || 'Calculating...'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Flask API Connected</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
