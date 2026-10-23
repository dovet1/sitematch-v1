/**
 * Scotland's Census 2022 (National Records of Scotland) mapped onto the England and Wales
 * Census 2021 components in lsoa_metrics.
 *
 * Scotland is published on 2022 data zones (S01013482..S01020873, ~7,400 of them, ~700 people
 * each). They stand in for LSOAs: same table, same component ids, edition '2022'. Every
 * downstream sum (site demographics, town and catchment signals, brand profiles) then works
 * across Great Britain without knowing which census a row came from.
 *
 * Input: the "2022 data zone area data" bulk download (Datazone2022.zip) from
 * https://www.scotlandscensus.gov.uk/documents/2022-data-zone-area-data, unzipped. File names are
 * "Table UVxxx - <title>.csv". Each file is long format with no header:
 *   "S01013482","<category>"[,"<category>"...],<value>
 * after a few preamble lines, and a footer. "-" means zero or suppressed.
 *
 * Mappings that are not one-to-one are listed in SCOTLAND_MAPPING_NOTES and in the PR.
 */

import fs from 'node:fs'
import path from 'node:path'

export const SCOTLAND_EDITION = '2022'

export type MetricRow = {
  geo_code: string
  geo_name: string
  component_id: string
  ts_code: string
  value_pct: number | null
  numerator: number
  denominator: number | null
}

// Values per data zone, keyed by the table's category columns joined with ' | '.
type Table = Map<string, Map<string, number>>

// Splits one CSV line. Quoted cells may hold commas; NRS files never escape quotes inside them.
function parseLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1)
      out.push(line.slice(i + 1, end))
      i = end + 2
    } else {
      const end = line.indexOf(',', i)
      out.push(line.slice(i, end === -1 ? undefined : end))
      i = end === -1 ? line.length : end + 1
    }
  }
  return out
}

export function readTable(file: string): Table {
  const table: Table = new Map()
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('"S01')) continue
    const cells = parseLine(line)
    const code = cells[0]
    const value = cells[cells.length - 1].trim()
    const key = cells
      .slice(1, -1)
      .map((c) => c.replace(/^\t+/, '').trim())
      .join(' | ')
    let row = table.get(code)
    if (!row) table.set(code, (row = new Map()))
    row.set(key, value === '-' || value === '' ? 0 : Number(value))
  }
  return table
}

export function findTableFile(dir: string, uv: string): string {
  // "Table UV102b - Age (20) by sex.csv" as downloaded, or a trimmed copy named "UV102b....csv".
  const name = fs
    .readdirSync(dir)
    .find((f) => f.endsWith('.csv') && (f.startsWith(`Table ${uv} - `) || f.startsWith(`${uv}.`) || f.startsWith(`${uv}_`)))
  if (!name) throw new Error(`Table ${uv} not found in ${dir}`)
  return path.join(dir, name)
}

// component_id -> categories summed for the numerator. The denominator is the table total.
type Spec = {
  uv: string
  ts_code: string
  total: string
  components: Record<string, string[]>
}

const AGE_BANDS: Record<string, string[]> = {
  age_5_9: ['5 - 9'],
  age_10_14: ['10 - 14'],
  age_15_19: ['15', '16 - 17', '18 - 19'],
  age_20_24: ['20 - 24'],
  age_25_29: ['25 - 29'],
  age_30_34: ['30 - 34'],
  age_35_39: ['35 - 39'],
  age_40_44: ['40 - 44'],
  age_45_49: ['45 - 49'],
  age_50_54: ['50 - 54'],
  age_55_59: ['55 - 59'],
  age_60_64: ['60 - 64'],
  age_65_69: ['65 - 69'],
  age_70_74: ['70 - 74'],
  age_75_79: ['75 - 79'],
  age_80_84: ['80 - 84'],
}

