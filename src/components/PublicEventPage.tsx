import { 
  Camera, 
  Check, 
  Clock, 
  Image as ImageIcon, 
  Loader2, 
  Lock, 
  MapPin, 
  QrCode, 
  Upload, 
  X, 
  ChevronRight, 
  Sparkles,
  Phone,
  Mail,
  User
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { SelfieCapture } from './SelfieCapture';

interface Event {
    id: string;
    name: string;
    description: string | null;
    event_date: string | null;
    location: string | null;
    cover_image_url: string | null;
    guest_qr_code: string;
    upload_password_hash: string;
    status: 'upcoming' | 'live' | 'completed';
}

type ViewMode = 'landing' | 'upload' | 'find_photos' | 'register' | 'selfie' | 'gallery';

export function PublicEventPage() {
    const { qrCode } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('register');
    
    // Upload state
    const [password, setPassword] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Registration state
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [capturedSelfie, setCapturedSelfie] = useState<HTMLImageElement | null>(null);

    const [registrationId, setRegistrationId] = useState<string | null>(null);
    const [matches, setMatches] = useState<any[]>([]);

    useEffect(() => {
        if (qrCode) {
            fetchEvent();
        }
        // Check for existing registration
        const savedReg = localStorage.getItem(`pixora_reg_${qrCode}`);
        if (savedReg) {
            const data = JSON.parse(savedReg);
            setRegistrationId(data.id);
            setGuestName(data.name);
            setViewMode('gallery');
        }
    }, [qrCode]);

    useEffect(() => {
        if (viewMode === 'gallery' && registrationId && event) {
            fetchMatches();
            const channel = supabase
                .channel(`guest_matches_${registrationId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'guest_matches',
                    filter: `guest_id=eq.${registrationId}`
                }, (payload) => {
                    console.log('New match found!', payload);
                    fetchMatches(); // Refresh matches list
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [viewMode, registrationId, event]);

    async function fetchMatches() {
        if (!registrationId) return;
        try {
            const { data, error: fetchError } = await supabase
                .from('guest_matches')
                .select('*, photos(id, file_path, thumbnail_url)')
                .eq('guest_id', registrationId);
            
            if (fetchError) throw fetchError;
            
            const formattedMatches = (data || []).map(match => {
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(match.photos.file_path);
                return {
                    ...match,
                    photos: {
                        ...match.photos,
                        url: urlData.publicUrl
                    }
                };
            });
            
            setMatches(formattedMatches);
        } catch (err) {
            console.error('Error fetching matches:', err);
        }
    }

    async function fetchEvent() {
        try {
            setLoading(true);
            setError(null);

            if (!qrCode) {
                setError('No event code provided');
                return;
            }

            const cleanCode = qrCode.trim();
            console.log(`[PublicEventPage] Attempting to fetch event with code: "${cleanCode}"`);

            // Try 1: Match against guest_qr_code (case-insensitive)
            let { data, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .ilike('guest_qr_code', cleanCode)
                .limit(1);

            // Try 2: Fallback to matching against ID if no guest_qr_code match and it looks like a UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if ((!data || data.length === 0) && uuidRegex.test(cleanCode)) {
                console.log('[PublicEventPage] No short code match, trying fallback UUID match');
                const { data: idData, error: idError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', cleanCode)
                    .limit(1);
                
                if (!idError && idData && idData.length > 0) {
                    data = idData;
                }
            }

            if (fetchError) throw fetchError;

            if (!data || data.length === 0) {
                console.warn(`[PublicEventPage] Event not found for code: "${cleanCode}"`);
                setError('Event not found. Please check the QR code or link.');
                return;
            }

            console.log('[PublicEventPage] Event found:', data[0].name);
            setEvent(data[0]);
        } catch (err) {
            console.error('[PublicEventPage] Error fetching event:', err);
            setError(err instanceof Error ? err.message : 'Failed to load event');
        } finally {
            setLoading(false);
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event) return;

        setVerifying(true);
        try {
            const normalizedInput = password.trim().toUpperCase();
            const normalizedStored = (event.upload_password_hash || '').trim().toUpperCase();
            
            if (normalizedInput && normalizedInput === normalizedStored) {
                setPasswordVerified(true);
                setError(null);
            } else {
                setError('Incorrect password. Please try again.');
            }
        } catch (err) {
            setError('Failed to verify password');
        } finally {
            setVerifying(false);
        }
    };

    const handleRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        setViewMode('selfie');
    };

    const handleSelfieComplete = async (img: HTMLImageElement, descriptor?: Float32Array) => {
        if (!event || !descriptor) return;

        setIsRegistering(true);
        try {
            const vectorString = `[${Array.from(descriptor).join(',')}]`;
            
            const { data, error: regError } = await supabase
                .from('guest_registrations')
                .insert({
                    event_id: event.id,
                    full_name: guestName,
                    email: guestEmail,
                    phone: guestPhone,
                    selfie_embedding: vectorString,
                    status: 'pending'
                })
                .select()
                .single();

            if (regError) throw regError;

            setRegistrationId(data.id);
            localStorage.setItem(`pixora_reg_${qrCode}`, JSON.stringify({
                id: data.id,
                name: guestName
            }));
            setViewMode('gallery');
        } catch (err) {
            console.error('Registration failed:', err);
            setError('Failed to register guest');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleUpload = async () => {
        if (!event || selectedFiles.length === 0) return;
        setUploading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            setUploadSuccess(true);
            setSelectedFiles([]);
            setTimeout(() => setUploadSuccess(false), 3000);
        } catch (err) {
            setError('Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-primary" />
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <X size={32} className="text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-on-surface mb-2">Event Not Found</h1>
                    <p className="text-on-surface-variant">{error}</p>
                </div>
            </div>
        );
    }

    if (!event) return null;

    return (
        <div className="min-h-screen bg-surface">
            {/* Hero Section */}
            <div className="relative h-48 md:h-64 overflow-hidden">
                {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <Camera size={48} className="text-primary/40" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="max-w-4xl mx-auto flex items-end justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-serif font-bold text-white mb-1">{event.name}</h1>
                            <div className="flex items-center gap-4 text-white/70 text-xs">
                                <span className="flex items-center gap-1"><Clock size={14} /> {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Today'}</span>
                                <span className="flex items-center gap-1"><MapPin size={14} /> {event.location || 'At the venue'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {viewMode === 'landing' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Action: Find My Photos */}
                        <button 
                            onClick={() => setViewMode('register')}
                            className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-left group hover:border-primary/30 transition-all active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Sparkles size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-on-surface mb-2">Find My Photos</h3>
                            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                                Use our AI to scan the entire gallery and find every photo you appear in instantly.
                            </p>
                            <div className="flex items-center gap-2 text-primary font-bold">
                                Get Started <ChevronRight size={18} />
                            </div>
                        </button>

                        {/* Action: Upload Photos */}
                        <button 
                            onClick={() => setViewMode('upload')}
                            className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-left group hover:border-secondary/30 transition-all active:scale-[0.98]"
                        >
                            <div className="w-16 h-16 rounded-3xl bg-secondary/10 text-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-on-surface mb-2">Upload Photos</h3>
                            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                                Share the moments you captured during the event with the hosts and other guests.
                            </p>
                            <div className="flex items-center gap-2 text-secondary font-bold">
                                Upload Now <ChevronRight size={18} />
                            </div>
                        </button>
                    </div>
                )}

                {viewMode === 'register' && (
                    <div className="max-w-md mx-auto">
                        <button onClick={() => setViewMode('landing')} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
                            <X size={20} /> Cancel
                        </button>
                        <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                            <h2 className="text-2xl font-bold text-on-surface mb-2">Guest Registration</h2>
                            <p className="text-on-surface-variant text-sm mb-8">Register to receive your photos instantly via email or WhatsApp.</p>
                            
                            <form onSubmit={handleRegistration} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input 
                                            required
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            placeholder="Enter your name"
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">Email (For Free Delivery)</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input 
                                            type="email"
                                            required
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                            placeholder="your@email.com"
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-on-surface-variant uppercase ml-1">WhatsApp (Optional)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input 
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                            placeholder="+91 00000 00000"
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                                <button 
                                    type="submit"
                                    className="w-full signature-gradient text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all mt-4"
                                >
                                    Continue to Selfie
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {viewMode === 'selfie' && (
                    <SelfieCapture 
                        onCaptureComplete={handleSelfieComplete} 
                        onClose={() => setViewMode('register')}
                        requireAuth={false}
                    />
                )}

                {viewMode === 'upload' && (
                    <div className="max-w-2xl mx-auto">
                        <button onClick={() => setViewMode('landing')} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
                            <X size={20} /> Cancel
                        </button>
                        <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
                                    <Upload size={24} />
                                </div>
                                <h2 className="text-2xl font-bold text-on-surface">Upload Photos</h2>
                            </div>

                            {!passwordVerified ? (
                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    <p className="text-on-surface-variant text-sm mb-4">
                                        Enter the upload password to share your photos with the event host.
                                    </p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                            <input
                                                type="text"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                                placeholder="PASSWORD"
                                                className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none font-mono tracking-widest"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={verifying || !password}
                                            className="bg-on-surface text-white px-8 py-4 rounded-2xl font-bold hover:brightness-125 transition-all disabled:opacity-50"
                                        >
                                            {verifying ? <Loader2 size={24} className="animate-spin" /> : 'Enter'}
                                        </button>
                                    </div>
                                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <div className="border-2 border-dashed border-outline-variant/30 rounded-3xl p-12 text-center hover:border-secondary transition-colors">
                                        <input type="file" multiple accept="image/*" onChange={(e) => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" id="file-upload" />
                                        <label htmlFor="file-upload" className="cursor-pointer">
                                            <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                                                <ImageIcon size={40} className="text-on-surface-variant" />
                                            </div>
                                            <p className="text-on-surface font-bold text-lg mb-1">Select Photos</p>
                                            <p className="text-on-surface-variant text-sm">Tap here to choose from your gallery</p>
                                        </label>
                                    </div>

                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                {selectedFiles.map((file, idx) => (
                                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-surface-container-low">
                                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"><X size={12}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={handleUpload} disabled={uploading} className="w-full signature-gradient text-white py-5 rounded-[2rem] font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                                {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photos`}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {viewMode === 'gallery' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-serif font-bold text-on-surface">For {guestName}</h1>
                                <p className="text-on-surface-variant">We found {matches.length} matches for you</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { localStorage.removeItem(`pixora_reg_${qrCode}`); window.location.reload(); }}
                                    className="p-3 rounded-2xl bg-white silk-shadow text-on-surface-variant hover:text-primary transition-colors"
                                    title="Not you? Register again"
                                >
                                    <User size={20} />
                                </button>
                                <button className="p-3 rounded-2xl bg-white silk-shadow text-on-surface-variant hover:text-primary transition-colors">
                                    <QrCode size={20} />
                                </button>
                            </div>
                        </div>

                        {matches.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {matches.map((match, idx) => (
                                    <div 
                                        key={match.id} 
                                        className="group relative aspect-[3/4] rounded-3xl overflow-hidden bg-surface-container-low silk-shadow animate-in zoom-in duration-500"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        <img 
                                            src={match.photos.url || match.photos.thumbnail_url} 
                                            alt="Matched moment" 
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <a 
                                                href={match.photos.url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="w-full bg-white/20 backdrop-blur-md text-white py-3 rounded-xl text-center text-sm font-bold border border-white/30"
                                            >
                                                Download Original
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white p-16 rounded-[4rem] silk-shadow border border-outline-variant/10 text-center">
                                <div className="relative inline-block mb-8">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                                    <div className="relative w-24 h-24 rounded-full bg-white silk-shadow flex items-center justify-center">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-on-surface mb-2">Analyzing Memories...</h3>
                                <p className="text-on-surface-variant text-sm max-w-sm mx-auto leading-relaxed">
                                    We are scanning the event photos for you. New photos will appear here automatically as they are found!
                                </p>
                                
                                <div className="mt-12 flex items-center justify-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">Real-time AI Matcher Active</span>
                                    <div className="flex gap-1">
                                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
                                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
                                        <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Event Info Card */}
                        <div className="bg-gradient-to-br from-on-surface to-on-surface-variant text-white p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h4 className="text-xl font-bold mb-1">Tell your friends!</h4>
                                <p className="text-white/70 text-sm">Everyone can find their photos with this QR code.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Event Code</div>
                                    <div className="text-2xl font-mono font-bold tracking-tight">{event.guest_qr_code}</div>
                                </div>
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                                    <QrCode size={32} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
