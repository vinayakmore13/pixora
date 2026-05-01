# WebHub Feature Analysis: Marketplace, Gallery & Photographer Profiles

## Overview
WebHub implements a three-pillar system for connecting photographers and clients: a photographer marketplace for discovery, detailed photographer profiles with portfolios and packages, and a gallery system for viewing event photos with AI-powered facial recognition.

---

## 1. MARKETPLACE FEATURE (Marketplace.tsx)

### Current Implementation

#### Database Architecture
```sql
-- From 006_setup_marketplace.sql
CREATE TABLE photographer_profiles (
  id UUID PRIMARY KEY,
  bio TEXT,
  location TEXT,
  languages TEXT[],
  experience_years INTEGER,
  price_starts_at INTEGER,
  cover_photo_url TEXT,
  styles TEXT[],  -- Editorial, Candid, Traditional, Cinematic, Fine Art, Classic, Documentary
  rating NUMERIC(3,2),
  reviews_count INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### What Photographers Can List
- **Visible Profile Data:**
  - Cover photo (hero banner image)
  - Full name (from linked profiles table)
  - Location (e.g., "Udaipur, Goa")
  - Starting price (minimum portfolio rate in ₹)
  - Rating (0-5 stars with review count)
  - Photography styles (multi-select tags)

- **Usage From Marketplace.tsx:**
```typescript
const fetchPhotographers = async () => {
  let query = supabase
    .from('photographer_profiles')
    .select(`
      id,
      location,
      price_starts_at,
      cover_photo_url,
      styles,
      rating,
      reviews_count,
      profiles!inner(full_name)  // Linked user profile
    `);
```

#### Organization & Discovery
1. **Location-Based Search**
   - Text input for location filtering (ilike query)
   - Example: "Find photographers in Udaipur"

2. **Style Filtering**
   - Multi-select checkboxes for photography style
   - Available styles: Editorial, Candid, Traditional, Cinematic, Fine Art, Classic, Documentary
   - Filters applied in-memory after query (Supabase array filtering limitation)

3. **Price Range Filtering**
   - Min/Max input fields for starting price
   - Uses `gte` and `lte` operators on price_starts_at

4. **Rating Filter**
   - Radio buttons for rating threshold: 5★, 4★, 3★, or Any Rating
   - Uses `gte` operator on rating field

#### Search & Discovery Capabilities
```typescript
// Sorting Options
const sortOptions = [
  'Recommended',           // Default, no database sort
  'Price: Low to High',   // price_starts_at ascending
  'Price: High to Low',   // price_starts_at descending
  'Top Rated'             // rating descending
];

// Applied filters run on initial query, then refined in memory
if (selectedStyles.length > 0) {
  finalData = finalData.filter(p => 
    selectedStyles.some(style => p.styles && p.styles.includes(style))
  );
}
```

#### Current Monetization Model
**⚠️ NOT CLEARLY IMPLEMENTED** - The codebase shows:
- No payment processing visible in Marketplace.tsx
- No subscription tier enforcement
- No commission calculation
- No booking payment integration

The `Booking` table exists with `total_amount` field, but no Stripe/payment gateway integration is evident in the marketplace flow.

#### Photographer Card Display
```typescript
// PhotographerCard component shows:
- Cover image (with 3D tilt zoom on hover)
- Styles tags (first 3, "+X more" if exceed 3)
- Photographer name
- ⭐ Rating with review count
- 📍 Location
- Starting price range
- Chevron button for navigation
- Heart icon for favorites (UI only, not stored)
```

### What's Missing or Underdeveloped

| Gap | Impact | Notes |
|-----|--------|-------|
| **No favorites/wishlist system** | Users can't save photographers for later | Heart icon exists but not wired to database |
| **No messaging/inquiry system** | Photographer-client communication only via form | "Send Inquiry" not implemented |
| **No booking payment flow** | Transactions not possible | No Stripe/payment processor integration |
| **No photographer verification badge** | Trust signals weak | CheckCircle2 icon shown on profile but no verified status field |
| **No portfolio preview on marketplace** | Can't judge work quality before clicking | Only styles tags shown |
| **No availability calendar** | Photographers can't block dates | Availability check form only on profile page |
| **No reviews preview on card** | Missing social proof at discovery stage | Reviews only visible on profile page |
| **No advanced filtering** | Can't filter by experience years, languages, etc. | Only basic attributes exposed |
| **No search algorithm/ranking** | All photographers equally weighted | No trending/trending/newly-joined sorting |

### Unique Opportunities vs Competitors

#### vs ShootProof
- **WebHub advantage:** Photography style taxonomy (Editorial, Candid, etc.) better matches wedding industry terminology
- **ShootProof advantage:** Built-in payment processing, more mature marketplace

#### vs Pixiset
- **WebHub advantage:** AI Face Finder feature (unique) - clients can auto-find themselves in 1000s of photos
- **Pixiset advantage:** Direct client ordering from gallery, album customization

#### vs Instagram
- **WebHub advantage:** Structured photographer discovery with filters (not algorithmic feed)
- **WebHub advantage:** Wedding-specific metadata (styles, experience, packages)
- **Instagram advantage:** Massive reach, integrated e-commerce

#### WebHub's Differentiator
The **AI Photo Finder** using facial recognition is the strongest differentiator. It solves a real pain point: clients manually finding themselves across thousands of photos. This builds client loyalty and encourages gallery revisits.

---

## 2. PHOTOGRAPHER PROFILE SYSTEM

### Current Implementation

#### Profile Display Architecture

**Header Section:**
```typescript
// Cover photo + profile overlay
<section className="relative h-[400px] md:h-[500px]">
  <img src={coverPhoto} />
  <div className="absolute bottom-12">
    <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] border-4">
      <img src={avatarUrl} />  // Avatar from profiles table
    </div>
    <h1>{fullName}</h1>
    <CheckCircle2 />           // Verified badge (not conditional)
    <span>{location}</span>
    <span>⭐ {rating} ({reviews_count} Reviews)</span>
  </div>
