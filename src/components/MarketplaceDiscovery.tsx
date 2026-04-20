import { Filter, Heart, MapPin, Search, Send, Star, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

interface PhotographerCard {
  id: string;
  name: string;
  avatar: string;
  location: string;
  rating: number;
  reviews: number;
  styles: string[];
  price: number;
  matchScore?: number;
}

interface MarketplaceDiscoveryProps {
  isAIMatched?: boolean; // Show AI-matched results vs general browse
  onPhotographerSelect?: (photographerId: string) => void;
  isLoading?: boolean;
}

export function MarketplaceDiscovery({
  isAIMatched = false,
  onPhotographerSelect,
  isLoading = false,
}: MarketplaceDiscoveryProps) {
  const [photographers, setPhotographers] = useState<PhotographerCard[]>([]);
  const [filteredPhotographers, setFilteredPhotographers] = useState<PhotographerCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 500000 });
  const [sortBy, setSortBy] = useState<'match' | 'rating' | 'price'>('match');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const styles = ['Weddings', 'Portraits', 'Events', 'Pre-Wedding', 'Engagement', 'Fashion'];

  useEffect(() => {
    // In real app, fetch from API based on preferences
    // For now, mock data
    const mockPhotographers: PhotographerCard[] = [
      {
        id: '1',
        name: 'Sarah Photography',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Photography&background=random',
        location: 'Mumbai, Maharashtra',
        rating: 4.8,
        reviews: 156,
        styles: ['Weddings', 'Pre-Wedding'],
        price: 80000,
        matchScore: 95,
      },
      {
        id: '2',
        name: 'Raj Captures',
        avatar: 'https://ui-avatars.com/api/?name=Raj+Captures&background=random',
        location: 'Delhi, NCR',
        rating: 4.6,
        reviews: 92,
        styles: ['Events', 'Portraits'],
        price: 60000,
        matchScore: 88,
      },
      {
        id: '3',
        name: 'Priya Studios',
        avatar: 'https://ui-avatars.com/api/?name=Priya+Studios&background=random',
        location: 'Bangalore, Karnataka',
        rating: 4.9,
        reviews: 203,
        styles: ['Weddings', 'Fashion', 'Engagement'],
        price: 100000,
        matchScore: 92,
      },
      {
        id: '4',
        name: 'Vikram Wedding Photos',
        avatar: 'https://ui-avatars.com/api/?name=Vikram+Wedding&background=random',
        location: 'Hyderabad, Telangana',
        rating: 4.7,
        reviews: 128,
        styles: ['Weddings', 'Events'],
        price: 75000,
        matchScore: 85,
      },
      {
        id: '5',
        name: 'Anjali Moments',
        avatar: 'https://ui-avatars.com/api/?name=Anjali+Moments&background=random',
        location: 'Pune, Maharashtra',
        rating: 4.5,
        reviews: 67,
        styles: ['Portraits', 'Fashion', 'Events'],
        price: 45000,
        matchScore: 78,
      },
    ];

    setPhotographers(mockPhotographers);
    setFilteredPhotographers(mockPhotographers);
  }, []);

  useEffect(() => {
    let filtered = photographers;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Style filter
    if (selectedStyle) {
      filtered = filtered.filter(p => p.styles.includes(selectedStyle));
    }

    // Price range filter
    filtered = filtered.filter(p => p.price >= priceRange.min && p.price <= priceRange.max);

    // Sort
    if (sortBy === 'match') {
      filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => a.price - b.price);
    }

    setFilteredPhotographers(filtered);
  }, [searchQuery, selectedStyle, priceRange, sortBy, photographers]);

  const toggleLike = (id: string) => {
    const newLiked = new Set(likedIds);
    if (newLiked.has(id)) {
      newLiked.delete(id);
    } else {
      newLiked.add(id);
    }
    setLikedIds(newLiked);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-96 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {isAIMatched ? 'AI-Matched Photographers' : 'Discover Photographers'}
        </h1>
        <p className="text-gray-600 text-lg">
          {isAIMatched
            ? 'Based on your preferences and requirements'
            : 'Browse our marketplace of talented photographers'}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>

        {/* Style & Price Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Styles */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              <Filter size={16} className="inline mr-2" />
              Photography Style
            </label>
            <div className="space-y-2">
              {styles.map(style => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                  className={cn(
                    'w-full text-left px-4 py-2 rounded-lg font-medium transition-all',
                    selectedStyle === style
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Budget Range
            </label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600">Min: ₹{priceRange.min.toLocaleString()}</label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={priceRange.min}
                  onChange={e => setPriceRange({ ...priceRange, min: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Max: ₹{priceRange.max.toLocaleString()}</label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={priceRange.max}
                  onChange={e => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Sort By
            </label>
            <div className="space-y-2">
              {[
                { value: 'match', label: '⭐ Best Match' },
                { value: 'rating', label: '⭐ Top Rated' },
                { value: 'price', label: '💰 Price (Low to High)' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value as 'match' | 'rating' | 'price')}
                  className={cn(
                    'w-full text-left px-4 py-2 rounded-lg font-medium transition-all',
                    sortBy === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Found <strong>{filteredPhotographers.length}</strong> photographer{filteredPhotographers.length !== 1 ? 's' : ''}
      </div>

      {/* Photographers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPhotographers.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-lg mb-2">No photographers found</p>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          filteredPhotographers.map(photographer => (
            <div
              key={photographer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
              onClick={() => onPhotographerSelect?.(photographer.id)}
            >
              {/* Header with Match Score */}
              <div className="relative">
                <img
                  src={photographer.avatar}
                  alt={photographer.name}
                  className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                />
                {isAIMatched && photographer.matchScore && (
                  <div className="absolute top-3 right-3 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <Zap size={14} />
                    {photographer.matchScore}% Match
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-2">{photographer.name}</h3>

                <div className="space-y-3 mb-4">
                  {/* Location */}
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin size={16} />
                    {photographer.location}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={cn(
                            i < Math.floor(photographer.rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">
                      {photographer.rating} ({photographer.reviews} reviews)
                    </span>
                  </div>

                  {/* Styles */}
                  <div className="flex flex-wrap gap-1">
                    {photographer.styles.slice(0, 3).map(style => (
                      <span
                        key={style}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                      >
                        {style}
                      </span>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="text-lg font-bold text-gray-900">
                    ₹{photographer.price.toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleLike(photographer.id);
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg font-semibold transition-all border',
                      likedIds.has(photographer.id)
                        ? 'bg-red-100 border-red-300 text-red-600'
                        : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <Heart
                      size={18}
                      className={cn('inline mr-1', likedIds.has(photographer.id) && 'fill-current')}
                    />
                    Save
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onPhotographerSelect?.(photographer.id);
                    }}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    Inquire
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
