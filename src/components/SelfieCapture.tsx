import { Camera, Check, RefreshCw, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { extractFaceDescriptor } from '../lib/faceApi';
import { supabase } from '../lib/supabaseClient';

interface SelfieCaptureProps {
  onCaptureComplete: (img: HTMLImageElement, descriptor?: Float32Array) => void;
  onClose: () => void;
  title?: string;
  requireAuth?: boolean;
}

export function SelfieCapture({ 
  onCaptureComplete, 
  onClose, 
  title = "Set Up Face ID",
  requireAuth = true 
}: SelfieCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const retake = () => {
    setImgSrc(null);
    setError(null);
  };

  const processAndSave = async () => {
    if (!imgSrc) return;
    setIsProcessing(true);
    setError(null);

    try {
      // Create an image element to pass to face-api
      const img = new Image();
      img.src = imgSrc;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const descriptor = await extractFaceDescriptor(img);

      if (!descriptor) {
        setError("No face detected. Please ensure your face is clearly visible, well-lit, and try again.");
        setIsProcessing(false);
        return;
      }

      // If requireAuth is true, we save to the profile
      if (requireAuth) {
        const vectorString = `[${Array.from(descriptor).join(',')}]`;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error("Not authenticated");

        // Save to Supabase profiles
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ selfie_descriptor: vectorString })
          .eq('id', user.id);

        if (updateError) throw updateError;
      }

      onCaptureComplete(img, descriptor);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process face");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-gray-50">
          {!imgSrc ? (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                className="w-full h-full object-cover"
                disablePictureInPicture={false}
                forceScreenshotSourceSize={false}
                imageSmoothing={true}
                mirrored={false}
                minScreenshotHeight={0}
                minScreenshotWidth={0}
                onUserMedia={() => { }}
                onUserMediaError={() => { }}
                screenshotQuality={0.92}
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <button
                  onClick={capture}
                  className="bg-white text-rose-600 p-4 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-[3/4]">
              <img src={imgSrc} alt="Selfie preview" className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={retake}
                  disabled={isProcessing}
                  className="bg-white text-gray-700 px-6 py-2 rounded-full shadow-lg hover:bg-gray-100 font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> Retake
                </button>
                <button
                  onClick={processAndSave}
                  disabled={isProcessing}
                  className="bg-rose-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-rose-700 font-medium flex items-center gap-2 disabled:opacity-50"
                  title="Save Face ID"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Processing...' : 'Save Face ID'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 max-h-64 overflow-y-auto">
              <p className="font-semibold mb-2">Face Detection Error</p>
              <p className="whitespace-pre-wrap text-xs font-mono leading-relaxed">{error}</p>
              {error.includes('Model file corrupted') && (
                <div className="mt-3 pt-3 border-t border-red-200 text-xs">
                  <p className="font-semibold mb-1">Quick Fix:</p>
                  <p>Run <code className="bg-red-100 px-2 py-1 rounded">npm run download:models</code> then restart the dev server.</p>
                  <p className="mt-2 text-red-600">See _docs/FACE_API_TROUBLESHOOTING.md for detailed help.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Position your face clearly in the frame. We only store an encrypted mathematical vector representing your facial features—never the raw image. This ensures your privacy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
