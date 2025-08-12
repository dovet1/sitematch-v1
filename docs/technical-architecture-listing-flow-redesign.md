# Technical Architecture: Listing Flow Redesign
## Immediate Creation with Progressive Enhancement

**Project**: Listing Flow Redesign  
**PRD Reference**: [docs/prd-listing-flow-redesign.md](./prd-listing-flow-redesign.md)  
**Date**: 2025-01-04  
**Architect**: Claude Technical Architect  

---

## Executive Summary

This document provides the comprehensive technical architecture for transforming the existing 6-step listing wizard into an immediate creation experience with progressive enhancement. The solution leverages the existing Next.js/Supabase infrastructure while adding sophisticated auto-save, version management, and real-time editing capabilities.

### Key Architectural Decisions

1. **Evolutionary Architecture**: Extends existing patterns rather than replacing them
2. **Version Management**: New versioning system for draft/live listing states
3. **Real-Time Updates**: Supabase subscriptions for auto-save and conflict resolution
4. **Progressive Enhancement**: Section-based editing with immediate persistence
5. **Backward Compatibility**: Maintains all existing functionality and APIs

---

## Current System Analysis

### Existing Architecture Overview

The current system uses a robust multi-step wizard architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Step 1-6      │───▶│  Draft Listings  │───▶│  Final Submit   │
│   Wizard Form   │    │   (localStorage   │    │   (Supabase)    │
│                 │    │   + Database)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Current Data Flow:**
- User progresses through 6 wizard steps
- Auto-save to localStorage + draft database entries
- Final submission creates listing with `status: 'pending'`
- Rich relational model with junction tables

**Existing Database Schema:**
```sql
-- Core tables (existing)
listings (id, company_name, status, created_by, ...)
listing_contacts (listing_id, contact_name, is_primary_contact, ...)
listing_locations (listing_id, place_name, coordinates, ...)
faqs (listing_id, question, answer, display_order, ...)
file_uploads (listing_id, file_type, file_path, ...)
listing_sectors (listing_id, sector_id)
listing_use_classes (listing_id, use_class_id)
```

---

## New Architecture Design

### 1. Database Schema Evolution

#### 1.1 Version Management System (Addresses FR11)

```sql
-- New version management tables
CREATE TABLE listing_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,  -- Complete listing snapshot
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, pending, approved, rejected
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    is_live BOOLEAN DEFAULT FALSE,  -- Only one version can be live
    UNIQUE(listing_id, version_number)
);

-- Index for performance
CREATE INDEX idx_listing_versions_listing_id ON listing_versions(listing_id);
CREATE INDEX idx_listing_versions_live ON listing_versions(listing_id, is_live) WHERE is_live = TRUE;
CREATE INDEX idx_listing_versions_pending ON listing_versions(status) WHERE status = 'pending';

-- Auto-increment version numbers
CREATE OR REPLACE FUNCTION increment_version_number()
RETURNS TRIGGER AS $$
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO NEW.version_number
    FROM listing_versions 
    WHERE listing_id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_version_increment
    BEFORE INSERT ON listing_versions
    FOR EACH ROW EXECUTE FUNCTION increment_version_number();
```

#### 1.2 Enhanced Listings Table

```sql
-- Add new fields to existing listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES listing_versions(id);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS live_version_id UUID REFERENCES listing_versions(id);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP DEFAULT NOW();
ALTER TABLE listings ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Update trigger for last_edited_at
CREATE OR REPLACE FUNCTION update_listing_edited_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_edited_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_update_edited_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_listing_edited_at();
```

#### 1.3 Auto-Save Tracking

```sql
-- Track auto-save operations for debugging and conflict resolution
CREATE TABLE auto_save_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    section_type VARCHAR(50) NOT NULL,  -- 'requirements', 'contacts', 'faqs', etc.
    changes JSONB NOT NULL,  -- What changed
    saved_at TIMESTAMP DEFAULT NOW(),
    client_timestamp TIMESTAMP,  -- Client-side timestamp for conflict resolution
    session_id VARCHAR(100)  -- Browser session identifier
);

CREATE INDEX idx_auto_save_listing_user ON auto_save_log(listing_id, user_id);
CREATE INDEX idx_auto_save_recent ON auto_save_log(saved_at DESC);
```

### 2. API Architecture

#### 2.1 New API Endpoints

```typescript
// Auto-save endpoints
PUT /api/listings/[id]/sections/[section]
POST /api/listings/[id]/auto-save
GET /api/listings/[id]/conflicts

// Version management
POST /api/listings/[id]/versions
GET /api/listings/[id]/versions
PUT /api/listings/[id]/versions/[versionId]/submit
PUT /api/listings/[id]/versions/[versionId]/approve

// Preview functionality  
GET /api/listings/[id]/preview
```

#### 2.2 Auto-Save API Design

