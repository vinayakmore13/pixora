import { supabase } from './supabaseClient';

export interface PhotoScore {
  photoId: string;
  score: number;
  reasons: string[];
  relatedGuests: number; // How many guests also selected this
}

export interface SelectionPattern {
  photoId: string;
  guestCount: number;
  coOccurrences: Map<string, number>; // Other photos selected by same guests
}

export class SelectionAIService {
  private static instance: SelectionAIService;

  private constructor() {}

  static getInstance(): SelectionAIService {
    if (!SelectionAIService.instance) {
      SelectionAIService.instance = new SelectionAIService();
    }
    return SelectionAIService.instance;
  }

  /**
   * Get AI-suggested photos for a guest based on:
   * 1. What other guests have selected
   * 2. Selection patterns and co-occurrences
   * 3. Photo metadata (composition, dimensions)
   */
  async getSuggestions(
    selectionId: string,
    guestId: string,
    yourSelections: string[]
  ): Promise<PhotoScore[]> {
    try {
      // Get all favorites for this selection
      const { data: allFavorites } = await supabase
        .from('photo_favorites')
        .select('photo_id, guest_id')
        .eq('selection_id', selectionId);

      if (!allFavorites || allFavorites.length === 0) {
        return [];
      }

      // Get all photos for this selection
      const { data: selectionConfig } = await supabase
        .from('photo_selections')
        .select('event_id')
        .eq('id', selectionId)
        .single();

      if (!selectionConfig) return [];

      const { data: allPhotos } = await supabase
        .from('photos')
        .select('id, width, height')
        .eq('event_id', selectionConfig.event_id);

      if (!allPhotos) return [];

      // Analyze selection patterns
      const patterns = this.analyzePatterns(allFavorites, yourSelections);

      // Score each unselected photo
      const scores: PhotoScore[] = [];
      const yourSelectionsSet = new Set(yourSelections);

      for (const photo of allPhotos) {
        if (yourSelectionsSet.has(photo.id)) continue; // Skip already selected

        const score = this.scorePhoto(photo.id, patterns, guestId, allFavorites);
        if (score.score > 0) {
          scores.push(score);
        }
      }

      // Sort by score descending
      return scores.sort((a, b) => b.score - a.score).slice(0, 5);
    } catch (error) {
      console.error('[SelectionAI] Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze selection patterns across all guests
   */
  private analyzePatterns(
    allFavorites: Array<{ photo_id: string; guest_id: string }>,
    yourSelections: string[]
  ): Map<string, SelectionPattern> {
    const patterns = new Map<string, SelectionPattern>();

    // Count how many guests selected each photo
    for (const fav of allFavorites) {
      if (!patterns.has(fav.photo_id)) {
        patterns.set(fav.photo_id, {
          photoId: fav.photo_id,
          guestCount: 0,
          coOccurrences: new Map(),
        });
      }
      patterns.get(fav.photo_id)!.guestCount++;
    }

    // Find co-occurrences (photos selected by same guests)
    const guestSelections = new Map<string, string[]>();
    for (const fav of allFavorites) {
      if (!guestSelections.has(fav.guest_id)) {
        guestSelections.set(fav.guest_id, []);
      }
      guestSelections.get(fav.guest_id)!.push(fav.photo_id);
    }

    for (const selections of guestSelections.values()) {
      // For each pair of photos selected by the same guest
      for (const photoId1 of selections) {
        for (const photoId2 of selections) {
          if (photoId1 !== photoId2) {
            const pattern = patterns.get(photoId1);
            if (pattern) {
              pattern.coOccurrences.set(
                photoId2,
                (pattern.coOccurrences.get(photoId2) || 0) + 1
              );
            }
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Score a photo based on:
   * 1. How many guests selected it
   * 2. How many of your selections were also selected by guests who selected this
   * 3. Photo quality metrics
   */
  private scorePhoto(
    photoId: string,
    patterns: Map<string, SelectionPattern>,
    guestId: string,
    allFavorites: Array<{ photo_id: string; guest_id: string }>
  ): PhotoScore {
    const reasons: string[] = [];
    let score = 0;

    const pattern = patterns.get(photoId);
    if (!pattern) {
      return { photoId, score: 0, reasons: [], relatedGuests: 0 };
    }

    // 1. Popularity score (how many guests selected it)
    const popularityScore = Math.min(pattern.guestCount * 2, 30);
    if (popularityScore > 0) {
      reasons.push(`${pattern.guestCount} guest${pattern.guestCount > 1 ? 's' : ''} selected this`);
    }
    score += popularityScore;

    // 2. Affinity score (how many of your selections were also selected by guests who selected this)
    let affinityScore = 0;
    for (const yourPhoto of allFavorites
      .filter(f => f.photo_id in Array.from(patterns.keys()))
      .map(f => f.photo_id)) {
      const coOccurrence = pattern.coOccurrences.get(yourPhoto) || 0;
      affinityScore += coOccurrence * 3;
    }
    if (affinityScore > 0) {
      reasons.push('Matches your taste');
    }
    score += affinityScore;

    // 3. Collaborative score (guests with similar taste selected this)
    const relatedGuests = new Set(
      allFavorites
        .filter(f => pattern.coOccurrences.has(f.photo_id) && (pattern.coOccurrences.get(f.photo_id) || 0) > 0)
        .map(f => f.guest_id)
    ).size;

    if (relatedGuests > 0) {
      reasons.push(
        `${relatedGuests} guest${relatedGuests > 1 ? 's' : ''} with similar taste`
      );
    }
    score += relatedGuests * 1.5;

    // 4. Diversity bonus (offset toward less obvious choices)
    const diversityBonus = Math.max(0, 5 - pattern.guestCount);
    if (diversityBonus > 0) {
      reasons.push('Unique choice');
    }
    score += diversityBonus;

    return {
      photoId,
      score: Math.round(score * 100) / 100,
      reasons: reasons.slice(0, 2), // Show top 2 reasons
      relatedGuests,
    };
  }

  /**
   * Get detailed insights about selection trends
   */
  async getSelectionInsights(selectionId: string): Promise<{
    totalPhotos: number;
    totalSelections: number;
    avgSelectionsPerPhoto: number;
    mostPopularPhotos: string[];
  }> {
    try {
      const { data: favorites } = await supabase
        .from('photo_favorites')
        .select('photo_id')
        .eq('selection_id', selectionId);

      if (!favorites) {
        return {
          totalPhotos: 0,
          totalSelections: 0,
          avgSelectionsPerPhoto: 0,
          mostPopularPhotos: [],
        };
      }

      const photoCount = new Map<string, number>();
      for (const fav of favorites) {
        photoCount.set(fav.photo_id, (photoCount.get(fav.photo_id) || 0) + 1);
      }

      const sortedPhotos = Array.from(photoCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([photoId]) => photoId);

      return {
        totalPhotos: photoCount.size,
        totalSelections: favorites.length,
        avgSelectionsPerPhoto: favorites.length / photoCount.size,
        mostPopularPhotos: sortedPhotos,
      };
    } catch (error) {
      console.error('[SelectionAI] Error getting insights:', error);
      return {
        totalPhotos: 0,
        totalSelections: 0,
        avgSelectionsPerPhoto: 0,
        mostPopularPhotos: [],
      };
    }
  }
}

export function getSelectionAIService(): SelectionAIService {
  return SelectionAIService.getInstance();
}
