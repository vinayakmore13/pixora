import { HelpCircle, Mail, MessageCircle, Phone, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

export function HelpSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingChat, setLoadingChat] = useState(false);

  async function handleLiveChat() {
    if (!user) {
      navigate('/signin?redirect=/support');
      return;
    }

    try {
      setLoadingChat(true);

      // 1. Check if a support conversation already exists for this user
      const { data: existingConvo, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', user.id)
        .eq('is_support', true)
        .single();

      if (existingConvo) {
        navigate(`/messages/${existingConvo.id}`);
        return;
      }

      // 2. Create a new support conversation
      const { data: newConvo, error: createError } = await supabase
        .from('conversations')
        .insert({
          client_id: user.id,
          is_support: true,
          // photographer_id is NULL for platform support
        })
        .select('id')
        .single();

      if (createError) throw createError;

      // 3. Add a welcome message
      await supabase.from('messages').insert({
        conversation_id: newConvo.id,
        sender_id: user.id, // Or a system ID if available
        content: "Hi! I need some help with my account.",
        message_type: 'text'
      });

      navigate(`/messages/${newConvo.id}`);
    } catch (err) {
      console.error('[HelpSupport] Error starting live chat:', err);
      alert('Unable to start live chat. Please try again later.');
    } finally {
      setLoadingChat(false);
    }
  }

  const faqs = [
    {
      question: "How do I share my event photos?",
      answer: "Every event comes with a unique QR code. Simply print it out or display it on a screen at your event. Guests can scan it and upload photos directly from their phone—no app required!"
    },
    {
      question: "How does the AI Photo Finder work?",
      answer: "Take a quick selfie in your profile settings. Our AI will then scan the event galleries to automatically find every photo you're in, so you don't have to scroll through hundreds of images."
    },
    {
      question: "Is there a limit to how many photos can be uploaded?",
      answer: "The limit depends on your plan. Our free tier allows up to 100 photos, while premium plans offer significantly higher limits and even unlimited storage for professional photographers."
    },
    {
      question: "Can I moderate the guest uploads?",
      answer: "Yes! Event hosts have full control. You can enable 'Moderation Mode' to approve photos before they appear in the public gallery for all guests to see."
    }
  ];

  return (
    <div className="min-h-screen bg-surface pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-8">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-serif font-bold text-on-surface mb-4">How can we help?</h1>
          <p className="text-xl text-on-surface-variant">Find answers to common questions or reach out to our team.</p>
        </header>

        {/* Search Bar */}
        <div className="relative mb-20">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant" size={24} />
          <input
            type="text"
            placeholder="Search for answers..."
            className="w-full bg-white border border-outline-variant/30 rounded-[2rem] py-6 pl-16 pr-8 text-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all silk-shadow"
          />
        </div>

        {/* Quick Contact Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <ContactCard 
            icon={<Mail className="text-primary" />} 
            title="Email Support" 
            detail="support@pixora.com" 
            description="We typically respond within 12-24 hours."
          />
          <ContactCard 
            icon={<MessageCircle className="text-secondary" />} 
            title={loadingChat ? "Starting Chat..." : "Live Chat"} 
            detail="Available 24/7" 
            description="Quickest for technical help."
            onClick={handleLiveChat}
          />
          <ContactCard 
            icon={<Phone className="text-tertiary" />} 
            title="Phone Support" 
            detail="+1 (555) PIX-ORA" 
            description="Exclusive for Premium members."
          />
        </section>

        {/* FAQs */}
        <section>
          <h2 className="text-3xl font-serif font-bold text-on-surface mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white border border-outline-variant/10 rounded-2xl p-6 silk-shadow">
                <h3 className="text-lg font-bold text-on-surface mb-2">{faq.question}</h3>
                <p className="text-on-surface-variant leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ContactCard({ icon, title, detail, description, onClick }: { icon: React.ReactNode, title: string, detail: string, description: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-white p-8 rounded-[2rem] border border-outline-variant/10 silk-shadow transition-all text-left w-full h-full block",
        onClick ? "hover:-translate-y-1 hover:border-primary/20 active:scale-95 cursor-pointer" : "cursor-default"
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-on-surface mb-1">{title}</h3>
      <div className="text-primary font-bold mb-3">{detail}</div>
      <p className="text-sm text-on-surface-variant">{description}</p>
    </button>
  );
}

