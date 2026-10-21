// Copy for the Brand Matcher-led homepage. Verbatim from docs/design_handoff_homepage_trial
// (direction-bm.jsx); change it there first.

export const SIGNALS = [
  { k: '01', t: 'Brand presence', d: 'Where each brand already trades, and where it has gaps near your site.' },
  { k: '02', t: 'Acquisition signals', d: 'Live requirements, recent openings and stated expansion plans.' },
  { k: '03', t: 'Demographic matches', d: "How the catchment around your site lines up with each brand's existing customers." },
  { k: '04', t: 'Financials', d: 'Filed accounts that show whether a brand is in a position to take space.' },
  { k: '05', t: 'Typical or required site size', d: 'The size a brand usually trades from, or the size it has asked for.' },
]

export const STEPS = [
  { t: 'Add your site', d: "Enter your site's size, address and use class." },
  { t: 'See ranked brands', d: 'Brand Matcher scores every brand against your site and sorts them by fit.' },
  { t: 'Call the right person', d: 'Each brand shows its property contacts or appointed agent.' },
]

// videoSrc: interim clips from the previous homepage until the 16:10 mode clips are made.
export const MODES: { id: string; n: string; d: string; videoSrc?: string }[] = [
  {
    id: 'assess',
    n: 'Assess Area',
    d: 'See brands missing and present from an area on the map alongside catchment and planning data.',
    videoSrc: '/gapfinder/homepage_gifs/siteanalyser_gif.mp4',
  },
  {
    id: 'gaps',
    n: 'Find Gaps',
    d: 'Quickly find locations or retail centres that meet your brand presence/absence requirements.',
    videoSrc: '/gapfinder/homepage_gifs/gapfinder_gif.mp4',
  },
  {
    id: 'sketch',
    n: 'SiteSketcher',
    d: 'Sketch out a site in minutes to see if it would be a good fit for an occupier. Includes manual and automatic parking layouts and store CADs.',
    videoSrc: '/gapfinder/homepage_gifs/sitesketcher_gif.mp4',
  },
  {
    id: 'planning',
    n: 'Planning Monitor',
    d: 'See commercial planning applications across the UK, set up your patch and receive an AI summary of relevant planning applications to your inbox every week.',
  },
  {
    id: 'directory',
    n: 'Directory',
    d: 'A comprehensive directory of brands we track, their property contacts, requirements, acquisition activity, existing store estates, agents representing brands and more.',
    videoSrc: '/gapfinder/homepage_gifs/browse_listings_gif.mp4',
  },
]

export const PRO_FEATURES = [
  'Brand Matcher rankings for any UK site',
  'Property contacts and agents for every brand',
  'GapFinder, SiteAnalyser and SiteSketcher',
  'Requirement Directory and alerts',
  'Data exports',
]

export const ENTERPRISE_FEATURES = [
  'Custom reports on your sites or portfolio',
  'Expert property professionals review every report',
  'Team seats and admin controls',
  'Dedicated account manager',
]

export const FAQS = [
  {
    q: 'How does the free trial work?',
    a: 'Enter any site to see a preview of its ranking, then start a 14-day free trial to unlock the full report and contacts. You add a card when you start. On day 14 your first payment is taken: £199 per person for monthly, or £1,990 per person for annual. You can cancel any time before then.',
  },
  {
    q: 'How does Brand Matcher rank brands?',
    a: 'Each brand is scored against your site using five signals: brand presence, acquisition signals, demographic matches, financials and typical or required site size. The combined fit score sets its position in the list, and you can see how each signal contributed.',
  },
  {
    q: 'Who will I be calling?',
    a: "Where we have it, the brand's in-house property or acquisitions contact. Where a brand uses an agent, we show the appointed agent and label them clearly.",
  },
  {
    q: 'Is the price per person?',
    a: 'Yes. Pro is £199 per month for each person using SiteMatcher, or £1,990 per year if you pay annually, which gives you two months free. Teams who want shared admin and custom reports should look at Enterprise.',
  },
  {
    q: "What's in an Enterprise report?",
    a: 'A custom report on your site or portfolio, produced with expert property professionals in the loop who review the brand shortlist before it reaches you.',
  },
  {
    q: 'Can I cancel?',
    a: "Yes, any time from your account. Your plan stays active until the end of the billing period, whether that's the month or the year.",
  },
]

// The sample report under the hero: illustrative brands, labelled "Sample report".
export const SAMPLE_SITE = 'Unit 4, Castle Retail Park · NG7 2PS'
export const SAMPLE_ROWS = [
  { n: 'Kiln & Crust', sec: 'Casual dining', c: '#C2410C', score: 92, s: [5, 5, 4, 4], who: 'Sarah Okafor', role: 'Head of Property' },
  { n: 'Harbour Coffee', sec: 'Coffee', c: '#0F766E', score: 88, s: [4, 5, 4, 5], who: 'James Whitlow', role: 'Acquisitions Director' },
  { n: 'Pulse Fitness', sec: 'Leisure · gym', c: '#1D4ED8', score: 84, s: [5, 4, 3, 4], who: 'Priya Raman', role: 'Property Manager' },
  { n: 'Leaf & Larder', sec: 'Convenience', c: '#15803D', score: 79, s: [4, 3, 5, 3], who: 'Tom Adeyemi', role: 'via Carter Lane (agent)' },
  { n: 'Northway Pets', sec: 'Pet retail', c: '#7C3AED', score: 74, s: [3, 4, 3, 4], who: 'Emma Castell', role: 'Expansion Manager' },
]
