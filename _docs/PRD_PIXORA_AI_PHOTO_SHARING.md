# Product Requirements Document: Pixora AI Smart Photo Sharing Platform

## 1. Product Summary

Pixora is an AI-powered photo sharing, selection, and delivery platform for event photographers, wedding studios, and event guests. The product helps photographers upload large event galleries, protect their work, let guests find photos using a selfie, collect client selections, manage leads/bookings, and deliver photos through branded portals.

The core promise is simple: guests should be able to find their own photos from a large event gallery in seconds, while photographers retain control over access, branding, privacy, downloads, and client communication.

## 2. Product Vision

Pixora should become the operating layer for modern wedding and event photographers: upload photos once, let AI organize and match faces, share secure portals with guests, collect album selections, and convert gallery traffic into bookings.

## 3. Problem Statement

Photographers often deliver thousands of photos after weddings and events. Guests struggle to find themselves, couples struggle to shortlist album photos, and photographers spend time answering repetitive requests, manually sorting galleries, and protecting images from unauthorized downloads.

Existing gallery tools usually solve only storage and sharing. They do not combine AI face search, secure sharing, selection workflows, photographer branding, marketplace discovery, and admin oversight in one product.

## 4. Target Users

### 4.1 Primary Users

Photographers and studios:
- Upload and manage event galleries.
- Share guest access links and QR codes.
- Protect previews using watermarking and access controls.
- Collect final selections from clients.
- Manage portfolio, packages, leads, and bookings.

Couples and event hosts:
- Create or access events.
- Invite guests to view or find photos.
- Select favorite photos for albums or delivery.
- Communicate with photographers.

Guests:
- Open a public or secure event link.
- Register or verify access.
- Take/upload a selfie.
- See matched photos.
- Download or request access where allowed.

### 4.2 Secondary Users

Platform admins:
- Monitor users, photographers, events, support, revenue, and abuse.
- Resolve support conversations.
- Track usage and health of the platform.

## 5. Goals

1. Reduce time guests spend finding their photos from minutes or hours to seconds.
2. Help photographers protect and monetize photo access.
3. Make client selection workflows structured, trackable, and deadline-driven.
4. Give studios a branded delivery experience.
5. Provide enough admin controls to operate the platform safely.
6. Build a scalable foundation for AI matching, storage, and event growth.

## 6. Non-Goals

1. Full photo editing or Lightroom replacement.
2. End-to-end payment settlement in the first production release.
3. Native mobile apps in the initial launch.
4. Manual retouching, album design, or print fulfillment.
5. Replacing cloud storage providers entirely; Pixora should orchestrate storage and access.

## 7. Success Metrics

### Activation
- Percentage of photographers who create their first event.
- Percentage of created events with at least one uploaded photo.
- Time from signup to first successful event share.

### Engagement
- Number of guest portal sessions per event.
- Percentage of guests who complete selfie matching.
- Average number of matched photos viewed per guest.
- Client selection completion rate.

### Quality
- AI match precision and recall based on user feedback.
- Failed upload rate.
- Average photo processing time.
- Backend error rate.

### Business
- Photographer retention after first event.
- Booking inquiries generated from public profiles.
- Conversion from free/trial to paid plans.
- Support tickets per active event.

## 8. Key User Journeys

### 8.1 Photographer Creates and Shares an Event

1. Photographer signs up or signs in.
2. Photographer creates an event with name, date, location, cover image, and access rules.
3. Photographer uploads photos manually or through camera sync.
4. System compresses/validates photos, stores metadata, indexes faces, and marks photos ready.
5. Photographer enables public gallery, smart share, or client selection mode.
6. System generates share links and QR codes.
7. Guests access the portal and find photos.

### 8.2 Guest Finds Photos With a Selfie

1. Guest opens a smart share link or QR code.
2. Guest verifies access via password or OTP.
3. Guest grants camera access or uploads a selfie.
4. Backend extracts face embedding.
5. System searches event photo embeddings.
6. Guest sees ranked photo matches with thumbnails and confidence.
7. Guest downloads permitted photos or requests access.

