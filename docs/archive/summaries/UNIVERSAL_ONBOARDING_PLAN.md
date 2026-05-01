# Universal Onboarding Transformation: Strategic & Technical Implementation Plan

**Product Goal**: Transition WedHub from "couple-centric wedding platform" to "universal celebration platform" while preserving core couple/photographer value.

**Current State**: Auth flow assumes `user_type ∈ ['couple', 'photographer']`; onboarding creates single profile row; no concept of solo users, families, or groups.

---

## 1. UX/UI Redesign Strategy

### 1.1. Role-Based Entry Point (Pattern: Progressive Disclosure)

**Current**: Sign-up form asks for email/password → auto-assigns type based on meta data → redirects.

**Proposed**:
```
┌─────────────────────────────────────────┐
│  Create Your Account                    │
│  How will you use WedHub?               │
│                                         │
│  ┌─────────────┐ ┌──────────────┐      │
│  │  💍 User    │ │ 👤 Individual│      │
│  │  Plan your  │ │  Celebrate   │      │
│  │  event      │ │  milestones  │      │
│  └─────────────┘ └──────────────┘      │
│  ┌─────────────┐ ┌──────────────┐      │
│  │  📸 Photo-  │ │  🎉 Group    │      │
│  │  grapher    │ │  (Family/    │      │
│  │  Showcase   │ │   Friends)   │      │
│  └─────────────┘ └──────────────┘      │
│                                         │
│  Already have an account? Sign In →    │
└─────────────────────────────────────────┘
```

**UI Patterns**:
- **Large touch-friendly cards** (mobile-first)
- **Icon + short benefit statement** (30 char max)
- **No jargon**; use "User" or "Individual" appropriately
- **Sign In link** expands to role-agnostic email/password form

### 1.2. Dynamic Form Flow (Conditional Branching)

**User Path**:
```
Role → Name(s) → Event Date → Guest Count → Venue (optional) → Preferences (theme, style)
```

**Individual Path**:
```
Role → Name → Birthday/Occasion → Interests (optional)
```

**Photographer Path**:
```
Role → Business Name → Specialty → Location → Portfolio upload → Pricing (optional)
```

**Group Path**:
```
Role → Group Name → Type (Family/Reunion/etc) → Member count → Admin designation
```
Role → Names (Both partners) → Wedding Date → Guest Count → Venue (optional) → Preferences (theme, style)
```

**Individual Path**:
```
Role → Name → Birthday/Occasion → Relationship status → Interests (optional)
```

**Photographer Path**:
```
Role → Business Name → Specialty → Location → Portfolio upload → Pricing (optional)
```

**Group Path**:
```
Role → Group Name → Type (Family/Reunion/etc) → Member count → Admin designation
```

### 1.3. Unified Dashboard Post-Onboarding

**Adaptive Home Screen**:
- **User**: "Your Event" card, guest list, timeline
- **Individual**: "My Events" (birthdays, anniversaries), shared albums
- **Photographer**: Studio management, bookings, portfolio
- **Group**: Shared spaces, collaborative albums

**Component Pattern**: Role-based feature flags in React Context:
```typescript
const features = {
  user: ['timeline', 'guest_manager', 'budget_tracker'],
  individual: ['albums', 'milestones', 'shared_spaces'],
  photographer: ['bookings', 'portfolio', 'client_reviews'],
  group: ['group_albums', 'voting', 'shared_guestlist']
};
```

### 1.4. Backward Compatibility Strategy

- **Existing users retain `user_type`** (no data migration needed)
- **Default role** for legacy users: If `user_type='couple'` or 'photographer', keep as-is
- **New field `primary_role`**: ENUM ('user','individual','photographer','group') with default='individual'
- **Soft transition**: 90-day banner "Update your profile to unlock new features" → optional migration

---

## 2. Information Architecture & Data Modeling

### 2.1. Database Schema Changes

#### A. Enhanced `profiles` Table (Migration `048_user_roles.sql`)
```sql
-- Add new role system
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT 'individual' 
  CHECK (primary_role IN ('user', 'individual', 'photographer', 'group')),
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS relationship_status TEXT;

-- Existing user_type remains for backward compatibility
-- (user/photographer values preserved)
```

#### B. New Table: `linked_accounts` (Relationship Management)
```sql
CREATE TABLE IF NOT EXISTS public.linked_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    linked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK (relationship_type IN ('spouse', 'family', 'friend', 'colleague')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(primary_user_id, linked_user_id)
);

