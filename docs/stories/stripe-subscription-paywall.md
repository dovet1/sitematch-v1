# 📝 User Story: Stripe Subscription Paywall

## Story Overview
**As a** SiteMatcher platform user
**I want** access to premium features through an annual subscription with a 1-month free trial
**So that** I can view requirement listings, use SiteSketcher, and create agency listings

---

## 🎯 Business Context

### Value Proposition
- **Revenue Model**: £975/year recurring subscription
- **Free Trial**: 1 month automatic trial for all new signups
- **Access Control**: Paid features are gated, free features remain accessible

### Success Metrics
- Conversion rate from free trial to paid subscription
- Subscription renewal rate
- Time to first subscription purchase
- Paywall encounter → purchase conversion

---

## 📋 Functional Requirements

### 1. **Subscription Tiers**

| Tier | Price | Billing | Trial | Features |
|------|-------|---------|-------|----------|
| **Free Trial** | £0 | - | 30 days | All premium features during trial |
| **Annual** | £975 | Yearly | First month free for new users | Full access to all premium features |

### 2. **Feature Access Matrix**

| Feature | Not Logged In | Free User (Trial Ended) | Paid User | Notes |
|---------|---------------|------------------------|-----------|-------|
| View own requirement listings | ❌ | ✅ | ✅ | Via dashboard only |
| Create/edit own requirement listings | ❌ | ✅ | ✅ | All users can manage their own |
| View all requirement listings (/search) | ❌ | ❌ | ✅ | Paywall blocks access |
| View individual requirement listings | ❌ | ❌ | ✅ | Paywall blocks access |
| View agency listings | ✅ | ✅ | ✅ | Public - no authentication needed |
| Create agency listing | ❌ | ❌ | ✅ | Paywall blocks access |
| Access SiteSketcher | ❌ | ❌ | ✅ | Paywall blocks access |

### 3. **Paywall Trigger Points**

The paywall should intercept access at:

1. **`/search` page** - Requirement listings search/browse
2. **`/listings/[id]` pages** - Individual requirement listing detail pages
3. **`/sitesketcher` page** - SiteSketcher tool access
4. **Agency creation flow** - When attempting to create an agency listing

**Exception**: Users can always access their own requirement listings through `/occupier/dashboard`

### 4. **Free Trial Logic (Payment Upfront Approach)**

```
ON USER SIGNUP:
  - Create user record with basic info
  - Redirect to Stripe Checkout for payment method collection
  - Clear messaging: "£0 today, then £975/year starting [Date]"

ON PAYMENT METHOD ADDED (Stripe Checkout Success):
  - Create Stripe customer and subscription with 30-day trial
  - Set trial_start_date = NOW()
  - Set trial_end_date = NOW() + 30 days
  - Set subscription_status = 'trialing'
  - Set payment_method_added = TRUE
  - Set trial_will_convert = TRUE
  - Allow full access to premium features

ON TRIAL EXPIRY (trial_end_date reached):
  - Stripe automatically charges £975 (payment method on file)
  - Webhook updates subscription_status = 'active'
  - Continue access seamlessly (no interruption)

ON TRIAL CANCELLATION (before expiry):
  - Cancel Stripe subscription
  - Set subscription_status = 'trial_canceled'
  - Allow access until trial_end_date, then block
  - No charge occurs

ON PAYMENT FAILURE AT TRIAL END:
  - Set subscription_status = 'past_due'
  - Block access to premium features
  - Send payment retry notifications
```

### 5. **User Experience Flow (Payment Upfront)**

#### **User Journey Differentiation by Entry Point**

**Journey A: Requirement Poster (Free Feature User)**
1. User clicks "Post Requirement" → Sign up flow
2. Account created → Redirect to dashboard (no payment required)
3. User can post requirements freely
4. When user clicks "Search Properties" → Paywall modal: "Find properties for your requirements - Start free trial"
5. Stripe Checkout with messaging: "Access property search to find matches for your requirements"

**Journey B: Property Searcher (Primary Paid User)**
1. User clicks "Search Properties" → Sign up flow
2. Account created → Redirect to Stripe Checkout immediately
3. Payment page shows: "£0 today, then £975/year starting [Date]" + "Start searching thousands of properties"
4. User adds payment method → Trial starts → Redirect to `/search`
5. 30 days pass → Automatic charge, seamless transition to paid

