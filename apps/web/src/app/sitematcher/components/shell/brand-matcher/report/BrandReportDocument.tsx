'use client'

import { Fragment, useLayoutEffect, useRef } from 'react'
import {
  classLabel,
  formatMiles,
  formatSqft,
  formatSqftShort,
  SIGNAL_LABEL,
  TOP_STORE_TOWNS,
  signalSummaries,
  turnoverValue,
  type SignalSummary,
} from '../../../../lib/brand-matcher'
import {
  acquisitiveLine,
  demographicsLine,
  financialRows,
  liveRequirement,
  nearestLine,
  PAPER,
  plural,
  REPORT_TONE,
  reportPageCount,
  requirementSummary,
  siteTownName,
  sizeLine,
  sizeScale,
  sqftRange,
  SUMMARY_ROWS_PER_PAGE,
  useClassLine,
  type ReportTone,
} from '../../../../lib/brand-report'
import { formatPeople } from '../../../../lib/brand-matcher-demographics'
import type {
  BrandMatcherQuery,
  BrandMatcherSite,
  BrandReportBrand,
  BrandReportMeta,
  TownMatchBand,
} from '../../../../types/brand-matcher'
import { UBrandAvatar } from '../../directory/UDirectoryPrimitives'
import { shortDate } from '../BrandMatcherUi'

// The shareable brand report (docs/design_handoff_brand_report_export §Screen 3): a cover, the
// summary (12 brands a page), then one page per brand. Every page is a fixed box with no reflow;
// anything that could run long is clamped so a brand never spills onto a second page. Styles are
// scoped to .bmr and fixed in pixels: this is a print document, not an app surface.

export interface BrandReportDocumentProps {
  site: BrandMatcherSite
  query: BrandMatcherQuery
  brands: BrandReportBrand[]
  meta: BrandReportMeta
  date: Date
}

type Tone = ReportTone
const GLYPH: Record<Tone, string> = { ok: '✓', warn: '!', bad: '×', none: '–' }

function Ic({ tone }: { tone: Tone }) {
  return <span className={`ic ${tone}`}>{GLYPH[tone]}</span>
}

function Sv({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`sv ${tone}`}>
      <Ic tone={tone} />
      {children}
    </span>
  )
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`pill ${tone}`}>
      <Ic tone={tone} />
      {children}
    </span>
  )
}

function Mark({ size }: { size: number }) {
  return (
    <svg height={size} width={size} viewBox="0 0 64 64" aria-hidden>
      <g fill="#7033ff">
        <path d="M2.61,37.02a1.46,1.46,0,0,1-.11-.55V4A1.5,1.5,0,0,1,4,2.5H15.77a1.5,1.5,0,0,1,1.06.44L27.18,13.29a1.5,1.5,0,0,1,0,2.12L5.06,37.53A1.5,1.5,0,0,1,2.61,37.02Z" />
        <path d="M61.5,4V15.77a1.8,1.8,0,0,1-.11.57,1.6,1.6,0,0,1-.33.49L50.71,27.18a1.5,1.5,0,0,1-2.12,0L26.47,5.06a1.5,1.5,0,0,1,.49-2.45,1.8,1.8,0,0,1,.57-.11L60,2.5A1.5,1.5,0,0,1,61.5,4Z" />
        <path d="M61.39,26.98a1.46,1.46,0,0,1,.11.55V60A1.5,1.5,0,0,1,60,61.5H48.23a1.5,1.5,0,0,1-1.06-.44L36.82,50.71a1.5,1.5,0,0,1,0-2.12L58.94,26.47A1.5,1.5,0,0,1,61.39,26.98Z" />
        <path d="M19.17,30.94,30.94,19.17a1.51,1.51,0,0,1,2.12,0L44.83,30.94a1.51,1.51,0,0,1,0,2.12L33.06,44.83a1.52,1.52,0,0,1-2.12,0L19.17,33.06A1.51,1.51,0,0,1,19.17,30.94Z" />
        <path d="M37.86,59.45a1.5,1.5,0,0,1-1.39,2.05L4,61.5A1.5,1.5,0,0,1,2.5,60V48.23a1.8,1.8,0,0,1,.11-.57,1.6,1.6,0,0,1,.33-.49L13.29,36.82a1.55,1.55,0,0,1,2.12,0L37.53,58.94A1.29,1.29,0,0,1,37.86,59.45Z" />
      </g>
    </svg>
  )
}

function Logo({ b, size }: { b: BrandReportBrand; size: number }) {
  return (
    <UBrandAvatar
      id={b.brandId}
      name={b.name}
      logoUrl={b.logoUrl}
      domain={b.domain}
      size={size}
      radius={Math.round(size * 0.22)}
    />
  )
}

