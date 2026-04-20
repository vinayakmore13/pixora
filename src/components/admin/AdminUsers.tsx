import {
  ExternalLink,
  Mail,
  MoreVertical,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { DataTable } from './DataTable';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  user_type: 'couple' | 'photographer';
  is_admin: boolean;
  avatar_url?: string;
  created_at: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdmin(userId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentStatus } : u));
    } catch (err: any) {
      alert(err.message);
    }
  }

  const columns = [
    {
      header: 'User',
      accessorKey: 'full_name',
      cell: (user: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              user.full_name?.charAt(0) || 'U'
            )}
          </div>
          <div>
            <p className="font-semibold text-on-surface">{user.full_name}</p>
            <p className="text-xs text-on-surface-variant flex items-center gap-1">
              <Mail size={12} /> {user.email}
            </p>
          </div>
        </div>
      )
    },
    {
      header: 'Role',
      accessorKey: 'user_type',
      cell: (user: UserProfile) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight ${user.user_type === 'photographer'
            ? 'bg-purple-50 text-purple-600 border border-purple-100'
            : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
          {user.user_type}
        </span>
      )
    },
    {
      header: 'Joined',
      accessorKey: 'created_at',
      cell: (user: UserProfile) => (
        <p className="text-on-surface-variant">
          {new Date(user.created_at).toLocaleDateString()}
        </p>
      )
    },
    {
      header: 'Admin Access',
      accessorKey: 'is_admin',
      cell: (user: UserProfile) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleAdmin(user.id, user.is_admin);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${user.is_admin
              ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
              : 'bg-surface-container text-on-surface-variant border border-outline-variant/10 hover:bg-surface-container-high'
            }`}
        >
          {user.is_admin ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {user.is_admin ? 'Admin' : 'Regular'}
        </button>
      )
    },
    {
      header: '',
      accessorKey: 'actions',
      cell: (user: UserProfile) => (
        <div className="flex justify-end gap-2">
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
            <ExternalLink size={18} />
          </button>
          <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all">
              Filter by Profile
            </button>
            <button className="px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl text-sm font-medium border border-outline-variant/10 hover:bg-surface-container-high transition-all">
              All Users
            </button>
          </div>
          <p className="text-sm text-on-surface-variant">
            Total users found: <span className="font-bold text-on-surface">{users.length}</span>
          </p>
        </div>

        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          searchPlaceholder="Filter users by name, email or type..."
          onSearch={(term) => {
            // Implement local or remote search
          }}
        />
      </div>
    </AdminLayout>
  );
}
