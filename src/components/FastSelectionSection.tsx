import { 
  Camera, 
  ChevronRight, 
  Clock, 
  Copy, 
  ExternalLink, 
  LayoutGrid, 
  Loader2, 
  Plus, 
  Search, 
  Trash2, 
  Upload, 
  CheckCircle2,
  X,
  AlertCircle,
  Download,
  Check,
  CheckSquare,
  Files,
  ChevronLeft
} from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';
import { UploadFile, UploadManager } from '../lib/uploadManager';
import { formatFileSize, getCompressionRatio } from '../lib/imageCompression';

interface Session {
  id: string;
  name: string;
  selection_code: string;
  max_photos: number;
  status: 'pending' | 'submitted' | 'completed';
  created_at: string;
  expires_at: string;
  photo_count?: number;
  selected_count?: number;
}

export function FastSelectionSection() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-sessions' | 'create'>('my-sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [maxPhotos, setMaxPhotos] = useState(50);
  const [originalQuality, setOriginalQuality] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [newSessionCode, setNewSessionCode] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  // Upload state
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadManager, setUploadManager] = useState<UploadManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      checkAndCleanupExpiredSessions().then(() => {
        fetchSessions();
      });
    }
  }, [user]);

  const checkAndCleanupExpiredSessions = async () => {
    try {
      // 1. Find expired sessions
      const { data: expired } = await supabase
        .from('fast_selection_sessions')
        .select('id')
        .lt('expires_at', new Date().toISOString());

      if (expired && expired.length > 0) {
        console.log(`Found ${expired.length} expired sessions. Cleaning up...`);
        for (const session of expired) {
          await silentDeleteSession(session.id);
        }
      }
    } catch (err) {
      console.error("Auto-cleanup failed:", err);
    }
  };

  const silentDeleteSession = async (sessionId: string) => {
    try {
      // Fetch photos for storage deletion
      const { data: photos } = await supabase
        .from('fast_selection_photos')
        .select('file_path')
        .eq('session_id', sessionId);

      if (photos && photos.length > 0) {
        const paths = photos.map(p => p.file_path);
        await supabase.storage.from('photos').remove(paths);
      }

      // Delete from DB (cascade handles children)
      await supabase.from('fast_selection_sessions').delete().eq('id', sessionId);
    } catch (err) {
      console.error(`Silent delete failed for session ${sessionId}:`, err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this whole session? All photos and client selections will be permanently removed from storage and database.')) {
      return;
    }

    try {
      setLoading(true);
      await silentDeleteSession(sessionId);
      await fetchSessions();
      alert('Session deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete session');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fast_selection_sessions')
        .select('*')
        .eq('photographer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch counts for each
      const sessionsWithCounts = await Promise.all((data || []).map(async (s) => {
        const { count: photoCount } = await supabase
          .from('fast_selection_photos')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id);
          
        // Get total favorites across all clients for this session
        const { data: clients } = await supabase
          .from('fast_selection_clients')
          .select('id')
          .eq('session_id', s.id);
        
        let favCount = 0;
        if (clients && clients.length > 0) {
          const { count } = await supabase
            .from('fast_selection_favorites')
            .select('*', { count: 'exact', head: true })
            .in('client_id', clients.map(c => c.id));
          favCount = count || 0;
        }

        return { ...s, photo_count: photoCount || 0, selected_count: favCount };
      }));

      setSessions(sessionsWithCounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim() || !user) return;

    try {
      setIsCreating(true);
      const code = `FS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('fast_selection_sessions')
        .insert({
          photographer_id: user.id,
          name: sessionName,
          selection_code: code,
          max_photos: maxPhotos
        })
        .select()
        .single();

      if (error) throw error;

      setNewSessionId(data.id);
      setNewSessionCode(data.selection_code);
      
      // Initialize upload manager
      const manager = new UploadManager({
        fastSelectionId: data.id,
        uploaderId: user.id,
        skipCompression: originalQuality,
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
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      alert('Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || !uploadManager) return;
    const imageFiles = Array.from(selectedFiles).filter(file => file.type.startsWith('image/'));
    const newUploadFiles = uploadManager.addFiles(imageFiles);
    setFiles(prev => [...prev, ...newUploadFiles]);
  };

  const handleStartUpload = async () => {
    if (!uploadManager || files.length === 0) return;
    setIsUploading(true);
    await uploadManager.startUpload();
    setIsUploading(false);
    setCurrentStep(3);
    fetchSessions(); // Refresh list
  };

  const resetCreation = () => {
    setCurrentStep(1);
    setFiles([]);
    setSessionName('');
    setMaxPhotos(50);
    setNewSessionId(null);
    setNewSessionCode(null);
    setActiveTab('my-sessions');
  };

  const filteredSessions = sessions.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.selection_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 md:p-8 pt-20 lg:ml-64">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-on-surface mb-2">Fast Selection</h1>
        <p className="text-on-surface-variant">Drop photos, send links, and get selections in minutes. No event creation required.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-outline-variant/10">
        <button
          onClick={() => setActiveTab('my-sessions')}
          className={cn(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'my-sessions' ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          My Sessions
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={cn(
            "pb-4 px-2 text-sm font-bold transition-all relative",
            activeTab === 'create' ? "text-primary border-b-2 border-primary" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          Create New Selection
        </button>
      </div>

      {activeTab === 'my-sessions' ? (
        selectedSessionId ? (
          <SessionDetail 
            sessionId={selectedSessionId} 
            onBack={() => {
              setSelectedSessionId(null);
              fetchSessions();
            }} 
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-2 rounded-full silk-shadow border border-outline-variant/5 max-w-md">
              <Search size={18} className="ml-3 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-sm py-2"
              />
            </div>

            {loading ? (
              <div className="flex justify-center p-20">
                <Loader2 className="animate-spin text-primary" size={40} />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
                <Camera size={48} className="mx-auto mb-4 text-on-surface-variant/30" />
                <h3 className="text-xl font-bold text-on-surface mb-2">No selections yet</h3>
                <button 
                  onClick={() => setActiveTab('create')}
                  className="text-primary font-bold hover:underline"
                >
                  Create your first one &rarr;
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onDelete={() => handleDeleteSession(session.id)}
                    onView={() => setSelectedSessionId(session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        /* Create Flow */
        <div className="max-w-4xl bg-white rounded-[2.5rem] silk-shadow border border-outline-variant/5 p-8 md:p-12">
          {currentStep === 1 && (
            <form onSubmit={handleCreateSession} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Session Name</label>
                  <input
                    type="text"
                    required
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="e.g., Mansi & Rahul Pre-wedding"
                    className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 text-base font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Max Photos to Select</label>
                    <input
                      type="number"
                      value={maxPhotos}
                      onChange={(e) => setMaxPhotos(parseInt(e.target.value) || 0)}
                      className="w-full bg-surface-container-low border-none rounded-2xl py-4 px-6 text-base font-medium focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-2xl hover:bg-surface-container-low transition-colors">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={originalQuality}
                        onChange={(e) => setOriginalQuality(e.target.checked)}
                      />
                      <div className="w-10 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-on-surface">Original Quality</p>
                      <p className="text-[10px] text-on-surface-variant leading-none">No compression, full camera resolution</p>
                    </div>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="signature-gradient text-white px-10 py-4 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {isCreating ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                Create & Continue
              </button>
            </form>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant/30 rounded-[2rem] p-16 text-center hover:border-primary transition-all cursor-pointer bg-surface-container-low/30"
              >
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e.target.files)} 
                  {...({ webkitdirectory: "", directory: "" } as any)} 
                />
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-bold text-on-surface">Drop photos and folders here</h3>
                <p className="text-on-surface-variant">Or click to select files</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold">{files.length} files selected</h4>
                    <button onClick={() => setFiles([])} className="text-sm text-red-500 font-bold flex items-center gap-1"><Trash2 size={14} /> Clear</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {files.map(file => (
                      <div key={file.id} className="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl">
                        <img src={file.preview} className="w-10 h-10 object-cover rounded-md" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{file.file.name}</p>
                          <div className="w-full h-1 bg-outline-variant/20 rounded-full mt-1">
                            <div className="h-full bg-primary" style={{ width: `${file.progress}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-bold">{file.status}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleStartUpload}
                    disabled={isUploading || files.length === 0}
                    className="w-full signature-gradient text-white py-4 rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                    Start Upload
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-serif font-bold text-on-surface mb-2">Ready to Share!</h2>
                <p className="text-on-surface-variant">Your selection session is live. Send this code or link to your client.</p>
              </div>

              <div className="bg-surface-container-low p-6 rounded-3xl space-y-4 max-w-md mx-auto">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Selection Code</span>
                  <span className="text-xl font-mono font-bold text-primary">{newSessionCode}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/select/${newSessionCode}`);
                      alert('Link copied!');
                    }}
                    className="flex-1 bg-white border border-outline-variant/20 py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 hover:bg-surface-container-high transition-all"
                  >
                    <Copy size={16} /> Copy Link
                  </button>
                  <Link 
                    to={`/select/${newSessionCode}`}
                    target="_blank"
                    className="px-4 bg-on-surface text-white rounded-full flex items-center justify-center"
                  >
                    <ExternalLink size={18} />
                  </Link>
                </div>
              </div>

              <button
                onClick={resetCreation}
                className="text-on-surface-variant font-bold hover:text-primary transition-colors"
              >
                Go back to my sessions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onDelete, onView }: { session: Session, onDelete: () => void, onView: () => void }) {
  const link = `${window.location.origin}/select/${session.selection_code}`;
  const expiresAt = new Date(session.expires_at);
  const isExpired = expiresAt < new Date();
  const daysRemaining = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  return (
    <div className={cn(
      "bg-white rounded-[2.5rem] p-6 silk-shadow border border-outline-variant/5 group hover:-translate-y-1 transition-all relative overflow-hidden",
      isExpired && "opacity-75 grayscale"
    )}>
      {isExpired && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-[10px] font-bold text-center py-1 uppercase tracking-tighter">
          Expired - Auto Cleanup Pending
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-surface-container-low rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
          <LayoutGrid size={24} />
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
            session.status === 'submitted' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
          )}>
            {session.status}
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition-all rounded-full"
            title="Delete Session"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-on-surface mb-1 truncate">{session.name}</h3>
      <p className="text-xs font-mono font-bold text-primary mb-2">{session.selection_code}</p>
      
      <div className="mb-4">
        <span className={cn(
          "text-[10px] font-black uppercase tracking-tighter flex items-center gap-1",
          daysRemaining <= 5 ? "text-red-500" : "text-on-surface-variant"
        )}>
          <Clock size={12} />
          {isExpired ? "Expired" : `${daysRemaining} days left`}
        </span>
      </div>
      
      <div className="flex items-center gap-4 mb-6 text-on-surface-variant text-xs">
        <div className="flex items-center gap-1"><Camera size={14} /> {session.photo_count}</div>
        <div className={cn(
          "flex items-center gap-1 font-bold",
          session.selected_count && session.selected_count > 0 ? "text-primary" : ""
        )}>
          <CheckCircle2 size={14} /> {session.selected_count || 0}
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={onView}
          className="flex-1 bg-surface-container-low hover:bg-surface-container-high py-2.5 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2"
        >
          <Search size={14} /> Review
        </button>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(link);
            alert('Link copied!');
          }}
          className="px-4 bg-on-surface text-white rounded-full flex items-center justify-center hover:bg-primary transition-all active:scale-90"
          title="Copy Link"
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  );
}

function SessionDetail({ sessionId, onBack }: { sessionId: string, onBack: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'selections' | 'all'>('selections');
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchDetailData();
  }, [sessionId]);

  const fetchDetailData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Session
      const { data: sessionData } = await supabase
        .from('fast_selection_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (sessionData) setSession(sessionData);

      // 2. Fetch Clients
      const { data: clientData } = await supabase
        .from('fast_selection_clients')
        .select('*')
        .eq('session_id', sessionId);
      
      if (clientData) setClients(clientData);

      // 3. Fetch Photos and resolve public URLs
      const { data: photoData } = await supabase
        .from('fast_selection_photos')
        .select(`
          *,
          favorites:fast_selection_favorites(count)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      
      if (photoData) {
        const enriched = photoData.map(p => {
          const { data } = supabase.storage
            .from('photos')
            .getPublicUrl(p.file_path);
          
          return {
            ...p,
            display_url: data.publicUrl,
            selection_count: p.favorites?.[0]?.count || 0
          };
        });
        setPhotos(enriched);
      }
    } catch (err) {
      console.error("Error fetching detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const selections = photos.filter(p => p.selection_count > 0);
  const displayPhotos = viewTab === 'selections' ? selections : photos;

  const handleCopyFilenames = () => {
    if (selections.length === 0) return;
    const names = selections.map(p => p.file_name).join(', ');
    navigator.clipboard.writeText(names);
    alert(`Copied ${selections.length} filenames to clipboard!`);
  };

  const handleBatchDownload = async () => {
    if (selections.length === 0) return;
    setDownloading(true);
    
    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < selections.length; i += batchSize) {
      const batch = selections.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (photo) => {
        const { data } = await supabase.storage
          .from('photos')
          .getPublicUrl(photo.file_path);
        
        if (data?.publicUrl) {
          // Trigger browser download by creating hidden link
          const link = document.createElement('a');
          link.href = data.publicUrl;
          link.download = photo.file_name || 'photo.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Small delay to prevent browser locking up
          await new Promise(r => setTimeout(r, 500));
        }
      }));
      
      // Pause between batches
      if (i + batchSize < photos.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    setDownloading(false);
    alert("Batch download started. Please ensure your browser allows multiple downloads.");
  };

  const handleFinalize = async () => {
    if (!confirm("Mark this session as Completed? It will stop further selections.")) return;
    
    const { error } = await supabase
      .from('fast_selection_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);
    
    if (error) alert(error.message);
    else onBack();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-primary" size={40} />
      <p className="text-sm font-medium text-on-surface-variant">Gathering client selections...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-on-surface tracking-tight">{session?.name}</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-on-surface-variant font-medium">{photos.length} total shared</p>
              <span className="w-1 h-1 bg-outline-variant rounded-full" />
              <p className="text-xs text-primary font-bold">{selections.length} client picks</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopyFilenames}
            disabled={selections.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-full text-xs font-bold transition-all disabled:opacity-30"
          >
            <Files size={16} /> Copy Selections ({selections.length})
          </button>
          <button 
            onClick={handleBatchDownload}
            disabled={downloading || selections.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-on-surface text-white hover:bg-primary rounded-full text-xs font-bold transition-all disabled:opacity-50"
          >
            {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} 
            Download Picks
          </button>
          <button 
            onClick={handleFinalize}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-xs font-bold transition-all"
          >
            <CheckCircle2 size={16} /> Finalize
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Client List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-2">Quick Stats</h3>
          <div className="p-6 bg-surface-container-low rounded-[2rem] space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-on-surface-variant">Selected</p>
              <p className="text-lg font-black text-primary">{selections.length}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-on-surface-variant">Remaining</p>
              <p className="text-lg font-black text-on-surface">{(session?.max_photos || 0) - selections.length}</p>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-2 mt-8">Clients</h3>
          <div className="space-y-2">
            {clients.map(client => (
              <div key={client.id} className="p-4 bg-white rounded-[2rem] border border-outline-variant/30 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-on-surface">{client.name || 'Anonymous'}</p>
                  {client.status === 'submitted' && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Submitted</span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant truncate">{client.email}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Grid Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs */}
          <div className="flex gap-4 p-1 bg-surface-container-low rounded-2xl w-fit">
            <button 
              onClick={() => setViewTab('selections')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                viewTab === 'selections' 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              Selections ({selections.length})
            </button>
            <button 
              onClick={() => setViewTab('all')}
              className={cn(
                "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                viewTab === 'all' 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              All Shared ({photos.length})
            </button>
          </div>

          {displayPhotos.length === 0 ? (
            <div className="p-20 bg-surface-container-lowest rounded-[3rem] border border-dashed border-outline-variant text-center space-y-3">
              <div className="w-16 h-16 bg-surface-container-low rounded-3xl flex items-center justify-center mx-auto text-on-surface-variant">
                <LayoutGrid size={32} />
              </div>
              <p className="text-base text-on-surface-variant font-medium">Nothing to show in this view.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayPhotos.map(photo => (
                <div 
                  key={photo.id} 
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square bg-surface-container-low rounded-[2rem] overflow-hidden silk-shadow cursor-pointer"
                >
                  <img 
                    src={photo.display_url} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    alt={photo.file_name} 
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-medium truncate">{photo.file_name}</p>
                    {photo.selection_count > 0 && <p className="text-[10px] text-emerald-400 font-bold">Selected by client</p>}
                  </div>
                  {photo.selection_count > 0 && (
                    <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg transition-transform">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setSelectedPhoto(null)}
        >
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-all">
            <X size={32} />
          </button>
          
          <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={e => e.stopPropagation()}>
            <img 
              src={selectedPhoto.display_url} 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" 
              alt="" 
            />
            <div className="text-center space-y-1">
              <p className="text-white font-bold text-lg">{selectedPhoto.file_name}</p>
              {selectedPhoto.selection_count > 0 ? (
                <span className="bg-emerald-500/20 text-emerald-400 px-4 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                  Client Selection
                </span>
              ) : (
                <span className="bg-white/10 text-white/60 px-4 py-1 rounded-full text-xs font-bold">
                  Shared Image
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
