// AI Marketplace Matching Engine - Hybrid Approach
// Combines rule-based scoring with simple semantic embeddings

import { supabase } from './supabaseClient';

export interface PhotographerProfile {
  id: string;
  styles: string[];
  location: string;
  experience_years: number;
  price_starts_at: number;
  rating: number;
  reviews_count: number;
}

export interface ClientPreferences {
  preferred_styles: string[];
  preferred_locations: string[];
  budget_min: number;
  budget_max: number;
  event_type: string;
  preferred_experience_years: number;
}

export interface MatchResult {
  photographerId: string;
  matchScore: number;
  styleMatch: number;
  budgetMatch: number;
  locationMatch: number;
  availabilityMatch: number;
  matchReason: string;
}

class MarketplaceMatchingEngine {
  /**
   * Calculate style matching using simple string similarity
   * This mimics semantic similarity without ML
   */
  private calculateStyleMatch(
    photographerStyles: string[],
    clientStyles: string[]
  ): number {
    if (!clientStyles.length || !photographerStyles.length) return 50; // Neutral

    const matches = photographerStyles.filter(style =>
      clientStyles.some(clientStyle =>
        this.stringSimilarity(style.toLowerCase(), clientStyle.toLowerCase()) > 0.6
      )
    );

    return Math.min(100, (matches.length / clientStyles.length) * 100);
  }

  /**
   * Simple string similarity algorithm (Levenshtein-inspired)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance for string similarity
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= str1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= str2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[str2.length] = lastValue;
    }

    return costs[str2.length];
  }

  /**
   * Calculate budget compatibility score
   */
  private calculateBudgetMatch(
    photographerMinPrice: number,
    clientBudgetMin: number,
    clientBudgetMax: number
  ): number {
    // If photographer price is within client budget
    if (photographerMinPrice >= clientBudgetMin && photographerMinPrice <= clientBudgetMax) {
      return 100;
    }

    // If photographer price is below minimum, slight penalty
    if (photographerMinPrice < clientBudgetMin) {
      const difference = clientBudgetMin - photographerMinPrice;
      const percentDiff = (difference / clientBudgetMin) * 100;
      return Math.max(20, 100 - percentDiff);
    }

    // If photographer price is above maximum, significant penalty
    const difference = photographerMinPrice - clientBudgetMax;
    const percentDiff = (difference / clientBudgetMax) * 100;
    return Math.max(10, Math.max(10, 100 - percentDiff * 1.5));
  }

  /**
   * Calculate location proximity score
   */
  private calculateLocationMatch(
    photographerLocation: string,
    clientLocations: string[]
  ): number {
    if (!clientLocations.length) return 50; // Neutral

    const locationMatches = clientLocations.filter(clientLoc =>
      this.stringSimilarity(
        photographerLocation.toLowerCase(),
        clientLoc.toLowerCase()
      ) > 0.5
    );

    if (locationMatches.length > 0) return 100;

    // Check for state/region match (first part of location string)
    const photographerRegion = photographerLocation.split(',')[0].toLowerCase();
    const regionMatches = clientLocations.filter(loc =>
      loc.toLowerCase().includes(photographerRegion)
    );

    return regionMatches.length > 0 ? 60 : 30;
  }

  /**
   * Calculate experience match
   */
  private calculateExperienceMatch(
    photographerYears: number,
    requiredYears: number
  ): number {
    if (photographerYears >= requiredYears) {
      // Bonus for exceeding requirements
      const bonus = Math.min(20, (photographerYears - requiredYears) * 2);
      return Math.min(100, 100 + bonus);
    }

    // Penalty for insufficient experience
    const shortage = requiredYears - photographerYears;
    const percentShortage = (shortage / requiredYears) * 100;
    return Math.max(20, 100 - percentShortage);
  }

  /**
   * Calculate availability match (placeholder - would use calendar data)
   */
  private calculateAvailabilityMatch(): number {
    // In real implementation, check photographer's availability calendar
    // For now, return neutral score
    return 70;
  }

