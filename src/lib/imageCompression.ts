/**
 * Client-side image compression utility
 * Compresses images before upload to reduce bandwidth and storage
 */

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
}

export interface CompressedImage {
    file: File;
    originalSize: number;
    compressedSize: number;
    width: number;
    height: number;
}

/**
 * Compress an image file
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<CompressedImage> {
    const {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 0.85,
        mimeType = 'image/jpeg',
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                try {
                    const { width, height } = calculateDimensions(img.width, img.height, maxWidth, maxHeight);

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Use better image smoothing
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }

                            // Create new file from blob
                            const compressedFile = new File(
                                [blob],
                                file.name.replace(/\.[^/.]+$/, '.jpg'), // Change extension to .jpg
                                {
                                    type: mimeType,
                                    lastModified: Date.now(),
                                }
                            );

                            resolve({
                                file: compressedFile,
                                originalSize: file.size,
                                compressedSize: blob.size,
                                width,
                                height,
                            });
                        },
                        mimeType,
                        quality
                    );
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = event.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // Scale down if larger than max dimensions
    if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
    }

    if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
    }

    return {
        width: Math.round(width),
        height: Math.round(height),
    };
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
    files: File[],
    options: CompressionOptions = {},
    onProgress?: (completed: number, total: number) => void
): Promise<CompressedImage[]> {
    const results: CompressedImage[] = [];
    let completed = 0;

    const compressionPromises = files.map(async (file) => {
        try {
            const compressed = await compressImage(file, options);
            results.push(compressed);
            completed++;
            onProgress?.(completed, files.length);
            return compressed;
        } catch (error) {
            console.error(`Failed to compress ${file.name}:`, error);
            // Return original file if compression fails
            const fallback: CompressedImage = {
                file,
                originalSize: file.size,
                compressedSize: file.size,
                width: 0,
                height: 0,
            };
            results.push(fallback);
            completed++;
            onProgress?.(completed, files.length);
            return fallback;
        }
    });

    await Promise.all(compressionPromises);
    return results;
}

/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const img = new Image();

            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                });
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = event.target?.result as string;
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}
