import { Eye, EyeOff } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export function PasswordReset() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const navigate = useNavigate();

  // Check if user has a valid session (from the email reset link)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        
        if (sessionErr || !session) {
          console.error('[Auth] No valid session for password reset');
          setSessionError(true);
        }
      } catch (err) {
        console.error('[Auth] Error checking session:', err);
        setSessionError(true);
      }
    };

    checkSession();
  }, []);

  const validatePassword = (pwd: string): { valid: boolean; message: string } => {
    if (pwd.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true, message: '' };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate passwords
    if (!password || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('[Auth] Password update error:', updateError.message);
        setError(updateError.message);
      } else {
        console.log('[Auth] Password updated successfully');
        setSuccess(true);
        
        // Redirect to sign in after 2 seconds
        setTimeout(() => {
          navigate('/signin', { 
            state: { message: 'Password has been reset successfully. Please sign in with your new password.' }
          });
        }, 2000);
      }
    } catch (err) {
      console.error('[Auth] Unexpected error updating password:', err);
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
        <main className="w-full max-w-[400px] flex flex-col items-center">
          <div className="mb-10 text-center">
            <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixora</Link>
            <h1 className="mt-8 text-2xl font-bold text-on-surface">Reset link expired</h1>
          </div>

          <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
            <div className="space-y-6 text-center">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-600 text-sm">
                  Your password reset link has expired or is invalid.
                </p>
              </div>

              <p className="text-on-surface-variant text-sm">
                Reset links expire after 24 hours. Please request a new one.
              </p>

              <div className="pt-6 space-y-3">
                <Link
                  to="/forgot-password"
                  className="block w-full bg-primary-container text-on-primary-container font-semibold py-3 px-6 rounded-lg text-center hover:scale-[0.99] transition-all"
                >
                  Request New Reset Link
                </Link>
                <Link
                  to="/signin"
                  className="block w-full bg-surface-container-low text-on-surface font-semibold py-3 px-6 rounded-lg text-center hover:bg-surface-container-high transition-all"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>

          <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
              © 2024 Pixora. The Digital Concierge.
            </p>
          </footer>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
        <main className="w-full max-w-[400px] flex flex-col items-center">
          <div className="mb-10 text-center">
            <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixora</Link>
            <h1 className="mt-8 text-2xl font-bold text-on-surface">Password reset successful!</h1>
          </div>

          <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
            <div className="space-y-6 text-center">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600 text-sm">
                  Your password has been updated successfully.
                </p>
              </div>

              <p className="text-on-surface-variant text-sm">
                Redirecting you to sign in...
              </p>

              <div className="animate-spin inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          </div>

          <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
              © 2024 Pixora. The Digital Concierge.
            </p>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="mb-10 text-center">
          <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixora</Link>
          <h1 className="mt-8 text-2xl font-bold text-on-surface">Create new password</h1>
          <p className="mt-2 text-on-surface-variant text-sm">Enter a strong password to secure your account.</p>
        </div>

        {error && (
          <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/20 focus:bg-white transition-all outline-none placeholder:text-on-surface/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-[0.7rem] text-on-surface-variant/70">
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/20 focus:bg-white transition-all outline-none placeholder:text-on-surface/30"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-primary-container text-on-primary-container font-semibold py-3.5 px-6 rounded-lg overflow-hidden transition-all hover:scale-[0.99] active:scale-[0.97] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative">{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>

        <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
            © 2024 Pixora. The Digital Concierge.
          </p>
        </footer>
      </main>
    </div>
  );
}
