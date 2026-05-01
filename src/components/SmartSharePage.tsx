import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Download, 
  Loader2, 
  Lock, 
  Mail, 
  Phone, 
  RefreshCw, 
  Sparkles, 
  XCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

// Backend URL from env or fallback
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

interface MatchedPhoto {
  id: string;
  url: string;
  thumbnail_url?: string;
  similarity: number;
}

interface EventInfo {
  id: string;
  name: string;
  mode: 'password' | 'otp';
}

type Step = 'loading' | 'auth' | 'selfie' | 'matching' | 'results' | 'error';

export function SmartSharePage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [contact, setContact] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchedPhoto[]>([]);
  
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      setStep('loading');
      // In a real app, we'd have a public endpoint to check token validity
      // and return basic event info. For now, we'll try to fetch from share_links
      const { data, error: fetchError } = await supabase
        .from('share_links')
        .select('*, events(name)')
        .eq('token', token)
        .single();

      if (fetchError || !data) {
        setStep('error');
        setError('Link not found or expired');
        return;
      }

      setEvent({
        id: data.event_id,
        name: data.events.name,
        mode: data.mode
      });
      setStep('auth');
    } catch (err) {
      setStep('error');
      setError('An unexpected error occurred');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await fetch(`${BACKEND_URL}/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: event?.mode === 'password' ? password : null,
          email: event?.mode === 'otp' ? contact : null,
          otp_code: event?.mode === 'otp' ? otpCode : null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSessionToken(data.session_token);
        setStep('selfie');
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection to server failed');
    }
  };

  const captureAndMatch = async () => {
    if (!webcamRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setStep('matching');
    setError(null);

    try {
      // Convert base64 to blob
      const blob = await fetch(imageSrc).then(res => res.blob());
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');

      const response = await fetch(`${BACKEND_URL}/share/${token}/match`, {
        method: 'POST',
        headers: {
          'session-token': sessionToken || ''
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setMatches(data);
        setStep('results');
      } else {
        setError(data.detail || 'Matching failed');
        setStep('selfie');
      }
    } catch (err) {
      setError('Failed to process image');
      setStep('selfie');
    }
  };

  const handleDownloadAll = async () => {
    if (!matches.length || !sessionToken) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/share/${token}/download-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'session-token': sessionToken
        },
        body: JSON.stringify(matches.map(m => m.id))
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wedhub_photos.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to generate ZIP. Please try again later.');
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed. Please check your connection.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        <AnimatePresence mode="wait">
          
          {/* STEP: LOADING */}
          {step === 'loading' && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-on-surface-variant font-medium">Preparing your personal gallery...</p>
            </motion.div>
          )}

          {/* STEP: ERROR */}
          {step === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] silk-shadow text-center border border-outline-variant/10"
            >
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-serif font-bold text-on-surface mb-2">Access Denied</h2>
              <p className="text-on-surface-variant mb-6">{error || 'This link has expired or reached its limit.'}</p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-surface-container-low text-on-surface py-4 rounded-2xl font-bold border border-outline-variant/10 hover:bg-surface-container transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {/* STEP: AUTH */}
          {step === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: -20 }}
              className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5"
            >
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-3xl bg-secondary/10 text-secondary">
                  <Lock size={32} />
                </div>
              </div>
              <h1 className="text-2xl font-serif font-bold text-on-surface text-center mb-1">{event?.name}</h1>
              <p className="text-on-surface-variant text-center text-sm mb-8">Secure Access Portal</p>

              <form onSubmit={handleAuth} className="space-y-4">
                {event?.mode === 'password' ? (
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Event Guest Password"
                      className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                      <input
                        type="email"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Email Address"
                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="OTP Code"
                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </>
                )}
                
                {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                <button 
                  type="submit"
                  className="w-full signature-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  Verify Access
                  <ArrowRight size={20} />
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP: SELFIE */}
          {step === 'selfie' && (
            <motion.div 
              key="selfie"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white p-6 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center"
            >
              <h2 className="text-xl font-bold text-on-surface mb-2">Find Your Photos</h2>
              <p className="text-on-surface-variant text-sm mb-6">Take a quick selfie to see your matched moments.</p>
              
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-black mb-6">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="w-full h-full object-cover grayscale-[20%]"
                />
                <div className="absolute inset-0 border-2 border-primary/30 rounded-3xl pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/50 rounded-[4rem] pointer-events-none"></div>
              </div>

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <button 
                onClick={captureAndMatch}
                className="w-full signature-gradient text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/30 hover:brightness-105 active:scale-95 transition-all"
              >
                <Camera size={24} />
                Scan My Face
              </button>
              
              <p className="mt-4 text-[10px] text-on-surface-variant uppercase tracking-widest">Powered by Pixvora AI</p>
            </motion.div>
          )}

          {/* STEP: MATCHING */}
          {step === 'matching' && (
            <motion.div 
              key="matching"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="relative inline-block mb-8">
                <motion.div 
                   animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                   transition={{ repeat: Infinity, duration: 2 }}
                   className="absolute inset-0 bg-primary rounded-full blur-2xl"
                />
                <div className="relative p-6 rounded-full bg-white silk-shadow">
                  <Sparkles className="w-12 h-12 text-primary animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-serif font-bold text-on-surface mb-2">✨ Finding your photos...</h2>
              <p className="text-on-surface-variant animate-pulse">Our AI is scanning {event?.name} memories</p>
            </motion.div>
          )}

          {/* STEP: RESULTS */}
          {step === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-serif font-bold text-on-surface">Matched Photos</h1>
                  <p className="text-on-surface-variant text-sm">Found {matches.length} gems for you</p>
                </div>
                <button 
                  onClick={() => setStep('selfie')}
                  className="p-3 rounded-2xl bg-white silk-shadow text-on-surface-variant hover:text-primary transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              {matches.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {matches.map((photo, index) => (
                      <motion.div 
                        key={photo.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-surface-container-low silk-shadow"
                      >
                        <img 
                          src={photo.url} 
                          alt="Matched" 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <button 
                            onClick={() => window.open(photo.url, '_blank')}
                            className="bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold w-full"
                          >
                            View Full
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button 
                    onClick={handleDownloadAll}
                    className="w-full signature-gradient text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-xl shadow-primary/30 active:scale-95 transition-all"
                  >
                    <Download size={24} />
                    Download All My Photos
                  </button>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-[2.5rem] silk-shadow text-center border border-outline-variant/10">
                  <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                    <Camera size={32} className="text-on-surface-variant/30" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-2">No Matches Yet</h3>
                  <p className="text-on-surface-variant text-sm mb-6">
                    Try another angle or lighting. Sometimes glasses or masks can affect the scan.
                  </p>
                  <button 
                    onClick={() => setStep('selfie')}
                    className="w-full signature-gradient text-white py-4 rounded-2xl font-bold active:scale-95 transition-all"
                  >
                    Try Another Selfie
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

