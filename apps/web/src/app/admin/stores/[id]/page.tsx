import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { adminClient } from '@/lib/admin-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, ArrowLeft, CheckCircle2, Ruler, XCircle } from 'lucide-react'
import {
  profileEligibility, profilePublication, type FloorAreaRow,
} from '@/lib/epc/profile-eligibility'
import {
  formatDate, formatDateTime, formatFlag, formatInt, registerLabel,
} from '@/lib/epc/display'

export const dynamic = 'force-dynamic'

/**
 * "Where did this store's size come from?" — docs/store-floor-areas-import-plan.md §6.2.
 *
 * One store, one certificate, and the evidence that joined them, spelled out rather than
 * summarised. Reading an actual certificate against an actual store is how the concession
 * defect was found; this screen exists so that is possible without a database client.
 *
 * It also carries the line no other screen can give: whether this store counts toward its
 * brand's profile, and if not, why not. The rule is shared with the brand tab (§6.3) so
 * the two cannot drift.
 *
 * `certificate_address` appears HERE AND NOWHERE ELSE, and never in an export. It is
 * restricted OS/Royal Mail text and the first column to drop if the licensing position
 * changes; keeping it off every download stops it spreading into spreadsheets that
 * outlive the decision.
 */

interface StoreRow {
  id: string
  name: string | null
  address_line_1: string | null
  address_line_2: string | null
  town: string | null
  county: string | null
  postcode: string | null
  brand_id: string | null
  fascia_id: string | null
  pqi: string | null
  google_place_id: string | null
  size_band: string | null
}

interface AreaRow extends FloorAreaRow {
  floor_area_sqft: number | null
  measurement_basis: string
  source: string | null
  certificate_number: string | null
  certificate_date: string | null
  certificate_address: string | null
  property_type: string | null
  property_class: string | null
  uprn: number | null
  match_method: string
  address_corroboration: string | null
  brand_on_certificate: boolean | null
  foreign_operator: string | null
  spatial_distance_m: number | null
  candidate_count: number | null
  certs_at_address: number | null
  matcher_version: string
  computed_at: string
  match_attempts: number
  last_error: string | null
}