  /**
   * Main matching function - returns photographers ranked by fit
   */
  async matchPhotographersForClient(
    clientId: string,
    clientPrefs: ClientPreferences,
    limit: number = 10
  ): Promise<MatchResult[]> {
    try {
      // Fetch all photographers (in production, optimize with filters)
      const { data: photographers, error } = await supabase
        .from('photographer_profiles')
        .select('*')
        .limit(100);

      if (error || !photographers) return [];

      // Score each photographer
      const matches = photographers.map((photo: PhotographerProfile) => {
        const styleScore = this.calculateStyleMatch(
          photo.styles || [],
          clientPrefs.preferred_styles
        );

        const budgetScore = this.calculateBudgetMatch(
          photo.price_starts_at || 0,
          clientPrefs.budget_min || 0,
          clientPrefs.budget_max || 500000
        );

        const locationScore = this.calculateLocationMatch(
          photo.location || '',
          clientPrefs.preferred_locations
        );

        const experienceScore = this.calculateExperienceMatch(
          photo.experience_years || 0,
          clientPrefs.preferred_experience_years || 0
        );

        const availabilityScore = this.calculateAvailabilityMatch();

        // Weighted composite score
        const compositeScore =
          styleScore * 0.35 + // Highest priority
          budgetScore * 0.25 +
          locationScore * 0.2 +
          experienceScore * 0.15 +
          availabilityScore * 0.05; // Lowest priority

        // Generate match reason
        const reasons: string[] = [];
        if (styleScore > 80) reasons.push('Great style match');
        if (budgetScore > 85) reasons.push('Excellent budget fit');
        if (locationScore > 80) reasons.push('Perfect location');
        if (experienceScore > 90) reasons.push('Highly experienced');

        const matchReason =
          reasons.length > 0
            ? reasons.join(', ')
            : 'Compatible photographer';

        return {
          photographerId: photo.id,
          matchScore: Math.round(compositeScore),
          styleMatch: Math.round(styleScore),
          budgetMatch: Math.round(budgetScore),
          locationMatch: Math.round(locationScore),
          availabilityMatch: Math.round(availabilityScore),
          matchReason,
        };
      });

      // Sort by match score descending and return top N
      return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
    } catch (error) {
      console.error('Error matching photographers:', error);
      return [];
    }
  }

  /**
   * Match clients for a photographer (reverse match)
   */
  async matchClientsForPhotographer(
    photographerId: string,
    limit: number = 10
  ): Promise<MatchResult[]> {
    try {
      // Fetch photographer's profile
      const { data: photoData, error: photoError } = await supabase
        .from('photographer_profiles')
        .select('*')
        .eq('id', photographerId)
        .single();

      if (photoError || !photoData) return [];

      // Fetch clients with preferences
      const { data: clientPrefs, error: prefError } = await supabase
        .from('client_preferences')
        .select('*')
        .limit(50);

      if (prefError || !clientPrefs) return [];

      // Score each client (casting to any to bypass Supabase type issues)
      const matches = (clientPrefs as any[]).map(prefs => {
        const styleScore = this.calculateStyleMatch(
          photoData.styles || [],
          prefs.preferred_styles || []
        );

        const budgetScore = this.calculateBudgetMatch(
          photoData.price_starts_at || 0,
          prefs.budget_min || 0,
          prefs.budget_max || 500000
        );

        const locationScore = this.calculateLocationMatch(
          photoData.location || '',
          prefs.preferred_locations || []
        );

        const compositeScore =
          styleScore * 0.35 + budgetScore * 0.25 + locationScore * 0.4;

        return {
          photographerId: prefs.client_id,
          matchScore: Math.round(compositeScore),
          styleMatch: Math.round(styleScore),
          budgetMatch: Math.round(budgetScore),
          locationMatch: Math.round(locationScore),
          availabilityMatch: 70,
          matchReason: 'Potential client match',
        };
      });

      return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
    } catch (error) {
      console.error('Error matching clients:', error);
      return [];
    }
  }

  /**
   * Save matches to database for persistence
   */
  async saveMatches(
    clientId: string,
    matches: MatchResult[]
  ): Promise<boolean> {
    try {
      const matchData = matches.map(match => ({
        client_id: clientId,
        photographer_id: match.photographerId,
        match_score: match.matchScore,
        style_match: match.styleMatch,
        budget_match: match.budgetMatch,
        location_match: match.locationMatch,
        availability_match: match.availabilityMatch,
        match_reason: match.matchReason,
        match_type: 'ai',
      }));

      const { error } = await supabase
        .from('marketplace_matches')
        .upsert(matchData, { onConflict: 'client_id,photographer_id' });

      return !error;
    } catch (error) {
      console.error('Error saving matches:', error);
      return false;
    }
  }

  /**
   * Get trending styles from marketplace data
   */
  async getTrendingStyles(): Promise<Array<{ style: string; volume: number }>> {
    try {
      const { data: trends } = await supabase
        .from('marketplace_trends')
        .select('style, search_volume')
        .eq('trend_date', new Date().toISOString().split('T')[0])
        .order('trending_rank', { ascending: true })
        .limit(10);

      return trends?.map(t => ({ style: t.style, volume: t.search_volume })) || [];
    } catch (error) {
      console.error('Error fetching trends:', error);
      return [];
    }
  }
}

export const marketplaceEngine = new MarketplaceMatchingEngine();