</section>
```

#### Tab-Based Content Organization

**1. ABOUT Tab**
- Bio (rich text from photographer_profiles.bio field)
- Info cards: Experience, Location, Styles, Languages
- Display order matches edit workflow

Code example:
```typescript
// From profiles query
{activeTab === 'about' && (
  <div className="prose">
    <h3>The Visionary Behind the Lens</h3>
    <p className="whitespace-pre-line">{profile?.bio}</p>
    
    <div className="grid grid-cols-2 md:grid-cols-4">
      <InfoItem label="Experience" value={`${profile.experience_years}+ Years`} />
      <InfoItem label="Location" value={profile.location} />
      <InfoItem label="Styles" value={profile.styles.join(", ")} />
      <InfoItem label="Languages" value={profile.languages.join(", ")} />
    </div>
  </div>
)}
```

**2. PORTFOLIO Tab**
- Grid of portfolio images (2 column on mobile, responsive)
- Images stored in `portfolio_images` table with `display_order`
- 3D hover zoom effect

```typescript
{activeTab === 'portfolio' && (
  <div className="grid grid-cols-2 gap-4">
    {portfolio.map((img) => (
      <div className="rounded-2xl overflow-hidden aspect-[4/5]">
        <img src={img.image_url} />
      </div>
    ))}
  </div>
)}
```

**3. PACKAGES Tab**
- Service offerings with tiered pricing
- Toggleable "Recommended" flag for upsell

```typescript
// Package structure
{
  id: UUID,
  photographer_id: UUID,
  title: string,          // e.g., "Signature Collection"
  price: integer,         // ₹ amount
  description: string,
  features: JSONB,       // Array: "8 Hours Coverage", "400+ Edited Photos"
  is_recommended: boolean
}