### 8.3 Couple Selects Album Photos

1. Couple opens selection portal.
2. Portal shows approved photos and selection limits.
3. Couple favorites, compares, filters, and reviews photos.
4. System enforces selection cap, deadline, secure mode, and view limits.
5. Couple submits final selection.
6. Photographer sees submitted selections and can download/export chosen files.

### 8.4 Photographer Uses Marketplace Features

1. Photographer creates profile with studio branding, packages, portfolio, pricing, languages, location, and specialties.
2. Clients browse marketplace and filter photographers.
3. Client submits lead inquiry or booking request.
4. Photographer receives message and can respond.
5. Platform tracks conversion and engagement.

### 8.5 Admin Monitors Platform

1. Admin signs into partner portal.
2. Admin views dashboard stats, users, events, photographers, support, and revenue.
3. Admin opens support conversations and responds.
4. Admin reviews suspicious activity or abuse reports.

## 9. Functional Requirements

### 9.1 Authentication and Profiles

Requirements:
- Users can sign up as couple or photographer.
- Users can sign in, sign out, reset password, and update password.
- User profile must include name, email, user type, avatar, admin flag, and timestamps.
- Photographer users should automatically receive a photographer profile.
- Admin-only routes must be protected.

Acceptance criteria:
- Unauthenticated users are redirected to sign in for protected routes.
- Non-photographers cannot access photographer-only tools.
- Non-admin users cannot access partner/admin routes.
- Missing profile states are handled with a clear recovery path.

### 9.2 Event Management

Requirements:
- Photographers can create, edit, view, archive/delete, and manage events.
- Events include name, date, location, description, cover image, QR code, status, and access settings.
- Events can support guest uploads, AI finder, client selection, and smart share links.
- Event dashboard shows photo counts, guest activity, selection status, and key actions.

Acceptance criteria:
- Event owner can update event metadata.
- Non-owner cannot update or delete the event.
- Event cover upload works and returns a usable public or signed URL.
- QR/share links resolve to the correct event.

### 9.3 Photo Upload and Processing

Requirements:
- Photographers can upload multiple images.
- Supported formats: JPEG, PNG, WebP, HEIC/HEIF where supported.
- Upload manager supports queueing, progress, concurrency limits, compression, and metadata persistence.
- Photos store event ID, uploader ID, path, size, type, dimensions, status, approval state, guest-upload flag, and edited/raw flag.
- Uploaded photos should be indexed for face recognition.

Acceptance criteria:
- Upload progress is visible per file.
- Failed uploads show actionable errors.
- Completed uploads appear in the relevant event gallery.
- Face indexing failure does not block basic upload completion, but processing status must reflect the problem.

### 9.4 AI Face Matching

Requirements:
- System extracts face embeddings from event photos.
- System extracts embeddings from guest selfies.
- System uses vector search to match selfies against event photos.
- Matching results include photo ID, signed/display URL, thumbnail URL, and similarity.
- System rejects selfies with no face or multiple faces for the smart share flow.

Acceptance criteria:
- Guest receives no cross-event matches.
- Expired or invalid sessions cannot call match APIs.
- Large selfie uploads are rejected.
- Matching returns results sorted by similarity.

### 9.5 Smart Share

Requirements:
- Photographer can create share links for an event.
- Share links support password and OTP modes.
- Links have expiration dates.
- Guests verify access before matching.
- Backend issues short-lived session tokens.
- Access attempts and match attempts are logged.

Acceptance criteria:
- Invalid tokens return not found.
- Expired links return expired status.
- Incorrect password is rejected.
- Session token expires after configured duration.
- Guest cannot reuse a token for a different share link.

### 9.6 Client Selection Portal

Requirements:
- Photographer can configure selection rules: max photos, deadline, secure mode, max views, and selection pool.
- Client can browse, favorite, compare, deselect, and submit photos.
- Portal should show selected count and remaining allowance.
- Photographer can view submitted selections.
- System supports download/export of selected photo list.

