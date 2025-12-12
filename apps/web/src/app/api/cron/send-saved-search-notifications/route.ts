import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { generateSavedSearchNotificationEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job: Send saved search email notifications
 *
 * Runs daily at 9am UTC via Vercel Cron
 *
 * Process:
 * 1. Fetches pending notifications from queue
 * 2. Groups by user_id (one email per user)
 * 3. Fetches listing details for each notification
 * 4. Sends email with all new matches
 * 5. Marks notifications as sent
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ CRON: Unauthorized request - invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ CRON: Starting saved search email notifications');
    const startTime = Date.now();

    const supabase = createServerClient();

    // Fetch pending notifications
    const { data: notifications, error: notificationsError } = await supabase
      .from('saved_search_notification_queue')
      .select(`
        id,
        user_id,
        search_id,
        listing_id,
        created_at,
        saved_searches!inner(name),
        listings!inner(company_name, listing_type, created_at)
      `)
      .is('sent_at', null)
      .order('user_id');

    if (notificationsError) {
      console.error('❌ CRON: Error fetching notifications:', notificationsError);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    if (!notifications || notifications.length === 0) {
      console.log('ℹ️  CRON: No pending notifications');
      return NextResponse.json({
        success: true,
        message: 'No pending notifications',
        sent: 0
      });
    }

    console.log(`📧 CRON: Found ${notifications.length} pending notifications`);

    // Group notifications by user
    const notificationsByUser = new Map<string, any[]>();
    for (const notification of notifications) {
      if (!notificationsByUser.has(notification.user_id)) {
        notificationsByUser.set(notification.user_id, []);
      }
      notificationsByUser.get(notification.user_id)!.push(notification);
    }

    console.log(`👤 CRON: Grouped into ${notificationsByUser.size} users`);

    let emailsSent = 0;
    let emailsFailed = 0;
    const notificationIdsSent: string[] = [];

    // Process each user
    for (const [userId, userNotifications] of Array.from(notificationsByUser.entries())) {
      try {
        // Fetch user email
        const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);

        if (userError || !user || !user.email) {
          console.error(`⚠️  CRON: Could not fetch user ${userId}:`, userError);
          emailsFailed++;
          continue;
        }

        // Group notifications by search
        const notificationsBySearch = new Map<string, any[]>();
        for (const notification of userNotifications) {
          const searchId = notification.search_id;
          if (!notificationsBySearch.has(searchId)) {
            notificationsBySearch.set(searchId, []);
          }
          notificationsBySearch.get(searchId)!.push(notification);
        }

        // Build email content
        const searches = Array.from(notificationsBySearch.entries()).map(([searchId, notifications]) => ({
          name: notifications[0].saved_searches.name,
          matches: notifications.map(n => ({
            company_name: n.listings.company_name,
            listing_type: n.listings.listing_type,
            listing_id: n.listing_id,
            created_at: n.listings.created_at
          }))
        }));

        const totalMatches = userNotifications.length;

        // Generate email
        const { html, text } = generateSavedSearchNotificationEmail({
          searches,
          totalMatches,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://sitematcher.com'
        });

        // Send email
        const emailResult = await sendEmail({
          to: [user.email],
          subject: `${totalMatches} new requirement${totalMatches === 1 ? '' : 's'} match your saved searches`,
          html,
          text
        });

        if (emailResult.success) {
          console.log(`✅ CRON: Sent email to ${user.email} (${totalMatches} matches)`);
          emailsSent++;
          // Collect notification IDs to mark as sent
          notificationIdsSent.push(...userNotifications.map(n => n.id));
        } else {
          console.error(`❌ CRON: Failed to send email to ${user.email}:`, emailResult.error);
          emailsFailed++;
        }

        // Rate limiting: small delay between emails
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ CRON: Error processing user ${userId}:`, error);
        emailsFailed++;
      }
    }

    // Mark notifications as sent
    if (notificationIdsSent.length > 0) {
      const { error: updateError } = await supabase
        .from('saved_search_notification_queue')
        .update({ sent_at: new Date().toISOString() })
        .in('id', notificationIdsSent);

      if (updateError) {
        console.error('⚠️  CRON: Error marking notifications as sent:', updateError);
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      total_notifications: notifications.length,
      duration_ms: duration
    };

    console.log('✅ CRON: Completed email notifications:', summary);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('❌ CRON: Fatal error in email notifications:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
