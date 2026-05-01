import { ChevronLeft, ChevronRight, Download, Heart, Share2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../lib/utils';

interface PortfolioImage {
  id: string;
  image_url: string;
  title?: string;
  description?: string;
  display_order: number;
  category?: string;
  likes?: number;
  views?: number;
  created_at: string;
}

interface PortfolioGalleryProps {
  images: PortfolioImage[];
  photographerName: string;
  photographerStyles: string[];
  isLoading?: boolean;
}

export function PortfolioGallery({
  images,
  photographerName,
  photographerStyles,
  isLoading = false,
}: PortfolioGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set(images.map(img => img.category).filter(Boolean));
    return Array.from(cats);
  }, [images]);

  const filteredImages = useMemo(() => {
    if (!selectedCategory) return images;
    return images.filter(img => img.category === selectedCategory);
  }, [images, selectedCategory]);

  const toggleLike = (imageId: string) => {
    setLikedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) newSet.delete(imageId);
      else newSet.add(imageId);
      return newSet;
    });
  };

  const handlePrevious = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex - 1 + filteredImages.length) % filteredImages.length);
  };

  const handleNext = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex + 1) % filteredImages.length);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') setSelectedImageIndex(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-1.5 rounded-2xl overflow-hidden">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square bg-surface-container-low animate-pulse" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-bold text-on-surface mb-2">No portfolio images yet</p>
        <p className="text-on-surface-variant">Check back soon for {photographerName}'s portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all',
                selectedCategory === null
                  ? 'bg-on-surface text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              All ({images.length})
            </button>
            {categories.map(category => {
              const count = images.filter(img => img.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all',
                    selectedCategory === category
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  )}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Instagram-Style Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-1.5 rounded-2xl overflow-hidden">
        {filteredImages.map((image, index) => {
          const isFeature = index % 5 === 0 && index < filteredImages.length - 1;
          const isLiked = likedImages.has(image.id);

          return (
            <div
              key={image.id}
              className={cn(
                'group relative aspect-square overflow-hidden cursor-pointer bg-surface-container-low',
                isFeature && 'md:col-span-2 md:row-span-2'
              )}
              onClick={() => setSelectedImageIndex(index)}
            >
              <img
                src={image.image_url}
                alt={image.title || `Portfolio ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                {/* Like Button */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(image.id);
                    }}
                    className={cn(
                      'p-2.5 rounded-full backdrop-blur-sm transition-all',
                      isLiked
                        ? 'bg-red-500/80 text-white'
                        : 'bg-black/30 text-white hover:bg-black/50'
                    )}
                  >
                    <Heart size={18} className={isLiked ? 'fill-current' : ''} />
                  </button>
                </div>

                {/* Bottom Info */}
                <div>
                  {image.title && (
                    <p className="text-white font-bold text-sm truncate">{image.title}</p>
                  )}
                  {image.category && (
                    <p className="text-white/60 text-xs">{image.category}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setSelectedImageIndex(null)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close */}
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
          >
            <X size={28} />
          </button>

          {/* Main Image */}
          <div
            className="max-w-5xl w-full h-full flex items-center justify-center p-4 md:p-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filteredImages[selectedImageIndex]?.image_url}
              alt={filteredImages[selectedImageIndex]?.title || 'Portfolio'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Navigation Arrows */}
          {filteredImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-white font-bold">
                  {filteredImages[selectedImageIndex]?.title || `Photo ${selectedImageIndex + 1}`}
                </p>
                <p className="text-white/50 text-sm">
                  {selectedImageIndex + 1} of {filteredImages.length} • by {photographerName}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(filteredImages[selectedImageIndex]?.id);
                  }}
                  className={cn(
                    'p-2.5 rounded-full backdrop-blur-sm transition-all',
                    likedImages.has(filteredImages[selectedImageIndex]?.id)
                      ? 'bg-red-500/60 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  )}
                >
                  <Heart
                    size={20}
                    className={likedImages.has(filteredImages[selectedImageIndex]?.id) ? 'fill-current' : ''}
                  />
                </button>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-all"
                >
                  <Share2 size={20} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(filteredImages[selectedImageIndex]?.image_url, '_blank');
                  }}
                  className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-all"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