export const SCOTLAND_SPECS: Spec[] = [
  {
    uv: 'UV102b',
    ts_code: 'TS007A',
    total: 'All people | All people',
    components: Object.fromEntries(
      Object.entries(AGE_BANDS).map(([id, bands]) => [id, bands.map((b) => `${b} | All people`)])
    ),
  },
  {
    uv: 'UV102b',
    ts_code: 'TS008',
    total: 'All people | All people',
    components: {
      sex_female: ['All people | Female'],
      sex_male: ['All people | Male'],
    },
  },
  {
    uv: 'UV113',
    ts_code: 'TS003',
    total: 'All households',
    components: {
      hhc_total_all_households: ['All households'],
      hhc_one_person_household: ['One person household: Total'],
      hhc_single_family_household: ['One family household: Total'],
      hhc_other_household_types: ['Other household types: Total'],
    },
  },
  {
    uv: 'UV204b',
    ts_code: 'TS004',
    total: 'All people | Total | All people',
    components: {
      cob_europe_united_kingdom: ['All people | Total | Europe: United Kingdom: Total'],
      // Europe outside the UK, with the Channel Islands and Isle of Man (E&W counts those as UK).
      cob_europe_non_uk: [
        'All people | Total | Europe: Channel Islands and Isle of Man',
        'All people | Total | Europe: Other Europe: EU Countries: Republic of Ireland',
        'All people | Total | Europe: Other Europe: EU Countries: Other member countries in March 2022',
        'All people | Total | Europe: Other Europe: EU Countries: Other EU accession countries March 2022',
        'All people | Total | Europe: Other Europe: Non-EU countries',
      ],
      cob_africa: ['All people | Total | Africa'],
      cob_middle_east_and_asia: ['All people | Total | Middle East and Asia'],
      cob_the_americas_and_the_caribbean: ['All people | Total | The Americas and the Caribbean'],
      cob_antarctica_and_oceania_including_australasia_and_other: [
        'All people | Total | Antartica and Oceania and Other',
      ],
    },
  },
  {
    uv: 'UV201',
    ts_code: 'TS021',
    total: 'All People',
    components: {
      white: ['White: Total'],
      mixed_or_multiple_ethnic_groups: ['Mixed or multiple ethnic group'],
      asian_asian_british_or_asian_welsh: ['Asian, Asian Scottish or Asian British: Total'],
      black_black_british_black_welsh_caribbean_or_african: ['African: Total', 'Caribbean or Black: Total'],
      other_ethnic_group: ['Other ethnic groups: Total'],
    },
  },
  {
    uv: 'UV205',
    ts_code: 'TS030',
    total: 'All people',
    components: {
      no_religion: ['No religion'],
      christian: ['Church of Scotland', 'Roman Catholic', 'Other Christian'],
      buddhist: ['Buddhist'],
      hindu: ['Hindu'],
      jewish: ['Jewish'],
      muslim: ['Muslim'],
      sikh: ['Sikh'],
      other_religion: ['Other religion', 'Pagan'],
      not_answered: ['Religion not stated'],
    },
  },
  {
    uv: 'UV302',
    ts_code: 'TS037',
    total: 'All people',
    components: {
      very_good_health: ['Very good'],
      good_health: ['Good'],
      fair_health: ['Fair'],
      bad_health: ['Bad'],
      very_bad_health: ['Very bad'],
    },
  },
  {
    uv: 'UV303',
    ts_code: 'TS038',
    total: 'All people',
    components: {
      disabled_rate: ['Day-to-day activities limited a lot', 'Day-to-day activities limited a little'],
    },
  },
  {
    uv: 'UV402',
    ts_code: 'TS044',
    total: 'All occupied households',
    components: {
      accom_detached: ['Whole house or bungalow: Detached'],
      accom_semi_detached: ['Whole house or bungalow: Semi-detached'],
      accom_terraced: ['Whole house or bungalow: Terraced (including end-terrace)'],
      accom_converted_house: [
        'Flat, maisonette or apartment: Part of a converted or shared house (including bed-sits)',
      ],
      accom_commercial_building: ['Flat, maisonette or apartment: In a commercial building'],
      accom_caravan_temp: ['Caravan or other mobile or temporary structure'],
      // accom_converted_other: Scotland does not separate flats in other converted buildings.
    },
  },
  {
    uv: 'UV404',
    ts_code: 'TS054',
    total: 'All occupied households',
    components: {
      owned: ['Owned: Total'],
      owns_with_mortgage_or_loan_or_shared_ownership: [
        'Owned: Owned with a mortgage or loan',
        'Owned: Shared ownership (part owned and part rented)',
        'Owned: Shared Equity (e.g. LIFT or Help-to-Buy)',
      ],
      shared_ownership: ['Owned: Shared ownership (part owned and part rented)'],
      social_rented: [
        'Social Rented: Council (LA) or Housing Association/ Registered Social Landlord',
      ],
      private_rented: ['Private rented: Total'],
      lives_rent_free: ['Lives Rent Free'],
      private_rented_or_lives_rent_free: ['Private rented: Total', 'Lives Rent Free'],
    },
  },
  {
    uv: 'UV703',
    ts_code: 'TS058',
    total:
      'All people aged 16 and over in employment the week before the census (including full-time students if they gave a work address as the address they primarily travel to for work or study)',
    components: {
      ts058_works_mainly_from_home: ['Mainly work from home'],
      ts058_less_than_2km: ['Less than 2km'],
      ts058_2km_to_less_than_5km: ['2km to less than 5km'],
      ts058_5km_to_less_than_10km: ['5km to less than 10km'],
      ts058_10km_to_less_than_20km: ['10km to less than 20km'],
      ts058_20km_to_less_than_30km: ['20km to less than 30km'],
      ts058_30km_to_less_than_40km: ['30km to less than 40km'],
      ts058_40km_to_less_than_60km: ['40km to less than 60km'],
      ts058_60km_and_over: ['60km and over'],
      ts058_works_mainly_at_an_offshore_installation_in_no_fixed_place_or_outside_the_uk: [
        'Other - No fixed place of work or working outside the UK',
      ],
    },
  },
  {
    uv: 'UV701',
    ts_code: 'TS061',
    total:
      'All people aged 16 and over in employment the week before the census (including full-time students if they gave a work address as the address they primarily travel to for work or study)',
    components: {
      work_mainly_at_or_from_home: ['Work mainly at or from home'],
      underground_metro_light_rail_tram: ['Underground, subway or tram'],
      train: ['Train'],
      bus_minibus_or_coach: ['Bus, minibus or coach'],
      taxi: ['Taxi or private hire'],
      motorcycle_scooter_or_moped: ['Motorcycle, scooter or moped'],
      driving_a_car_or_van: ['Driving a car or van'],
      passenger_in_a_car_or_van: ['Passenger in a car or van'],
      bicycle: ['Bicycle'],
      on_foot: ['On foot'],
      other_method_of_travel_to_work: ['Other'],
    },
  },
  {
    uv: 'UV606',
    ts_code: 'TS063',
    total: 'All people aged 16 and over in employment the week before the census',
    components: {
      managers_directors_and_senior_officials: ['Managers, Directors and Senior Officials - Total'],
      professional_occupations: ['Professional Occupations - Total'],
      associate_professional_and_technical_occupations: [
        'Associate Professional and Technical Occupations - Total',
      ],
      administrative_and_secretarial_occupations: ['Administrative and Secretarial Occupations - Total'],
      skilled_trades_occupations: ['Skilled Trade Occupations - Total'],
      caring_leisure_and_other_service_occupations: [
        'Caring, Leisure and Other Service Occupations - Total',
      ],
      sales_and_customer_service_occupations: ['Sales and Customer Service Occupations - Total'],
      process_plant_and_machine_operatives: ['Process, Plant and Machine Operatives - Total'],
      elementary_occupations: ['Elementary Occupations - Total'],
    },
  },
  {
    uv: 'UV601',
    ts_code: 'TS066',
    total: 'All people aged 16 and over',
    components: {
      economically_active_excluding_full_time_students: [
        'Economically Active (excluding full-time students) - Total',
      ],
      economically_active_and_a_full_time_student: ['Economically Active full-time students - Total'],
      economically_inactive: ['Economically Inactive - Total'],
    },
  },
  {
    uv: 'UV501',
    ts_code: 'TS067',
    total: 'All people aged 16 and over',
    components: {
      no_qualifications: ['No qualifications'],
      // Standard Grade / National 4-5 / Intermediate: GCSE level, covering E&W levels 1 and 2.
      level_2_qualifications: ['Lower school qualifications'],
      // Highers plus college (HNC/HND, SVQ 3). HNC/HNDs would be level 4 in E&W, but counting them
      // there lifts Scotland's level 4+ to ~46% against 34% in E&W; degree-only matches like for like.
      level_3_qualifications: [
        'Upper school qualifications',
        'Further Education and sub-degree Higher Education qualifications incl. HNC/HNDs',
      ],
      apprenticeship: ['Apprenticeship qualifications'],
      level_4_qualifications_and_above: ['Degree level qualifications or above'],
    },
  },
]

