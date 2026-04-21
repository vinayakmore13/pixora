import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { 
  ArrowRight, 
  Camera, 
  Sparkles, 
  QrCode, 
  Users, 
  ChevronRight, 
  Play,
  CheckCircle2,
  Lock,
  Globe
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { RecentEventsSlider } from './RecentEventsSlider';

gsap.registerPlugin(ScrollTrigger);

export function AnimatedLandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);

  // Initialize smooth scroll
  useSmoothScroll();

  useGSAP(() => {
    // Hero Text Reveal
    gsap.from(".hero-title span", {
      y: 100,
      opacity: 0,
      stagger: 0.1,
      duration: 1.2,
      ease: "power4.out",
    });

    // Parallax effect for hero image
    gsap.to(".hero-image", {
      yPercent: 30,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero-section",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    // AI Section reveal
    gsap.from(".ai-card", {
      scale: 0.8,
      opacity: 0,
      duration: 1,
      scrollTrigger: {
        trigger: ".ai-section",
        start: "top 80%",
        end: "top 30%",
        scrub: 1
      }
    });

  }, { scope: container });

  return (
    <div ref={container} className="bg-surface text-on-surface overflow-hidden">
      {/* Cinematic Hero Section */}
      <section className="hero-section relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="hero-image absolute inset-0 scale-110">
            <img
              className="w-full h-full object-cover brightness-[0.75]"
              src="/pixora-hero.png"
              alt="Premium Wedding"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 text-center space-y-12">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium"
            >
              <Sparkles size={16} className="text-primary-container" />
              <span>AI-Powered Wedding Memories</span>
            </motion.div>
            
            <h1 className="hero-title text-6xl md:text-8xl font-bold tracking-tight text-white flex flex-col items-center">
              <span className="inline-block overflow-hidden pb-2">Your Memories.</span>
              <span className="inline-block overflow-hidden text-transparent bg-clip-text bg-gradient-to-r from-primary-container to-rose-300">
                Intelligently Shared.
              </span>
            </h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-light"
            >
              Experience the next generation of event sharing with QR automated workflows, 
              AI face recognition, and an elite photographer marketplace.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            className="flex flex-wrap justify-center gap-6"
          >
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="px-10 py-5 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-transform active:scale-95 shadow-2xl flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/marketplace"
              className="px-10 py-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2"
            >
              Explore Marketplace
            </Link>
          </motion.div>
        </div>

        {/* Floating elements for visual depth */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
           <div className="w-1 h-8 rounded-full bg-white"></div>
        </div>
      </section>

      {/* AI Smart Share Highlight Section */}
      <section className="ai-section py-32 px-8 relative bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="ai-card relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-rose-500/20 rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
              <div className="relative rounded-[2.5rem] overflow-hidden aspect-square silk-shadow bg-surface border border-outline-variant/10">
                <img
                  className="w-full h-full object-cover opacity-90"
                  src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1000"
                  alt="AI Smart Share"
                />
                
                {/* AI Scanning UI Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    animate={{ y: [-100, 100, -100] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-full h-1 bg-primary/40 shadow-[0_0_20px_rgba(174,47,52,0.8)] z-20"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/50 rounded-full animate-pulse flex items-center justify-center">
                    <div className="w-40 h-40 border border-white/30 rounded-full animate-[ping_3s_infinite]"></div>
                    <Lock className="text-white absolute" size={32} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="inline-block px-3 py-1 rounded-md bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
                The Future of Delivery
              </div>
              <h2 className="text-5xl font-bold tracking-tight text-on-surface leading-[1.1]">
                Find your face <br/> in seconds.
              </h2>
              <p className="text-xl text-on-surface-variant max-w-lg leading-relaxed">
                No more scrolling through 1,000+ event photos. Our proprietary AI scans the entire gallery 
                and private-shares every photo you're in, directly to your device.
              </p>
              
              <ul className="space-y-4">
                {[
                  { icon: <Globe size={20}/>, text: "Privacy-first face matching", sub: "Data encrypted and stored locally" },
                  { icon: <Users size={20}/>, text: "Group selection for families", sub: "Find photos of your loved ones too" },
                  { icon: <Lock size={20}/>, text: "Secure one-click sharing", sub: "Only you see your matched photos" }
                ].map((item, i) => (
                  <motion.li 
                    key={i}
                    whileHover={{ x: 10 }}
                    className="flex gap-4 items-start p-4 rounded-2xl hover:bg-white transition-all cursor-default"
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface">{item.text}</div>
                      <div className="text-sm text-on-surface-variant/80">{item.sub}</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cinematic Recent Events Slider */}
      <RecentEventsSlider />

      {/* Feature Grid with Animated Cards */}
      <section className="py-32 px-8 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight">Elegance meets Utility.</h2>
            <p className="text-xl text-on-surface-variant">Built for premium events and the professionals who capture them.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<QrCode size={32} />} 
              title="QR Automation" 
              desc="Personalized QR cards for every wedding table. Instant guest uploads without the friction."
              gradient="from-blue-500/10 to-indigo-500/10"
            />
            <FeatureCard 
              icon={<Camera size={32} />} 
              title="Pro Marketplace" 
              desc="Book elite, vetted photographers directly through Pixora. Secure payments and instant delivery."
              gradient="from-primary/10 to-rose-500/10"
            />
            <FeatureCard 
              icon={<Users size={32} />} 
              title="Social Curation" 
              desc="A live, aggregated feed of guest captures and pro shots, beautifully organized by timeline."
              gradient="from-amber-500/10 to-orange-500/10"
            />
          </div>
        </div>
      </section>

      {/* Photographer CTA Section (High Impact) */}
      <section className="py-32 px-8 bg-on-surface text-surface overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 overflow-hidden pointer-events-none">
          <img 
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&q=80&w=1000"
            alt="Photographer Gear"
          />
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10 grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-none">
              Built by Photographers, <br/> 
              <span className="italic text-primary-container">for Professionals.</span>
            </h2>
            <p className="text-xl text-surface/70 leading-relaxed">
              Don't just share photos. Elevate your brand with editorial delivery galleries, 
              automated lead management, and AI-driven print sales.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/marketplace" className="px-8 py-4 rounded-full bg-primary-container text-on-primary-container font-bold text-lg hover:scale-105 transition-all">
                Join the Network
              </Link>
              <button className="px-8 py-4 rounded-full border border-surface/20 hover:bg-surface/10 transition-all font-bold text-lg">
                View Features
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-4 pt-12">
                <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-white/5 backdrop-blur-md p-4 flex flex-col justify-end">
                   <div className="text-3xl font-bold">50%</div>
                   <div className="text-xs uppercase tracking-widest opacity-60">Faster Delivery</div>
                </div>
                <div className="aspect-square rounded-3xl overflow-hidden">
                   <img className="w-full h-full object-cover brightness-75" src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=500" alt="Camera"/>
                </div>
             </div>
             <div className="space-y-4">
                <div className="aspect-square rounded-3xl overflow-hidden">
                   <img className="w-full h-full object-cover brightness-75" src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=500" alt="Lens"/>
                </div>
                <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-primary p-4 flex flex-col justify-end">
                   <div className="text-3xl font-bold">10k+</div>
                   <div className="text-xs uppercase tracking-widest opacity-80">Pros Trusted</div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer / Final CTA */}
      <section className="py-32 px-8 text-center bg-surface relative">
         <div className="max-w-4xl mx-auto space-y-12">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight">Your event, <br/> perfectly archived.</h2>
            <div className="flex justify-center flex-wrap gap-6">
               <Link to="/signup" className="px-12 py-6 rounded-full bg-primary text-white font-bold text-xl hover:scale-105 transition-all shadow-xl">
                  Start Your Event
               </Link>
            </div>
            <div className="flex justify-center items-center gap-12 pt-12 text-on-surface/40">
               <span className="font-bold tracking-widest uppercase text-[10px]">Premium Experience</span>
               <div className="w-1 h-1 rounded-full bg-current"></div>
               <span className="font-bold tracking-widest uppercase text-[10px]">Secure Storage</span>
               <div className="w-1 h-1 rounded-full bg-current"></div>
               <span className="font-bold tracking-widest uppercase text-[10px]">AI Matching</span>
            </div>
         </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, gradient }: { icon: React.ReactNode, title: string, desc: string, gradient: string }) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="p-10 rounded-[3rem] bg-surface-container-low border border-outline-variant/10 silk-shadow transition-all group"
    >
      <div className={`w-20 h-20 rounded-[2rem] bg-gradient-to-br ${gradient} flex items-center justify-center mb-8 text-primary group-hover:scale-110 transition-transform duration-500`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-on-surface-variant leading-relaxed text-lg">
        {desc}
      </p>
      <div className="pt-6">
        <button className="flex items-center gap-2 font-bold text-primary hover:gap-4 transition-all uppercase tracking-widest text-xs">
          Learn More <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}
