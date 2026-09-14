import type { CommercialWork } from './types'

/**
 * Reads commercial work from a description alone, for records that arrive without Plota's
 * derived `commercial_work`.
 *
 * Plota derives that field only on live records. Its archive (applications received before
 * 2026) carries description, procedure and a dwelling count, and nothing else commercial: on
 * 15 October 2025, 0 of 2,416 stored applications had it. So the eligibility filter's commercial
 * limbs could never admit an archive application: not the September to December 2025 backfill,
 * and not a parent permission recovered through Plota's family endpoint, such as Broadland's
 * 2024 warehouse club.
 *
 * Only the work that decides eligibility is read: new commercial space, a change of use into or
 * between commercial uses, and a loss of commercial use. Extensions and minor works (shopfronts,
 * signs, plant) are left to the classifier, as they are for live records.
 *
 * This is a recall gate for classification, like the uncounted-housing limb, not a verdict on
 * the scheme. It is calibrated against live records where Plota's field is known, and what it
 * catches and misses beyond that agreement is read, not assumed.
 */

// Uses Plota treats as commercial: retail, food and drink, offices, hotels and short-term
// letting, leisure, health and personal services, industry, storage and sui generis businesses.
const COMMERCIAL_USE = new RegExp([
  String.raw`shops?(?!\s*fronts?)`, String.raw`retail\w*`, String.raw`supermarkets?`, String.raw`foodstores?`,
  String.raw`convenience\s+stores?`, String.raw`showrooms?`, String.raw`trade\s+counters?`,
  String.raw`offices?`, String.raw`restaurants?`, String.raw`caf[eé]s?`, String.raw`coffee\s+shops?`,
  String.raw`tea\s*rooms?`, String.raw`bistros?`, String.raw`take[\s-]*aways?`, String.raw`hot\s+food`,
  String.raw`drive[\s-]*thr(?:u|ough)`, String.raw`public\s+houses?`, String.raw`pubs?`,
  String.raw`(?:wine|cocktail|coffee|sports)\s+bars?`, String.raw`micro[\s-]*pubs?`, String.raw`night\s*clubs?`,
  String.raw`hotels?`, String.raw`apart[\s-]*hotels?`, String.raw`guest\s*houses?`,
  String.raw`bed\s+and\s+breakfast`, String.raw`b\s*&\s*b`,
  String.raw`holiday[\s-]+(?:lets?|letting|lodges?|cottages?|accommodation|units?|parks?|homes?|chalets?|cabins?|pitches|flats?)`,
  String.raw`tourism`, String.raw`general\s+industr\w*`, String.raw`sale\s+of`, String.raw`(?:car\s+)?dealerships?`,
  String.raw`leisure\s+centres?`, String.raw`food\s*(?:&|and)\s*beverage`, String.raw`golf\s+simulator\w*`, String.raw`dog\s+training`,
  String.raw`testing\s+centres?`, String.raw`padel\w*`, String.raw`crematori(?:um|a)`,
  String.raw`short[\s-]*(?:term|stay|let)(?:\s+(?:holiday\s+)?(?:lets?|letting|visitor|holiday|residential\s+accommodation|accommodation))?`,
  String.raw`camping`, String.raw`(?:commercial\s+(?:equestrian|equine)|equestrian\s+(?:centres?|business))`, String.raw`dog\s+(?:walking|exercise|training)\s+(?:fields?|areas?)`,
  String.raw`serviced\s+(?:apartments?|accommodation)`, String.raw`glamping`,
  String.raw`camp\s*sites?`, String.raw`caravan\s+(?:parks?|sites?)`, String.raw`touring\s+(?:caravans?|pitches)`, String.raw`(?:holiday|glamping)\s+shepherd'?s\s+huts?`,
  String.raw`tourist\s+accommodation`, String.raw`visitor\s+accommodation`,
  String.raw`gym(?:nasium)?s?`, String.raw`fitness`, String.raw`leisure`, String.raw`padel`, String.raw`soft\s+play`,
  String.raw`trampoline`, String.raw`bowling`, String.raw`cinemas?`, String.raw`climbing`,
  String.raw`day\s+nurser(?:y|ies)`, String.raw`children'?s\s+nurser(?:y|ies)`, String.raw`creche`,
  String.raw`clinics?`, String.raw`dental`, String.raw`dentists?`, String.raw`medical\s+(?:centres?|practices?)`,
  String.raw`healthcare`, String.raw`(?:pilates|yoga|dance|fitness|music|tattoo)\s+studios?`, String.raw`bookmakers?`,
  String.raw`bakery|bakeries`, String.raw`(?:repair|mot)\s+garages?`, String.raw`d2`, String.raw`class\s+11`,
  String.raw`(?<!grab\s|security\s|window\s|metal\s|steel\s)bars?(?!\s+(?:on|to|across)\b)`, String.raw`drinking\s+establishments?`,
  String.raw`(?:wedding|events?|entertainment|performance|music)(?:\s+and\s+events?)?\s+(?:venues?|spaces?|suites?)`,
  String.raw`banqueting`, String.raw`escape\s+rooms?`, String.raw`gaming\s+lounges?`, String.raw`builders'?\s+merchants?`,
  String.raw`(?:car|vehicle)\s+(?:servicing|repairs?|valeting)`, String.raw`mot(?:\s+test\w*)?`, String.raw`opticians?`,
  String.raw`art\s+studios?`, String.raw`production\s+studios?`, String.raw`nurser(?:y|ies)`, String.raw`wellness`,
  String.raw`sales\s+offices?`, String.raw`tyre\s+(?:fitt\w*|retail\w*)`,
  String.raw`health\s+centres?`, String.raw`physiotherapy`, String.raw`veterinary`,
  String.raw`(?:hair|beauty|nail)\s+salons?`, String.raw`salons?`, String.raw`barbers?`, String.raw`hairdress\w*`,
  String.raw`tattoo\w*`, String.raw`launderettes?`, String.raw`dry\s+clean\w*`,
  String.raw`car\s+wash\w*`, String.raw`jet\s+wash\w*`, String.raw`valeting`, String.raw`petrol\s+(?:filling\s+)?stations?`,
  String.raw`vehicle\s+(?:repairs?|sales|hire)`, String.raw`car\s+sales`, String.raw`motor\s+(?:repairs?|trade)`,
  String.raw`workshops?`, String.raw`warehous\w*`, String.raw`industrial`, String.raw`factor(?:y|ies)`,
  String.raw`manufactur\w*`, String.raw`storage\s+(?:and|&)\s+distribution`, String.raw`self[\s-]*storage`,
  String.raw`open\s+storage`, String.raw`storage\s+use`, String.raw`distribution`, String.raw`business(?:es)?`,
  String.raw`commercial`, String.raw`employment`, String.raw`brewer(?:y|ies)`, String.raw`distiller(?:y|ies)`,
  String.raw`kennels`, String.raw`catter(?:y|ies)`, String.raw`dog\s+(?:day\s*care|grooming|boarding)`,
  String.raw`livery`, String.raw`riding\s+school`, String.raw`events?\s+(?:space|venues?)`,
  String.raw`wedding\s+venues?`, String.raw`function\s+rooms?`, String.raw`conference`, String.raw`data\s+centres?`,
  String.raw`film[\s-]*making`, String.raw`(?:artist'?s?|photography|recording|dance)\s+studios?`,
  String.raw`banks?`, String.raw`betting\s+shops?`, String.raw`amusement`, String.raw`adult\s+gaming`,
  String.raw`scrap\s*yards?`, String.raw`garden\s+centres?`, String.raw`farm\s+shops?`,
  // Use classes: England E, the old A and B classes, C1 hotels; Scotland 1A, 3 to 7.
  String.raw`(?:use\s+)?class\s+e(?:\s*\(\s*[a-g](?:\s*\)|\s*[)i]{0,4}\)?)?)?`, String.raw`e\s*\(\s*[a-g]\s*\)`,
  String.raw`a[1-5]`, String.raw`b[128]`, String.raw`b1\s*\(\s*[a-c]\s*\)`, String.raw`c1`,
  String.raw`class\s+(?:1a?|3|4|5|6|7)`,
].map(term => `\\b${term}\\b`).join('|'), 'i')

