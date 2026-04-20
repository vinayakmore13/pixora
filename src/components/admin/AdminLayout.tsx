import {
  ArrowLeft,
  Bell,
  Calendar,
  Camera,
  ChevronRight,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Users
} from 'lucide-react';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/partner/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/partner/dashboard' },
    { label: 'Users', icon: Users, path: '/partner/users' },
    { label: 'Photographers', icon: Camera, path: '/partner/photographers' },
    { label: 'Events & Bookings', icon: Calendar, path: '/partner/events' },
    { label: 'Support Chats', icon: MessageSquare, path: '/partner/support' },
    { label: 'Revenue', icon: IndianRupee, path: '/partner/revenue' },
  ];

  return (
    <div className="min-h-screen bg-surface-container-lowest flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-outline-variant/10 flex flex-col fixed inset-y-0">
        <div className="p-6 border-b border-outline-variant/10">
          <Link to="/" className="text-2xl font-serif font-bold text-primary tracking-tighter">Pixora</Link>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium mt-1">Partner Portal</p>
        </div>

        <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-primary/5 text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
              >
                <item.icon size={20} className={isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'} />
                <span className="text-sm">{item.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/10 space-y-2">
          <Link
            to="/partner/dashboard"
            onClick={() => alert('Admin settings are coming soon!')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all"
          >
            <Settings size={20} />
            <span className="text-sm">Settings</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error hover:bg-error/5 transition-all text-left"
          >
            <LogOut size={20} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-outline-variant/10 sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {location.pathname !== '/partner/dashboard' && (
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 -ml-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold text-on-surface">{title}</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={18} />
              <input
                type="text"
                placeholder="Global search..."
                className="pl-10 pr-4 py-2 bg-surface-container rounded-full text-sm w-64 focus:ring-1 focus:ring-primary outline-none border-none"
              />
            </div>

            <button className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-on-surface">{profile?.full_name}</p>
                <p className="text-[10px] text-primary font-medium uppercase tracking-wider">Super Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
