import React, { useState } from 'react';
import { Calendar, CheckCircle, Mail, MessageSquare, Phone, Send, User } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface LeadInquiryFormProps {
  photographerId: string;
  eventId?: string;
  studioName: string;
  brandColorPrimary?: string;
}

export function LeadInquiryForm({
  photographerId,
  eventId,
  studioName,
  brandColorPrimary = '#FF6B6B',
}: LeadInquiryFormProps) {
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    event_date: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('lead_inquiries')
        .insert({
          photographer_id: photographerId,
          event_id: eventId || null,
          client_name: form.client_name.trim(),
          client_email: form.client_email.trim() || null,
          client_phone: form.client_phone.trim() || null,
          event_date: form.event_date || null,
          message: form.message.trim() || null,
          status: 'new',
        });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      console.error('[LeadInquiryForm] Error:', err);
      setError('Failed to send inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-outline-variant/5 text-center" style={{ boxShadow: `0 8px 40px ${brandColorPrimary}15` }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${brandColorPrimary}15` }}
        >
          <CheckCircle size={40} style={{ color: brandColorPrimary }} />
        </div>
        <h3 className="text-2xl font-serif font-bold text-on-surface mb-2">Inquiry Sent!</h3>
        <p className="text-on-surface-variant leading-relaxed">
          Your inquiry has been sent to <strong>{studioName}</strong>. They'll get back to you soon!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-outline-variant/5" style={{ boxShadow: `0 8px 40px ${brandColorPrimary}10` }}>
      <div className="text-center mb-8">
        <h3 className="text-2xl font-serif font-bold text-on-surface mb-2">
          ❤️ Loved these photos?
        </h3>
        <p className="text-on-surface-variant">
          Book <strong>{studioName}</strong> for your event!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            name="client_name"
            type="text"
            required
            value={form.client_name}
            onChange={handleChange}
            placeholder="Your Name *"
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 text-sm"
            style={{ '--tw-ring-color': `${brandColorPrimary}40` } as any}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              name="client_phone"
              type="tel"
              value={form.client_phone}
              onChange={handleChange}
              placeholder="Phone"
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 text-sm"
              style={{ '--tw-ring-color': `${brandColorPrimary}40` } as any}
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              name="client_email"
              type="email"
              value={form.client_email}
              onChange={handleChange}
              placeholder="Email"
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 text-sm"
              style={{ '--tw-ring-color': `${brandColorPrimary}40` } as any}
            />
          </div>
        </div>

        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            name="event_date"
            type="date"
            value={form.event_date}
            onChange={handleChange}
            placeholder="Event Date"
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 text-sm"
            style={{ '--tw-ring-color': `${brandColorPrimary}40` } as any}
          />
        </div>

        <div className="relative">
          <MessageSquare className="absolute left-4 top-4 text-on-surface-variant" size={18} />
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Tell us about your event..."
            rows={3}
            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 text-sm resize-none"
            style={{ '--tw-ring-color': `${brandColorPrimary}40` } as any}
          />
        </div>

        {error && (
          <p className="text-red-500 text-xs text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !form.client_name.trim()}
          className="w-full text-white py-4 rounded-2xl font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: brandColorPrimary, boxShadow: `0 8px 24px ${brandColorPrimary}30` }}
        >
          <Send size={18} />
          {submitting ? 'Sending...' : `Send Inquiry to ${studioName}`}
        </button>
      </form>
    </div>
  );
}