```typescript
// PUT /api/listings/[id]/sections/[section]
interface SectionUpdateRequest {
  section: 'requirements' | 'contacts' | 'faqs' | 'locations' | 'documents';
  data: any;  // Section-specific data
  clientTimestamp: string;  // For conflict resolution
  sessionId: string;
}

interface SectionUpdateResponse {
  success: boolean;
  conflicts?: ConflictInfo[];
  lastSaved: string;
  version: number;
}

interface ConflictInfo {
  field: string;
  yourValue: any;
  latestValue: any;
  lastModifiedBy: string;
  lastModifiedAt: string;
}
```

### 3. Component Architecture

#### 3.1 New Component Hierarchy

```
apps/web/src/components/listings/
├── listing-detail/                    # New listing detail page
│   ├── listing-detail-page.tsx       # Main container
│   ├── listing-header.tsx            # Title, status, actions
│   ├── listing-sections.tsx          # Section grid layout
│   └── sections/                     # Individual section components
│       ├── requirements-section.tsx
│       ├── contacts-section.tsx
│       ├── faqs-section.tsx
│       ├── locations-section.tsx
│       └── documents-section.tsx
├── editing/                          # In-place editing components
│   ├── section-editor.tsx           # Base editor wrapper
│   ├── auto-save-indicator.tsx      # Save status display
│   ├── conflict-resolver.tsx        # Handle edit conflicts
│   └── editors/                     # Section-specific editors
│       ├── requirements-editor.tsx
│       ├── contact-editor.tsx
│       ├── faq-editor.tsx
│       └── location-editor.tsx
├── preview/                         # Preview functionality
│   ├── listing-preview.tsx         # Preview modal/page
│   └── preview-sections/            # Read-only section displays
└── version-management/              # Version control UI
    ├── version-selector.tsx
    ├── version-diff.tsx
    └── submission-flow.tsx
```

#### 3.2 Auto-Save Hook Architecture

```typescript
// hooks/use-auto-save.ts
interface UseAutoSaveOptions {
  listingId: string;
  section: string;
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  onConflict?: (conflicts: ConflictInfo[]) => void;
}

export function useAutoSave(options: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  
  const debouncedSave = useMemo(
    () => debounce(async (data: any) => {
      // Auto-save implementation
    }, options.debounceMs || 2000),
    [options.listingId, options.section]
  );
  
  return {
    saveData: debouncedSave,
    saveStatus,
    lastSaved,
    conflicts,
    clearConflicts: () => setConflicts([])
  };
}
```

### 4. Real-Time Updates Architecture

#### 4.1 Supabase Subscriptions

```typescript
// Real-time subscription for conflict detection
const subscription = supabase
  .channel(`listing:${listingId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'listings',
    filter: `id=eq.${listingId}`
  }, (payload) => {
    // Handle real-time updates
    if (payload.new.last_edited_at > lastLocalEdit) {
      checkForConflicts();
    }
  })
  .subscribe();
```

#### 4.2 Conflict Resolution Strategy

```typescript
interface ConflictResolutionStrategy {
  // Last write wins with user confirmation
  resolveConflict(field: string, strategy: 'keep-mine' | 'use-theirs' | 'merge'): void;
  
  // Auto-merge for non-conflicting changes
  autoMerge(localChanges: any, remoteChanges: any): any;
  
  // Show conflict UI
  showConflictDialog(conflicts: ConflictInfo[]): Promise<ConflictResolution>;
}
```

### 5. Migration Strategy

#### 5.1 Database Migration Plan

```sql
-- Migration: 001_add_version_management.sql
BEGIN;

-- Step 1: Add new tables
-- (listing_versions, auto_save_log as defined above)

-- Step 2: Add new columns to existing tables
ALTER TABLE listings ADD COLUMN current_version_id UUID;
ALTER TABLE listings ADD COLUMN live_version_id UUID;
ALTER TABLE listings ADD COLUMN last_edited_at TIMESTAMP DEFAULT NOW();
ALTER TABLE listings ADD COLUMN completion_percentage INTEGER DEFAULT 0;

-- Step 3: Create initial versions for existing listings
INSERT INTO listing_versions (listing_id, version_number, content, status, is_live)
SELECT 
    id,
    1,
    row_to_json(listings.*),
    CASE 
        WHEN status = 'approved' THEN 'approved'
        WHEN status = 'pending' THEN 'pending'
        ELSE 'draft'
    END,
    CASE WHEN status = 'approved' THEN TRUE ELSE FALSE END
FROM listings;

-- Step 4: Update foreign key references
UPDATE listings 
SET 
    current_version_id = v.id,
    live_version_id = CASE WHEN v.is_live THEN v.id ELSE NULL END
FROM listing_versions v 
WHERE listings.id = v.listing_id;

