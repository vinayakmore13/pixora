import { Eye, EyeOff, Wand2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to track state properly
  const mountedRef = useRef(true);
  const loginAttemptedRef = useRef(false);
  const initialMountRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Get the message from location state (e.g., after signup)
  const message = location.state?.message;

  // Handle automatic redirection — only after auth context is fully settled
  useEffect(() => {
    // Skip on initial mount to avoid redirecting already-logged-out users
    if (initialMountRef.current) {
      initialMountRef.current = false;
      console.log('[SignIn] Initial mount, skipping redirect check');
      return;
    }

    console.log('[SignIn] Checking redirect conditions:', {
      authLoading,
      userExists: !!user,
      profileExists: !!profile,
      loginAttempted: loginAttemptedRef.current
    });

    // If still loading, wait
    if (authLoading) {
      console.log('[SignIn] Auth still loading, waiting...');
      if (loginAttemptedRef.current && user) {
        const timer = setTimeout(() => {
          if (mountedRef.current && authLoading && user) {
            console.error('[SignIn] Profile fetch timeout after 8 seconds');
            setError('Your profile is taking longer than usual to load. Please try refreshing the page.');
            setLoading(false);
          }
        }, 8000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Auth is done loading, check if user has profile
    if (user && profile) {
      console.log('[SignIn] User authenticated with profile, redirecting...', {
        isAdmin: profile.is_admin,
        userType: profile.user_type
      });
      // If user is admin, redirect to admin dashboard
      // If user is regular user, redirect to from path or dashboard
      const from = profile.is_admin
        ? '/partner/dashboard'
        : (location.state?.from?.pathname || '/dashboard');
      console.log('[SignIn] Redirecting to:', from);
      navigate(from, { replace: true });
    } else if (user && !profile) {
      // User exists but profile missing — this is an error state
      console.error('[SignIn] User authenticated but profile is null after loading complete');
      if (loginAttemptedRef.current) {
        setError('Authenticated successfully, but your user profile could not be found. Please contact support.');
        setLoading(false);
        loginAttemptedRef.current = false;
      }
    } else {
      // No user logged in (normal state on sign-in page)
      console.log('[SignIn] No user authenticated');
    }
  }, [authLoading, profile, user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | any) => {
    e.preventDefault?.();
    setError(null);
    setLoading(true);
    loginAttemptedRef.current = true;

    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        setError(error.message);
        setLoading(false);
        loginAttemptedRef.current = false;
      }
      // On success: keep loading=true as a spinner, redirect effect fires
      // once authLoading=false and profile is set.
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
      loginAttemptedRef.current = false;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="mb-10 text-center">
          <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixvora</Link>
          <h1 className="mt-8 text-2xl font-bold text-on-surface">Welcome back</h1>
          <p className="mt-2 text-on-surface-variant text-sm">Continue your journey to the perfect day.</p>
        </div>

        {message && (
          <div className="w-full mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <p className="text-red-600 text-sm flex-1">{error}</p>
              {(error.includes('timed out') || error.includes('connection')) && (
                <button
                  onClick={() => {
                    setError(null);
                    handleSubmit({ preventDefault: () => {} } as any);
                  }}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 whitespace-nowrap px-3 py-1 hover:bg-red-100 rounded transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="e.g. clara@example.com"
                required
                className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/20 focus:bg-white transition-all outline-none placeholder:text-on-surface/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Forgot Password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-primary-container text-on-primary-container font-semibold py-3.5 px-6 rounded-lg overflow-hidden transition-all hover:scale-[0.99] active:scale-[0.97] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative">{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/20"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[0.7rem] uppercase tracking-widest text-on-surface-variant/60 font-medium">or</span>
            </div>
          </div>

          <div className="space-y-4">
            <button type="button" onClick={() => {}} className="w-full flex items-center justify-center gap-3 bg-surface-container-low border border-outline-variant/10 text-on-surface font-medium py-3 rounded-lg hover:bg-surface-container-high transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 1.2-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
            <div className="text-center">
              <button type="button" onClick={() => {}} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5">
                <Wand2 size={18} />
                Sign in with Magic Link
              </button>
            </div>
          </div>
        </div>

        <p className="mt-8 text-on-surface-variant text-sm">
          Do not have an account?
          <Link to="/signup" className="font-bold text-primary hover:text-primary/80 transition-colors ml-1">Sign Up</Link>
        </p>

        <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
            © 2024 Pixvora. The Digital Concierge.
          </p>
          <div className="mt-2 flex justify-center gap-6">
            <Link to="/features" className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-on-surface-variant hover:text-primary transition-opacity">Privacy Policy</Link>
            <Link to="/features" className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-on-surface-variant hover:text-primary transition-opacity">Terms of Service</Link>
            <Link to="/features" className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-on-surface-variant hover:text-primary transition-opacity">Help Center</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

