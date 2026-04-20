import { ArrowLeft, Calendar, Check, Image, Loader2, MapPin, QrCode, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface Event {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    event_date: string | null;
    location: string | null;
    cover_image_url: string | null;
    guest_qr_code: string;
    upload_password_hash: string;
    max_photos: number;
    allow_guest_uploads: boolean;
    moderate_guest_photos: boolean;
    ai_enabled: boolean;
    status: 'upcoming' | 'live' | 'completed';
}

export function EditEvent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [event, setEvent] = useState<Event | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        event_date: '',
        location: '',
        cover_image_url: '',
        max_photos: 5000,
        allow_guest_uploads: true,
        moderate_guest_photos: false,
        ai_enabled: true,
    });

    useEffect(() => {
        if (id && user) {
            fetchEvent();
        }
    }, [id, user]);

    async function fetchEvent() {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .eq('user_id', user?.id)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            setEvent(data);
            setFormData({
                name: data.name,
                description: data.description || '',
                event_date: data.event_date ? new Date(data.event_date).toISOString().slice(0, 16) : '',
                location: data.location || '',
                cover_image_url: data.cover_image_url || '',
                max_photos: data.max_photos,
                allow_guest_uploads: data.allow_guest_uploads ?? true,
                moderate_guest_photos: data.moderate_guest_photos ?? false,
                ai_enabled: data.ai_enabled ?? true,
            });
        } catch (err) {
            console.error('Error fetching event:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch event');
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !event) {
            setError('You must be logged in to edit an event');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('events')
                .update({
                    name: formData.name,
                    description: formData.description || null,
                    event_date: formData.event_date ? new Date(formData.event_date).toISOString() : null,
                    location: formData.location || null,
                    cover_image_url: formData.cover_image_url || null,
                    max_photos: formData.max_photos,
                    allow_guest_uploads: formData.allow_guest_uploads,
                    moderate_guest_photos: formData.moderate_guest_photos,
                    ai_enabled: formData.ai_enabled,
                })
                .eq('id', event.id);

            if (updateError) {
                throw updateError;
            }

            setSuccess(true);
            setTimeout(() => {
                navigate(`/event/${event.id}`);
            }, 1500);
        } catch (err) {
            console.error('Error updating event:', err);
            setError(err instanceof Error ? err.message : 'Failed to update event');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface pt-24 pb-20 px-8 flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-primary" />
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen bg-surface pt-24 pb-20 px-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
                        {error || 'Event not found'}
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-4 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Dashboard</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface pt-24 pb-20 px-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <header className="mb-12">
                    <button
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-6"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Event</span>
                    </button>
                    <h1 className="text-4xl font-serif font-bold text-on-surface mb-2">Edit Event</h1>
                    <p className="text-on-surface-variant">Update your event details.</p>
                </header>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
                            <Check size={20} />
                            Event updated successfully! Redirecting...
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                        <h2 className="text-xl font-bold text-on-surface mb-6">Event Details</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Event Title *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g., Rahul & Priya's 10th Anniversary"
                                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Tell guests about your event..."
                                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-2">Event Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input
                                            type="datetime-local"
                                            name="event_date"
                                            value={formData.event_date}
                                            onChange={handleInputChange}
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-on-surface-variant mb-2">Location</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                        <input
                                            type="text"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleInputChange}
                                            placeholder="e.g., The Grand Palace, Udaipur"
                                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Cover Image URL</label>
                                <div className="relative">
                                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                    <input
                                        type="url"
                                        name="cover_image_url"
                                        value={formData.cover_image_url}
                                        onChange={handleInputChange}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
                        <h2 className="text-xl font-bold text-on-surface mb-6">Event Settings</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-on-surface-variant mb-2">Maximum Photos</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                                    <input
                                        type="number"
                                        name="max_photos"
                                        value={formData.max_photos}
                                        onChange={handleInputChange}
                                        min={100}
                                        max={50000}
                                        className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-medium text-on-surface">Allow Guest Uploads</div>
                                        <div className="text-xs text-on-surface-variant">Let guests upload photos to your event</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, allow_guest_uploads: !prev.allow_guest_uploads }))}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-all relative",
                                            formData.allow_guest_uploads ? "bg-primary" : "bg-outline-variant/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                            formData.allow_guest_uploads ? "right-1" : "left-1"
                                        )}></div>
                                    </button>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-medium text-on-surface">Moderate Guest Photos</div>
                                        <div className="text-xs text-on-surface-variant">Require approval before photos are visible</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, moderate_guest_photos: !prev.moderate_guest_photos }))}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-all relative",
                                            formData.moderate_guest_photos ? "bg-primary" : "bg-outline-variant/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                            formData.moderate_guest_photos ? "right-1" : "left-1"
                                        )}></div>
                                    </button>
                                </div>

                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-medium text-on-surface">Enable AI Photo Finder</div>
                                        <div className="text-xs text-on-surface-variant">Help guests find their photos using AI</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, ai_enabled: !prev.ai_enabled }))}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-all relative",
                                            formData.ai_enabled ? "bg-primary" : "bg-outline-variant/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                            formData.ai_enabled ? "right-1" : "left-1"
                                        )}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(`/event/${event.id}`)}
                            className="flex-1 bg-white border border-outline-variant/20 text-on-surface px-6 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || success}
                            className="flex-1 signature-gradient text-white px-6 py-4 rounded-full font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Saving...
                                </>
                            ) : success ? (
                                <>
                                    <Check size={20} />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <QrCode size={20} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
