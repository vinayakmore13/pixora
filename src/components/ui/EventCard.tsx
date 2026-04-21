import React from 'react';
import { motion, useTransform, MotionValue, useSpring } from 'motion/react';
import { MapPin, Calendar, ArrowUpRight } from 'lucide-react';

interface EventCardProps {
  id: number | string;
  title: string;
  date: string;
  location: string;
  image: string;
  scrollProgress: MotionValue<number>;
  index: number;
  totalCards: number;
}

export function EventCard({ 
  title, 
  date, 
  location, 
  image, 
  scrollProgress, 
  index, 
  totalCards 
}: EventCardProps) {
  // Calculate the center point of this card in the scroll range [0, 1]
  const cardStep = 1 / (totalCards - 1 || 1);
  const cardCenter = index * cardStep;

  // Calculate distance from the current scroll progress to this card's center
  // Using useTransform with a function for maximum control and to avoid WAAPI issues
  const rawDistance = useTransform(scrollProgress, (val) => {
    return Math.abs(val - cardCenter);
  });

  // Smooth the distance slightly for better performance/look
  const distance = useSpring(rawDistance, { stiffness: 100, damping: 20 });

  // Map the distance to visual properties
  // As distance approaches 0 (center), properties approach their "focused" state
  const scale = useTransform(distance, [0, cardStep], [1.1, 0.9]);
  const opacity = useTransform(distance, [0, cardStep], [1, 0.6]);
  const rotateY = useTransform(scrollProgress, [cardCenter - cardStep, cardCenter, cardCenter + cardStep], [15, 0, -15]);
  const z = useTransform(distance, [0, cardStep], [50, -100]);

  return (
    <div className="relative flex-shrink-0 w-[300px] md:w-[350px] aspect-[3/4] scroll-snap-align-center pb-8 pt-4">
      <motion.div
        style={{
          scale,
          rotateY,
          opacity,
          z,
          perspective: 1000,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity",
        }}
        className="w-full h-full rounded-[2.5rem] overflow-hidden silk-shadow group cursor-pointer bg-surface-container-high"
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        </div>

        {/* Hover Overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20 backdrop-blur-[2px]">
          <div className="bg-white/20 backdrop-blur-md border border-white/30 px-6 py-3 rounded-full text-white font-bold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform">
            View Event <ArrowUpRight size={18} />
          </div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white space-y-2">
          <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-widest">
            <Calendar size={12} className="text-primary-container" />
            {date}
          </div>
          <h3 className="text-2xl font-bold leading-tight group-hover:text-primary-container transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-white/80 text-sm">
            <MapPin size={14} />
            {location}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
