# WedHub Codebase - Comprehensive Analysis

**Date**: 2026-05-01  
**Platform**: React 19 + TypeScript + Supabase (PostgreSQL)  
**Purpose**: Wedding photography SaaS with AI-powered face recognition, collaborative client review portals, and multi-tenant billing

---

## 1. System Architecture Overview

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, React Router v7
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **AI/ML**: face-api.js (client-side), Azure Face API (hybrid), pgvector embeddings
- **Storage**: Azure Blob Storage (primary), Supabase Storage
- **State Management**: React Context + Realtime subscriptions
- **Security**: Device fingerprinting, steganographic watermarks, RLS policies

### High-Level Data Flow
```
Upload → Compression (85% quality, 2048px max) → Azure Storage → DB metadata → 
Face extraction (local pgvector + Azure hybrid) → Selection pool → Client review → 
Favorites → Download (single/ZIP) → Billing (if AI unlocks)
```

---

## 2. Database Schema (PostgreSQL)

### Core Tables (50+ migrations)

#### **profiles**
- `id` (UUID, FK to auth.users)
- `email`, `full_name`, `user_type` (couple|photographer)
- `avatar_url`, `is_admin`
- `plan_type` (free|starter|growth|professional)
- `storage_limit`, `storage_used`
- `smart_shares_remaining`, `ai_credits_remaining`

#### **events**
- `id`, `user_id` (FK)
- `title`, `description`, `event_date`, `location`
- `qr_code` (unique), `upload_password`
- `max_photos`, `allow_guest_uploads`, `moderate_guest_photos`
- `enable_ai_finder`, `status` (upcoming|live|completed)

#### **photos**
- `id`, `event_id`, `uploader_id`, `upload_session_id`
- `file_name`, `file_path`, `file_size`, `file_type`
- `width`, `height`, `thumbnail_url`
- `is_approved`, `is_guest_upload`, `is_in_selection_pool`
- `processing_status`

#### **photo_selections** (Client Review Portals)
- `id`, `event_id`, `selection_code`
- `max_photos`, `deadline`, `max_views`, `is_secure_mode`
- `status` (pending|submitted|completed), `is_submitted`

#### **photo_favorites** (Client Selections)
- `photo_id`, `guest_id`, `selection_id` (composite key)

#### **photo_selection_guests**
- `id`, `selection_id`, `name`, `email`
- `status` (invited|accepted|submitted)
- `selection_count`, `last_activity`

#### **upload_sessions**
- `id`, `event_id`, `session_token` (unique)
- `expires_at`, `is_valid`

#### **fast_selection_sessions** (Streamlined Flow)
- `id`, `selection_code`, `status`
- `client_email`, etc.

#### **face_descriptors** (pgvector)
- Stores 128-D face embeddings for local matching

#### **billing_transactions**
- `user_id`, `amount`, `currency`, `item_type`
- `plan_upgrade|smart_share_pack|ai_unlock`

#### **ai_unlocks**
- `event_id`, `guest_email`, `photo_ids[]`
- `transaction_id`

#### **security_events**
- Audit trail for security-relevant actions

---

## 3. RLS Policies Summary

- **profiles**: Users can view all; insert/update own
- **events**: Owners CRUD; public read by QR code
- **photos**: Owners CRUD; public read by event; authenticated insert
- **photo_selections**: Owner CRUD; public read by code
- **billing_transactions**: Users view own
- **ai_unlocks**: Event owners view

---

## 4. Core Modules & Components

### Authentication (`src/contexts/AuthContext.tsx`)
- **Supabase integration** with auto-refresh, persistence
- **Multi-role support**: couple, photographer, admin
- **Concurrent fetch protection**: `profileFetchIdRef` deduplication
- **Lock contention handling**: Exponential backoff on lock errors
- **Initialization guard**: Prevents double-init across mounts
- **Online/offline awareness**: Preserves session when offline on sign-out

### Photo Management
- **UploadManager** (`src/lib/uploadManager.ts`)
  - Parallel uploads (3 concurrent) with queue
  - Image compression (85% quality, 2048px max)
  - Progress tracking, error handling
  - Auto-adds to selection pool

- **photoService** (`src/lib/photoService.ts`)
  - Paginated photo fetching with filters
  - URL generation (Azure Blob)
  - Bulk ZIP download via JSZip

- **Face Engine** (`src/lib/faceEngine.ts`)
  - Dual-processing: local pgvector + Azure Face API
  - Automatic fallback on rate limits
  - Face descriptor extraction and storage
  - Similarity search with confidence scores

- **Selection AI** (`src/lib/selectionAI.ts`)
  - Collaborative filtering based on co-occurrences
  - Popularity scoring + affinity scoring
  - Diversity bonus for unique recommendations
  - Guest-based pattern analysis

