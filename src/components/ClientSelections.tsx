import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Copy, Check, Calendar, Users, CheckCircle2, ChevronRight, Share2, Heart, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

interface ClientSelectionsProps {
  eventId: string;
}

export function ClientSelections({ eventId }: ClientSelectionsProps) {
  const [loading, setLoading] = useState(true);
  const [selectionConfig, setSelectionConfig] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalFavorites: 0, uniquePhotos: 0 });

  // Form State
  const [maxPhotos, setMaxPhotos] = useState(50);
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSelectionConfig();
  }, [eventId]);

  const fetchSelectionConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('photo_selections')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) throw error;
      setSelectionConfig(data);

      if (data) {
        // Fetch stats
        const { count: favoritesCount } = await supabase
          .from('photo_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('selection_id', data.id);

        // Fetch distinct photos liked
        const { data: uniqueFavs } = await supabase
          .from('photo_favorites')
          .select('photo_id')
          .eq('selection_id', data.id);
          
        const uniqueSet = new Set(uniqueFavs?.map(f => f.photo_id) || []);
        
        setStats({
          totalFavorites: favoritesCount || 0,
          uniquePhotos: uniqueSet.size
        });
      }
    } catch (error) {
      console.error('Error fetching selection config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const selectionCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data, error } = await supabase
        .from('photo_selections')
        .insert({
          event_id: eventId,
          max_photos: maxPhotos,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          selection_code: selectionCode,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      setSelectionConfig(data);
    } catch (error) {
      console.error('Error creating selection:', error);
      alert('Failed to create selection rules.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (selectionConfig) {
      const link = `${window.location.origin}/select/${selectionConfig.selection_code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!selectionConfig) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} />
            </div>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Enable Client Selection</h2>
            <p className="text-on-surface-variant">
              Allow your clients to log in and select their favorite photos for the final album. 
              Set the rules, and share the unique portal link with them.
            </p>
          </div>

          <form onSubmit={handleCreateSelection} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface">Maximum Photos for Album</label>
              <input
                type="number"
                min={1}
                required
                value={maxPhotos}
                onChange={(e) => setMaxPhotos(parseInt(e.target.value))}
                className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="e.g., 50"
              />
              <p className="text-xs text-on-surface-variant">The client must select exactly this many photos to submit.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface">Selection Deadline (Optional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface border border-outline-variant/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full signature-gradient text-white font-bold py-4 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Setting up...' : 'Create Selection Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectionUrl = `${window.location.origin}/select/${selectionConfig.selection_code}`;

  return (
    <div className="space-y-8">
      {/* Share Link Card */}
      <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
        <h3 className="text-xl font-bold text-on-surface mb-6">Client Portal Link</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          Share this link with your clients. They will be able to log in, view the edited photos, and favorite the ones they want in the album.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 bg-surface-container-low border border-outline-variant/10 rounded-xl py-4 px-6 font-mono text-sm tracking-wide text-on-surface w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {selectionUrl}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none p-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              <span className="sm:hidden font-bold">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <a
              href={selectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white border border-outline-variant/20 text-on-surface rounded-xl hover:bg-surface-container-low transition-all"
            >
              <Share2 size={20} />
            </a>
          </div>
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-on-surface">Selection Status</h3>
              <p className="text-xs text-on-surface-variant uppercase tracking-widest">{selectionConfig.status}</p>
            </div>
          </div>
          
          <div className="mb-2 flex justify-between text-sm font-bold">
            <span className="text-on-surface-variant">Progress</span>
            <span className="text-primary">{stats.uniquePhotos} / {selectionConfig.max_photos} Photos</span>
          </div>
          <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden mb-6">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, (stats.uniquePhotos / selectionConfig.max_photos) * 100)}%` }}
            ></div>
          </div>

          {selectionConfig.deadline && (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg p-3">
              <Calendar size={16} />
              Deadline: {new Date(selectionConfig.deadline).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mb-4">
            <Heart size={32} />
          </div>
          <h3 className="text-3xl font-serif font-bold text-on-surface mb-2">{stats.totalFavorites}</h3>
          <p className="text-on-surface-variant text-sm mb-6">Total favorites by clients</p>
          
          <button 
            disabled={stats.uniquePhotos === 0}
            className="text-primary font-bold text-sm flex items-center gap-1 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            View Selected Photos <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      {selectionConfig.status === 'submitted' && (
        <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-200 text-center">
          <h3 className="text-2xl font-bold text-green-800 mb-2">Selections Finalized!</h3>
          <p className="text-green-700 mb-6">The clients have submitted their final selections for the album.</p>
          <button className="bg-green-600 text-white px-8 py-3 rounded-full font-bold inline-flex items-center gap-2 hover:bg-green-700 transition-all">
            <Download size={18} />
            Download Selected Photos
          </button>
        </div>
      )}
    </div>
  );
}