Acceptance criteria:
- Client cannot submit more than max allowed photos.
- Deadline and view limits are enforced.
- Submitted selections persist and are visible to photographer.
- Selection state survives refresh.

### 9.7 Gallery Protection

Requirements:
- Secure galleries should discourage unauthorized downloads.
- Watermarked/preview images should be used where appropriate.
- High-resolution downloads require permission, signed URLs, or authenticated access.
- Right-click, drag, print, and screenshot deterrents may be used as soft protection, but must not be treated as true security.

Acceptance criteria:
- Private photos are not exposed through permanent public URLs.
- Signed URLs expire.
- Watermark rendering fails gracefully.

### 9.8 Marketplace and Booking

Requirements:
- Public marketplace lists photographers.
- Users can filter by location, style, budget, event type, and rating.
- Photographer profile shows portfolio, packages, reviews, and inquiry CTA.
- Clients can submit lead inquiries.
- Booking flow can create a booking record and conversation.

Acceptance criteria:
- Marketplace loads without requiring authentication.
- Photographer profile pages are shareable.
- Users cannot book their own package.
- Booking errors do not create duplicate records.

### 9.9 Messaging and Support

Requirements:
- Clients and photographers can message each other.
- Admin support conversations are separate or clearly marked.
- Users can delete messages where permitted.
- Admins can view and respond to support conversations.

Acceptance criteria:
- Only participants can see private conversations.
- Admins can access support chats.
- Message send failure is visible to user.

### 9.10 Admin Portal

Requirements:
- Admin dashboard shows platform stats.
- Admin can view users, photographers, events, support, and revenue.
- Admin routes require admin profile flag.
- Admin actions should be auditable.

Acceptance criteria:
- Non-admin users are redirected away from admin routes.
- Admin tables load paginated data.
- Sensitive admin data is not available through public policies.

## 10. Non-Functional Requirements

### 10.1 Security

- No service-role secrets in frontend code.
- No Azure SAS write tokens exposed to browsers unless scoped and short-lived.
- Smart share passwords must use strong hashing.
- JWT secret must be required in production.
- CORS must be restricted to configured frontend origins.
- Photo storage should default to private for sensitive event galleries.
- Rate limits must be applied to verification and selfie matching.

### 10.2 Privacy

- Face embeddings are biometric-adjacent data and must be protected.
- Users should be informed that selfies are used for matching.
- Selfie temp files should be deleted after processing.
- Access logs should avoid unnecessary personal data.
- Data deletion workflows should cover photos, embeddings, guests, and events.

### 10.3 Performance

- Guest match results should return within 5 seconds for typical event sizes.
- Uploads should support at least 3 concurrent files by default.
- Large galleries should paginate or virtualize rendering.
- Main app bundle should stay below agreed performance budget.
- AI models should be lazy-loaded only where needed.

### 10.4 Reliability

- Failed AI processing should not corrupt uploaded photo records.
- Background jobs should be retryable.
- Redis/session failure should fail closed for protected routes where required.
- Migrations should be repeatable and safe for fresh environments.

### 10.5 Accessibility

- Keyboard navigation for auth, gallery, selection, and admin flows.
- Sufficient contrast for text and controls.
- Buttons and icon-only actions require accessible labels.
- Forms should expose validation errors without relying only on alerts.

## 11. Technical Requirements

### 11.1 Frontend

- React with Vite.
- Route-based code splitting.
- Tailwind CSS for styling.
- Supabase client for authenticated database operations.
- Avoid permanent public URLs for protected photos.
- Replace browser alerts with inline toasts/modals.
- Remove production debug logging or gate it behind environment flags.

### 11.2 Backend

- FastAPI service for AI matching and secure share APIs.
- DeepFace/Facenet for local embeddings.
- Redis for rate limiting and optional session revocation.
- JWT-backed guest sessions.
- Structured JSON logging.
- Background processing for photo embedding extraction.

### 11.3 Database and Storage

