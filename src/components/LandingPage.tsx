import { ArrowRight, Camera, CheckCircle2, ChevronUp, PlayCircle, QrCode, UserRound } from 'lucide-react';
import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="relative min-h-[921px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7HGs7tIai5E6V4c32vp7u53s5eKTABW3yEqN2wD6j_SOOorXcaAibJ4iTErW0KUNGENGEeduRiRkhLT1bSz_zCeZO1UezB9e7Zg-GLXFKRpV5FASeHfTVI_JbANb-uD94hxS9KbkpiTwbODvh0W8BffjqLtI57AxLSXVTgQfoDF3SBn6M5WLN3bFTY0lePVSnR7Geu6DQSlLol6HrueeLTEcrcnhkLMhByVBDADI1mB6gsNASt3IiwfY5nTNcifW0kJ9chkrB1iA"
            alt="Wedding Reception"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 w-full grid md:grid-cols-2 gap-12 items-center">
          <div className="text-white space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              Your Event Memories, <br />
              <span className="text-primary-container inline-block">
                Perfectly Organized.
              </span>
            </h1>
            <p className="text-xl text-white/90 max-w-lg leading-relaxed font-light">
              Experience the next generation of event memories with QR-based sharing, AI face recognition, and a curated marketplace for top photographers.
            </p>
            <div className="flex flex-wrap gap-4">
              <div>
                <Link to={user ? "/dashboard" : "/signup"} className="bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-bold text-lg hover:brightness-110 transition-all active:scale-95 inline-block">
                  {user ? "Go to Dashboard" : "Create Free Event"}
                </Link>
              </div>
              <button 
                onClick={scrollToFeatures} 
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <PlayCircle size={24} />
                See How It Works
              </button>
            </div>

            <div className="flex items-center gap-6 pt-4 text-white/70">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white">10,000+</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase">Photos Shared</span>
              </div>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white">500+</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase">Happy Users</span>
              </div>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-white">50+</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase">Verified Pros</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-24 bg-surface px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center max-w-2xl mx-auto">
            <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">
              The Digital Curator
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Everything You Need for Event Photos
            </h2>
            <p className="text-on-surface-variant text-lg">
              We've combined high-end technology with editorial aesthetics to create the ultimate memory archive.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                {index === 0 && (
                  <FeatureCard
                    icon={<QrCode className="text-primary" size={32} />}
                    title="QR Code Sharing"
                    description="Place personalized QR codes on tables. Guests scan, snap, and photos instantly appear in your private gallery."
                    color="primary"
                  />
                )}
                {index === 1 && (
                  <FeatureCard
                    icon={<UserRound className="text-secondary" size={32} />}
                    title="AI Photo Finder"
                    description="Our intelligent facial recognition helps guests find every photo they're in across thousands of ceremony shots."
                    color="secondary"
                  />
                )}
                {index === 2 && (
                  <FeatureCard
                    icon={<Camera className="text-tertiary" size={32} />}
                    title="Pro Marketplace"
                    description="Connect with vetted, elite event photographers who use Pixvora to deliver high-resolution heirlooms."
                    color="tertiary"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-surface-container-low overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 grid md:grid-cols-2 gap-16 items-center">
          <div className="relative h-[500px] flex items-center justify-center">
            <div className="relative w-72 h-96 -rotate-6 bg-white p-3 rounded-sm shadow-xl z-30 transform hover:rotate-0 transition-transform duration-500 cursor-pointer">
              <img
                className="w-full h-[85%] object-cover grayscale-[0.2]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtZ3oIhglE5T0unWhx4SO6AIvkOp_k_YyOX_FyIG-f4PopRHtaKsNcj-F14mhLjWSNNgNkQc4Cktlb-UmO6OX5FCKpivHS8Ly1jt81zs80cW9Rz3KFAIw5lwIZFIFX5qJBwWVPU7AcN_8-UABFcSW6GQSdS3L1JLYtcLOhsmdsg5cgagO0zyW_XA-s1396kaWwIqsxoJATkuUPMNYKnoFh2HD1DflJ_M5x4U8gRFP8IxguaNgnVVza_rhiGoFxCl9rIHtMdPk5atk"
                alt="Rings"
                referrerPolicy="no-referrer"
              />
              <div className="pt-4 text-center text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">The Rings • 2024</div>
            </div>
            <div className="absolute w-72 h-96 rotate-12 bg-white p-3 rounded-sm shadow-lg z-20 translate-x-12">
              <img
                className="w-full h-[85%] object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDj1G52gWeg6TnXE2qbkn1UKxQ243c5LSOx7BI-irYBqmjjxBcpsEEqxvGZgLr3aEQf0kUdiBo-wssV34MrhHV5VL41fSeENb2_Q24fnV-N2bQ2dJx-F5lZv-dbGZYSZGYh8A8SyJqeghSfmxvXppw7CkOfHqH-8aBP5zAxtLBf28hC5Fi0Tmq2plVZkpL4W1xgTcDAccamNnHVIAg5RL091R1tjXj1J8iVazKi-tV_YseFQCJ1fMALnPJaBzGuulHYLFBEPk-O5CY"
                alt="Dance"
                referrerPolicy="no-referrer"
              />
              <div className="pt-4 text-center text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">First Dance</div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">How It Works</h2>
            <div className="space-y-12 relative">
              <div className="absolute left-[27px] top-4 bottom-4 w-px bg-outline-variant/30 hidden md:block"></div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <Step number={i + 1} title={
                    i === 0 ? "Create your event" :
                    i === 1 ? "Photographer uploads" :
                    i === 2 ? "Guests scan QR" :
                    "Download & Cherish"
                  } description={
                    i === 0 ? "Set up your private event gallery in minutes and customize your unique sharing link." :
                    i === 1 ? "Invite your professional photographer to upload high-res shots directly to your timeline." :
                    i === 2 ? "Print your unique QR code on table cards. Guests can instantly upload their candid captures." :
                    "Access your full digital heirloom. Download all photos or order high-quality physical prints."
                  } />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="py-32 bg-surface">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div className="order-2 md:order-1">
              <div className="relative rounded-[3rem] overflow-hidden aspect-[4/5] silk-shadow">
                <img
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDB9od0ZnugMCbeQo0DRjhfxm936wh-GtYPc5KuUQBP7w8q5EpCqTN8pVl071OJclqKtyaOEbDEjte7LCwy0p06PA419oVYkSf7ilddLco6LpAfzV80soiFE_GsdXDGexeJHH8lZl8xnbsB4YMaqopE8oBWA3OGyt0YX7ER4hgntkU_QY1sMVi-xGpmO9EI1Kz0TMEakERd7GSbbWJnb9znUBj_ZPGGgKiGVH5DzWKIp_a1lKFsfkqD0MMOy7kQRcyGM86LhQxVxD0"
                  alt="Photographer"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-primary/20 mix-blend-overlay"></div>
              </div>
            </div>
            <div className="order-1 md:order-2 space-y-8">
              <span className="text-secondary font-bold tracking-widest text-xs uppercase block">
                For the Professionals
              </span>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-on-surface">Grow Your Photography Business</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed">Pixvora is more than a sharing tool—it's a client management and delivery powerhouse designed specifically for elite photographers.</p>
              <ul className="space-y-6">
                {["Instant gallery delivery with zero compression", "Direct client booking and inquiry management", "Automatic guest face-matching for prints sales", "Professional portfolio hosting in an editorial layout"].map((item, i) => (
                  <div key={i}>
                    <ListItem text={item} />
                  </div>
                ))}
              </ul>
              <div>
                <Link to="/marketplace" className="bg-secondary text-white px-10 py-5 rounded-full font-bold text-lg hover:brightness-110 transition-all shadow-lg active:scale-95 inline-block">
                  Join as Photographer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto bg-primary rounded-[3rem] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl">
          <div 
            className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"
          />
          <div 
            className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"
          />
          <h2 
            className="text-4xl md:text-6xl font-bold tracking-tight mb-8 relative z-10"
          >
            Capture every angle of <br /> your big day.
          </h2>
          <div 
            className="flex flex-wrap justify-center gap-6 relative z-10"
          >
            <div>
              <Link to={user ? "/dashboard" : "/signup"} className="bg-white text-primary px-10 py-5 rounded-full font-bold text-xl hover:scale-105 transition-transform active:scale-95 inline-block">
                {user ? "Go to Dashboard" : "Start Your Free Event"}
              </Link>
            </div>
            <div>
              <Link to="/marketplace" className="bg-primary-container text-on-primary-container px-10 py-5 rounded-full font-bold text-xl hover:scale-105 transition-transform active:scale-95 inline-block">
                Find a Photographer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 p-3 rounded-full bg-primary text-white shadow-lg hover:shadow-xl z-40"
      >
        <ChevronUp size={24} />
      </button>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
  return (
    <div 
      className="group bg-surface-container-low p-10 rounded-[2.5rem] transition-all hover:bg-white hover:-translate-y-2 duration-500 silk-shadow"
    >
      <div
        className={`w-16 h-16 rounded-3xl bg-${color}/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 text-on-surface">{title}</h3>
      <p className="text-on-surface-variant leading-relaxed mb-6">{description}</p>
      <div>
        <Link to="/features" className="text-primary font-bold flex items-center gap-2 group-hover:gap-4 transition-all">
          Learn more <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: number, title: string, description: string }) {
  return (
    <div className="flex gap-6 relative">
      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0 z-10 text-white font-bold">{number}</div>
      <div>
        <h4 className="text-xl font-bold mb-2 text-on-surface">{title}</h4>
        <p className="text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function ListItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-4">
      <CheckCircle2 className="text-secondary shrink-0" size={24} />
      <span className="text-on-surface font-medium">{text}</span>
    </li>
  );
}