### Realtime Collaboration (`src/lib/realtimeSelection.ts`)
- Supabase Realtime subscriptions
- Guest activity tracking (select/deselect/join/leave)
- Broadcast for local actions to other guests
- Presence tracking for active guests
- Automatic status updates

### Security (`src/lib/securityEngine.ts`)
- Device fingerprinting (SHA-256 of browser characteristics)
- Security event logging
- Invisible watermark steganography (alpha channel)
- Secure mode: disables screenshots, downloads

### Billing & Plans
- **Migration 047**: Storage-based pricing, smart shares, AI unlocks
- **Trigger `set_plan_limits`**: Auto-sets storage on plan change
- **Trigger `update_user_storage_usage`**: Increments on photo insert/delete
- **billing_transactions**: Tracks all monetization events

---

## 5. Key Components

### Client-Facing
- `SelectionPortal` - Main guest interface for photo selection
- `ClientSelections` - Photographer's portal to manage photos & rules
- `GuestActivityFeed` - Realtime activity stream
- `SelectionSuggestions` - AI-powered recommendations

### Photographer-Facing
- `UploadPhotos` - Photo upload interface
- `EventManagement` - Manage events & photos
- `Gallery` - Photo gallery with approval
- `PortfolioManagement` - Public portfolio
- `PhotographerProfile` - Profile & branding

### Admin
- `AdminDashboard` - Overview statistics
- `AdminUsers`, `AdminPhotographers`, `AdminEvents` - CRUD interfaces
- `AdminRevenue` - Revenue tracking
- `AdminSupport` - Chat support

### Public
- `LandingPage` - Marketing site
- `PublicEventPage` - QR code access
- `Marketplace` - Photographer discovery
- `BookingFlow` - Booking system

---

## 6. Business Logic & Algorithms

### AI Face Matching (Dual-Processing)
1. **Always run local pgvector** for fallback continuity
2. **If Azure enabled**, register face to Azure Face API list
3. **On search**: Try Azure first; fallback to pgvector on failure
4. **Return** ranked matches with confidence scores

### Selection AI Algorithm
```typescript
score = 
  popularityScore (count × 2, max 30) +
  affinityScore (co-occurrence × 3) +
  relatedGuestsScore (count × 1.5) +
  diversityBonus (max(0, 5 - guestCount))
```

### Collaborative Selection Flow
1. Guest joins portal → creates `photo_selection_guests` entry
2. Realtime subscription established
3. On favorite toggle:
   - Insert/delete from `photo_favorites`
   - Broadcast via Realtime to other guests
   - Update guest's `selection_count`
4. All guests see live updates

### Storage Quota Enforcement
```sql
-- Trigger on photos insert/delete
UPDATE profiles 
SET storage_used = storage_used + photo_size
WHERE id = owner_id;
```

---

## 7. Security Model

### Layered Protection
1. **Authentication**: Supabase JWT with auto-refresh
2. **Authorization**: RLS policies on all tables
3. **Row-Level Security**: Per-row access control
4. **Encryption**: At rest (PostgreSQL), in transit (TLS)
5. **Watermarking**: Invisible steganographic ID in images
6. **Audit**: `security_events` table for all sensitive actions
7. **Rate Limiting**: View limits on selection portals
8. **Session Lock**: Detects and retries on lock contention

### Secure Mode Features
- Disable downloads
- Watermark overlays
- Screenshot deterrence (visibility change detection)
- PrintScreen key blocking
- View count limits
- No right-click (CSS-based)

---

## 8. Integration Points

| Component | Integration | Purpose |
|-----------|-------------|----------|
| React App | Supabase Auth | User authentication/session |
| React App | Supabase Storage | Photo/video storage |
| React App | Supabase Realtime | Live collaboration updates |
| React App | face-api.js | Client-side face detection |
| React App | Azure Face API | Cloud face recognition (hybrid) |
| Backend | Azure Blob Storage | Primary file storage |
| Backend | PostgreSQL (pgvector) | Face embeddings |
| Backend | Stripe | Payment processing (bookings) |
| Frontend | JSZip | Client-side ZIP generation |

---

## 9. Edge Cases & Error Handling

### Identified Edge Cases
1. **Auth state race**: Listener setup before init completes → Guard with `initializingRef`
2. **Lock contention**: DB lock timeout on getSession → Retry with exponential backoff
3. **Offline sign-out**: Preserves session when `navigator.onLine === false`
4. **Face API rate limits**: Graceful fallback to local pgvector
5. **Concurrent favorites**: Realtime handles duplicate broadcasts
6. **Image load failures**: Auto-delete broken images (dev only)
7. **Selection limit exceeded**: Client-side validation + server RLS
8. **Storage quota drift**: Trigger-based enforcement with rollback protection
9. **Double initialization**: `initializationPromiseRef` singleton
10. **Component unmount during fetch**: `mountedRef` cleanup protection

