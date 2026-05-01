import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Image,
  Loader2,
  Lock,
  MapPin,
  QrCode,
  Upload,
  Users,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { cn } from "../lib/utils";
import { azureStorageProvider } from "../lib/providers/azureStorageProvider";

// Generate a random QR code string (8 characters)
function generateQRCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a readable upload password (WORD-YEAR-RANDOM format)
function generateUploadPassword(): string {
  const words = [
    "WEDDING",
    "PARTY",
    "PHOTO",
    "SMILE",
    "CELEBRATE",
    "LOVE",
    "JOY",
    "MOMENT",
  ];
  const year = new Date().getFullYear();
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${randomWord}-${year}-${randomChars}`;
}

export function CreateEvent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<{
    id: string;
    guest_qr_code: string;
    upload_password: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_date: "",
    location: "",
    cover_image_url: "",
    max_photos: 5000,
    allow_guest_uploads: true,
    moderate_guest_photos: false,
    ai_enabled: true,
  });
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null,
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const [coverImageValid, setCoverImageValid] = useState(false);

  // Optional: client & conversation IDs passed from chat flow
  const sourceClientId = searchParams.get("client") || null;
  const sourceConversationId = searchParams.get("conversation") || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setCoverImageError("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setCoverImageError("Image must be less than 5MB");
        return;
      }

      setCoverImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setCoverImagePreview(previewUrl);
      setFormData((prev) => ({ ...prev, cover_image_url: "" })); // Clear URL if file is picked
      setCoverImageError(null);
      setCoverImageValid(true);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData((prev) => ({ ...prev, cover_image_url: url }));
    setCoverImageError(null);
    setCoverImageValid(false);

    if (url) {
      try {
        const urlObj = new URL(url);
        // Check if it's a valid image URL
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          setCoverImageValid(true);
        } else {
          setCoverImageError("URL must start with http:// or https://");
        }
      } catch {
        setCoverImageError("Please enter a valid URL");
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create an event");
      return;
    }



    // Validate required fields
    if (!formData.name.trim()) {
      setError("Event name is required");
      return;
    }

    if (!formData.event_date) {
      setError("Event date is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalCoverImageUrl = formData.cover_image_url;

      // Upload local file if present
      if (coverImageFile) {
        setUploadingCover(true);
        try {
          const fileExt = coverImageFile.name.split(".").pop();
          const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const result = await azureStorageProvider.uploadFile(coverImageFile, filePath, 'photos');

          if (!result.success) {
            throw new Error(result.error || "Failed to upload cover image");
          } else {
            finalCoverImageUrl = azureStorageProvider.getBlobUrl(filePath, 'photos');
          }
        } catch (uploadErr: any) {
          console.error("Cover upload error:", uploadErr);
          setCoverImageError(
            uploadErr.message || "Failed to upload cover image",
          );
          // Continue without cover image instead of failing entire event creation
        } finally {
          setUploadingCover(false);
        }
      }

      // Generate QR code and password
      const guestQRCode = generateQRCode();
      const uploadPassword = generateUploadPassword();

      const photographerId =
        profile?.user_type === "photographer" ? user.id : null;
       const clientId = sourceClientId || null;

      // Step 1: Insert core event fields
      // (boolean settings are sent in a separate update to avoid PostgREST schema cache issues)
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          user_id: user.id,
          photographer_id: photographerId,
          client_id: clientId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          event_date: formData.event_date
            ? new Date(formData.event_date).toISOString()
            : null,
          location: formData.location.trim() || null,
          cover_image_url: finalCoverImageUrl || null,
          guest_qr_code: guestQRCode,
          upload_password_hash: uploadPassword,
          max_photos: formData.max_photos,
          status: "upcoming",
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Step 2: Update the boolean settings fields separately
      // This sidesteps the PostgREST schema cache lag for newly added columns
      const { error: updateError } = await supabase
        .from("events")
        .update({
          allow_guest_uploads: formData.allow_guest_uploads,
          moderate_guest_photos: formData.moderate_guest_photos,
          ai_enabled: formData.ai_enabled,
        })
        .eq("id", data.id);

      if (updateError) {
        // Non-fatal: the event is created, settings will use DB defaults
        console.warn(
          "Could not update event settings (cache lag):",
          updateError.message,
        );
      }

      // Success! Show the QR code and password
      setCreatedEvent({
        id: data.id,
        guest_qr_code: guestQRCode,
        upload_password: uploadPassword,
      });

      // Send System Message if created from chat
      if (sourceConversationId) {
        try {
          await supabase.from("messages").insert({
            conversation_id: sourceConversationId,
            sender_id: user.id,
            content: `📸 Event created: "${formData.name}". You can now view the gallery in your dashboard.`,
            message_type: "event_created",
            metadata: { event_id: data.id, event_name: formData.name },
          });
        } catch (msgErr) {
          console.error("Non-blocking error sending system message:", msgErr);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Error creating event:", err);
      setError(err.message || "Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewEvent = () => {
    if (createdEvent) {
      navigate(`/events/${createdEvent.id}`);
    }
  };

  // Success Screen
  if (success && createdEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface via-surface-bright to-surface-container-high py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-on-surface mb-2">
              Event Created! 🎉
            </h1>
            <p className="text-on-surface-variant">
              Your event is ready. Share these codes with guests and
              photographers.
            </p>
          </div>

          {/* Two Code Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Guest QR Code */}
            <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
              <div className="text-center mb-6">
                <QrCode className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="text-xl font-bold text-on-surface mb-1">
                  Guest QR Code
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Share with all guests
                </p>
              </div>

              {/* QR Code Display (You can add actual QR code library here) */}
              <div className="bg-surface-container-high p-6 rounded-2xl mb-6 flex items-center justify-center">
                <div className="text-4xl font-mono font-bold text-primary">
                  {createdEvent.guest_qr_code}
                </div>
              </div>

              <div className="space-y-2 mb-6 text-xs text-on-surface-variant">
                <p>✅ View all photos</p>
                <p>✅ Find photos with AI</p>
                <p>✅ Download photos</p>
                <p>❌ Cannot upload photos</p>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/e/${createdEvent.guest_qr_code}`,
                  )
                }
                className="w-full bg-primary/10 text-primary py-3 rounded-xl font-medium hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                {copied ? "Copied!" : "Copy Guest Link"}
              </button>
            </div>

            {/* Upload Password */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-8 rounded-[2.5rem] silk-shadow text-white">
              <div className="text-center mb-6">
                <Lock className="w-12 h-12 mx-auto mb-3" />
                <h3 className="text-xl font-bold mb-1">Upload Password 🔐</h3>
                <p className="text-sm text-white/90">
                  Share ONLY with photographers
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl mb-6">
                <div className="text-2xl font-mono font-bold text-center tracking-wider">
                  {createdEvent.upload_password}
                </div>
              </div>

              <div className="space-y-2 mb-6 text-xs">
                <p>📸 Photographers</p>
                <p>👨‍👩‍👧‍👦 Close family</p>
                <p>🤵 Wedding organizers</p>
              </div>

              <button
                onClick={() => copyToClipboard(createdEvent.upload_password)}
                className="w-full bg-white/20 backdrop-blur-sm border-2 border-white/30 py-3 rounded-xl font-medium hover:bg-white/30 transition-all flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                Copy Password
              </button>

              <p className="text-xs text-white/70 text-center mt-4">
                ⚠️ Keep private! Don't share in WhatsApp groups.
              </p>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-6">
            <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
              <Lock size={20} />
              Security Tips
            </h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>✓ Share Guest QR Code publicly (it's safe)</li>
              <li>
                ✓ Share Upload Password privately (only to trusted uploaders)
              </li>
              <li>✗ Don't post Upload Password on social media</li>
              <li>✗ Don't share Upload Password in WhatsApp groups</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleViewEvent}
              className="flex-1 signature-gradient text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              View Event Dashboard
            </button>
            <button
              onClick={() => navigate("/events")}
              className="flex-1 bg-white border-2 border-outline-variant/20 text-on-surface px-8 py-4 rounded-full font-bold hover:bg-surface-container-high transition-all"
            >
              Create Another Event
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create Event Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-bright to-surface-container-high py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/events")}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Events
          </button>
          <h1 className="text-4xl font-bold text-on-surface mb-2">
            Create New Event
          </h1>
          <p className="text-on-surface-variant">
            Set up your event and get QR code for guests
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle
              className="text-red-600 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div className="flex-1">
              <h4 className="font-bold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Details */}
          <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
            <h2 className="text-xl font-bold text-on-surface mb-6">
              Event Details
            </h2>



            <div className="space-y-6">
              {/* Event Name */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <QrCode
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    size={20}
                  />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Rahul & Priya's Wedding"
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Event Date */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    size={20}
                  />
                  <input
                    type="date"
                    name="event_date"
                    value={formData.event_date}
                    onChange={handleInputChange}
                    required
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    size={20}
                  />
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Mumbai, India"
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="A beautiful celebration of love..."
                  className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Cover Image (Optional)
                </label>

                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <Upload className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
                        <p className="text-sm font-medium text-on-surface mb-1">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          PNG, JPG, WEBP up to 5MB
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* OR divider */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-outline-variant/20"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-4 text-xs text-on-surface-variant uppercase tracking-widest">
                          Or paste URL
                        </span>
                      </div>
                    </div>

                    {/* URL Input */}
                    <div className="relative">
                      <Image
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                        size={20}
                      />
                      <input
                        type="url"
                        name="cover_image_url"
                        value={formData.cover_image_url}
                        onChange={handleCoverImageChange}
                        placeholder="https://example.com/image.jpg"
                        disabled={!!coverImageFile}
                        className={cn(
                          "w-full bg-surface-container-low border rounded-xl py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                          coverImageError
                            ? "border-red-300"
                            : "border-outline-variant/10",
                        )}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {(coverImagePreview ||
                    (coverImageValid && formData.cover_image_url)) && (
                    <div className="relative rounded-2xl overflow-hidden h-48 border border-outline-variant/20 shadow-inner group">
                      <img
                        src={coverImagePreview || formData.cover_image_url}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        onError={() => {
                          setCoverImageValid(false);
                          setCoverImageError("Failed to load image");
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImageFile(null);
                            setCoverImagePreview(null);
                            setFormData((prev) => ({
                              ...prev,
                              cover_image_url: "",
                            }));
                            setCoverImageError(null);
                            setCoverImageValid(false);
                          }}
                          className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-white/30 flex items-center gap-2"
                        >
                          <X size={16} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {coverImageError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {coverImageError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white p-8 rounded-[2.5rem] silk-shadow border border-outline-variant/5">
            <h2 className="text-xl font-bold text-on-surface mb-6">
              Event Settings
            </h2>

            <div className="space-y-6">
              {/* Max Photos */}
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Maximum Photos
                </label>
                <div className="relative">
                  <Users
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    size={20}
                  />
                  <input
                    type="number"
                    name="max_photos"
                    value={formData.max_photos}
                    onChange={handleInputChange}
                    min={100}
                    max={50000}
                    step={100}
                    className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl py-3 pl-10 pr-4 text-on-surface focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Maximum number of photos that can be uploaded to this event
                </p>
              </div>

              {/* Toggle Settings */}
              <div className="space-y-4">
                {/* Allow Guest Uploads */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-on-surface">
                      Allow Guest Uploads
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      Let guests upload photos to your event
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        allow_guest_uploads: !prev.allow_guest_uploads,
                      }))
                    }
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative flex-shrink-0",
                      formData.allow_guest_uploads
                        ? "bg-primary"
                        : "bg-outline-variant/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        formData.allow_guest_uploads ? "right-1" : "left-1",
                      )}
                    ></div>
                  </button>
                </div>

                {/* Moderate Guest Photos */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-on-surface">
                      Moderate Guest Photos
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      Require approval before guest photos are visible
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        moderate_guest_photos: !prev.moderate_guest_photos,
                      }))
                    }
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative flex-shrink-0",
                      formData.moderate_guest_photos
                        ? "bg-primary"
                        : "bg-outline-variant/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        formData.moderate_guest_photos ? "right-1" : "left-1",
                      )}
                    ></div>
                  </button>
                </div>

                {/* AI Photo Finder */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-on-surface">
                      Enable AI Photo Finder
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      Help guests find their photos using AI face recognition
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        ai_enabled: !prev.ai_enabled,
                      }))
                    }
                    className={cn(
                      "w-11 h-6 rounded-full transition-all relative flex-shrink-0",
                      formData.ai_enabled
                        ? "bg-primary"
                        : "bg-outline-variant/30",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        formData.ai_enabled ? "right-1" : "left-1",
                      )}
                    ></div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || uploadingCover}
            className="w-full signature-gradient text-white px-8 py-4 rounded-full font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            {loading || uploadingCover ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadingCover
                  ? "Uploading Cover Image..."
                  : "Creating Event..."}
              </>
            ) : (
              <>
                <QrCode size={20} />
                Create Event & Generate Codes
              </>
            )}
          </button>

          {/* Info Note */}
          <p className="text-xs text-center text-on-surface-variant">
            You'll receive a unique QR code for guests and an upload password
            for photographers
          </p>
        </form>
      </div>
    </div>
  );
}

