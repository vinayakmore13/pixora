import { CheckCircle2, ChevronLeft, ChevronRight, Download, ScanFace, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { downloadBulkZip, downloadSingleImage } from '../lib/downloadUtils';
import { getPhotoPublicUrl, getPhotosByEventId, PhotoMetadata } from '../lib/photoMetadata';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { SelfieCapture } from './SelfieCapture';
import { faceEngine } from '../lib/faceEngine';

const isHybridAzure = import.meta.env.VITE_AI_PROVIDER === 'AZURE';

export function Gallery() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  
  // Data State
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [eventData, setEventData] = useState<{ name: string; event_date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PHOTOS_PER_PAGE = 20;

  // Tools & UI State
  const [isAIFinderOpen, setIsAIFinderOpen] = useState(false);
  const [aiStep, setAiStep] = useState(0); 
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  
  // AI Matching state
  const [matchedPhotos, setMatchedPhotos] = useState<PhotoMetadata[]>([]);
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);

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

  // Fetch Event & Initial Photos
  useEffect(() => {
    if (!id) return;

    const fetchEventData = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('name, event_date')
        .eq('id', id)
        .single();
        
      if (!error && data) {
        setEventData(data);
      }
    };

    const fetchInitialPhotos = async () => {
      setLoading(true);
      const result = await getPhotosByEventId(id, { limit: PHOTOS_PER_PAGE, offset: 0 });
      if (result.success && result.photos) {
        setPhotos(result.photos);
        setHasMore(result.photos.length === PHOTOS_PER_PAGE);
      }
      setLoading(false);
    };

    fetchEventData();
    fetchInitialPhotos();

    // Subscribe to photo updates for Realtime status changes (processing -> ready)
    const channel = supabase
      .channel('photos_status')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'photos',
        filter: `event_id=eq.${id}`
      }, (payload) => {
        setPhotos(currentPhotos => 
          currentPhotos.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
        );
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'photos',
        filter: `event_id=eq.${id}`
      }, (payload) => {
        setPhotos(currentPhotos => [payload.new as PhotoMetadata, ...currentPhotos]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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

  // formatting
  const formattedDate = eventData?.event_date 
    ? new Date(eventData.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Ongoing';

  const displayedPhotos = showOnlyMatches ? matchedPhotos : photos;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20 px-8">
      <div className="max-w-full mx-auto relative pb-24">
        {/* Gallery Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Link to={`/event/${id}`} className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all">
              <ChevronLeft size={24} />
            </Link>
            <div>
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
        <div className="flex gap-4 mb-12 overflow-x-auto pb-4 scrollbar-hide">
          <FilterChip label="All Photos" active={!showOnlyMatches} onClick={() => setShowOnlyMatches(false)} />
          {matchedPhotos.length > 0 && (
            <FilterChip label="My AI Matches" active={showOnlyMatches} onClick={() => setShowOnlyMatches(true)} />
          )}
          <FilterChip label="Ceremony" />
          <FilterChip label="Reception" />
          <FilterChip label="Guest Candid" />
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
                  <img src={photoUrl} alt={photo.file_name} className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  
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



                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-6 flex flex-col justify-between">
                    <div className="flex justify-end gap-2">
                      {!isSelectionMode && (
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

        {/* Selection Floating Bar */}
        <AnimatePresence>
          {isSelectionMode && selectedPhotoIds.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50"
            >
              <span className="font-bold">{selectedPhotoIds.size} Selected</span>
              <button 
                onClick={handleBulkDownload}
                disabled={isDownloadingZip}
                className="bg-primary px-6 py-2 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDownloadingZip ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Download size={18} />
                )}
                {isDownloadingZip ? 'Zipping...' : 'Download ZIP'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
                <button 
                  onClick={(e) => handleSingleDownload(displayedPhotos[selectedPhotoIndex], e)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Download size={24} />
                </button>
                <button 
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
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
               
              <motion.img 
                key={selectedPhotoIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipe = offset.x;
                  if (swipe < -50) handleNextPhoto();
                  else if (swipe > 50) handlePrevPhoto();
                }}
                src={getPhotoPublicUrl(displayedPhotos[selectedPhotoIndex].file_path)} 
                alt="Selected" 
                className="max-h-[85vh] max-w-full object-contain cursor-grab active:cursor-grabbing" 
              />
              
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
                      <p className="text-white/60">We've securely identified photos of you in the gallery.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       {matchedPhotos.slice(0, 3).map((photo, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden">
                          <img src={getPhotoPublicUrl(photo.file_path)} alt="Found" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        setIsAIFinderOpen(false);
                        setShowOnlyMatches(true);
                      }}
                      className="w-full signature-gradient py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                      View My Photos
                    </button>
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
