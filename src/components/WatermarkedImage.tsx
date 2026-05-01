import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  drawTextWatermark,
  drawLogoWatermark,
  drawLogoTextWatermark,
  loadImage,
  type WatermarkConfig,
} from '../lib/watermarkUtils';

interface WatermarkedImageProps {
  imageUrl: string;
  studioName?: string | null;
  logoUrl?: string | null;
  watermarkConfig?: Partial<WatermarkConfig>;
  alt?: string;
  className?: string;
  onClick?: () => void;
  /** Children rendered on top of the canvas (overlays, badges, etc.) */
  children?: React.ReactNode;
  onError?: () => void;
}

/**
 * Renders a photo with a client-side Canvas watermark overlay.
 * Falls back to a regular <img> if no branding data is provided.
 */
export function WatermarkedImage({
  imageUrl,
  studioName,
  logoUrl,
  watermarkConfig,
  alt = 'Photo',
  className = '',
  onClick,
  children,
}: WatermarkedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const hasWatermark = studioName || (logoUrl && watermarkConfig?.type !== 'text');

  const config: WatermarkConfig = {
    type: watermarkConfig?.type || 'text',
    position: watermarkConfig?.position || 'bottom_right',
    opacity: watermarkConfig?.opacity ?? 30,
    size: watermarkConfig?.size || 'medium',
    color: watermarkConfig?.color || '#FFFFFF',
  };

  const renderWatermark = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasWatermark) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const img = await loadImage(imageUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      setDimensions({ width: img.width, height: img.height });

      // Draw the base image
      ctx.drawImage(img, 0, 0);

      // Apply watermark based on type
      if (config.type === 'logo' && logoUrl) {
        const logo = await loadImage(logoUrl);
        drawLogoWatermark(ctx, logo, img.width, img.height, config);
      } else if (config.type === 'logo_text' && logoUrl && studioName) {
        const logo = await loadImage(logoUrl);
        drawLogoTextWatermark(ctx, studioName, logo, img.width, img.height, config);
      } else if (studioName) {
        drawTextWatermark(ctx, studioName, img.width, img.height, config);
      }

      setLoaded(true);
    } catch (err) {
      console.error('[WatermarkedImage] Render failed:', err);
      setLoaded(false);
      onError?.();
    }
  }, [imageUrl, studioName, logoUrl, config.type, config.position, config.opacity, config.size, config.color]);

  useEffect(() => {
    if (hasWatermark) {
      renderWatermark();
    }
  }, [renderWatermark, hasWatermark]);

  // If no watermark data, just render a regular image
  if (!hasWatermark) {
    return (
      <div ref={containerRef} className={`relative ${className}`} onClick={onClick}>
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto object-cover"
          loading="lazy"
          onError={onError}
        />
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} onClick={onClick}>
      {/* Show a blurred placeholder until the canvas renders */}
      {!loaded && (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto object-cover blur-[2px]"
          loading="lazy"
        />
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-auto object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        style={loaded ? {} : { position: 'absolute', top: 0, left: 0 }}
      />
      {children}
    </div>
  );
}

