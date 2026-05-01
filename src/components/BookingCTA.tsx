import { Check, Mail, MessageSquare, Phone } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

interface Package {
  id: string;
  title: string;
  price: number;
  description: string;
  features: string[];
  is_recommended?: boolean;
}

interface BookingCTAProps {
  photographerName: string;
  packages: Package[];
  photographerId: string;
  onBookingInquiry?: (packageId: string) => void;
  isLoading?: boolean;
}

export function BookingCTA({
  photographerName,
  packages,
  photographerId,
  onBookingInquiry,
  isLoading = false,
}: BookingCTAProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(
    packages.find(p => p.is_recommended)?.id || packages[0]?.id || null
  );
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | 'message'>('email');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleInquiry = async () => {
    if (!selectedPackage) return;

    setSubmitting(true);
    try {
      // Call callback or API
      onBookingInquiry?.(selectedPackage);

      // Show success message
      setMessage('');
      alert('Booking inquiry sent! The photographer will contact you soon.');
    } catch (error) {
      alert('Failed to send inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  if (packages.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <p className="text-gray-600">No packages available at this time</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Packages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg.id)}
            className={cn(
              'p-6 rounded-xl border-2 transition-all text-left',
              selectedPackage === pkg.id
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            {pkg.is_recommended && (
              <div className="mb-3">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">
                  Popular
                </span>
              </div>
            )}

            <h3 className="font-bold text-lg text-gray-900 mb-2">{pkg.title}</h3>

            <div className="text-3xl font-bold text-gray-900 mb-1">
              ₹{pkg.price.toLocaleString()}
            </div>

            {pkg.description && (
              <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>
            )}

            <div className="space-y-2">
              {pkg.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Contact & Booking */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 text-white">
        <h3 className="text-2xl font-bold mb-6">Ready to book?</h3>

        {/* Contact Method Selection */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setContactMethod('email')}
            className={cn(
              'p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2',
              contactMethod === 'email'
                ? 'border-white bg-white/10'
                : 'border-white/20 hover:border-white/40'
            )}
          >
            <Mail size={24} />
            <span className="text-sm font-semibold">Email</span>
          </button>
          <button
            onClick={() => setContactMethod('phone')}
            className={cn(
              'p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2',
              contactMethod === 'phone'
                ? 'border-white bg-white/10'
                : 'border-white/20 hover:border-white/40'
            )}
          >
            <Phone size={24} />
            <span className="text-sm font-semibold">Call</span>
          </button>
          <button
            onClick={() => setContactMethod('message')}
            className={cn(
              'p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2',
              contactMethod === 'message'
                ? 'border-white bg-white/10'
                : 'border-white/20 hover:border-white/40'
            )}
          >
            <MessageSquare size={24} />
            <span className="text-sm font-semibold">Message</span>
          </button>
        </div>

        {/* Message Field (for message contact) */}
        {contactMethod === 'message' && (
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3">Tell them about your event</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your event, dates, location, and any special requirements..."
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:border-white/40 focus:outline-none resize-none h-32"
            />
          </div>
        )}

        {/* Send Inquiry Button */}
        <button
          onClick={handleInquiry}
          disabled={submitting || !selectedPackage}
          className={cn(
            'w-full py-4 rounded-lg font-bold text-lg transition-all',
            submitting || !selectedPackage
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-900 hover:bg-gray-100 active:scale-95'
          )}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              Sending...
            </span>
          ) : contactMethod === 'phone' ? (
            'Call for Inquiry'
          ) : (
            'Send Inquiry'
          )}
        </button>

        {/* Info Text */}
        <p className="text-sm text-white/60 text-center mt-4">
          {photographerName} will respond within 24 hours
        </p>
      </div>

      {/* Trust Indicators */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-3xl font-bold text-gray-900">500+</div>
           <p className="text-sm text-gray-600">Happy Users</p>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">4.8★</div>
          <p className="text-sm text-gray-600">Average Rating</p>
        </div>
        <div>
          <div className="text-3xl font-bold text-gray-900">10+</div>
          <p className="text-sm text-gray-600">Years Experience</p>
        </div>
      </div>
    </div>
  );
}

