import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Save, Plus, Trash2, Camera, Upload, Palette, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export function EditPhotographerProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Profile data
  const [profile, setProfile] = useState({
    bio: '',
    location: '',
    experience_years: 0,
    price_starts_at: 0,
    cover_photo_url: '',
    styles: [] as string[],
    languages: [] as string[]
  });

  // Packages
  const [packages, setPackages] = useState<any[]>([]);
  
  // Style options
  const styleOptions = ["Editorial", "Candid", "Traditional", "Cinematic", "Fine Art", "Classic", "Documentary"];
  
  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    
    // Ensure the user is a photographer. The app routes should handle it but we double check.
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('photographer_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
        
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }
      
      if (profileData) {
        setProfile({
          bio: profileData.bio || '',
          location: profileData.location || '',
          experience_years: profileData.experience_years || 0,
          price_starts_at: profileData.price_starts_at || 0,
          cover_photo_url: profileData.cover_photo_url || '',
          styles: profileData.styles || [],
          languages: profileData.languages || []
        });
      }

      // Fetch packages
      const { data: packsData, error: packsError } = await supabase
        .from('packages')
        .select('*')
        .eq('photographer_id', user?.id)
        .order('price', { ascending: true });
        
      if (packsError) throw packsError;
      if (packsData) setPackages(packsData);
      
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      setMessage({ text: 'Error loading profile data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleStyleToggle = (style: string) => {
    setProfile(prev => {
      const isSelected = prev.styles.includes(style);
      if (isSelected) {
        return { ...prev, styles: prev.styles.filter(s => s !== style) };
      } else {
        return { ...prev, styles: [...prev.styles, style] };
      }
    });
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      setSaving(true);
      setMessage({ text: '', type: '' });
      
      const { error } = await supabase
        .from('photographer_profiles')
        .upsert({
          id: user.id,
          bio: profile.bio,
          location: profile.location,
          experience_years: parseInt(profile.experience_years as any),
          price_starts_at: parseInt(profile.price_starts_at as any),
          cover_photo_url: profile.cover_photo_url,
          styles: profile.styles,
          languages: typeof profile.languages === 'string' ? (profile.languages as string).split(',').map(l => l.trim()) : profile.languages,
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      setMessage({ text: 'Profile saved successfully!', type: 'success' });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ text: 'Error saving profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Package management functions
  const addPackage = () => {
    // Use a more unique temp ID combining timestamp and random string
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setPackages([...packages, { 
      id: tempId, 
      title: '', 
      price: '', 
      description: '', 
      features: [], 
      is_recommended: false,
      isNew: true
    }]);
  };

  const updatePackage = (index: number, field: string, value: any) => {
    const newPackages = [...packages];
    newPackages[index] = { ...newPackages[index], [field]: value };
    setPackages(newPackages);
  };

  const savePackage = async (index: number) => {
    const pkg = packages[index];
    if (!pkg.title || !pkg.price) {
      alert('Please fill in at least the title and price.');
      return;
    }

    try {
      setSaving(true);
      const pkgData = {
        photographer_id: user?.id,
        title: pkg.title,
        price: parseInt(pkg.price.toString().replace(/[^0-9]/g, '')), // Robust price parsing
        description: pkg.description,
        features: typeof pkg.features === 'string' ? pkg.features.split('\n').filter((f: string) => f.trim() !== '') : pkg.features,
        is_recommended: pkg.is_recommended
      };

      if (pkg.isNew) {
        const { data, error: insertError } = await supabase
          .from('packages')
          .insert([pkgData])
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // Update local state with the returned data from DB (includes the real UUID)
        const updatedPackages = [...packages];
        updatedPackages[index] = { ...data, isNew: false };
        setPackages(updatedPackages);
        alert('Package created successfully!');
      } else {
        const { data, error: updateError } = await supabase
          .from('packages')
          .update(pkgData)
          .eq('id', pkg.id)
          .select()
          .single();
          
        if (updateError) throw updateError;
        
        const updatedPackages = [...packages];
        updatedPackages[index] = data;
        setPackages(updatedPackages);
        alert('Package updated successfully!');
      }
    } catch (error: any) {
      alert('Error saving package: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async (index: number) => {
    const pkg = packages[index];
    if (pkg.isNew) {
      setPackages(packages.filter((_, i) => i !== index));
      return;
    }

    if (!window.confirm('Are you sure you want to delete this package?')) return;

    try {
      setSaving(true);
      const { error } = await supabase.from('packages').delete().eq('id', pkg.id);
      if (error) throw error;
      setPackages(packages.filter((_, i) => i !== index));
      alert('Package deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting package:', error);
      alert('Error deleting package: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="pt-24 pb-20 min-h-screen bg-surface flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="pt-24 pb-20 bg-surface min-h-screen">
      <div className="max-w-4xl mx-auto px-8">
        <h1 className="text-4xl font-serif font-bold mb-8">Edit Provider Profile</h1>
        
        {message.text && (
          <div className={`p-4 rounded-xl mb-8 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Studio Branding Link */}
        <Link to="/studio/branding" className="bg-gradient-to-r from-primary/10 to-rose-50 rounded-[2rem] p-6 border border-primary/10 flex items-center justify-between mb-8 group hover:border-primary/30 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Palette size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors">Studio Branding</h3>
              <p className="text-sm text-on-surface-variant">Logo, colors, watermark, contact info</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
        </Link>

        {/* Basic Info */}
        <div className="bg-white rounded-3xl p-8 silk-shadow mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Camera className="text-primary" /> Basic Information
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-2">Cover Photo URL</label>
              <input 
                type="text" 
                name="cover_photo_url"
                value={profile.cover_photo_url}
                onChange={handleProfileChange}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">Location</label>
                <input 
                  type="text" 
                  name="location"
                  value={profile.location}
                  onChange={handleProfileChange}
                  placeholder="e.g. Udaipur, Rajasthan"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">Languages (comma separated)</label>
                <input 
                  type="text" 
                  name="languages"
                  value={Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages}
                  onChange={handleProfileChange}
                  placeholder="e.g. English, Hindi"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">Years of Experience</label>
                <input 
                  type="number" 
                  name="experience_years"
                  value={profile.experience_years}
                  onChange={handleProfileChange}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-2">Starting Price (₹)</label>
                <input 
                  type="number" 
                  name="price_starts_at"
                  value={profile.price_starts_at}
                  onChange={handleProfileChange}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-2">Bio / About You</label>
              <textarea 
                name="bio"
                value={profile.bio}
                onChange={handleProfileChange}
                rows={5}
                placeholder="Tell clients about your photography journey and style..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none resize-y"
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-3">Photography Styles</label>
              <div className="flex flex-wrap gap-3">
                {styleOptions.map(style => (
                  <button
                    key={style}
                    onClick={() => handleStyleToggle(style)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                      profile.styles.includes(style)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white border-outline-variant/30 text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 bg-on-surface text-white px-8 py-3 rounded-full font-bold hover:bg-on-surface/90 transition-all disabled:opacity-70"
            >
              <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* Packages Editor */}
        <div className="bg-white rounded-3xl p-8 silk-shadow mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Upload className="text-primary" /> Service Packages
            </h2>
            <button 
              onClick={addPackage}
              className="flex items-center gap-1 text-sm font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-full transition-colors"
            >
              <Plus size={16} /> Add Package
            </button>
          </div>
          
          <div className="space-y-8">
            {packages.length === 0 ? (
              <p className="text-on-surface-variant text-center py-8">No packages created yet. Add your first package!</p>
            ) : (
              packages.map((pkg, index) => (
                <div key={pkg.id} className="border border-outline-variant/20 rounded-2xl p-6 relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Title</label>
                      <input 
                        type="text" 
                        value={pkg.title}
                        onChange={(e) => updatePackage(index, 'title', e.target.value)}
                        placeholder="e.g. Signature Collection"
                        className="w-full bg-surface border border-outline-variant/10 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Price (₹)</label>
                      <input 
                        type="number" 
                        value={pkg.price}
                        onChange={(e) => updatePackage(index, 'price', e.target.value)}
                        className="w-full bg-surface border border-outline-variant/10 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Description</label>
                    <input 
                      type="text" 
                      value={pkg.description || ''}
                      onChange={(e) => updatePackage(index, 'description', e.target.value)}
                      placeholder="Brief description of this package"
                      className="w-full bg-surface border border-outline-variant/10 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Features (One per line)</label>
                    <textarea 
                      value={Array.isArray(pkg.features) ? pkg.features.join('\n') : pkg.features}
                      onChange={(e) => updatePackage(index, 'features', e.target.value)}
                      rows={4}
                      placeholder="8 Hours Coverage&#10;1 Lead Photographer&#10;400+ Edited Photos"
                      className="w-full bg-surface border border-outline-variant/10 rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-y"
                    ></textarea>
                  </div>
                  
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-outline-variant/10">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={pkg.is_recommended}
                        onChange={(e) => updatePackage(index, 'is_recommended', e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-on-surface-variant">Mark as Recommended</span>
                    </label>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => deletePackage(index)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Package"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => savePackage(index)}
                        disabled={saving}
                        className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {pkg.isNew ? 'Create Package' : 'Update Package'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
