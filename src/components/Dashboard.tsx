import { Briefcase, Calendar, Camera, ChevronRight, Clock, HelpCircle, LayoutGrid, MessageCircle, Palette, Plus, Search, Upload, Settings, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { SelfieCapture } from './SelfieCapture';
import { useLayout } from '../contexts/LayoutContext';

// Interface matches actual database schema (002_create_events.sql)
interface Event {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  cover_image_url: string | null;
  guest_qr_code: string;
  upload_password_hash: string;
  max_photos: number;
  allow_guest_uploads: boolean;
  moderate_guest_photos: boolean;
  ai_enabled: boolean;
  status: 'upcoming' | 'live' | 'completed';
  created_at: string;
  updated_at: string;
  // Computed counts
  photo_count?: number;
}

export function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, isDesktopCollapsed } = useLayout();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'live' | 'completed'>('all');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading) return;

    if (profile?.is_admin) {
      navigate('/partner/dashboard', { replace: true });
      return;
    }

    if (user && profile) {
      fetchEvents();
    } else if (user && !profile) {
      setLoading(false);
      setError('Unable to load your profile. Please try refreshing the page.');
    } else {
      setLoading(false);
    }
  }, [user, profile, authLoading, navigate]);

  async function fetchEvents() {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Fetch events — role-aware query
      // Photographers see events where they are photographer_id
      // Clients see events where they are client_id
      // (events they're invited to as participants)
      if (profile?.user_type === 'photographer') {
        query = query.or(`photographer_id.eq.${user.id},user_id.eq.${user.id}`);
      } else {
        query = query.or(`client_id.eq.${user.id},user_id.eq.${user.id}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Fetch photo counts per event in parallel
      const eventsWithCounts = await Promise.all(
        (data || []).map(async (event) => {
          const { count: photoCount } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);
          return { ...event, photo_count: photoCount ?? 0 };
        })
      );

      console.log('[Dashboard] Events fetched:', eventsWithCounts.length);
      setEvents(eventsWithCounts);
    } catch (err) {
      console.error('[Dashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = useMemo(() => events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      event.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [events, debouncedSearchQuery, statusFilter]);

  const upcomingEvents = useMemo(() => events.filter(e => e.status === 'upcoming').length, [events]);
  const liveEvents = useMemo(() => events.filter(e => e.status === 'live').length, [events]);
  if (loading || authLoading || profile?.is_admin) {
    return (
      <div className="pt-24 pb-20 min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface pt-20 overflow-x-hidden">
      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 fixed left-0 top-20 bottom-0 bg-white border-r border-outline-variant/10 p-4 z-40 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isDesktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
      )}>
        <nav className="space-y-2">
          <SidebarLink icon={<LayoutGrid size={20} />} label="Dashboard" to="/dashboard" active={location.pathname === '/dashboard'} />
          <SidebarLink icon={<MessageCircle size={20} />} label="Messages" to="/messages" active={location.pathname.startsWith('/messages')} />
          
          {profile?.user_type === 'photographer' && (
            <>
              <SidebarLink icon={<User size={20} />} label="My Profile" to={`/photographer/${user?.id}`} active={location.pathname.startsWith('/photographer/') && !location.pathname.includes('/edit')} />
              <SidebarLink icon={<Palette size={20} />} label="Studio Branding" to="/studio/branding" active={location.pathname === '/studio/branding'} />
            </>
          )}
          <SidebarLink icon={<HelpCircle size={20} />} label="Help & Support" to="/support" active={location.pathname === '/support'} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 p-4 md:p-8 transition-all duration-300",
        isDesktopCollapsed ? "lg:ml-0" : "lg:ml-64"
      )}>
        <header className="flex flex-col sm:flex-row justify-between sm:items-end mb-12 gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-on-surface mb-2">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-on-surface-variant">
              You have {upcomingEvents + liveEvents} event{upcomingEvents + liveEvents !== 1 ? 's' : ''} active.
            </p>
          </div>
          {profile?.user_type === 'photographer' ? (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                to="/upload"
                className="bg-surface-container-high text-on-surface px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 border border-outline-variant/10 shadow-sm active:scale-95 transition-all hover:bg-surface-container-highest w-full sm:w-auto"
              >
                <Upload size={20} className="text-primary" />
                Upload Photos
              </Link>
              <Link
                to="/create-event"
                className="bg-primary text-white px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all hover:brightness-110 w-full sm:w-auto"
              >
                <Plus size={20} />
                Create New Shoot
              </Link>
            </div>
          ) : (
            <Link
              to="/messages"
              className="bg-on-surface text-white px-6 py-3 rounded-full font-bold flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-on-surface/90 w-full sm:w-auto"
            >
              <MessageCircle size={20} />
              Messages
            </Link>
          )}
        </header>

        {/* Studio Setup Prompt — only for photographers without branding */}
        {profile?.user_type === 'photographer' && <StudioSetupBanner userId={user?.id} />}


        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<Calendar className="text-primary" />}
            label="Upcoming Events"
            value={upcomingEvents.toString().padStart(2, '0')}
            sub={liveEvents > 0 ? `${liveEvents} live now` : 'No live events'}
          />
          <StatCard
            icon={<Camera className="text-secondary" />}
            label="Total Events"
            value={events.length.toString()}
            sub={`+${events.filter(e => new Date(e.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week`}
          />
          <StatCard
            icon={<Plus className="text-tertiary" />}
            label="Total Photos"
            value={events.reduce((sum, e) => sum + (e.photo_count ?? 0), 0).toString()}
            sub="across all events"
          />
          <StorageUsageCard 
            used={profile?.storage_used || 0} 
            limit={profile?.storage_limit || 536870912} 
            plan={profile?.plan_type || 'free'}
          />
        </section>

        {/* My Events */}
        <section>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-serif font-bold text-on-surface">My Events</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-outline-variant/20 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none w-full sm:w-64"
                />
              </div>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-white border border-outline-variant/20 rounded-full py-2 px-4 text-sm focus:ring-1 focus:ring-primary outline-none text-on-surface-variant w-full sm:w-auto"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner size="large" text="Loading your events..." />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => fetchEvents()}
                className="ml-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-on-surface-variant" />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">No events yet</h3>
              <p className="text-on-surface-variant mb-6">
                {profile?.user_type === 'photographer'
                  ? 'Create your first shoot to get started!'
                  : 'Find a photographer and book them to see your events here!'}
              </p>
              {profile?.user_type === 'photographer' ? (
                <Link
                  to="/create-event"
                  className="inline-flex items-center gap-2 signature-gradient text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Plus size={20} />
                  Create Shoot
                </Link>
              ) : (
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2 signature-gradient text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Camera size={20} />
                  Find Photographers
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  id={event.id}
                  image={event.cover_image_url || "https://images.unsplash.com/photo-1519741497674-611481863552?w=800"}
                  title={event.name}
                  date={event.event_date ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                  location={event.location || 'Location TBD'}
                  photos={event.photo_count ?? 0}
                  guests={0}
                  status={event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showSelfieCapture && (
        <SelfieCapture
          onClose={() => setShowSelfieCapture(false)}
          onCaptureComplete={() => {
            setShowSelfieCapture(false);
          }}
        />
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active = false, to = "/" }: { icon: React.ReactNode, label: string, active?: boolean, to?: string }) {
  const { setIsSidebarOpen } = useLayout();
  return (
    <Link
      to={to}
      onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all group",
        active ? "bg-primary text-white silk-shadow" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
      )}
    >
      <span className={cn("transition-colors", active ? "text-white" : "text-on-surface-variant group-hover:text-primary")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub: string }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] silk-shadow border border-outline-variant/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-surface-container-low">
          {icon}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</div>
      </div>
      <div className="text-4xl font-serif font-bold text-on-surface mb-1">{value}</div>
      <div className="text-xs text-on-surface-variant/60 font-medium">{sub}</div>
    </div>
  );
}

interface EventCardProps { image: string, title: string, date: string, location: string, photos: number, guests: number, status: string, id: string }

const EventCard: React.FC<EventCardProps> = ({ image, title, date, location, photos, guests, status, id }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  return (
    <div 
      className="group bg-white rounded-[2.5rem] overflow-hidden silk-shadow border border-outline-variant/5 transition-all hover:-translate-y-1 duration-300 relative cursor-pointer"
      onClick={() => navigate(`/event/${id}`)}
    >
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt={title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface z-10">
          {status}
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{title}</h3>
        <div className="flex items-center gap-2 text-on-surface-variant text-xs mb-4">
          <Clock size={14} />
          {date} • {location}
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10">
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-sm font-bold text-on-surface">{photos}</div>
              <div className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/60">Photos</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-on-surface">{guests}</div>
              <div className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant/60">Guests</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.user_type === 'photographer' && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/upload?event=${id}`); }}
                className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-primary hover:text-white transition-all shadow-sm relative z-20"
                title="Upload Photos"
              >
                <Upload size={18} />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-white transition-all">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioSetupBanner({ userId }: { userId?: string }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('photographer_profiles')
        .select('studio_name')
        .eq('id', userId)
        .single();
      if (!data?.studio_name) setShow(true);
    })();
  }, [userId]);

  if (!show) return null;

  return (
    <div className="mb-8 p-6 bg-gradient-to-r from-primary/10 via-rose-50 to-primary/5 rounded-[2rem] border border-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Palette size={24} className="text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-on-surface">Complete your Studio Branding</h3>
          <p className="text-sm text-on-surface-variant">Add your logo, brand colors, and watermark to make galleries truly yours.</p>
        </div>
      </div>
      <button
        onClick={() => navigate('/studio/branding')}
        className="signature-gradient text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
      >
        Set Up Now
      </button>
    </div>
  );
}

function StorageUsageCard({ used, limit, plan }: { used: number, limit: number, plan: string }) {
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] silk-shadow border border-outline-variant/5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Storage Usage</div>
        <div className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">
          {plan}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-2xl font-bold text-on-surface">{formatSize(used)}</span>
          <span className="text-[10px] text-on-surface-variant">of {formatSize(limit)}</span>
        </div>
        <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-1000 ease-out",
              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <Link 
        to="/pricing" 
        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
      >
        Upgrade Plan <ChevronRight size={10} />
      </Link>
    </div>
  );
}


