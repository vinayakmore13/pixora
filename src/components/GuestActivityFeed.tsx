import { Clock, Heart, LogIn, LogOut } from 'lucide-react';
import { GuestActivity } from '../lib/realtimeSelection';

interface GuestActivityFeedProps {
  activities: GuestActivity[];
  maxItems?: number;
  compact?: boolean;
}

export function GuestActivityFeed({
  activities = [],
  maxItems = 5,
  compact = false,
}: GuestActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (displayActivities.length === 0) {
    return (
      <div className="text-center text-on-surface-variant/60 text-sm py-4">
        Waiting for guest activity...
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {displayActivities.map((activity, idx) => (
        <div
          key={`${activity.guest_id}-${idx}-${activity.timestamp}`}
          className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'} text-on-surface-variant`}
        >
          {/* Action icon */}
          <div className="flex-shrink-0">
            {activity.action === 'joined' && (
              <LogIn size={compact ? 14 : 16} className="text-green-600" />
            )}
            {activity.action === 'selected' && (
              <Heart size={compact ? 14 : 16} className="text-red-600 fill-red-600" />
            )}
            {activity.action === 'deselected' && (
              <Heart size={compact ? 14 : 16} className="text-gray-400" />
            )}
            {activity.action === 'submitted' && (
              <LogOut size={compact ? 14 : 16} className="text-blue-600" />
            )}
          </div>

          {/* Activity text */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-on-surface truncate">
              {activity.guest_name}
            </span>
            <span className="ml-1">
              {activity.action === 'joined' && 'joined the selection'}
              {activity.action === 'selected' && 'selected a photo'}
              {activity.action === 'deselected' && 'removed a selection'}
              {activity.action === 'submitted' && 'submitted their selections'}
            </span>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1 flex-shrink-0 text-on-surface-variant/50">
            <Clock size={compact ? 12 : 14} />
            <span className="text-xs">
              {formatTime(activity.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(timestamp: string): string {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffMs = now.getTime() - activityTime.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else {
    return activityTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

interface GuestPresenceProps {
  guests: Array<{
    guest_id: string;
    guest_name: string;
    selection_count: number;
    is_active: boolean;
  }>;
  maxPhotos: number;
}

export function GuestPresence({ guests, maxPhotos }: GuestPresenceProps) {
  if (guests.length === 0) {
    return (
      <div className="text-center text-on-surface-variant/60 text-sm py-4">
        No other guests currently active
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {guests.map((guest) => (
        <div
          key={guest.guest_id}
          className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-600" />
              <span className="font-medium text-on-surface">{guest.guest_name}</span>
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {guest.selection_count} of {maxPhotos} selected
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 ml-4">
            <div className="w-full h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(guest.selection_count / maxPhotos) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

