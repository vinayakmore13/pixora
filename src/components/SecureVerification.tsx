import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Smartphone, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getDeviceFingerprint } from '../lib/securityEngine';

export function SecureVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [step, setStep] = useState<'info' | 'success'>('info');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing access token.');
    }
  }, [token]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);
    
    try {
      // Fetch the event's password hash
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('upload_password_hash')
        .eq('id', token)
        .single();

      if (fetchError || !event) {
        throw new Error('Event not found or access denied.');
      }

      // In this simplified flow, upload_password_hash is used as the plain text access password
      if (password === event.upload_password_hash) {
        const fingerprint = await getDeviceFingerprint();
        const sessionId = crypto.randomUUID();
        
        setStep('success');
        setTimeout(() => {
          navigate(`/gallery/${token}?session=${sessionId}&fp=${fingerprint}`);
        }, 1500);
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (error && !token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-serif">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-white/60 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/10 rounded-full text-xs uppercase tracking-widest">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-serif">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/30">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Secure Gallery</h1>
          <p className="text-white/40 text-sm uppercase tracking-widest font-sans">Password Required</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
          {step === 'info' && (
            <form onSubmit={handleVerify} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Event Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="password" 
                    placeholder="Enter gallery password"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary/50 transition-all outline-none text-center tracking-[0.2em] font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] uppercase tracking-widest font-bold py-2 rounded-lg text-center">
                  {error}
                </div>
              )}

              <p className="text-[10px] text-white/30 leading-relaxed text-center">
                This gallery is protected. Please enter the password provided by your photographer to view the photos.
              </p>
              
              <button 
                type="submit"
                disabled={loading || !password}
                className="w-full py-4 bg-primary rounded-2xl text-black font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Unlock Gallery'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Unlocked</h2>
                <p className="text-white/40 text-sm">Initializing secure session...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Icons */}
        <div className="flex justify-center gap-8 pt-4">
          <div className="flex flex-col items-center gap-1 opacity-20">
            <Lock size={16} />
            <span className="text-[8px] uppercase tracking-tighter">SSL Encrypted</span>
          </div>
          <div className="flex flex-col items-center gap-1 opacity-20">
            <Shield size={16} />
            <span className="text-[8px] uppercase tracking-tighter">AI Guarded</span>
          </div>
          <div className="flex flex-col items-center gap-1 opacity-20">
            <Smartphone size={16} />
            <span className="text-[8px] uppercase tracking-tighter">Device Bound</span>
          </div>
        </div>
      </div>
    </div>
  );
}

