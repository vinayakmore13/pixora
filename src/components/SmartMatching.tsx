import { ArrowRight, CheckCircle, DollarSign, MapPin, Zap } from 'lucide-react';
import { useState } from 'react';
import { marketplaceEngine, type ClientPreferences } from '../lib/marketplaceMatching';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface SmartMatchingProps {
  clientId: string;
  onStartMatching?: () => void;
  onPhotographerSelected?: (photographerId: string) => void;
}

export function SmartMatching({
  clientId,
  onStartMatching,
  onPhotographerSelected,
}: SmartMatchingProps) {
  const [step, setStep] = useState<'preferences' | 'matching' | 'results'>('preferences');
  const [preferences, setPreferences] = useState<ClientPreferences>({
    preferred_styles: [],
    preferred_locations: [],
    budget_min: 0,
    budget_max: 100000,
    event_type: '',
    preferred_experience_years: 0,
  });
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const eventTypes = ['Wedding', 'Engagement', 'Pre-Wedding', 'Birthday', 'Anniversary', 'Corporate', 'Fashion', 'Portrait Session'];
  const styles = ['Weddings', 'Portraits', 'Events', 'Pre-Wedding', 'Engagement', 'Fashion', 'Candid', 'Traditional'];
  const locations = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Jaipur', 'Chandigarh', 'Goa'];

  const toggleStyle = (style: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_styles: prev.preferred_styles.includes(style)
        ? prev.preferred_styles.filter(s => s !== style)
        : [...prev.preferred_styles, style],
    }));
  };

  const toggleLocation = (location: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_locations: prev.preferred_locations.includes(location)
        ? prev.preferred_locations.filter(l => l !== location)
        : [...prev.preferred_locations, location],
    }));
  };

  const handleStartMatching = async () => {
    if (!preferences.event_type || !preferences.preferred_styles.length) {
      alert('Please select event type and at least one photography style');
      return;
    }

    setLoading(true);
    setStep('matching');

    try {
      // Save preferences
      await supabase.from('client_preferences').upsert({
        client_id: clientId,
        ...preferences,
      }, { onConflict: 'client_id' });

      // Get AI matches
      const results = await marketplaceEngine.matchPhotographersForClient(clientId, preferences, 12);

      // Save matches
      await marketplaceEngine.saveMatches(clientId, results as any);

      // Fetch full photographer data for display
      const photographerIds = results.map(r => r.photographerId);
      const { data: photographers } = await supabase
        .from('photographer_profiles')
        .select('*')
        .in('id', photographerIds);

      const enrichedMatches = results.map(match => {
        const photographer = photographers?.find(p => p.id === match.photographerId);
        return { ...match, photographer };
      });

      setMatches(enrichedMatches);
      setStep('results');
    } catch (error) {
      console.error('Error generating matches:', error);
      alert('Failed to generate matches. Please try again.');
      setStep('preferences');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'preferences') {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Zap size={32} className="text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Find Your Perfect Photographer</h1>
          <p className="text-xl text-gray-600">
            Tell us about your event and we'll use AI to match you with the best photographers
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          {/* Event Type */}
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-4">
              What type of event?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {eventTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setPreferences({ ...preferences, event_type: type })}
                  className={cn(
                    'px-4 py-3 rounded-lg font-semibold transition-all border-2',
                    preferences.event_type === type
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-blue-300'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Photography Styles */}
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-4">
              Preferred photography styles
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {styles.map(style => (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={cn(
                    'px-4 py-3 rounded-lg font-semibold transition-all border-2',
                    preferences.preferred_styles.includes(style)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-blue-300'
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Locations */}
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-4">
              Where will your event be?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {locations.map(location => (
                <button
                  key={location}
                  onClick={() => toggleLocation(location)}
                  className={cn(
                    'px-4 py-3 rounded-lg font-semibold transition-all border-2',
                    preferences.preferred_locations.includes(location)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-blue-300'
                  )}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-4">
              Your Budget
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Minimum: ₹{preferences.budget_min.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={preferences.budget_min}
                  onChange={e =>
                    setPreferences({ ...preferences, budget_min: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Maximum: ₹{preferences.budget_max.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="10000"
                  value={preferences.budget_max}
                  onChange={e =>
                    setPreferences({ ...preferences, budget_max: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-xl font-bold text-gray-900 mb-4">
              Minimum experience required
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 3, 5, 10].map(years => (
                <button
                  key={years}
                  onClick={() => setPreferences({ ...preferences, preferred_experience_years: years })}
                  className={cn(
                    'px-4 py-3 rounded-lg font-semibold transition-all border-2',
                    preferences.preferred_experience_years === years
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:border-blue-300'
                  )}
                >
                  {years === 0 ? 'Any' : `${years}+ years`}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleStartMatching}
            disabled={loading}
            className={cn(
              'w-full py-4 rounded-lg text-white font-bold text-lg transition-all flex items-center justify-center gap-2',
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            )}
          >
            {loading ? (
              <>
                <div className="animate-spin">⚡</div>
                Finding Perfect Matches...
              </>
            ) : (
              <>
                <Zap size={20} />
                Find My Perfect Photographer
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'matching') {
    return (
      <div className="min-h-96 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6 animate-pulse">
            <Zap size={40} className="text-blue-600 animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI is matching photographers...</h2>
          <p className="text-gray-600 mb-6">Analyzing {preferences.preferred_locations.length} locations and {preferences.preferred_styles.length} styles</p>
          <div className="flex gap-1 items-center justify-center">
            {[1, 2, 3].map(dot => (
              <div
                key={dot}
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{ animationDelay: `${dot * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => setStep('preferences')}
          className="text-blue-600 hover:text-blue-700 font-semibold mb-4 flex items-center gap-1"
        >
          ← Modify Preferences
        </button>
        <h1 className="text-4xl font-bold text-gray-900">Your AI-Matched Photographers</h1>
        <p className="text-xl text-gray-600 mt-2">
          We found <strong>{matches.length}</strong> perfect matches for your {preferences.event_type}
        </p>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches.map((match, idx) => (
          <div
            key={match.photographerId}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
          >
            {/* Rank Badge */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
              <span className="text-lg font-bold">#{idx + 1} Match</span>
              <span className="text-2xl font-bold">{match.matchScore}%</span>
            </div>

            {/* Match Breakdown */}
            <div className="p-6 space-y-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Style Fit</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${match.styleMatch}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{match.styleMatch}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Budget Match</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600"
                      style={{ width: `${match.budgetMatch}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{match.budgetMatch}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Location</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600"
                      style={{ width: `${match.locationMatch}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{match.locationMatch}%</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                <CheckCircle size={16} />
                {match.matchReason}
              </p>

              {match.photographer && (
                <>
                  <h3 className="font-bold text-lg text-gray-900">{match.photographer.name}</h3>
                  <p className="text-gray-600 flex items-center gap-1">
                    <MapPin size={16} />
                    {match.photographer.location}
                  </p>
                  <p className="text-gray-900 font-semibold flex items-center gap-1">
                    <DollarSign size={16} />
                    ₹{match.photographer.price_starts_at?.toLocaleString() || 'Contact for quote'}
                  </p>
                </>
              )}

              <button
                onClick={() => onPhotographerSelected?.(match.photographerId)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                View Profile
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* No matches message */}
      {matches.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg mb-4">No matches found with current preferences</p>
          <button
            onClick={() => setStep('preferences')}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
          >
            Adjust Preferences
          </button>
        </div>
      )}
    </div>
  );
}

