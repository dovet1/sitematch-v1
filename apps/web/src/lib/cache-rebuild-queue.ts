// Queue a BUA summary (GapFinder) rebuild.
//
// The rebuild itself runs inside Postgres: the pg_cron job process-cache-rebuild-queue
// drains cache_rebuild_queue every 5 minutes (migration
// 20261024000000_process_cache_rebuild_queue_in_database.sql). Never call
// rebuild_all_bua_summaries from the app: PostgREST cancels it at the authenticator
// role's 8s statement_timeout, and a function-level SET cannot lift that.

import { adminClient } from '@/lib/admin-auth';

export type CacheRebuildReason = 'store_import' | 'manual';

export async function queueCacheRebuild(
  reason: CacheRebuildReason
): Promise<{ queued: boolean; error?: string }> {
  const { error } = await adminClient()
    .from('cache_rebuild_queue')
    .insert({ reason });

  // 23505: the partial unique index allows one pending row, and one already covers this.
  if (error && error.code !== '23505') {
    return { queued: false, error: error.message };
  }
  return { queued: true };
}
