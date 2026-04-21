import { useEffect, useRef, useState } from 'react';

interface UseHorizontalScrollProps {
  speed?: number; // Pixels per frame
  autoScroll?: boolean;
}

export function useHorizontalScroll({ speed = 0.5, autoScroll = true }: UseHorizontalScrollProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const scrollRequestRef = useRef<number>(0);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;

    const scroll = () => {
      if (containerRef.current && !isHovered) {
        containerRef.current.scrollLeft += speed;
        
        // Loop scroll if reached the end (optional, but good for "infinite" feel)
        const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 1) {
          containerRef.current.scrollLeft = 0;
        }
      }
      scrollRequestRef.current = requestAnimationFrame(scroll);
    };

    scrollRequestRef.current = requestAnimationFrame(scroll);

    return () => {
      if (scrollRequestRef.current) {
        cancelAnimationFrame(scrollRequestRef.current);
      }
    };
  }, [autoScroll, isHovered, speed]);

  const onMouseEnter = () => setIsHovered(true);
  const onMouseLeave = () => setIsHovered(false);

  return {
    containerRef,
    onMouseEnter,
    onMouseLeave
  };
}
