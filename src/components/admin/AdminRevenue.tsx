import {
  ArrowRight,
  Calendar,
  Download,
  Filter,
  IndianRupee,
  TrendingUp
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { DataTable } from './DataTable';

interface Payout {
  id: string;
  photographer_name: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid';
  date: string;
}

export function AdminRevenue() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      // Fetch revenue directly from bookings table instead of depending on admin_stats view
      const { data, error } = await supabase
        .from('bookings')
        .select('total_amount, status')
        .in('status', ['confirmed', 'completed']);

      if (error) throw error;

      const totalRevenue = (data ?? []).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
      setStats({
        total_revenue: totalRevenue,
        platform_commission: Math.round(totalRevenue * 0.15),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const payoutData: Payout[] = [
    { id: '1', photographer_name: 'Rajesh Photography', amount: 245000, status: 'pending', date: '2026-03-28' },
    { id: '2', photographer_name: 'Mumbai Moments', amount: 189000, status: 'paid', date: '2026-03-25' },
    { id: '3', photographer_name: 'Delhi Dreams', amount: 156000, status: 'processing', date: '2026-03-29' }
  ];

  const columns = [
    {
      header: 'Photographer',
      accessorKey: 'photographer_name',
      cell: (p: Payout) => <p className="font-semibold">{p.photographer_name}</p>
    },
    {
      header: 'Total Earnings',
      accessorKey: 'amount',
      cell: (p: Payout) => <p className="font-bold">₹{p.amount.toLocaleString()}</p>
    },
    {
      header: 'Platform Fee (15%)',
      accessorKey: 'fee',
      cell: (p: Payout) => <p className="text-on-surface-variant font-medium">₹{(p.amount * 0.15).toLocaleString()}</p>
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (p: Payout) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${p.status === 'paid' ? 'bg-green-50 text-green-600' :
            p.status === 'processing' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
          }`}>
          {p.status}
        </span>
      )
    },
    {
      header: '',
      accessorKey: 'actions',
      cell: (p: Payout) => (
        <button className="text-primary font-bold text-xs flex items-center gap-1 hover:underline">
          View Payout <ArrowRight size={12} />
        </button>
      )
    }
  ];

  return (
    <AdminLayout title="Revenue & Financials">
      <div className="space-y-8">
        {/* Revenue Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[32px] border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500 text-white rounded-2xl">
                <IndianRupee size={24} />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +18% <TrendingUp size={14} />
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Total Platform Revenue</p>
            <h3 className="text-3xl font-bold text-on-surface mt-1">₹{(stats?.total_revenue || 0).toLocaleString()}</h3>
            <p className="text-xs text-on-surface-variant mt-2">Gross bookings volume</p>
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-primary text-white rounded-2xl">
                <TrendingUp size={24} />
              </div>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Estimated Commission</p>
            <h3 className="text-3xl font-bold text-primary mt-1">₹{(stats?.platform_commission || 0).toLocaleString()}</h3>
            <p className="text-xs text-on-surface-variant mt-2">Net platform income (15%)</p>
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-error text-white rounded-2xl">
                <Calendar size={24} />
              </div>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">Pending Payouts</p>
            <h3 className="text-3xl font-bold text-error mt-1">₹4,50,000</h3>
            <p className="text-xs text-on-surface-variant mt-2">Awaiting bank transfer</p>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-on-surface">Photographer Payouts</h4>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-xl border border-outline-variant/10 transition-colors">
                <Download size={18} /> Export CSV
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl transition-colors">
                <Filter size={18} /> Filter Date
              </button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={payoutData}
            loading={loading}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
