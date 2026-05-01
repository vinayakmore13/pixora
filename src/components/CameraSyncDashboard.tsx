import { Pause, Play, RefreshCw, Settings, Smartphone, Trash2, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CameraConfig, CameraSyncService, CameraSyncStats } from '../lib/cameraSync';
import { cn } from '../lib/utils';

interface CameraSyncDashboardProps {
  eventId: string;
  config: CameraConfig;
  isActive: boolean;
  onToggleSync: (active: boolean) => void;
  onConfigChange: () => void;
  onRemove: () => void;
}

export function CameraSyncDashboard({
  eventId,
  config,
  isActive,
  onToggleSync,
  onConfigChange,
  onRemove,
}: CameraSyncDashboardProps) {
  const [stats, setStats] = useState<CameraSyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: null,
    isRunning: false,
    currentCamera: config.type,
  });

  const [service, setService] = useState<CameraSyncService | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newService = new CameraSyncService(config, eventId, 'current-user', {
      onStatsUpdate: (newStats) => {
        setStats(newStats);
        if (newStats.isRunning && newStats.lastSyncTime) {
          setStatusMessage(`Synced ${newStats.totalSynced} photos...`);
        }
      },
      onError: (error) => {
        setStatusMessage(`Error: ${error}`);
        setIsConnected(false);
      },
      onPhotoSynced: (photo) => {
        setStatusMessage(`Synced: ${photo.fileName}`);
      },
    });

    setService(newService);

    return () => {
      newService.stop();
    };
  }, [config, eventId]);

  const handleToggleSync = async () => {
    if (!service) return;

    try {
      if (isActive) {
        await service.stop();
        setIsConnected(false);
        setStatusMessage('Sync stopped');
      } else {
        const connected = await service.testConnection();
        if (!connected) {
          setStatusMessage('Failed to connect to camera');
          return;
        }
        setIsConnected(true);
        await service.start();
        setStatusMessage('Syncing...');
      }
      onToggleSync(!isActive);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(`Connection failed: ${message}`);
    }
  };

  const getCameraName = () => {
    switch (config.type) {
      case 'canon':
        return 'Canon Camera';
      case 'sony':
        return 'Sony Camera';
      case 'nikon':
        return 'Nikon Camera';
      case 'phone':
        return 'Mobile Device';
      default:
        return 'Unknown Camera';
    }
  };

  const getLastSyncDisplay = () => {
    if (!stats.lastSyncTime) return 'Never';

    const date = new Date(stats.lastSyncTime);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg">
              {config.type === 'phone' ? (
                <Smartphone size={24} className="text-blue-600" />
              ) : (
                <Wifi size={24} className="text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{getCameraName()}</h3>
              {config.ipAddress && (
                <p className="text-xs text-gray-600 font-mono">{config.ipAddress}:{config.port || 8080}</p>
              )}
            </div>
          </div>
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-bold',
              isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalSynced}</div>
          <p className="text-xs text-gray-600 mt-1 font-semibold">Photos Synced</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.totalFailed}</div>
          <p className="text-xs text-gray-600 mt-1 font-semibold">Failed</p>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{getLastSyncDisplay()}</div>
          <p className="text-xs text-gray-600 mt-1 font-semibold">Last Sync</p>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={cn(
          'px-6 py-3 border-b border-gray-200 flex items-center gap-2 text-sm',
          isConnected ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
        )}>
          {isConnected && <RefreshCw size={16} className="animate-spin" />}
          {statusMessage}
        </div>
      )}

      {/* Progress Bar */}
      {isActive && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Upload Activity</span>
            <span className="text-xs font-bold text-gray-900">
              {isConnected ? 'Active' : 'Paused'}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isConnected ? 'bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse' : 'bg-gray-400'
              )}
              style={{ width: isConnected ? '75%' : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 flex gap-2">
        <button
          onClick={handleToggleSync}
          className={cn(
            'flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2',
            isActive
              ? 'bg-red-100 hover:bg-red-200 text-red-700'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          {isActive ? (
            <>
              <Pause size={16} />
              Stop Sync
            </>
          ) : (
            <>
              <Play size={16} />
              Start Sync
            </>
          )}
        </button>

        <button
          onClick={onConfigChange}
          title="Edit camera settings"
          className="p-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <Settings size={16} className="text-gray-600" />
        </button>

        <button
          onClick={onRemove}
          title="Remove this camera"
          className="p-2.5 rounded-lg border border-gray-300 hover:bg-red-50 hover:border-red-200 transition-colors"
        >
          <Trash2 size={16} className="text-gray-600 hover:text-red-600" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <p>
          {config.type === 'phone'
            ? '📱 Mobile sync enabled. Photos will auto-upload when connected to WiFi.'
            : `🔗 Camera IP: ${config.ipAddress}${config.autoConnect ? ' • Auto-connect enabled' : ''}`}
        </p>
      </div>
    </div>
  );
}