**Journey C: Agency User (B2B Flow)**
1. User clicks "Create Agency Listing" → Sign up flow
2. Account created → Redirect to Stripe Checkout
3. Payment page shows B2B messaging: "Showcase your properties to qualified occupiers - £0 today"
4. User adds payment method → Trial starts → Redirect to agency creation flow
5. Professional onboarding with agency-specific features highlighted

**Journey D: SiteSketcher User (Tool-Focused)**
1. User clicks "Try SiteSketcher" → Sign up flow
2. Account created → Redirect to Stripe Checkout
3. Payment page shows: "Visualize your property projects - Free trial, then £975/year"
4. User adds payment method → Trial starts → Redirect to SiteSketcher tutorial

#### **Scenario A: New User Signup with Payment (Primary Flow)**
1. User signs up (email, password, user type)
2. Account created → Redirect to context-appropriate Stripe Checkout
3. Payment page shows personalized messaging based on entry point
4. User adds payment method → Trial starts immediately
5. User redirected to relevant feature → ✅ Access granted (trial active with payment on file)
6. 30 days pass → Automatic charge, seamless transition to paid
7. User continues using platform without interruption

#### **Scenario B: Trial Cancellation**
1. User in active trial decides to cancel
2. Goes to Account Settings → "Manage Subscription" → Stripe Customer Portal
3. Clicks "Cancel subscription"
4. Confirmation: "You'll keep access until [trial_end_date], then access will stop"
5. User continues using until trial expires, then blocked from premium features
6. No charge occurs

#### **Scenario C: Existing User (Trial Expired/Canceled)**
1. User logs in (trial expired, no active subscription)
2. User clicks "Search Listings" → 🚫 Paywall modal appears immediately
3. Options presented:
   - **Subscribe Now** (£975/year) → New Stripe Checkout
   - **View Pricing Page** (more details)
   - **Continue to Free Features** (dashboard, own listings)

#### **Scenario D: Payment Failure at Trial End**
1. Trial expires, Stripe attempts to charge payment method
2. Payment fails (expired card, insufficient funds, etc.)
3. User's access blocked immediately
4. Email sent: "Payment failed - Update your payment method"
5. User updates payment → Access restored
6. If not updated within 3 days → Subscription canceled

### 6. **Pricing Page Requirements**

**URL**: `/pricing`

**Content Structure**:
```
Hero Section:
  - Headline: "Find Your Perfect Property Site"
  - Subheadline: "30-day free trial, then £975/year"
  - CTA: "Start Free Trial" (clear messaging: no charge today)

Pricing Card:
  - £975/year (Annual) - prominent pricing
  - "30-day free trial - no charge today" - highlighted
  - "Add payment method, cancel anytime" - trust messaging
  - Features list:
    ✅ Unlimited requirement listing views
    ✅ Full search and filtering
    ✅ SiteSketcher access
    ✅ Create agency listings
    ✅ Direct contact with listing owners
    ✅ Cancel anytime before trial ends
  - Primary CTA: "Start Free Trial"
  - Secondary text: "You'll add payment details but won't be charged until [Date]"

Social Proof:
  - Testimonials
  - Trust indicators
  - Usage statistics

FAQ Section:
  **Payment & Trial Questions:**
  - Q: "Will I be charged during my free trial?"
    A: "No. Your 30-day free trial starts immediately with no charge. Your payment method will only be charged £975 after your trial ends on [Date], unless you cancel before then."

  - Q: "Why do you need my payment details for a free trial?"
    A: "This ensures a seamless experience. If you love the platform (and we think you will!), you won't experience any interruption when your trial ends. You're always in control and can cancel anytime."

  - Q: "Can I cancel during my trial?"
    A: "Yes, you can cancel anytime before your trial ends with no charge. Just visit your account settings or contact us."

  - Q: "What happens if I cancel during my trial?"
    A: "You'll keep full access until your trial ends, then your access will stop. No charge will be made."

  - Q: "What happens when my trial ends?"
    A: "If you don't cancel, you'll be charged £975 for your annual subscription and continue with uninterrupted access to all features."

  **Billing & Refunds:**
  - Standard billing questions
  - Refund policy details
  - Payment method updates

Footer CTA:
  - Secondary conversion prompt
```