function Ring({ value }: { value: number }) {
  const r = 33
  const c = 2 * Math.PI * r
  return (
    <div className="score">
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
        <circle cx="38" cy="38" r={r} fill="#fff" stroke="#E6DFFB" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#7033FF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${((c * value) / 100).toFixed(1)} ${c.toFixed(1)}`}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div>
        <b>{value}</b>
        <span>of 100</span>
      </div>
    </div>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function signalText(s: SignalSummary): string {
  return s.status === 'none' ? 'No data' : s.value
}

function subline(b: BrandReportBrand, storesWord: string): string {
  return [b.category, b.storeCount > 0 ? `${b.storeCount.toLocaleString('en-GB')} ${storesWord}` : null]
    .filter(Boolean)
    .join(' · ')
}

export function BrandReportDocument({ site, query, brands, meta, date }: BrandReportDocumentProps) {
  const paper = PAPER[meta.paper]
  const town = siteTownName(site)
  const sqft = formatSqft(query.sqft)
  const useClass = classLabel(query.useClass)
  const total = reportPageCount(brands.length)
  const chunks: BrandReportBrand[][] = []
  for (let i = 0; i < brands.length; i += SUMMARY_ROWS_PER_PAGE) chunks.push(brands.slice(i, i + SUMMARY_ROWS_PER_PAGE))
  const pageStyle = { width: paper.width, height: paper.height }
  const rootRef = useRef<HTMLDivElement>(null)

  // Last resort for unusually long data: drop the optional rows marked data-trim (lowest
  // priority first) until a brand page's columns fit its box.
  useLayoutEffect(() => {
    const fit = () =>
      rootRef.current?.querySelectorAll<HTMLElement>('.cols2 > .col').forEach((col) => {
        const room = (col.parentElement as HTMLElement).clientHeight
        const trims = Array.from(col.querySelectorAll<HTMLElement>('[data-trim]')).sort(
          (x, y) => Number(y.dataset.trim) - Number(x.dataset.trim)
        )
        for (const el of trims) {
          if (col.offsetHeight <= room) break
          el.style.display = 'none'
        }
      })
    fit()
    // Text metrics change once the web font arrives.
    let live = true
    void document.fonts?.ready.then(() => live && fit())
    return () => {
      live = false
    }
  })

  const header = (
    <div className="rh">
      <span className="lg-s">
        <Mark size={18} />
        SiteMatcher
      </span>
      <span className="crumb">
        {[site.postcode, town, `${sqft} sq ft`, useClass]
          .filter((x): x is string => !!x)
          .map((x, i) => (
            <Fragment key={i}>
              {i > 0 && <i />}
              {x}
            </Fragment>
          ))}
      </span>
    </div>
  )
  const footer = (n: number) => (
    <div className="ft">
      <span>
        Brand report
        {meta.preparedFor.trim() && (
          <>
            {' · Prepared for '}
            <b>{meta.preparedFor.trim()}</b>
          </>
        )}
      </span>
      <span>
        <span className="pn">{pad2(n)}</span> / {pad2(total)}
      </span>
    </div>
  )

  return (
    <div className="bmr" ref={rootRef}>
      <style>{reportCss(paper.css)}</style>
      <Cover site={site} query={query} brands={brands} meta={meta} date={date} style={pageStyle} town={town} />
      {chunks.map((chunk, ci) => (
        <section key={`s${ci}`} className="page" style={pageStyle}>
          <div className="band">
            {header}
            <div className="ttl">
              <div>
                <h2>
                  Shortlist at a glance
                  {chunks.length > 1 && (
                    <span className="of">
                      {' '}
                      {ci + 1}/{chunks.length}
                    </span>
                  )}
                </h2>
                <p className="lead">
                  Each brand is scored out of 100 against your site. A page of detail for every brand follows, in the
                  same order.
                </p>
              </div>
            </div>
          </div>
          <SummaryTable brands={chunk} offset={ci * SUMMARY_ROWS_PER_PAGE} query={query} />
          {ci === chunks.length - 1 && (
            <>
              <div className="key">
                <Sv tone="ok">Meets the site</Sv>
                <Sv tone="warn">Partial</Sv>
                <Sv tone="bad">Conflict</Sv>
                <Sv tone="none">No data</Sv>
              </div>
              <p className="disc">
                Financials are as filed at Companies House, unedited. Published turnover counts towards the match score:
                larger turnover scores higher. This is not a credit or covenant rating.
              </p>
            </>
          )}
          {footer(ci + 2)}
        </section>
      ))}
      {brands.map((b, i) => (
        <BrandPage
          key={b.brandId}
          b={b}
          rank={i + 1}
          of={brands.length}
          site={site}
          query={query}
          header={header}
          footer={footer(1 + chunks.length + i + 1)}
          style={pageStyle}
        />
      ))}
    </div>
  )
}

function Cover({
  site,
  query,
  brands,
  meta,
  date,
  style,
  town,
}: BrandReportDocumentProps & {
  style: React.CSSProperties
  town: string | null
}) {
  const top = brands.slice(0, 3)
  const rest = brands.slice(3)
  const by = meta.preparedBy.trim()
  return (
    <section className="page cover" style={style}>
      <div className="cv-top">
        <div className="cv-logo">
          <Mark size={24} />
          SiteMatcher
        </div>
        <div className="cv-date">
          {date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>
      <div className="cv-mid">
        <div className="kick">Brand report</div>
        <h1>
          {brands.length} {plural(brands.length, 'brand')} for <em>{formatSqft(query.sqft)} sq ft</em> in{' '}
          {town ?? site.postcode}
        </h1>
        <p className="cv-sub">
          Ranked by how well each brand fits the site on size, use class, appetite to open, local demographics, distance
          to its nearest store and published financials.
        </p>
        {meta.note.trim() && (
          <div className="cv-note">
            <div className="l">{by ? `A note from ${by}` : 'A note'}</div>
            <p>{meta.note.trim()}</p>
          </div>
        )}
      </div>
      <div className="cv-top3">
        <div className="h">
          <span>Strongest {plural(top.length, 'match', 'matches')}</span>
          {rest.length > 0 && <span>+{rest.length} more inside</span>}
        </div>
        <div className="cv-cards">
          {top.map((b) => (
            <div key={b.brandId} className="cv-card">
              <Logo b={b} size={36} />
              <div className="cv-card-t">
                <b>{b.name}</b>
                {b.category && <span>{b.category}</span>}
              </div>
              <div className="s">{b.score}</div>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <div className="cv-more">
            {rest.map((b) => (
              <Logo key={b.brandId} b={b} size={26} />
            ))}
          </div>
        )}
      </div>
      <div className="cv-band">
        <div className="wide">
          <div className="k">Prepared for</div>
          <div className="v">{meta.preparedFor.trim() || '—'}</div>
        </div>
        <div className="wide">
          <div className="k">Prepared by</div>
          <div className="v">
            {by || '—'}
            {meta.company.trim() && <small>{meta.company.trim()}</small>}
          </div>
        </div>
        <hr />
        <div>
          <div className="k">Site</div>
          <div className="v">
            {site.postcode}
            {town && <small>{town}</small>}
          </div>
        </div>
        <div>
          <div className="k">Size</div>
          <div className="v">{formatSqft(query.sqft)} sq ft</div>
        </div>
        <div>
          <div className="k">Use class</div>
          <div className="v">{classLabel(query.useClass)}</div>
        </div>
        <div>
          <div className="k">Brands</div>
          <div className="v">{brands.length}</div>
        </div>
      </div>
    </section>
  )
}

function SummaryTable({
  brands,
  offset,
  query,
}: {
  brands: BrandReportBrand[]
  offset: number
  query: BrandMatcherQuery
}) {
  return (
    <table className="tb">
      <colgroup>
        <col style={{ width: 22 }} />
        <col />
        <col style={{ width: 52 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 72 }} />
        <col style={{ width: 98 }} />
        <col style={{ width: 70 }} />
        <col style={{ width: 62 }} />
        <col style={{ width: 60 }} />
      </colgroup>
      <thead>
        <tr>
          <th />
          <th>Brand</th>
          <th>Size</th>
          <th>Use class</th>
          <th>Acquisitive</th>
          <th>Demographics</th>
          <th>Nearest</th>
          <th className="r">Turnover</th>
          <th className="r">Fit</th>
        </tr>
      </thead>
      <tbody>
        {brands.map((b, j) => {
          const signals = signalSummaries(b, query)
          const turnover = b.tradingFacts ? turnoverValue(b.tradingFacts) : null
          const sub = subline(b, plural(b.storeCount, 'store'))
          return (
            <tr key={b.brandId}>
              <td className="num">{pad2(offset + j + 1)}</td>
              <td>
                <div className="bnm">
                  <Logo b={b} size={24} />
                  <div>
                    <b>{b.name}</b>
                    {sub && <span>{sub}</span>}
                  </div>
                </div>
              </td>
              {signals.map((s) => (
                <td key={s.key}>
                  <Sv tone={REPORT_TONE[s.status]}>{signalText(s)}</Sv>
                </td>
              ))}
              <td className="r">{turnover && turnover !== 'Not disclosed' ? turnover : '—'}</td>
              <td className="fit">
                <span className="fitc">
                  <i>
                    <u style={{ width: `${b.score}%` }} />
                  </i>
                  <b>{b.score}</b>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// At most two evidence rows under Acquisitive, so the left column fits US Letter.
type EvidenceRow = { label: string; value: string; date: string; lines?: 1 | 2 }

function acquisitiveEvidence(b: BrandReportBrand): EvidenceRow[] {
  const a = b.acquisitive
  if (!a) return []
  const rows: EvidenceRow[] = []
  const latest = a.requirements?.items?.[0]
  if (latest)
    rows.push({
      label: 'Requirement',
      value: requirementSummary(latest),
      date: latest.postedAt ? shortDate(latest.postedAt) : '',
      lines: 2,
    })
  if (a.requirements && a.requirements.count > 1) {
    rows.push({
      label: 'Other requirements',
      value: `${a.requirements.count - 1} more listed`,
      date: '',
    })
  }
  const news = a.news?.items[0]
  if (news)
    rows.push({
      label: 'News',
      value: news.headline,
      date: news.upcoming ? 'Upcoming' : shortDate(news.date),
      lines: 1,
    })
  if (a.planning) {
    const n = a.planning.count
    rows.push({
      label: 'Planning',
      value: `${n} ${plural(n, 'development')} ${n === 1 ? 'names' : 'name'} ${b.name} as occupier`,
      date: '',
      lines: 1,
    })
  }
  return rows.slice(0, 2)
}

const MATCH: Record<TownMatchBand, { label: string; cls: string }> = {
  close: { label: 'Close', cls: 'mC' },
  partial: { label: 'Partial', cls: 'mP' },
  none: { label: 'Not close', cls: 'mN' },
}

// Rows shown per section, so the tallest brand page still fits US Letter. Demographics shows every
// store the API returns (its top TOP_STORE_TOWNS).
const DEMOGRAPHIC_ROWS = TOP_STORE_TOWNS
const NEAREST_ROWS = 3

function BrandPage({
  b,
  rank,
  of,
  site,
  query,
  header,
  footer,
  style,
}: {
  b: BrandReportBrand
  rank: number
  of: number
  site: BrandMatcherSite
  query: BrandMatcherQuery
  header: React.ReactNode
  footer: React.ReactNode
  style: React.CSSProperties
}) {
  const signals = signalSummaries(b, query)
  const sig = (k: SignalSummary['key']) => signals.find((s) => s.key === k) as SignalSummary
  const tone = (k: SignalSummary['key']) => REPORT_TONE[sig(k).status]
  const facts = b.tradingFacts
  const turnover = facts ? turnoverValue(facts) : null
  const meta = [
    subline(b, `UK ${plural(b.storeCount, 'store')}`),
    facts ? `${facts.companyName}${facts.status ? `, ${facts.status.toLowerCase()}` : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const req = liveRequirement(b)
  const typical = b.typicalRange
  const scale = sizeScale([query.sqft, typical?.max ?? 0, req?.max ?? req?.min ?? 0])
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale.max) * 100)).toFixed(2)}%`
  const span = (lo: number, hi: number) => ({
    left: pct(lo),
    width: `calc(${pct(hi)} - ${pct(lo)})`,
  })

  const evidence = acquisitiveEvidence(b)
  const nearest = b.nearest
  const nearRows = nearest
    ? (nearest.stores?.length
        ? nearest.stores
        : [
            {
              name: nearest.storeName,
              town: nearest.town,
              miles: nearest.miles,
            },
          ]
      ).slice(0, NEAREST_ROWS)
    : []
  const towns = b.storeTowns?.stores.slice(0, DEMOGRAPHIC_ROWS) ?? []

  return (
    <section className="page" style={style}>
      <div className="band">
        {header}
        <div className="bh">
          <Logo b={b} size={58} />
          <div className="bh-t">
            <div className="rk">
              #{rank} of {of}
            </div>
            <h2>{b.name}</h2>
            {meta && <div className="meta">{meta}</div>}
          </div>
          <Ring value={b.score} />
        </div>
        <div className="fs">
          {signals.map((s) => (
            <div key={s.key}>
              <div className="k">{SIGNAL_LABEL[s.key]}</div>
              <Sv tone={REPORT_TONE[s.status]}>{signalText(s)}</Sv>
            </div>
          ))}
          <div>
            <div className="k">Turnover</div>
            <span className={`sv${turnover && turnover !== 'Not disclosed' ? '' : ' none'}`}>
              {turnover ?? (facts ? 'Not published' : 'No record')}
            </span>
          </div>
        </div>
      </div>

      <div className="cols2">
        <div className="col">
          <div className="sec">
            <div className="sh">
              <h3>Size fit</h3>
              <Pill tone={tone('size')}>{signalText(sig('size'))}</Pill>
            </div>
            <p className="say">{sizeLine(b, query.sqft)}</p>
            <div className="chart">
              <div className="track">
                {typical && <div className="ty" style={span(typical.min, typical.max)} />}
                {req && <div className="rq" style={span(req.min ?? 0, req.max ?? scale.max)} />}
                <div className="me" style={{ left: pct(query.sqft) }} />
              </div>
              <div className="ax">
                {scale.ticks.map((t, i) => (
                  <span key={t}>
                    {t === 0 ? '0' : formatSqftShort(t)}
                    {i === scale.ticks.length - 1 && ' sq ft'}
                  </span>
                ))}
              </div>
              <div className="lgd">
                {typical && (
                  <span>
                    <i style={{ background: '#6A35F2' }} />
                    Typical store {formatSqftShort(typical.min)}–{formatSqftShort(typical.max)}
                  </span>
                )}
                {req && (
                  <span>
                    <i style={{ background: '#C6B4FF' }} />
                    Live requirement {sqftRange(req.min, req.max).replace(/ sq ft$/, '')}
                  </span>
                )}
              </div>
            </div>
            <div className="kv">
              <span className="k">Your site</span>
              <span className="v">{formatSqft(query.sqft)} sq ft</span>
              <span />
              <span className="k">Typical {b.name} store</span>
              <span className={typical ? 'v' : 'v mu'}>
                {typical ? sqftRange(typical.min, typical.max) : 'Not known'}
              </span>
              <span />
              {req && (
                <>
                  <span className="k">Live requirement</span>
                  <span className="v">{sqftRange(req.min, req.max)}</span>
                  <span className="d">{req.postedAt ? shortDate(req.postedAt) : ''}</span>
                </>
              )}
            </div>
          </div>

          <div className="sec">
            <div className="sh">
              <h3>Use class</h3>
              <Pill tone={tone('useClass')}>{signalText(sig('useClass'))}</Pill>
            </div>
            <p className="say">{useClassLine(b, query.useClass)}</p>
            <div className="kv">
              <span className="k">Your site</span>
              <span className="v">{classLabel(query.useClass)}</span>
              <span />
              <span className="k">{b.name} typical</span>
              <span className={b.useClass ? 'v' : 'v mu'}>
                {b.useClass ? b.useClass.codes.map(classLabel).join(', ') : 'Not stated'}
              </span>
              <span />
            </div>
          </div>

          <div className="sec">
            <div className="sh">
              <h3>Acquisitive</h3>
              <Pill tone={tone('acquisitive')}>{signalText(sig('acquisitive'))}</Pill>
            </div>
            <p className="say">{acquisitiveLine(b)}</p>
            {evidence.length > 0 && (
              <div className="kv">
                {evidence.map((r) => (
                  <Fragment key={r.label}>
                    <span className="k">{r.label}</span>
                    <span className={r.lines ? 'v w5' : 'v'}>
                      <span className={r.lines ? `clamp${r.lines}` : undefined}>{r.value}</span>
                    </span>
                    <span className="d">{r.date}</span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="sec">
            <div className="sh">
              <h3>Nearest store</h3>
              <Pill tone={tone('nearest')}>{signalText(sig('nearest'))}</Pill>
            </div>
            <p className="say">{nearestLine(b)}</p>
            {nearRows.length > 0 ? (
              <table className="lst">
                <tbody>
                  {nearRows.map((s, i) => (
                    <tr key={i} data-trim={i > 0 ? 10 + i : undefined}>
                      <td className="np">
                        <b>{s.name ?? `${b.name} store`}</b>
                        {s.town && <span className="mu"> · {s.town}</span>}
                      </td>
                      <td className="r" style={{ width: 54 }}>
                        <b>{formatMiles(s.miles)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No store locations on record.</div>
            )}
          </div>
        </div>

        <div className="col">
          <div className="sec">
            <div className="sh">
              <h3>Demographics</h3>
              <Pill tone={tone('demographics')}>{signalText(sig('demographics'))}</Pill>
            </div>
            <p className="say">{demographicsLine(b, site)}</p>
            {site.town && towns.length > 0 ? (
              <>
                <div className="site">
                  <span>
                    <b>Your site</b> · {site.town.name}
                  </span>
                  <span>
                    <b className="ink">{formatPeople(site.town.population)}</b> people ·{' '}
                    <b className="ink">{Math.round(site.town.affluence)}</b> affluence
                  </span>
                </div>
                <table className="lst">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th className="r" style={{ width: 48 }}>
                        People
                      </th>
                      <th className="r" style={{ width: 58 }}>
                        Affluence
                      </th>
                      <th className="r" style={{ width: 66 }}>
                        Match
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {towns.map((s, i) => (
                      <tr key={i} data-trim={i >= 3 ? i : undefined}>
                        <td className="np">
                          <b>{s.name ?? `${b.name} store`}</b>
                          <span className="mu"> · {formatMiles(s.miles)}</span>
                        </td>
                        <td className="r">
                          <b>{s.bua ? formatPeople(s.bua.population) : '—'}</b>
                        </td>
                        <td className="r">
                          <b>{s.bua ? Math.round(s.bua.affluence) : '—'}</b>
                        </td>
                        <td className={`r ${s.band ? MATCH[s.band].cls : 'mN'}`}>
                          {s.band ? MATCH[s.band].label : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="empty">No comparable store data.</div>
            )}
          </div>

          <div className="sec">
            <div className="sh">
              <h3>Financials</h3>
              <span className="src">Companies House, as filed</span>
            </div>
            {facts ? (
              <>
                <div className="kv" style={{ marginTop: 6 }}>
                  {financialRows(facts).map((r) => (
                    <Fragment key={r.label}>
                      <span className="k">{r.label}</span>
                      <span className={`v${r.tone === 'bad' ? ' bad' : r.tone === 'muted' ? ' mu' : ''}`}>
                        <span className="clamp2">{r.value}</span>
                      </span>
                      <span />
                    </Fragment>
                  ))}
                </div>
                <div className="fin-n">Unedited. Not a credit or covenant rating.</div>
              </>
            ) : (
              <div className="empty" style={{ marginTop: 8 }}>
                No Companies House record matched to {b.name}.
              </div>
            )}
          </div>
        </div>
      </div>
      {footer}
    </section>
  )
}

// Ported from the handoff's Brand Report.html. Scoped to .bmr so nothing leaks into the app.
function reportCss(pageSize: string): string {
  return `
@page{size:${pageSize};margin:0}
.bmr{display:flex;flex-direction:column;align-items:center;gap:24px;padding:24px 0 48px}
.bmr .page,.bmr .page *{box-sizing:border-box}
.bmr .page{position:relative;overflow:hidden;background:#fff;color:#171419;padding:0 52px 28px;display:flex;flex-direction:column;font-size:12px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:"tnum" 1,"cv11" 1;box-shadow:0 10px 40px -18px rgba(20,10,40,.35)}
.bmr h1,.bmr h2,.bmr h3,.bmr p{margin:0}
.bmr .rh{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:10.5px;color:#7C7588;padding:26px 0 0}
.bmr .rh .lg-s{display:flex;align-items:center;gap:6px;color:#7033FF;font-weight:600;font-size:11.5px;letter-spacing:-.1px;flex-shrink:0}
.bmr .rh .crumb{display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden}
.bmr .rh .crumb i{width:3px;height:3px;border-radius:9px;background:#C9C3D3;flex-shrink:0}
.bmr .ft{gap:16px;margin-top:auto;padding-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9A94A4;letter-spacing:.2px}
.bmr .ft>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.bmr .ft b,.bmr .ft .pn{font-weight:600;color:#4A4451}
.bmr .ic{width:14px;height:14px;border-radius:999px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;line-height:1}
.bmr .ic.ok{background:#DDF2E4;color:#24734A}.bmr .ic.warn{background:#FCEBC7;color:#9A6A12}.bmr .ic.bad{background:#FBDCDC;color:#B42323}.bmr .ic.none{background:#ECEAF0;color:#9A94A4}
.bmr .sv{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.bmr .sv.none{color:#9A94A4}.bmr .sv.bad{color:#B42323}
.bmr .pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:3px 8px 3px 4px;border-radius:999px;white-space:nowrap;max-width:60%;overflow:hidden;text-overflow:ellipsis}
.bmr .pill.ok{background:#EDF8F1;color:#24734A}.bmr .pill.warn{background:#FDF4E1;color:#8A5D0B}.bmr .pill.bad{background:#FDECEC;color:#B42323}.bmr .pill.none{background:#F3F1F6;color:#7C7588}
.bmr .pill .ic{background:#fff}
.bmr .cover{padding:0}
.bmr .cv-top{padding:44px 56px 0;display:flex;justify-content:space-between;align-items:center}
.bmr .cv-logo{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:500;color:#7033FF;letter-spacing:-.3px}
.bmr .cv-date{font-size:11.5px;color:#7C7588}
.bmr .cv-mid{padding:0 56px;flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;min-height:0}
.bmr .kick{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#7033FF}
.bmr .cv-mid h1{font-size:56px;line-height:1;letter-spacing:-2.2px;font-weight:700;text-wrap:balance;max-width:640px;overflow-wrap:anywhere}
.bmr .cv-mid h1 em{font-style:normal;color:#7033FF}
.bmr .cv-sub{font-size:15px;line-height:1.5;color:#4A4451;max-width:520px;text-wrap:pretty}
.bmr .cv-note{max-width:540px;margin-top:6px}
.bmr .cv-note .l{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7C7588;margin-bottom:6px}
.bmr .cv-note p{font-size:15px;line-height:1.5;color:#171419;text-wrap:pretty;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.bmr .cv-top3{padding:0 56px 30px}
.bmr .cv-top3 .h{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#7C7588;margin-bottom:10px;display:flex;justify-content:space-between}
.bmr .cv-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.bmr .cv-card{border:1px solid #ECEAF0;border-radius:14px;padding:14px;display:flex;align-items:center;gap:12px;min-width:0}
.bmr .cv-card-t{min-width:0}
.bmr .cv-card b{display:block;font-size:13.5px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .cv-card-t span{display:block;font-size:10.5px;color:#7C7588;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .cv-card .s{margin-left:auto;font-size:22px;font-weight:700;color:#5421CC;letter-spacing:-.6px}
.bmr .cv-more{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.bmr .cv-band{background:#2A1170;color:#fff;padding:30px 56px 36px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px 20px;position:relative;overflow:hidden}
.bmr .cv-band::after{content:"";position:absolute;right:-90px;top:-90px;width:260px;height:260px;border-radius:999px;border:46px solid rgba(169,139,255,.12)}
.bmr .cv-band .k{font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#B9A6FF}
.bmr .cv-band .v{font-size:15px;font-weight:600;margin-top:6px;line-height:1.3;overflow-wrap:anywhere}
.bmr .cv-band .v small{display:block;font-size:12px;font-weight:400;color:#DCD2FF;margin-top:2px}
.bmr .cv-band .wide{grid-column:span 2;position:relative;z-index:1}
.bmr .cv-band hr{grid-column:1/-1;border:none;border-top:1px solid rgba(255,255,255,.14);margin:0}
.bmr .band{margin:0 -52px;padding:0 52px 18px;background:#F7F5FC;border-bottom:1px solid #ECE8F6}
.bmr .ttl{margin-top:26px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.bmr h2{font-size:26px;letter-spacing:-.7px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr h2 .of{color:#9A94A4;font-weight:500}
.bmr .lead{margin-top:6px;color:#4A4451;font-size:12.5px;max-width:520px;text-wrap:pretty}
.bmr .tb{width:100%;border-collapse:collapse;font-size:11px;margin-top:18px;table-layout:fixed}
.bmr .tb th{text-align:left;font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#7C7588;padding:0 4px 8px;border-bottom:1px solid #171419;white-space:nowrap}
.bmr .tb td{padding:5px 4px;border-bottom:1px solid #EFEDF2;vertical-align:middle;height:38px;overflow:hidden}
.bmr .tb .r{text-align:right}
.bmr .tb .num{color:#9A94A4;padding-left:0;font-size:10.5px}
.bmr .tb .bnm{display:flex;align-items:center;gap:9px;min-width:0}
.bmr .tb .bnm>div{min-width:0;overflow:hidden}
.bmr .tb .bnm b{font-weight:600;font-size:12px;display:block;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .tb .bnm>div span{font-size:10px;color:#7C7588;display:block;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .tb .fit{text-align:right;padding-right:0;white-space:nowrap}
.bmr .fitc{display:inline-flex;align-items:center;gap:6px}
.bmr .fitc i{display:block;width:22px;height:4px;border-radius:9px;background:#ECE6FF;overflow:hidden}
.bmr .fitc i u{display:block;height:100%;background:#7033FF;border-radius:9px}
.bmr .fitc b{font-weight:700;font-size:14px;color:#5421CC;min-width:24px;text-align:right}
.bmr .key{display:flex;gap:16px;margin-top:14px;font-size:10.5px;color:#4A4451;flex-wrap:wrap}
.bmr .disc{margin-top:10px;font-size:10px;color:#7C7588;max-width:620px;line-height:1.5}
.bmr .bh{display:flex;align-items:center;gap:16px;margin-top:18px}
.bmr .bh-t{min-width:0;flex:1}
.bmr .bh .rk{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#7033FF;margin-bottom:4px}
.bmr .bh .meta{font-size:12px;color:#7C7588;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .score{margin-left:auto;position:relative;width:76px;height:76px;flex-shrink:0}
.bmr .score svg{position:absolute;inset:0}
.bmr .score div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.bmr .score b{font-size:24px;font-weight:700;color:#2A1170;letter-spacing:-.8px}
.bmr .score span{font-size:9px;color:#7C7588;margin-top:3px;font-weight:500}
.bmr .fs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:14px}
.bmr .fs>div{background:#fff;border:1px solid #ECE8F6;border-radius:10px;padding:9px 10px;min-width:0}
.bmr .fs .k{font-size:8.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#7C7588;margin-bottom:5px;white-space:nowrap}
.bmr .fs .sv{font-size:12px;font-weight:600}
.bmr .cols2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:30px;margin-top:18px;flex:1;min-height:0;overflow:hidden}
.bmr .col{display:flex;flex-direction:column;gap:14px;min-width:0}
.bmr .sh{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:6px;border-bottom:1px solid #171419}
.bmr .sh h3{font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#171419;white-space:nowrap}
.bmr .sh .src{font-size:10px;color:#7C7588}
.bmr .say{margin:6px 0;color:#2E2934;font-size:11.5px;line-height:1.5;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.bmr .clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bmr .clamp1{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.bmr .kv{display:grid;grid-template-columns:fit-content(48%) minmax(0,1fr) auto}
.bmr .kv>*{padding:4px 14px 4px 0;border-top:1px solid #EFEDF2}
.bmr .kv>*:nth-child(3n){padding-right:0}
.bmr .kv>*:nth-child(-n+3){border-top:none}
.bmr .kv .k{color:#7C7588;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .kv .v{font-weight:600;min-width:0;overflow-wrap:anywhere}
.bmr .kv .v.w5{font-weight:500}
.bmr .kv .v.mu{color:#9A94A4;font-weight:500}
.bmr .kv .v.bad{color:#B42323}
.bmr .kv .d{color:#9A94A4;text-align:right;font-size:10.5px;white-space:nowrap}
.bmr .chart{margin:2px 0 8px;padding:12px 12px 9px;background:#FAF9FC;border-radius:10px}
.bmr .track{position:relative;height:8px;border-radius:9px;background:#E9E6EF;margin-top:16px}
.bmr .track .ty{position:absolute;top:0;bottom:0;background:#6A35F2;border-radius:9px}
.bmr .track .rq{position:absolute;top:2px;bottom:2px;background:#C6B4FF;border-radius:9px}
.bmr .track .me{position:absolute;top:-6px;width:2px;height:20px;margin-left:-1px;background:#171419;border-radius:2px}
.bmr .track .me::after{content:"Your site";position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:600;white-space:nowrap;color:#171419}
.bmr .ax{display:flex;justify-content:space-between;font-size:9.5px;color:#9A94A4;margin-top:7px}
.bmr .lgd{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:#4A4451;margin-top:6px}
.bmr .lgd i{display:inline-block;width:10px;height:5px;border-radius:9px;margin-right:5px;vertical-align:middle}
.bmr .lst{width:100%;border-collapse:collapse;font-size:11.5px;table-layout:fixed}
.bmr .lst th{text-align:left;font-size:8.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#7C7588;padding:0 0 5px}
.bmr .lst td{padding:4px 0;border-top:1px solid #EFEDF2;vertical-align:top}
.bmr .lst .r{text-align:right;padding-left:8px;white-space:nowrap}
.bmr .lst b{font-weight:600}
.bmr .lst .np{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bmr .mu{color:#7C7588}
.bmr .mC{color:#24734A;font-weight:600}.bmr .mP{color:#9A6A12;font-weight:600}.bmr .mN{color:#9A94A4;font-weight:600}
.bmr .site{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#F7F5FC;border-radius:8px;padding:7px 10px;margin-bottom:8px;font-size:11px;white-space:nowrap}
.bmr .site b{color:#5421CC}.bmr .site b.ink{color:#171419}
.bmr .empty{color:#9A94A4;font-size:11.5px;padding:12px;background:#FAF9FC;border-radius:8px}
.bmr .fin-n{font-size:9.5px;color:#9A94A4;margin-top:6px;line-height:1.4}
@media print{
  html,body{background:#fff!important;height:auto!important;overflow:visible!important}
  .bmr{display:block;padding:0;gap:0}
  .bmr .page{box-shadow:none;break-after:page;page-break-after:always}
  .bmr .page:last-child{break-after:auto;page-break-after:auto}
}`
}
