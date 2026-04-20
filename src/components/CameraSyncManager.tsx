import { AlertCircle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CameraConfig } from '../lib/cameraSync';
import { CameraSyncDashboard } from './CameraSyncDashboard';
import { CameraSyncSetup } from './CameraSyncSetup';

interface CameraSession {
  config: CameraConfig;
  isActive: boolean;
}

interface CameraSyncManagerProps {
  eventId: string;
  onSyncUpdate?: (totalPhotos: number) => void;
}

export function CameraSyncManager({ eventId, onSyncUpdate }: CameraSyncManagerProps) {
  const [cameras, setCameras] = useState<CameraSession[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Load camera configurations from localStorage for demo
  useEffect(() => {
    const saved = localStorage.getItem(`camera-sync-${eventId}`);
    if (saved) {
      try {
        setCameras(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load camera config:', error);
      }
    }
  }, [eventId]);

  // Save to localStorage whenever cameras change
  useEffect(() => {
    localStorage.setItem(`camera-sync-${eventId}`, JSON.stringify(cameras));
  }, [cameras, eventId]);

  const handleAddCamera = (config: CameraConfig) => {
    if (editingIndex !== null) {
      // Update existing camera
      const updated = [...cameras];
      updated[editingIndex] = { config, isActive: false };
      setCameras(updated);
      setEditingIndex(null);
    } else {
      // Add new camera
      setCameras(prev => [...prev, { config, isActive: false }]);
    }
    setShowSetup(false);
  };

  const handleToggleSync = (index: number, active: boolean) => {
    setCameras(prev => {
      const updated = [...prev];
      updated[index].isActive = active;
      return updated;
    });
  };

  const handleRemoveCamera = (index: number) => {
    setCameras(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditCamera = (index: number) => {
    setEditingIndex(index);
    setShowSetup(true);
  };

  const activeCameras = cameras.filter(c => c.isActive).length;
  const totalCameras = cameras.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Camera Sync</h2>
          <p className="text-gray-600 mt-1">
            {totalCameras === 0
              ? 'Connect your cameras to auto-sync photos while shooting'
              : `${activeCameras} of ${totalCameras} camera${totalCameras !== 1 ? 's' : ''} ${activeCameras > 0 ? 'syncing' : 'configured'}`}
          </p>
        </div>
        {totalCameras < 4 && (
          <button
            onClick={() => {
              setEditingIndex(null);
              setShowSetup(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Camera
          </button>
        )}
      </div>

      {/* Setup Dialog */}
      {showSetup && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingIndex !== null ? 'Edit Camera Configuration' : 'Add New Camera'}
            </h3>
            <button
              onClick={() => {
                setShowSetup(false);
                setEditingIndex(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>

          <CameraSyncSetup
            onConfigured={handleAddCamera}
            isLoading={false}
          />
        </div>
      )}

      {/* Info Banner */}
      {totalCameras === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="inline-block p-3 bg-blue-100 rounded-full mb-3">
            <AlertCircle size={32} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">No Cameras Connected</h3>
          <p className="text-gray-600 mb-4">
            Connect your WiFi-enabled camera to start auto-syncing photos during your event.
            No more USB cables!
          </p>
          <button
            onClick={() => {
              setEditingIndex(null);
              setShowSetup(true);
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Connect First Camera
          </button>
        </div>
      ) : (
        <>
          {/* Camera List */}
          <div className="space-y-4">
            {cameras.map((session, index) => (
              <div key={`${session.config.type}-${index}`}>
                <CameraSyncDashboard
                  eventId={eventId}
                  config={session.config}
                  isActive={session.isActive}
                  onToggleSync={(active) => handleToggleSync(index, active)}
                  onConfigChange={() => handleEditCamera(index)}
                  onRemove={() => handleRemoveCamera(index)}
                />
              </div>
            ))}
          </div>

          {/* Add More Button */}
          {totalCameras < 4 && (
            <button
              onClick={() => {
                setEditingIndex(null);
                setShowSetup(true);
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-blue-600 hover:border-blue-300 font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Another Camera
            </button>
          )}
        </>
      )}

      {/* Tips Section */}
      {totalCameras > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-bold text-amber-900 text-sm mb-2">💡 Pro Tips:</p>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• Start sync before you begin shooting for peace of mind</li>
            <li>• Keep your camera on WiFi and within range during the event</li>
            <li>• Photos sync in the background while you work</li>
            <li>• Battery usage is minimal compared to tethering</li>
          </ul>
        </div>
      )}
    </div>
  );
}
