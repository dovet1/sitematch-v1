import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/admin-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AlertTriangle, ArrowLeft, Ruler } from 'lucide-react'
import type { FloorAreaHealth } from '@/types/floor-area-health'
import { RunMatchButton } from './components/RunMatchButton'
import {
  formatDate, formatDateTime, formatDuration, formatInt, formatShare, registerLabel,
} from '@/lib/epc/display'

export const dynamic = 'force-dynamic'

/**
 * "Is the floor-area pipeline healthy?" — docs/store-floor-areas-import-plan.md §6.1.
 *
 * Six questions, in the order they go wrong: is the register current, did the last match
 * run work, is anything stuck, how much of the estate is measured, and how much of it
 * could ever be reached by a spatial match.
 *
 * Everything here comes from one RPC (epc_pipeline_health) because every panel is an
 * aggregate and PostgREST cannot group. Nothing on this page writes; the only action is
 * "Run now", which calls the same cron route the scheduler calls.
 */

/** A quarterly reload plus slack. Past this the register is old enough to act on. */
const REGISTER_STALE_DAYS = 120

export default async function FloorAreaHealthPage() {
  await requireAdmin()

  // Service role, not the caller's session: store_floor_areas and epc_certificates are
  // service_role-only by design, and this page is already behind requireAdmin().
  const supabase = adminClient()
  const { data, error } = await supabase.rpc('epc_pipeline_health')

  if (error || !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <PageHeading />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not read the pipeline state</AlertTitle>
          <AlertDescription>
            <p>{error?.message || 'The health function returned nothing.'}</p>
            <p className="mt-2 caption">
              If this says the function does not exist, migration
              <code className="mx-1">20260913000000_epc_pipeline_health.sql</code>
              has not been applied yet.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const health = data as FloorAreaHealth

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeading generatedAt={health.generated_at} />
        <RunMatchButton />
      </div>

      <RegisterSection register={health.register} />
      <MatchingSection runs={health.matching.recent} />
      <QueueSection queue={health.queue} deadLetters={health.dead_letters} />
      <CoverageSection coverage={health.coverage} />
      <CoordinateSection coordinates={health.coordinates} />
    </div>
  )
}

