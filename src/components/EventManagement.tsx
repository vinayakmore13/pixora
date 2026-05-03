import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit3,
  LayoutGrid,
  Loader2,
  Lock,
  MessageCircle,
  QrCode,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  CheckCircle2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { cn, slugify } from "../lib/utils";
import { azureStorageProvider } from "../lib/providers/azureStorageProvider";

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
  status: "upcoming" | "live" | "completed";
  created_at: string;
  updated_at: string;
}

export function EventManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "sharing" | "settings"
  >("overview");
  const [guestStats, setGuestStats] = useState({
    registrations: 0,
    matches: 0,
    matchedPhotos: 0,
    totalPhotos: 0
  });
  const isPhotographer = profile?.user_type === "photographer";

  useEffect(() => {
    if (id && user && !authLoading) {
      fetchEvent();
    }
  }, [id, user, authLoading]);

  // Calculate 30-day expiration
  const createdDate = event ? new Date(event.created_at) : new Date();
  const expiresAt = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));


  async function fetchGuestStats() {
    if (!id) return;
    try {
      const { count: regsCount } = await supabase
        .from("guest_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id);
      
      const { count: matchesCount } = await supabase
        .from("guest_matches")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id);

      const { count: photoCount } = await supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("event_id", id);

      setGuestStats({
        registrations: regsCount || 0,
        matches: matchesCount || 0,
        matchedPhotos: matchesCount || 0,
        totalPhotos: photoCount || 0
      });
    } catch (err) {
      console.error("Error fetching guest stats:", err);
    }
  }

  async function fetchEvent() {
    try {
      setLoading(true);
      setError(null);
      fetchGuestStats();

      // Both the photographer and the client associated with the event can fetch it
      let query = supabase.from("events").select("*").eq("id", id);

      if (isPhotographer) {
        query = query.or(
          `photographer_id.eq.${user?.id},user_id.eq.${user?.id}`,
        );
      } else {
        query = query.or(`client_id.eq.${user?.id},user_id.eq.${user?.id}`);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        throw fetchError;
      }

      setEvent(data);
    } catch (err) {
      console.error("Error fetching event:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch event");
    } finally {
      setLoading(false);
    }
  }

  const handleCopyLink = () => {
    if (event) {
      const url = `${window.location.origin}/gallery/${event.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPassword = () => {
    if (event) {
      navigator.clipboard.writeText(event.upload_password_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    try {
      setDeleting(true);
      console.log(`[STORAGE] Starting deep cleanup for event: ${event.id}`);

      // Step 1: Fetch ALL photo records associated with this event
      const { data: photos } = await supabase
        .from('photos')
        .select('file_path')
        .eq('event_id', event.id);

      const photoPaths = (photos || []).map(p => p.file_path);
      console.log(`[STORAGE] Found ${photoPaths.length} photo records to delete`);

      // Step 2: Perform prefix-based folder deletion (New Hierarchy)
      const pName = slugify(profile?.full_name || profile?.studio_name || user?.email || 'photographer');
      const eName = slugify(event.name);
      
      // Try multiple possible prefixes to be safe
      const prefixes = [
        `${pName}/${eName}/events/${event.id}/`, // New Hierarchy
        `events/${event.id}/`,                  // Legacy Hierarchy
        `selections/`                           // AI Selections (if applicable)
      ];

      for (const prefix of prefixes) {
        console.log(`[STORAGE] Purging prefix: ${prefix}`);
        await azureStorageProvider.deleteFolder(prefix, 'photos');
      }

      // Step 3: Individual file deletion fallback (for any non-standard paths)
      if (photoPaths.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < photoPaths.length; i += batchSize) {
          const batch = photoPaths.slice(i, i + batchSize);
          await Promise.all(batch.map(async (path) => {
            try {
              await azureStorageProvider.deleteFile(path, 'photos');
            } catch (e) {
              // Ignore errors for individual files if already deleted by prefix
            }
          }));
        }
      }

      // Step 4: Delete the event record (Cascades to other DB tables)
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (deleteError) {
        throw deleteError;
      }

      // Delete cover image from storage if it exists
      if (event.cover_image_url) {
        try {
          const path = event.cover_image_url.split('/photos/')[1]?.split('?')[0];
          if (path) {
            await azureStorageProvider.deleteFile(decodeURIComponent(path), 'photos');
          }
        } catch (storageErr) {
          console.error("Error deleting cover image from storage:", storageErr);
        }
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting event:", err);
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleStatusChange = async (
    newStatus: "upcoming" | "live" | "completed",
  ) => {
    if (!event) return;

    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({ status: newStatus })
        .eq("id", event.id);

      if (updateError) {
        throw updateError;
      }

      setEvent((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err) {
      console.error("Error updating event status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update event status",
      );
    }
  };

  const handleToggleAiFinder = async () => {
    if (!event) return;
    const newVal = !event.ai_enabled;
    try {
      const { error: updateError } = await supabase
        .from("events")
        .update({ ai_enabled: newVal })
        .eq("id", event.id);
      if (updateError) throw updateError;
      setEvent((prev) => (prev ? { ...prev, ai_enabled: newVal } : null));
    } catch (err) {
      console.error("Error updating AI finder:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface pt-24 pb-20 px-8 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-surface pt-24 pb-20 px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            {error || "Event not found"}
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // Client View (Read-only)
  if (!isPhotographer && event) {
    return (
      <div className="min-h-screen bg-surface pt-24 pb-20 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </button>

          <div className="bg-white p-8 md:p-12 rounded-[3rem] silk-shadow border border-outline-variant/5 text-center mb-8">
            <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera size={40} className="text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-on-surface mb-4">
              {event.name}
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-8">
              Your event is being managed by your photographer. You can view the
              live gallery or share the guest QR code.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={`/gallery/${event.id}`}
                className="signature-gradient text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-lg"
              >
                View Photo Gallery
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Guest QR Code Card */}
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
              <h3 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                <Share2 className="text-primary" size={24} />
                Guest Access
              </h3>
              <p className="text-sm text-on-surface-variant mb-6">
                Share this code with your guests so they can view and upload
                photos (if enabled).
              </p>
              <div className="bg-surface-container-high py-8 rounded-3xl mb-6 text-center">
                <div className="text-5xl tracking-widest font-mono font-black text-primary">
                  {event.guest_qr_code}
                </div>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/e/${event.guest_qr_code || event.id}`;
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 bg-on-surface text-white py-3 rounded-full font-bold hover:bg-on-surface/90 transition-all active:scale-95"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Link Copied!" : "Copy Guest Link"}
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 flex flex-col justify-center">
              <h3 className="text-xl font-bold text-on-surface mb-6">
                Event Details
              </h3>
              <div className="space-y-4 text-on-surface-variant">
                <p className="flex items-center gap-3">
                  <Clock size={20} className="text-primary" />
                  {event.event_date
                    ? new Date(event.event_date).toLocaleDateString("en-US", {
                        dateStyle: "long",
                      })
                    : "TBD"}
                </p>
                <p className="flex items-center gap-3">
                  <Camera size={20} className="text-primary" />
                  Status:{" "}
                  <span className="capitalize font-bold text-on-surface ml-1">
                    {event.status}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Photographer View (Full Edit Access)
  return (
    <div className="min-h-screen bg-surface pt-24 pb-20 px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-4"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-3 text-primary font-bold text-xs uppercase tracking-[0.2em] mb-2 flex-wrap">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    event.status === "live"
                      ? "bg-green-500"
                      : event.status === "upcoming"
                        ? "bg-yellow-500"
                        : "bg-gray-400",
                  )}
                ></span>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)} Event
              </span>
              <span className="w-1 h-1 bg-outline-variant/50 rounded-full"></span>
              <span className={cn(
                "px-2 py-0.5 rounded-md",
                daysRemaining <= 5 ? "bg-red-100 text-red-700" : "bg-surface-container-high text-on-surface-variant"
              )}>
                Expires in {daysRemaining} days
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-on-surface mb-2">
              {event.name}
            </h1>
            <p className="text-on-surface-variant flex items-center gap-2">
              <Clock size={16} />
              {event.event_date
                ? new Date(event.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Date TBD"}{" "}
              • {event.location || "Location TBD"}
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              to={`/upload?event=${event.id}`}
              className="bg-white border border-outline-variant/20 text-on-surface px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-surface-container-low transition-all"
            >
              <Upload size={18} />
              Upload Photos
            </Link>
            <Link
              to={`/gallery/${event.id}`}
              className="signature-gradient text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <LayoutGrid size={18} />
              View Gallery
            </Link>
            <Link
              to={`/event/${event.id}/edit`}
              className="bg-white border border-outline-variant/20 text-on-surface px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-surface-container-low transition-all"
            >
              <Edit3 size={18} />
              Edit Details
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-red-50 border border-red-200 text-red-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-100 transition-all hidden md:flex"
            >
              <Trash2 size={18} />
              Delete
            </button>
          </div>
        </header>

        {/* Tabs — Clean & Minimal */}
        <div className="relative">
          <div className="flex gap-8 border-b border-outline-variant/10 mb-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "pb-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/30",
              )}
            >
              <QrCode size={16} />
              Sharing & Access
            </button>
            <button
              onClick={() => setActiveTab("sharing")}
              className={cn(
                "pb-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
                activeTab === "sharing"
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/30",
              )}
            >
              <Sparkles size={16} />
              AI Smart Share
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "pb-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/30",
              )}
            >
              <LayoutGrid size={16} />
              Event Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gallery Link & Password Card */}
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
              <h3 className="text-2xl font-bold text-on-surface mb-8">Share Gallery</h3>
              
              <div className="space-y-6">
                {/* Unified Gallery Link */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Gallery Link</label>
                  <div className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 border border-outline-variant/10">
                    <div className="flex-1 text-sm font-mono text-on-surface truncate">
                      {window.location.origin}/gallery/{event.id}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="p-2 bg-white rounded-xl text-on-surface-variant hover:text-primary transition-all active:scale-90"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Password Access */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Access Password</label>
                  <div className="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 border border-outline-variant/10">
                    <div className="flex-1 text-lg font-mono font-bold text-primary tracking-wider">
                      {event.upload_password_hash}
                    </div>
                    <button
                      onClick={handleCopyPassword}
                      className="p-2 bg-white rounded-xl text-on-surface-variant hover:text-primary transition-all active:scale-90"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-2 flex items-center gap-1">
                    <Lock size={10} />
                    This password is required for clients to view the gallery.
                  </p>
                </div>

                <div className="pt-6">
                  <Link
                    to={`/gallery/${event.id}`}
                    className="w-full bg-on-surface text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-on-surface/90 transition-all shadow-lg active:scale-[0.98]"
                  >
                    <LayoutGrid size={18} />
                    Open Live Gallery
                  </Link>
                </div>
              </div>
            </div>

            {/* Guest QR Code */}
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
              <h3 className="text-2xl font-bold text-on-surface mb-8 text-left">Guest Access</h3>
              <div className="bg-surface-container-low p-8 rounded-3xl flex flex-col items-center">
                <div className="bg-white p-5 rounded-2xl shadow-sm mb-6">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/e/${event.guest_qr_code || event.id}`)}`}
                    alt="Event QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
                <p className="text-3xl font-mono font-bold text-on-surface tracking-[0.3em] mb-2">
                  {event.guest_qr_code || '---'}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Event Code
                </p>
              </div>
              <div className="flex gap-4 mt-8">
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}/e/${event.guest_qr_code || event.id}`)}&format=png`}
                  download={`qr-${event.guest_qr_code || event.id}.png`}
                  className="flex-1 bg-white border border-outline-variant/20 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-on-surface hover:bg-surface-container-low transition-all"
                >
                  <Download size={18} />
                  Download
                </a>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/e/${event.guest_qr_code || event.id}`;
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 bg-primary/10 text-primary py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-all"
                >
                  <Share2 size={18} />
                  Share Link
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === "sharing" ? (
          <SmartShareManager eventId={event.id} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl silk-shadow border border-outline-variant/5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Guests</div>
                    <div className="text-2xl font-bold text-on-surface">{guestStats.registrations}</div>
                </div>
                <div className="bg-white p-5 rounded-3xl silk-shadow border border-outline-variant/5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Matches</div>
                    <div className="text-2xl font-bold text-primary">{guestStats.matches}</div>
                </div>
                <div className="bg-white p-5 rounded-3xl silk-shadow border border-outline-variant/5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Total Photos</div>
                    <div className="text-2xl font-bold text-on-surface">{guestStats.totalPhotos}</div>
                </div>
                <div className="bg-white p-5 rounded-3xl silk-shadow border border-outline-variant/5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Engagement</div>
                    <div className="text-2xl font-bold text-secondary">
                        {guestStats.registrations > 0 ? Math.round((guestStats.matches / guestStats.registrations) * 100) : 0}%
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
              <h3 className="text-xl font-bold text-on-surface mb-8">Permissions & Automation</h3>
              <div className="space-y-6">
                <PermissionItem
                  label="Enable AI photo finder for guests"
                  checked={event.ai_enabled}
                  onChange={handleToggleAiFinder}
                />
                <div className="h-px bg-outline-variant/10"></div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-on-surface">Allow Guest Uploads</div>
                    <div className="text-xs text-on-surface-variant">Let guests upload their own photos to this event</div>
                  </div>
                  <button
                    onClick={() => {}} // Hooked to Event Edit
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      event.allow_guest_uploads ? "bg-primary" : "bg-outline-variant/30"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                      event.allow_guest_uploads ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
                <div className="h-px bg-outline-variant/10"></div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-on-surface">Moderate Photos</div>
                    <div className="text-xs text-on-surface-variant">Review guest uploads before they go live</div>
                  </div>
                  <button
                    onClick={() => {}} // Hooked to Event Edit
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      event.moderate_guest_photos ? "bg-primary" : "bg-outline-variant/30"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                      event.moderate_guest_photos ? "right-1" : "left-1"
                    )}></div>
                  </button>
                </div>
              </div>
            </div>

            <Link
              to={`/event/${event.id}/edit`}
              className="w-full bg-surface-container-high text-on-surface py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all"
            >
              <Edit3 size={18} />
              Update Full Event Settings
            </Link>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-on-surface mb-4">
              Delete Event?
            </h3>
            <p className="text-on-surface-variant mb-6">
              Are you sure you want to delete "{event.name}"? This action cannot
              be undone and all photos will be permanently deleted.
              <br/><br/>
              <span className="text-sm font-medium border-l-2 border-primary pl-3 block text-primary/80">
                Note: Events and their photos are automatically deleted 30 days after creation. You can manually delete them here anytime you've completed your work.
              </span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-white border border-outline-variant/20 text-on-surface px-6 py-3 rounded-full font-bold hover:bg-surface-container-low transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════
   SMART SHARE MANAGER
   ═══════════════════════════════════════════════════════════════ */

function SmartShareManager({ eventId }: { eventId: string }) {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<{
    share_url: string;
    qr_code_svg: string;
    token: string;
    expires_at: string;
  } | null>(null);
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${BACKEND_URL}/share/${eventId}/create-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, expires_in_days: 7 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate link");
      }
      setShareData(data);
      refreshProfile(); // Update credits in UI
    } catch (err: any) {
      console.error("Link generation failed:", err);
      alert(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (shareData) {
      navigator.clipboard.writeText(shareData.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-on-surface">AI Smart Share</h3>
            <p className="text-sm text-on-surface-variant">Generative Personal Photo Access</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 p-4 bg-surface-container-low rounded-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Available Smart Shares</div>
          <div className="text-xl font-bold text-primary">{profile?.smart_shares_remaining || 0}</div>
        </div>

        <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
          Enable guests to find their own photos instantly using AI facial recognition. 
          When they open the link, they'll take a selfie and Pixvora will show them 
          only the photos they appear in.
        </p>

        <div className="space-y-6">
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Security Mode</h4>
            <div className="flex gap-4">
              <button
                onClick={() => setMode("password")}
                className={cn(
                  "flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  mode === "password" 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant"
                )}
              >
                <Lock size={20} />
                <span className="font-bold text-sm">Password</span>
              </button>
              <button
                onClick={() => setMode("otp")}
                className={cn(
                  "flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  mode === "otp" 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant"
                )}
              >
                <QrCode size={20} />
                <span className="font-bold text-sm">OTP (Auth)</span>
              </button>
            </div>
          </div>

          {(profile?.smart_shares_remaining || 0) > 0 ? (
            <button
              onClick={generateLink}
              disabled={loading}
              className="w-full signature-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
              Use 1 Smart Share Link
            </button>
          ) : (
            <Link
              to="/pricing"
              className="w-full bg-on-surface text-white py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-xl hover:brightness-110 active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-secondary" />
                <span>Unlock Smart Share Link</span>
              </div>
              <span className="text-[10px] opacity-60">Starts at ₹29 per share</span>
            </Link>
          )}
        </div>

      </div>

      <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 flex items-center justify-center min-h-[300px]">
        {shareData ? (
          <div className="w-full text-center space-y-6">
            <div className="inline-block bg-surface-container-low p-6 rounded-3xl">
              <div 
                className="w-48 h-48 bg-white p-2 rounded-xl shadow-sm"
                dangerouslySetInnerHTML={{ __html: shareData.qr_code_svg }}
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                <div className="flex-1 px-4 py-2 text-sm font-mono text-on-surface text-left truncate">
                  {shareData.share_url}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="bg-on-surface text-white p-3 rounded-xl hover:bg-on-surface/90 transition-all active:scale-95"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                <Clock size={12} />
                Expires: {new Date(shareData.expires_at).toLocaleDateString()}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant pt-4 border-t border-outline-variant/10">
              Share this link or QR code with guests to give them AI-powered personal access.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode size={32} className="text-on-surface-variant/20" />
            </div>
            <p className="text-on-surface-variant text-sm font-medium">Link preview will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   GUEST DELIVERY MANAGER
   ═══════════════════════════════════════════════════════════════ */

function GuestDeliveryManager({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuests();
    const channel = supabase
      .channel('guest_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_registrations', filter: `event_id=eq.${eventId}` }, fetchGuests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_matches', filter: `event_id=eq.${eventId}` }, fetchGuests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  async function fetchGuests() {
    try {
      const { data, error } = await supabase
        .from('guest_registrations')
        .select('*, guest_matches(count)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setGuests(data || []);
    } catch (err) {
      console.error('Error fetching guests:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleWhatsAppNotify = (guest: any) => {
    const message = encodeURIComponent(
      `Hi ${guest.full_name}, your photos from the event are ready! \n\nView them here: ${window.location.origin}/e/${eventId}\n\nPowered by Pixvora AI.`
    );
    const phone = guest.phone ? guest.phone.replace(/\D/g, '') : '';
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] silk-shadow border border-outline-variant/5">
        <div>
            <h2 className="text-xl font-bold text-on-surface">Live Delivery Monitor</h2>
            <p className="text-sm text-on-surface-variant">Real-time matching status for all registered guests</p>
        </div>
        <div className="flex gap-4">
            <div className="text-center px-4 border-r border-outline-variant/10">
                <div className="text-2xl font-bold text-primary">{guests.length}</div>
                <div className="text-[10px] font-bold uppercase text-on-surface-variant">Guests</div>
            </div>
            <div className="text-center px-4">
                <div className="text-2xl font-bold text-secondary">
                    {guests.reduce((acc, g) => acc + (g.guest_matches?.[0]?.count || 0), 0)}
                </div>
                <div className="text-[10px] font-bold uppercase text-on-surface-variant">Matches</div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] silk-shadow border border-outline-variant/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant/10">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Guest</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Matches</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {guests.length > 0 ? guests.map((guest) => (
              <tr key={guest.id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {guest.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface">{guest.full_name}</div>
                      <div className="text-xs text-on-surface-variant">{guest.email || 'No email provided'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    guest.status === 'matched' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  )}>
                    {guest.status}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-sm font-bold">
                        {guest.guest_matches?.[0]?.count || 0}
                    </div>
                    <span className="text-xs text-on-surface-variant">Photos Found</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex gap-2">
                    <button 
                        onClick={() => handleWhatsAppNotify(guest)}
                        title="Notify via WhatsApp"
                        disabled={!guest.phone}
                        className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-green-50 disabled:hover:text-green-600"
                    >
                        <MessageCircle size={18} />
                    </button>
                    <button className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all">
                        <Users size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant">
                    <Users size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="font-medium">No guests registered yet</p>
                    <p className="text-xs">Guests will appear here once they scan the QR code.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function PermissionItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium text-on-surface-variant">
        {label}
      </span>
      <button
        onClick={onChange}
        className={cn(
          "w-10 h-5 rounded-full transition-all relative",
          checked ? "bg-primary" : "bg-outline-variant/30",
        )}
      >
        <div
          className={cn(
            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
            checked ? "right-1" : "left-1",
          )}
        ></div>
      </button>
    </div>
  );
}

function StatusButton({
  status,
  currentStatus,
  onClick,
}: {
  status: string;
  currentStatus: string;
  onClick: () => void;
}) {
  const isActive = status === currentStatus;
  const statusColors = {
    upcoming: "bg-yellow-100 text-yellow-800 border-yellow-200",
    live: "bg-green-100 text-green-800 border-green-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
        isActive
          ? statusColors[status as keyof typeof statusColors]
          : "bg-white border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-low",
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
      {isActive && <Check size={16} />}
    </button>
  );
}

