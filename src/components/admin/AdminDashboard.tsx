import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Camera,
  Clock,
  IndianRupee,
  RefreshCw,
  TrendingUp,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';

interface Stats {
  total_users: number;
  total_photographers: number;
  total_events: number;
  events_this_month: number;
  total_revenue: number;
  platform_commission: number;
}

async function fetchAdminStats(): Promise<Stats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Run queries in parallel for speed
  const [totalUsers, totalPhotographers, totalEvents, eventsThisMonth, revenueData] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'user'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'photographer'),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('bookings').select('total_amount, status').in('status', ['confirmed', 'completed']),
  ]);

  const totalRevenue = (revenueData ?? []).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);

  return {
    total_users: totalUsers ?? 0,
    total_photographers: totalPhotographers ?? 0,
    total_events: totalEvents ?? 0,
    events_this_month: eventsThisMonth ?? 0,
    total_revenue: totalRevenue,
    platform_commission: Math.round(totalRevenue * 0.15),
  };
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching admin stats:', err);
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Real-time subscription — refresh stats on any DB changes
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, loadStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statCards = [
    {
      label: 'Total Events',
      value: stats?.total_events ?? 0,
      subValue: `+${stats?.events_this_month ?? 0} this month`,
      icon: Calendar,
      color: 'bg-blue-500',
      trend: 'up',
    },
    {
      label: 'Total Users',
      value: (stats?.total_users ?? 0) + (stats?.total_photographers ?? 0),
      subValue: `${stats?.total_users ?? 0} users · ${stats?.total_photographers ?? 0} photographers`,
      icon: Users,
      color: 'bg-indigo-500',
      trend: 'up',
    },
    {
      label: 'Total Revenue',
      value: `₹${(stats?.total_revenue ?? 0).toLocaleString('en-IN')}`,
      subValue: 'Confirmed bookings',
      icon: IndianRupee,
      color: 'bg-green-500',
      trend: 'up',
    },
    {
      label: 'Platform Commission',
      value: `₹${(stats?.platform_commission ?? 0).toLocaleString('en-IN')}`,
      subValue: '15% platform fee',
      icon: TrendingUp,
      color: 'bg-orange-500',
      trend: 'up',
    },
  ];

  if (error) {
    return (
      <AdminLayout title="Dashboard Overview">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="p-4 bg-error/5 border border-error/10 rounded-2xl flex items-start gap-3 text-error max-w-lg w-full">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load statistics</p>
              <p className="text-sm mt-1 opacity-80">{error}</p>
            </div>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard Overview">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-on-surface">Welcome back, Admin! 👋</h2>
            <p className="text-on-surface-variant">Here's what's happening on your platform today.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStats}
              disabled={loading}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors disabled:opacity-50"
              title="Refresh stats"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant/10 rounded-xl text-sm font-medium text-on-surface-variant">
              <Clock size={16} />
              {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, i) => (
            <div key={i} className="bg-white p-6 rounded-[32px] border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${card.color} text-white`}>
                  <card.icon size={24} />
                </div>
                {card.trend === 'up' ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <ArrowUpRight size={14} /> Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    <ArrowDownRight size={14} />
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-on-surface-variant">{card.label}</p>
              <h3 className="text-2xl font-bold text-on-surface mt-1">
                {loading ? (
                  <span className="inline-block h-7 w-20 bg-surface-container rounded-lg animate-pulse" />
                ) : (
                  card.value
                )}
              </h3>
              <p className="text-xs text-on-surface-variant mt-2 font-medium">{card.subValue}</p>
            </div>
          ))}
        </div>

        {/* Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-outline-variant/10 min-h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-on-surface mb-6">Booking Analytics</h3>
            <div className="flex-grow bg-surface-container-low rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant/50">
              <Camera size={40} className="opacity-30" />
              <p className="italic text-sm">Chart visualization coming soon</p>
              <p className="text-xs">Connect a charting library (e.g. Recharts) to show booking trends</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-outline-variant/10 flex flex-col">
            <h3 className="text-lg font-bold text-on-surface mb-6">Quick Stats</h3>
            <div className="space-y-5 flex-grow">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
                <span className="text-sm text-on-surface-variant">Users registered</span>
                <span className="text-sm font-bold text-on-surface">
                  {loading ? '...' : stats?.total_Users ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
                <span className="text-sm text-on-surface-variant">Photographers active</span>
                <span className="text-sm font-bold text-on-surface">
                  {loading ? '...' : stats?.total_photographers ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
                <span className="text-sm text-on-surface-variant">Events this month</span>
                <span className="text-sm font-bold text-primary">
                  {loading ? '...' : stats?.events_this_month ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Gross Revenue</span>
                <span className="text-sm font-bold text-green-600">
                  {loading ? '...' : `₹${(stats?.total_revenue ?? 0).toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-outline-variant/10 mt-6">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">System Status</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                <span className="text-on-surface-variant">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

