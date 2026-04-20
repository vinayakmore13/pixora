import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Wifi, WifiOff, Play, Square, Settings, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { CameraSyncService, CameraConfig, CameraType, CameraSyncStats, saveCameraSyncSettings, loadCameraSyncSettings } from '../lib/cameraSync';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface CameraSyncProps {
  eventId: string;
  eventTitle?: string;
}

export function CameraSync({ eventId, eventTitle }: CameraSyncProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('canon');
  const [ipAddress, setIpAddress] = useState('192.168.1.1');
  const [port, setPort] = useState('8080');
  const [syncService, setSyncService] = useState<CameraSyncService | null>(null);
  const [stats, setStats] = useState<CameraSyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: null,
    isRunning: false,
    currentCamera: null
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedConfig = await loadCameraSyncSettings(eventId);
        if (savedConfig) {
          setCameraType(savedConfig.type);
          if (savedConfig.ipAddress) setIpAddress(savedConfig.ipAddress);
          if (savedConfig.port) setPort(savedConfig.port.toString());
        }
      } catch (error) {
        console.error('Failed to load camera sync settings:', error);
      }
    };
    loadSettings();
  }, [eventId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncService) {
        syncService.stop();
      }
    };
  }, [syncService]);

  const handleStatsUpdate = useCallback((newStats: CameraSyncStats) => {
    setStats(newStats);
  }, []);

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    setConnectionStatus('error');
  }, []);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    setErrorMessage(null);

    try {
      const config: CameraConfig = {
        type: cameraType,
        ipAddress,
        port: parseInt(port)
      };

      const service = new CameraSyncService(config, eventId, user?.id || '');
      const connected = await service.testConnection();

      if (connected) {
        setConnectionStatus('success');
        setIsConnected(true);
      } else {
        setConnectionStatus('error');
        setErrorMessage('Failed to connect to camera');
        setIsConnected(false);
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed');
      setIsConnected(false);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const startSync = async () => {
    if (!user) return;

    try {
      setErrorMessage(null);

      const config: CameraConfig = {
        type: cameraType,
        ipAddress,
        port: parseInt(port)
      };

      const service = new CameraSyncService(config, eventId, user.id, {
        onStatsUpdate: handleStatsUpdate,
        onError: handleError
      });

      await service.start();

      setSyncService(service);
      setIsSyncing(true);
      setIsConnected(true);

      // Save settings
      await saveCameraSyncSettings(eventId, config);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start sync');
      setConnectionStatus('error');
    }
  };

  const stopSync = async () => {
    if (syncService) {
      await syncService.stop();
      setSyncService(null);
    }
    setIsSyncing(false);
    setStats(prev => ({ ...prev, isRunning: false }));
  };

  const getCameraTypeLabel = (type: CameraType): string => {
    const labels: Record<CameraType, string> = {
      canon: 'Canon',
      sony: 'Sony',
      nikon: 'Nikon',
      phone: 'Phone Camera'
    };
    return labels[type];
  };

  const getCameraTypeDescription = (type: CameraType): string => {
    const descriptions: Record<CameraType, string> = {
      canon: 'Connect via Canon CCAPI (WiFi)',
      sony: 'Connect via Sony Imaging Edge (WiFi)',
      nikon: 'Connect via Nikon SnapBridge (WiFi)',
      phone: 'Use phone camera with auto-upload'
    };
    return descriptions[type];
  };

  return (
    <div className="bg-white rounded-[2.5rem] silk-shadow border border-outline-variant/5 overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-outline-variant/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-on-surface">Camera Auto-Sync</h3>
              <p className="text-sm text-on-surface-variant">
                {eventTitle ? `Sync photos for ${eventTitle}` : 'Connect your camera for automatic photo upload'}
              </p>
            </div>
          </div>
          {isSyncing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-green-600">Live Syncing</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {/* Camera Type Selection */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">
            Camera Type
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(['canon', 'sony', 'nikon', 'phone'] as CameraType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setCameraType(type);
                  setConnectionStatus('idle');
                  setIsConnected(false);
                }}
                disabled={isSyncing}
                className={cn(
                  "relative p-4 rounded-2xl text-left transition-all border-2",
                  cameraType === type
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/10 bg-surface-container-low hover:border-primary/30",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    cameraType === type ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
                  )}>
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{getCameraTypeLabel(type)}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {type === 'phone' ? 'Mobile' : 'WiFi'}
                    </p>
                  </div>
                </div>
                {cameraType === type && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            {getCameraTypeDescription(cameraType)}
          </p>
        </div>

        {/* Connection Settings */}
        {cameraType !== 'phone' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Connection Settings
              </label>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                  Camera IP Address
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.1"
                  disabled={isSyncing}
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                  Port
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="8080"
                  disabled={isSyncing}
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {showAdvanced && (
              <div className="p-4 bg-surface-container-low rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-on-surface">Advanced Settings</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      Sync Interval (seconds)
                    </label>
                    <input
                      type="number"
                      defaultValue={10}
                      min={5}
                      max={60}
                      disabled={isSyncing}
                      className="w-full bg-white border border-outline-variant/10 rounded-xl py-2 px-3 text-sm font-medium focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      Max Concurrent Uploads
                    </label>
                    <input
                      type="number"
                      defaultValue={2}
                      min={1}
                      max={5}
                      disabled={isSyncing}
                      className="w-full bg-white border border-outline-variant/10 rounded-xl py-2 px-3 text-sm font-medium focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connection Status */}
        <div className={cn(
          "p-4 rounded-2xl border-2",
          connectionStatus === 'success' ? "bg-green-50 border-green-200" :
          connectionStatus === 'error' ? "bg-red-50 border-red-200" :
          connectionStatus === 'testing' ? "bg-blue-50 border-blue-200" :
          "bg-surface-container-low border-outline-variant/10"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connectionStatus === 'success' ? (
                <Wifi className="w-5 h-5 text-green-600" />
              ) : connectionStatus === 'error' ? (
                <WifiOff className="w-5 h-5 text-red-600" />
              ) : connectionStatus === 'testing' ? (
                <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              ) : (
                <WifiOff className="w-5 h-5 text-on-surface-variant" />
              )}
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {connectionStatus === 'success' ? 'Connected' :
                   connectionStatus === 'error' ? 'Connection Failed' :
                   connectionStatus === 'testing' ? 'Testing Connection...' :
                   'Not Connected'}
                </p>
                {errorMessage && (
                  <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
                )}
              </div>
            </div>
            {!isSyncing && cameraType !== 'phone' && (
              <button
                onClick={testConnection}
                disabled={isTestingConnection}
                className="px-4 py-2 bg-white border border-outline-variant/20 text-on-surface rounded-full text-xs font-bold hover:bg-surface-container-low transition-all active:scale-95 disabled:opacity-50"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {isSyncing && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-low rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.totalSynced}</p>
              <p className="text-xs text-on-surface-variant">Photos Synced</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.totalFailed}</p>
              <p className="text-xs text-on-surface-variant">Failed</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-on-surface">
                {stats.lastSyncTime ? '✓' : '-'}
              </p>
              <p className="text-xs text-on-surface-variant">Last Sync</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.isRunning ? '●' : '○'}
              </p>
              <p className="text-xs text-on-surface-variant">Status</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isSyncing ? (
            <button
              onClick={startSync}
              disabled={!isConnected && cameraType !== 'phone'}
              className="w-full signature-gradient text-white py-4 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              Start Auto-Sync
            </button>
          ) : (
            <button
              onClick={stopSync}
              className="w-full bg-red-600 text-white py-4 rounded-full font-bold active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-700"
            >
              <Square className="w-5 h-5" />
              Stop Auto-Sync
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
          <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            How to Connect Your {getCameraTypeLabel(cameraType)} Camera
          </h4>
          <ol className="text-xs text-on-surface-variant space-y-2 list-decimal list-inside">
            {cameraType === 'canon' && (
              <>
                <li>Enable WiFi on your Canon camera (Menu → WiFi settings)</li>
                <li>Connect your phone to the camera's WiFi network</li>
                <li>Note the camera's IP address (usually 192.168.1.1)</li>
                <li>Enter the IP address above and click "Test Connection"</li>
                <li>Once connected, click "Start Auto-Sync"</li>
                <li>Take photos - they'll upload automatically every 10 seconds!</li>
              </>
            )}
            {cameraType === 'sony' && (
              <>
                <li>Install Sony Imaging Edge Mobile on your phone</li>
                <li>Enable WiFi on your Sony camera</li>
                <li>Connect your phone to the camera's WiFi network</li>
                <li>Enter the camera's IP address above</li>
                <li>Click "Test Connection" to verify</li>
                <li>Start Auto-Sync and take photos!</li>
              </>
            )}
            {cameraType === 'nikon' && (
              <>
                <li>Enable WiFi on your Nikon camera</li>
                <li>Connect your phone to the camera's WiFi network</li>
                <li>Enter the camera's IP address above</li>
                <li>Test the connection</li>
                <li>Start Auto-Sync - photos will upload automatically!</li>
              </>
            )}
            {cameraType === 'phone' && (
              <>
                <li>Use your phone's camera app to take photos</li>
                <li>Photos will be automatically detected and uploaded</li>
                <li>No additional setup required!</li>
                <li>Just click "Start Auto-Sync" to begin</li>
              </>
            )}
          </ol>
        </div>

        {/* Tips */}
        <div className="p-4 bg-surface-container-low rounded-2xl">
          <h4 className="text-xs font-bold text-on-surface mb-2">💡 Pro Tips</h4>
          <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
            <li>Keep your phone connected to the camera's WiFi during the event</li>
            <li>Photos sync every 10 seconds automatically</li>
            <li>Guests can scan QR codes immediately after photos are taken</li>
            <li>Battery tip: Keep your phone plugged in during long events</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