export default async function StoreFloorAreaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = adminClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id,name,address_line_1,address_line_2,town,county,postcode,brand_id,fascia_id,pqi,google_place_id,size_band')
    .eq('id', id)
    .maybeSingle()

  if (!store) notFound()
  const s = store as StoreRow

  const [{ data: area }, { data: brand }, { data: fascia }] = await Promise.all([
    supabase.from('store_floor_areas').select('*').eq('store_id', id).maybeSingle(),
    s.brand_id
      ? supabase.from('brands').select('id,name').eq('id', s.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    s.fascia_id
      ? supabase.from('fascias').select('id,name').eq('id', s.fascia_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const row = (area ?? null) as AreaRow | null
  const eligibility = profileEligibility(row)

  // How many measured shops stand behind each grain this store belongs to — the other
  // half of "does this reach a user", and the only part that is not about this store.
  const [brandMeasured, fasciaMeasured] = await Promise.all([
    measuredCount(supabase, 'brand_id', s.brand_id),
    measuredCount(supabase, 'fascia_id', s.fascia_id),
  ])

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <Link
          href={s.brand_id ? `/admin/brands/${s.brand_id}` : '/admin/stores/floor-areas'}
          className="caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> {brandName(brand) ?? 'Floor areas'}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <Ruler className="h-8 w-8 text-primary" />
          <div>
            <h1 className="heading-1">{s.name || 'Unnamed store'}</h1>
            <p className="body-large text-muted-foreground">
              {/* Single-format brands name the fascia after the brand; saying it twice
                  reads like a bug. */}
              {Array.from(new Set([brandName(brand), brandName(fascia)].filter(Boolean)))
                .join(' · ') || 'No brand'}
              {' · '}
              {[s.address_line_1, s.address_line_2, s.town, s.postcode].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* The line the other screens cannot give. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {eligibility.counts
              ? <CheckCircle2 className="h-5 w-5 text-success" />
              : <XCircle className="h-5 w-5 text-warning" />}
            {eligibility.headline}
          </CardTitle>
          <CardDescription>{eligibility.detail}</CardDescription>
        </CardHeader>
        {eligibility.counts && (
          <CardContent className="space-y-1">
            <p className="body-small">
              <span className="text-muted-foreground">Brand: </span>
              {profilePublication(brandMeasured, 'brand').detail}
            </p>
            {s.fascia_id && (
              <p className="body-small">
                <span className="text-muted-foreground">Fascia: </span>
                {profilePublication(fasciaMeasured, 'fascia').detail}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {!row ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No match row</AlertTitle>
          <AlertDescription>
            Nothing has been computed for this store yet, so there is no evidence to show.
            It sits in the queue on the{' '}
            <Link href="/admin/stores/floor-areas" className="underline">
              floor-area health page
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {row.last_error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>The matcher failed on this store</AlertTitle>
              <AlertDescription>
                {row.last_error} — attempt {formatInt(row.match_attempts)}.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Measurement</CardTitle>
              <CardDescription>
                Gross internal area: the whole envelope, not the sales area a retail agent
                means by &ldquo;size&rdquo;. It runs materially larger, and anything shown
                beside a stated occupier requirement has to say so.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field
                label="Floor area"
                value={row.floor_area_sqft === null ? '—' : `${formatInt(row.floor_area_sqft)} sq ft`}
                // The second unit sits under the first rather than inside it: as one
                // string at heading size it wraps mid-parenthesis in a grid column.
                hint={row.floor_area_m2 === null ? undefined : `${Math.round(Number(row.floor_area_m2) * 10) / 10} m²`}
                big
              />
              <Field label="Basis" value={row.measurement_basis.replace(/_/g, ' ')} />
              <Field label="Confidence" value={<Badge variant={confidenceVariant(row.confidence)}>{row.confidence}</Badge>} />
              <Field label="Size plausibility" value={row.size_plausibility || 'not assessed'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certificate</CardTitle>
              <CardDescription>
                The register entry this measurement came from. The address is shown here so
                a human can audit the match against the store above — it is restricted
                OS/Royal Mail text, appears on no other screen, and is in no export.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Number" value={row.certificate_number || '—'} />
              <Field label="Register" value={row.source ? registerLabel(row.source) : '—'} />
              <Field label="Lodged" value={formatDate(row.certificate_date)} />
              <Field label="Property type" value={row.property_type || '—'} />
              <Field label="Class" value={row.property_class || '—'} />
              <Field label="UPRN" value={row.uprn ? String(row.uprn) : '—'} />
              <div className="col-span-2 md:col-span-3">
                <Field label="Certificate address" value={row.certificate_address || '—'} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>
                What made this the right certificate rather than the shop next door.
                Matching on postcode alone returns a real certificate for the wrong
                building about half the time, so each of these is part of the argument.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Method" value={row.match_method} />
              <Field label="Address corroboration" value={row.address_corroboration || 'none'} />
              <Field label="Brand named on it" value={formatFlag(row.brand_on_certificate)} />
              <Field
                label="Rival operator named"
                value={row.foreign_operator || 'none'}
                tone={row.foreign_operator ? 'warning' : 'default'}
              />
              <Field
                label="Candidates at postcode"
                value={row.candidate_count === null ? '—' : formatInt(row.candidate_count)}
              />
              <Field
                label="Certificates at address"
                value={row.certs_at_address === null ? '—' : formatInt(row.certs_at_address)}
              />
              <Field
                label="Spatial distance"
                value={row.spatial_distance_m === null ? 'not used' : `${row.spatial_distance_m} m`}
              />
              <Field
                label="Store coordinate"
                value={s.pqi || (s.google_place_id ? 'Google-validated' : 'no signal')}
              />
              <Field label="Existing size band" value={s.size_band || 'none'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Provenance</CardTitle>
              <CardDescription>
                Which matcher produced this row and when. A changed row is otherwise
                indistinguishable from a changed register.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Matcher" value={row.matcher_version} />
              <Field label="Computed" value={formatDateTime(row.computed_at)} />
              <Field label="Attempts" value={formatInt(row.match_attempts)} />
              <Field label="Last error" value={row.last_error || 'none'} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/** High-confidence measured shops at a grain — what the 5-shop floor is counted against. */
async function measuredCount(
  supabase: ReturnType<typeof adminClient>,
  column: 'brand_id' | 'fascia_id',
  value: string | null
): Promise<number> {
  if (!value) return 0
  const { count } = await supabase
    .from('store_floor_areas')
    .select('store_id, stores!inner(id)', { count: 'exact', head: true })
    .eq('confidence', 'high')
    .not('floor_area_m2', 'is', null)
    .eq(`stores.${column}`, value)
  return count ?? 0
}

function brandName(row: unknown): string | null {
  return (row as { name?: string } | null)?.name ?? null
}

function confidenceVariant(confidence: string) {
  if (confidence === 'high') return 'success' as const
  if (confidence === 'medium') return 'warning' as const
  return 'secondary' as const
}

function Field({
  label, value, hint, big, tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  big?: boolean
  tone?: 'default' | 'warning'
}) {
  return (
    <div>
      <p className="caption text-muted-foreground">{label}</p>
      <div className={`${big ? 'heading-3' : 'body-base'} ${tone === 'warning' ? 'text-warning' : ''} break-words`}>
        {value}
      </div>
      {hint && <p className="caption text-muted-foreground">{hint}</p>}
    </div>
  )
}
