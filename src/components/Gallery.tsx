import { CheckCircle2, ChevronLeft, ChevronRight, Download, ScanFace, Sparkles, X, ShieldCheck, LayoutGrid, Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { downloadBulkZip, downloadSingleImage } from '../lib/downloadUtils';
import { getPhotoPublicUrl, getPhotosByEventId, PhotoMetadata, deletePhoto } from '../lib/photoMetadata';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { SelfieCapture } from './SelfieCapture';
import { faceEngine } from '../lib/faceEngine';
import { WatermarkedImage } from './WatermarkedImage';
import { usePhotographerBranding } from '../hooks/usePhotographerBranding';
import { SecureImage } from './SecureImage';
import { getDeviceFingerprint, logSecurityEvent } from '../lib/securityEngine';
import { useSearchParams, useNavigate } from 'react-router-dom';

const isHybridAzure = import.meta.env.VITE_AI_PROVIDER === 'AZURE';

export function Gallery() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Data State
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [eventData, setEventData] = useState<{ name: string; event_date: string; user_id?: string } | null>(null);

  // Photographer Branding
  const [isSecure, setIsSecure] = useState(false);
  const { branding } = usePhotographerBranding(eventData?.user_id);
  const [loading, setLoading] = useState(true);

  const isPhotographer = React.useMemo(() => 
    profile?.user_type === 'photographer' || profile?.is_admin || eventData?.user_id === profile?.id
  , [profile, eventData]);
  
  // Pagination State
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PHOTOS_PER_PAGE = 20;

  // Tools & UI State
  const [isAIFinderOpen, setIsAIFinderOpen] = useState(false);
  const [isSubmittingSelection, setIsSubmittingSelection] = useState(false);

  const handleSubmitSelection = async () => {
    if (selectedPhotoIds.size === 0) return;
    
    if (confirm(`Are you sure you want to submit these ${selectedPhotoIds.size} photos to the photographer?`)) {
      try {
        setIsSubmittingSelection(true);
        
        // 1. Get or create a photo_selections record for this event
        const { data: selection, error: selError } = await supabase
          .from('photo_selections')
          .select('id')
          .eq('event_id', id)
          .maybeSingle();
          
        if (selError) throw selError;
        
        let selectionId = selection?.id;
        
        if (!selectionId) {
          // If no selection portal exists, create a default one
          const { data: newSel, error: createError } = await supabase
            .from('photo_selections')
            .insert({
              event_id: id,
              status: 'submitted',
              max_photos: 50,
              selection_code: Math.random().toString(36).substring(2, 8).toUpperCase()
            })
            .select()
            .single();
            
          if (createError) throw createError;
          selectionId = newSel.id;
        }

        // 2. Ensure guest record exists in photo_selection_guests
        let guest_id;
        const guestName = profile?.full_name || 'Gallery User';
        const guestEmail = profile?.email || '';

        // Try to find by email first (it's the primary unique constraint now)
        let existingGuest = null;
        if (guestEmail) {
          const { data } = await supabase
            .from('photo_selection_guests')
            .select('id')
            .eq('selection_id', selectionId)
            .eq('email', guestEmail.trim())
            .maybeSingle();
          existingGuest = data;
        }

        // If not found by email, try by name (fallback)
        if (!existingGuest) {
          const { data } = await supabase
            .from('photo_selection_guests')
            .select('id')
            .eq('selection_id', selectionId)
            .eq('name', guestName.trim())
            .maybeSingle();
          existingGuest = data;
        }

        if (existingGuest) {
          guest_id = existingGuest.id;
        } else {
          const { data: newGuest, error: guestErr } = await supabase
            .from('photo_selection_guests')
            .insert({
              selection_id: selectionId,
              name: guestName.trim(),
              email: guestEmail ? guestEmail.trim() : null
            })
            .select()
            .single();
          
          if (guestErr) throw guestErr;
          guest_id = newGuest.id;
        }

        // 3. Save favorites
        const favoriteInserts = Array.from(selectedPhotoIds).map(photoId => ({
          selection_id: selectionId,
          photo_id: photoId,
          guest_id: guest_id
        }));

        const { error: favError } = await supabase
          .from('photo_favorites')
          .insert(favoriteInserts);
          
        if (favError) throw favError;

        // 3. Update status to submitted
        await supabase
          .from('photo_selections')
          .update({ status: 'submitted' })
          .eq('id', selectionId);

        alert('Success! Your selections have been sent to the photographer.');
        setIsSelectionMode(false);
        setSelectedPhotoIds(new Set());
      } catch (err) {
        console.error('Submit error:', err);
        alert('Failed to submit selections. Please try again.');
      } finally {
        setIsSubmittingSelection(false);
      }
    }
  };
  const [aiStep, setAiStep] = useState(0); 
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  
  // AI Matching state
  const [matchedPhotos, setMatchedPhotos] = useState<PhotoMetadata[]>([]);
  const [clientSelectedPhotos, setClientSelectedPhotos] = useState<PhotoMetadata[]>([]);
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  const [showOnlyClientSelections, setShowOnlyClientSelections] = useState(false);
  const [showOnlyMyPicks, setShowOnlyMyPicks] = useState(false);

  const [showCompareModal, setShowCompareModal] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<string[]>([]);
  const [isAIUnlocked, setIsAIUnlocked] = useState(false);
  const [photographerPlan, setPhotographerPlan] = useState<string>('starter');

  // Intersection Observer for Infinite Scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  const lastPhotoElementRef = useCallback((node: HTMLDivElement) => {
    if (loading || loadingMore || !mountedRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (!mountedRef.current) return;
      if (entries[0].isIntersecting && hasMore) {
        loadMorePhotos();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const fetchClientSelections = useCallback(async () => {
    if (!id || !isPhotographer) return;
    try {
      const { data: selection } = await supabase
        .from('photo_selections')
        .select('id')
        .eq('event_id', id)
        .maybeSingle();

      if (selection) {
        const { data: favorites } = await supabase
          .from('photo_favorites')
          .select('photo_id')
          .eq('selection_id', selection.id);

        if (favorites && favorites.length > 0) {
          const selectedIds = favorites.map(f => f.photo_id);
          
          // Fetch photo metadata for these IDs
          const { data: selectedPhotosData } = await supabase
            .from('photos')
            .select('*')
            .in('id', selectedIds);
            
          if (selectedPhotosData) {
            setClientSelectedPhotos(selectedPhotosData as PhotoMetadata[]);
          }
        } else {
          setClientSelectedPhotos([]);
        }
      }
    } catch (err) {
      console.error('[MANAGEMENT] Failed to load client selections', err);
    }
  }, [id, isPhotographer]);

  // 1. Initial Data & Realtime Setup
  useEffect(() => {
    if (!id) return;

    const fetchInitialData = async () => {
      // Fetch Event Details
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('name, event_date, user_id')
        .eq('id', id)
        .single();
      
      if (event) setEventData(event);

      // Fetch Initial Photos
      setLoading(true);
      const result = await getPhotosByEventId(id, { limit: PHOTOS_PER_PAGE, offset: 0 });
      if (result.success && result.photos) {
        setPhotos(result.photos);
        setHasMore(result.photos.length === PHOTOS_PER_PAGE);
      }
      setLoading(false);

      // Security Enforcement
      try {
        const isPhotographerUser = profile?.user_type === 'photographer' || profile?.is_admin || event?.user_id === profile?.id;
        
        // Fetch Photographer Plan
        if (event?.user_id) {
          const { data: pProfile } = await supabase
            .from('profiles')
            .select('plan_type')
            .eq('id', event.user_id)
            .single();
          if (pProfile) {
            setPhotographerPlan(pProfile.plan_type);
            if (pProfile.plan_type === 'professional') setIsAIUnlocked(true);
          }
        }

        // Check if guest has already unlocked
        if (!isPhotographerUser && profile?.email && id) {
          const { data: unlock } = await supabase
            .from('ai_unlocks')
            .select('id')
            .eq('guest_email', profile.email)
            .eq('event_id', id)
            .maybeSingle();
          if (unlock) setIsAIUnlocked(true);
        }

        if (!isPhotographerUser) {
          const session = searchParams.get('session');
          const fp = searchParams.get('fp');
          
          if (!session || !fp) {
            console.warn('[SECURITY] No session found. Verifying access...');
            navigate(`/gallery/verify?token=${id}`);
            return;
          }

          setIsSecure(true);
          const currentFp = await getDeviceFingerprint();
          if (currentFp !== fp) {
             navigate(`/gallery/verify?token=${id}&error=device_mismatch`);
             return;
          }
          logSecurityEvent(session, 'page_view');
        } else {
          setIsSecure(false);
          console.log('[SECURITY] Management view: Protective layer disabled.');
        }
      } catch (err) {
        console.error('[SECURITY] Verification failed', err);
      }
    };

    fetchInitialData();

    // Subscribe to photo status updates
    const photosChannel = supabase
      .channel('gallery_photos_realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'photos',
        filter: `event_id=eq.${id}`
      }, (payload) => {
        setPhotos(current => current.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'photos',
        filter: `event_id=eq.${id}`
      }, (payload) => {
        setPhotos(current => [payload.new as PhotoMetadata, ...current]);
      })
      .subscribe();

    // Subscribe to favorites for photographers
    let favChannel: any = null;
    if (isPhotographer) {
      favChannel = supabase
        .channel('gallery_favs_realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'photo_favorites'
        }, () => {
          // Trigger a refresh of client selections
          fetchClientSelections();
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(photosChannel);
      if (favChannel) supabase.removeChannel(favChannel);
    };
  }, [id, profile, searchParams, navigate, isPhotographer, fetchClientSelections]);

  // 2. Separate Effect for Client Selections (Photographers Only)
  useEffect(() => {
    if (isPhotographer) {
      fetchClientSelections();
    }
  }, [isPhotographer, fetchClientSelections]);

  const loadMorePhotos = async () => {
    if (!id || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const result = await getPhotosByEventId(id, { limit: PHOTOS_PER_PAGE, offset: photos.length });
    
    if (result.success && result.photos) {
      if (result.photos.length > 0) {
        setPhotos(prev => [...prev, ...result.photos!]);
      }
      setHasMore(result.photos.length === PHOTOS_PER_PAGE);
    }
    setLoadingMore(false);
  };

  const handleAIMatchRequest = async (freshSelfieImg?: HTMLImageElement) => {
    if (!mountedRef.current) return;
    setIsAIFinderOpen(true);
    
    // Azure requires a fresh image to identify (due to our strict privacy policy of not saving selfies).
    // Local processing can use the previously saved pgvector descriptor.
    if ((isHybridAzure && !freshSelfieImg) || (!isHybridAzure && !profile?.selfie_descriptor && !freshSelfieImg)) {
      if (mountedRef.current) setAiStep(1);
      return;
    }

    if (mountedRef.current) setAiStep(2);
    try {
      let matches: { photo_id: string, confidence: number }[] = [];

      if (freshSelfieImg) {
        // Use the Hybrid engine (Will try Azure, seamlessly fallback to local if Azure fails)
        matches = await faceEngine.findMyPhotos(freshSelfieImg, id || '');
      } else if (profile?.selfie_descriptor) {
        // Fast local track: If they didn't supply a new image, use their saved local vector 
        const { data, error } = await supabase.rpc('match_faces', {
          query_embedding: profile.selfie_descriptor,
          match_threshold: 0.6,
          match_count: 50
        });
        if (error) throw error;
        matches = (data || []).map((m: any) => ({ photo_id: m.photo_id, confidence: m.similarity }));
      }

      if (!mountedRef.current) return;

      if (matches && matches.length > 0) {
        const photoIds = matches.map((m: any) => m.photo_id);
        const { data: matchedPhotoData } = await supabase
          .from('photos')
          .select('*')
          .in('id', photoIds);
          
        if (!mountedRef.current) return;
        if (matchedPhotoData && matchedPhotoData.length > 0) {
          setMatchedPhotos(matchedPhotoData);
          setAiStep(3);
        } else {
          setAiStep(4);
        }
      } else {
        if (mountedRef.current) setAiStep(4);
      }
    } catch (e) {
      if (mountedRef.current) {
        console.error(e);
        setAiStep(4);
      }
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'Escape') setSelectedPhotoIndex(null);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, photos.length]);

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const toggleSelection = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) newSet.delete(photoId);
      else newSet.add(photoId);
      return newSet;
    });
  };

  const handleImageError = async (photoId: string) => {
    // Only auto-delete for photographers to avoid accidental deletions by guests
    if (!isPhotographer) return;
    
    // Immediately remove from UI
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    
    try {
      // Silently delete in the background
      await deletePhoto(photoId);
    } catch (err) {
      console.error(`[CLEANUP] Failed to remove broken photo: ${photoId}`, err);
    }
  };

  const handleSingleDownload = async (photo: PhotoMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = photo.file_name || `photo-${photo.id}.jpg`;
    await downloadSingleImage(photo.file_path, filename);
  };

  const handleBulkDownload = async () => {
    if (selectedPhotoIds.size === 0) return;
    
    setIsDownloadingZip(true);
    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
    const zipData = selectedPhotos.map(p => ({
      filePath: p.file_path,
      filename: p.file_name || `photo-${p.id}.jpg`
    }));
    
    try {
      await downloadBulkZip(zipData, `${eventData?.name || 'event-photos'}`);
      setIsSelectionMode(false);
      setSelectedPhotoIds(new Set());
    } catch (error) {
      console.error('Download failed', error);
      alert('Failed to create ZIP file.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDeletePhoto = async (photo: PhotoMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isPhotographer) return;

    if (confirm(`Are you sure you want to delete this photo permanently?`)) {
      try {
        const result = await deletePhoto(photo.id);

        if (!result.success) throw new Error(result.error || 'Failed to delete photo');

        setPhotos(prev => prev.filter(p => p.id !== photo.id));
        if (selectedPhotoIndex !== null) setSelectedPhotoIndex(null);
        alert('Photo deleted successfully.');
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete photo.');
      }
    }
  };

  // formatting
  const formattedDate = eventData?.event_date 
    ? new Date(eventData.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Ongoing';

  const displayedPhotos = showOnlyClientSelections 
    ? clientSelectedPhotos 
    : (showOnlyMatches 
        ? matchedPhotos 
        : (showOnlyMyPicks 
            ? photos.filter(p => selectedPhotoIds.has(p.id)) 
            : photos));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20 px-8 no-screenshot">
      <div className="max-w-full mx-auto relative pb-24">
        {/* Gallery Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Link to={`/event/${id}`} className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all">
              <ChevronLeft size={24} />
            </Link>
            <div>
              {/* Studio Branding in header */}
              {branding?.studio_name && (
                <div className="flex items-center gap-2 mb-2">
                  {branding.logo_url && (
                    <img src={branding.logo_url} alt={branding.studio_name} className="h-6 w-auto object-contain rounded" />
                  )}
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{branding.studio_name}</span>
                </div>
              )}
              {loading && !eventData ? (
                <div className="h-8 w-64 bg-white/10 animate-pulse rounded mb-2"></div>
              ) : (
                <h1 className="text-3xl font-serif font-bold mb-1">{eventData?.name || 'Event Gallery'}</h1>
              )}
              <div className="flex items-center gap-4 text-white/40 text-xs font-bold uppercase tracking-widest">
                <span>{photos.length} Photos</span>
                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {isPhotographer && (
              <button 
                onClick={() => {
                  setShowOnlyClientSelections(!showOnlyClientSelections);
                  if (!showOnlyClientSelections) {
                    // Pre-select all client photos for the photographer
                    const ids = new Set(clientSelectedPhotos.map(p => p.id));
                    setSelectedPhotoIds(ids);
                    setIsSelectionMode(true);
                  }
                }}
                className={cn(
                  "px-6 py-2.5 rounded-full font-bold text-sm transition-all border flex items-center gap-2",
                  showOnlyClientSelections ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <CheckCircle2 size={18} />
                {showOnlyClientSelections ? 'Show All Photos' : 'Manage Selections'}
              </button>
            )}

            <button 
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedPhotoIds(new Set());
              }}
              className={cn(
                "px-6 py-2.5 rounded-full font-bold text-sm transition-all border",
                isSelectionMode ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
            >
              {isSelectionMode ? 'Cancel Selection' : 'Select Photos'}
            </button>
            <button 
              onClick={showOnlyMatches ? () => setShowOnlyMatches(false) : () => handleAIMatchRequest()}
              className="signature-gradient px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <Sparkles size={18} />
              {showOnlyMatches ? 'Show All Photos' : 'Find My Photos'}
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="relative">
          <div className="flex gap-4 mb-12 overflow-x-auto pb-4 no-scrollbar">
            <FilterChip label="All Photos" active={!showOnlyMatches && !showOnlyClientSelections && !showOnlyMyPicks} onClick={() => {
              setShowOnlyMatches(false);
              setShowOnlyClientSelections(false);
              setShowOnlyMyPicks(false);
            }} />
            
            {isPhotographer && clientSelectedPhotos.length > 0 && (
              <FilterChip 
                label={`Client Selected (${clientSelectedPhotos.length})`} 
                active={showOnlyClientSelections} 
                onClick={() => {
                  setShowOnlyClientSelections(true);
                  setShowOnlyMatches(false);
                  setShowOnlyMyPicks(false);
                  // Auto-select for bulk action
                  setSelectedPhotoIds(new Set(clientSelectedPhotos.map(p => p.id)));
                  setIsSelectionMode(true);
                }} 
              />
            )}

            {!isPhotographer && selectedPhotoIds.size > 0 && (
              <FilterChip 
                label={`My Picks (${selectedPhotoIds.size})`} 
                active={showOnlyMyPicks} 
                onClick={() => {
                  setShowOnlyMyPicks(true);
                  setShowOnlyMatches(false);
                  setShowOnlyClientSelections(false);
                }} 
              />
            )}

            {matchedPhotos.length > 0 && (
              <FilterChip label="My AI Matches" active={showOnlyMatches} onClick={() => {
                setShowOnlyMatches(true);
                setShowOnlyClientSelections(false);
                setShowOnlyMyPicks(false);
              }} />
            )}
            <FilterChip label="Ceremony" />
            <FilterChip label="Reception" />
            <FilterChip label="Guest Candid" />
          </div>
        </div>

        {/* Photo Grid */}
        {loading && photos.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : displayedPhotos.length === 0 ? (
          <div className="flex justify-center items-center py-20 text-white/40">
            <p>No photos found.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {displayedPhotos.map((photo, i) => {
              const isSelected = selectedPhotoIds.has(photo.id);
              const isLastElement = i === displayedPhotos.length - 1;
              const photoUrl = getPhotoPublicUrl(photo.file_path);

              return (
                <motion.div 
                  ref={isLastElement ? lastPhotoElementRef : null}
                  key={photo.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() => isSelectionMode ? toggleSelection(photo.id, { stopPropagation: () => {} } as any) : setSelectedPhotoIndex(i)}
                  className={cn(
                    "relative group rounded-2xl overflow-hidden break-inside-avoid cursor-pointer transition-all",
                    isSelected ? "ring-4 ring-primary scale-[0.98]" : ""
                  )}
                >
                  <div className="relative">
                    {isPhotographer ? (
                      <img 
                        src={photoUrl} 
                        alt={photo.file_name} 
                        className="w-full h-auto transition-transform duration-700 group-hover:scale-105" 
                        loading="lazy"
                        onError={() => handleImageError(photo.id)}
                      />
                    ) : (
                      <SecureImage
                        src={photoUrl}
                        alt={photo.file_name}
                        className="w-full h-auto transition-transform duration-700 group-hover:scale-105"
                        isProtected={isSecure}
                        watermarkText={profile?.email || 'GUEST'}
                        onError={() => handleImageError(photo.id)}
                      />
                    )}
                    
                    {!isSecure && (
                      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                        <button 
                          onClick={(e) => handleSingleDownload(photo, e)}
                          className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-primary transition-colors text-white"
                        >
                          <Download size={18} />
                        </button>
                        {isPhotographer && (
                          <button 
                            onClick={(e) => handleDeletePhoto(photo, e)}
                            className="p-2 bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500 transition-colors text-white border border-red-500/30"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    )}
                    
                    {isSelectionMode && (
                      <div className="absolute top-4 left-4 z-10">
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                          isSelected ? "bg-primary border-primary text-white" : "border-white bg-black/50"
                        )}>
                          {isSelected && <CheckCircle2 size={16} />}
                        </div>
                      </div>
                    )}
                  </div>



                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-6 flex flex-col justify-between">
                    <div className="flex justify-end gap-2">
                      {!isSelectionMode && !isSecure && (
                        <button 
                          onClick={(e) => handleSingleDownload(photo, e)}
                          className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-primary transition-colors"
                        >
                          <Download size={18} />
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                          {photo.is_guest_upload ? 'Guest Upload' : 'Professional'}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        
        {loadingMore && (
           <div className="flex justify-center items-center py-10 w-full">
             <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
           </div>
        )}

      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedPhotoIndex !== null && displayedPhotos[selectedPhotoIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            {/* Lightbox Header */}
            <div className="flex justify-between items-center p-6 text-white absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent">
              <div className="text-sm font-bold text-white/60">
                {selectedPhotoIndex + 1} / {displayedPhotos.length}
              </div>
              <div className="flex gap-4">
                {!isSecure ? (
                  <button 
                    onClick={(e) => handleSingleDownload(displayedPhotos[selectedPhotoIndex], e)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Download size={24} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary rounded-full border border-primary/30">
                    <ShieldCheck size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Protected</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {isPhotographer && (
                    <button 
                      onClick={(e) => handleDeletePhoto(displayedPhotos[selectedPhotoIndex], e)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500 rounded-full transition-all text-xs font-bold border border-red-500/30"
                    >
                      <X size={16} />
                      Delete Photo
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedPhotoIndex(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </div>

            {/* Lightbox Image Container (with drag/swipe) */}
            <div className="flex-1 flex items-center justify-center relative px-12 touch-none">
              <button 
                onClick={handlePrevPhoto}
                className={cn(
                  "absolute left-6 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors z-10",
                  selectedPhotoIndex === 0 ? "opacity-30 cursor-not-allowed" : ""
                )}
              >
                <ChevronLeft size={32} />
              </button>
               
              <div className="relative w-full h-full flex items-center justify-center">
                {isPhotographer ? (
                  <img 
                    src={getPhotoPublicUrl(displayedPhotos[selectedPhotoIndex].file_path)} 
                    alt="Selected" 
                    className="max-h-[85vh] max-w-full object-contain"
                  />
                ) : (
                  <SecureImage 
                    src={getPhotoPublicUrl(displayedPhotos[selectedPhotoIndex].file_path)} 
                    alt="Selected" 
                    className="max-h-[85vh] max-w-full"
                    isProtected={isSecure}
                    watermarkText={`${profile?.email || 'GUEST'}-${id}`}
                  />
                )}
              </div>
              
              <button 
                onClick={handleNextPhoto}
                className={cn(
                  "absolute right-6 p-3 rounded-full bg-black/50 hover:bg-white/10 transition-colors z-10",
                  selectedPhotoIndex === displayedPhotos.length - 1 ? "opacity-30 cursor-not-allowed" : ""
                )}
              >
                <ChevronRight size={32} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Photo Finder Modal (Kept unchanged) */}
      <AnimatePresence>
        {isAIFinderOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAIFinderOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            ></motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a1a1a] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl"
            >
              <button 
                onClick={() => setIsAIFinderOpen(false)}
                className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors z-10"
              >
                <X size={24} />
              </button>

              <div className="p-12">
                {aiStep === 0 && (
                  <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
                      <Sparkles size={48} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-serif font-bold mb-4">Find Your Photos with AI</h2>
                      <p className="text-white/60 leading-relaxed">Our advanced facial recognition scans thousands of photos to find every moment you're in. Just take a quick selfie to start.</p>
                    </div>
                    <button 
                      onClick={() => setAiStep(1)}
                      className="w-full signature-gradient py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                      Take a Selfie
                    </button>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Your data is private and deleted after scanning</p>
                  </div>
                )}

                {aiStep === 1 && (
                  <SelfieCapture 
                    onClose={() => setIsAIFinderOpen(false)} 
                    onCaptureComplete={(img) => handleAIMatchRequest(img)} 
                  />
                )}

                {aiStep === 2 && (
                  <div className="text-center space-y-12 py-12">
                    <div className="relative w-48 h-48 mx-auto">
                      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ScanFace size={64} className="text-primary animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold">Scanning photos using AI...</h3>
                      <p className="text-white/40 text-xs uppercase tracking-widest font-bold mt-4">Matching facial feature vectors in database</p>
                    </div>
                  </div>
                )}

                {aiStep === 3 && (
                  <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500">
                      <Check size={48} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-serif font-bold mb-2">We found {matchedPhotos.length} photos!</h2>
                      <p className="text-white/60">
                        {isAIUnlocked 
                          ? "We've securely identified photos of you in the gallery." 
                          : `Get high-resolution access and download all ${matchedPhotos.length} photos of yourself.`}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       {matchedPhotos.slice(0, 3).map((photo, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                          <img src={getPhotoPublicUrl(photo.file_path)} alt="Found" className="w-full h-full object-cover grayscale opacity-50" />
                          {!isAIUnlocked && (
                             <div className="absolute inset-0 flex items-center justify-center">
                               <ShieldCheck size={20} className="text-white/40" />
                             </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {isAIUnlocked ? (
                      <button 
                        onClick={() => {
                          setIsAIFinderOpen(false);
                          setShowOnlyMatches(true);
                        }}
                        className="w-full signature-gradient py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all"
                      >
                        View My Photos
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <button 
                          onClick={async () => {
                            // In a real app, this would trigger payment
                            alert('Payment Gateway would open here. Price: ₹49');
                            
                            // Simulate success by recording in DB
                            if (profile?.email && id) {
                              await supabase.from('ai_unlocks').insert({
                                event_id: id,
                                guest_email: profile.email,
                                photo_ids: matchedPhotos.map(p => p.id)
                              });
                            }
                            setIsAIUnlocked(true);
                          }}
                          className="w-full signature-gradient py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                          <Sparkles size={20} />
                          Unlock for ₹49
                        </button>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">One-time payment for this entire event</p>
                      </div>
                    )}
                  </div>
                )}

                {aiStep === 4 && (
                  <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                      <X size={48} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-serif font-bold mb-2">No Matches Found</h2>
                      <p className="text-white/60">We couldn't find any photos that strongly match your face ID.</p>
                      <br/>
                      <p className="text-white/40 text-sm">Please make sure there are high-quality photos of you in the event gallery, or try recapturing your Face ID in your settings.</p>
                    </div>
                    <button 
                      onClick={() => setIsAIFinderOpen(false)}
                      className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-full font-bold text-lg active:scale-95 transition-all"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selection Floating Bar */}
      <AnimatePresence>
        {isSelectionMode && selectedPhotoIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 z-[100]"
          >
            <div className="flex flex-col">
              <span className="font-bold text-white">{selectedPhotoIds.size} Selected</span>
              {showOnlyClientSelections && (
                <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Client Picks</span>
              )}
            </div>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (selectedPhotoIds.size === displayedPhotos.length) {
                    setSelectedPhotoIds(new Set());
                  } else {
                    setSelectedPhotoIds(new Set(displayedPhotos.map(p => p.id)));
                  }
                }}
                className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-full font-bold text-sm transition-all text-white/70 hover:text-white"
              >
                {selectedPhotoIds.size === displayedPhotos.length ? 'Deselect All' : 'Select All'}
              </button>

              <button 
                onClick={handleBulkDownload}
                disabled={isDownloadingZip}
                className="signature-gradient px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDownloadingZip ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Download size={18} />
                )}
                {isDownloadingZip ? 'Preparing ZIP...' : 'Download High-Res ZIP'}
              </button>

              <div className="h-8 w-px bg-white/10 mx-2" />

              <button
                onClick={() => {
                  setIsCompareMode(!isCompareMode);
                  if (!isCompareMode) {
                    setComparePhotos(Array.from(selectedPhotoIds).slice(0, 4));
                    setShowCompareModal(true);
                  } else {
                    setShowCompareModal(false);
                  }
                }}
                className={cn(
                  "px-6 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2",
                  isCompareMode ? "bg-primary text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                <LayoutGrid size={18} />
                Compare Side-by-Side
              </button>
            </div>

            {!isPhotographer && (
              <button 
                onClick={handleSubmitSelection}
                disabled={isSubmittingSelection}
                className="bg-green-500/20 text-green-500 border border-green-500/30 px-8 py-2 rounded-full font-bold shadow-lg hover:bg-green-500/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingSelection ? (
                  <div className="w-4 h-4 border-2 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 size={18} />
                )}
                <span>Submit Final Selection</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare Modal */}
      {showCompareModal && comparePhotos.length > 0 && (
        <div className="fixed inset-0 bg-black/98 z-[200] flex flex-col">
          <div className="p-6 flex justify-between items-center text-white border-b border-white/10 bg-black/50 backdrop-blur-md">
            <div>
              <h2 className="text-xl font-bold">Compare Selection</h2>
              <p className="text-xs text-white/50">{comparePhotos.length} photos chosen for comparison</p>
            </div>
            <button 
              onClick={() => {
                setShowCompareModal(false);
                setIsCompareMode(false);
              }} 
              className="p-3 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className={cn(
            "flex-1 p-6 grid gap-6 overflow-auto",
            comparePhotos.length === 1 ? "grid-cols-1" : 
            comparePhotos.length === 2 ? "grid-cols-2" : 
            comparePhotos.length === 3 ? "grid-cols-3" : 
            "grid-cols-2 grid-rows-2"
          )}>
            {comparePhotos.map(photoId => {
              const photo = photos.find(p => p.id === photoId) || clientSelectedPhotos.find(p => p.id === photoId);
              if (!photo) return null;
              
              const isFav = selectedPhotoIds.has(photo.id);
              const imageUrl = getPhotoPublicUrl(photo.file_path);
              
              return (
                <div key={photoId} className="relative flex flex-col items-center justify-center bg-white/5 rounded-3xl overflow-hidden group border border-white/10">
                  <img src={imageUrl} alt="Compare" className="max-w-full max-h-full object-contain p-4" />
                  
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    <button
                      onClick={(e) => toggleSelection(photo.id, e as any)}
                      className={cn(
                        "p-4 rounded-full shadow-2xl transition-all",
                        isFav ? "bg-primary text-white scale-110" : "bg-white/90 text-gray-900 hover:bg-primary hover:text-white"
                      )}
                    >
                      <Heart size={24} className={cn(isFav && "fill-current")} />
                    </button>
                    <button
                      onClick={() => {
                        setComparePhotos(prev => prev.filter(id => id !== photoId));
                      }}
                      className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-2xl"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {comparePhotos.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/40">
              <p>No photos selected for comparison.</p>
              <button 
                onClick={() => setShowCompareModal(false)}
                className="mt-4 text-primary font-bold hover:underline"
              >
                Close Comparison
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



function FilterChip({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
      "px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border",
      active 
        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
    )}>
      {label}
    </button>
  );
}

function Check({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

