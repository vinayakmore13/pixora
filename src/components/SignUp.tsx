import { Camera, Eye, EyeOff } from 'lucide-react';
import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SignUp() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email') || '';
  const [formData, setFormData] = React.useState({
    fullName: '',
    email: prefillEmail,
    password: '',
    userType: 'couple' as 'couple' | 'photographer',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | any) => {
    e.preventDefault?.();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.userType
      );

      if (error) {
        setError(error.message);
      } else {
        // Show success message and redirect to signin
        navigate('/signin', { state: { message: 'Account created successfully! Please check your email to verify your account.' } });
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row">
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover opacity-80 mix-blend-multiply transition-transform duration-700 hover:scale-105"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLHpVDLhp1zp2Ig81KbmFuBZMbB6PlwVGhEAcCghapIYPpti-p56piZiP8T57ue4uc0Etu6P2Jwz2b5uQ7P12DZT4wtR6tDsjRo5GpsThBAgLwJr6tR3XZoiLfzCGtdZfcw2n9a81cscrGIBJrkmdLLu-GpmOGIAJv9K6X4VuCLDULJxHlhXL6W0FpoFJSrP6pGyBWZpwHsHQM0rh3STljJ19_7qNcWDmur0LmKSGulT2jG9AKBmTznskNr5ZOeJBz61rQ2GfLTMk"
            alt="Wedding Couple"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 lg:p-20 text-white w-full h-full bg-gradient-to-t from-black/40 via-transparent to-black/20">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-8">
              <span className="text-3xl font-serif font-bold tracking-tight">Pixora</span>
            </Link>
          </div>
          <div className="max-w-xl">
            <h1 className="text-5xl lg:text-6xl font-serif leading-tight mb-6">Start your journey to forever.</h1>
            <p className="text-lg lg:text-xl font-light opacity-90 leading-relaxed italic">
              "The Digital Concierge for your most meaningful moments. We connect visionaries with the creators who bring them to life."
            </p>
          </div>
          <div className="flex gap-8 text-xs font-semibold uppercase tracking-widest opacity-70">
            <span>Seamless Experience</span>
            <span>Expert Vendors</span>
            <span>Inspiring Stories</span>
          </div>
        </div>
      </section>

      <section className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-white">
        <div className="w-full max-w-[450px]">
          <div className="flex items-center gap-2 mb-10 md:hidden">
            <span className="text-2xl font-serif font-bold text-primary tracking-tight">Pixora</span>
          </div>
          <div className="mb-10">
            <h2 className="text-3xl font-serif font-bold text-on-surface mb-2">Create your account</h2>
            <p className="text-on-surface-variant">Join our community of event organizers and photographers.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="userType"
                  value="couple"
                  checked={formData.userType === 'couple'}
                  onChange={handleInputChange}
                  className="peer sr-only"
                />
                <div className="p-4 border border-outline-variant/30 rounded-lg bg-surface-container-low transition-all peer-checked:bg-white peer-checked:ring-2 peer-checked:ring-primary/20 peer-checked:border-primary flex flex-col items-center gap-2 text-center group-hover:bg-surface-container-high">
                  <span className="text-[10px] font-bold tracking-wide uppercase text-on-surface-variant">I'm a User</span>
                </div>
              </label>
              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="userType"
                  value="photographer"
                  checked={formData.userType === 'photographer'}
                  onChange={handleInputChange}
                  className="peer sr-only"
                />
                <div className="p-4 border border-outline-variant/30 rounded-lg bg-surface-container-low transition-all peer-checked:bg-white peer-checked:ring-2 peer-checked:ring-primary/20 peer-checked:border-primary flex flex-col items-center gap-2 text-center group-hover:bg-surface-container-high">
                  <Camera size={24} className="text-on-surface-variant peer-checked:text-primary transition-colors" />
                  <span className="text-[10px] font-bold tracking-wide uppercase text-on-surface-variant">I'm a Photographer</span>
                </div>
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="E.g. Julianne Moore"
                required
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-white text-on-surface placeholder:text-on-surface/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="hello@example.com"
                required
                className="w-full px-4 py-3 bg-surface-container-high border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-white text-on-surface placeholder:text-on-surface/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-surface-container-high border-none rounded-lg focus:ring-2 focus:ring-primary/20 focus:bg-white text-on-surface placeholder:text-on-surface/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="pt-2 px-1">
                <div className="flex gap-1 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="w-1/3 bg-green-500 rounded-full"></div>
                  <div className="w-1/3 bg-green-500 rounded-full"></div>
                  <div className="w-1/3 bg-surface-container-highest"></div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Strong Security</span>
                  <span className="text-[10px] text-on-surface-variant italic">Must be at least 8 chars</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-container text-on-primary-container font-bold rounded-lg shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[0.99] transition-all duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-outline-variant/20"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">or continue with</span>
              <div className="flex-grow border-t border-outline-variant/20"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SocialButton icon="google" label="Google" />
              <SocialButton icon="facebook" label="Facebook" />
            </div>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-on-surface-variant">
              Already have an account?
              <Link to="/signin" className="text-primary font-bold hover:underline underline-offset-4 ml-1">Sign In</Link>
            </p>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant/40 leading-relaxed max-w-xs mx-auto">
              By signing up, you agree to our
              <Link to="/features" className="hover:text-primary transition-colors mx-1">Terms</Link> &
              <Link to="/features" className="hover:text-primary transition-colors mx-1">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SocialButton({ icon, label }: { icon: string, label: string }) {
  return (
    <button type="button" onClick={() => {}} className="flex items-center justify-center gap-3 px-4 py-3 border border-outline-variant/30 rounded-lg bg-white text-on-surface font-medium text-sm hover:bg-surface-container-low transition-colors">
      {icon === 'google' ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )}
      {label}
    </button>
  );
}
