import { CheckCircle2, CopyPlus, Heart, Info, Loader2, X, Search, Sparkles, Lock, CreditCard, Mail, Phone, ShieldCheck, LayoutGrid, Download, CheckSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRealtimeSelectionService, GuestActivity } from '../lib/realtimeSelection';
import { getSelectionAIService, PhotoScore } from '../lib/selectionAI';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { GuestActivityFeed, GuestPresence } from './GuestActivityFeed';
import { SelectionAssistant, SelectionSuggestions } from './SelectionSuggestions';
import { faceEngine } from '../lib/faceEngine';
import { usePhotographerBranding } from '../hooks/usePhotographerBranding';
import { SecureImage } from './SecureImage';
import { logSecurityEvent, getDeviceFingerprint } from '../lib/securityEngine';
import { azureStorageProvider } from '../lib/providers/azureStorageProvider';

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
  view_count: number;
  max_views: number;
  is_secure_mode: boolean;
  event?: any;
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


const SECURITY_STYLES = `
  @media print {
    body { display: none !important; }
  }
  .secure-portal, .no-screenshot {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
`;

export function SelectionPortal() {
  const { code } = useParams();
  const navigate = useNavigate();
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

  // Fast Selection additions
  const [isFastSelection, setIsFastSelection] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  
  const { user } = useAuth();
  const isPhotographer = user && selection?.event?.user_id === user.id;

  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiLimit, setAiLimit] = useState(1);
  const [aiResults, setAiResults] = useState<string[]>([]); // Ranked IDs
  const [showPaywall, setShowPaywall] = useState(false);
  const [matchedPhotoIds, setMatchedPhotoIds] = useState<Set<string>>(new Set());

  // AI Suggestions State
  const [suggestions, setSuggestions] = useState<PhotoScore[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const photoGridRef = useRef<HTMLDivElement>(null);
  const photoRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get branding if event is loaded
  const { branding, loading: brandingLoading } = usePhotographerBranding(selection?.event?.photographer_id || '');

  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (selection?.is_secure_mode && document.visibilityState === 'hidden') {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (selection?.is_secure_mode && (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p'))) {
        e.preventDefault();
        alert('Screen capture and printing are disabled for security.');
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [selection]);

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
        .select('*, event:events(*)')
        .eq('selection_code', code)
        .maybeSingle();
        
      if (selData) {
        const isPhotographerUser = user && selData.event?.user_id === user.id;

        // Enforce view limits for secure mode (Bypass for photographer)
        if (!isPhotographerUser && selData.is_secure_mode && selData.max_views > 0 && selData.view_count >= selData.max_views) {
          setError('Access limit reached. This selection portal has been viewed too many times.');
          setLoading(false);
          return;
        }

        // Increment view count via RPC (Skip for photographer)
        if (!isPhotographerUser) {
          await supabase.rpc('increment_selection_view', { 
            p_selection_id: selData.id,
            p_guest_id: guestId,
            p_user_agent: navigator.userAgent
          });
        }

        setIsFastSelection(false);
        setSelection(selData);

        // Get photos
        const photosQuery = supabase
          .from('photos')
          .select('*')
          .eq('event_id', selData.event_id);
          
        if (!isPhotographerUser) {
          photosQuery.eq('is_in_selection_pool', true);
        }

        const { data: photoData } = await photosQuery.order('created_at', { ascending: true });
          
        setPhotos(photoData || []);
        loadFavorites(selData.id);
      } else {
        // Try fast selection
        const { data: fastData, error: fastError } = await supabase
          .from('fast_selection_sessions')
          .select('*')
          .eq('selection_code', code)
          .maybeSingle();

        if (fastError || !fastData) {
          throw new Error('Selection portal not found');
        }

        setIsFastSelection(true);
        setSelection(fastData);

        // Get photos for fast selection
        const { data: fastPhotos } = await supabase
          .from('fast_selection_photos')
          .select('*')
          .eq('session_id', fastData.id)
          .order('created_at', { ascending: true });

        // Map to common photo interface
        setPhotos(fastPhotos?.map(p => ({
          id: p.id,
          file_path: p.file_path,
          thumbnail_url: p.thumbnail_url,
          width: 0,
          height: 0
        })) || []);

        // Load client status for fast selection
        if (guestEmail) {
          const { data: client } = await supabase
            .from('fast_selection_clients')
            .select('*')
            .eq('session_id', fastData.id)
            .eq('email', guestEmail.trim())
            .maybeSingle();
          
          if (client) {
            setGuestId(client.id);
            setIsVerified(client.is_verified);
            setAiLimit(client.ai_unlocked_limit);
            loadFastFavorites(client.id);
          }
        }
      }

    } catch (err) {
      console.error(err);
      setError('Invalid selection code or portal not found.');
    } finally {
      setLoading(false);
    }
  };

  const loadFastFavorites = async (clientId: string) => {
    const { data } = await supabase
      .from('fast_selection_favorites')
      .select('photo_id')
      .eq('client_id', clientId);
      
    if (data) {
      setFavorites(data.map(f => ({ photo_id: f.photo_id, guest_id: clientId })));
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
        .from(isFastSelection ? 'fast_selection_clients' : 'photo_selection_guests')
        .select('*')
        .eq(isFastSelection ? 'session_id' : 'selection_id', selectionId);
      
      if (error) throw error;
      if (guests) {
        const guestStats = guests.map(guest => {
          const guestId = guest.id;
          const guestSelectionCount = favorites.filter(f => f.guest_id === guestId).length;
          return {
            id: guest.id,
            name: guest.name || guest.email,
            status: guest.status || 'accepted',
            last_activity: guest.last_activity,
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

  const handleAIFaceSearch = async (imageFile: File) => {
    setIsAiSearching(true);
    try {
      // Convert File to HTMLImageElement for face-api.js
      const img = new Image();
      const objectUrl = URL.createObjectURL(imageFile);
      img.src = objectUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // 1. Get embeddings for search image
      const searchResult = await faceEngine.findMyPhotos(img, selection!.event_id);
      URL.revokeObjectURL(objectUrl);
      
      const rankedIds = searchResult.map(r => r.photo_id);
      setAiResults(rankedIds);
      setMatchedPhotoIds(new Set(rankedIds));
      
      // If found more than limit, show paywall
      if (rankedIds.length > aiLimit) {
        setShowPaywall(true);
      }
      
      // Scroll to first result
      if (rankedIds.length > 0) {
        handleSuggestedPhotoClick(rankedIds[0]);
      }
    } catch (err) {
      console.error(err);
      alert('AI Search failed. Please try again.');
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate OTP verification
    if (enteredOtp === '123456') {
      try {
        await supabase
          .from('fast_selection_clients')
          .update({ is_verified: true })
          .eq('id', guestId);
        setIsVerified(true);
        setShowVerification(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('Invalid OTP. Try 123456 for demo.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selection || !guestName.trim() || !guestEmail.trim()) return;
    
    try {
      setSubmitting(true);
      if (isFastSelection) {
        // Create or get client
        const { data: client, error: clientErr } = await supabase
          .from('fast_selection_clients')
          .upsert({
            session_id: selection.id,
            name: guestName.trim(),
            email: guestEmail.trim(),
            phone: '', // Optional
          }, { onConflict: 'session_id,email' })
          .select()
          .single();

        if (clientErr) throw clientErr;
        setGuestId(client.id);
        setAiLimit(client.ai_unlocked_limit);
        setIsVerified(client.is_verified);
        
        sessionStorage.setItem(`guest_id_${code}`, client.id);
        sessionStorage.setItem(`guest_email_${code}`, client.email);
        
        if (!client.is_verified) {
          setOtpSent(true);
          setShowVerification(true);
        }
      } else {
        // Legacy event join
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
        sessionStorage.setItem(`guest_id_${code}`, guest_id);
        sessionStorage.setItem(`guest_name_${code}`, guestName.trim());
      }
    } catch (err) {
      console.error('Join error', err);
      alert('Failed to join.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFavorite = async (photoId: string) => {
    if (!selection || (isFastSelection && !guestId) || (!isFastSelection && !guestId)) return;
    if (selection.status !== 'pending' && !isFastSelection) return;

    const isFav = favorites.some(f => f.photo_id === photoId && f.guest_id === guestId);
    
    // Check limit
    const uniqueFavs = new Set(favorites.map(f => f.photo_id));
    if (!isFav && uniqueFavs.size >= (selection.max_photos || 50) && !uniqueFavs.has(photoId)) {
      alert(`Maximum limit reached.`);
      return;
    }

    try {
      if (isFastSelection) {
        if (isFav) {
          setFavorites(prev => prev.filter(f => f.photo_id !== photoId));
          await supabase.from('fast_selection_favorites').delete().match({ client_id: guestId, photo_id: photoId });
        } else {
          setFavorites(prev => [...prev, { photo_id: photoId, guest_id: guestId! }]);
          await supabase.from('fast_selection_favorites').insert({ client_id: guestId, photo_id: photoId });
        }
      } else {
        if (isFav) {
          setFavorites(prev => prev.filter(f => !(f.photo_id === photoId && f.guest_id === guestId)));
          await supabase.from('photo_favorites').delete().match({ selection_id: selection.id, photo_id: photoId, guest_id: guestId });
        } else {
          setFavorites(prev => [...prev, { photo_id: photoId, guest_id: guestId! }]);
          await supabase.from('photo_favorites').insert({ selection_id: selection.id, photo_id: photoId, guest_id: guestId });
        }
      }
      
      if (!isFastSelection && realtimeRef.current) {
        realtimeRef.current.broadcastSelection(photoId, guestName);
      }
      
      if (!isFastSelection) {
        loadFavorites(selection.id);
        loadGuestStatus(selection.id);
      }
    } catch (err) {
      console.error(err);
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
    const uniqueFavsCount = favorites.filter(f => f.guest_id === guestId).length;
    
    if (selection.max_photos > 0 && uniqueFavsCount > selection.max_photos) {
      alert(`Please remove ${uniqueFavsCount - selection.max_photos} photos to stay within the limit.`);
      return;
    }
    
    if (uniqueFavsCount === 0) {
      alert("Please select some photos first!");
      return;
    }
    
    if (confirm('Finalize your selection? You will not be able to change it after submitting.')) {
      try {
        setSubmitting(true);
        
        // 1. Update the correct tables based on selection type
        if (isFastSelection) {
          // Update client status
          await supabase
            .from('fast_selection_clients')
            .update({ status: 'submitted' })
            .eq('id', guestId);

          // Update overall session status
          await supabase
            .from('fast_selection_sessions')
            .update({ status: 'submitted' })
            .eq('id', selection.id);
        } else {
          // Update the overall portal status
          const { error: selError } = await supabase
            .from('photo_selections')
            .update({ 
              status: 'submitted'
            })
            .eq('id', selection.id);
            
          if (selError) throw selError;

          // Update guest status
          if (guestId) {
            await supabase
              .from('photo_selection_guests')
              .update({ status: 'submitted' })
              .eq('id', guestId);
          }
        }
          
        setSelection({ ...selection, status: 'submitted' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        alert('Selections submitted successfully! The photographer has been notified.');
      } catch (err) {
        console.error('Submit error:', err);
        alert('Failed to submit. Please try again.');
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
  const maxPhotosCount = Number(selection.max_photos) || 0;
  const progressPercent = maxPhotosCount > 0 
    ? Math.min(100, (uniqueSelectedIds.length / maxPhotosCount) * 100)
    : (uniqueSelectedIds.length > 0 ? 100 : 0);

  if (!isPhotographer && (!guestId || (isFastSelection && !isVerified))) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] silk-shadow border border-outline-variant/5 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-on-surface mb-2">Fast Selection</h1>
            <p className="text-on-surface-variant">
              {otpSent ? 'Verify your email to access the gallery.' : 'Please enter your details to begin.'}
            </p>
          </div>
          
          {!otpSent ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Your Name</label>
                <input
                  type="text" required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g., Priya"
                  className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
                <input
                  type="email" required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-base focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full signature-gradient text-white py-4 rounded-full font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : 'Enter Portal'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerificationSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Demo Mode Notice</p>
                  <p className="text-xs text-on-surface-variant">Since this is a demo, please use the code <strong>123456</strong> to proceed.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 text-center block">Enter verification code</label>
                  <input
                    type="text" required maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-surface-container-low border-none rounded-2xl p-4 text-center text-2xl tracking-[0.5em] font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full signature-gradient text-white py-4 rounded-full font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <ShieldCheck size={20} /> Verify & Access
                </button>
                <button 
                  type="button"
                  onClick={() => alert('Demo Mode: Your code is 123456')}
                  className="w-full text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors py-2"
                >
                  Didn't receive code? Resend
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isSubmitted = selection.status === 'submitted' || selection.status === 'completed';

  return (
    <div className="min-h-screen bg-surface pb-40 md:pb-32 secure-portal no-screenshot">
      <style>{SECURITY_STYLES}</style>
      
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl z-40 border-b border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex-1 sm:flex-none flex items-center gap-4">
            {branding?.logo_url ? (
              <img 
                src={azureStorageProvider.getBlobUrl(branding.logo_url, 'photographer-assets')} 
                alt={branding.studio_name} 
                className="h-8 sm:h-12 w-auto object-contain" 
              />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                {branding?.studio_name?.[0] || 'S'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-serif font-bold text-on-surface">
                  {branding?.studio_name || 'Fast Selection'}
                </h1>
              {selection?.is_secure_mode && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-green-100">
                  <ShieldCheck size={10} /> Secure
                </div>
              )}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary leading-none mt-1">
              {isSubmitted ? 'Finalized' : `${uniqueSelectedIds.length} / ${maxPhotosCount === 0 ? '∞' : maxPhotosCount}`}
            </p>
          </div>
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
              {/* AI Search Button - Only for guests */}
              {!isPhotographer && (
                <div className="relative">
                  <input
                    type="file"
                    id="ai-search-input"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAIFaceSearch(file);
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('ai-search-input')?.click()}
                    disabled={isAiSearching}
                    className="px-4 py-2.5 rounded-full font-bold text-sm bg-primary/10 text-primary border border-primary/20 flex items-center gap-2 hover:bg-primary/20 transition-all touch-target"
                  >
                    {isAiSearching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Find My Photos
                  </button>
                </div>
              )}

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

              {!isPhotographer && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={cn(
                    "px-3 sm:px-4 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap touch-target",
                    showFavoritesOnly ? "bg-pink-100 text-pink-600 border border-pink-200" : "bg-white border border-outline-variant/20 text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <Heart size={14} className={cn(showFavoritesOnly && "fill-current")} />
                  <span className="hidden sm:inline">My Selections</span>
                  <span className="sm:hidden">Selected</span>
                </button>
              )}

              <div className="flex-1 hidden sm:block">
                <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      uniqueSelectedIds.length > 0 && (maxPhotosCount === 0 || uniqueSelectedIds.length <= maxPhotosCount) ? "bg-green-500" : "bg-primary"
                    )}
                    style={{ width: maxPhotosCount > 0 ? `${progressPercent}%` : (uniqueSelectedIds.length > 0 ? '100%' : '0%') }}
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
              <div className="flex flex-col items-center sm:items-end gap-1">
                {/* Stats badge in header */}
                <div className="px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                   <span className="text-xs font-black text-primary uppercase tracking-widest">
                     {uniqueSelectedIds.length} / {maxPhotosCount === 0 ? '∞' : maxPhotosCount} Selected
                   </span>
                </div>
              </div>
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
                      {guest.selected_count} / {selection?.max_photos > 0 ? selection.max_photos : '∞'} selected
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

        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="inline-flex items-center p-1.5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <button
              onClick={() => setShowFavoritesOnly(false)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                !showFavoritesOnly ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <LayoutGrid size={18} />
              All Photos ({photos.length})
            </button>
            <button
              onClick={() => setShowFavoritesOnly(true)}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                showFavoritesOnly ? "bg-white text-pink-600 shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Heart size={18} className={cn(showFavoritesOnly && "fill-current")} />
              {isPhotographer ? 'All Guest Picks' : 'My Picks'} ({
                isPhotographer 
                  ? new Set(favorites.map(f => f.photo_id)).size 
                  : favorites.filter(f => f.guest_id === guestId).length
              })
            </button>
          </div>

          {isPhotographer && showFavoritesOnly && (
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <button 
                onClick={() => {
                  const allFavoriteIds = new Set(favorites.map(f => f.photo_id));
                  setComparePhotos(Array.from(allFavoriteIds));
                }}
                className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-outline-variant/20 text-xs font-bold transition-all"
              >
                <CheckSquare size={16} />
                Select All Picks
              </button>
              <button 
                onClick={async () => {
                  const uniquePicks = photos.filter(p => favorites.some(f => f.photo_id === p.id));
                  if (uniquePicks.length === 0) return;
                  
                  // Simplified bulk download call
                  const zipData = uniquePicks.map(p => ({
                    filePath: p.file_path,
                    filename: p.file_path.split('/').pop() || 'photo.jpg'
                  }));
                  
                  try {
                    const { downloadBulkZip } = await import('../lib/downloadUtils');
                    await downloadBulkZip(zipData, `${selection?.event?.name || 'selection'}-picks`);
                  } catch (err) {
                    console.error('Download failed', err);
                    alert('Download failed. Please try again.');
                  }
                }}
                className="flex items-center gap-2 px-8 py-2 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              >
                <Download size={16} />
                Download All Picks
              </button>
            </div>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-outline-variant/20">
            <p className="text-on-surface-variant font-medium">No photos have been uploaded for review yet.</p>
          </div>
        ) : showFavoritesOnly && favorites.filter(f => f.guest_id === guestId).length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-outline-variant/20 max-w-xl mx-auto">
            <Heart size={48} className="mx-auto mb-4 text-pink-200" />
            <h3 className="text-xl font-bold text-on-surface mb-2">No favorites yet</h3>
            <p className="text-on-surface-variant px-8">
              Go back to "All Photos" and tap the heart icon on any photo you want to include in your album.
            </p>
            <button
              onClick={() => setShowFavoritesOnly(false)}
              className="mt-6 px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:scale-105 transition-all"
            >
              Browse Photos
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4" ref={photoGridRef}>
            {photos
              .filter(photo => {
                if (!showFavoritesOnly) return true;
                if (isPhotographer) return favorites.some(f => f.photo_id === photo.id);
                return favorites.some(f => f.photo_id === photo.id && f.guest_id === guestId);
              })
              .map((photo) => {
                const photoFavs = favorites.filter(f => f.photo_id === photo.id);
                const isFavByMe = photoFavs.some(f => f.guest_id === guestId);
              const isFavByOther = photoFavs.length > 0 && !isFavByMe;
              const isSelectedForCompare = comparePhotos.includes(photo.id);
              
              const isLocked = matchedPhotoIds.has(photo.id) && aiResults.indexOf(photo.id) >= aiLimit;
              
              const displayUrl = photo.thumbnail_url 
                ? azureStorageProvider.getBlobUrl(photo.thumbnail_url, 'photos')
                : azureStorageProvider.getBlobUrl(photo.file_path, 'photos');

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
                    isSelectedForCompare && isCompareMode && "ring-2 sm:ring-4 ring-blue-500 ring-offset-1 sm:ring-offset-2 ring-offset-bg-surface",
                    matchedPhotoIds.has(photo.id) && !isLocked && "ring-2 ring-green-400"
                  )}
                  onClick={() => {
                    if (isLocked) {
                      setShowPaywall(true);
                      return;
                    }
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
                  <SecureImage
                    src={displayUrl}
                    alt="Event Photo"
                    watermarkText={guestName || guestEmail || selection?.event?.title}
                    isProtected={selection?.is_secure_mode}
                    className={cn(
                      "w-full h-auto object-cover transition-transform duration-500",
                      !isSubmitted && "group-hover:scale-105",
                      isLocked && "blur-xl grayscale opacity-50"
                    )}
                  />

                  {isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-white p-4 text-center">
                      <Lock size={24} className="mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-wider">Unlock AI Match</p>
                    </div>
                  )}
                  
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

      {/* Floating Bottom Submit Bar */}
      {!isSubmitted && guestId && !isPhotographer && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg">
          <div className="bg-on-surface/90 backdrop-blur-2xl p-4 rounded-[2.5rem] shadow-2xl border border-white/10 flex items-center justify-between gap-4">
            <div className="pl-4">
              <div className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Your Selection</div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xl font-black",
                  (maxPhotosCount > 0 && uniqueSelectedIds.length > maxPhotosCount) ? "text-red-400" : "text-white"
                )}>
                  {uniqueSelectedIds.length}
                </span>
                <span className="text-white/30 font-bold">/</span>
                <span className="text-white/60 font-bold">{maxPhotosCount === 0 ? '∞' : maxPhotosCount}</span>
              </div>
            </div>

            <button
              onClick={handleSubmitSelections}
              disabled={uniqueSelectedIds.length === 0 || (maxPhotosCount > 0 && uniqueSelectedIds.length > maxPhotosCount) || submitting}
              className={cn(
                "flex-1 h-14 rounded-full font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                (uniqueSelectedIds.length > 0 && (maxPhotosCount === 0 || uniqueSelectedIds.length <= maxPhotosCount))
                  ? "bg-primary text-white hover:scale-105 active:scale-95 shadow-xl shadow-primary/40"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <span>Submit Selection</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
              const imageUrl = azureStorageProvider.getBlobUrl(photo.file_path, 'photos');
              
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
      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setShowPaywall(false)}
              className="absolute top-6 right-6 p-2 hover:bg-surface-container-low rounded-full transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-on-surface mb-2">Unlock All Matches</h2>
              <p className="text-on-surface-variant">We found {aiResults.length} photos with your face. Unlock them to select for your album.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="border border-outline-variant/20 rounded-3xl p-6 text-center hover:border-primary transition-all group">
                <h4 className="text-lg font-bold mb-1">5 Photos</h4>
                <p className="text-2xl font-black text-primary mb-4">₹100</p>
                <button className="w-full py-2 bg-surface-container-low rounded-full text-xs font-bold group-hover:bg-primary group-hover:text-white transition-all">Select</button>
              </div>
              <div className="border-2 border-primary rounded-3xl p-6 text-center shadow-lg shadow-primary/10 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">BEST VALUE</div>
                <h4 className="text-lg font-bold mb-1">20 Photos</h4>
                <p className="text-2xl font-black text-primary mb-4">₹170</p>
                <button className="w-full py-2 bg-primary text-white rounded-full text-xs font-bold">Select</button>
              </div>
              <div className="border border-outline-variant/20 rounded-3xl p-6 text-center hover:border-primary transition-all group">
                <h4 className="text-lg font-bold mb-1">30 Photos</h4>
                <p className="text-2xl font-black text-primary mb-4">₹250</p>
                <button className="w-full py-2 bg-surface-container-low rounded-full text-xs font-bold group-hover:bg-primary group-hover:text-white transition-all">Select</button>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl mb-8">
              <CreditCard size={20} className="text-on-surface-variant" />
              <div className="flex-1">
                <p className="text-xs font-bold">Secure Payment</p>
                <p className="text-[10px] text-on-surface-variant">Payments are processed securely via encrypted gateway.</p>
              </div>
            </div>

            <p className="text-[10px] text-center text-on-surface-variant">
              By proceeding, you agree to our Terms of Service. Unlocked photos will be available immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


