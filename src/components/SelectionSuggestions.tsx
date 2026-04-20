import { Lightbulb, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { PhotoScore } from '../lib/selectionAI';
import { cn } from '../lib/utils';

interface SelectionSuggestionsProps {
  suggestions: PhotoScore[];
  onSuggestedPhotoClick: (photoId: string) => void;
  selectedPhotoIds: Set<string>;
  isMobile?: boolean;
}

export function SelectionSuggestions({
  suggestions,
  onSuggestedPhotoClick,
  selectedPhotoIds,
  isMobile = false,
}: SelectionSuggestionsProps) {
  const visibleSuggestions = useMemo(() => {
    return suggestions.slice(0, isMobile ? 3 : 5);
  }, [suggestions, isMobile]);

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-blue-200 bg-blue-50 overflow-hidden',
        isMobile ? 'shadow-md' : 'shadow-lg'
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center gap-2">
        <Sparkles size={18} className="text-white" />
        <h3 className="text-sm font-bold text-white">AI Suggestions</h3>
        <span className="text-xs ml-auto bg-white/20 px-2 py-0.5 rounded-full text-white font-semibold">
          {visibleSuggestions.length}
        </span>
      </div>

      {/* Suggestions List */}
      <div className={cn(
        isMobile ? 'max-h-48 overflow-y-auto' : 'space-y-2 p-2'
      )}>
        {visibleSuggestions.map((suggestion, idx) => (
          <div
            key={suggestion.photoId}
            className={cn(
              'bg-white border-l-4 border-blue-500 p-3 hover:bg-blue-50 transition-colors cursor-pointer group',
              'flex items-start justify-between gap-3',
              idx === 0 && 'bg-blue-50',
            )}
            onClick={() => onSuggestedPhotoClick(suggestion.photoId)}
          >
            <div className="flex-1 min-w-0">
              {/* Confidence Score */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-blue-600" />
                  <span className="text-xs font-bold text-blue-600">
                    {Math.round(suggestion.score)}% match
                  </span>
                </div>
                {idx === 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Top Pick
                  </span>
                )}
              </div>

              {/* Reasons */}
              <div className="flex flex-col gap-0.5">
                {suggestion.reasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Lightbulb size={12} className="flex-shrink-0 text-amber-500" />
                    <p className="text-xs text-gray-700">{reason}</p>
                  </div>
                ))}
              </div>

              {/* Related Guests Count */}
              {suggestion.relatedGuests > 0 && (
                <p className="text-[11px] text-gray-500 mt-1.5">
                  👥 {suggestion.relatedGuests} guest{suggestion.relatedGuests > 1 ? 's' : ''} with similar taste
                </p>
              )}
            </div>

            {/* Action Badge */}
            <div className="flex-shrink-0 bg-blue-100 group-hover:bg-blue-200 rounded-lg p-2 transition-colors">
              <span className="text-xs font-bold text-blue-700">View</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {suggestions.length > visibleSuggestions.length && (
        <div className="bg-gray-50 px-4 py-2 border-t border-blue-200">
          <p className="text-xs text-gray-600">
            +{suggestions.length - visibleSuggestions.length} more suggestions available
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Smart Selection Assistant
 * Shows tips and insights as guests make selections
 */
export function SelectionAssistant({
  totalGuests,
  yourSelectionsCount,
  maxPhotos,
  isMobile = false,
}: {
  totalGuests: number;
  yourSelectionsCount: number;
  maxPhotos: number;
  isMobile?: boolean;
}) {
  const progressPercent = (yourSelectionsCount / maxPhotos) * 100;
  const remaining = maxPhotos - yourSelectionsCount;

  let assistantTip = '';
  let tipEmoji = '💡';

  if (yourSelectionsCount === 0) {
    assistantTip = `Start selecting! ${totalGuests} other guest${totalGuests > 1 ? 's' : ''} are also choosing.`;
    tipEmoji = '👀';
  } else if (yourSelectionsCount < maxPhotos * 0.3) {
    assistantTip = 'You\'re off to a great start! Check AI suggestions for similar photos.';
    tipEmoji = '🚀';
  } else if (yourSelectionsCount < maxPhotos * 0.7) {
    assistantTip = `Halfway there! ${remaining} more to go. Use compare mode to decide.`;
    tipEmoji = '⚡';
  } else if (yourSelectionsCount === maxPhotos) {
    assistantTip = 'Perfect! You\'ve completed your selections. Ready to submit?';
    tipEmoji = '✨';
  } else {
    assistantTip = `${remaining} spot${remaining > 1 ? 's' : ''} left. Browse more photos for variety.`;
    tipEmoji = '👌';
  }

  return (
    <div className={cn(
      'rounded-lg border border-amber-200 bg-amber-50 p-3',
      isMobile && 'text-sm'
    )}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{tipEmoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 mb-2">{assistantTip}</p>
          
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          
          <p className="text-[11px] text-amber-700 mt-2 font-medium">
            {yourSelectionsCount} / {maxPhotos} selected
          </p>
        </div>
      </div>
    </div>
  );
}