-- Indexes for performance
CREATE INDEX idx_linked_accounts_primary ON linked_accounts(primary_user_id);
CREATE INDEX idx_linked_accounts_linked ON linked_accounts(linked_user_id);
```

#### C. New Table: `user_groups` (For Groups)
```sql
CREATE TABLE IF NOT EXISTS public.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('family', 'friends', 'club', 'other')),
    admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID REFERENCES public.user_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
```

#### D. Modify `events` Table (Support Multiple Owner Types)
```sql
-- Add polymorphic relationship
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user' 
  CHECK (owner_type IN ('user', 'group')),
ADD COLUMN IF NOT EXISTS owner_id TEXT; -- references profiles.id or user_groups.id

-- Backfill existing events
UPDATE public.events 
SET owner_type = 'user', owner_id = user_id::text 
WHERE owner_id IS NULL;
```

#### E. Security: RLS Policies for Relationships
```sql
-- Linked accounts: Only primary user can manage
CREATE POLICY "Users can link accounts" ON public.linked_accounts
FOR INSERT WITH CHECK (auth.uid() = primary_user_id);

CREATE POLICY "Users can view linked accounts" ON public.linked_accounts
FOR SELECT USING (
  auth.uid() = primary_user_id OR 
  auth.uid() = linked_user_id
);

-- Groups: Admins manage, members view
CREATE POLICY "Group admins can modify" ON public.user_groups
FOR ALL USING (auth.uid() = admin_user_id);
```

### 2.2. Data Integrity Considerations

**Circular Relationships**: Prevent A→B and B→A duplicates via check constraint
```sql
ALTER TABLE linked_accounts 
ADD CONSTRAINT no_duplicate_links 
CHECK (primary_user_id < linked_user_id);
```

**Soft Deletes**: Add `deleted_at` to all user tables for audit

**Migration Safety**: 
- All new columns `DEFAULT` to safe values
- New tables created `IF NOT EXISTS`
- Backfill queries idempotent

---

## 3. Onboarding Logic & Personalization

### 3.1. Frontend State Machine (XState Pattern)

```typescript
// src/lib/onboardingMachine.ts
const onboardingMachine = createMachine({
  id: 'onboarding',
  initial: 'roleSelection',
  states: {
    roleSelection: {
      on: { SELECT_ROLE: 'collectingInfo' }
    },
    collectingInfo: {
      on: {
        NEXT: {
          target: 'userDetails',
          cond: 'isUser'
        },
        NEXT: {
          target: 'individualDetails',
          cond: 'isIndividual'
        },
        NEXT: {
          target: 'photographerSetup',
          cond: 'isPhotographer'
        }
      }
    },
    userDetails: { on: { COMPLETE: 'linkingAccounts' } },
    individualDetails: { on: { COMPLETE: 'interests' } },
    photographerSetup: { on: { COMPLETE: 'verification' } },
    linkingAccounts: { 
      on: { 
        SKIP: 'complete',
        LINK_PARTNER: 'waitingForInvite'
      }
    },
    complete: { type: 'final' }
  }
});
```

### 3.2. Backend Workflow (Supabase Edge Functions)

**Endpoint**: `POST /api/onboarding/initialize`

```typescript
// Request
{
  email: string;
  password: string;
  primary_role: 'user' | 'individual' | 'photographer' | 'group';
  metadata: object; // role-specific data
  invite_code?: string; // for joining existing groups/partners
}

// Response
{
  user_id: string;
  profile_id: string;
  requires_verification: boolean;
  redirect_to: '/dashboard' | '/setup/complete';
  permissions: string[];
}
```

**Logic Flow**:
1. **Create user** in Supabase Auth
2. **Create profile** with `primary_role`
3. **Branch by role**:
   - **User**: Create `linked_accounts` pending entry, send invite email
   - **Photographer**: Set `is_verified=false`, require portfolio review
   - **Individual**: Auto-verify, grant basic permissions
   - **Group**: Create `user_groups` record, set inviter as admin
4. **Generate JWT** with role claims
5. **Return dashboard path** based on role capabilities

### 3.3. Permission System (Row Level Security)

**Dynamic Policy Generation** based on `primary_role`:

```sql
-- Example: Event visibility
CREATE POLICY "Owners see their events" ON public.events
FOR SELECT USING (
  (
    owner_type = 'user' AND 
    owner_id = auth.uid()::text
  ) OR (
    owner_type = 'group' AND 
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_id = owner_id::uuid AND user_id = auth.uid()
    )
  )
);
```

**Client-side Feature Flags**:
```typescript
// src/contexts/FeatureContext.tsx
const features = {
  create_events: ['user', 'individual', 'group'],
  photographer_portfolio: ['photographer'],
  budget_tracker: ['user'],
  guest_list: ['user', 'group']
};

