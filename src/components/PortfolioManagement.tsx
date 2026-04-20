import { Check, GripVertical, Heart, ImagePlus, Loader, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface PortfolioImage {
  id: string;
  photographer_id: string;
  image_url: string;
  title: string;
  description: string;
  category: string;
  likes: number;
  views: number;
  display_order: number;
  created_at: string;
}

interface PortfolioManagementProps {
  images: PortfolioImage[];
  onRefresh: () => void;
}

const CATEGORIES = ['Weddings', 'Portraits', 'Events', 'Pre-Wedding', 'Engagement', 'Other'];

export function PortfolioManagement({ images = [], onRefresh }: PortfolioManagementProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ file: string; done: boolean }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [captionCategory, setCaptionCategory] = useState('Weddings');
  const [savingCaption, setSavingCaption] = useState(false);

  const maxImages = 50;
  const canUpload = images.length < maxImages;

  // ─── Upload Logic ─────────────────────────────────────
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!user || !canUpload) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const allowed = imageFiles.slice(0, maxImages - images.length);
    setUploading(true);
    setUploadProgress(allowed.map(f => ({ file: f.name, done: false })));

    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i];
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/portfolio/${Date.now()}_${i}.${ext}`;

        // Upload to storage
        const { error: storageError } = await supabase.storage
          .from('photos')
          .upload(fileName, file, { upsert: false });

        if (storageError) {
          console.error('Storage upload error:', storageError);
          alert(`Storage upload error: ${storageError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        // Insert into portfolio_images
        const { error: dbError } = await supabase
          .from('portfolio_images')
          .insert({
            photographer_id: user.id,
            image_url: urlData.publicUrl,
            title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            category: 'Weddings',
            display_order: images.length + i,
          });

        if (dbError) {
          console.error('DB insert error:', dbError);
          alert(`DB insert error: ${dbError.message}`);
          continue;
        }

        setUploadProgress(prev =>
          prev.map((p, idx) => idx === i ? { ...p, done: true } : p)
        );
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    setUploading(false);
    setUploadProgress([]);
    onRefresh();
  }, [user, images.length, canUpload, onRefresh]);

  // ─── Drag & Drop ──────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  // ─── Delete ───────────────────────────────────────────
  const handleDelete = async (image: PortfolioImage) => {
    if (!window.confirm('Delete this image from your portfolio?')) return;
    setDeletingId(image.id);
    try {
      // Delete from storage
      const path = image.image_url.split('/photos/')[1];
      if (path) {
        await supabase.storage.from('photos').remove([decodeURIComponent(path)]);
      }
      // Delete from DB
      await supabase.from('portfolio_images').delete().eq('id', image.id);
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
      if (lightboxImage?.id === image.id) setLightboxImage(null);
    }
  };

  // ─── Save Caption ─────────────────────────────────────
  const handleSaveCaption = async () => {
    if (!lightboxImage) return;
    setSavingCaption(true);
    try {
      await supabase
        .from('portfolio_images')
        .update({ title: captionText, category: captionCategory })
        .eq('id', lightboxImage.id);
      setEditingCaption(false);
      setLightboxImage({ ...lightboxImage, title: captionText, category: captionCategory });
      onRefresh();
    } catch (err) {
      console.error('Save caption error:', err);
    } finally {
      setSavingCaption(false);
    }
  };

  // ─── Filtered Images ─────────────────────────────────
  const filteredImages = selectedCategory === 'All'
    ? images
    : images.filter(img => img.category === selectedCategory);

  // ─── Open Lightbox ────────────────────────────────────
  const openLightbox = (image: PortfolioImage) => {
    setLightboxImage(image);
    setCaptionText(image.title || '');
    setCaptionCategory(image.category || 'Weddings');
    setEditingCaption(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Upload Area ──────────────────────────────── */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => canUpload && fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer transition-all duration-300',
          dragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-low',
          !canUpload && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-4 py-4">
            <Loader size={32} className="mx-auto animate-spin text-primary" />
            <p className="text-sm font-bold text-on-surface">Uploading your work...</p>
            <div className="max-w-xs mx-auto space-y-2">
              {uploadProgress.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={cn(
                    'w-4 h-4 rounded-full flex items-center justify-center transition-all',
                    p.done ? 'bg-green-500 text-white' : 'bg-outline-variant/20'
                  )}>
                    {p.done && <Check size={10} />}
                  </div>
                  <span className={cn(
                    'truncate',
                    p.done ? 'text-green-700 line-through' : 'text-on-surface-variant'
                  )}>{p.file}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <ImagePlus size={28} className="text-primary" />
            </div>
            <p className="text-lg font-bold text-on-surface mb-1">
              {dragActive ? 'Drop your photos here' : 'Upload Portfolio Photos'}
            </p>
            <p className="text-sm text-on-surface-variant mb-3">
              Drag & drop or click to select • JPG, PNG, WebP, HEIC • Max 10MB each
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-full text-sm font-bold">
              <Upload size={16} />
              Select Photos
            </div>
            <p className="text-xs text-on-surface-variant/60 mt-3">
              {images.length}/{maxImages} images uploaded
            </p>
          </div>
        )}
      </div>

      {/* ── Category Filter ──────────────────────────── */}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['All', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all',
                selectedCategory === cat
                  ? 'bg-on-surface text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Instagram-Style Grid ─────────────────────── */}
      {filteredImages.length === 0 && images.length > 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          No images in this category yet.
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-container-low flex items-center justify-center">
            <ImagePlus size={40} className="text-on-surface-variant/40" />
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">Your portfolio is empty</h3>
          <p className="text-on-surface-variant max-w-md mx-auto">
            Upload your best wedding and event photography to showcase your skills. Clients will see these images on your profile.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-1.5 rounded-2xl overflow-hidden">
          {filteredImages.map((image, idx) => {
            // Instagram-style: every 5th image spans 2 cols for variety
            const isFeature = idx % 5 === 0 && idx < filteredImages.length - 1;

            return (
              <div
                key={image.id}
                className={cn(
                  'group relative aspect-square overflow-hidden cursor-pointer bg-surface-container-low',
                  isFeature && 'md:col-span-2 md:row-span-2'
                )}
                onClick={() => openLightbox(image)}
              >
                <img
                  src={image.image_url}
                  alt={image.title || 'Portfolio'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                  {/* Quick Actions */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(image); }}
                      className="p-2 bg-black/40 backdrop-blur-sm text-white rounded-full hover:bg-red-500 transition-all"
                      title="Delete"
                    >
                      {deletingId === image.id
                        ? <Loader size={16} className="animate-spin" />
                        : <Trash2 size={16} />
                      }
                    </button>
                  </div>

                  {/* Bottom Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm truncate">
                          {image.title || 'Untitled'}
                        </p>
                        <p className="text-white/60 text-xs">{image.category}</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/80 text-xs">
                        <Heart size={14} />
                        <span>{image.likes || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drag Handle */}
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-1.5 bg-black/40 backdrop-blur-sm text-white rounded-full">
                    <GripVertical size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lightbox / Detail View ───────────────────── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/40 backdrop-blur-sm text-white rounded-full hover:bg-black/60 transition-all"
            >
              <X size={20} />
            </button>

            {/* Image */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[500px]">
              <img
                src={lightboxImage.image_url}
                alt={lightboxImage.title}
                className="max-w-full max-h-[70vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Details Panel */}
            <div className="w-full md:w-80 p-6 flex flex-col bg-white">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/10">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  You
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Your Portfolio</p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(lightboxImage.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {editingCaption ? (
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Caption</label>
                    <input
                      type="text"
                      value={captionText}
                      onChange={(e) => setCaptionText(e.target.value)}
                      placeholder="Add a caption..."
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Category</label>
                    <select
                      value={captionCategory}
                      onChange={(e) => setCaptionCategory(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCaption(false)}
                      className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCaption}
                      disabled={savingCaption}
                      className="flex-1 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {savingCaption ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-on-surface text-sm mb-2">
                    <span className="font-bold">{lightboxImage.title || 'Untitled'}</span>
                  </p>
                  <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
                    {lightboxImage.category || 'Uncategorized'}
                  </span>

                  <div className="flex items-center gap-6 text-on-surface-variant text-sm py-4 border-t border-outline-variant/10">
                    <div className="flex items-center gap-1.5">
                      <Heart size={16} />
                      <span>{lightboxImage.likes || 0} likes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>👁 {lightboxImage.views || 0} views</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => setEditingCaption(true)}
                  className="flex-1 py-3 text-sm font-bold text-on-surface bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-all"
                >
                  Edit Caption
                </button>
                <button
                  onClick={() => handleDelete(lightboxImage)}
                  className="py-3 px-4 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tips ──────────────────────────────────────── */}
      {images.length > 0 && (
        <div className="bg-surface-container-low rounded-2xl p-5 text-sm text-on-surface-variant flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <strong className="text-on-surface">Pro Tip:</strong> Your first photo is used as your profile cover on the marketplace. 
            Click any image to edit its caption or category. High-quality wedding shots get the most engagement!
          </div>
        </div>
      )}
    </div>
  );
}