// Display with "Recommended" badge
<PackageCard 
  recommended={pkg.is_recommended}
  features={pkg.features || []}
/>
```

**4. REVIEWS Tab**
- Chronologically ordered (newest first)
- Average rating calculated from reviews
- Review submission form (for non-owners)
- Client avatars pulled from profiles

```typescript
const submitReview = async (e: React.FormEvent) => {
  await supabase.from('reviews').insert([{
    photographer_id: id,
    client_id: user.id,
    rating: reviewForm.rating,  // 1-5 stars
    comment: reviewForm.comment
  }]);
};
```

### Portfolio Showcase Capabilities

**Current Features:**
- Image ordering (display_order field supports manual curation)
- 2-column grid that expands to responsive layout
- Hover zoom with transition
- No image categorization/albums

**Database Structure:**
```sql
CREATE TABLE portfolio_images (
  id UUID PRIMARY KEY,
  photographer_id UUID,
  image_url TEXT NOT NULL,
  display_order INTEGER,  -- Manual ordering
  created_at TIMESTAMP
);
```

**Missing Portfolio Features:**
- No album/collection organization
- No before/after comparisons
- No video samples
- No occasion tagging (Wedding Ceremony photos, Reception, etc.)
- No metadata (camera, lens, ISO data)
- No PDF portfolio export

### Testimonials/Reviews Section

**Current:**
- 5-star rating system with text comments
- Author name, date, avatar
- Newest reviews first

**Missing:**
- No review photos (clients can't attach images)
- No response from photographer
- No helpful/upvote system
- No review verification (no proof client hired photographer)
- No review moderation

### Follower/Connection System

**⚠️ NOT IMPLEMENTED:**
- No followers table in schema
- No follow button visible in code
- No follower count displayed
- No follow-based notifications

### Profile Customization Options

**Photographer Can Customize:**
1. Cover photo URL (single image link)
2. Bio text (free-form, no rich editor)
3. Location (city/region text)
4. Experience years (numeric)
5. Starting price (numeric)
6. Photography styles (7 pre-defined options)
7. Languages (comma-separated text)
8. Portfolio images (add/remove/reorder)
9. Service packages (create/edit/delete)

**Cannot Customize:**
- Profile URL/slug (auto-generated from user ID)
- Color scheme
- Font choice
- Custom domains
- Social media integration (buttons exist but not editable)

### Edit Profile System (EditPhotographerProfile.tsx)

```typescript
// Edit form structure
<div className="bg-white rounded-3xl p-8">
  <h2>Basic Information</h2>
  
  <input name="cover_photo_url" />      // URL only, no upload
  <input name="location" />
  <input name="experience_years" />
  <input name="price_starts_at" />
  <textarea name="bio" />
  
  <div className="flex flex-wrap gap-3">
    {styleOptions.map(style => (
      <button onClick={() => handleStyleToggle(style)}>
        {style}  // Editorial, Candid, Traditional, etc.
      </button>
    ))}
  </div>
  
  <button onClick={saveProfile}>Save Profile</button>
</div>
```

**Package Management:**
```typescript
// Photographers can create/edit/delete packages
const addPackage = () => {
  setPackages([...packages, { 
    id: `temp-${Date.now()}`, 
    title: '', 
    price: 0, 
    description: '', 
    features: [], 
    is_recommended: false,
    isNew: true
  }]);
};

// Features entered as newline-separated text
<textarea 
  placeholder="8 Hours Coverage