### Error Handling Patterns
- **User-friendly messages**: Network errors → "Check internet connection"
- **Graceful degradation**: Azure fails → local processing
- **Logging**: Extensive console logs in dev mode
- **Timeout protection**: 8-second timeout on profile fetch
- **Retry logic**: 3 retries on lock errors

---

## 10. Performance Optimizations

### Implemented
- **Lazy loading**: Route-based code splitting (React.lazy)
- **Concurrent uploads**: 3 parallel with queue management
- **Image compression**: Web-friendly sizes before upload
- **Indexed queries**: Foreign keys indexed
- **Selective fetching**: Column selection instead of `SELECT *`
- **Realtime push**: No polling for live updates
- **Pagination**: `limit/offset` on all list queries
- **Deduplicated fetches**: Concurrent same-user profile fetches merged
- **Client-side ZIP**: JSZip avoids server round-trip

### Potential Improvements
- **CDN for assets**: Azure CDN for faster image delivery
- **Caching layer**: Redis for frequently accessed metadata
- **Web Workers**: Offload compression/face detection
- **Connection pooling**: Supabase client reuses connections

---

## 11. Code Quality Assessment

### Strengths
✅ Comprehensive error handling  
✅ Type safety throughout  
✅ Modular architecture  
✅ Security-first design  
✅ Extensive logging  
✅ Realtime collaboration  
✅ Graceful degradation  
✅ RLS policies enforced  

### Areas for Improvement
⚠️ Some components >800 lines (consider splitting)  
⚠️ Duplicate validation (client + server)  
⚠️ Hardcoded limits (maxPhotos, maxViews)  
⚠️ Demo credentials in code  
⚠️ Some SQL migrations have overlapping concerns  
⚠️ Limited unit test coverage visible  
⚠️ Magic numbers in scoring algorithm  

---

## 12. Migration Strategy Notes

### Database Migrations
- 47 migrations, sequentially numbered
- Progressive feature additions
- RLS policies evolve over time
- Storage schema refined (v2 fast selection)
- Backup/restore strategy via SQL files

### Breaking Changes
- Column additions: `is_in_selection_pool` (migration 044)
- New tables: `fast_selection_*` (streamlined flow)
- Billing schema: `billing_transactions`, `ai_unlocks`

---

## 13. Recommendations for Refactoring

### High Priority
1. **Extract constants**: Move magic numbers to config
2. **Component splitting**: Large components (>500 lines)
3. **Validation DRY**: Shared validators client/server
4. **Type narrowing**: Reduce `any` usage in legacy code

### Medium Priority
5. **Error boundaries**: More granular error handling
6. **Loading states**: Skeleton screens for better UX
7. **Memoization**: Use React.memo for heavy renders
8. **SQL organization**: Group related migrations

### Low Priority
9. **Test coverage**: Add Jest/React Testing Library
10. **E2E tests**: Cypress/Playwright flows
11. **Performance monitoring**: Add analytics
12. **Documentation**: JSDoc for public APIs

---

## 14. Key Metrics & Business Logic

### Plan Limits
| Plan | Storage | Smart Shares | AI Credits |
|------|---------|--------------|------------|
| Free | 512 MB | 1 | 1 |
| Starter | 50 GB | - | - |
| Growth | 150 GB | +10 | - |
| Professional | 300 GB | - | - |

### Feature Flags
- `enable_ai_finder`: Per-event AI toggle
- `is_secure_mode`: Watermarks, no downloads
- `moderate_guest_photos`: Approval required

### Limits
- Default max photos: 5000 per event
- Selection max: Configurable (default 50)
- Max views: Configurable (Secure mode)
- Concurrent uploads: 3
- Compression quality: 85%
- Max dimension: 2048px

---

## 15. File Structure Summary

```
src/
├── components/          # React components
│   ├── admin/          # Admin panel components
│   ├── (80+ components)
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── lib/                # Core libraries
│   ├── supabaseClient.ts
│   ├── photoService.ts
│   ├── selectionAI.ts
│   ├── realtimeSelection.ts
│   ├── faceEngine.ts
│   ├── securityEngine.ts
│   ├── uploadManager.ts
│   └── providers/      # Storage providers
├── hooks/              # Custom hooks
└── App.tsx            # Main router

supabase/
├── migrations/         # 47 SQL migrations
└── functions/          # Edge functions
```

---

## 16. Conclusion

WedHub is a production-ready SaaS platform with:
- **Mature architecture**: Clear separation of concerns
- **Scalable database**: Well-designed schema with RLS
- **AI integration**: Hybrid face recognition (local + cloud)
- **Realtime collaboration**: Live guest interactions
- **Security-focused**: Watermarks, encryption, audit trails
- **Monetization ready**: Plans, billing, credits system

**Next Steps**: Add comprehensive testing, monitoring, and CDN optimization for production scaling.

---

*Analysis completed: 2026-05-01*