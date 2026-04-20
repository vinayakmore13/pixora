import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PartnerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use ref to track if form was submitted (to avoid premature error display)
  const loginAttemptedRef = useRef(false);
  // Store initial mount state
  const initialMountRef = useRef(true);

  // Handle redirect after successful admin login
  useEffect(() => {
    // Skip on initial mount to avoid redirecting already-logged-out admins
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }

    // Wait for auth to finish loading
    if (authLoading) return;

    // If already logged in as admin, redirect to dashboard
    if (profile?.is_admin) {
      const from = (location.state as any)?.from?.pathname || '/partner/dashboard';
      navigate(from, { replace: true });
      return;
    }

    // If logged in but NOT admin, show error
    if (loginAttemptedRef.current && user && profile && !profile.is_admin) {
      setError('You do not have administrative access. This portal is for authorized partners only.');
      setLoading(false);
      loginAttemptedRef.current = false;
    }
  }, [authLoading, profile, user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    loginAttemptedRef.current = true;

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message || 'Failed to sign in. Check your credentials and try again.');
      setLoading(false);
      loginAttemptedRef.current = false;
    }
    // On success, the useEffect will handle the redirect when profile loads
  };

  // If already logged in as admin, show loading while redirect happens
  if (!loading && !error && profile?.is_admin) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <span className="text-2xl font-bold tracking-tighter text-on-surface">Pixora</span>
          </Link>
          <h2 className="text-3xl font-serif font-bold text-on-surface">Partner Portal</h2>
          <p className="mt-2 text-on-surface-variant">Sign in to manage the platform</p>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-outline-variant/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-error/5 border border-error/10 rounded-2xl flex items-start gap-3 text-error text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low rounded-2xl outline-none focus:ring-1 focus:ring-primary transition-all text-on-surface disabled:opacity-60"
                  placeholder="admin@pixora.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low rounded-2xl outline-none focus:ring-1 focus:ring-primary transition-all text-on-surface disabled:opacity-60"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full signature-gradient text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 group active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Verifying access...</span>
                </>
              ) : (
                <>
                  Enter Portal
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-on-surface-variant max-w-xs mx-auto">
          This is a restricted area for authorized partners and administrators only. All actions are logged.
        </p>
      </div>
    </div>
  );
}
