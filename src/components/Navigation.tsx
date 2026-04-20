import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Instagram,
  LogOut,
  Settings,
  Share2,
  MessageCircle,
} from "lucide-react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const isDashboard =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/event");

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  if (isDashboard) {
    return (
      <nav className="fixed top-0 w-full z-50 glass-nav shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-full">
          <div className="flex items-center gap-4">
            {location.pathname !== '/dashboard' && (
              <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-primary transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <Link
              to="/"
              className="text-2xl font-serif font-bold text-primary tracking-tighter"
            >
              Pixora
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/messages"
              className="text-on-surface-variant hover:text-primary transition-colors relative group"
            >
              <MessageCircle size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full hidden"></span>
            </Link>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Bell size={20} />
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <Settings size={20} />
            </button>
            <div className="relative group">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed cursor-pointer">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-white font-bold">
                    {profile?.full_name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"}
                  </div>
                )}
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-outline-variant/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-3 border-b border-outline-variant/10">
                  <p className="font-semibold text-on-surface">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {user?.email}
                  </p>
                  <p className="text-xs text-primary font-medium mt-1 capitalize">
                    {profile?.user_type}
                  </p>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low rounded-md transition-colors disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 w-full z-50 glass-nav">
      <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          {location.pathname !== '/' && (
            <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-on-surface">
              Pixora
            </span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="font-medium text-sm tracking-wide text-primary border-b-2 border-primary pb-1"
          >
            For Hosts
          </Link>
          <Link
            to="/marketplace"
            className="font-medium text-sm tracking-wide text-on-surface/70 hover:text-primary transition-colors"
          >
            For Photographers
          </Link>
          <Link
            to="/features"
            className="font-medium text-sm tracking-wide text-on-surface/70 hover:text-primary transition-colors"
          >
            Features
          </Link>
          <Link
            to="/pricing"
            className="font-medium text-sm tracking-wide text-on-surface/70 hover:text-primary transition-colors"
          >
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {profile?.is_admin ? (
                <Link
                  to="/partner/dashboard"
                  className="font-medium text-sm tracking-wide text-primary hover:text-primary/80 transition-colors px-4 py-2 border border-primary/20 rounded-full"
                >
                  Admin Portal
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="font-medium text-sm tracking-wide text-on-surface/70 hover:text-primary transition-colors px-4 py-2"
                >
                  Dashboard
                </Link>
              )}
              <div className="relative group ml-2">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/10 cursor-pointer shadow-sm">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-primary to-rose-400 text-white font-bold">
                      {profile?.full_name?.charAt(0)?.toUpperCase() ||
                        user?.email?.charAt(0)?.toUpperCase() ||
                        "U"}
                    </div>
                  )}
                </div>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-outline-variant/10 opacity-0 min-h-0 min-w-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-3 border-b border-outline-variant/10">
                    <p className="font-semibold text-on-surface truncate">
                      {profile?.full_name || "User"}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {user?.email}
                    </p>
                    <p className="text-xs text-primary font-medium mt-1 capitalize">
                      {profile?.user_type}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                      <LogOut size={16} />
                      {signingOut ? "Signing out..." : "Sign Out"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="font-medium text-sm tracking-wide text-on-surface/70 hover:text-primary transition-colors px-4 py-2"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="signature-gradient text-white px-6 py-2.5 rounded-full font-medium text-sm tracking-wide active:scale-95 duration-200 shadow-sm"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="w-full rounded-t-[24px] bg-surface-container-low">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-12 px-12 py-20 max-w-7xl mx-auto text-sm leading-relaxed">
        <div className="col-span-2 md:col-span-1 space-y-6">
          <div className="text-lg font-bold text-on-surface">Pixora</div>
          <p className="text-on-surface/60">
            Elevating event memories through editorial design and intelligent
            technology.
          </p>
          <div className="flex gap-4">
            <Instagram className="text-primary cursor-pointer" size={20} />
            <Camera className="text-primary cursor-pointer" size={20} />
            <Share2 className="text-primary cursor-pointer" size={20} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="font-bold text-on-surface">Product</div>
          <ul className="space-y-2 text-on-surface/60">
            <li>
              <Link to="/" className="hover:text-primary transition-all">
                For Hosts
              </Link>
            </li>
            <li>
              <Link
                to="/marketplace"
                className="hover:text-primary transition-all"
              >
                For Photographers
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-primary transition-all">
                Pricing
              </Link>
            </li>
            <li>
              <Link
                to="/features"
                className="hover:text-primary transition-all"
              >
                Features
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="font-bold text-on-surface">Company</div>
          <ul className="space-y-2 text-on-surface/60">
            <li>
              <Link
                to="/features"
                className="hover:text-primary transition-all"
              >
                About Us
              </Link>
            </li>
            <li>
              <Link
                to="/marketplace"
                className="hover:text-primary transition-all"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                to="/features"
                className="hover:text-primary transition-all"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                to="/features"
                className="hover:text-primary transition-all"
              >
                Sustainability
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <div className="font-bold text-on-surface">Resources</div>
          <ul className="space-y-2 text-on-surface/60">
            <li>
              <Link
                to="/support"
                className="hover:text-primary transition-all"
              >
                Help Center
              </Link>
            </li>
            <li>
              <Link
                to="/features"
                className="hover:text-primary transition-all"
              >
                Safety
              </Link>
            </li>
            <li>
              <Link
                to="/create-event"
                className="hover:text-primary transition-all"
              >
                QR Generator
              </Link>
            </li>
            <li>
              <Link
                to="/marketplace"
                className="hover:text-primary transition-all"
              >
                Marketplace
              </Link>
            </li>
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="font-bold text-on-surface">Newsletter</div>
          <p className="text-on-surface/60">
            Get inspiration and event tips directly in your inbox.
          </p>
          <div className="relative">
            <input
              type="email"
              placeholder="Your email"
              className="w-full bg-surface-container border-none rounded-xl py-3 px-4 text-xs focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => {}}
              className="absolute right-2 top-1.5 bg-primary text-white p-1.5 rounded-lg"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-12 pb-12 flex flex-col md:flex-row justify-between items-center border-t border-on-surface/5 pt-8 gap-4">
        <div className="text-on-surface/60 text-xs">
          © 2024 Pixora. The Digital Curator.
        </div>
        <div className="flex gap-8 text-xs font-semibold">
          <Link
            to="/features"
            className="text-on-surface/60 hover:text-primary"
          >
            Legal
          </Link>
          <Link
            to="/features"
            className="text-on-surface/60 hover:text-primary"
          >
            Privacy Policy
          </Link>
          <Link
            to="/features"
            className="text-on-surface/60 hover:text-primary"
          >
            Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