**Mobile Responsive**: Full mobile optimization required

---

## 🔧 Technical Specifications

### 1. **Database Schema Updates**

**New fields for `users` table**:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  subscription_status VARCHAR(50), -- 'trialing', 'active', 'trial_expired', 'trial_canceled', 'past_due', 'canceled'
  subscription_start_date TIMESTAMP,
  next_billing_date TIMESTAMP,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
  payment_method_added BOOLEAN DEFAULT FALSE,
  trial_will_convert BOOLEAN DEFAULT FALSE, -- True if payment method collected during trial
  trial_end_behavior VARCHAR(50) DEFAULT 'auto_subscribe'; -- 'auto_subscribe', 'require_payment', 'expired'
```

### 2. **Stripe Integration Components**

#### **A. Stripe Setup**
- Create Stripe product: "SiteMatcher Annual Subscription"
- Create price: £975/year (recurring annually)
- Configure 30-day free trial
- Set up webhooks endpoint: `/api/webhooks/stripe`

#### **B. Required API Routes**

1. **`/api/stripe/create-checkout-session`**
   - Creates Stripe Checkout session with 30-day trial
   - Requires payment method collection (no immediate charge)
   - Includes clear trial messaging in session
   - Returns session URL for redirect
   - Handles both signup and existing user upgrade flows

   ```typescript
   const session = await stripe.checkout.sessions.create({
     mode: 'subscription',
     line_items: [{ price: priceId, quantity: 1 }],
     subscription_data: {
       trial_period_days: 30,
       trial_settings: {
         end_behavior: { missing_payment_method: 'cancel' }
       }
     },
     success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${baseUrl}/pricing`,
     metadata: { userId }
   });
   ```

2. **`/api/stripe/create-portal-session`**
   - Creates customer portal session
   - For subscription management
   - Returns portal URL

3. **`/api/stripe/subscription-status`**
   - Checks current user's subscription status
   - Returns trial/active/expired state
   - Used by middleware for access control

4. **`/api/webhooks/stripe`**
   - Handles Stripe webhook events:
     - `checkout.session.completed` → Start trial with payment method
     - `customer.subscription.created` → Confirm trial setup
     - `customer.subscription.updated` → Handle status changes
     - `customer.subscription.deleted` → Handle cancellation
     - `invoice.payment_succeeded` → Trial converted to paid
     - `invoice.payment_failed` → Handle failed trial conversion
     - `customer.subscription.trial_will_end` → Send reminder emails

5. **`/api/stripe/cancel-trial`**
   - Cancels subscription during trial period
   - Maintains access until trial end date
   - Updates user status to 'trial_canceled'
   - Sends cancellation confirmation email

#### **C. Middleware for Access Control with Caching**

Create `/middleware/subscription.ts`:
```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 300; // 5 minutes

export async function checkSubscriptionAccess(userId: string): Promise<boolean> {
  // Check cache first
  const cacheKey = `subscription:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const { status, expiresAt } = JSON.parse(cached);
    if (status === 'active' || (status === 'trialing' && new Date() < new Date(expiresAt))) {
      return true;
    }
    if (status === 'trialing' && new Date() >= new Date(expiresAt)) {
      // Cache hit but trial expired - refresh from DB
      await redis.del(cacheKey);
    } else if (status === 'expired' || status === 'canceled') {
      return false; // Cache hit for expired status
    }
  }

  // Cache miss or expired trial - fetch from database
  const user = await getUserSubscriptionStatus(userId);
  let hasAccess = false;
  let cacheData = { status: user.subscription_status };

  // Check if trial is active
  if (user.subscription_status === 'trialing') {
    if (new Date() < new Date(user.trial_end_date)) {
      hasAccess = true;
      cacheData.expiresAt = user.trial_end_date;
    } else {
      // Trial expired - update status
      await updateUserStatus(userId, 'trial_expired');
      cacheData.status = 'expired';
    }
  } else {
    // Check if subscription is active
    hasAccess = user.subscription_status === 'active';
  }

  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));

  return hasAccess;
}

