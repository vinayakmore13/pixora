import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Smartphone, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getDeviceFingerprint } from '../lib/securityEngine';

export function SecureVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [step, setStep] = useState<'info' | 'otp' | 'success'>('info');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing access token.');
    }
  }, [token]);

  const handleSendOTP = async () => {
    setLoading(true);
    setError(null);
    
    // Simulate OTP sending
    // In production, you would call a Supabase Edge Function to send SMS via Twilio
    setTimeout(() => {
      setStep('otp');
      setLoading(false);
    }, 1500);
  };

  const handleVerify = async () => {
    setLoading(true);
    const enteredOtp = otp.join('');
    
    // For demo/testing purposes, OTP is 123456
    if (enteredOtp === '123456') {
      try {
        const fingerprint = await getDeviceFingerprint();
        
        // Create secure session in DB (Simulation if table doesn't exist yet)
        const sessionId = crypto.randomUUID();
        
        setStep('success');
        setTimeout(() => {
          // Redirect to the actual gallery with the session
          // We assume the token identifies the event_id
          navigate(`/gallery/${token}?session=${sessionId}&fp=${fingerprint}`);
        }, 2000);
      } catch (err) {
        setError('Verification failed. Please try again.');
      }
    } else {
      setError('Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
    }
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  if (error) {
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
          <h1 className="text-3xl font-bold tracking-tight">Secure Access</h1>
          <p className="text-white/40 text-sm uppercase tracking-widest font-sans">Verification Required</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
          {step === 'info' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="tel" 
                    placeholder="+91 98765 43210"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary/50 transition-all outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">
                By continuing, you agree to our security policy. This gallery is protected by Pixvora Industrial Security.
              </p>
              <button 
                onClick={handleSendOTP}
                disabled={loading || !phone}
                className="w-full py-4 bg-primary rounded-2xl text-black font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending Code...' : 'Get Access Code'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-white/60">We've sent a 6-digit code to</p>
                <p className="font-mono text-primary font-bold">{phone}</p>
              </div>
              <div className="flex justify-between gap-2">
                {otp.map((digit, i) => (
                  <input 
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    maxLength={1}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold focus:border-primary transition-all outline-none"
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                  />
                ))}
              </div>
              <button 
                onClick={handleVerify}
                disabled={loading || otp.some(d => !d)}
                className="w-full py-4 bg-primary rounded-2xl text-black font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Enter'}
              </button>
              <button onClick={() => setStep('info')} className="w-full text-xs text-white/30 uppercase tracking-widest hover:text-white transition-colors">Resend Code</button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Access Granted</h2>
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

