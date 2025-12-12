import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Cron job: Update saved search matches cache
 *
 * Runs daily at 2am UTC via Vercel Cron
 *
 * For each saved search:
 * 1. Fetches current matches using existing match logic
 * 2. Compares with previous cached matches
 * 3. Identifies NEW matches (matches today that weren't in cache)
 * 4. Updates cache with current matches
 * 5. Queues email notifications for new matches (if enabled)
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

    console.log('✅ CRON: Starting saved search matches cache update');
    const startTime = Date.now();

    const supabase = createServerClient();

    // Fetch all saved searches
    const { data: searches, error: searchesError } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: true });

    if (searchesError) {
      console.error('❌ CRON: Error fetching saved searches:', searchesError);
      return NextResponse.json(
        { error: 'Failed to fetch saved searches' },
        { status: 500 }
      );
    }

    if (!searches || searches.length === 0) {
      console.log('ℹ️  CRON: No saved searches found');
      return NextResponse.json({
        success: true,
        message: 'No saved searches to process',
        processed: 0
      });
    }

    console.log(`📊 CRON: Found ${searches.length} saved searches to process`);

    let processedCount = 0;
    let errorCount = 0;
    let newMatchesCount = 0;
    let totalCachedMatches = 0;

    // Process searches in batches to avoid timeouts
    const BATCH_SIZE = 50;
    for (let i = 0; i < searches.length; i += BATCH_SIZE) {
      const batch = searches.slice(i, i + BATCH_SIZE);
      console.log(`📦 CRON: Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(searches.length / BATCH_SIZE)}`);

      for (const search of batch) {
        try {
          // Fetch current matches by calling the matches endpoint logic
          const matchesResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL}/api/saved-searches/${search.id}/matches?use_cache=false`,
            {
              headers: {
                'x-internal-request': 'true' // Mark as internal to skip auth
              }
            }
          );

          if (!matchesResponse.ok) {
            console.error(`⚠️  CRON: Failed to fetch matches for search ${search.id}`);
            errorCount++;
            continue;
          }

          const { matches } = await matchesResponse.json();
          const currentMatchIds = new Set(matches.map((m: any) => m.id));

          // Fetch previous cached matches
          const { data: cachedMatches } = await supabase
            .from('saved_search_matches_cache')
            .select('listing_id, distance_miles')
            .eq('search_id', search.id);

          const previousMatchIds = new Set((cachedMatches || []).map(m => m.listing_id));

          // Identify NEW matches (in current but not in previous)
          const newMatchIds = Array.from(currentMatchIds).filter(
            id => !previousMatchIds.has(id)
          );

          // Delete old cached matches for this search
          await supabase
            .from('saved_search_matches_cache')
            .delete()
            .eq('search_id', search.id);

          // Insert current matches into cache
          if (matches.length > 0) {
            const cacheEntries = matches.map((match: any) => ({
              search_id: search.id,
              listing_id: match.id,
              distance_miles: match.distance_miles || null,
              cached_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
              .from('saved_search_matches_cache')
              .insert(cacheEntries);

            if (insertError) {
              console.error(`⚠️  CRON: Error caching matches for search ${search.id}:`, insertError);
              errorCount++;
              continue;
            }

            totalCachedMatches += matches.length;
          }

          // Queue email notifications for new matches
          if (newMatchIds.length > 0 && search.email_notifications_enabled) {
            // Check if listings were approved > 24 hours ago
            const { data: listings } = await supabase
              .from('listings')
              .select('id, created_at, status')
              .in('id', newMatchIds)
              .eq('status', 'approved');

            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const eligibleListings = (listings || []).filter(
              listing => new Date(listing.created_at) < oneDayAgo
            );

            if (eligibleListings.length > 0) {
              const notifications = eligibleListings.map(listing => ({
                user_id: search.user_id,
                search_id: search.id,
                listing_id: listing.id
              }));

              // Insert notifications (ON CONFLICT DO NOTHING to handle duplicates)
              await supabase
                .from('saved_search_notification_queue')
                .upsert(notifications, { onConflict: 'search_id,listing_id', ignoreDuplicates: true });

              newMatchesCount += eligibleListings.length;
            }
          }

          processedCount++;

        } catch (error) {
          console.error(`❌ CRON: Error processing search ${search.id}:`, error);
          errorCount++;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total_cached_matches: totalCachedMatches,
      new_matches_found: newMatchesCount,
      duration_ms: duration
    };

    console.log('✅ CRON: Completed saved search matches cache update:', summary);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('❌ CRON: Fatal error in cache update:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
