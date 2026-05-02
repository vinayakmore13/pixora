import { AlertCircle, CheckCircle2, Clock, Trash2, Upload, X } from 'lucide-react';
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatFileSize, getCompressionRatio } from '../lib/imageCompression';
import { supabase } from '../lib/supabaseClient';
import { UploadFile, UploadManager } from '../lib/uploadManager';
import { cn } from '../lib/utils';

export function UploadPhotos() {
  const { user, profile } = useAuth();
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [events, setEvents] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  
  // Find selected event name for organized storage
  const selectedEventName = React.useMemo(() => 
    events.find(e => e.id === selectedEventId)?.name || '', 
  [events, selectedEventId]);

  const [selectedAlbum, setSelectedAlbum] = React.useState<string>('Ceremony');
  const [uploadType, setUploadType] = React.useState<'raw' | 'edited'>('raw');
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadManager, setUploadManager] = React.useState<UploadManager | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch user's events
  React.useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      setEvents(data || []);
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Initialize upload manager when event is selected
  React.useEffect(() => {
    if (selectedEventId && user) {
      // Auto-ensure selection portal exists when an event is selected for upload
      import('../lib/selectionHelpers').then(({ ensurePhotoSelectionPortal }) => {
        ensurePhotoSelectionPortal(selectedEventId);
      });

      const manager = new UploadManager({
        eventId: selectedEventId,
        eventName: selectedEventName,
        photographerName: profile?.full_name || profile?.studio_name || user.email || 'photographer',
        maxConcurrent: 3,
        uploaderId: user.id,
        isGuestUpload: false,
        isEdited: uploadType === 'edited',
        isInSelectionPool: true, // By default, photographer uploads should be in selection pool
        onProgress: (progress) => {
          setFiles(prev => prev.map(f =>
            f.id === progress.fileId
              ? { ...f, progress: progress.progress, status: progress.status, error: progress.error }
              : f
          ));
        },
        onComplete: (result) => {
          if (!result.success) {
            console.error('Upload failed:', result.error);
          }
        },
      });
      setUploadManager(manager);
      return () => {
        manager.cancelUploads();
        manager.clearFiles();
      };
    }
  }, [selectedEventId, user, uploadType]);

  // Handle file selection
  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || !uploadManager) return;

    const imageFiles = Array.from(selectedFiles).filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) return;

    const newUploadFiles = uploadManager.addFiles(imageFiles);
    setFiles(prev => [...prev, ...newUploadFiles]);
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Handle click to select files
  const handleSelectFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    e.target.value = ''; // Reset input
  };

  // Start upload
  const handleStartUpload = async () => {
    if (!uploadManager || files.length === 0) return;

    setIsUploading(true);
    await uploadManager.startUpload();
    setIsUploading(false);
  };

  // Cancel all uploads
  const handleCancelAll = () => {
    if (!uploadManager) return;
    uploadManager.cancelUploads();
    setIsUploading(false);
  };

  // Clear all files
  const handleClearAll = () => {
    if (!uploadManager) return;
    uploadManager.clearFiles();
    setFiles([]);
  };

  // Remove single file
  const handleRemoveFile = (fileId: string) => {
    if (!uploadManager) return;
    uploadManager.removeFile(fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Calculate stats
  const stats = uploadManager?.getStats() || {
    total: 0,
    pending: 0,
    compressing: 0,
    uploading: 0,
    saving: 0,
    completed: 0,
    error: 0,
    totalSize: 0,
    compressedSize: 0,
  };

  const overallProgress = stats.total > 0
    ? Math.round(
      (files.reduce((sum, f) => sum + f.progress, 0) / (stats.total * 100)) * 100
    )
    : 0;

  return (
    <div className="min-h-screen bg-surface flex pt-20">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Sidebar Controls */}
      <aside className="w-80 fixed left-0 top-20 bottom-0 bg-white border-r border-outline-variant/10 p-8 hidden lg:block">
        <div className="space-y-10">
          <div>
            <h2 className="text-2xl font-serif font-bold text-on-surface mb-6">Upload Photos</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Select Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
                >
                  {events.length === 0 ? (
                    <option value="">No events available</option>
                  ) : (
                    events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Select Album</label>
                <select
                  value={selectedAlbum}
                  onChange={(e) => setSelectedAlbum(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
                >
                  <option>Ceremony</option>
                  <option>Reception</option>
                  <option>Guest Candid</option>
                  <option>+ Create New Album</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Upload Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadType('raw')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      uploadType === 'raw' 
                        ? "bg-primary text-white" 
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    Raw/Event
                  </button>
                  <button
                    onClick={() => setUploadType('edited')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      uploadType === 'edited' 
                        ? "bg-primary text-white" 
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    Edited
                  </button>
                </div>
              </div>

              {/* Informational Banner */}
              <div className="pt-2">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3">
                  <CheckCircle2 className="text-primary shrink-0" size={18} />
                  <div>
                    <p className="text-[11px] leading-tight text-primary font-bold mb-1">
                      Automated Selection Pool
                    </p>
                    <p className="text-[10px] leading-tight text-on-surface-variant">
                      Photos you upload are automatically added to the client selection portal. No manual curation needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-[2rem]">
            <h3 className="text-sm font-bold text-on-surface mb-4">Upload Summary</h3>
            <div className="space-y-3">
              <SummaryItem label="Total Files" value={stats.total.toString()} />
              <SummaryItem label="Total Size" value={formatFileSize(stats.totalSize)} />
              {stats.compressedSize > 0 && stats.compressedSize < stats.totalSize && (
                <SummaryItem
                  label="Compressed"
                  value={`${formatFileSize(stats.compressedSize)} (${getCompressionRatio(stats.totalSize, stats.compressedSize)}% saved)`}
                />
              )}
              <SummaryItem label="Completed" value={`${stats.completed}/${stats.total}`} />
            </div>
            <div className="mt-6 pt-6 border-t border-outline-variant/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-on-surface">Overall Progress</span>
                <span className="text-xs font-bold text-primary">{overallProgress}%</span>
              </div>
              <div className="w-full h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleStartUpload}
              disabled={isUploading || files.length === 0 || stats.pending === 0}
              className="w-full signature-gradient text-white py-4 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Start Upload'}
            </button>
            <button
              onClick={handleCancelAll}
              disabled={!isUploading}
              className="w-full bg-white border border-outline-variant/20 text-on-surface py-4 rounded-full font-bold hover:bg-surface-container-low transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel All
            </button>
          </div>
        </div>
      </aside>

      {/* Main Upload Area */}
      <main className="flex-1 lg:ml-80 p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Dropzone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleSelectFilesClick}
            className={cn(
              "bg-white border-2 border-dashed rounded-[3rem] p-16 text-center group transition-all cursor-pointer silk-shadow",
              isDragging ? "border-primary bg-primary/5" : "border-outline-variant/30 hover:border-primary"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform",
              isDragging ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
            )}>
              <Upload size={40} />
            </div>
            <h3 className="text-2xl font-bold text-on-surface mb-2">
              {isDragging ? 'Drop photos here' : 'Drag and drop photos here'}
            </h3>
            <p className="text-on-surface-variant mb-8">Support for JPG, PNG, and HEIC up to 200MB per file.</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFilesClick();
              }}
              className="bg-on-surface text-white px-10 py-4 rounded-full font-bold hover:bg-on-surface/90 transition-all active:scale-95"
            >
              Select Files from Computer
            </button>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white rounded-[2.5rem] silk-shadow border border-outline-variant/5 overflow-hidden">
              <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 className="text-xl font-bold text-on-surface">Files to Upload</h3>
                <button
                  onClick={handleClearAll}
                  className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Trash2 size={14} /> Clear All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 border-b border-outline-variant/5">
                      <th className="px-8 py-4">File</th>
                      <th className="px-8 py-4">Size</th>
                      <th className="px-8 py-4">Progress</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {files.map((file) => (
                      <tr key={file.id} className="group hover:bg-surface-container-low transition-colors">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant/10">
                              <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-on-surface">{file.file.name}</span>
                              {file.compressedSize && file.compressedSize < file.originalSize && (
                                <p className="text-xs text-on-surface-variant">
                                  Compressed: {formatFileSize(file.compressedSize)} ({getCompressionRatio(file.originalSize, file.compressedSize)}% saved)
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm text-on-surface-variant">
                          {formatFileSize(file.originalSize)}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-500",
                                  file.status === 'error' ? 'bg-red-500' : 'bg-primary'
                                )}
                                style={{ width: `${file.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-bold text-on-surface-variant">{file.progress}%</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <StatusBadge status={file.status} error={file.error} />
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                            disabled={file.status === 'uploading' || file.status === 'compressing' || file.status === 'saving'}
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
      <span className="text-xs font-bold text-on-surface">{value}</span>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string, error?: string }) {
  const configs: Record<string, { icon: React.ReactNode, label: string, color: string }> = {
    completed: { icon: <CheckCircle2 size={14} />, label: 'Completed', color: 'text-green-600 bg-green-50' },
    uploading: { icon: <Clock size={14} />, label: 'Uploading', color: 'text-primary bg-primary/5' },
    compressing: { icon: <Clock size={14} />, label: 'Compressing', color: 'text-blue-600 bg-blue-50' },
    saving: { icon: <Clock size={14} />, label: 'Saving', color: 'text-purple-600 bg-purple-50' },
    pending: { icon: <AlertCircle size={14} />, label: 'Pending', color: 'text-on-surface-variant/60 bg-surface-container-high' },
    error: { icon: <AlertCircle size={14} />, label: error || 'Error', color: 'text-red-600 bg-red-50' },
  };

  const config = configs[status] || configs.pending;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
      config.color
    )}>
      {config.icon}
      {config.label}
    </div>
  );
}

