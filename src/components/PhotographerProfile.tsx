import { Calendar, CheckCircle2, Edit, Facebook, Globe, Grid3X3, Heart, ImagePlus, Instagram, MapPin, MessageCircle, Share2, Star, Tag } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { BookingCTA } from './BookingCTA';
import { PhotographerStats } from './PhotographerStats';
import { PortfolioGallery } from './PortfolioGallery';
import { PortfolioManagement } from './PortfolioManagement';
import { Testimonials } from './Testimonials';

export function PhotographerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Default to 'portfolio' — like Instagram, the grid IS the profile
  const [activeTab, setActiveTab] = useState('portfolio');
  const [loading, setLoading] = useState(true);
  
  const [profile, setProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriting, setFavoriting] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    fetchPhotographerData();

    // Set up real-time connection for profile and reviews
    const channel = supabase
      .channel(`photographer-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photographer_profiles',
          filter: `id=eq.${id}`
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `photographer_id=eq.${id}`
        },
        async (payload) => {
          try {
            // Re-fetch reviews to get the joined profile data correctly
            const { data: revData, error: revError } = await supabase
              .from('reviews')
              .select(`
                *,
                profiles:client_id(full_name, avatar_url)
              `)
              .eq('photographer_id', id)
              .order('created_at', { ascending: false });
              
            if (revError) throw revError;
            if (revData) setReviews(revData);
          } catch (err) {
            console.error('Error updating reviews in real-time:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portfolio_images',
          filter: `photographer_id=eq.${id}`
        },
        async () => {
          const { data: portData } = await supabase
            .from('portfolio_images')
            .select('*')
            .eq('photographer_id', id)
            .order('display_order', { ascending: true });
            
          if (portData) setPortfolio(portData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchPhotographerData = async () => {
    try {
      setLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from('photographer_profiles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', id)
        .single();
        
      if (userError && userError.code !== 'PGRST116') throw userError;

      if (profileData) setProfile(profileData);
      if (userData) setUserProfile(userData);

      const { data: packsData } = await supabase
        .from('packages')
        .select('*')
        .eq('photographer_id', id)
        .order('price', { ascending: true });
        
      if (packsData) setPackages(packsData);

      const { data: portData } = await supabase
        .from('portfolio_images')
        .select('*')
        .eq('photographer_id', id)
        .order('display_order', { ascending: true });
        
      if (portData) setPortfolio(portData);

      const { data: revData, error: revError } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles:client_id(full_name, avatar_url)
        `)
        .eq('photographer_id', id)
        .order('created_at', { ascending: false });
        
      if (revError) throw revError;
      if (revData) setReviews(revData);

      // Check if favorited by current user
      if (user) {
        const { data: favorite } = await supabase
          .from('photographer_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('photographer_id', id)
          .maybeSingle();
        setIsFavorited(!!favorite);
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/signin');
      return;
    }
    if (!reviewForm.comment.trim()) return;
    
    try {
      setSubmittingReview(true);
      const { error } = await supabase.from('reviews').insert([{
        photographer_id: id,
        client_id: user.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment
      }]);
      if (error) throw error;
      setReviewForm({ rating: 5, comment: '' });
      fetchPhotographerData(); // Fallback to ensure immediate update if real-time lags
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Error submitting review. Please try again.');
      setSubmittingReview(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) { navigate('/signin'); return; }
    setStartingChat(true);
    try {
      // Find conversation between this client and this photographer
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', user.id)
        .eq('photographer_id', id)
        .maybeSingle();

      if (existing) {
        navigate(`/messages/${existing.id}`);
      } else {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({ client_id: user.id, photographer_id: id })
          .select('id')
          .single();
        if (error) throw error;
        navigate(`/messages/${newConv.id}`);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    } finally {
      setStartingChat(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) { navigate('/signin'); return; }
    setFavoriting(true);
    try {
      if (isFavorited) {
        await supabase
          .from('photographer_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('photographer_id', id);
        setIsFavorited(false);
      } else {
        await supabase
          .from('photographer_favorites')
          .insert({ user_id: user.id, photographer_id: id });
        setIsFavorited(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setFavoriting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center pt-20">Loading...</div>;
  }

  if (!profile && !userProfile) {
    return <div className="min-h-screen bg-surface flex items-center justify-center pt-20">Profile not found.</div>;
  }

  const isOwner = user?.id === id;
  const fullName = userProfile?.full_name || 'Photographer Profile';
  const avatarUrl = userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
  const coverPhoto = profile?.cover_photo_url || "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop";

  return (
    <div className="min-h-screen bg-surface pt-20">
      {/* ═══════════════════════════════════════════════════════
          INSTAGRAM-STYLE PROFILE HEADER
          ═══════════════════════════════════════════════════════ */}
      <section className="relative h-[280px] md:h-[340px] overflow-hidden">
        <img 
          src={coverPhoto} 
          alt="Cover" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
      </section>

      {/* Profile Info Bar — Instagram-style */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative -mt-16 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* Avatar */}
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white overflow-hidden shadow-xl bg-white flex-shrink-0">
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>

            {/* Name, Location & Stats */}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-on-surface">{fullName}</h1>
                <CheckCircle2 className="text-primary" size={22} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant mb-4">
                {profile?.location && <span className="flex items-center gap-1"><MapPin size={14} /> {profile.location}</span>}
                {profile?.styles?.length > 0 && (
                  <span className="flex items-center gap-1"><Tag size={14} /> {profile.styles.slice(0, 3).join(' • ')}</span>
                )}
              </div>

              {/* Instagram-Style Stats Row */}
              <div className="flex items-center gap-8">
                <StatPill value={portfolio.length} label="Posts" />
                <StatPill value={profile?.rating ? `${profile.rating}★` : '—'} label="Rating" />
                <StatPill value={profile?.reviews_count || 0} label="Reviews" />
                {profile?.experience_years && (
                  <StatPill value={`${profile.experience_years}+`} label="Years" />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pb-2">
              {isOwner ? (
                <>
                  <Link to="/photographer/edit" className="flex items-center gap-2 bg-surface-container-low text-on-surface px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-all border border-outline-variant/20">
                    <Edit size={16} /> Edit Profile
                  </Link>
                  <Link to={`/photographer/${id}`} onClick={() => setActiveTab('portfolio')} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">
                    <ImagePlus size={16} /> Add Post
                  </Link>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleStartChat}
                    disabled={startingChat}
                    className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-all disabled:opacity-50"
                  >
                    <MessageCircle size={18} /> {startingChat ? 'Starting...' : 'Message'}
                  </button>
                  <button 
                    onClick={handleToggleFavorite}
                    disabled={favoriting}
                    className={cn(
                      "p-2.5 bg-surface-container-low border border-outline-variant/20 rounded-xl transition-all",
                      isFavorited ? "text-primary border-primary/20 bg-primary/5" : "text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    <Heart size={18} className={cn(isFavorited && "fill-primary")} />
                  </button>
                  <button 
                    onClick={() => setActiveTab('packages')}
                    className="signature-gradient text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                  >
                    Book Now
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bio Snippet */}
          {profile?.bio && (
            <p className="text-sm text-on-surface-variant mt-4 max-w-xl leading-relaxed line-clamp-2">
              {profile.bio}
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            INSTAGRAM-STYLE TABS
            ═══════════════════════════════════════════════════════ */}
        <div className="border-t border-outline-variant/10">
          <div className="flex justify-center gap-0">
            <InstaTab icon={<Grid3X3 size={16} />} label="Posts" active={activeTab === 'portfolio'} onClick={() => setActiveTab('portfolio')} />
            <InstaTab icon={<Tag size={16} />} label="Packages" active={activeTab === 'packages'} onClick={() => setActiveTab('packages')} />
            <InstaTab icon={<Star size={16} />} label="Reviews" active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} />
            {isOwner && <InstaTab icon={<Calendar size={16} />} label="Stats" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            TAB CONTENT
            ═══════════════════════════════════════════════════════ */}
        <div className="py-8">
          {/* ── Portfolio Tab (Default — the main event) ──── */}
          {activeTab === 'portfolio' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isOwner ? (
                // Owner view — includes upload + grid management
                <PortfolioManagement 
                  images={portfolio}
                  onRefresh={fetchPhotographerData}
                />
              ) : (
                // Visitor view — just the gallery
                portfolio.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-outline-variant/20 flex items-center justify-center">
                      <ImagePlus size={40} className="text-on-surface-variant/30" />
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">No posts yet</h3>
                    <p className="text-on-surface-variant">When {fullName.split(' ')[0]} shares photos, you'll see them here.</p>
                  </div>
                ) : (
                  <PortfolioGallery 
                    images={portfolio}
                    photographerName={fullName}
                    photographerStyles={profile?.styles || []}
                  />
                )
              )}
            </div>
          )}

          {/* ── Packages Tab ──── */}
          {activeTab === 'packages' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
              {packages.length === 0 ? (
                <div className="text-center text-on-surface-variant py-16">
                  <h3 className="text-xl font-bold text-on-surface mb-2">
                    {isOwner ? 'No packages created yet' : 'No packages available'}
                  </h3>
                  <p>
                    {isOwner 
                      ? 'Create your first package from Edit Profile.'
                      : `Check back soon or message ${fullName.split(' ')[0]} directly.`
                    }
                  </p>
                  {isOwner && (
                    <Link 
                      to="/photographer/edit" 
                      className="inline-flex items-center gap-2 mt-4 bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary/90 transition-all"
                    >
                      <Edit size={16} /> Create Package
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  {isOwner && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200/60 text-amber-800 rounded-2xl px-6 py-4">
                      <p className="text-sm font-medium">These are your packages. Manage them from <strong>Edit Profile</strong>.</p>
                      <Link 
                        to="/photographer/edit" 
                        className="shrink-0 flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-amber-700 transition-all"
                      >
                        <Edit size={14} /> Edit Packages
                      </Link>
                    </div>
                  )}
                  {packages.map(pkg => (
                    <PackageCard 
                      key={pkg.id}
                      title={pkg.title} 
                      price={`₹${pkg.price.toLocaleString()}`} 
                      features={pkg.features || []}
                      description={pkg.description}
                      recommended={pkg.is_recommended}
                      isOwner={isOwner}
                      onBook={() => {
                        if (!user) navigate('/signin');
                        else navigate(`/book/${pkg.id}`);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Reviews Tab ──── */}
          {activeTab === 'reviews' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
              {!isOwner && user && (
                <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/10">
                  <h4 className="text-xl font-bold mb-4">Write a Review</h4>
                  <form onSubmit={submitReview} className="space-y-4">
                    <div className="flex gap-2 mb-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          type="button"
                          onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                        >
                          <Star size={24} className={star <= reviewForm.rating ? "fill-primary text-primary" : "text-outline-variant/40"} />
                        </button>
                      ))}
                    </div>
                    <textarea 
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="Share your experience working with this photographer..."
                      rows={3}
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 focus:ring-1 focus:ring-primary outline-none resize-y"
                    ></textarea>
                    <button 
                      type="submit"
                      disabled={submittingReview || !reviewForm.comment.trim()}
                      className="bg-primary text-white px-6 py-2 rounded-full font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {submittingReview ? 'Submitting...' : 'Post Review'}
                    </button>
                  </form>
                </div>
              )}
              
              {reviews.length === 0 ? (
                <div className="text-center text-on-surface-variant py-16 bg-white rounded-[2.5rem] border border-outline-variant/5">
                  No reviews yet. Be the first to leave a review!
                </div>
              ) : (
                <Testimonials 
                  reviews={reviews.map(rev => ({
                    ...rev,
                    client: rev.profiles || { full_name: 'Anonymous User', avatar_url: undefined }
                  }))}
                  averageRating={profile?.rating || 0}
                  totalReviews={profile?.reviews_count || 0}
                />
              )}
            </div>
          )}

          {/* ── Stats Tab (Owner Only) ──── */}
          {activeTab === 'stats' && isOwner && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
              <PhotographerStats 
                photographerId={id!}
                isPerspectivePhotographer={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Instagram-style Tab Button ─────────────────────────
function InstaTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] transition-all border-t-2 -mt-[2px]",
        active 
          ? "text-on-surface border-on-surface" 
          : "text-on-surface-variant/60 border-transparent hover:text-on-surface-variant"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Stat Pill ──────────────────────────────────────────
function StatPill({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-on-surface">{value}</div>
      <div className="text-xs text-on-surface-variant">{label}</div>
    </div>
  );
}

// ─── Package Card ───────────────────────────────────────
interface PackageCardProps {
  title: string;
  price: string;
  features: string[];
  description?: string;
  recommended?: boolean;
  isOwner?: boolean;
  onBook: () => void;
}

const PackageCard: React.FC<PackageCardProps> = ({ title, price, features, description, recommended, isOwner, onBook }) => {
  return (
    <div className={cn(
      "p-8 rounded-[2.5rem] border transition-all hover:scale-[1.01]",
      recommended ? "bg-on-surface text-white border-on-surface silk-shadow" : "bg-white border-outline-variant/10 text-on-surface"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div>
          {recommended && <span className="bg-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 inline-block">Recommended</span>}
          <h4 className="text-2xl font-serif font-bold">{title}</h4>
        </div>
        <div className="text-2xl font-bold">{price}</div>
      </div>
      
      {description && <p className="mb-6 opacity-80 text-sm">{description}</p>}
      
      <ul className={cn("grid md:grid-cols-2 gap-4", !isOwner && "mb-8")}>
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm opacity-80">
            <CheckCircle2 size={18} className={recommended ? "text-primary-container" : "text-primary"} />
            {f}
          </li>
        ))}
      </ul>
      {!isOwner && (
        <button 
          onClick={onBook}
          className={cn(
            "w-full py-4 rounded-full font-bold transition-all active:scale-95",
            recommended ? "bg-white text-on-surface hover:bg-surface-container-low" : "bg-on-surface text-white hover:bg-on-surface/90"
          )}>
          Choose Package
        </button>
      )}
    </div>
  );
}

// ─── Social Link ────────────────────────────────────────
function SocialLink({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <span className="text-on-surface-variant group-hover:text-primary transition-colors">{icon}</span>
        <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
      </div>
      <span className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-all">{value}</span>
    </div>
  );
}
