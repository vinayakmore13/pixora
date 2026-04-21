import React, { useRef } from 'react';
import { motion, useScroll } from 'motion/react';
import { EventCard } from './ui/EventCard';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SAMPLE_EVENTS = [
  {
    id: 1,
    title: "Aarav & Meera Wedding",
    date: "Feb 2026",
    location: "Palace Grounds, Bangalore",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: 2,
    title: "Rohan & Ishani Nikah",
    date: "Jan 2026",
    location: "Umaid Bhawan, Jodhpur",
    image: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: 3,
    title: "The Sangeet Night",
    date: "Dec 2025",
    location: "Westin, Mumbai",
    image: "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: 4,
    title: "Engagement Ceremony",
    date: "Nov 2025",
    location: "ITC Grand Chola, Chennai",
    image: "https://images.unsplash.com/photo-1549416878-b9ca35c2d47a?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: 5,
    title: "Pre-Wedding Shoot",
    date: "Oct 2025",
    location: "Leh Ladakh",
    image: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: 6,
    title: "Destination Wedding",
    date: "Sep 2025",
    location: "Udaipur Lakes",
    image: "https://images.unsplash.com/photo-1519225495810-751783d9a7a9?auto=format&fit=crop&q=80&w=1000"
  }
];

export function RecentEventsSlider() {
  const { containerRef, onMouseEnter, onMouseLeave } = useHorizontalScroll({ speed: 0.8 });
  
  // Track horizontal scroll progress
  const { scrollXProgress } = useScroll({
    container: containerRef,
  });

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 bg-surface-container-lowest overflow-hidden">
      <div className="max-w-7xl mx-auto px-8 mb-12 flex items-end justify-between">
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="text-primary font-bold uppercase tracking-widest text-xs"
          >
            Portfolio
          </motion.div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-on-surface">
            Recent Magic <br/> 
            <span className="text-on-surface-variant/40">Captured by Pixora.</span>
          </h2>
        </div>

        <div className="flex gap-4 mb-2">
          <button 
            onClick={scrollLeft}
            className="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-high transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={scrollRight}
            className="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-high transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Slider Container */}
      <div 
        ref={containerRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="flex gap-8 overflow-x-auto pb-12 px-[10%] no-scrollbar scroll-snap-type-x mandatory cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Padding wrappers for better center alignment of first/last items */}
        <div className="flex-shrink-0 w-[5vw]" />
        
        {SAMPLE_EVENTS.map((event, index) => (
          <EventCard 
            key={event.id}
            {...event}
            scrollProgress={scrollXProgress}
            index={index}
            totalCards={SAMPLE_EVENTS.length}
          />
        ))}

        <div className="flex-shrink-0 w-[5vw]" />
      </div>

      {/* Bottom Progress Bar */}
      <div className="max-w-md mx-auto px-8">
        <div className="h-1 bg-outline-variant/20 rounded-full overflow-hidden">
          <motion.div 
            style={{ scaleX: scrollXProgress }}
            className="h-full bg-primary origin-left"
          />
        </div>
      </div>
    </section>
  );
}
