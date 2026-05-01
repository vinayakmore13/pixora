import {
    ArrowRight,
    BarChart3,
    Check,
    Lightbulb,
    Smartphone,
    Users,
    Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function FeaturesPage() {
  const { user } = useAuth();
  const mainFeatures = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'QR Code Sync',
      description:
        'Instantly share your event with guests via QR code or unique link. Guests can start uploading photos immediately.',
      benefits: [
        'Generate unlimited QR codes per event',
        'Customizable branding for each event',
        'Track guest engagement in real-time',
        'Password-protected uploads for security',
      ],
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: 'AI Photo Finder',
      description:
        'Advanced facial recognition technology automatically identifies you in hundreds of photos. Find yourself instantly.',
      benefits: [
        'One-click setup with your selfie',
        'Works across all event galleries',
        'Privacy-first processing',
        'Continuous learning and improvements',
      ],
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Photographer Marketplace',
      description:
        'Connect with vetted photographers in your area. Browse portfolios, compare rates, and book directly.',
      benefits: [
        'Verified photographer profiles',
        'Portfolio showcase and reviews',
        'Instant booking and messaging',
        'Secure payment processing',
      ],
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Smart Analytics',
      description:
        'Get insights into your event coverage. See upload trends, guest participation, and more.',
      benefits: [
        'Real-time upload statistics',
        'Guest participation tracking',
        'Photo quality metrics',
        'Engagement reports',
      ],
    },
  ];


  return (
    <div className="min-h-screen bg-surface pt-32 pb-20">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-8 text-center mb-20">
        <h1 className="text-5xl font-serif font-bold text-on-surface mb-4">
          Powerful Features for Every Moment
        </h1>
        <p className="text-xl text-on-surface-variant">
          Everything you need to capture, organize, and share your special events
        </p>
      </section>

      {/* Main Features Grid */}
      <section className="max-w-6xl mx-auto px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mainFeatures.map((feature, idx) => (
            <div
              key={idx}
              className="group bg-white rounded-2xl border border-outline-variant/20 p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-all">
                {feature.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-on-surface mb-2">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-on-surface-variant mb-6">{feature.description}</p>

              {/* Benefits */}
              <ul className="space-y-3">
                {feature.benefits.map((benefit, bidx) => (
                  <li key={bidx} className="flex items-start gap-3">
                    <Check size={18} className="text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-on-surface-variant">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed Feature Description */}
      <section className="max-w-4xl mx-auto px-8 mb-20">
        {/* QR Code Sync Detail */}
        <div className="mb-16 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-on-surface mb-4">
                Effortless Photo Gathering
              </h3>
              <p className="text-on-surface-variant mb-4">
                Our QR code sharing system makes it incredibly easy for guests to contribute photos from your event. No app downloads, no complicated instructions.
              </p>
              <ul className="space-y-2 text-on-surface-variant">
                <li>✓ Share one QR code or send individual links</li>
                <li>✓ Guests upload photos with their mobile phones</li>
                <li>✓ Optional password protection for privacy</li>
                <li>✓ Automatic photo organization by upload time</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-8 h-64 flex items-center justify-center border border-blue-200">
              <div className="text-center">
                <Smartphone className="w-16 h-16 mx-auto text-primary mb-4" />
                <p className="text-sm text-on-surface-variant">
                  Scan, upload, done!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Photo Finder Detail */}
        <div className="mb-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="bg-white rounded-xl overflow-hidden h-64 flex items-center justify-center border border-purple-200 order-first md:order-last">
              <img 
                src="/male-face-closeup.png" 
                alt="Smart Recognition" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="order-last md:order-first">
              <h3 className="text-3xl font-bold text-on-surface mb-4">
                Never Lose Track of Yourself
              </h3>
              <p className="text-on-surface-variant mb-4">
                Train our AI once with your selfie, and automatically find yourself in every photo across all galleries. Perfect for navigating hundreds of event photos.
              </p>
              <ul className="space-y-2 text-on-surface-variant">
                <li>✓ Privacy-first facial recognition</li>
                <li>✓ Works in any lighting condition</li>
                <li>✓ Accurate across all events</li>
                <li>✓ Zero data stored on external servers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Marketplace Detail */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-3xl font-bold text-on-surface mb-4">
                Connect with Professionals
              </h3>
              <p className="text-on-surface-variant mb-4">
                Browse and book verified photographers directly through our platform. See portfolios, read reviews, and secure your professional coverage with confidence.
              </p>
              <ul className="space-y-2 text-on-surface-variant">
                <li>✓ Curated professional profiles</li>
                <li>✓ Portfolio and review system</li>
                <li>✓ Book and paid securely within platform</li>
                <li>✓ Direct messaging and collaboration</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl p-8 h-64 flex items-center justify-center border border-emerald-200">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <p className="text-sm text-on-surface-variant">
                  Find Your Perfect Match
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* CTA Section */}
      <section className="max-w-3xl mx-auto px-8 text-center">
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border border-primary/20 p-12">
          <h2 className="text-3xl font-serif font-bold text-on-surface mb-4">
            Ready to experience the power?
          </h2>
          <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
            Start with our free plan and upgrade when you need more. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="signature-gradient text-white px-8 py-3 rounded-full font-bold hover:shadow-lg hover:shadow-primary/20 transition-all inline-flex items-center justify-center gap-2"
            >
              {user ? "Go to Dashboard" : "Try For Free"} <ArrowRight size={18} />
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-3 rounded-full font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