1 Lead Photographer
400+ Edited Photos"
/>
```

### What's Missing or Underdeveloped

| Gap | Impact | Current |
|-----|--------|---------|
| **No profile image upload** | Photographers limited to markdown avatar | Uses `profiles.avatar_url` only |
| **No portfolio image upload UI** | Must provide external URLs | Input field for `image_url` only |
| **No bio rich editor** | Only plain text, no formatting | `<textarea>` with `whitespace-pre-line` |
| **No style customization** | Limited to 7 predefined styles | Fixed array: Editorial, Candid, Traditional, Cinematic, Fine Art, Classic, Documentary |
| **No social media links storage** | Display-only mockups | Social icons hardcoded with placeholder values |
| **No verified photographer badge logic** | CheckCircle2 always shown | No `is_verified` field in schema |
| **No portfolio albums/categories** | No organization beyond grid | Single flat portfolio_images table |
| **No engagement metrics** | No profile view counts, click-throughs | Not tracked at application level |
| **No response to inquiries** | One-way communication form | Send Inquiry button has no backend |

---

## 3. PHOTO GALLERY/SHOWCASE (Gallery.tsx)

### Current Implementation

#### Gallery Architecture

**Structure:**
```typescript
// Event-specific gallery
const { id } = useParams();  // Event ID

const Gallery = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [displayedPhotos, setDisplayedPhotos] = useState(photos);
  const [matchedPhotos, setMatchedPhotos] = useState<PhotoMetadata[]>([]);
  
  // Pagination
  const PHOTOS_PER_PAGE = 20;
  
  // AI matching
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  
  // Selection & download
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>();
};
```

#### Photo Display: Masonry/Infinite Scroll

```typescript
// React Masonry layout with Intersection Observer
<div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
  {displayedPhotos.map((photo, i) => (
    <motion.div 
      ref={isLastElement ? lastPhotoElementRef : null}
      key={photo.id}
      className="rounded-2xl overflow-hidden break-inside-avoid cursor-pointer"
      onClick={() => setSelectedPhotoIndex(i)}
    >
      <img 
        src={getPhotoPublicUrl(photo.file_path)} 
        loading="lazy"
        className="w-full h-auto object-cover"
      />
    </motion.div>
  ))}
</div>
```

**Lazy Loading with Intersection Observer:**
```typescript
const observerRef = useRef<IntersectionObserver | null>(null);
const lastPhotoElementRef = useCallback((node: HTMLDivElement) => {
  if (loading || loadingMore) return;
  if (observerRef.current) observerRef.current.disconnect();
  
  observerRef.current = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && hasMore) {
      loadMorePhotos();  // Fetch next 20 photos
    }
  });
  if (node) observerRef.current.observe(node);
}, [loading, loadingMore, hasMore]);
```

### Photo Categorization

**Current Filters:**
```typescript
<FilterChip label="All Photos" active={!showOnlyMatches} />
<FilterChip label="My AI Matches" active={showOnlyMatches} />
<FilterChip label="Ceremony" />
<FilterChip label="Reception" />
<FilterChip label="Guest Candid" />
```

**Status:**
- Filter chips exist in UI
- Only "All Photos" and "My AI Matches" are functional
- Ceremony, Reception, Guest Candid appear to be placeholder/future implementation
- No category field in photos table to support this

**Database Gap:**
```sql
-- In photos table (from photoMetadata.ts)
-- Missing: category, event_section, occasion_type fields
-- Current fields: id, file_path, file_name, event_id, user_id, is_guest_upload
```

### Statistics & Social Display

**Current Stats Shown:**
```typescript
// Header displays:
<div className="flex items-center gap-4 text-white/40">
  <span>{photos.length} Photos</span>
  <span>{formattedDate}</span>
</div>

// Per-photo indicator:
{photo.is_guest_upload ? 'Guest Upload' : 'Professional'}
```

**Missing Metrics:**
- 👁️ View count per photo
- ❤️ Likes per photo
- 👥 Download count per photo
- 💬 Comments on photos
- 📊 Gallery engagement statistics

### Social Features (Follows, Shares)

**Current Implementation:**
```javascript
// In hover overlay:
<button className="p-2 bg-white/10 rounded-full">
  <Download size={18} />
</button>