// Commercial words that describe a household's own use, not a business.
// A clause about a household's own outbuilding, garage or annexe is not a business, whatever
// rooms it names ("garage with home office/gym", "store/gym and home working space incidental to
// the main dwelling house").
const HOUSEHOLD_CONTEXT = /\b(?:incidental|ancillary)\s+(?:to|use)\b[^.;]{0,40}\b(?:dwelling|house|residential|property|home)|\bgarage\s+conversion|\bconver\w*\s+(?:of\s+)?(?:the\s+|an?\s+)?(?:existing\s+)?(?:\w+\s+)?garages?\s+(?:to|into)\b|\bgarage\s*\/\s*storage|\b(?:granny\s+annexe|habitable|host\s+property|used\s+solely|family\s+members|domestic\s+(?:workspace|use|storage)|personal\s+gym|private\s+(?:gym|padel|tennis|entertainment|use|garden))\b|\bhouseholder\b|\bhome\s+(?:office|gym|working|studio|business)|\bgarden\s+(?:building|room|office|studio|outbuilding)|\bgarage\s*\/\s*(?:office|workshop|gym)|\boutbuildings?\b[^.;]{0,60}\b(?:gym|games|playroom|home|garden|incidental|domestic)\b|\brear\s+garden\b|\b(?:cinema|play|hobby)\s*room\b|\bstudy\b|\b(?:garage|car\s*port)\b[^.;]{0,60}\b(?:gym\w*|games\s+room|office|store|workshop)\b|\boutbuilding\b[^.;]{0,40}\b(?:associated\s+with|ancillary)\b|\b(?:managers?|staff|workers?|wardens?)'?\s+(?:accommodation|dwelling)|\bancillary\s+(?:residential\s+|resident\s+)?amenit\w+/i
// Sites that are homes for their occupants, not visitor or business sites.
// A garage becoming an office, gym or store is a household change, unless it becomes a motor trade.
const HOUSEHOLD_GARAGE = /\bgarages?\b/i
const MOTOR_TRADE = /\b(?:motor|vehicle|repairs?|mot|car\s+sales|tyres?)\b/i
const RESIDENTIAL_SITE = /\b(?:gypsy|gypsies|travellers?|travelling\s+show\w*|residential)\b[^.;]{0,40}\b(?:caravans?|pitches|sites?|mobile\s+homes?)\b|\bmobile\s+homes?\b/i
// Applications that confirm or restate what already exists add no new commercial activity.
// EIA screening and scoping opinions are kept: Plota counts them, and they announce large schemes.
const EXISTING_ONLY = /\b(?:existing\s+use|continued\s+use|continuation\s+of\s+(?:the\s+)?(?:existing\s+)?use|lawfulness\s+(?:of|for)\s+(?:the\s+|an?\s+)?existing|lawful\s+(?:development\s+)?(?:certificate\s+)?\(?existing|existing\s+lawful|lawful\s+existing|certificate\s+of\s+lawful\w*\s+(?:for\s+an?\s+)?existing)\b|\(existing\)/i
// Not this council's proposal to assess: consultations on a neighbour's application, and
// paperwork against an existing permission that a follow-on test phrased differently can miss.
// Not proposals for commercial use at all: tree works, caravan-rally notifications, householder
// permitted development classes ("Class E outbuilding" is Part 1 Class E, not Use Class E).
const OUT_OF_SCOPE = /\b(?:works?\s+to\s+trees?|tree\s+preservation|conservation\s+area\s+\(tca\)|\btpo\b|crown\s+(?:lift|reduc\w*|thin\w*)|pollard\w*|fell(?:ing)?\s+(?:of\s+)?(?:\d+|one|two|a)\b|caravan\s+sites\s+and\s+control\s+of\s+development|temporary\s+site\s+notification|one\s+planet\s+development|electronic\s+communications\s+code|telecommunications?\s+(?:mast|apparatus|equipment)|part\s+1,?\s+class|class\s+[a-h]\s+(?:outbuilding|porch|hard\s*standing|extension))/i
const CONSULTATION = /\b(?:adjoining\s+(?:authority|borough)|neighbouring\s+authority|consultation\s+(?:request\s+)?(?:from|by)|observations\s+on\s+a\s+proposed|regulation\s+77|s\.?\s?77\b)/i
// Paperwork wording counts only where it leads the description. A proposal that mentions a section
// 73 variation in brackets ("Use of retail unit as a cafe (Application under Section 73 ...)") is
// still the proposal.
const FOLLOW_ON_LEAD = /^\s*(?:application\s+(?:for|to)\s+|to\s+|proposed\s+|request\s+for\s+confirmation\s+to\s+)?(?:(?:the\s+)?approv(?:al\s+of|e)\s+)?(?:conditions?\b|vary\s+conditions?|variations?\s+(?:of|to)\s+conditions?|(?:partial\s+)?discharge|details?\b|submission\s+of\s+details|compliance\s+with|non[-\s]*material|minor\s+material|variation\s+(?:of|to)\s+condition|removal\s+of\s+condition|amendments?\s+to)/i
const PAPERWORK_LEAD = /\b(?:planning\s+obligation|modif(?:y|ication)\s+of|changes?\s+to\s+condit\w*|pre[\s-]*app\w*|discharge\s+of\s+conditions?|details\s+pursuant|amend(?:ments?|ed)?\s+(?:to\s+|description\s+)?(?:conditions?|planning|permission)?|variation\s+(?:of|to)\s+(?:the\s+)?conditions?|removal\s+of\s+conditions?|section\s+(?:42|73)|s\.?\s?73|s\.?106|section\s+106|non[-\s]*material|matters\s+relating)/i
const DOMESTIC = /\b(?:home|garden|domestic|ancillary|incidental|private)\s+(?:office|gym|studio|workshop|storage|store|business)s?\b|\b(?:bin|cycle|bike|refuse|garden|log|mobility\s+scooter)\s+(?:stores?|storage)\b|\bstorage\s+(?:shed|of\s+(?:bins|bikes|garden))|\bancillary\s+to\s+(?:the\s+)?(?:main\s+)?(?:dwelling|house|residential)/i

const RESIDENTIAL_OR_COMMUNITY = /\b(?:dwelling\w*|flats?|(?<!serviced\s)apartments?|houses?(?!\s+in\s+multiple)|house\s+in\s+multiple\s+occupation|hmos?|residential(?!\s+accommodation\s+for\s+short)|homes?|maisonettes?|bungalows?|annex\w*|c3|c4|class\s+9|live[\s/-]+work|care\s+homes?|c2|children'?s\s+homes?|supported\s+living|f1|f2|class\s+10|schools?|education\w*|church|places?\s+of\s+worship|community\s+(?:centres?|halls?|use)|nursing\s+homes?)\b/i

// A bare "use" is too loose ("Use Class B8", "for use as storage" on a householder extension,
// "Proposed Use or Development" on a certificate), so a use must be of something.
// The trigger only marks where to look; it must not consume the origin ("Use of shop as cafe").
const CHANGE_OF_USE = /\b(?:changes?\s+(?:of|the)\s+use|conver(?:sion|t|ting)|re-?use(?=\s+of\b)|(?<!class\s)use(?=\s+(?:of|from)\b)|subdivision|sub-division|amalgamation|fit[\s-]*out)\b/i
// "from X to Y" wins where present ("application for farm buildings from agricultural to class B8");
// otherwise "of X to Y", "into", "as", and "for" last. The destination ends at the first clause
// break so "to form X including alterations to shopfront" does not read "shopfront" as the use.
// Brackets stay in: they often name the use ("to Sui Generis (motor vehicle repair garage)"), and a
// full stop inside "1no." is not a clause end.
const FROM_TO = /\bfrom\s+([\s\S]+?)\s(?:to|into)\s/i
const DESTINATION_SPLIT = /\s(?:to\s+(?:become|form|create|provide)|to|into|as|facilitate\s+(?:the\s+)?(?:change\s+of\s+)?use\s+as)\s/i
const PURPOSE_SPLIT = /\s(?:for)\s/i
const CLAUSE_END = /;|\.(?=\s+[A-Z]|\s*$)|\s(?:including|involving|with|together\s+with|and\s+associated|and\s+the\s+(?:erection|installation|construction)|alongside|plus)\s/

const PRIOR_APPROVAL_LOSS = /\b(?:class|paragraph)\s+(?:ma|o|n|pa)\b|commercial,?\s+business\s+and\s+service\s+(?:uses?\s+)?to\s+(?:residential|dwelling)/i
const PRIOR_APPROVAL_TO_COMMERCIAL = /\bclass\s+r\b/i

// Strong build verbs look ahead a clause. Weak ones ("proposed", "installation of", "new") must sit
// right before the commercial noun: "new windows", "new shop front" and "new fabric canopy" are not
// commercial space, and neither is "proposed alterations to retail unit".
const NEW_BUILD = /\b(?:erection|erect|construction|construct|creation|development|redevelopment|provision|siting|formation|comprising|reserved\s+matters|outline\s+(?:planning\s+)?application\s+for|to\s+site|screening|scoping)\b/i
// A householder extension that happens to add an office is not commercial space.
const HOUSEHOLDER_EXTENSION_LEAD = /^\s*(?:proposed\s+)?(?:(?:part\s+)?(?:single|two|first|ground)[\s-]*(?:and\s+(?:partial\s+)?(?:single|two)[\s-]*)?storey|rear|side|front)\b[^.;]{0,40}\bextensions?\b/i
// Storage buildings are usually sheds and barns; one counts only in a business setting.
const STORAGE_BUILDING = /\b(?:storage(?:\s+and\s+\w+)?\s+(?:units?|buildings?|yard)|buildings?\s+for\s+storage\s+purposes|(?:office|industrial|commercial)\s*[\/&]\s*storage\s+buildings?)\b/i
const BUSINESS_SETTING = /\b(?:industrial|commercial|business|warehouse|yard|b8|trade|offices?|employment|company|marina|car\s+repair\w*|workshops?)\b/i
const NOT_BUSINESS_STORAGE = /\b(?:agricultur\w*|forestry|garden|domestic|garage|dwelling|farm|hay|fodder|energy|battery|residential|house)\b/i
const WEAK_BUILD = /\b(?:proposed|installation\s+of|install|new|temporary|replacement)\b/gi
const MINOR_WORKS = /\b(?:alterations?|refurbish\w*|shop\s*fronts?|signage|resignage|signs?|advertisement|repairs?|windows?|doors?|canopy|fascia|redecorat\w*|internal|existing|solar|pv|photovoltaic|panels?|strip-out|reinstatement|atms?|flooring|licen[cs]e|extract\w*|flues?|fans?|roof\s*lights?)\b/i
const LIVESTOCK = /\b(?:cattle|livestock|dairy|cows?|sheep|pigs?|calves|lambing|slurry)\b/i
const LEADING_WORDS = /^\s*(?:\d+\s*(?:no\.?|x)?\s*)?(?:(?:a|an|the|new|proposed|detached|single[\s-]storey|two[\s-]storey|small|large|temporary|permanent|replacement)\s+){0,3}/i
const NEW_COMMERCIAL_SPACE = new RegExp([
  String.raw`(?:commercial|business|industrial|employment|retail|trade|light\s+industrial|workshop|office|starter|flexible\s+commercial)\s+(?:units?|buildings?|space|floor\s*space|premises|park|estate|centre)`,
  String.raw`warehous\w*`, String.raw`(?:industrial|office|retail)\s+(?:buildings?|blocks?)`, String.raw`factor(?:y|ies)`,
  String.raw`(?:retail|shop)\s+units?`, String.raw`shops?(?!\s*fronts?)`, String.raw`supermarkets?`, String.raw`foodstores?`,
  String.raw`restaurants?`, String.raw`caf[eé]s?`, String.raw`drive[\s-]*thr(?:u|ough)`, String.raw`public\s+houses?`,
  String.raw`hotels?`, String.raw`apart[\s-]*hotels?`, String.raw`holiday\s+(?:lets?|lodges?|cottages?|accommodation|units?|chalets?)`,
  String.raw`(?:tourist|visitor)\s+accommodation`, String.raw`glamping`,
  String.raw`(?:camp|caravan)\s*(?:sites?|parks?)`, String.raw`lodges`, String.raw`gym(?:nasium)?s?`, String.raw`padel\s+courts?`,
  String.raw`car\s+wash\w*`, String.raw`petrol\s+(?:filling\s+)?stations?`, String.raw`workshop\s+(?:units?|buildings?|premises)`,
  String.raw`data\s+centres?`, String.raw`storage\s*(?:and|&|\/)\s*distribution`, String.raw`general\s+industrial`, String.raw`industrial\s+use`, String.raw`performance\s+venues?`,
  String.raw`self[\s-]*storage`, String.raw`class\s+e\b(?:\s*\(\s*[a-g]\s*\))?`, String.raw`e\s*\(\s*[a-g]\s*\)`,
  String.raw`b[128]\b`, String.raw`(?:day|children'?s)\s+nurser(?:y|ies)`, String.raw`(?:medical|health)\s+centres?`,
  String.raw`garden\s+centres?`, String.raw`farm\s+shops?`, String.raw`kennels`,
  String.raw`use\s+classes?\s+(?:b[128]|e)`, String.raw`class\s+[456]\b`, String.raw`(?:dental|medical|veterinary)\s+(?:practices?|surgery|surgeries|clinics?)`,
  String.raw`distiller(?:y|ies)`, String.raw`brewer(?:y|ies)`, String.raw`winer(?:y|ies)`, String.raw`campsites?`,
  String.raw`showrooms?`, String.raw`padel\w*(?:\s+(?:tennis\s+)?(?:courts?|facilit\w*))?`, String.raw`(?:car\s+)?dealerships?`,
  String.raw`leisure\s+centres?`, String.raw`pavilion`, String.raw`club\s*house`, String.raw`crematori(?:um|a)`, String.raw`golf\s+simulator\w*`,
  String.raw`food\s*(?:&|and)\s*beverage`, String.raw`serviced\s+apartments?`, String.raw`(?:retail|office|commercial)(?:\s+and\s+\w+)?\s+uses?`,
  String.raw`office\s+accommodation`, String.raw`(?:wedding|events?)\s+venues?`, String.raw`host(?:ing)?\s+(?:\w+\s+){0,2}events`,
  String.raw`testing\s+centres?`, String.raw`class\s+11`, String.raw`hand\s+car\s+wash`, String.raw`holiday\s+(?:cabins?|lodges?)`, String.raw`lodges?`, String.raw`(?:self[\s-]*catering|holiday|camping|glamping)\s+(?:lodges?|pods?|cabins?|units?)`,
  String.raw`(?:3g|artificial\s+grass)\s+(?:synthetic\s+)?(?:football\s+)?pitch\w*`, String.raw`clubhouse`, String.raw`sports\s+(?:hub|pavilion|centre)`,
  String.raw`(?:jet\s+wash|valeting)\s*(?:bays?|centres?|hub)?`, String.raw`(?:ev|electric\s+vehicle)\s+(?:ultra-rapid\s+)?charging\s+hub`,
  String.raw`service\s+stations?`, String.raw`data\s*centres?`, String.raw`(?:manufacturing|processing|recycling)\s+(?:plant|buildings?|facilit\w*)`,
  String.raw`(?:industrial|office|retail|commercial)\s+(?:units?|buildings?)`, String.raw`bonded\s+warehouse`, String.raw`drinking\s+establishments?`, String.raw`(?:events?|performance)\s+(?:space|venues?)`,
  String.raw`pop-up\s+bar`, String.raw`bars?\b(?=\s+(?:facilit\w*|and|with)\b|\s*\()`, String.raw`dentists?`, String.raw`tyre\s+retail\w*`, String.raw`lodges`,
].map(term => `\\b${term}`).join('|'), 'i')
const EXTENSION = /\bextensions?\b|\bextend(?:ing|ed)?\b|\benlarge\w*/i
const AGRICULTURAL = /\bagricultur\w*(?:\s+[\w-]+){0,2}\s+(?:storage|buildings?|workshops?|stores?)\b/i

export interface DescribedCommercialWork {
  work: Extract<CommercialWork, 'new' | 'to-commercial' | 'between' | 'loss'>
  evidence: string
}

function commercial(text: string): boolean {
  return COMMERCIAL_USE.test(text.replace(DOMESTIC, ' '))
}

function changeOfUse(description: string): DescribedCommercialWork | null {
  const trigger = description.match(CHANGE_OF_USE)
  if (!trigger || trigger.index === undefined) return null
  const start = trigger.index + trigger[0].length
  const after = description.slice(start, start + 300)
  let origin: string, rest: string
  const fromTo = after.match(FROM_TO)
  if (fromTo && fromTo.index !== undefined && fromTo.index < 120) {
    origin = fromTo[1]
    rest = after.slice(fromTo.index + fromTo[0].length)
  } else {
    const split = after.match(DESTINATION_SPLIT) ?? after.match(PURPOSE_SPLIT)
    if (!split || split.index === undefined) return null
    origin = after.slice(0, split.index)
    rest = after.slice(split.index + split[0].length)
  }
  // "to a mix of uses including offices and beauty salon": the uses are in the list that follows.
  const end = /^\W*(?:an?\s+)?mix(?:ed)?[\s-]*(?:of\s+)?uses?\b/i.test(rest) ? Math.min(rest.length, 120) : rest.search(CLAUSE_END)
  const destination = end === -1 ? rest : rest.slice(0, end)
  // "use class E (current use) and use class F1": naming the current use is not a change into it.
  if (/\b(?:current|existing)\s+use\b/i.test(destination)) return null
  const evidence = description.slice(trigger.index, start + after.indexOf(rest) + destination.length).trim()

  if (HOUSEHOLD_CONTEXT.test(`${origin} ${destination} ${rest.slice(destination.length, destination.length + 60)}`)) return null
  // A household garage becoming a room-sized use; a classed or commercial garage is a business.
  if (HOUSEHOLD_GARAGE.test(origin) && !MOTOR_TRADE.test(destination)
    && !/\b(?:class|b[128]|sui\s+generis|rental|commercial|industr\w*|former)\b/i.test(origin)
    && !/\b(?:units?|commercial|class|retail|shops?|nurser(?:y|ies))\b/i.test(destination)) return null
  const fromCommercial = commercial(origin)
  const toCommercial = commercial(destination) && !RESIDENTIAL_SITE.test(destination)
  if (toCommercial && fromCommercial) return { work: 'between', evidence }
  if (toCommercial) return { work: 'to-commercial', evidence }
  if (fromCommercial && RESIDENTIAL_OR_COMMUNITY.test(destination)) return { work: 'loss', evidence }
  return null
}

export function describedCommercialWork(description: string | null | undefined): DescribedCommercialWork | null {
  const text = (description ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  // Condition submissions, variations and amendments quote their parent's proposal; they are
  // not themselves new commercial work, and linking attaches them to the parent's family. Plota
  // leaves them unlabelled on live records for the same reason.
  const lead = text.slice(0, 90)
  if (FOLLOW_ON_LEAD.test(text) || PAPERWORK_LEAD.test(lead)) return null
  if (EXISTING_ONLY.test(text) || CONSULTATION.test(text) || OUT_OF_SCOPE.test(text)) return null

  if (PRIOR_APPROVAL_LOSS.test(text) && RESIDENTIAL_OR_COMMUNITY.test(text)) {
    return { work: 'loss', evidence: text.match(PRIOR_APPROVAL_LOSS)![0] }
  }
  if (PRIOR_APPROVAL_TO_COMMERCIAL.test(text)) {
    return { work: 'to-commercial', evidence: text.match(PRIOR_APPROVAL_TO_COMMERCIAL)![0] }
  }

  const change = changeOfUse(text)
  if (change) return change

  const newSpace = (clause: string): DescribedCommercialWork | null => {
    // Schools and colleges build sports halls and pavilions for pupils, not as commercial space.
    if (HOUSEHOLD_CONTEXT.test(clause) || LIVESTOCK.test(clause) || /\b(?:schools?|educational|classrooms?|academy|college|fire\s+station)\b/i.test(clause)) return null
    // "Erection of signage for hotel development" is a sign, not the hotel.
    if (/^\S+(?:\s+\S+){0,3}\s+(?:signage|signs?|advert\w*|awning|fibre\s+box|feeder\s+pillars?|portacabin|doors?|windows?|shop\s*fronts?|canopy|glazing|internal|extract\w*|flues?|fans?|roof\s*lights?)\b/i.test(clause)) return null
    const cleaned = clause.replace(DOMESTIC, ' ').replace(AGRICULTURAL, ' ')
    const space = cleaned.match(NEW_COMMERCIAL_SPACE)
    if (!space || space.index === undefined) return null
    // An extension named before the space, or straight after it ("storage unit extension"), makes it
    // an extension; one named later does not: "Erection of storage building - Extension of Existing
    // Business" is a new building.
    const straightAfter = cleaned.slice(space.index + space[0].length, space.index + space[0].length + 25)
    // "a storage shed to rear of existing warehouse" builds the shed, not the warehouse.
    const straightBefore = cleaned.slice(Math.max(0, space.index - 20), space.index)
    if (EXTENSION.test(cleaned.slice(0, space.index)) || /^\s*(?:['"‘’][^'"‘’]{0,15}['"‘’]\s*)?extensions?\b/i.test(straightAfter)
      || /\b(?:existing|of\s+the)\s+$/i.test(straightBefore) || /\bbooth\b/i.test(straightAfter) || RESIDENTIAL_SITE.test(clause)) return null
    return { work: 'new', evidence: clause.slice(0, space.index + space[0].length).trim() }
  }
  // Certificate boilerplate names "development" without proposing any.
  const unboilered = text.replace(/(?:certificate\s+of\s+)?(?:proposed\s+)?lawful(?:ness)?\s+(?:development\s+)?(?:certificate\s*)?(?:\(?\s*(?:for\s+)?(?:a\s+)?proposed\s+(?:use\s+or\s+)?development\s*\)?)?|proposed\s+use\s+or\s+development/gi, ' ')
  const build = HOUSEHOLDER_EXTENSION_LEAD.test(text) ? null : unboilered.match(NEW_BUILD)
  if (build && build.index !== undefined) {
    const found = newSpace(unboilered.slice(build.index, build.index + 200))
    if (found) return found
  }
  const alterationsLead = /^\s*(?:the\s+)?(?:(?:internal|external|minor)\s+(?:and\s+(?:internal|external)\s+)?)?(?:alterations|refurbish\w*|redecorat\w*)/i.test(text)
  // Minor works count only when named before the space: "Installation of a hand car wash facility
  // including canopy" is a car wash; "new windows to the shop" is not a shop.
  const minorBefore = (clause: string, found: DescribedCommercialWork) => MINOR_WORKS.test(clause.slice(0, clause.indexOf(found.evidence) + found.evidence.length).replace(NEW_COMMERCIAL_SPACE, ' '))
  const householder = HOUSEHOLDER_EXTENSION_LEAD.test(text)
  for (const weak of alterationsLead || householder ? [] : unboilered.matchAll(WEAK_BUILD)) {
    const clause = unboilered.slice(weak.index ?? 0, (weak.index ?? 0) + weak[0].length + 60)
    const found = newSpace(clause)
    if (found && !minorBefore(clause, found)) return found
  }
  // A description that is only the thing itself: "4no. self catering lodges", "Proposed retail unit".
  const leading = text.match(LEADING_WORDS)![0]
  const head = text.slice(leading.length, leading.length + 45)
  const headSpace = head.match(NEW_COMMERCIAL_SPACE)
  if (headSpace?.index === 0 && !householder) {
    const found = newSpace(head)
    if (found) return found
  }
  // "to form a Starbucks Drive-Thru", "to provide three commercial units".
  for (const purpose of unboilered.matchAll(/\bto\s+(?:form|create|provide)\b/gi)) {
    const clause = unboilered.slice(purpose.index ?? 0, (purpose.index ?? 0) + 70)
    const found = !MINOR_WORKS.test(clause) ? newSpace(clause) : null
    if (found) return found
  }
  const storage = unboilered.match(STORAGE_BUILDING)
  if (storage && BUSINESS_SETTING.test(unboilered.replace(STORAGE_BUILDING, ' ')) && !NOT_BUSINESS_STORAGE.test(unboilered)
    && !EXTENSION.test(unboilered.slice(Math.max(0, (storage.index ?? 0) - 40), storage.index))) {
    return { work: 'new', evidence: storage[0] }
  }
  // Prior approvals for agricultural buildings to storage or flexible commercial use (Class R).
  const agricultural = text.match(/\bagricultur\w*[^.;]{0,60}\s(?:to|into)\s[^.;]{0,20}\b(?:storage|commercial|business|flexible)\s+use/i)
  if (agricultural) return { work: 'to-commercial', evidence: agricultural[0] }
  return null
}
