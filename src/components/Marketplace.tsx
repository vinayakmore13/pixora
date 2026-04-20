import { AlertCircle, ArrowRight, ChevronRight, Compass, Filter, Heart, MapPin, Star, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { MarketplaceAnalytics } from './MarketplaceAnalytics';
import { SmartMatching } from './SmartMatching';

type MarketplaceTab = 'browse' | 'matching' | 'analytics';

export function Marketplace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [photographers, setPhotographers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState('Recommended');

  const styleOptions = ["Editorial", "Candid", "Traditional", "Cinematic", "Fine Art", "Classic", "Documentary"];

  useEffect(() => {
    fetchPhotographers();

    // Set up real-time connection for marketplace updates
    const channel = supabase
      .channel('marketplace-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photographer_profiles'
        },
        () => {
          // Re-fetch to keep filters and sorting in sync with the latest profile data
          fetchPhotographers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchLocation, selectedStyles, minPrice, maxPrice, minRating, sortBy]);

  const fetchPhotographers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('photographer_profiles')
        .select(`
          id,
          location,
          price_starts_at,
          cover_photo_url,
          styles,
          rating,
          reviews_count,
          profiles(full_name)
        `);

      // Apply Location Filter
      if (searchLocation) {
        query = query.ilike('location', `%${searchLocation}%`);
      }

      // Apply Price Filters
      if (minPrice) query = query.gte('price_starts_at', parseInt(minPrice));
      if (maxPrice) query = query.lte('price_starts_at', parseInt(maxPrice));

      // Apply Rating Filter
      if (minRating > 0) query = query.gte('rating', minRating);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[Marketplace] Supabase error:', error);
        throw error;
      }
      
      let finalData = data || [];

      // Apply Style Filters (in-memory filtering for flexibility)
      if (selectedStyles.length > 0) {
        finalData = finalData.filter(p => 
          selectedStyles.some(style => p.styles && p.styles.includes(style))
        );
      }

      // Sorting
      if (sortBy === 'Price: Low to High') {
        finalData.sort((a, b) => (a.price_starts_at || 0) - (b.price_starts_at || 0));
      } else if (sortBy === 'Price: High to Low') {
        finalData.sort((a, b) => (b.price_starts_at || 0) - (a.price_starts_at || 0));
      } else if (sortBy === 'Top Rated') {
        finalData.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }
      
      setPhotographers(finalData);
    } catch (error: any) {
      console.error('[Marketplace] Error fetching photographers:', error);
      setError(error?.message || 'Failed to load photographers');
      setPhotographers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStyleChange = (style: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedStyles([...selectedStyles, style]);
    } else {
      setSelectedStyles(selectedStyles.filter(s => s !== style));
    }
  };

  return (
    <div className="pt-20 pb-20 bg-surface min-h-screen">
      {/* Tab Navigation */}
      <div className="sticky top-20 bg-white border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('browse')}
              className={cn(
                'py-4 px-2 font-semibold transition-all border-b-2 flex items-center gap-2',
                activeTab === 'browse'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              <Compass size={20} />
              Browse
            </button>
            <button
              onClick={() => setActiveTab('matching')}
              className={cn(
                'py-4 px-2 font-semibold transition-all border-b-2 flex items-center gap-2',
                activeTab === 'matching'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
              disabled={!user}
              title={!user ? 'Sign in to use AI matching' : ''}
            >
              <Zap size={20} />
              AI Match
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={cn(
                'py-4 px-2 font-semibold transition-all border-b-2 flex items-center gap-2',
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              <TrendingUp size={20} />
              Insights
            </button>
          </div>
        </div>
      </div>

      {/* Content Based on Active Tab */}
      {activeTab === 'matching' && !user && (
        <div className="max-w-4xl mx-auto px-8 py-16 text-center">
          <p className="text-lg text-gray-600 mb-6">Sign in to use our AI-powered photographer matching system</p>
          <Link to="/signin" className="inline-block px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
            Sign In
          </Link>
        </div>
      )}

      {activeTab === 'browse' && (
        <>
      {/* Hero Section */}
      <section className="px-8 mb-16 mt-8">
        <div className="max-w-7xl mx-auto bg-on-surface rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-1/2 h-full hidden lg:block">
            <div className="grid grid-cols-2 gap-4 rotate-12 translate-x-12 -translate-y-12 opacity-40">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/photo${i}/400/600`} 
                    alt="Wedding" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="max-w-xl relative z-10">
            <span className="text-primary-container font-bold tracking-widest text-xs uppercase mb-4 block">The Marketplace</span>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-8 leading-tight">Find the visionary for your forever.</h1>
            <p className="text-white/70 text-lg mb-10 leading-relaxed">We've curated the world's most elite wedding photographers, vetted for their editorial eye and technical mastery.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input 
                  type="text" 
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="Location (e.g. Udaipur, Goa)" 
                  className="w-full bg-white/10 border border-white/20 rounded-full py-4 pl-12 pr-6 text-white placeholder:text-white/40 focus:ring-1 focus:ring-primary-container outline-none"
                />
              </div>
              <button 
                onClick={fetchPhotographers}
                className="bg-primary-container text-on-primary-container px-10 py-4 rounded-full font-bold hover:brightness-110 transition-all active:scale-95"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-8 mb-8">
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold mb-1">Unable to Load Photographers</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchPhotographers}
                className="mt-3 px-4 py-2 bg-red-200 hover:bg-red-300 text-red-900 font-bold rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-10">
          <div>
            <h3 className="text-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <Filter size={20} />
              Filters
            </h3>
            
            <div className="space-y-8">
              <FilterGroup title="Photography Style">
                {styleOptions.map(style => (
                  <Checkbox 
                    key={style}
                    label={style} 
                    checked={selectedStyles.includes(style)} 
                    onChange={(checked) => handleStyleChange(style, checked)} 
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Starting Price (₹)">
                <div className="flex items-center gap-4">
                  <input 
                    type="number" 
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min" 
                    className="w-full bg-white border border-outline-variant/20 rounded-xl py-2 px-4 text-sm" 
                  />
                  <span className="text-on-surface-variant">—</span>
                  <input 
                    type="number" 
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max" 
                    className="w-full bg-white border border-outline-variant/20 rounded-xl py-2 px-4 text-sm" 
                  />
                </div>
              </FilterGroup>

              <FilterGroup title="Rating">
                <div className="space-y-2">
                  {[5, 4, 3].map((star) => (
                    <label key={star} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="ratingFilter" 
                        className="sr-only peer" 
                        checked={minRating === star}
                        onChange={() => setMinRating(star)}
                      />
                      <div className="w-5 h-5 border border-outline-variant/30 rounded-full bg-white peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={cn(i < star ? "text-primary fill-primary" : "text-outline-variant/40")} />
                        ))}
                        <span className="text-xs font-bold text-on-surface-variant ml-1">& Up</span>
                      </div>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer group mt-2">
                    <input 
                      type="radio" 
                      name="ratingFilter" 
                      className="sr-only peer" 
                      checked={minRating === 0}
                      onChange={() => setMinRating(0)}
                    />
                    <div className="w-5 h-5 border border-outline-variant/30 rounded-full bg-white peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                    </div>
                    <span className="text-sm font-bold text-on-surface-variant ml-1">Any Rating</span>
                  </label>
                </div>
              </FilterGroup>
            </div>
          </div>

          <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/10">
            <h4 className="font-bold text-primary mb-2">Are you a photographer?</h4>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">Join our elite network and get discovered by premium clients.</p>
            <Link to={user ? "/dashboard" : "/signup?type=photographer"} className="text-primary font-bold text-sm flex items-center gap-2 group">
              {user ? "Go to Dashboard" : "Join now"} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </aside>

        {/* Photographers Grid */}
        <main className="lg:col-span-3">
          <div className="flex justify-between items-center mb-8">
            <div className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
              Showing {photographers.length} Photographers
            </div>
            <select 
              className="bg-transparent border-none text-sm font-bold text-primary outline-none cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option>Recommended</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Top Rated</option>
            </select>
          </div>

          {loading ? (
            <div className="py-20 text-center text-on-surface-variant">Searching for photographers...</div>
          ) : photographers.length === 0 ? (
            <div className="py-20 text-center">
              <h3 className="text-xl font-bold text-on-surface mb-2">No photographers found</h3>
              <p className="text-on-surface-variant">Try adjusting your filters or search location.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {photographers.map((p) => (
                <PhotographerCard 
                  key={p.id}
                  id={p.id}
                  image={p.cover_photo_url || "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop"}
                  name={p.profiles?.full_name || 'Anonymous'}
                  location={p.location || 'Location varies'}
                  rating={p.rating || 0}
                  reviews={p.reviews_count || 0}
                  price={p.price_starts_at ? `₹${p.price_starts_at.toLocaleString()}` : 'Contact for price'}
                  styles={p.styles || []}
                />
              ))}
            </div>
          )}

          {photographers.length > 0 && (
            <div className="mt-16 flex justify-center">
              <button disabled className="opacity-50 bg-white border border-outline-variant/20 text-on-surface px-10 py-4 rounded-full font-bold">
                End of Results
              </button>
            </div>
          )}
        </main>
      </div>
        </>
      )}

      {activeTab === 'matching' && user && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          <SmartMatching clientId={user.id} />
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="max-w-7xl mx-auto px-8 py-12">
          <MarketplaceAnalytics />
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">{title}</h4>
      {children}
    </div>
  );
}

const Checkbox: React.FC<{ label: string, checked: boolean, onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
      />
      <div className="w-5 h-5 border border-outline-variant/30 rounded bg-white peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity"></div>
      </div>
      <span className="text-sm font-medium text-on-surface-variant group-hover:text-primary transition-colors">{label}</span>
    </label>
  );
}

const PhotographerCard: React.FC<{ id: string, image: string, name: string, location: string, rating: number, reviews: number, price: string, styles: string[] }> = ({ id, image, name, location, rating, reviews, price, styles }) => {
  return (
    <Link to={`/photographer/${id}`} className="group bg-white rounded-[2.5rem] overflow-hidden silk-shadow border border-outline-variant/5 transition-all hover:-translate-y-1 duration-300 flex flex-col h-full">
      <div className="relative h-64 overflow-hidden shrink-0">
        <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
        <button className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-md rounded-full text-on-surface hover:text-primary transition-colors z-10">
          <Heart size={20} />
        </button>
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 pr-4">
          {styles.slice(0, 3).map((style) => (
            <span key={style} className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface">
              {style}
            </span>
          ))}
          {styles.length > 3 && (
            <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface">
              +{styles.length - 3}
            </span>
          )}
        </div>
      </div>
      <div className="p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-2xl font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 break-all">{name}</h3>
          <div className="flex items-center gap-1 text-primary font-bold shrink-0 ml-2">
            <Star size={16} className="fill-primary" />
            {rating}
          </div>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant text-sm mb-6 mt-auto pt-2">
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">{location}</span>
        </div>
        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Starting from</div>
            <div className="text-xl font-bold text-on-surface">{price}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-white transition-all shrink-0">
            <ChevronRight size={24} />
          </div>
        </div>
      </div>
    </Link>
  );
}