// Download button is only visible social action
```

**Missing:**
- Share button (individual or gallery)
- Client/guest attribution on photos
- @mentions in captions
- Social media sharing buttons
- Share link generation
- Private/link-only galleries

### AI Face Finding Feature (Unique)

**How It Works:**

1. **Selfie Capture Phase:**
```typescript
const handleAIMatchRequest = async () => {
  if (!profile?.selfie_descriptor) {
    setAiStep(1);  // Show selfie capture
    return;
  }
  
  // If descriptor exists, proceed to matching
  setAiStep(2);
};
```

2. **Face Matching:**
```typescript
// Uses face recognition RPC function
const { data: matches } = await supabase.rpc('match_faces', {
  query_embedding: profile.selfie_descriptor,  // User's face embedding
  match_threshold: 0.6,
  match_count: 50
});

// Returns photo IDs where user's face matches
const photoIds = matches.map((m: any) => m.photo_id);
```

3. **Result Display:**
- Shows thumbnail grid of first 3 matches
- Count: "We found X photos!"
- Option to view all matches with `showOnlyMatches` filter

**Technical Architecture:**
- Facial embedding stored in `profiles.selfie_descriptor` (vector/JSONB)
- Matching done via Supabase RPC function (edge function)
- Threshold: 0.6 (on 0-1 scale, allows some variation)
- Can find 50 matches per query

### Photo Lightbox/Viewer

**Features:**
```typescript
// Keyboard navigation
<useEffect>
  if (e.key === 'ArrowRight') handleNextPhoto();
  if (e.key === 'ArrowLeft') handlePrevPhoto();
  if (e.key === 'Escape') setSelectedPhotoIndex(null);
</useEffect>

// Touch swipe support
<motion.img 
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(e, { offset, velocity }) => {
    if (swipe < -50) handleNextPhoto();
    else if (swipe > 50) handlePrevPhoto();
  }}
/>
```

**Lightbox UI:**
```typescript
// Header with photo counter
<div className="text-sm font-bold text-white/60">
  {selectedPhotoIndex + 1} / {displayedPhotos.length}
</div>

// Download button in lightbox
<button><Download size={24} /></button>

// Navigation arrows with disabled state at boundaries
<button disabled={selectedPhotoIndex === 0}>
  <ChevronLeft size={32} />
</button>
```

### Selection & Bulk Download

**Selection Mode:**
```typescript
const [isSelectionMode, setIsSelectionMode] = useState(false);
const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

// Each photo shows checkbox when selection mode active
{isSelectionMode && (
  <div className="absolute top-4 left-4 z-10">
    <div className={isSelected ? 'bg-primary' : 'border-white bg-black/50'}>
      {isSelected && <CheckCircle2 />}
    </div>
  </div>
)}

