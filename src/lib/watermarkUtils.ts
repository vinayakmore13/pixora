/**
 * Watermark Utilities
 * Client-side Canvas-based watermark rendering for photographer branding.
 */

export interface WatermarkConfig {
  type: 'text' | 'logo' | 'logo_text';
  position: 'bottom_right' | 'bottom_left' | 'center';
  opacity: number; // 10-60
  size: 'small' | 'medium' | 'large';
  color?: string; // defaults to white
}

export interface BrandingData {
  studio_name: string | null;
  logo_url: string | null;
  brand_color_primary: string;
  brand_color_secondary: string;
  watermark_type: string;
  watermark_position: string;
  watermark_opacity: number;
  watermark_size: string;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  tagline: string | null;
  services_offered: string[];
}

const SIZE_MULTIPLIER: Record<string, number> = {
  small: 0.015,
  medium: 0.025,
  large: 0.035,
};

/**
 * Draw a text watermark on a canvas context.
 */
export function drawTextWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  imgWidth: number,
  imgHeight: number,
  config: WatermarkConfig
) {
  const fontSize = Math.max(12, Math.floor(imgWidth * (SIZE_MULTIPLIER[config.size] || 0.025)));
  const color = config.color || '#FFFFFF';
  const alpha = config.opacity / 100;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${fontSize}px 'Inter', 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = fontSize * 0.3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  const metrics = ctx.measureText(text);
  const padding = fontSize * 1.2;
  const { x, y } = getPosition(config.position, imgWidth, imgHeight, metrics.width, fontSize, padding);

  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw a logo watermark on a canvas context. Returns a promise because the logo image needs to load.
 */
export function drawLogoWatermark(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement,
  imgWidth: number,
  imgHeight: number,
  config: WatermarkConfig
): void {
  const alpha = config.opacity / 100;
  const maxLogoWidth = imgWidth * (SIZE_MULTIPLIER[config.size] || 0.025) * 6;
  const scale = Math.min(maxLogoWidth / logoImg.width, 1);
  const logoW = logoImg.width * scale;
  const logoH = logoImg.height * scale;
  const padding = logoW * 0.4;
  const { x, y } = getPosition(config.position, imgWidth, imgHeight, logoW, logoH, padding);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.drawImage(logoImg, x, y - logoH, logoW, logoH);
  ctx.restore();
}

/**
 * Draw both logo and text watermark.
 */
export function drawLogoTextWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  logoImg: HTMLImageElement,
  imgWidth: number,
  imgHeight: number,
  config: WatermarkConfig
): void {
  const fontSize = Math.max(12, Math.floor(imgWidth * (SIZE_MULTIPLIER[config.size] || 0.025)));
  const alpha = config.opacity / 100;
  const color = config.color || '#FFFFFF';

  const maxLogoWidth = imgWidth * (SIZE_MULTIPLIER[config.size] || 0.025) * 5;
  const scale = Math.min(maxLogoWidth / logoImg.width, 1);
  const logoW = logoImg.width * scale;
  const logoH = logoImg.height * scale;

  const totalHeight = logoH + fontSize + 8;
  const totalWidth = Math.max(logoW, ctx.measureText?.(text)?.width || logoW);
  const padding = fontSize * 1.2;

  const { x, y } = getPosition(config.position, imgWidth, imgHeight, totalWidth, totalHeight, padding);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;

  // Draw logo
  const logoX = config.position === 'center' ? x + (totalWidth - logoW) / 2 : x;
  ctx.drawImage(logoImg, logoX, y - totalHeight, logoW, logoH);

  // Draw text below logo
  ctx.font = `bold ${fontSize}px 'Inter', 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom';
  const textX = config.position === 'center' ? x + totalWidth / 2 : x;
  ctx.textAlign = config.position === 'center' ? 'center' : 'left';
  ctx.fillText(text, textX, y);

  ctx.restore();
}

/**
 * Compute x/y coordinates based on position preset.
 */
function getPosition(
  position: string,
  imgWidth: number,
  imgHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding: number
): { x: number; y: number } {
  switch (position) {
    case 'bottom_left':
      return { x: padding, y: imgHeight - padding };
    case 'center':
      return {
        x: (imgWidth - contentWidth) / 2,
        y: (imgHeight + contentHeight) / 2,
      };
    case 'bottom_right':
    default:
      return {
        x: imgWidth - contentWidth - padding,
        y: imgHeight - padding,
      };
  }
}

/**
 * Load an image from a URL, returns a promise with the HTMLImageElement.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
