import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, Copy, Check, Calendar, Users, CheckCircle2, 
  ChevronRight, Share2, Heart, Download, ShieldCheck, 
  LayoutGrid, Image as ImageIcon, Upload, X, AlertCircle, Sparkles,
  Trash2, Plus, MessageCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UploadManager, UploadFile } from '../lib/uploadManager';
import { useAuth } from '../contexts/AuthContext';
import { azureStorageProvider } from '../lib/providers/azureStorageProvider';
import { deletePhoto } from '../lib/photoMetadata';

interface ClientSelectionsProps {
  eventId: string;
}

interface Photo {
  id: string;
  file_path: string;
  thumbnail_url?: string;
  is_in_selection_pool: boolean;
}

export function ClientSelections({ eventId }: ClientSelectionsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectionConfig, setSelectionConfig] = useState<any>(null);
  const [eventPhotos, setEventPhotos] = useState<Photo[]>([]);
  const [clientSelectedIds, setClientSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalFavorites: 0, uniquePhotos: 0 });
  const [columnError, setColumnError] = useState(false);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());

  // Form State
  const [maxPhotos, setMaxPhotos] = useState(50);
  const [deadline, setDeadline] = useState('');
  const [isSecureMode, setIsSecureMode] = useState(true);
  const [maxViews, setMaxViews] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadManager, setUploadManager] = useState<UploadManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSelectionConfig();
    fetchEventPhotos();
  }, [eventId]);

  // Initialize upload manager
  useEffect(() => {
    if (user && eventId) {
      const manager = new UploadManager({
        eventId,
        uploaderId: user.id,
        isEdited: true, // Photos for selection pool are usually "edited" or curated
        onProgress: (progress) => {
          setUploadFiles(prev => prev.map(f =>
            f.id === progress.fileId ? { ...f, progress: progress.progress, status: progress.status } : f
          ));
        },
        onComplete: async (result) => {
          if (result.success) {
            // After successful upload, AUTOMATICALLY mark it as part of the client selection portal
            await supabase
              .from('photos')
              .update({ is_in_selection_pool: true })
              .eq('id', result.photoId);
            fetchEventPhotos();
          }
        }
      });
      setUploadManager(manager);
    }
  }, [user, eventId]);

  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return azureStorageProvider.getBlobUrl(path, 'photos');
  };

  const fetchEventPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('id, file_path, thumbnail_url, is_in_selection_pool')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      
      if (error) {
        if (error.code === '42703') setColumnError(true); // Column missing
        throw error;
      }
      if (data) setEventPhotos(data);
    } catch (err) {
      console.error('Fetch photos error:', err);
    }
  };

  const fetchSelectionConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('photo_selections')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) throw error;
      setSelectionConfig(data);

      if (data) {
        setMaxPhotos(data.max_photos || 50);
        setIsSecureMode(data.is_secure_mode ?? true);
        setMaxViews(data.max_views || 5);
        if (data.deadline) setDeadline(new Date(data.deadline).toISOString().split('T')[0]);

        // Fetch stats
        const { count: favoritesCount } = await supabase
          .from('photo_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('selection_id', data.id);

        const { data: uniqueFavs } = await supabase
          .from('photo_favorites')
          .select('photo_id')
          .eq('selection_id', data.id);
          
        const uniqueSet = new Set(uniqueFavs?.map(f => f.photo_id) || []);
        setStats({ totalFavorites: favoritesCount || 0, uniquePhotos: uniqueSet.size });
        setClientSelectedIds(uniqueSet);
      }
    } catch (error) {
      console.error('Config fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const [showFullGallery, setShowFullGallery] = useState(false);
  const [selectedForDetail, setSelectedForDetail] = useState<Photo | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

  const handleBulkDelete = async () => {
    if (selectedForBulk.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedForBulk.size} photos forever? This cannot be undone.`)) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('photos')
        .delete()
        .in('id', Array.from(selectedForBulk));
        
      if (error) throw error;
      setEventPhotos(prev => prev.filter(p => !selectedForBulk.has(p.id)));
      setSelectedForBulk(new Set());
      setIsBulkMode(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to delete photos.');
    } finally {
      setLoading(false);
    }
  };

  const toggleBulkSelect = (id: string) => {
    const newSet = new Set(selectedForBulk);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedForBulk(newSet);
  };

  const handleImageError = async (photoId: string) => {
    // Only auto-delete for photographers to avoid accidental deletions by guests
    // and to ensure we have permissions
    setEventPhotos(prev => prev.filter(p => p.id !== photoId));
    
    try {
      // Silently delete in the background
      await deletePhoto(photoId);
    } catch (err) {
      console.error(`[CLEANUP] Failed to remove broken photo: ${photoId}`, err);
    }
  };
    
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo forever? This will remove it from all storage and the database.')) return;
    
    try {
      const result = await deletePhoto(photoId);
        
      if (!result || !result.success) throw new Error(result?.error || 'Failed to delete photo');

      setEventPhotos(prev => prev.filter(p => p.id !== photoId));
      setBrokenPhotoIds(prev => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      if (selectedForDetail?.id === photoId) setSelectedForDetail(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete photo.');
    }
  };

  // AUTO-GENERATE PORTAL: If photos exist but no config, create one automatically
  useEffect(() => {
    if (!loading && eventPhotos.length > 0 && !selectionConfig && !isSubmitting) {
      console.log('[SECURITY] Auto-generating selection portal for new photos...');
      handleCreateSelection();
    }
  }, [eventPhotos.length, selectionConfig, loading]);

  const selectAllPhotos = async () => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_in_selection_pool: true })
        .eq('event_id', eventId);
      
      if (error) throw error;
      fetchEventPhotos();
    } catch (err) {
      console.error('Select all error:', err);
    }
  };

  const togglePhotoInPool = async (photoId: string) => {
    const photo = eventPhotos.find(p => p.id === photoId);
    if (!photo) return;

    const currentPoolCount = eventPhotos.filter(p => p.is_in_selection_pool).length;
    if (!photo.is_in_selection_pool && currentPoolCount >= Math.max(50, maxPhotos)) {
      alert(`The current selection limit is ${maxPhotos}. Please increase the cap below if you want to add more.`);
      return;
    }

    setEventPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_in_selection_pool: !p.is_in_selection_pool } : p));

    try {
      await supabase.from('photos').update({ is_in_selection_pool: !photo.is_in_selection_pool }).eq('id', photoId);
    } catch (err) {
      fetchEventPhotos(); // Rollback on error
    }
  };

  const handleCreateSelection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // We can't generate a portal with 0 photos
    if (eventPhotos.length === 0) return;

    try {
      setIsSubmitting(true);
      const selectionCode = selectionConfig?.selection_code || Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const payload = {
        event_id: eventId,
        max_photos: maxPhotos,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        selection_code: selectionCode,
        status: 'pending',
        is_secure_mode: isSecureMode,
        max_views: maxViews
      };

      let result;
      
      if (selectionConfig?.id) {
        // Update existing
        result = await supabase
          .from('photo_selections')
          .update(payload)
          .eq('id', selectionConfig.id)
          .select()
          .single();
      } else {
        // Insert new
        result = await supabase
          .from('photo_selections')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      setSelectionConfig(result.data);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save selection rules. Please ensure you have run the latest database migrations.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !uploadManager) return;

    const files = Array.from(selectedFiles);
    const newUploads = uploadManager.addFiles(files);
    setUploadFiles(prev => [...prev, ...newUploads]);
    setIsUploading(true);
    await uploadManager.startUpload();
    setIsUploading(false);
    setUploadFiles([]);
    fetchEventPhotos();
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const poolPhotos = eventPhotos.filter(p => p.is_in_selection_pool);

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      {columnError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-1" size={20} />
          <div>
            <h4 className="text-sm font-bold text-red-900">Database Update Required</h4>
            <p className="text-xs text-red-700 mb-2">The photo selection features require new database columns. Please run the SQL migration 044 in your Supabase Dashboard.</p>
            <code className="block bg-black/5 p-2 rounded text-[10px] font-mono break-all text-red-800">
              ALTER TABLE photos ADD COLUMN is_in_selection_pool BOOLEAN DEFAULT false;
            </code>
          </div>
        </div>
      )}

      {/* 1. Selection Pool Header & Stats */}
      <section className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-bold text-on-surface">Client Review Portal</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-on-surface-variant">Upload photos for client review.</p>
              {selectionConfig?.status === 'submitted' && (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                   <CheckCircle2 size={12} /> Selections Submitted
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {clientSelectedIds.size > 0 && (
              <button
                onClick={() => document.getElementById('client-selections-view')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-6 py-2.5 bg-pink-50 text-pink-600 rounded-full font-bold text-sm hover:bg-pink-100 transition-all"
              >
                <Heart size={18} fill="currentColor" />
                Review {clientSelectedIds.size} Picks
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-black text-sm shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Upload Photos for Client
            </button>
            
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>

        {/* Upload Progress */}
        {uploadFiles.length > 0 && (
          <div className="mb-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Uploading to Selection Pool...</span>
              <span className="text-xs font-bold text-primary">{Math.round(uploadFiles.reduce((acc, f) => acc + f.progress, 0) / uploadFiles.length)}%</span>
            </div>
            <div className="w-full h-1.5 bg-outline-variant/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadFiles.reduce((acc, f) => acc + f.progress, 0) / uploadFiles.length}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-4 border border-outline-variant/10 rounded-[2.5rem] bg-surface-container-lowest shadow-inner relative group/grid">
          {eventPhotos.slice(0, 15).map(photo => {
            return (
              <div
                key={photo.id}
                className={cn(
                  "relative aspect-square rounded-2xl overflow-hidden transition-all duration-300 border-2",
                  photo.is_in_selection_pool 
                    ? "border-primary/40 shadow-md scale-95" 
                    : "border-transparent opacity-60"
                )}
              >
                <img 
                  src={getPhotoUrl(photo.thumbnail_url || photo.file_path)} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(photo.id)}
                />
                {photo.is_in_selection_pool && (
                  <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1 shadow-lg">
                    <Check size={10} strokeWidth={4} />
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Full Gallery Action Tile */}
          <button 
            onClick={() => setShowFullGallery(true)}
            className="aspect-square rounded-2xl border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 text-primary hover:bg-primary/10 transition-all group active:scale-95 shadow-lg shadow-primary/5"
          >
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <LayoutGrid size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manage Gallery</span>
          </button>
        </div>

        {eventPhotos.length === 0 && !loading && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
              <ImageIcon className="text-on-surface-variant/30" size={40} />
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-1">Your gallery is empty</h4>
            <p className="text-sm text-on-surface-variant mb-6">Start by uploading photos for your client to review.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:shadow-xl transition-all active:scale-95"
            >
              Upload First Batch
            </button>
          </div>
        )}

      {/* FULL SCREEN GALLERY MODAL */}
      {showFullGallery && (
        <div className="fixed inset-0 z-[60] bg-white animate-in fade-in slide-in-from-bottom-8">
          <header className="h-20 border-b border-outline-variant/10 px-8 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowFullGallery(false)}
                className="p-3 hover:bg-surface-container rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <div>
                <h2 className="text-xl font-black text-on-surface tracking-tight">Full Gallery Management</h2>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">{eventPhotos.length} Total Photos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isBulkMode ? (
                <>
                  <button
                    onClick={() => {
                      if (selectedForBulk.size === eventPhotos.length) setSelectedForBulk(new Set());
                      else setSelectedForBulk(new Set(eventPhotos.map(p => p.id)));
                    }}
                    className="px-6 py-3 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-full transition-all"
                  >
                    {selectedForBulk.size === eventPhotos.length ? 'Deselect All' : 'Select All to Delete'}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedForBulk.size === 0}
                    className="flex items-center gap-2 px-8 py-3 bg-red-500 text-white rounded-full font-black text-sm hover:bg-red-600 transition-all shadow-xl disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                    Delete {selectedForBulk.size} Photos
                  </button>
                  <button
                    onClick={() => { setIsBulkMode(false); setSelectedForBulk(new Set()); }}
                    className="p-3 hover:bg-surface-container rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsBulkMode(true)}
                    className="px-6 py-3 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-red-500 transition-colors"
                  >
                    Select All to Delete
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-8 py-3 bg-on-surface text-white rounded-full font-black text-sm hover:opacity-90 transition-all shadow-xl"
                  >
                    <Plus size={20} />
                    Add More Photos
                  </button>
                </>
              )}
            </div>
          </header>

          <main className="p-8 max-w-[1600px] mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {eventPhotos.map(photo => {
                return (
                  <div 
                    key={photo.id}
                    className={cn(
                      "group relative aspect-[3/4] rounded-3xl overflow-hidden bg-surface-container-low border-2 transition-all duration-500 cursor-zoom-in shadow-sm hover:shadow-2xl",
                      isBulkMode 
                        ? (selectedForBulk.has(photo.id) ? "border-red-500 ring-4 ring-red-500/20" : "border-transparent opacity-40")
                        : (photo.is_in_selection_pool ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")
                    )}
                    onClick={() => isBulkMode ? toggleBulkSelect(photo.id) : setSelectedForDetail(photo)}
                  >
                    <img 
                      src={getPhotoUrl(photo.thumbnail_url || photo.file_path)} 
                      alt="" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      onError={() => handleImageError(photo.id)}
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePhotoInPool(photo.id); }}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                            photo.is_in_selection_pool ? "bg-primary text-white" : "bg-white text-on-surface"
                          )}
                        >
                          {photo.is_in_selection_pool ? 'In Portal' : 'Add to Portal'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                          className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {photo.is_in_selection_pool && (
                      <div className="absolute top-4 right-4 bg-primary text-white rounded-full p-2 shadow-xl">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>

          {/* Photo Detail Overlay (Lightbox Management) */}
          {selectedForDetail && (
            <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-200 p-8 flex items-center justify-center">
              <button 
                onClick={() => setSelectedForDetail(null)}
                className="absolute top-8 right-8 w-14 h-14 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all"
              >
                <X size={32} />
              </button>

              <div className="max-w-6xl w-full flex flex-col md:flex-row gap-12 items-center">
                <div className="flex-1 relative rounded-[3rem] overflow-hidden shadow-2xl border border-white/10">
                  <img 
                    src={getPhotoUrl(selectedForDetail.file_path)} 
                    alt="" 
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />
                </div>

                <div className="w-full md:w-80 space-y-8">
                  <div className="text-white">
                    <h3 className="text-3xl font-black tracking-tight mb-2">Photo Detail</h3>
                    <p className="text-white/60 text-sm font-medium uppercase tracking-widest">Manage this image</p>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={() => togglePhotoInPool(selectedForDetail.id)}
                      className={cn(
                        "w-full py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm transition-all flex items-center justify-center gap-3",
                        selectedForDetail.is_in_selection_pool 
                          ? "bg-primary text-white shadow-2xl shadow-primary/40" 
                          : "bg-white text-on-surface hover:scale-105"
                      )}
                    >
                      {selectedForDetail.is_in_selection_pool ? <Check size={20} strokeWidth={4} /> : <Plus size={20} />}
                      {selectedForDetail.is_in_selection_pool ? 'Visible to Client' : 'Make Visible'}
                    </button>

                    <button
                      onClick={() => handleDeletePhoto(selectedForDetail.id)}
                      className="w-full py-6 bg-red-500/10 text-red-500 border-2 border-red-500/20 rounded-3xl font-black uppercase tracking-[0.2em] text-sm hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3"
                    >
                      <Trash2 size={20} />
                      Delete Permanently
                    </button>
                  </div>

                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                      <span className="text-white/40">Status</span>
                      <span className={selectedForDetail.is_in_selection_pool ? "text-green-400" : "text-yellow-400"}>
                        {selectedForDetail.is_in_selection_pool ? 'Live in Portal' : 'Private'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                      <span className="text-white/40">File Size</span>
                      <span className="text-white">Original HD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </section>

      {/* 2. Client Selections (What the client picked) */}
      {clientSelectedIds.size > 0 && (
        <section id="client-selections-view" className="bg-white p-8 rounded-[2.5rem] silk-shadow border-2 border-pink-100 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-on-surface">Client's Chosen Photos</h3>
              <p className="text-sm text-on-surface-variant">These are the photos the client has favorited/selected so far.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(`/select/${selectionConfig?.selection_code}`)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                <Sparkles size={18} />
                Preview Portal
              </button>

              <div className="w-px h-8 bg-outline-variant/20 mx-1" />

              <button 
                onClick={async () => {
                  const selectedPhotos = eventPhotos.filter(p => clientSelectedIds.has(p.id));
                  if (selectedPhotos.length === 0) return;
                  
                  const zipData = selectedPhotos.map(p => ({
                    filePath: p.file_path,
                    filename: p.file_path.split('/').pop() || 'photo.jpg'
                  }));
                  
                  try {
                    const { downloadBulkZip } = await import('../lib/downloadUtils');
                    await downloadBulkZip(zipData, `client-picks-${selectionConfig?.selection_code || 'export'}`);
                  } catch (err) {
                    console.error('Download error:', err);
                    alert('Failed to download photos. Please try again.');
                  }
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-low text-on-surface rounded-xl hover:bg-surface-container-highest transition-all font-bold text-sm"
              >
                <Download size={18} />
                Download High-Res ({clientSelectedIds.size})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {eventPhotos
              .filter(p => clientSelectedIds.has(p.id))
              .map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group">
                  <img 
                    src={getPhotoUrl(photo.thumbnail_url || photo.file_path)} 
                    alt="Client Selection" 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute top-2 right-2 bg-pink-500 text-white rounded-full p-1 shadow-lg">
                    <Heart size={10} fill="currentColor" />
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 3. Configuration & Sharing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 bg-white p-10 rounded-[3rem] silk-shadow border border-outline-variant/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface leading-tight">Security & Controls</h3>
              <p className="text-xs text-on-surface-variant">Define rules and protection for this portal.</p>
            </div>
          </div>
          
          <form onSubmit={handleCreateSelection} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">Client Selection Cap</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                  <input
                    type="number" min={1} max={500} required
                    value={maxPhotos}
                    onChange={(e) => setMaxPhotos(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-container-low border-none rounded-2xl pl-12 pr-4 py-4 font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant ml-1">View Restriction</label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                  <input
                    type="number" min={1} max={100} required
                    value={maxViews || ''}
                    onChange={(e) => setMaxViews(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-container-low border-none rounded-2xl pl-12 pr-4 py-4 font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-6 bg-primary/5 rounded-[2rem] border border-primary/10 group cursor-pointer hover:bg-primary/10 transition-all" onClick={() => setIsSecureMode(!isSecureMode)}>
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-all duration-300 relative",
                isSecureMode ? "bg-primary" : "bg-outline-variant/30"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300",
                  isSecureMode ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Enable High-Security Protection</p>
                <p className="text-[10px] text-on-surface-variant font-medium">Watermarks, no downloads, screenshot deterrents, and view logs active.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || eventPhotos.length === 0}
              className="w-full bg-on-surface text-white font-bold uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Save Portal Settings'}
            </button>
          </form>
        </section>

        <div className="lg:col-span-5 space-y-8">
          {selectionConfig ? (
            <>
              <section className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Share2 className="text-primary" size={20} />
                  Client Portal Link
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl font-mono text-[10px] break-all text-on-surface-variant">
                    {`${window.location.origin}/select/${selectionConfig.selection_code}`}
                  </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/select/${selectionConfig.selection_code}`;
                          navigator.clipboard.writeText(portalUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center justify-center gap-2 py-3 bg-on-surface text-white rounded-xl font-bold text-xs hover:bg-on-surface/90 transition-all"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy Link'}
                      </button>
                      <button
                        onClick={() => {
                          const portalUrl = `${window.location.origin}/select/${selectionConfig.selection_code}`;
                          const message = encodeURIComponent(`Hi! Here is your private photo selection portal: ${portalUrl}`);
                          window.open(`https://wa.me/?text=${message}`, '_blank');
                        }}
                        className="flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-bold text-xs hover:bg-green-600 transition-all"
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </button>
                    </div>
                </div>
              </section>

              <section className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                <h3 className="text-lg font-bold text-on-surface mb-6">Portal Engagement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-pink-50 rounded-[2rem] text-center">
                    <Heart className="mx-auto text-pink-500 mb-2" size={24} />
                    <div className="text-2xl font-black text-on-surface">{stats.totalFavorites}</div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Total Hearts</div>
                  </div>
                  <div className="p-6 bg-primary/5 rounded-[2rem] text-center">
                    <Sparkles className="mx-auto text-primary mb-2" size={24} />
                    <div className="text-2xl font-black text-on-surface">{stats.uniquePhotos}</div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Unique Picks</div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-surface-container-lowest border-2 border-dashed border-outline-variant/20 rounded-[3rem] text-center">
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-4">
                <Users className="text-primary/20" size={32} />
              </div>
              <h4 className="text-on-surface font-bold">Portal Not Generated</h4>
              <p className="text-xs text-on-surface-variant">Configure the rules and select photos above to generate your client portal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

