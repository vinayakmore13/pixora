import { CheckCircle2, CopyPlus, Heart, Info, Loader2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRealtimeSelectionService, GuestActivity } from '../lib/realtimeSelection';
import { getSelectionAIService, PhotoScore } from '../lib/selectionAI';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { GuestActivityFeed, GuestPresence } from './GuestActivityFeed';
import { SelectionAssistant, SelectionSuggestions } from './SelectionSuggestions';

interface Photo {
  id: string;
  file_path: string;
  thumbnail_url?: string;
  width: number;
  height: number;
}

interface SelectionConfig {
  id: string;
  event_id: string;
  max_photos: number;
  status: string;
  deadline: string | null;
}

interface Favorite {
  photo_id: string;
  guest_id: string;
}

interface GuestStatus {
  id: string;
  name: string;
  status: 'invited' | 'accepted' | 'submitted';
  selected_count: number;
  last_activity: string;
}

export function SelectionPortal() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selection, setSelection] = useState<SelectionConfig | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  
  const [guestId, setGuestId] = useState<string | null>(sessionStorage.getItem(`guest_id_${code}`) || null);
  const [guestName, setGuestName] = useState(() => sessionStorage.getItem(`guest_name_${code}`) || '');
  const [guestEmail, setGuestEmail] = useState(() => sessionStorage.getItem(`guest_email_${code}`) || '');
  
  const [submitting, setSubmitting] = useState(false);
  const [allGuests, setAllGuests] = useState<GuestStatus[]>([]);
  const [showGuestStatus, setShowGuestStatus] = useState(false);
  
  // Real-time Collaboration State
  const [activities, setActivities] = useState<GuestActivity[]>([]);
  const [activeGuests, setActiveGuests] = useState<GuestStatus[]>([]);
  const realtimeRef = useRef<any>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  // Comparison Mode State
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparePhotos, setComparePhotos] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // AI Suggestions State
  const [suggestions, setSuggestions] = useState<PhotoScore[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const photoGridRef = useRef<HTMLDivElement>(null);
  const photoRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (code) {
      loadSelectionData();
    }
  }, [code]);

  // Set up real-time subscriptions when guest joins
  useEffect(() => {
    if (!selection || !guestId) return;

    const setupRealtime = async () => {
      try {
        const realtimeService = getRealtimeSelectionService();
        realtimeRef.current = realtimeService;

        realtimeService.subscribe(selection.id, guestId, {
          onGuestActivity: (activity) => {
            if (!mountedRef.current) return;
            console.log('[SelectionPortal] Guest activity:', activity);
            setActivities((prev) => [activity, ...prev].slice(0, 10));
            if (activityTimeoutRef.current) {
              clearTimeout(activityTimeoutRef.current);
            }
            activityTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setActivities((prev) => prev.slice(1));
              }
              activityTimeoutRef.current = null;
            }, 5000);
          },
          onSelectionUpdate: (data) => {
            // Reload favorites when other guests make selections
            console.log('[SelectionPortal] Selection update:', data);
            loadFavorites(selection.id);
          },
          onGuestJoined: (guest) => {
            console.log('[SelectionPortal] Guest joined:', guest);
            setActiveGuests((prev) => {
              const filtered = prev.filter((g) => g.id !== guest.guest_id);
              return [
                {
                  id: guest.guest_id,
                  name: guest.guest_name,
                  status: 'accepted',
                  selected_count: guest.selection_count,
                  last_activity: guest.last_activity,
                },
                ...filtered,
              ];
            });
          },
          onError: (error) => {
            console.error('[SelectionPortal] Real-time error:', error);
          },
        });

        // Load initial active guests
        loadGuestStatus(selection.id);
      } catch (err) {
        console.error('[SelectionPortal] Failed to setup real-time:', err);
      }
    };

    setupRealtime();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
      if (realtimeRef.current) {
        realtimeRef.current.unsubscribe();
      }
    };
  }, [selection, guestId]);

  const loadSelectionData = async () => {
    try {
      setLoading(true);
      // 1. Get selection config
      const { data: selData, error: selError } = await supabase
        .from('photo_selections')
        .select('*')
        .eq('selection_code', code)
        .single();
        
      if (selError) throw selError;
      setSelection(selData);

      // 2. Get photos (edited only)
      const { data: photoData, error: photoError } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', selData.event_id)
        .eq('is_edited', true)
        .order('created_at', { ascending: true });
        
      if (photoError) throw photoError;
      setPhotos(photoData || []);

      // 3. Get existing favorites
      loadFavorites(selData.id);

    } catch (err) {
      console.error(err);
      setError('Invalid selection code or portal not found.');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async (selectionId: string) => {
    const { data } = await supabase
      .from('photo_favorites')
      .select('photo_id, guest_id')
      .eq('selection_id', selectionId);
      
    if (data) {
      setFavorites(data);
    }
  };

  const loadGuestStatus = async (selectionId: string) => {
    try {
      const { data: guests, error } = await supabase
        .from('photo_selection_guests')
        .select('id, name, status, last_activity')
        .eq('selection_id', selectionId);
      
      if (error) throw error;
      if (guests) {
        const guestStats = guests.map(guest => {
          const guestSelectionCount = favorites.filter(f => f.guest_id === guest.id).length;
          return {
            ...guest,
            selected_count: guestSelectionCount
          };
        });
        setAllGuests(guestStats);
      }
    } catch (err) {
      console.error('Error loading guest status:', err);
    }
  };

  // Load AI suggestions when favorites change
  useEffect(() => {
    if (!selection || !guestId || !photos.length) return;

    const loadSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const aiService = getSelectionAIService();
        const yourPhotoIds = favorites
          .filter(f => f.guest_id === guestId)
          .map(f => f.photo_id);
        
        const scores = await aiService.getSuggestions(
          selection.id,
          guestId,
          yourPhotoIds
        );
        setSuggestions(scores);
      } catch (error) {
        console.error('[SelectionPortal] Error loading suggestions:', error);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    // Debounce suggestions loading
    const timer = setTimeout(loadSuggestions, 500);
    return () => clearTimeout(timer);
  }, [selection, guestId, favorites, photos]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection || !guestName.trim()) return;
    
    try {
      setSubmitting(true);
      // Check if guest exists
      const { data: existing } = await supabase
        .from('photo_selection_guests')
        .select('*')
        .eq('selection_id', selection.id)
        .eq('name', guestName.trim())
        .maybeSingle();
        
      let guest_id;
      if (existing) {
        guest_id = existing.id;
      } else {
        const { data: newGuest, error: guestErr } = await supabase
          .from('photo_selection_guests')
          .insert({
            selection_id: selection.id,
            name: guestName.trim(),
            email: guestEmail.trim()
          })
          .select()
          .single();
          
        if (guestErr) throw guestErr;
        guest_id = newGuest.id;
      }
      
      setGuestId(guest_id);
      setGuestName(guestName.trim());
      setGuestEmail(guestEmail.trim());
      sessionStorage.setItem(`guest_id_${code}`, guest_id);
      sessionStorage.setItem(`guest_name_${code}`, guestName.trim());
      sessionStorage.setItem(`guest_email_${code}`, guestEmail.trim());
    } catch (err) {
      console.error('Join error', err);
      alert('Failed to join. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFavorite = async (photoId: string) => {
    if (!selection || !guestId || selection.status !== 'pending') return;

    const isFav = favorites.some(f => f.photo_id === photoId && f.guest_id === guestId);
    
    // Check if adding would exceed limit
    const uniqueFavs = new Set(favorites.map(f => f.photo_id));
    if (!isFav && uniqueFavs.size >= selection.max_photos && !uniqueFavs.has(photoId)) {
      alert(`You've already selected the maximum of ${selection.max_photos} photos.`);
      return;
    }

    try {
      // Optimistic update
      if (isFav) {
        setFavorites(prev => prev.filter(f => !(f.photo_id === photoId && f.guest_id === guestId)));
        await supabase
          .from('photo_favorites')
          .delete()
          .match({ selection_id: selection.id, photo_id: photoId, guest_id: guestId });
      } else {
        setFavorites(prev => [...prev, { photo_id: photoId, guest_id: guestId }]);
        await supabase
          .from('photo_favorites')
          .insert({ selection_id: selection.id, photo_id: photoId, guest_id: guestId });
      }
      
      // Broadcast selection to other guests in real-time
      if (realtimeRef.current) {
        realtimeRef.current.broadcastSelection(photoId, guestName);
      }
      
      // Reload favorites to sync with partner's potentials
      loadFavorites(selection.id);
      loadGuestStatus(selection.id);
    } catch (err) {
      console.error(err);
      loadFavorites(selection.id); // Revert on err
    }
  };

  const handleSuggestedPhotoClick = (photoId: string) => {
    // Scroll to the suggested photo
    const photoElement = photoRefsMap.current.get(photoId);
    if (photoElement && photoGridRef.current) {
      photoElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Add a highlight animation
      photoElement.classList.add('ring-2', 'ring-blue-500', 'animate-pulse');
      setTimeout(() => {
        photoElement.classList.remove('ring-2', 'ring-blue-500', 'animate-pulse');
      }, 2000);
    }
  };

  const handleSubmitSelections = async () => {
    if (!selection) return;
    const uniqueFavs = new Set(favorites.map(f => f.photo_id));
    
    if (uniqueFavs.size !== selection.max_photos) {
      alert(`Please select exactly ${selection.max_photos} photos before submitting.`);
      return;
    }
    
    if (confirm('Are you sure you want to finalize and submit these selections to the photographer? This cannot be undone.')) {
      try {
        setSubmitting(true);
        const { error } = await supabase
          .from('photo_selections')
          .update({ status: 'submitted' })
          .eq('id', selection.id);
          
        if (error) throw error;
        setSelection({ ...selection, status: 'submitted' });
      } catch (err) {
        console.error(err);
        alert('Failed to submit selections.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-on-surface-variant font-medium tracking-wide">Loading portal...</p>
      </div>
    );
  }

  if (error || !selection) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-red-500/10">
          <Info size={40} />
        </div>
        <h1 className="text-3xl font-serif font-bold text-on-surface mb-4">Portal Unavailable</h1>
        <p className="text-on-surface-variant max-w-md">{error || 'This selection portal does not exist or has been removed.'}</p>
      </div>
    );
  }

  // Calculate unique photos selected
  const uniqueSelectedIds = Array.from(new Set(favorites.map(f => f.photo_id)));
  const progressPercent = Math.min(100, (uniqueSelectedIds.length / selection.max_photos) * 100);

  if (!guestId) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] silk-shadow border border-outline-variant/5 max-w-md w-full text-center">
          <h1 className="text-3xl font-serif font-bold text-on-surface mb-2">Photo Selection</h1>
          <p className="text-on-surface-variant mb-8">Please enter your name to begin selecting photos for the album.</p>
          
          <form onSubmit={handleJoin} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface ml-1">Your Name</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g., Priya"
                className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-2 mb-6">
              <label className="text-sm font-bold text-on-surface ml-1">Email <span className="text-on-surface-variant font-normal">(optional)</span></label>
              <input
                type="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="For updates"
                className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={submitting || !guestName.trim()}
              className="w-full signature-gradient text-white py-3.5 flex items-center justify-center gap-2 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 text-base touch-target"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : 'Enter Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isSubmitted = selection.status === 'submitted' || selection.status === 'completed';

  return (
    <div className="min-h-screen bg-surface pb-40 md:pb-32">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl z-40 border-b border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex-1 sm:flex-none">
            <h1 className="text-lg sm:text-2xl font-serif font-bold text-on-surface">Photo Selection</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-primary leading-none">
              {isSubmitted ? 'Finalized' : `${uniqueSelectedIds.length} / ${selection.max_photos}`}
            </p>
          </div>
          
          {/* Mobile Progress Bar */}
          <div className="w-full sm:hidden h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                uniqueSelectedIds.length === selection.max_photos ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          
          {/* Guest Status Button (Mobile) */}
          <button
            onClick={() => setShowGuestStatus(!showGuestStatus)}
            className="sm:hidden px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-colors"
          >
            👥 {allGuests.length}
          </button>
          
          {!isSubmitted && (
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => {
                  setIsCompareMode(!isCompareMode);
                  if (isCompareMode) setComparePhotos([]);
                }}
                className={cn(
                  "px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap touch-target",
                  isCompareMode ? "bg-primary/10 text-primary border border-primary/20" : "bg-white border border-outline-variant/20 text-on-surface hover:bg-surface-container-low"
                )}
              >
                <CopyPlus size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Compare Mode</span>
                <span className="sm:hidden">Compare</span>
              </button>

              <div className="flex-1 hidden sm:block">
                <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      uniqueSelectedIds.length === selection.max_photos ? "bg-green-500" : "bg-primary"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Guest Status Button (Desktop) */}
              <button
                onClick={() => setShowGuestStatus(!showGuestStatus)}
                className="hidden sm:block px-4 py-2.5 rounded-full text-sm font-bold bg-white border border-outline-variant/20 text-on-surface hover:bg-surface-container-low transition-colors"
              >
                👥 Guests ({allGuests.length})
              </button>
              <button
                onClick={handleSubmitSelections}
                disabled={uniqueSelectedIds.length !== selection.max_photos || submitting}
                className={cn(
                  "px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all whitespace-nowrap touch-target",
                  uniqueSelectedIds.length === selection.max_photos 
                    ? "signature-gradient text-white shadow-lg shadow-primary/20 active:scale-95" 
                    : "bg-surface-container-low text-on-surface-variant cursor-not-allowed"
                )}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : (
                  <>
                    <span className="hidden sm:inline">Submit Selections</span>
                    <span className="sm:hidden">Submit</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Guest Status Dashboard */}
      {showGuestStatus && allGuests.length > 0 && (
        <div className="fixed top-20 left-0 right-0 bg-white border-b border-outline-variant/10 z-30 max-h-48 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Guest Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allGuests.map(guest => (
                <div key={guest.id} className="bg-surface-container-low rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-on-surface">{guest.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {guest.selected_count} / {selection?.max_photos} selected
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-block px-2 py-1 rounded-full text-xs font-bold",
                      guest.status === 'submitted' ? "bg-green-100 text-green-700" :
                      guest.status === 'accepted' ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    )}>
                      {guest.status.charAt(0).toUpperCase() + guest.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Main Grid */}
      <main className={cn(
        "max-w-7xl mx-auto px-4 sm:px-8 transition-all",
        showGuestStatus ? "pt-48 sm:pt-40" : "pt-28 sm:pt-40"
      )}>
        {isSubmitted && (
          <div className="mb-12 bg-green-50 border border-green-200 text-green-800 p-8 rounded-[2rem] text-center max-w-2xl mx-auto">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold mb-2">Selections Finalized</h2>
            <p className="text-green-700">
              The photo selections have been submitted to the photographer. Thank you!
            </p>
          </div>
        )}

        {!isSubmitted && guestId && photos.length > 0 && (
          <div className="mb-8 space-y-4">
            {/* Selection Assistant Tip */}
            <SelectionAssistant
              totalGuests={allGuests.filter(g => g.status === 'accepted').length}
              yourSelectionsCount={favorites.filter(f => f.guest_id === guestId).length}
              maxPhotos={selection?.max_photos || 0}
              isMobile={false}
            />

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <SelectionSuggestions
                suggestions={suggestions}
                onSuggestedPhotoClick={handleSuggestedPhotoClick}
                selectedPhotoIds={new Set(favorites.filter(f => f.guest_id === guestId).map(f => f.photo_id))}
                isMobile={false}
              />
            )}
          </div>
        )}

        {photos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-on-surface-variant text-sm">No photos have been uploaded for selection yet.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4" ref={photoGridRef}>
            {photos.map((photo) => {
              const photoFavs = favorites.filter(f => f.photo_id === photo.id);
              const isFavByMe = photoFavs.some(f => f.guest_id === guestId);
              const isFavByOther = photoFavs.length > 0 && !isFavByMe;
              const isSelectedForCompare = comparePhotos.includes(photo.id);
              
              const imageUrl = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl;

              return (
                <div 
                  key={photo.id}
                  ref={(el) => {
                    if (el) photoRefsMap.current.set(photo.id, el);
                    else photoRefsMap.current.delete(photo.id);
                  }}
                  className={cn(
                    "break-inside-avoid relative group rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer touch-target active:scale-95 transition-transform",
                    (isFavByMe || isFavByOther) && !isCompareMode && "ring-2 sm:ring-4 ring-primary ring-offset-1 sm:ring-offset-2 ring-offset-bg-surface",
                    isSelectedForCompare && isCompareMode && "ring-2 sm:ring-4 ring-blue-500 ring-offset-1 sm:ring-offset-2 ring-offset-bg-surface"
                  )}
                  onClick={() => {
                    if (isSubmitted) return;
                    if (isCompareMode) {
                      if (isSelectedForCompare) {
                        setComparePhotos(prev => prev.filter(id => id !== photo.id));
                      } else if (comparePhotos.length < 4) {
                        setComparePhotos(prev => [...prev, photo.id]);
                      } else {
                        alert('You can only compare up to 4 photos at once.');
                      }
                    } else {
                      toggleFavorite(photo.id);
                    }
                  }}
                >
                  <img
                    src={imageUrl}
                    alt="Event Photo"
                    className={cn(
                      "w-full h-auto object-cover transition-transform duration-500",
                      !isSubmitted && "group-hover:scale-105"
                    )}
                    loading="lazy"
                  />
                  
                  {/* Overlay Gradient */}
                  {!isSubmitted && !isCompareMode && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity p-3 sm:p-4 flex flex-col justify-end">
                      <div className="text-white text-xs font-bold drop-shadow-md">
                        {isFavByMe ? 'Remove from Selection' : 'Add to Selection'}
                      </div>
                    </div>
                  )}

                  {/* Compare Mode Overlay */}
                  {isCompareMode && (
                    <div className={cn(
                      "absolute inset-0 bg-black/20 transition-opacity flex items-center justify-center",
                      isSelectedForCompare ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center border-2",
                        isSelectedForCompare ? "bg-blue-500 border-blue-500 text-white" : "bg-black/50 border-white text-white"
                      )}>
                        {isSelectedForCompare ? <CheckCircle2 size={24} /> : <CopyPlus size={24} />}
                      </div>
                    </div>
                  )}

                  {/* Heart Icon */}
                  {(isFavByMe || isFavByOther || (!isSubmitted && !isCompareMode)) && (
                    <button
                      className={cn(
                        "absolute top-3 right-3 sm:top-4 sm:right-4 p-2 sm:p-2.5 rounded-full transition-all shadow-lg backdrop-blur-md z-10 touch-target touch-target-heart",
                        isFavByMe 
                          ? "bg-primary text-white scale-100 opacity-100" 
                          : isFavByOther
                            ? "bg-white/90 text-primary scale-100 opacity-100" // Partner liked it
                            : isCompareMode
                              ? "hidden"
                              : "bg-surface-container-high/60 text-white scale-75 opacity-75 sm:scale-0 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100 hover:bg-white hover:text-primary"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSubmitted) toggleFavorite(photo.id);
                      }}
                      disabled={isSubmitted}
                    >
                      <Heart 
                        size={18} 
                        className={cn(
                          "sm:w-5 sm:h-5",
                          (isFavByMe || isFavByOther) && "fill-current"
                        )} 
                      />
                    </button>
                  )}
                  
                  {isFavByOther && !isFavByMe && (
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 text-center text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-primary bg-white/90 backdrop-blur-md py-1 sm:py-1.5 px-2 sm:px-3 rounded-full shadow-lg border border-primary/20">
                      Partner selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Real-time Activity Feed & Guest Presence (Desktop) */}
      {!isSubmitted && (
        <aside className="hidden lg:block fixed right-4 xl:right-8 top-32 max-w-xs max-h-screen overflow-y-auto z-20">
          <div className="space-y-4">
            {/* Activity Feed */}
            {activities.length > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-outline-variant/10 overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/10">
                  <h3 className="text-sm font-bold text-on-surface">Recent Activity</h3>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto">
                  <GuestActivityFeed activities={activities} />
                </div>
              </div>
            )}

            {/* Active Guests */}
            {activeGuests.length > 0 && (
              <div className="bg-white rounded-xl shadow-md border border-outline-variant/10 overflow-hidden">
                <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/10">
                  <h3 className="text-sm font-bold text-on-surface">Active Guests ({activeGuests.length})</h3>
                </div>
                <div className="p-4">
                  <GuestPresence guests={activeGuests.map(g => ({ guest_id: g.id, guest_name: g.name, selection_count: g.selected_count, is_active: true }))} maxPhotos={selection?.max_photos || 0} />
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Real-time Activity Feed & Guest Presence (Mobile) */}
      {!isSubmitted && (activities.length > 0 || activeGuests.length > 0) && (
        <div className="lg:hidden fixed bottom-24 left-4 right-4 bg-white rounded-xl shadow-md border border-outline-variant/10 z-20 max-h-48 overflow-y-auto">
          <div className="p-4 space-y-4">
            {activities.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Recent Activity</h3>
                <GuestActivityFeed activities={activities} />
              </div>
            )}
            
            {activeGuests.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Active Guests</h3>
                <GuestPresence guests={activeGuests.map(g => ({ guest_id: g.id, guest_name: g.name, selection_count: g.selected_count, is_active: true }))} maxPhotos={selection?.max_photos || 0} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Mode Action Bar */}
      {isCompareMode && comparePhotos.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2 sm:w-[90%] sm:max-w-md bg-gray-900 text-white p-3 sm:p-4 rounded-full shadow-2xl flex items-center justify-between z-50 touch-target">
          <div className="font-bold text-xs sm:text-sm px-2 sm:px-4">
            {comparePhotos.length} photo{comparePhotos.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={() => setShowCompareModal(true)}
            disabled={comparePhotos.length < 2}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-400 text-white px-4 sm:px-6 py-2 rounded-full font-bold text-xs sm:text-sm transition-colors touch-target-compare"
          >
            <span className="hidden sm:inline">Compare Side-by-Side</span>
            <span className="sm:hidden">Compare</span>
          </button>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && comparePhotos.length > 1 && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="p-4 flex justify-between items-center text-white bg-black/50">
            <h2 className="text-xl font-bold">Compare Photos</h2>
            <button onClick={() => setShowCompareModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className={cn(
            "flex-1 p-3 sm:p-4 grid gap-3 sm:gap-4 overflow-hidden",
            comparePhotos.length === 2 ? "grid-cols-2" : comparePhotos.length === 3 ? "grid-cols-3" : "grid-cols-2 grid-rows-2"
          )}>
            {comparePhotos.map(photoId => {
              const photo = photos.find(p => p.id === photoId);
              if (!photo) return null;
              
              const isFav = favorites.some(f => f.photo_id === photo.id && f.guest_id === guestId);
              const imageUrl = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl;
              
              return (
                <div key={photoId} className="relative flex flex-col items-center justify-center bg-gray-900 rounded-lg sm:rounded-2xl overflow-hidden group">
                  <img src={imageUrl} alt="Compare" className="max-w-full max-h-full object-contain" />
                  
                  <button
                    onClick={() => toggleFavorite(photo.id)}
                    className={cn(
                      "absolute bottom-4 sm:bottom-6 p-3 sm:p-4 rounded-full shadow-2xl transition-all touch-target",
                      isFav ? "bg-primary text-white scale-110" : "bg-white/90 text-gray-900 hover:bg-primary hover:text-white"
                    )}
                  >
                    <Heart size={20} className={cn("sm:w-6 sm:h-6", isFav && "fill-current")} />
                  </button>
                  <button
                    onClick={() => {
                      setComparePhotos(prev => prev.filter(id => id !== photoId));
                      if (comparePhotos.length <= 2) setShowCompareModal(false);
                    }}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 touch-target-close"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