export const useFeatures = () => {
  const { profile } = useAuth();
  return (feature: string) => 
    features[feature]?.includes(profile?.primary_role);
};
```

---

## 4. Product Positioning & Copywriting

### 4.1. Brand Voice Guidelines

**Old**: "The #1 wedding planning app for couples"  
**New**: "Where every celebration finds its story"

### 4.2. Copy Examples by Role

| Element | User | Individual | Photographer | Group |
|---------|------|------------|--------------|-------|
| **Hero Headline** | "Your event, perfectly planned" | "Life's moments, beautifully captured" | "Showcase your vision" | "Together, always" |
| **Subheadline** | "All-in-one toolkit for your special day" | "Create albums for birthdays, trips, and milestones" | "Connect with clients, deliver galleries faster" | "Shared spaces for families & friends" |
| **CTA Button** | "Start Planning" | "Create My First Album" | "Build My Portfolio" | "Start Our Group" |
| **Value Prop** | Guest lists, budgets, timelines | Memory preservation, easy sharing | Client management, proofs | Collaborative curation |

### 4.3. Authentication Page Messaging

**Header Options** (contextual):
- "Sign in to your celebration space"
- "Welcome back — where memories live"

**Helper Text**:
- Below role cards: "All plans include free cloud storage. Switch anytime."
- Privacy reassurance: "Your data, always yours. We never sell or share."

### 4.4. Empty State Guidance

**User**:
- "You haven't created any events yet"
- CTA: "Start with your special occasion"

**Individual**:
- "You haven't created any albums yet"
- CTA: "Start with a birthday or vacation album"

**Photographer**:
- "Your portfolio is empty"
- CTA: "Upload your first gallery"


---

## 5. Technical Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Tasks**:
1. ✅ **Database Migrations**
   - Create `048_user_roles.sql` (profiles enhancements)
   - Create `049_linked_accounts.sql` (relationships)
   - Create `050_user_groups.sql` (groups system)
   - Create `051_events_polymorphic.sql` (owner flexibility)

2. ✅ **Backend Contracts**
   - Update `supabaseClient.ts` to include new tables
   - Create `src/lib/roles.ts` - Type definitions for roles
   ```typescript
   export type UserRole = 'user' | 'individual' | 'photographer' | 'group';
   
   export interface Profile {
     id: string;
     primary_role: UserRole;
     display_name: string;
     // ... existing fields
   }
   ```

3. ✅ **Auth Context Update**
   - Extend `UserProfile` interface
   - Add `role` to profile fetch
   - Update `signUp` to accept `primary_role` parameter

**Deliverables**: Database schema updated, backward-compatible

### Phase 2: Frontend Role Selection (Week 3)

**Tasks**:
1. ✅ **Role Selection Component**
   - Create `src/components/RoleSelection.tsx`
   - Responsive grid of cards
   - Local storage persistence (in case of drop-off)

2. ✅ **Sign-up Flow Restructure**
   - Update `SignUp.tsx` to include role selection as Step 1
   - Conditional rendering of subsequent steps
   - Validation per role type

3. ✅ **Routing Updates**
   - Add `/role-selection` route
   - Update `App.tsx` routes to handle role-based redirects
   - Create wrapper components: `RoleBasedRoute`

**Code Example**:
```tsx
// src/components/SignUp.tsx
export const SignUp = () => {
  const [step, setStep] = useState<'role' | 'details' | 'complete'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  
  return (
    <div>
      {step === 'role' && (
        <RoleSelection onSelect={(role) => {
          setSelectedRole(role);
          setStep('details');
        }} />
      )}
      {step === 'details' && selectedRole && (
        <RoleSpecificForm 
          role={selectedRole}
          onComplete={() => setStep('complete')}
        />
      )}
    </div>
  );
};
```

### Phase 3: Dynamic Onboarding (Week 4-5)

**Tasks**:
1. ✅ **Role-Specific Forms**
   - `UserOnboardingForm.tsx` - User details, optional partner invite
   - `IndividualOnboardingForm.tsx` - Personal info, interests
   - `PhotographerOnboardingForm.tsx` - Business details, portfolio upload
   - `GroupOnboardingForm.tsx` - Group type, member invitations

2. ✅ **Partner Invite System**
   - Email invitation flow
   - Tokenized link generation
   - Account linking on accept

3. ✅ **Dashboard Personalization**
   - Refactor `Dashboard.tsx` to render based on `primary_role`
   - Create `src/views/` directory:
     - `UserDashboard.tsx`
     - `IndividualDashboard.tsx`
     - `PhotographerDashboard.tsx`
     - `GroupDashboard.tsx`

**Partner Invite Flow**:
```typescript
// Create invite
const { data: invite } = await supabase
  .from('partner_invites')
  .insert({
    inviter_id: user.id,
    invitee_email,
    role: 'spouse'
  })
  .select()
  .single();