function PageHeading({ generatedAt }: { generatedAt?: string }) {
  return (
    <div>
      <Link
        href="/admin"
        className="caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Admin
      </Link>
      <div className="flex items-center gap-3 mt-2">
        <Ruler className="h-8 w-8 text-primary" />
        <div>
          <h1 className="heading-1">Store floor areas</h1>
          <p className="body-large text-muted-foreground">
            EPC register, matching runs, and how much of the estate is measured
            {generatedAt ? ` · read ${formatDateTime(generatedAt)}` : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- register */

function RegisterSection({ register }: { register: FloorAreaHealth['register'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>
          What the last load of each register established. These figures are recorded when
          the register is loaded rather than counted now — they cannot change until the
          next load, and counting them live costs a full scan of 1.3M rows. Certificates
          without a coordinate can never be matched spatially, whatever the store&apos;s
          geocode quality.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {register.length === 0 ? (
          <Empty>No register has been loaded.</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {register.map((r) => {
              const stale = r.days_since_load !== null && r.days_since_load > REGISTER_STALE_DAYS
              return (
                <div key={r.source} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="body-base font-medium">{registerLabel(r.source)}</p>
                      <p className="caption text-muted-foreground">
                        {r.snapshot_ref || 'no snapshot reference'}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Certificates" value={formatInt(r.certificates)} />
                    <Stat
                      label="With a coordinate"
                      value={formatShare(r.with_geom, r.certificates)}
                      hint={r.with_geom === null ? 'not recorded' : `${formatInt(r.with_geom)} certificates`}
                    />
                    <Stat
                      label="Loaded"
                      value={formatDate(r.loaded_at)}
                      hint={
                        r.days_since_load === null
                          ? 'load did not finish'
                          : `${formatInt(r.days_since_load)} day${r.days_since_load === 1 ? '' : 's'} ago`
                      }
                      tone={stale ? 'warning' : 'default'}
                    />
                    <Stat label="Newest certificate" value={formatDate(r.newest_certificate)} />
                  </div>

                  {stale && (
                    <p className="caption text-warning">
                      Older than {REGISTER_STALE_DAYS} days. The register is reloaded
                      quarterly; a store matched against a stale snapshot keeps a
                      certificate that may since have been superseded.
                    </p>
                  )}
                  {r.error && <p className="caption text-error">{r.error}</p>}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- matching */

function MatchingSection({ runs }: { runs: FloorAreaHealth['matching']['recent'] }) {
  const last = runs[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matching</CardTitle>
        <CardDescription>
          Incremental runs give newly imported stores an area. The quarterly full run
          remains the source of truth and overwrites every row written here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!last ? (
          <Empty>No match run has been recorded yet.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat
                label="Last run"
                value={formatDateTime(last.started_at)}
                hint={`${last.kind} · ${last.matcher_version}`}
              />
              <Stat label="Stores considered" value={formatInt(last.stores_considered)} />
              <Stat
                label="High confidence"
                value={formatInt(last.matched_high)}
                hint={formatShare(last.matched_high, last.stores_considered) + ' of the run'}
              />
              <Stat
                label="Errored"
                value={formatInt(last.errored)}
                tone={last.errored > 0 ? 'error' : 'default'}
              />
            </div>

            {last.status === 'failed' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>The last run failed</AlertTitle>
                <AlertDescription>{last.error || 'No error was recorded.'}</AlertDescription>
              </Alert>
            )}
            {last.status === 'running' && (
              <p className="caption text-muted-foreground">
                A run is in progress. A run left in this state after a few minutes hit the
                function timeout — the batch it was working is simply picked up again,
                because the queue is derived rather than checked out.
              </p>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Matcher</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Considered</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead className="text-right">Medium</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">None</TableHead>
                    <TableHead className="text-right">Errored</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(run.started_at)}
                        {run.error && <p className="caption text-error">{run.error}</p>}
                      </TableCell>
                      <TableCell>{run.kind}</TableCell>
                      <TableCell className="caption">{run.matcher_version}</TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-right">{formatInt(run.stores_considered)}</TableCell>
                      <TableCell className="text-right">{formatInt(run.matched_high)}</TableCell>
                      <TableCell className="text-right">{formatInt(run.matched_medium)}</TableCell>
                      <TableCell className="text-right">{formatInt(run.matched_low)}</TableCell>
                      <TableCell className="text-right">{formatInt(run.matched_none)}</TableCell>
                      <TableCell className={`text-right ${run.errored > 0 ? 'text-error' : ''}`}>
                        {formatInt(run.errored)}
                      </TableCell>
                      <TableCell className="text-right">{formatDuration(run.duration_seconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------- queue */

function QueueSection({
  queue, deadLetters,
}: {
  queue: FloorAreaHealth['queue']
  deadLetters: FloorAreaHealth['dead_letters']
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue</CardTitle>
        <CardDescription>
          The queue is derived, not stored: a store with no match row has never been
          attempted. Nothing is lost by an unfinished batch — the next run sees the same
          set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat
            label="Never attempted"
            value={formatInt(queue.never_attempted)}
            hint="waiting for the next run"
            tone={queue.never_attempted > 0 ? 'warning' : 'default'}
          />
          <Stat
            label="Retryable errors"
            value={formatInt(queue.retryable)}
            hint={`under ${queue.max_attempts} attempts`}
          />
          <Stat
            label="Dead letters"
            value={formatInt(queue.dead_letters)}
            hint={`${queue.max_attempts} attempts spent`}
            tone={queue.dead_letters > 0 ? 'error' : 'default'}
          />
          <Stat
            label="No postcode"
            value={formatInt(queue.no_postcode)}
            hint="nothing to look up"
          />
        </div>

        {deadLetters.length === 0 ? (
          <Empty>No store has recorded a matching error.</Empty>
        ) : (
          <div className="space-y-2">
            <p className="body-small font-medium">Stores that errored</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Last tried</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadLetters.map((d) => (
                    <TableRow key={d.store_id}>
                      <TableCell>
                        {/* The evidence view (§6.2) is where a dead letter is diagnosed. */}
                        <Link href={`/admin/stores/${d.store_id}`} className="body-small font-medium hover:underline">
                          {d.store_name || d.store_id}
                        </Link>
                        {d.town && <p className="caption text-muted-foreground">{d.town}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{d.postcode || '—'}</TableCell>
                      <TableCell className="text-right">{formatInt(d.match_attempts)}</TableCell>
                      <TableCell className="caption max-w-md break-words">{d.last_error}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(d.computed_at)}
                        <p className="caption text-muted-foreground">
                          {d.will_retry ? 'will retry' : 'given up'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- coverage */

function CoverageSection({ coverage }: { coverage: FloorAreaHealth['coverage'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage</CardTitle>
        <CardDescription>
          Only high-confidence rows reach a user. Everything else is kept as evidence:
          low-confidence rows were the wrong premises about half the time in assessment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Stores" value={formatInt(coverage.estate)} hint={`${formatInt(coverage.estate_with_postcode)} with a postcode`} />
          <Stat
            label="Measured"
            value={formatShare(coverage.high, coverage.estate_with_postcode)}
            hint={`${formatInt(coverage.high)} high-confidence rows`}
          />
          <Stat label="Attempted" value={formatInt(coverage.rows_total)} hint="stores carrying any match row" />
          <Stat
            label="Demoted"
            value={formatInt(coverage.demoted)}
            hint="implausible for the format"
          />
        </div>

        <p className="caption text-muted-foreground">
          The share is against stores with a postcode, not the whole estate: a store the
          matcher cannot look up is not a matching failure. These areas are gross internal
          — the whole envelope, not the sales area an agent means by &ldquo;size&rdquo;.
        </p>

        <div className="space-y-2">
          <p className="body-small font-medium">By matcher version</p>
          <p className="caption text-muted-foreground">
            The full run and the incremental runs do not match at the same rate. This is
            where that difference is visible rather than assumed.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matcher version</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">High</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Medium</TableHead>
                  <TableHead className="text-right">Low</TableHead>
                  <TableHead className="text-right">None</TableHead>
                  <TableHead className="text-right">Demoted</TableHead>
                  <TableHead>Last computed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverage.by_matcher_version.map((v) => (
                  <TableRow key={v.matcher_version}>
                    <TableCell className="caption">{v.matcher_version}</TableCell>
                    <TableCell className="text-right">{formatInt(v.rows_total)}</TableCell>
                    <TableCell className="text-right">{formatInt(v.high)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatShare(v.high, v.rows_total)}
                    </TableCell>
                    <TableCell className="text-right">{formatInt(v.medium)}</TableCell>
                    <TableCell className="text-right">{formatInt(v.low)}</TableCell>
                    <TableCell className="text-right">{formatInt(v.none)}</TableCell>
                    <TableCell className="text-right">{formatInt(v.demoted)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(v.last_computed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------- coordinate quality */

function CoordinateSection({ coordinates }: { coordinates: FloorAreaHealth['coordinates'] }) {
  const { buckets, spatial } = coordinates
  const total = spatial.rooftop + spatial.google_validated + spatial.no_signal

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coordinate quality</CardTitle>
        <CardDescription>
          Which stores a spatial match may consider at all. Two populations with two
          calibrations: geocoder-graded rooftop coordinates, and coordinates confirmed
          against Google Places on import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Rooftop"
            value={formatInt(spatial.rooftop)}
            hint={`${formatShare(spatial.rooftop, total)} · calibrated at 25 m`}
          />
          <Stat
            label="Google-validated"
            value={formatInt(spatial.google_validated)}
            hint={`${formatShare(spatial.google_validated, total)} · needs its own 10 m calibration`}
          />
          <Stat
            label="Outside both"
            value={formatInt(spatial.no_signal)}
            hint="graded, but not Rooftop, and no place id"
            tone={spatial.no_signal > 0 ? 'warning' : 'default'}
          />
        </div>

        <p className="caption text-muted-foreground">
          These are eligibility counts, not coverage. Spatial matching fires on roughly a
          quarter of rooftop stores and a tenth of Google-validated ones, so the reachable
          gain is thousands of stores, not tens of thousands. Google-validated coordinates
          also agree with a blind spatial pick less often than rooftop ones (87.9% against
          93.8% at the production thresholds), which is why they need their own gate
          rather than a widened one.
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Geocode quality (pqi)</TableHead>
                <TableHead>Google place id</TableHead>
                <TableHead className="text-right">Stores</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((b) => (
                <TableRow key={`${b.pqi ?? 'none'}-${b.has_place_id}`}>
                  <TableCell>
                    {b.pqi || <span className="text-muted-foreground">not recorded</span>}
                  </TableCell>
                  <TableCell>
                    {b.has_place_id
                      ? <Badge variant="compact">held</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatInt(b.stores)}</TableCell>
                  <TableCell className="text-right">{formatShare(b.stores, total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="caption text-muted-foreground">
          Stores imported before the import route recorded a geocode grade show no pqi.
          Those rows are not ungraded — they hold a Google place id, which is a different
          signal from a different source, and the row above says how many. The rows to
          watch are the opposite case: a grade of Third Party or Building with no place id
          is outside both calibrations, and no amount of spatial work will reach it.
        </p>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------- primitives */

function Stat({
  label, value, hint, tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'error'
}) {
  const toneClass = tone === 'warning' ? 'text-warning' : tone === 'error' ? 'text-error' : ''
  return (
    <div>
      <p className="caption text-muted-foreground">{label}</p>
      <p className={`heading-3 ${toneClass}`}>{value}</p>
      {hint && <p className="caption text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const variant = status === 'complete' ? 'success'
    : status === 'failed' ? 'destructive'
    : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="body-small text-muted-foreground">{children}</p>
}