export const SCOTLAND_MAPPING_NOTES = [
  'Data zones (2022) stand in for LSOAs: ~700 residents each against ~1,700 for an LSOA.',
  'TS004: Channel Islands and Isle of Man births are counted as Europe outside the UK; there is no British Overseas category, so cob_british_overseas is absent.',
  'TS021: African and Caribbean or Black are separate groups in Scotland; they are added together for the E&W Black group.',
  'TS030: Church of Scotland, Roman Catholic and Other Christian are added together as Christian; Pagan goes into Other religion.',
  'TS038: Scotland asks whether day-to-day activities are limited by a long-term condition; E&W counts people disabled under the Equality Act. Limited a lot plus limited a little is used for both.',
  'TS044: accom_converted_other has no Scottish equivalent and is left out. Scottish tenements are purpose-built flats, which E&W does not report, so converted-house shares (and the urbanity index that uses them) run lower in Scottish cities.',
  'TS054: Shared equity (Help to Buy, LIFT) is counted with mortgages, as E&W does implicitly.',
  'TS067: Scottish qualification levels do not line up with E&W levels: degree or above is used for level 4+, Highers plus college (HNC/HND) for level 3, lower school for level 2, and level 1 and other qualifications are absent.',
  'Age 0-4 and 85+ are not loaded for either nation, matching the existing E&W rows.',
]

