import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Pricing() {
  const { user } = useAuth();
  const tiers = [
    {
      name: 'Starter',
      description: 'Perfect for small events and basic sharing',
      price: '₹999',
      period: 'per month',
      cta: 'Get Started',
      highlight: false,
      features: [
        { text: '50GB Storage', included: true },
        { text: 'QR Gallery & Sharing', included: true },
        { text: 'Photo Selection Tool', included: true },
        { text: 'Basic Analytics', included: true },
        { text: 'AI Photo Finder', included: false },
        { text: 'Smart Shares included', included: false },
      ],
    },
    {
      name: 'Growth',
      description: 'Best for active photographers',
      price: '₹1999',
      period: 'per month',
      cta: 'Go Growth',
      highlight: true,
      features: [
        { text: '150GB Storage', included: true },
        { text: '10 Smart Shares FREE/mo', included: true },
        { text: 'Faster AI processing', included: true },
        { text: 'AI Photo Finder', included: true },
        { text: 'Client Selection Portal', included: true },
        { text: 'Priority Support', included: true },
      ],
    },
    {
      name: 'Professional',
      description: 'For busy studios and large-scale work',
      price: '₹2999',
      period: 'per month',
      cta: 'Go Pro',
      highlight: false,
      features: [
        { text: '300GB Storage', included: true },
        { text: 'Unlimited AI Face Search', included: true },
        { text: 'Priority Processing', included: true },
        { text: 'Unlimited Smart Shares', included: true },
        { text: 'Custom Branding', included: true },
        { text: 'Advanced Business Analytics', included: true },
      ],
    },
  ];

  const packs = [
    { name: 'Basic Pack', price: '₹149', shares: '5 Shares', bestValue: false },
    { name: 'Standard Pack', price: '₹299', shares: '15 Shares', bestValue: true },
    { name: 'Unlimited Pass', price: '₹599', shares: '7 Days Unlimited', bestValue: false },
  ];


  return (
    <div className="min-h-screen bg-surface pt-32 pb-20">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-8 text-center mb-16">
        <h1 className="text-5xl font-serif font-bold text-on-surface mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-on-surface-variant mb-2">
          Choose the perfect plan for your needs
        </p>
        <p className="text-on-surface-variant">
          No hidden fees. Cancel anytime. All plans include core features.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl transition-all duration-300 ${
                tier.highlight
                  ? 'signature-gradient p-1 shadow-xl'
                  : 'border border-outline-variant/20 bg-white'
              }`}
            >
              {/* Card Content */}
              <div
                className={`rounded-2xl h-full p-8 flex flex-col ${
                  tier.highlight ? 'bg-white' : ''
                }`}
              >
                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-on-surface mb-2">
                    {tier.name}
                  </h3>
                  <p className="text-sm text-on-surface-variant mb-4">
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-on-surface">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-on-surface-variant ml-2">
                        {tier.period}
                      </span>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    className={`w-full py-3 px-4 rounded-full font-bold transition-all mb-8 ${
                      tier.highlight
                        ? 'signature-gradient text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30'
                        : 'bg-primary-container text-on-primary-container hover:bg-primary'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </div>

                {/* Features */}
                <div className="space-y-4 flex-grow border-t border-outline-variant/20 pt-6">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          feature.included
                            ? 'bg-primary/20'
                            : 'bg-outline-variant/20'
                        }`}
                      >
                        {feature.included && (
                          <Check size={14} className="text-primary" />
                        )}
                      </div>
                      <span
                        className={feature.included ? 'text-on-surface' : 'text-on-surface-variant line-through'}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Value Badge */}
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-primary text-white text-sm font-bold shadow-lg">
                  Most Popular
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Smart Share Packs */}
      <section className="max-w-7xl mx-auto px-8 mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-bold text-on-surface mb-2">Smart Share Packs</h2>
          <p className="text-on-surface-variant text-lg">Top up your AI-powered sharing links anytime</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {packs.map((pack) => (
            <div
              key={pack.name}
              className={`p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
                pack.bestValue 
                  ? 'border-primary bg-primary/5 shadow-xl ring-1 ring-primary/20' 
                  : 'border-outline-variant/10 bg-white shadow-sm'
              } text-center relative flex flex-col`}
            >
              {pack.bestValue && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Best Value
                </span>
              )}
              <h3 className="text-xl font-bold mb-2 text-on-surface">{pack.name}</h3>
              <div className="text-4xl font-black text-primary mb-2">{pack.price}</div>
              <p className="text-on-surface-variant font-medium mb-8">{pack.shares}</p>
              
              <button className={`mt-auto w-full py-3 rounded-full font-bold transition-all ${
                pack.bestValue
                  ? 'signature-gradient text-white shadow-lg shadow-primary/20'
                  : 'border-2 border-primary text-primary hover:bg-primary hover:text-white'
              }`}>
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </section>

       {/* FAQ Section */}

      <section className="max-w-3xl mx-auto px-8 mb-20">
        <h2 className="text-3xl font-serif font-bold text-on-surface text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: 'Can I upgrade or downgrade my plan?',
              a: 'Yes, you can change your plan anytime. Changes take effect at your next billing cycle.',
            },
            {
              q: 'Is there a free trial for Premium?',
              a: 'Yes! Get 14 days free trial on Professional plan with full access to all features.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.',
            },
            {
              q: 'Do you offer discounts for annual billing?',
              a: 'Yes! Save 20% when you commit to annual billing on Professional and Enterprise plans.',
            },
            {
              q: 'What happens when I reach my storage limit?',
              a: 'You can purchase additional storage or upgrade your plan to get more included storage.',
            },
            {
              q: 'Can I get a refund?',
              a: 'We offer a 30-day money-back guarantee. No questions asked.',
            },
          ].map((faq, idx) => (
            <details key={idx} className="group border border-outline-variant/20 rounded-lg p-6 cursor-pointer">
              <summary className="flex justify-between items-center font-bold text-on-surface group-open:text-primary">
                {faq.q}
                <ArrowRight
                  size={20}
                  className="transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="mt-4 text-on-surface-variant">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-3xl mx-auto px-8 text-center">
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border border-primary/20 p-12">
          <h2 className="text-3xl font-serif font-bold text-on-surface mb-4">
            Ready to get started?
          </h2>
          <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
            Join thousands of photographers and Users already using Pixvora to
            capture and organize their best moments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="signature-gradient text-white px-8 py-3 rounded-full font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
            >
              {user ? "Go to Dashboard" : "Create Free Account"}
            </Link>
            <button className="px-8 py-3 rounded-full font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

