import { AlertCircle, CheckCircle2, Loader2, Wifi } from 'lucide-react';
import React, { useState } from 'react';
import { CameraConfig, CameraType } from '../lib/cameraSync';
import { cn } from '../lib/utils';

interface CameraSyncSetupProps {
  onConfigured: (config: CameraConfig) => void;
  isLoading?: boolean;
}

const CAMERA_OPTIONS: Array<{ type: CameraType; name: string; icon: React.ReactNode }> = [
  { type: 'canon', name: 'Canon (EOS/PowerShot)', icon: '📷' },
  { type: 'sony', name: 'Sony (Alpha/RX)', icon: '📷' },
  { type: 'nikon', name: 'Nikon (Z/D)', icon: '📷' },
  { type: 'phone', name: 'Mobile Device', icon: '📱' }
];

export function CameraSyncSetup({ onConfigured, isLoading }: CameraSyncSetupProps) {
  const [selectedType, setSelectedType] = useState<CameraType | null>(null);
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('8080');
  const [autoConnect, setAutoConnect] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [step, setStep] = useState<'select' | 'config' | 'test'>('select');

  const handleSelectCamera = (type: CameraType) => {
    setSelectedType(type);
    if (type === 'phone') {
      // Phone doesn't need network config
      handleTest({
        type,
        autoConnect: true
      });
    } else {
      setStep('config');
    }
  };

  const handleTest = async (config: CameraConfig) => {
    setTesting(true);
    setTestResult(null);

    try {
      // For phone, skip network test
      if (config.type === 'phone') {
        setTestResult({
          success: true,
          message: `${CAMERA_OPTIONS.find(o => o.type === 'phone')?.name} is ready to sync!`
        });
        setTimeout(() => {
          onConfigured(config);
        }, 1500);
        return;
      }

      // Test network connection
      const testUrl = `http://${config.ipAddress}:${config.port || 8080}/`;
      const response = await Promise.race([
        fetch(testUrl, { method: 'HEAD', mode: 'no-cors' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);

      setTestResult({
        success: true,
        message: 'Camera found! Ready to start syncing.'
      });

      setTimeout(() => {
        onConfigured(config);
      }, 1500);
    } catch (error) {
      setTestResult({
        success: false,
        message:
          'Unable to connect. Ensure camera is on WiFi and correct IP address is entered.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = () => {
    if (!selectedType || !ipAddress) return;

    const config: CameraConfig = {
      type: selectedType,
      ipAddress: ipAddress.trim(),
      port: parseInt(port) || 8080,
      autoConnect
    };

    handleTest(config);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {step === 'select' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-blue-100 rounded-full mb-3">
              <Wifi size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Camera</h2>
            <p className="text-gray-600">Select your camera type to enable WiFi sync</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CAMERA_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => handleSelectCamera(option.type)}
                className={cn(
                  'p-4 rounded-lg border-2 transition-all text-left',
                  selectedType === option.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <p className="font-bold text-sm text-gray-900">{option.name}</p>
              </button>
            ))}
          </div>

          {selectedType && selectedType !== 'phone' && (
            <p className="text-xs text-blue-600 font-semibold">
              Next, enter your camera's WiFi network details
            </p>
          )}
        </div>
      )}

      {step === 'config' && selectedType && selectedType !== 'phone' && (
        <div className="space-y-4">
          <div className="mb-6">
            <button
              onClick={() => {
                setSelectedType(null);
                setStep('select');
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
            >
              ← Back
            </button>
            <h3 className="text-xl font-bold text-gray-900 mt-2">
              {CAMERA_OPTIONS.find(o => o.type === selectedType)?.name}
            </h3>
            <p className="text-sm text-gray-600">Enter your camera's network details</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Camera IP Address</label>
            <input
              type="text"
              placeholder="192.168.1.100"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find this in your camera's network settings or WiFi info
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Port (optional)</label>
            <input
              type="number"
              placeholder="8080"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-700">Auto-connect on startup</span>
          </label>

          <button
            onClick={handleContinue}
            disabled={!ipAddress || testing}
            className={cn(
              'w-full py-3 rounded-lg font-bold text-white transition-all',
              ipAddress && !testing
                ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            {testing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Testing connection...
              </span>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>
      )}

      {step === 'test' && testResult && (
        <div className="space-y-4">
          <div
            className={cn(
              'p-6 rounded-lg border-2 text-center',
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            )}
          >
            <div className="flex justify-center mb-3">
              {testResult.success ? (
                <CheckCircle2 size={48} className="text-green-600" />
              ) : (
                <AlertCircle size={48} className="text-red-600" />
              )}
            </div>
            <p
              className={cn(
                'text-lg font-bold mb-2',
                testResult.success ? 'text-green-900' : 'text-red-900'
              )}
            >
              {testResult.success ? 'Success!' : 'Connection Failed'}
            </p>
            <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
              {testResult.message}
            </p>
          </div>

          {!testResult.success && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Troubleshooting tips:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Ensure your camera is connected to WiFi</li>
                <li>• Check camera IP address in network settings</li>
                <li>• Verify both device and camera are on same network</li>
                <li>• Try restarting your camera</li>
              </ul>
              <button
                onClick={() => {
                  setTestResult(null);
                  setStep('config');
                }}
                className="w-full mt-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