function sum(row: Map<string, number>, keys: string[], uv: string, code: string): number {
  let total = 0
  for (const key of keys) {
    const v = row.get(key)
    if (v === undefined) throw new Error(`${uv}: category "${key}" missing for ${code}`)
    total += v
  }
  return total
}

export function buildScotlandMetrics(dir: string, names: Map<string, string>): MetricRow[] {
  const tables = new Map<string, Table>()
  const tableFor = (uv: string) => {
    let t = tables.get(uv)
    if (!t) tables.set(uv, (t = readTable(findTableFile(dir, uv))))
    return t
  }

  const rows: MetricRow[] = []
  const population = tableFor('UV102b')
  for (const [code, row] of population) {
    rows.push({
      geo_code: code,
      geo_name: names.get(code) ?? code,
      component_id: 'population_total',
      ts_code: 'TS001',
      value_pct: null,
      numerator: sum(row, ['All people | All people'], 'UV102b', code),
      denominator: null,
    })
  }

  for (const spec of SCOTLAND_SPECS) {
    const table = tableFor(spec.uv)
    for (const [code, row] of table) {
      const denominator = sum(row, [spec.total], spec.uv, code)
      for (const [component_id, keys] of Object.entries(spec.components)) {
        const numerator = sum(row, keys, spec.uv, code)
        rows.push({
          geo_code: code,
          geo_name: names.get(code) ?? code,
          component_id,
          ts_code: spec.ts_code,
          value_pct: denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null,
          numerator,
          denominator,
        })
      }
    }
  }
  return rows
}

export function readDataZoneNames(lookupCsv: string): Map<string, string> {
  const names = new Map<string, string>()
  const [header, ...lines] = fs.readFileSync(lookupCsv, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
  const cols = parseLine(header)
  const codeIx = cols.indexOf('DZ22_Code')
  const nameIx = cols.indexOf('DZ22_Name')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells = parseLine(line)
    names.set(cells[codeIx], cells[nameIx])
  }
  return names
}
