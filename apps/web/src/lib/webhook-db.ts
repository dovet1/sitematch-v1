import { Client } from 'pg'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'trial_expired'
  | 'trial_canceled'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | null

/**
 * Start trial for user after payment method collection (webhook version)
 */
export async function startUserTrialWebhook(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<boolean> {
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  return updateUserSubscriptionWebhook(userId, 'trialing', {
    trial_start_date: now.toISOString(),
    trial_end_date: trialEnd.toISOString(),
    stripe_subscription_id: stripeSubscriptionId,
    payment_method_added: true,
    trial_will_convert: true
  })
}

/**
 * Update user subscription status using dedicated webhook database user
 * Only use this in API routes, not in middleware (Edge Runtime incompatible)
 */
export async function updateUserSubscriptionWebhook(
  userId: string,
  status: SubscriptionStatus,
  updates: Partial<{
    trial_start_date: string
    trial_end_date: string
    subscription_start_date: string
    next_billing_date: string
    stripe_customer_id: string
    stripe_subscription_id: string
    payment_method_added: boolean
    trial_will_convert: boolean
  }> = {}
): Promise<boolean> {
  const updateData = {
    subscription_status: status,
    ...updates
  }

  console.log(`[Webhook] Updating user ${userId} with data:`, updateData)

  // Extract database connection info from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const dbHost = supabaseUrl.replace('https://', '').replace('.supabase.co', '.supabase.co').replace('nunvbolbcekvtlwuacul', 'db.nunvbolbcekvtlwuacul')

  // Create direct PostgreSQL connection using webhook user
  const client = new Client({
    host: process.env.WEBHOOK_DB_HOST || dbHost,
    port: 5432,
    database: 'postgres',
    user: 'webhook_user',
    password: process.env.WEBHOOK_DB_PASSWORD!,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    // Build dynamic update query
    const columns = Object.keys(updateData)
    const values = Object.values(updateData)
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ')

    const query = `
      UPDATE users
      SET ${setClause}
      WHERE id = $1
      RETURNING subscription_status, trial_start_date, trial_end_date
    `

    const result = await client.query(query, [userId, ...values])

    if (result.rowCount === 0) {
      console.error('[Webhook] No rows updated - user may not exist:', userId)
      return false
    }

    console.log('[Webhook] Update successful:', result.rows[0])
    return true

  } catch (err) {
    console.error('[Webhook] Database update failed:', err)
    return false
  } finally {
    await client.end()
  }
}