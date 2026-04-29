import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronRight,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Users,
  Menu
} from 'lucide-react';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';
import { cn } from '../../lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, isDesktopCollapsed, toggleSidebar } = useLayout();

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
    <div className="min-h-screen bg-surface-container-lowest flex overflow-x-hidden">
      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 fixed left-0 top-20 bottom-0 bg-white border-r border-outline-variant/10 p-4 z-40 transition-all duration-300 ease-in-out flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isDesktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
      )}>

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
      <main className={cn(
        "flex-1 p-4 md:p-8 pt-24 transition-all duration-300",
        isDesktopCollapsed ? "lg:ml-0" : "lg:ml-64"
      )}>
        <header className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-on-surface">{title}</h1>
        </header>

        {/* Page Content */}
        <div className="pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