-- Step 5: Add foreign key constraints
ALTER TABLE listings ADD CONSTRAINT fk_current_version 
    FOREIGN KEY (current_version_id) REFERENCES listing_versions(id);
ALTER TABLE listings ADD CONSTRAINT fk_live_version 
    FOREIGN KEY (live_version_id) REFERENCES listing_versions(id);

COMMIT;
```

#### 5.2 Rollback Plan

```sql
-- Rollback: Remove version management if needed
BEGIN;

-- Remove foreign key constraints
ALTER TABLE listings DROP CONSTRAINT IF EXISTS fk_current_version;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS fk_live_version;

-- Remove new columns
ALTER TABLE listings DROP COLUMN IF EXISTS current_version_id;
ALTER TABLE listings DROP COLUMN IF EXISTS live_version_id;
ALTER TABLE listings DROP COLUMN IF EXISTS last_edited_at;
ALTER TABLE listings DROP COLUMN IF EXISTS completion_percentage;

-- Drop new tables
DROP TABLE IF EXISTS auto_save_log;
DROP TABLE IF EXISTS listing_versions;

-- Drop functions and triggers
DROP TRIGGER IF EXISTS listing_version_increment ON listing_versions;
DROP FUNCTION IF EXISTS increment_version_number();
DROP TRIGGER IF EXISTS listing_update_edited_at ON listings;
DROP FUNCTION IF EXISTS update_listing_edited_at();

COMMIT;
```

### 6. Progressive Enhancement Implementation

#### 6.1 Section-Based Editing Pattern

```typescript
// Section base interface
interface EditableSection {
  id: string;
  title: string;
  isEmpty: boolean;
  data: any;
  validationRules?: ValidationRule[];
  onEdit: () => void;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

// Section component pattern
function RequirementsSection({ listingId, data, onUpdate }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);
  const { saveData, saveStatus } = useAutoSave({
    listingId,
    section: 'requirements'
  });

  const handleSave = async () => {
    await saveData(editData);
    onUpdate(editData);
    setIsEditing(false);
  };

  if (isEmpty(data)) {
    return <EmptyState onAddClick={() => setIsEditing(true)} />;
  }

  return (
    <SectionWrapper>
      {isEditing ? (
        <RequirementsEditor 
          data={editData}
          onChange={setEditData}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <RequirementsDisplay 
          data={data}
          onEdit={() => setIsEditing(true)}
        />
      )}
      <AutoSaveIndicator status={saveStatus} />
    </SectionWrapper>
  );
}
```

### 7. Preview System Architecture

#### 7.1 Preview Implementation Strategy

**Decision**: Create preview using existing listing display components in read-only mode rather than building separate public listing page.

```typescript
// Preview modal component
function ListingPreview({ listingId }: { listingId: string }) {
  const { data: listingData } = useQuery(['listing-preview', listingId], 
    () => fetchListingPreview(listingId)
  );

  return (
    <Modal size="full" title="Listing Preview">
      <div className="preview-container">
        {/* Reuse existing listing display components */}
        <ListingHeader data={listingData} readonly />
        <ListingRequirements data={listingData.requirements} readonly />
        <ListingContacts data={listingData.contacts} readonly />
        <ListingFAQs data={listingData.faqs} readonly />
        <ListingDocuments data={listingData.documents} readonly />
      </div>
      
      <PreviewActions>
        <Button onClick={onClose}>Close Preview</Button>
        <Button onClick={onSubmit}>Submit for Review</Button>
      </PreviewActions>
    </Modal>
  );
}
```

### 8. Performance Considerations

#### 8.1 Auto-Save Optimization

```typescript
// Intelligent batching for auto-save operations
class AutoSaveBatcher {
  private pendingUpdates = new Map<string, any>();
  private batchTimeout: NodeJS.Timeout | null = null;

  queueUpdate(section: string, data: any) {
    this.pendingUpdates.set(section, data);
    
    if (this.batchTimeout) clearTimeout(this.batchTimeout);
    
    this.batchTimeout = setTimeout(() => {
      this.flushUpdates();
    }, 2000);
  }

  private async flushUpdates() {
    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();
    
    // Batch multiple section updates into single API call
    await api.post(`/listings/${listingId}/batch-update`, {
      sections: Object.fromEntries(updates)
    });
  }
}
```

#### 8.2 Database Performance

```sql
-- Optimize for common queries
CREATE INDEX CONCURRENTLY idx_listings_user_status ON listings(created_by, status);
CREATE INDEX CONCURRENTLY idx_listing_versions_current ON listing_versions(listing_id) 
    WHERE status IN ('draft', 'pending');

-- Materialized view for dashboard performance
CREATE MATERIALIZED VIEW listing_summaries AS
SELECT 
    l.id,
    l.company_name,
    l.status,
    l.completion_percentage,
    l.created_at,
    l.last_edited_at,
    lv.version_number as current_version,
    COUNT(c.id) as contact_count,
    COUNT(f.id) as faq_count