// Send email with link
const link = `${window.location.origin}/accept-invite/${invite.code}`;
await sendEmail({ to: invitee_email, template: 'partner_invite', link });
```

### Phase 4: Permissions & Feature Flags (Week 6)

**Tasks**:
1. ✅ **Feature Context**
   - Create `FeatureContext.tsx`
   - Provide `hasFeature(feature: string)` hook

2. ✅ **UI Adaptation**
   - Update navigation to show/hide routes based on role
   - Conditionally render components:
     ```tsx
     {hasFeature('photographer_portfolio') && <PortfolioSection />}
     ```

3. ✅ **Backend Validation**
   - Add RLS policies for new tables
   - Update existing policies to check `owner_type`

### Phase 5: Migration & Launch (Week 7)

**Tasks**:
1. ✅ **Data Migration Script**
   - Map existing `user_type='couple'` → `primary_role='user'`
   - Map `user_type='photographer'` → `primary_role='photographer'`
   - Default others → `primary_role='individual'`
   - **SQL**:
     ```sql
     UPDATE profiles
     SET primary_role = CASE 
       WHEN user_type = 'couple' THEN 'user'
       WHEN user_type = 'photographer' THEN 'photographer'
       ELSE 'individual'
     END;
     ```

2. ✅ **Beta Testing**
   - 100 existing users get new flow
   - A/B test conversion rates
   - Monitor support tickets

3. ✅ **Monitoring**
   - Track role distribution
   - Feature adoption rates
   - Drop-off points in onboarding

4. ✅ **Rollout**
   - Gradual rollout: 10% → 50% → 100%
   - Feature flag to revert quickly

---

## 6. Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| **Breaking existing users** | Maintain backward compatibility; `user_type` never removed |
| **Overcomplicated UI** | Progressive disclosure; simple role cards at entry |
| **Data integrity issues** | Transactional migrations; rollback scripts ready |
| **Performance regression** | Index new tables; monitor query times |

### Product Risks

| Risk | Mitigation |
|------|------------|
| **Couples feel de-prioritized** | Keep couple features prominent; messaging affirms core value |
| **Photographer churn** | Preserve business tools; make "pro" features obvious |
| **User confusion** | Clear micro-copy; explain why role matters |
| **Empty state overwhelm** | Smart defaults; guided tours for new roles |

---

## 7. Success Metrics

**Quantitative**:
- Sign-up conversion rate (target: +20%)
- Time-to-first-action (target: -30%)
- Role distribution: 40% couple, 30% individual, 20% photographer, 10% group
- 7-day retention (target: +15%)

**Qualitative**:
- User interviews on clarity of role selection
- Support ticket volume (should not increase)
- NPS score for "ease of getting started"

---

## 8. Summary

This plan transforms WedHub from a niche wedding tool into a universal celebration platform by:

1. **Frontend**: Role-based cards → dynamic forms → adaptive dashboard
2. **Backend**: Enhanced schema for roles, relationships, groups
3. **Logic**: State machine onboarding with permission branching
4. **Copy**: Inclusive language acknowledging all celebration types
5. **Roadmap**: 7-week phased rollout with zero downtime

**Key Principle**: The app still excels for couples and photographers, but now welcomes individuals and groups without forcing them into a "wedding" box.

*Implementation can begin immediately with database migrations (Phase 1).*

---

**Appendix: Database Migration Files**  
(See attached SQL files in `/supabase/migrations/048-051/` for full DDL)*