// Helper function to invalidate cache when subscription status changes
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  await redis.del(`subscription:${userId}`);
}
```

Apply to protected routes:
- `/search` page
- `/listings/[id]` pages (except own listings)
- `/sitesketcher` page
- Agency creation flow

### 3. **UI Components**

#### **A. Paywall Modal Component**
```tsx
<PaywallModal>
  - Title: "Unlock Full Access"
  - Message: "Subscribe to view requirement listings and access premium features"
  - Pricing highlight: "£975/year - 30 days free"
  - Primary CTA: "Start Free Trial" → Stripe Checkout
  - Secondary CTA: "View Pricing" → /pricing page
  - Tertiary: "Continue to Free Features" → /dashboard
</PaywallModal>
```

**Trigger Logic**:
- Show immediately when unauthorized user accesses protected page
- Don't show for authenticated users with active subscription/trial
- Graceful handling of loading states

#### **B. Subscription Status Indicator**
Add to user menu/dashboard:
```
Trial: "X days remaining in trial"
Active: "Subscription active - Renews [date]"
Expired: "Trial expired - Subscribe to continue"
```

#### **C. Pricing Page Component**
- Server-side rendered for SEO
- Fetch live pricing from Stripe (or config)
- Dynamic trial countdown for urgency
- Conversion-optimized design

### 4. **Stripe Customer Portal**

**Location**: Add link in user settings/account page
- Label: "Manage Subscription"
- Action: Creates portal session → Redirects to Stripe portal
- Features available in portal:
  - Update payment method
  - View invoices
  - Cancel subscription
  - Download receipts

**Note**: Admin refunds/manual adjustments handled directly in Stripe Dashboard

### 5. **Email Templates (Payment Upfront Flow)**

#### **A. Trial Started Email**
```
Subject: "Your SiteMatcher free trial is active!"

Content:
- Welcome message
- Trial details: "Your 30-day free trial ends on [Date]"
- Billing info: "You'll be charged £975 on [Date] unless you cancel"
- Features available during trial
- Cancellation instructions: "Cancel anytime in Account Settings"
- Contact support information
```

#### **B. Trial Ending Soon Email (7 days)**
```
Subject: "Your SiteMatcher subscription starts in 7 days"

Content:
- Reminder: "Your free trial ends on [Date]"
- "You'll be charged £975 on [Date] for continued access"
- Highlight value: "You've viewed X listings, accessed SiteSketcher Y times"
- Option to cancel: "Don't want to continue? Cancel anytime before [Date]"
- CTA: "Continue Subscription" or "Cancel Trial"
```

#### **C. Trial Cancellation Confirmation**
```
Subject: "Your SiteMatcher trial has been cancelled"

Content:
- Confirmation: "Your subscription has been cancelled"
- Access details: "You'll keep access until [trial_end_date]"
- No charge confirmation: "You won't be charged anything"
- Reactivation option: "Changed your mind? Reactivate anytime"
- Feedback request: "Tell us why you cancelled"
```

#### **D. Subscription Activated Email**
```
Subject: "Welcome to SiteMatcher - Your subscription is active!"