FROM listings l
LEFT JOIN listing_versions lv ON l.current_version_id = lv.id
LEFT JOIN listing_contacts c ON l.id = c.listing_id
LEFT JOIN faqs f ON l.id = f.listing_id
GROUP BY l.id, l.company_name, l.status, l.completion_percentage, 
         l.created_at, l.last_edited_at, lv.version_number;

CREATE UNIQUE INDEX idx_listing_summaries_id ON listing_summaries(id);
```

### 9. Security & Authorization

#### 9.1 Row Level Security Updates

```sql
-- Extend RLS for version management
CREATE POLICY "Users can view own listing versions" ON listing_versions
    FOR SELECT USING (
        listing_id IN (
            SELECT id FROM listings WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create versions for own listings" ON listing_versions
    FOR INSERT WITH CHECK (
        listing_id IN (
            SELECT id FROM listings WHERE created_by = auth.uid()
        )
    );

-- Admin policies for approval workflow
CREATE POLICY "Admins can view all pending versions" ON listing_versions
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'admin' AND status = 'pending'
    );
```

### 10. Error Handling & Resilience

#### 10.1 Auto-Save Error Recovery

```typescript
class AutoSaveErrorHandler {
  private retryQueue = new Map<string, RetryConfig>();
  
  async handleSaveError(section: string, data: any, error: Error) {
    // Exponential backoff retry
    const retryConfig = this.retryQueue.get(section) || { attempts: 0, delay: 1000 };
    
    if (retryConfig.attempts < 3) {
      retryConfig.attempts++;
      retryConfig.delay *= 2;
      this.retryQueue.set(section, retryConfig);
      
      setTimeout(() => {
        this.retrySave(section, data);
      }, retryConfig.delay);
    } else {
      // Store in localStorage for manual recovery
      this.storeForManualRecovery(section, data);
      this.showErrorNotification(section);
    }
  }
  
  private storeForManualRecovery(section: string, data: any) {
    const recoveryKey = `listing-recovery-${section}-${Date.now()}`;
    localStorage.setItem(recoveryKey, JSON.stringify(data));
  }
}
```

---

## Implementation Timeline

### Phase 1: Foundation (Epic 1 - 3 stories)
- Database schema migration
- Basic listing detail page
- Immediate creation flow
- **Duration**: 1 week

### Phase 2: Progressive Enhancement (Epic 2 - 4 stories)  
- Section-based editing components
- Auto-save infrastructure
- Empty states and basic editing
- **Duration**: 2 weeks

### Phase 3: Real-Time Features (Epic 3 - 3 stories)
- Auto-save with conflict resolution
- Real-time status updates
- Multi-tab handling
- **Duration**: 1.5 weeks

### Phase 4: Advanced Features (Epic 4 - 5 stories)
- Document management
- Version management UI
- Preview functionality
- Mobile optimization
- **Duration**: 2 weeks

**Total Estimated Duration**: 6.5 weeks

---

## Risk Assessment & Mitigation

### High-Risk Areas

1. **Database Migration Complexity**
   - **Risk**: Existing data corruption during version system migration
   - **Mitigation**: Comprehensive backup strategy, gradual rollout, rollback procedures

2. **Auto-Save Performance Impact**
   - **Risk**: Too frequent database writes affecting performance
   - **Mitigation**: Intelligent batching, debouncing, connection pooling

3. **Conflict Resolution Complexity**
   - **Risk**: Users losing work due to conflicts
   - **Mitigation**: Conservative conflict detection, user-friendly resolution UI

### Medium-Risk Areas

4. **Preview System Dependencies**
   - **Risk**: Preview may require public listing page architecture
   - **Mitigation**: Use existing display components in read-only mode

5. **Real-Time Sync Reliability**
   - **Risk**: Supabase subscription failures causing data loss
   - **Mitigation**: Heartbeat monitoring, automatic reconnection, localStorage backup

---

## Success Metrics

### Technical Metrics
- Auto-save latency < 500ms
- Database query performance maintained
- Zero data loss during conflicts
- 99.9% uptime for real-time features

### User Experience Metrics
- Time to first listing creation < 30 seconds
- User completion rate increase > 25%
- Support tickets related to data loss < 1 per week

---

## Conclusion

This architecture provides a robust foundation for the listing flow redesign while maintaining backward compatibility and system integrity. The evolutionary approach minimizes risk while delivering significant user experience improvements.

The key innovations include:
- **Sophisticated version management** for live/draft separation
- **Real-time auto-save** with conflict resolution
- **Progressive enhancement** through section-based editing
- **Performance optimization** through intelligent batching

The implementation plan addresses all PRD requirements while providing a clear path for future enhancements.