import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Check, ChevronLeft, Globe, Instagram, Facebook, Mail, Phone, Palette,
  Droplets, Type, Image as ImageIcon, Save, Upload, Eye, Sparkles
} from 'lucide-react';
import { drawTextWatermark, drawLogoWatermark, drawLogoTextWatermark, loadImage } from '../lib/watermarkUtils';
import type { WatermarkConfig } from '../lib/watermarkUtils';

const SERVICE_OPTIONS = [
  'Wedding Photography', 'Pre-Wedding Shoots', 'Reception Coverage',
  'Candid Photography', 'Cinematography', 'Drone Coverage',
  'Photo Albums', 'Photo Booth', 'Destination Weddings',
];

const SAMPLE_PHOTO = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80';

export function StudioBrandingSettings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  // Branding form state
  const [form, setForm] = useState({
    studio_name: '',
    tagline: '',
    logo_url: '',
    brand_color_primary: '#FF6B6B',
    brand_color_secondary: '#1A1F3A',
    watermark_type: 'text' as 'text' | 'logo' | 'logo_text',
    watermark_position: 'bottom_right' as 'bottom_right' | 'bottom_left' | 'center',
    watermark_opacity: 30,
    watermark_size: 'medium' as 'small' | 'medium' | 'large',
    contact_phone: '',
    contact_email: '',
    website_url: '',
    instagram_handle: '',
    facebook_url: '',
    services_offered: [] as string[],
  });

  // Watermark preview
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    fetchBranding();
  }, [user]);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('photographer_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setForm(prev => ({
          ...prev,
          studio_name: data.studio_name || '',
          tagline: data.tagline || '',
          logo_url: data.logo_url || '',
          brand_color_primary: data.brand_color_primary || '#FF6B6B',
          brand_color_secondary: data.brand_color_secondary || '#1A1F3A',
          watermark_type: data.watermark_type || 'text',
          watermark_position: data.watermark_position || 'bottom_right',
          watermark_opacity: data.watermark_opacity ?? 30,
          watermark_size: data.watermark_size || 'medium',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
          website_url: data.website_url || '',
          instagram_handle: data.instagram_handle || '',
          facebook_url: data.facebook_url || '',
          services_offered: data.services_offered || [],
        }));
      }
    } catch (err: any) {
      console.error('Error fetching branding:', err);
      setMessage({ text: 'Error loading branding data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('studio-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('studio-logos')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
      setMessage({ text: 'Logo uploaded!', type: 'success' });
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setMessage({ text: 'Failed to upload logo.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const toggleService = (service: string) => {
    setForm(prev => {
      const has = prev.services_offered.includes(service);
      return {
        ...prev,
        services_offered: has
          ? prev.services_offered.filter(s => s !== service)
          : [...prev.services_offered, service],
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase
        .from('photographer_profiles')
        .upsert({
          id: user.id,
          studio_name: form.studio_name || null,
          tagline: form.tagline || null,
          logo_url: form.logo_url || null,
          brand_color_primary: form.brand_color_primary,
          brand_color_secondary: form.brand_color_secondary,
          watermark_type: form.watermark_type,
          watermark_position: form.watermark_position,
          watermark_opacity: form.watermark_opacity,
          watermark_size: form.watermark_size,
          contact_phone: form.contact_phone || null,
          contact_email: form.contact_email || null,
          website_url: form.website_url || null,
          instagram_handle: form.instagram_handle || null,
          facebook_url: form.facebook_url || null,
          services_offered: form.services_offered,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setMessage({ text: 'Branding saved successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setMessage({ text: 'Error saving branding.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Watermark preview renderer
  const renderPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const img = await loadImage(SAMPLE_PHOTO);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const config: WatermarkConfig = {
        type: form.watermark_type,
        position: form.watermark_position,
        opacity: form.watermark_opacity,
        size: form.watermark_size,
      };

      const name = form.studio_name || 'Your Studio Name';

      if (form.watermark_type === 'logo' && form.logo_url) {
        const logo = await loadImage(form.logo_url);
        drawLogoWatermark(ctx, logo, img.width, img.height, config);
      } else if (form.watermark_type === 'logo_text' && form.logo_url) {
        const logo = await loadImage(form.logo_url);
        drawLogoTextWatermark(ctx, name, logo, img.width, img.height, config);
      } else {
        drawTextWatermark(ctx, name, img.width, img.height, config);
      }
    } catch (err) {
      console.error('Preview render error:', err);
    }
  }, [form.watermark_type, form.watermark_position, form.watermark_opacity, form.watermark_size, form.studio_name, form.logo_url]);

  useEffect(() => {
    if (!loading) renderPreview();
  }, [renderPreview, loading]);

  if (loading) {
    return (
      <div className="pt-24 pb-20 min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 bg-surface min-h-screen">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white silk-shadow hover:bg-surface-container-low transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-on-surface">Studio Branding</h1>
            <p className="text-on-surface-variant text-sm mt-1">Customize how your brand appears on galleries and client-facing pages</p>
          </div>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`p-4 rounded-2xl mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <Check size={18} /> : null}
            {message.text}
          </div>
        )}

        {/* === SECTION 1: Studio Profile === */}
        <section className="bg-white rounded-[2rem] p-6 md:p-8 silk-shadow border border-outline-variant/5 mb-6">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <Camera size={22} className="text-primary" /> Studio Profile
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Studio Name</label>
              <input name="studio_name" value={form.studio_name} onChange={handleChange} placeholder="e.g. Raj Photography"
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Tagline</label>
              <input name="tagline" value={form.tagline} onChange={handleChange} placeholder="e.g. Capturing Forever Moments"
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
          </div>
        </section>

        {/* === SECTION 2: Brand Identity === */}
        <section className="bg-white rounded-[2rem] p-6 md:p-8 silk-shadow border border-outline-variant/5 mb-6">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <Palette size={22} className="text-primary" /> Brand Identity
          </h2>
          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Studio Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant/30 flex items-center justify-center overflow-hidden bg-surface-container-low">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon size={32} className="text-on-surface-variant/40" />
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-xl font-bold text-sm cursor-pointer hover:bg-primary/20 transition-colors">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-on-surface-variant mt-2">PNG, JPG, SVG • Max 2MB</p>
                </div>
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" name="brand_color_primary" value={form.brand_color_primary} onChange={handleChange}
                    className="w-12 h-12 rounded-xl border-2 border-outline-variant/20 cursor-pointer" />
                  <input type="text" value={form.brand_color_primary} onChange={e => setForm(p => ({ ...p, brand_color_primary: e.target.value }))}
                    className="flex-1 bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 font-mono text-sm uppercase" maxLength={7} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" name="brand_color_secondary" value={form.brand_color_secondary} onChange={handleChange}
                    className="w-12 h-12 rounded-xl border-2 border-outline-variant/20 cursor-pointer" />
                  <input type="text" value={form.brand_color_secondary} onChange={e => setForm(p => ({ ...p, brand_color_secondary: e.target.value }))}
                    className="flex-1 bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 font-mono text-sm uppercase" maxLength={7} />
                </div>
              </div>
            </div>

            {/* Preview Swatch */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Preview:</span>
              <div className="flex gap-2">
                <div className="w-16 h-8 rounded-lg" style={{ backgroundColor: form.brand_color_primary }}></div>
                <div className="w-16 h-8 rounded-lg" style={{ backgroundColor: form.brand_color_secondary }}></div>
                <div className="w-16 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${form.brand_color_primary}, ${form.brand_color_secondary})` }}></div>
              </div>
            </div>
          </div>
        </section>

        {/* === SECTION 3: Watermark Settings === */}
        <section className="bg-white rounded-[2rem] p-6 md:p-8 silk-shadow border border-outline-variant/5 mb-6">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <Droplets size={22} className="text-primary" /> Watermark Settings
          </h2>
          <div className="space-y-6">
            {/* Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">Watermark Type</label>
              <div className="flex flex-wrap gap-3">
                {(['text', 'logo', 'logo_text'] as const).map(type => (
                  <button key={type} onClick={() => setForm(p => ({ ...p, watermark_type: type }))}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${form.watermark_type === type ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:border-primary/50'}`}>
                    {type === 'text' ? '📝 Studio Name' : type === 'logo' ? '🖼️ Logo Only' : '🏷️ Logo + Name'}
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Position</label>
              <select name="watermark_position" value={form.watermark_position} onChange={handleChange}
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20">
                <option value="bottom_right">Bottom Right</option>
                <option value="bottom_left">Bottom Left</option>
                <option value="center">Center</option>
              </select>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Opacity: {form.watermark_opacity}%
              </label>
              <input type="range" min="10" max="60" step="5" value={form.watermark_opacity}
                onChange={e => setForm(p => ({ ...p, watermark_opacity: parseInt(e.target.value) }))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-on-surface-variant/50 font-bold mt-1">
                <span>Subtle</span><span>Bold</span>
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Size</label>
              <select name="watermark_size" value={form.watermark_size} onChange={handleChange}
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            {/* Live Preview */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                <Eye size={14} className="inline mr-1" /> Live Preview
              </label>
              <div className="rounded-2xl overflow-hidden border border-outline-variant/10">
                <canvas ref={previewCanvasRef} className="w-full h-auto" />
              </div>
            </div>
          </div>
        </section>

        {/* === SECTION 4: Contact Information === */}
        <section className="bg-white rounded-[2rem] p-6 md:p-8 silk-shadow border border-outline-variant/5 mb-6">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <Phone size={22} className="text-primary" /> Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                <input name="contact_phone" value={form.contact_phone} onChange={handleChange} placeholder="+91 98765 43210"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                <input name="contact_email" value={form.contact_email} onChange={handleChange} placeholder="contact@studio.com"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Website</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                <input name="website_url" value={form.website_url} onChange={handleChange} placeholder="www.yourstudio.com"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Instagram</label>
              <div className="relative">
                <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                <input name="instagram_handle" value={form.instagram_handle} onChange={handleChange} placeholder="@yourstudio"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Facebook</label>
              <div className="relative">
                <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
                <input name="facebook_url" value={form.facebook_url} onChange={handleChange} placeholder="facebook.com/yourstudio"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>
        </section>

        {/* === SECTION 5: Services === */}
        <section className="bg-white rounded-[2rem] p-6 md:p-8 silk-shadow border border-outline-variant/5 mb-8">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mb-6">
            <Sparkles size={22} className="text-primary" /> Services Offered
          </h2>
          <div className="flex flex-wrap gap-3">
            {SERVICE_OPTIONS.map(service => (
              <button key={service} onClick={() => toggleService(service)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${form.services_offered.includes(service) ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:border-primary/50'}`}>
                {service}
              </button>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mb-12">
          <button onClick={() => navigate(-1)}
            className="px-8 py-3 rounded-full font-bold text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-low transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 signature-gradient text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-60">
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </div>
    </div>
  );
}
