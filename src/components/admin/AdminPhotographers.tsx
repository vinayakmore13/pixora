import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Star
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { DataTable } from './DataTable';

interface Photographer {
  id: string;
  full_name: string;
  email: string;
  location: string;
  experience_years: number;
  rating: number;
  is_verified: boolean;
  user_type: string;
}

export function AdminPhotographers() {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotographers();
  }, []);

  async function fetchPhotographers() {
    try {
      // Joining profiles with photographer_profiles
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          user_type,
          photographer_profiles (
            location,
            experience_years,
            rating
          )
        `)
        .eq('user_type', 'photographer');

      if (error) throw error;

      // Flatten the data
      const flattened = data.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        location: p.photographer_profiles?.location || 'Not set',
        experience_years: p.photographer_profiles?.experience_years || 0,
        rating: p.photographer_profiles?.rating || 0,
        is_verified: true, // Placeholder for verification logic
        user_type: p.user_type
      }));

      setPhotographers(flattened);
    } catch (err: any) {
      console.error('Error fetching photographers:', err);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    {
      header: 'Photographer',
      accessorKey: 'full_name',
      cell: (p: Photographer) => (
        <div>
          <p className="font-semibold text-on-surface">{p.full_name}</p>
          <p className="text-xs text-on-surface-variant">{p.email}</p>
        </div>
      )
    },
    {
      header: 'Location',
      accessorKey: 'location',
      cell: (p: Photographer) => (
        <p className="text-sm text-on-surface-variant flex items-center gap-1">
          <MapPin size={14} /> {p.location}
        </p>
      )
    },
    {
      header: 'Rating',
      accessorKey: 'rating',
      cell: (p: Photographer) => (
        <div className="flex items-center gap-1 text-orange-500">
          <Star size={14} className="fill-orange-500" />
          <span className="text-sm font-bold">{p.rating || 'N/A'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'is_verified',
      cell: (p: Photographer) => (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit ${p.is_verified
            ? 'bg-blue-50 text-blue-600 border border-blue-100'
            : 'bg-orange-50 text-orange-600 border border-orange-100'
          }`}>
          {p.is_verified ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
          {p.is_verified ? 'Verified' : 'Pending'}
        </span>
      )
    },
    {
      header: '',
      accessorKey: 'actions',
      cell: (p: Photographer) => (
        <div className="flex justify-end gap-2">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors" title="View Portfolio">
            <ExternalLink size={18} />
          </button>
          <button className="p-2 text-error hover:bg-error/5 rounded-lg transition-colors" title="Suspend">
            <Ban size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Photographer Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 bg-surface-container text-on-surface font-medium rounded-xl text-sm border border-outline-variant/10 hover:bg-surface-container-high transition-all">
              Pending Verification (12)
            </button>
            <button className="px-5 py-2.5 bg-white text-on-surface-variant font-medium rounded-xl text-sm border border-outline-variant/10 hover:bg-surface-container-low transition-all">
              All Active (77)
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={photographers}
          loading={loading}
          searchPlaceholder="Search photographers..."
        />
      </div>
    </AdminLayout>
  );
}
