import { Camera, Check, Clock, Image, Loader2, Lock, MapPin, QrCode, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface Event {
    id: string;
    name: string;
    description: string | null;
    event_date: string | null;
    location: string | null;
    cover_image_url: string | null;
    guest_qr_code: string;
    upload_password_hash: string;
    status: 'upcoming' | 'live' | 'completed';
}

export function PublicEventPage() {
    const { qrCode } = useParams();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    useEffect(() => {
        if (qrCode) {
            fetchEvent();
        }
    }, [qrCode]);

    async function fetchEvent() {
        try {
            setLoading(true);
            setError(null);

            if (!qrCode) {
                setError('No event code provided');
                setLoading(false);
                return;
            }

            console.log('[PublicEventPage] Fetching event with guest_qr_code:', qrCode);

            const { data, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .eq('guest_qr_code', qrCode);

            if (fetchError) {
                console.error('[PublicEventPage] Supabase error:', fetchError);
                throw fetchError;
            }

            if (!data || data.length === 0) {
                console.error('[PublicEventPage] Event not found with guest_qr_code:', qrCode);
                setError('Event not found. Please check the QR code or link.');
                setLoading(false);
                return;
            }

            console.log('[PublicEventPage] Event found:', data[0].id, data[0].name);
            setEvent(data[0]);
        } catch (err) {
            console.error('[PublicEventPage] Error fetching event:', err);
            setError(err instanceof Error ? err.message : 'Failed to load event');
        } finally {
            setLoading(false);
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!event) return;

        setVerifying(true);
        try {
            const normalizedInput = password.trim().toUpperCase();
            const normalizedStored = (event.upload_password_hash || '').trim().toUpperCase();
            
            if (normalizedInput && normalizedInput === normalizedStored) {
                setPasswordVerified(true);
                setError(null);
            } else {
                setError('Incorrect password. Please try again.');
            }
        } catch (err) {
            setError('Failed to verify password');
        } finally {
            setVerifying(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...files]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!event || selectedFiles.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            // In a real implementation, you would upload files to Supabase Storage
            // For now, we'll simulate the upload
            await new Promise(resolve => setTimeout(resolve, 2000));

            setUploadSuccess(true);
            setSelectedFiles([]);
            setTimeout(() => setUploadSuccess(false), 3000);
        } catch (err) {
            console.error('Error uploading files:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-primary" />
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <X size={32} className="text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-on-surface mb-2">Event Not Found</h1>
                    <p className="text-on-surface-variant">{error}</p>
                </div>
            </div>
        );
    }

    if (!event) return null;

    return (
        <div className="min-h-screen bg-surface">
            {/* Hero Section */}
            <div className="relative h-64 md:h-80 overflow-hidden">
                {event.cover_image_url ? (
                    <img
                        src={event.cover_image_url}
                        alt={event.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <Camera size={64} className="text-primary/40" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-widest mb-2">
                            <span className={cn(
                                "w-2 h-2 rounded-full",
                                event.status === 'live' ? 'bg-green-400' : event.status === 'upcoming' ? 'bg-yellow-400' : 'bg-gray-400'
                            )}></span>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)} Event
                        </div>
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">{event.name}</h1>
                        {event.description && (
                            <p className="text-white/80 text-sm md:text-base">{event.description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Event Details */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {event.event_date && (
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Date & Time</div>
                                    <div className="text-sm font-medium text-on-surface">
                                        {new Date(event.event_date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        {event.location && (
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-secondary/10 text-secondary">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Location</div>
                                    <div className="text-sm font-medium text-on-surface">{event.location}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Section */}
                {true ? (
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Upload size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-on-surface">Upload Photos</h2>
                        </div>

                        {!passwordVerified ? (
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <p className="text-on-surface-variant text-sm mb-4">
                                    Enter the upload password to share your photos with the event host.
                                </p>
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                        {error}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input
                                            type="text"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value.toUpperCase())}
                                            placeholder="Enter upload password"
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none font-mono tracking-widest"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={verifying || !password}
                                        className="signature-gradient text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {verifying ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <Check size={20} />
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                {uploadSuccess && (
                                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                        <Check size={20} />
                                        Photos uploaded successfully!
                                    </div>
                                )}

                                {/* File Input */}
                                <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 text-center hover:border-primary transition-colors">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                                            <Image size={32} className="text-on-surface-variant" />
                                        </div>
                                        <p className="text-on-surface font-medium mb-1">Click to select photos</p>
                                        <p className="text-on-surface-variant text-sm">or drag and drop</p>
                                    </label>
                                </div>

                                {/* Selected Files */}
                                {selectedFiles.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="text-sm font-medium text-on-surface-variant">
                                            {selectedFiles.length} file(s) selected
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {selectedFiles.map((file, index) => (
                                                <div key={index} className="relative group">
                                                    <div className="aspect-square rounded-xl overflow-hidden bg-surface-container-low">
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            alt={`Preview ${index + 1}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeFile(index)}
                                                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleUpload}
                                            disabled={uploading}
                                            className="w-full signature-gradient text-white px-6 py-4 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 size={20} className="animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={20} />
                                                    Upload {selectedFiles.length} Photo(s)
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
                        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                            <Camera size={32} className="text-on-surface-variant" />
                        </div>
                        <h3 className="text-xl font-bold text-on-surface mb-2">Photo Uploads Disabled</h3>
                        <p className="text-on-surface-variant">
                            The event host has disabled guest photo uploads for this event.
                        </p>
                    </div>
                )}

                {/* QR Code Display */}
                <div className="mt-8 bg-white p-6 md:p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <QrCode size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-on-surface">Event QR Code</h2>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="bg-surface-container-low p-6 rounded-3xl mb-4">
                            <QrCode size={120} className="text-on-surface" />
                        </div>
                        <p className="text-2xl font-mono font-bold text-on-surface tracking-widest">{event.guest_qr_code}</p>
                        <p className="text-xs text-on-surface-variant mt-2">Share this code with other guests</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
