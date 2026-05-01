import { ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset`,
      });

      if (resetError) {
        console.error('[Auth] Password reset error:', resetError.message);
        setError(resetError.message);
      } else {
        console.log('[Auth] Password reset email sent successfully');
        setSuccess(true);
      }
    } catch (err) {
      console.error('[Auth] Unexpected error sending password reset:', err);
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
        <main className="w-full max-w-[400px] flex flex-col items-center">
          <div className="mb-10 text-center">
            <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixvora</Link>
            <h1 className="mt-8 text-2xl font-bold text-on-surface">Check your email</h1>
          </div>

          <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
            <div className="space-y-6 text-center">
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600 text-sm">
                  If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                </p>
              </div>

              <div className="space-y-3 text-sm text-on-surface-variant">
                <p>✓ Check your inbox and spam folder</p>
                <p>✓ Click the reset link in the email</p>
                <p>✓ Follow the prompts to set a new password</p>
              </div>

              <div className="pt-6 border-t border-outline-variant/20">
                <Link
                  to="/signin"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <ArrowLeft size={18} />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-8 text-on-surface-variant text-sm text-center max-w-md">
            Didn't receive the email?{' '}
            <button
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              Try again
            </button>
          </p>

          <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
              © 2024 Pixvora. The Digital Concierge.
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
          <Link to="/" className="text-3xl font-serif font-bold text-primary tracking-tight">Pixvora</Link>
          <h1 className="mt-8 text-2xl font-bold text-on-surface">Reset your password</h1>
          <p className="mt-2 text-on-surface-variant text-sm">Enter your email and we'll send you a reset link.</p>
        </div>

        {error && (
          <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="w-full bg-white p-8 rounded-xl shadow-[0_8px_40px_rgba(27,28,26,0.06)] border border-outline-variant/15">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-[0.75rem] font-semibold text-on-surface-variant uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. clara@example.com"
                required
                className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/20 focus:bg-white transition-all outline-none placeholder:text-on-surface/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-primary-container text-on-primary-container font-semibold py-3.5 px-6 rounded-lg overflow-hidden transition-all hover:scale-[0.99] active:scale-[0.97] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative">{loading ? 'Sending...' : 'Send Reset Link'}</span>
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/signin"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <ArrowLeft size={18} />
            Back to Sign In
          </Link>
        </div>

        <footer className="fixed bottom-0 w-full py-8 px-6 text-center border-t border-outline-variant/10 bg-surface/50 backdrop-blur-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] font-bold text-on-surface-variant/60">
            © 2024 Pixvora. The Digital Concierge.
          </p>
        </footer>
      </main>
    </div>
  );
}