// Floating action bar appears when photos selected
{isSelectionMode && selectedPhotoIds.size > 0 && (
  <motion.div className="fixed bottom-8 left-1/2">
    <span>{selectedPhotoIds.size} Selected</span>
    <button 
      onClick={handleBulkDownload}
      disabled={isDownloadingZip}
    >
      Download ZIP
    </button>
  </motion.div>
)}
```

**Bulk Download Logic:**
```typescript
const handleBulkDownload = async () => {
  const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
  const zipData = selectedPhotos.map(p => ({
    filePath: p.file_path,
    filename: p.file_name || `photo-${p.id}.jpg`
  }));
  
  await downloadBulkZip(zipData, `${eventData?.name}-photos`);
};
```

### What's Missing or Underdeveloped

| Feature | Current | Impact |
|---------|---------|--------|
| **Photo categorization** | Buttons exist but non-functional | Can't filter by Ceremony/Reception/Candid |
| **Photo metadata display** | Only "Guest Upload" indicator shown | No date, shot info, location metadata |
| **Photo comments** | None | Can't discuss specific moments |
| **Photo sharing to social** | Download only | Can't share directly to Instagram/Facebook |
| **Photo private/public** | All gallery photos public | Can't mark sensitive moments as private |
| **Photo favorites/bookmarking** | Not implemented | Clients can't save best photos |
| **Watermarks** | No watermark support | Professional photographers need protection |
| **PDF albums** | Not available | Can't export curated photo albums |
| **client attribution** | No @mention system | Can't tag other guests in photos |
| **Face tagging** | Only self-finder, no people tagging | Can't identify specific guests |
| **Photo delivery** | Only direct download | No print-on-demand, no proofing workflow |
| **Gallery sharing settings** | Event-level only | No "preview until date" or password protection |

#### Gallery Features vs Competitors

**vs ShootProof:**
- ShootProof has: Print ordering, albums, client-proofing workflow
- WebHub has: AI Face Finder (unique), bulk ZIP download

**vs Pixiset:**
- Pixiset has: Client ordering, album creation, custom watermarks
- WebHub has: AI Face Finder, masonry infinite scroll

**vs Google Photos:**
- Google Photos has: Automatic organization, face recognition across all photos, sharing
- WebHub has: Event-specific gallery, professional metadata filters

---

## Code Structure Overview

### Component Organization
```
src/components/
├── Marketplace.tsx           // Discovery & search
│   └── PhotographerCard      // Individual photographer listing
├── PhotographerProfile.tsx   // Details & booking
│   ├── ReviewCard
│   ├── PackageCard
│   ├── TabButton
│   └── SocialLink
├── EditPhotographerProfile.tsx // Profile manager
├── Gallery.tsx               // Event photo viewer
│   └── FilterChip
│   └── lightbox modal
└── SelfieCapture.tsx        // AI face capture (referenced)
```

### Database Query Patterns

**Marketplace Search:**
```typescript
let query = supabase
  .from('photographer_profiles')
  .select(`id, location, price_starts_at, cover_photo_url, styles, rating, reviews_count, profiles!inner(full_name)`)
  .ilike('location', `%${searchLocation}%`)
  .gte('price_starts_at', minPrice)
  .lte('price_starts_at', maxPrice)
  .gte('rating', minRating);
```

**Profile Data Load:**
```typescript
await supabase.from('photographer_profiles').select('*').eq('id', id).single();
await supabase.from('packages').select('*').eq('photographer_id', id);
await supabase.from('portfolio_images').select('*').eq('photographer_id', id);
await supabase.from('reviews').select(`*, profiles:client_id(...)`).eq('photographer_id', id);
```

---

## Summary Matrix

| Feature | Marketplace | Photographer Profile | Gallery |
|---------|-------------|----------------------|---------|
| **Status** | MVP with gaps | MVP with gaps | Advanced (AI) |
| **Completeness** | 60% | 55% | 75% |
| **Payment Integration** | ❌ Missing | ❌ Missing | N/A |
| **Social Features** | ❌ No follows/favorites | ❌ No social | ⚠️ Download only |
| **Content Upload UI** | ❌ No | ❌ No (URLs only) | ✅ Event photos |
| **Rich Customization** | ⚠️ Limited | ⚠️ Limited | N/A |
| **Unique Advantage** | Discovery filters | Packages & reviews | AI Face Finder |

### Immediate Next Steps to Improve

**For Marketplace:**
1. Add favorites/wishlist with database persistence
2. Integrate payment processing (Stripe)
3. Add verified photographer badge logic
4. Show portfolio preview snippets on cards
5. Add photographer availability calendar

**For Photographer Profiles:**
1. Implement image upload UI (not just URLs)
2. Add rich text editor for bio
3. Create portfolio album/collection system
4. Add custom domain support
5. Implement social media link editing (not hardcoded)

**For Gallery:**
1. Complete photo categorization system (category field in DB)
2. Add comment system on photos
3. Implement watermark support
4. Add private/public photo settings
5. Create client attribution/tagging system

