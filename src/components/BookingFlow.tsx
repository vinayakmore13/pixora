import { ArrowLeft, Calendar, CheckCircle2, MessageCircle, ShieldCheck, CreditCard } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function BookingFlow() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [photographer, setPhotographer] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [paymentType, setPaymentType] = useState<'deposit' | 'full'>('deposit');
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    event_date: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/signin', { state: { from: { pathname: `/book/${packageId}` } } });
      return;
    }
    fetchBookingData();
  }, [packageId, user]);

  const fetchBookingData = async () => {
    try {
      setLoading(true);

      const { data: pkgData, error: pkgError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError) throw pkgError;

      // Prevent photographers from booking their own packages
      if (pkgData && user && pkgData.photographer_id === user.id) {
        navigate(`/photographer/${user.id}`, { replace: true });
        return;
      }

      setPkg(pkgData);

      if (pkgData) {
        const { data: photoData, error: photoError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', pkgData.photographer_id)
          .single();

        if (photoError) throw photoError;
        setPhotographer(photoData);
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.event_date || !formData.location) return;

    // Guard: prevent photographer from booking their own package
    if (user?.id === pkg.photographer_id) {
      alert('You cannot book your own package.');
      return;
    }

    try {
      setSubmitting(true);
      const amountToPay = paymentType === 'deposit' ? pkg.price * 0.2 : pkg.price;

      // ==========================================
      // TODO: INTEGRATE RAZORPAY HERE
      // When ready, replace the direct saveBooking() call below
      // with actual Razorpay checkout flow:
      //
      // 1. Call your backend to create a Razorpay Order
      //    const order = await createRazorpayOrder({ amount: amountToPay });
      //
      // 2. Initialize Razorpay options
      //    const options = {
      //      key: 'YOUR_RAZORPAY_KEY_ID',
      //      amount: amountToPay * 100,
      //      currency: 'INR',
      //      name: 'Pixvora',
      //      description: `Booking: ${pkg.title}`,
      //      order_id: order.id,
      //      handler: async (response) => { await saveBooking(); },
      //      prefill: { name: user?.user_metadata?.full_name, email: user?.email },
      //      theme: { color: '#ff4b4b' }
      //    };
      //    const rzp = new window.Razorpay(options);
      //    rzp.on('payment.failed', () => { alert('Payment failed.'); setSubmitting(false); });
      //    rzp.open();
      //
      // ==========================================

      // For now (no Razorpay configured), proceed directly to booking
      await saveBooking();

    } catch (error) {
      console.error('Error initiating payment:', error);
      alert('There was an error initiating your payment. Please try again.');
      setSubmitting(false);
    }
  };

  const saveBooking = async () => {
    try {
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .insert([{
          photographer_id: pkg.photographer_id,
          client_id: user?.id,
          package_id: pkg.id,
          event_date: formData.event_date,
          location: formData.location,
          notes: formData.notes,
          total_amount: pkg.price,
          status: 'pending' 
        }])
        .select('id')
        .single();

      if (error) throw error;

      // Auto-create a conversation between client and photographer
      try {
        // Check for existing conversation
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('client_id', user?.id)
          .eq('photographer_id', pkg.photographer_id)
          .single();

        let convoId = existing?.id;

        if (!convoId) {
          // Create new conversation linked to this booking
          const { data: newConvo, error: convoError } = await supabase
            .from('conversations')
            .insert({
              client_id: user?.id,
              photographer_id: pkg.photographer_id,
              booking_id: bookingData?.id || null,
            })
            .select('id')
            .single();

          if (!convoError && newConvo) convoId = newConvo.id;
        }

        if (convoId) {
          // Send system message about the booking
          await supabase.from('messages').insert({
            conversation_id: convoId,
            sender_id: user?.id,
            content: `✅ Booking confirmed for "${pkg.title}" — ${formData.event_date} at ${formData.location}. Let's discuss the details!`,
            message_type: 'booking_confirmed',
            metadata: { booking_id: bookingData?.id, package_title: pkg.title },
          });
          setConversationId(convoId);
        }
      } catch (chatErr) {
        console.error('Error creating chat (non-blocking):', chatErr);
      }

      setSuccess(true);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('There was an error creating your booking. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center pt-24 pb-20">Loading booking details...</div>;
  }

  if (!pkg) {
    return <div className="min-h-screen bg-surface flex flex-col items-center justify-center pt-24 pb-20">
      <h2 className="text-2xl font-bold mb-4">Package not found</h2>
      <button onClick={() => navigate(-1)} className="text-primary font-bold">Go Back</button>
    </div>;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center pt-24 pb-20">
        <div className="bg-white p-12 rounded-[3rem] silk-shadow text-center max-w-lg mx-auto">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-serif font-bold mb-4">Booking Requested!</h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            Your booking request has been sent to {photographer?.full_name}. Chat with them to discuss the details!
          </p>
          {conversationId ? (
            <button
              onClick={() => navigate(`/messages/${conversationId}`)}
              className="w-full bg-primary text-white py-4 rounded-full font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mb-3"
            >
              <MessageCircle size={20} /> Chat with {photographer?.full_name?.split(' ')[0]}
            </button>
          ) : null}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-on-surface text-white py-4 rounded-full font-bold hover:bg-on-surface/90 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 bg-surface min-h-screen">
      <div className="max-w-6xl mx-auto px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold mb-8"
        >
          <ArrowLeft size={20} /> Back
        </button>

        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-12">Complete Your Booking</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] silk-shadow border border-outline-variant/10">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Calendar className="text-primary" /> Event Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Event Date *</label>
                    <input
                      type="date"
                      name="event_date"
                      required
                      value={formData.event_date}
                      onChange={handleChange}
                      className="w-full bg-surface border border-outline-variant/20 rounded-xl py-4 px-4 focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">Location/Venue *</label>
                    <input
                      type="text"
                      name="location"
                      required
                      placeholder="e.g. Taj Lake Palace, Udaipur"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full bg-surface border border-outline-variant/20 rounded-xl py-4 px-4 focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">Additional Notes / Special Requests</label>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Tell the photographer more about your vision, schedule, or anything specific you want covered."
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full bg-surface border border-outline-variant/20 rounded-xl py-4 px-4 focus:ring-1 focus:ring-primary outline-none resize-y"
                  ></textarea>
                </div>

                <div className="pt-6 border-t border-outline-variant/10">
                  <h3 className="text-sm font-bold text-on-surface-variant mb-4 flex items-center gap-2">
                    <CreditCard size={16} /> Choose Payment Option
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentType === 'deposit' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-primary/50'}`} >
                      <input type="radio" value="deposit" checked={paymentType === 'deposit'} onChange={() => setPaymentType('deposit')} className="hidden" />
                      <div className="font-bold text-lg">Pay 20% Deposit</div>
                      <div className="text-sm text-on-surface-variant">₹{(pkg.price * 0.2).toLocaleString()}</div>
                    </label>
                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${paymentType === 'full' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-primary/50'}`} >
                      <input type="radio" value="full" checked={paymentType === 'full'} onChange={() => setPaymentType('full')} className="hidden" />
                      <div className="font-bold text-lg">Pay Full Amount</div>
                      <div className="text-sm text-on-surface-variant">₹{pkg.price.toLocaleString()}</div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary text-white py-5 rounded-full font-bold text-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
                  >
                    {submitting ? 'Processing Payment...' : `Pay ₹${(paymentType === 'deposit' ? pkg.price * 0.2 : pkg.price).toLocaleString()} securely`}
                  </button>
                  <p className="text-center text-xs text-on-surface-variant/60 mt-4 flex items-center justify-center gap-1">
                    <ShieldCheck size={14} /> Secured by Razorpay. Enter valid keys to test real checkout.
                  </p>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Summary */}
          <aside className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/10 sticky top-24">
              <h3 className="text-xl font-bold mb-6">Booking Summary</h3>

              <div className="flex items-center gap-4 border-b border-outline-variant/10 pb-6 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container-low border border-outline-variant/20 shrink-0">
                  <img
                    src={photographer?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(photographer?.full_name || 'A')}`}
                    alt="Photographer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Photographer</div>
                  <div className="font-bold text-on-surface text-lg leading-tight">{photographer?.full_name || 'Photographer'}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="font-bold text-on-surface mb-2">{pkg.title}</div>
                {pkg.description && <p className="text-sm text-on-surface-variant mb-4">{pkg.description}</p>}
                <ul className="space-y-2">
                  {(pkg.features || []).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-outline-variant/10 pt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-on-surface-variant font-medium">Package Price</span>
                  <span className="font-bold">₹{pkg.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-6 text-sm text-on-surface-variant">
                  <span>Booking Advance (20%)</span>
                  <span>₹{(pkg.price * 0.2).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-6 text-sm text-on-surface-variant">
                  <span>Remaining Balance</span>
                  <span>₹{(pkg.price * 0.8).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-4 text-xl">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">₹{pkg.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/10 text-lg">
                  <span className="font-bold">Due Now</span>
                  <span className="font-bold text-primary">₹{(paymentType === 'deposit' ? pkg.price * 0.2 : pkg.price).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

