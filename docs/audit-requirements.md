# Audit Trail Requirements v1.0

## Overview

The moderation system must maintain comprehensive audit logs for compliance, security, and operational oversight.

## Required Logging

### Moderation Actions
**All moderation actions must be logged with:**
- Admin user ID (who performed action)
- Listing ID (what was moderated)
- Action type: `approved`, `rejected`, `archived`, `unarchived`
- Timestamp (when action occurred)
- Rejection reason (if applicable)
- Custom reason text (for "other" rejections)

### Database Schema
```sql
CREATE TABLE moderation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'archived', 'unarchived')),
  reason TEXT, -- Custom reason for "other" rejections
  rejection_reason TEXT, -- Standardized rejection category
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_moderation_log_listing_id (listing_id),
  INDEX idx_moderation_log_admin_id (admin_id),
  INDEX idx_moderation_log_created_at (created_at)
);
```

### Additional Audit Points

**Bulk Operations:**
- Log each individual action within bulk operations
- Include bulk operation ID for grouping
- Track batch size and completion status

**Status Changes:**
- Log listing status transitions
- Include previous status for context
- Track status change triggers (admin action vs system)

**Admin Access:**
- Log admin login/logout events
- Track admin role assignments/changes
- Monitor admin dashboard access patterns

## Retention Policy

- **Active Logs**: Keep indefinitely for operational use
- **Archived Logs**: Retain for 7 years for compliance
- **Performance**: Partition by month for query optimization
- **Backup**: Daily backups with 30-day retention

## Access Control

- **Admin View**: Admins can view logs for their own actions
- **Super Admin**: Can view all moderation logs
- **Audit Team**: Read-only access to complete audit trail
- **API Access**: Authenticated admin endpoints only

## Monitoring & Alerting

**Alert Triggers:**
- Unusual admin activity patterns
- Failed moderation attempts
- Bulk operation anomalies
- Performance degradation in logging

**Metrics to Track:**
- Average moderation time per listing
- Rejection rate by reason category
- Admin productivity metrics
- Audit log query performance

## Compliance Requirements

**Data Privacy:**
- Personal data in logs follows GDPR guidelines
- Audit logs excluded from user data deletion requests
- Admin access to logs properly authorized

**Security:**
- Audit logs immutable after creation
- Tamper detection mechanisms
- Secure backup and recovery procedures

## API Endpoints

```typescript
// Admin audit trail endpoints
GET /api/admin/audit/moderation          // Moderation action logs
GET /api/admin/audit/listing/[id]        // Listing-specific audit trail
GET /api/admin/audit/admin/[id]          // Admin-specific actions
GET /api/admin/audit/bulk/[batch_id]     // Bulk operation details
```

## Implementation Notes

- Use database triggers for automatic logging
- Implement log rotation for performance
- Add audit log verification checksums
- Include request ID for correlation with application logs
- Store user agent and IP for admin actions

---

*Requirements effective: Current date*  
*Review cycle: Quarterly*  
*Compliance: Internal audit standards*