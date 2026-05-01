import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { DataTable } from './DataTable';

interface Event {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: string;
  client_id: string;
  created_at: string;
}

export function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    {
      header: 'Event',
      accessorKey: 'name',
      cell: (event: Event) => (
        <div>
          <p className="font-semibold text-on-surface">{event.name}</p>
          <p className="text-xs text-on-surface-variant flex items-center gap-1">
            <Calendar size={12} /> {new Date(event.event_date).toLocaleDateString()}
          </p>
        </div>
      )
    },
    {
      header: 'Location',
      accessorKey: 'location',
      cell: (event: Event) => (
        <p className="text-on-surface-variant flex items-center gap-1">
          <MapPin size={14} /> {event.location}
        </p>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (event: Event) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${event.status === 'live'
            ? 'bg-green-50 text-green-600 border border-green-100'
            : event.status === 'pending'
              ? 'bg-orange-50 text-orange-600 border border-orange-100'
              : 'bg-surface-container text-on-surface-variant border border-outline-variant/10'
          }`}>
          {event.status}
        </span>
      )
    },
    {
      header: 'Progress',
      accessorKey: 'progress',
      cell: (event: Event) => (
        <div className="w-32">
          <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
            <span>Photos</span>
            <span>450</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[65%]"></div>
          </div>
        </div>
      )
    },
    {
      header: '',
      accessorKey: 'actions',
      cell: (event: Event) => (
        <div className="flex justify-end">
          <button className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl transition-all">
            Details <ArrowRight size={14} />
          </button>
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Events & Monitoring">
      <div className="space-y-8">
        {/* Real-time Monitor Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-primary/5 border border-primary/10 p-6 rounded-[24px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Clock size={20} />
              </div>
              <h4 className="font-bold text-on-surface">Live Now</h4>
            </div>
            <p className="text-3xl font-serif font-bold text-primary">23</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium italic">Active photo uploads across all events</p>
          </div>

          <div className="bg-green-50 border border-green-100 p-6 rounded-[24px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <CheckCircle2 size={20} />
              </div>
              <h4 className="font-bold text-on-surface">Completed</h4>
            </div>
            <p className="text-3xl font-serif font-bold text-green-600">1,068</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium italic">Events fully curated & delivered</p>
          </div>

          <div className="bg-orange-50 border border-orange-100 p-6 rounded-[24px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <AlertCircle size={20} />
              </div>
              <h4 className="font-bold text-on-surface">Pending Selection</h4>
            </div>
            <p className="text-3xl font-serif font-bold text-orange-600">89</p>
            <p className="text-xs text-on-surface-variant mt-1 font-medium italic">Events awaiting client selection</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={events}
          loading={loading}
          searchPlaceholder="Filter events by name, Users or location..."
        />
      </div>
    </AdminLayout>
  );
}

