import { ArrowRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-8 pt-20">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon/Illustration */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
            <span className="text-5xl font-bold text-primary">404</span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-on-surface mb-3">
            Page Not Found
          </h1>
          <p className="text-on-surface-variant text-lg mb-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-on-surface-variant text-sm mb-8">
            Let's get you back on track.
          </p>
        </div>

        {/* Helpful Links */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 p-8 mb-8">
          <p className="text-sm font-semibold text-on-surface-variant mb-4 uppercase tracking-wide">
            Quick Links
          </p>
          <div className="space-y-3">
            <Link
              to="/"
              className="block px-4 py-3 rounded-lg text-on-surface font-medium bg-surface-container-low hover:bg-surface-container transition-colors text-left"
            >
              ← Back to Home
            </Link>
            <Link
              to="/marketplace"
              className="block px-4 py-3 rounded-lg text-on-surface font-medium bg-surface-container-low hover:bg-surface-container transition-colors text-left"
            >
              → Explore Marketplace
            </Link>
            <Link
              to="/pricing"
              className="block px-4 py-3 rounded-lg text-on-surface font-medium bg-surface-container-low hover:bg-surface-container transition-colors text-left"
            >
              → View Pricing
            </Link>
            <Link
              to="/features"
              className="block px-4 py-3 rounded-lg text-on-surface font-medium bg-surface-container-low hover:bg-surface-container transition-colors text-left"
            >
              → Explore Features
            </Link>
          </div>
        </div>

        {/* Primary CTA */}
        <Link
          to="/"
          className="signature-gradient text-white px-8 py-4 rounded-full font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <Home size={20} />
          Go to Homepage
          <ArrowRight size={20} />
        </Link>

        {/* Help Text */}
        <div className="mt-12 pt-8 border-t border-outline-variant/20">
          <p className="text-on-surface-variant text-sm mb-3">
            Still need help?
          </p>
          <button className="text-primary font-medium hover:text-primary/80 transition-colors">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

