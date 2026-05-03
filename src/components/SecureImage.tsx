import React, { useEffect, useRef, useState } from 'react';
import { injectInvisibleWatermark } from '../lib/securityEngine';

interface SecureImageProps {
  src: string;
  alt: string;
  className?: string;
  watermarkText?: string;
  isProtected?: boolean;
  onError?: () => void;
  branding?: any;
}

export function SecureImage({ src, alt, className, watermarkText, isProtected = true, onError, branding }: SecureImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isBlackout, setIsBlackout] = useState(false);

  useEffect(() => {
    if (!isProtected) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    let animationFrame: number;
    let frameCount = 0;

    const render = () => {
      if (isBlackout) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animationFrame = requestAnimationFrame(render);
        return;
      }

      // SECURITY FLICKER
      frameCount++;
      if (frameCount % 120 === 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setTimeout(() => { frameCount++; }, 16); 
        animationFrame = requestAnimationFrame(render);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Invisible tracking watermark
      if (watermarkText) {
        injectInvisibleWatermark(ctx, canvas.width, canvas.height, watermarkText);
      }

      // Visible Watermark Based on Branding
      ctx.save();
      
      const wmOpacity = branding?.watermark_opacity ? branding.watermark_opacity / 100 : 0.08;
      // Use studio name if set, fallback to guest email, fallback to PIXVORA
      const wmText = branding?.studio_name || watermarkText || 'PIXVORA PROTECTED';
      
      ctx.globalAlpha = wmOpacity;
      ctx.fillStyle = '#FFFFFF';
      
      // Handle size relative to the canvas width so it's always visible regardless of resolution
      let fontSizeScale = 0.03; // Default 3% of width
      if (branding?.watermark_size === 'small') fontSizeScale = 0.015;
      if (branding?.watermark_size === 'large') fontSizeScale = 0.06;
      
      const fontSize = Math.max(14, canvas.width * fontSizeScale);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;

      const drawWatermark = (x: number, y: number) => {
        // Shadow for visibility
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(wmText, x, y);
      };

      if (branding?.watermark_position === 'center') {
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         drawWatermark(canvas.width / 2, canvas.height / 2);
      } else if (branding?.watermark_position === 'top_left') {
         ctx.textAlign = 'left';
         ctx.textBaseline = 'top';
         drawWatermark(20, 20);
      } else if (branding?.watermark_position === 'top_right') {
         ctx.textAlign = 'right';
         ctx.textBaseline = 'top';
         drawWatermark(canvas.width - 20, 20);
      } else if (branding?.watermark_position === 'bottom_left') {
         ctx.textAlign = 'left';
         ctx.textBaseline = 'bottom';
         drawWatermark(20, canvas.height - 20);
      } else if (branding?.watermark_position === 'bottom_right') {
         ctx.textAlign = 'right';
         ctx.textBaseline = 'bottom';
         drawWatermark(canvas.width - 20, canvas.height - 20);
      } else {
         // Default tiled
         ctx.rotate(-Math.PI / 4);
         for (let i = -canvas.width; i < canvas.width * 2; i += 200) {
           for (let j = -canvas.height; j < canvas.height * 2; j += 100) {
             drawWatermark(i, j);
           }
         }
      }
      ctx.restore();

      // FLOATING FORENSIC ID (Randomly jumps to prevent removal)
      if (frameCount % 60 === 0) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px monospace';
        ctx.fillText(watermarkText?.substring(0, 8) || 'SECURE', x, y);
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(render);
    };

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setLoading(false);
      render();
    };

    img.onerror = () => {
      setError(true);
      setLoading(false);
      onError?.();
    };

    // Aggressive focus check inside the render loop's context
    const focusCheck = setInterval(() => {
      if (!document.hasFocus()) setIsBlackout(true);
      else setIsBlackout(false);
    }, 50);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(focusCheck);
    };
  }, [src, isProtected, watermarkText, isBlackout, branding]);

  if (!isProtected) {
    return <img src={src} alt={alt} className={className} onError={onError} />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      
      {error ? (
        <div className="text-white/20 text-xs italic">Failed to load secure asset</div>
      ) : (
        <canvas
          ref={canvasRef}
          className={className}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none', // Block all mouse interaction with the actual image
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      
      {/* Invisible shield overlay to capture any rogue right-clicks or drag attempts */}
      <div 
        className="absolute inset-0 z-10 cursor-default" 
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}