- Supabase Postgres with pgvector.
- RLS policies for events, photos, profiles, selections, bookings, conversations, and admin resources.
- Storage buckets for photos, event covers, studio assets, and models where applicable.
- Signed URLs for private photo access.
- Linear migration strategy with fresh-environment baseline.

## 12. MVP Scope

MVP must include:
- Photographer signup/signin.
- Event creation.
- Manual photo upload.
- AI indexing for uploaded photos.
- Smart share link with password verification.
- Guest selfie matching.
- Secure matched photo viewing.
- Client selection portal with max count and submission.
- Photographer dashboard for events and selections.
- Basic admin dashboard.

MVP can defer:
- Full OTP delivery.
- Payment gateway integration.
- Native camera sync.
- Advanced marketplace matching.
- Automated album export packages.
- Native mobile apps.

## 13. Release Plan

### Phase 1: Stabilization

- Fix TypeScript errors.
- Fix backend test imports and CI env vars.
- Make backend import clean in a fresh environment.
- Remove generated cache artifacts from git tracking.
- Add smoke tests for frontend build and backend health.

### Phase 2: Secure Smart Share

- Require JWT secret.
- Finalize password verification.
- Add real OTP provider abstraction.
- Fail closed when Redis/rate limiter is unavailable in production.
- Add private bucket signed URL flow.

### Phase 3: Core Photographer Workflow

- Polish event creation and upload UX.
- Add resilient background face indexing.
- Add processing status UI.
- Add selection management and export.

### Phase 4: Marketplace and Growth

- Improve photographer profiles.
- Add inquiry tracking.
- Add package/booking flow.
- Add analytics for profile views and leads.

### Phase 5: Admin and Operations

- Add admin audit log.
- Add abuse monitoring.
- Add support SLAs and response tracking.
- Add operational dashboards.

## 14. Analytics Events

Recommended events:
- `signup_started`
- `signup_completed`
- `event_created`
- `photos_upload_started`
- `photos_upload_completed`
- `photo_processing_failed`
- `share_link_created`
- `guest_access_verified`
- `guest_selfie_submitted`
- `guest_matches_returned`
- `selection_started`
- `selection_submitted`
- `lead_inquiry_created`
- `booking_created`
- `admin_support_message_sent`

Each event should include:
- User role where available.
- Event ID where applicable.
- Non-sensitive error code where applicable.
- Duration for upload, processing, and matching flows.

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Face matching accuracy is inconsistent | Guests lose trust | Add confidence thresholds, feedback, and fallback browsing |
| Public photo URLs leak protected photos | Photographer trust damage | Private buckets and short-lived signed URLs |
| Large JS bundle slows first load | Poor conversion | Code split AI/admin/marketplace chunks |
| AI model startup is slow | Backend cold-start delays | Warm models, queue processing, show processing states |
| OTP remains placeholder | Security and product gap | Integrate email/SMS provider before production |
| Migrations drift | Deployment failures | Create baseline migration and CI migration test |
| Browser camera permissions fail | Guest friction | Support selfie upload fallback |

## 16. Open Questions

1. Should Pixora store original high-resolution files, previews only, or both?
2. Should guests be allowed to download matched photos for free, or only view/request them?
3. What is the intended pricing model: per event, monthly studio subscription, storage-based, or commission?
4. Is OTP required for MVP, or can password-only smart share launch first?
5. What legal/consent language is required for selfie-based matching in target markets?
6. Should AI matching run fully in backend, browser, or hybrid mode?
7. Should marketplace booking include payments in MVP?
8. What are the minimum admin controls needed before public launch?

## 17. Acceptance Checklist for Production Readiness

- Frontend typecheck passes.
- Frontend production build passes without critical warnings.
- Backend imports successfully in a clean environment.
- Backend tests pass in CI.
- No service-role or storage write secrets exposed in frontend bundle.
- Smart share verification rejects invalid credentials.
- Protected photo URLs expire.
- Upload, processing, matching, and selection flows have clear error states.
- RLS policies are reviewed for all public and authenticated tables.
- Admin routes are protected server-side and client-side.
- Privacy notice covers selfie matching and face embeddings.