Content:
- Welcome to paid subscription
- Payment confirmation: "We've charged £975 to your payment method"
- Next billing date: "Your subscription renews on [Date]"
- Features reminder
- Account management: "Manage your subscription anytime"
- Receipt attached
```

---

## ✅ Acceptance Criteria

### **Must Have**

1. **Trial Enrollment with Payment Collection**
   - [ ] New users automatically redirected to Stripe Checkout after account creation
   - [ ] Stripe Checkout clearly shows "£0 today, then £975/year starting [Date]"
   - [ ] Payment method is collected and verified but not charged during trial
   - [ ] Trial starts immediately after successful payment method collection
   - [ ] Trial status and payment method status correctly stored in database
   - [ ] Trial expiry date calculated accurately (30 days from trial start)
   - [ ] Users can cancel during trial with access until trial end

2. **Access Control**
   - [ ] Paid/trial users can access /search page
   - [ ] Expired trial users blocked from /search
   - [ ] Paid/trial users can view all requirement listings
   - [ ] Expired trial users see paywall when accessing listings
   - [ ] Paid/trial users can access SiteSketcher
   - [ ] Paid/trial users can create agency listings
   - [ ] All users can view agency listings (no auth required)
   - [ ] All users can create/edit their own requirement listings

3. **Paywall Modal**
   - [ ] Appears immediately when unauthorized user accesses protected page
   - [ ] Shows clear pricing and trial information
   - [ ] Provides one-click path to Stripe Checkout
   - [ ] Includes link to full pricing page
   - [ ] Includes option to return to free features

4. **Stripe Integration**
   - [ ] Checkout session creates successfully with 30-day trial and payment collection
   - [ ] Subscription created in Stripe with trial period, no immediate charge
   - [ ] Automatic charge of £975 occurs when trial ends (day 31)
   - [ ] Webhooks update user status correctly for all subscription events
   - [ ] Customer portal allows trial cancellation with clear messaging
   - [ ] Failed payments at trial end trigger appropriate status updates and notifications
   - [ ] Trial cancellation works correctly (access until trial end, then blocked)

5. **Pricing Page**
   - [ ] Displays annual pricing (£975/year)
   - [ ] Highlights 30-day free trial
   - [ ] Lists all included features
   - [ ] Mobile responsive
   - [ ] CTA buttons link to Stripe Checkout with trial

6. **User Experience**
   - [ ] After subscribing, user immediately gains access to protected pages
   - [ ] Trial expiry is communicated clearly before it happens
   - [ ] Subscription status visible in user dashboard/menu
   - [ ] Error states handled gracefully (payment failures, network issues)

### **Should Have**

7. **Email Notifications**
   - [ ] **Trial start email**: Sent after payment method added, includes trial end date and billing details
   - [ ] **Trial reminder emails**: 7 days before trial ends ("Your subscription starts in 7 days")
   - [ ] **Trial reminder emails**: 1 day before trial ends ("Your subscription starts tomorrow")
   - [ ] **Subscription activated email**: Sent when trial ends and payment succeeds
   - [ ] **Payment receipt emails**: Sent for all successful charges
   - [ ] **Trial cancellation email**: Sent when user cancels during trial
   - [ ] **Payment failure email**: Sent when trial-to-paid conversion fails
   - [ ] **Annual renewal reminder emails**: 30/7/1 days before yearly renewal

8. **Analytics & Tracking**
   - [ ] Track paywall encounters (which pages)
   - [ ] Track conversion rate (paywall → purchase)
   - [ ] Track trial → paid conversion rate
   - [ ] Track subscription churn/cancellations

### **Could Have**

9. **Enhanced UX**
   - [ ] Preview mode - show blurred listings to non-subscribers
   - [ ] Countdown timer showing trial days remaining
   - [ ] Personalized messaging based on user type
   - [ ] "Upgrade" prompts in dashboard for trial users

---

## 🔗 Dependencies & Sequencing

### **Prerequisites**
1. Stripe account setup and API keys configured
2. Payment method collection requirements determined (UK compliance)
3. Terms of Service and Refund Policy pages created
4. Email templates for subscription-related notifications

### **Suggested Implementation Order**

**Phase 1: Foundation (Week 1)**
1. Database schema updates (including payment tracking fields)
2. Stripe product/price setup with 30-day trial configuration
3. **Checkout session API with trial period and payment collection**
4. Webhook endpoint for subscription lifecycle events
5. Subscription status checking middleware

**Phase 2: Payment-First Signup Flow (Week 2)**
6. **Integrate Stripe Checkout into signup flow**
7. **Trial start logic after payment method collection**
8. **Cancellation API and Customer Portal integration**
9. Access control implementation on protected routes
10. Paywall modal component for expired/non-subscribers

**Phase 3: Email Automation & UX (Week 3)**
11. **Email templates for payment upfront flow (trial start, reminders, cancellation)**
12. **Automated email sending based on trial timeline**
13. Pricing page design with payment upfront messaging
14. Subscription status indicators in UI
15. **Trial countdown and billing date displays**

**Phase 4: Edge Cases & Testing (Week 4)**
16. **Payment failure handling at trial end**
17. **Trial cancellation and access management**
18. Error handling and edge cases
19. **End-to-end testing: signup → trial → conversion/cancellation**
20. Analytics tracking implementation

---

## 🚨 Edge Cases & Error Handling

### **Payment Failures**
- **Failed initial payment**: Show user-friendly error, allow retry
- **Failed renewal payment**: Grace period of 3 days, then suspend access
- **Webhook failure**: Implement retry logic, manual reconciliation tool for admins

### **Trial Manipulation Prevention**
- **Multiple signups same email**: Check email uniqueness, prevent duplicate trials
- **Payment method reuse**: Track payment methods to prevent multiple trials with same card
- **Trial extension requests**: Define policy (manual admin approval vs automatic denial)
- **Fake payment methods**: Stripe handles validation, but monitor for patterns

### **Subscription Lifecycle**
- **Mid-year cancellation**: Refund policy (pro-rata vs no refunds)
- **Reactivation**: Allow previous customers to resubscribe (new trial? or not?)
- **Grandfathered pricing**: If price increases, honor old rate for existing customers

### **Access Edge Cases**
- **User viewing own listing via public link**: Should work (matches dashboard access)
- **User clicks listing in search before paywall loads**: Race condition - ensure middleware catches
- **User shares agency listing link**: Public access maintained (no auth)

---

## 🔄 Rollback Strategy

### **Immediate Rollback (< 24 hours)**
- [ ] **Feature flags**: Implement subscription checks behind feature flags for instant disable
- [ ] **Database rollback**: Keep original user table schema intact, new columns nullable
- [ ] **Route rollback**: Maintain original access control, add subscription layer on top

---

## 📊 Technical Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stripe webhook delays causing access issues | High | Medium | Implement local status checking, cache user permissions |
| Trial end date miscalculation (timezone issues) | High | Low | Use UTC consistently, add buffer to trial checks |
| Payment failures at scale | Medium | Medium | Monitor via Stripe Dashboard, automated retry logic |
| Webhook signature verification failures | High | Low | Proper secret management, logging for debugging |
| Race conditions on checkout completion | Medium | Low | Idempotent webhook handlers, session tokens |
| Subscription status caching issues | Medium | Medium | 5-minute TTL, cache invalidation on status changes |
| High database load from subscription checks | Medium | Low | Redis caching layer, connection pooling |

---

## 🧪 Testing Strategy

### **Unit Tests**
- Subscription status checking logic
- Trial expiry calculation
- Access control middleware
- Webhook event processing

### **Integration Tests**
- Full checkout flow (with Stripe test mode)
- Webhook event handling
- Access control on protected routes
- Customer portal session creation

### **Manual Testing Checklist**
**Payment Upfront Flow:**
- [ ] Complete signup → redirected to Stripe Checkout
- [ ] Stripe Checkout shows correct pricing and trial messaging
- [ ] Add payment method successfully starts trial
- [ ] Trial status correctly shown in dashboard
- [ ] Access granted to all premium features during trial
- [ ] **Cancel during trial** → Access continues until trial end
- [ ] **Trial expiry with valid payment** → Automatic charge, seamless access
- [ ] **Trial expiry with failed payment** → Access blocked, retry emails sent
- [ ] Verify customer portal functionality (cancel, update payment)
- [ ] Test all paywall trigger points for non-subscribers
- [ ] **Email sequence**: Trial start → Reminders → Conversion/Cancellation

**Edge Cases:**
- [ ] User closes Stripe Checkout during payment → Can retry
- [ ] Payment method declined → Error handling and retry
- [ ] Network issues during webhook → Status reconciliation

### **User Acceptance Testing**
- [ ] Product owner reviews pricing page
- [ ] Test with real Stripe test cards
- [ ] Verify email notifications are appropriate
- [ ] Confirm UI matches brand guidelines
- [ ] Mobile device testing (iOS + Android)

---

## 📝 Definition of Done

- [ ] All acceptance criteria met and verified
- [ ] Code reviewed and approved
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Documentation updated (API docs, admin guides)
- [ ] Stripe webhooks configured in production
- [ ] Environment variables set in production
- [ ] Pricing page live and indexed for SEO
- [ ] Analytics tracking verified
- [ ] Rollback plan documented
- [ ] Product owner sign-off obtained

---

## 📚 Related Documentation

- Stripe Documentation: https://stripe.com/docs/billing/subscriptions
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Stripe Customer Portal: https://stripe.com/docs/billing/subscriptions/integrating-customer-portal
- Supabase Auth: (existing docs for user management)

---

## 🎬 Next Steps

Once this story is approved:

1. **Spike**: Stripe integration proof of concept (1-2 days)
2. **Design**: Pricing page mockups and paywall modal designs
3. **Break down**: Split into smaller technical tasks for sprint planning
4. **Estimate**: Team provides story point estimates
5. **Dependencies**: Confirm legal/compliance requirements for UK subscriptions

---

## 🛠️ Dev Agent Record

### Implementation Tasks
- [x] Database schema updates (including payment tracking fields)
- [ ] Stripe product/price setup with 30-day trial configuration
- [x] Checkout session API with trial period and payment collection
- [x] Webhook endpoint for subscription lifecycle events
- [x] Subscription status checking middleware with Redis caching
- [ ] Integrate Stripe Checkout into signup flow
- [x] Trial start logic after payment method collection
- [x] Cancellation API and Customer Portal integration
- [x] Access control implementation on protected routes
- [x] Paywall modal component for expired/non-subscribers
- [x] Pricing page design with payment upfront messaging
- [x] Subscription status indicators in UI
- [x] Subscription success page
- [ ] Email templates for payment upfront flow
- [ ] Automated email sending based on trial timeline
- [ ] Payment failure handling at trial end
- [ ] Trial cancellation and access management
- [ ] Error handling and edge cases
- [ ] End-to-end testing: signup → trial → conversion/cancellation
- [ ] Analytics tracking implementation

### Debug Log
| Task | File | Change | Reverted? |
|------|------|--------|-----------|

### Completion Notes
- Database migration completed by user in Supabase
- Core Stripe integration implemented with payment upfront approach
- Access control middleware protecting routes: /search, /listings/[id], /sitesketcher, /agencies/create
- Redis caching implemented for subscription status (5-minute TTL)
- Comprehensive webhook handling for subscription lifecycle
- User journey differentiation by entry point (searcher, agency, sitesketcher, requirement poster)
- TypeScript compilation issues resolved for new Stripe files

### Remaining Work (Next Phase)
- Email templates and automation system
- Integration into signup flow (need auth context)
- End-to-end testing with Stripe test mode
- Production environment variable configuration
- Stripe product/price setup in dashboard

### Change Log
None

### File List
Files created/modified during implementation:
- Database: users table schema updated (completed by user)
- `apps/web/src/lib/stripe.ts` - Stripe configuration and constants
- `apps/web/src/lib/subscription.ts` - Subscription utilities with Redis caching
- `apps/web/src/app/api/stripe/create-checkout-session/route.ts` - Stripe Checkout API
- `apps/web/src/app/api/stripe/create-portal-session/route.ts` - Customer Portal API
- `apps/web/src/app/api/stripe/subscription-status/route.ts` - Subscription status API
- `apps/web/src/app/api/webhooks/stripe/route.ts` - Stripe webhooks handler
- `apps/web/src/lib/middleware/subscription.ts` - Subscription middleware utilities
- `apps/web/src/middleware.ts` - Updated main middleware with subscription checks
- `apps/web/src/components/PaywallModal.tsx` - Paywall modal component
- `apps/web/src/components/SubscriptionStatus.tsx` - Subscription status indicator
- `apps/web/src/app/pricing/page.tsx` - Pricing page with conversion-optimized design
- `apps/web/src/app/subscription/success/page.tsx` - Trial started success page
- `apps/web/package.json` - Added Stripe dependencies

---

**Story Status**: 🚧 **IN DEVELOPMENT**

**Created**: 2025-09-24
**Last Updated**: 2025-09-24 (Updated for Payment Upfront Approach)
**Story ID**: STRIPE-001
**Epic**: Revenue & Monetization
**Priority**: High
**Estimated Effort**: 3-4 weeks

**Key Changes in v3.0:**
- ✅ **Payment collection during signup** (industry best practice)
- ✅ **Seamless trial-to-paid conversion** (no interruption)
- ✅ **Clear trial cancellation policy** (access until trial end)
- ✅ **Enhanced email automation** for payment upfront flow
- ✅ **User journey differentiation** by entry point and user type
- ✅ **Subscription status caching** for performance optimization
- ✅ **Rollback strategy** with feature flags for safe deployment