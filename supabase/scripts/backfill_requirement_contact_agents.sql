-- One-off backfill: create directory agencies + agents from existing requirement contacts,
-- then link them (requirement_contacts.agent_id + brand_agents).
--
-- Requires migration 20261026000000_requirement_contact_agents.sql.
-- Idempotent: agencies upsert on domain, agents on email, edges on (brand_id, agent_id).
-- Ends in ROLLBACK so a run is a dry run; switch the last line to COMMIT to apply.
--
-- Who counts as an agent (in-house contacts are deliberately ignored):
--   * the requirement has a brand, AND
--   * the email domain does not look like the brand's own (same domain, a subdomain of it,
--     or the same first label, e.g. savills.com vs savills.ie), AND
--   * the contact's title says "Agent", OR their email domain is one of the reviewed agent
--     firms below (catches Brasier Freeth "Principal", Savills "Costa", etc).
--   Webmail addresses titled "Agent" become independent agents with no firm.
-- Contacts on requirements with no brand are skipped: there is no brand to link them to.

BEGIN;

CREATE TEMP TABLE firm_map (email_domain text PRIMARY KEY, agency_name text NOT NULL, agency_domain text NOT NULL) ON COMMIT DROP;
INSERT INTO firm_map VALUES
  ('360-retail.co.uk', '360 Retail', '360-retail.co.uk'),
  ('agl-london.co.uk', 'AGL London', 'agl-london.co.uk'),
  ('aird-estates.co.uk', 'Aird Estates', 'aird-estates.co.uk'),
  ('almaretail.co.uk', 'Alma Retail', 'almaretail.co.uk'),
  ('arcane-re.co.uk', 'Arcane Real Estate', 'arcane-re.co.uk'),
  ('arclondon.uk', 'ARC London', 'arclondon.uk'),
  ('atretail.co.uk', 'AT Retail', 'atretail.co.uk'),
  ('avisonyoung.com', 'Avison Young', 'avisonyoung.com'),
  ('barkerproudlove.co.uk', 'Barker Proudlove', 'barkerproudlove.co.uk'),
  ('bearmonthomes.co.uk', 'Bearmont Homes', 'bearmonthomes.co.uk'),
  ('bebington.com', 'Bebington', 'bebington.com'),
  ('bklprop.co.uk', 'BKL Property', 'bklprop.co.uk'),
  ('boddyandedwards.co.uk', 'Boddy & Edwards', 'boddyandedwards.co.uk'),
  ('bradleyhall.co.uk', 'Bradley Hall', 'bradleyhall.co.uk'),
  ('brasierfreeth.com', 'Brasier Freeth', 'brasierfreeth.com'),
  ('brucegillinghampollard.com', 'Bruce Gillingham Pollard', 'brucegillinghampollard.com'),
  ('burnsproperty.co.uk', 'Burns Property', 'burnsproperty.co.uk'),
  ('cbre.com', 'CBRE', 'cbre.com'),
  ('cedardean.com', 'Cedar Dean', 'cedardean.com'),
  ('central-retail.co.uk', 'Central Retail', 'central-retail.co.uk'),
  ('cmlproperty.co.uk', 'CML Property', 'cmlproperty.co.uk'),
  ('colliers.com', 'Colliers', 'colliers.com'),
  ('cradick.co.uk', 'Cradick Retail', 'cradick.co.uk'),
  ('creative-retail.co.uk', 'Creative Retail', 'creative-retail.co.uk'),
  ('cspretail.com', 'CSP Retail', 'cspretail.com'),
  ('culverwell.co.uk', 'Culverwell', 'culverwell.co.uk'),
  ('cushwake-ni.com', 'Cushman & Wakefield NI', 'cushwake-ni.com'),
  ('dcl.co.uk', 'DCL', 'dcl.co.uk'),
  ('dh-property.co.uk', 'DH Property', 'dh-property.co.uk'),
  ('dibleyproperty.com', 'Dibley Property', 'dibleyproperty.com'),
  ('downespropertyconsulting.com', 'Downes Property Consulting', 'downespropertyconsulting.com'),
  ('dtrsurveyors.com', 'DTR Surveyors', 'dtrsurveyors.com'),
  ('dwrproperty.com', 'DWR Property', 'dwrproperty.com'),
  ('ecliptic.uk', 'Ecliptic', 'ecliptic.uk'),
  ('ejhales.co.uk', 'EJ Hales', 'ejhales.co.uk'),
  ('emanueloliver.com', 'Emanuel Oliver', 'emanueloliver.com'),
  ('empcretail.co.uk', 'EMPC Retail', 'empcretail.co.uk'),
  ('ericsurveyors.com', 'Eric Surveyors', 'ericsurveyors.com'),
  ('eshp.com', 'ESHP', 'eshp.com'),
  ('etchgroup.com', 'Etch Group', 'etchgroup.com'),
  ('eu.jll.com', 'JLL', 'jll.com'),
  ('eyco.co.uk', 'EYCO', 'eyco.co.uk'),
  ('fhp.co.uk', 'FHP Property Consultants', 'fhp.co.uk'),
  ('fortygroup.co.uk', 'Forty Group', 'fortygroup.co.uk'),
  ('fourandco.uk', 'Four & Co', 'fourandco.uk'),
  ('g-s.co.uk', 'Graham + Sibbald', 'g-s.co.uk'),
  ('gc2property.co.uk', 'GC2 Property', 'gc2property.co.uk'),
  ('hauteworld.co.uk', 'Haute World', 'hauteworld.co.uk'),
  ('hoopercommercialproperty.com', 'Hooper Commercial Property', 'hoopercommercialproperty.com'),
  ('howieproperty.co.uk', 'Howie Property', 'howieproperty.co.uk'),
  ('hwandp.co.uk', 'HW&P', 'hwandp.co.uk'),
  ('hynesillingworth.com', 'Hynes Illingworth', 'hynesillingworth.com'),
  ('innes-england.com', 'Innes England', 'innes-england.com'),
  ('jacksoncriss.co.uk', 'Jackson Criss', 'jacksoncriss.co.uk'),
  ('jamesandrew.co.uk', 'James Andrew International', 'jamesandrew.co.uk'),
  ('jamespropco.co.uk', 'James Propco', 'jamespropco.co.uk'),
  ('jenkinslaw.co.uk', 'Jenkins Law', 'jenkinslaw.co.uk'),
  ('johndwood.com', 'John D Wood & Co', 'johndwood.com'),
  ('johnsonfellows.co.uk', 'Johnson Fellows', 'johnsonfellows.co.uk'),
  ('johnstonepc.co.uk', 'Johnstone Property Consultants', 'johnstonepc.co.uk'),
  ('johnstonwaddell.co.uk', 'Johnston Waddell', 'johnstonwaddell.co.uk'),
  ('kalmars.com', 'Kalmars', 'kalmars.com'),
  ('keecommercial.com', 'Kee Commercial', 'keecommercial.com'),
  ('kemsley.com', 'Kemsley', 'kemsley.com'),
  ('klm-re.com', 'KLM Real Estate', 'klm-re.com'),
  ('litorealestate.com', 'Lito Real Estate', 'litorealestate.com'),
  ('longstaffassociates.co.uk', 'Longstaff Associates', 'longstaffassociates.co.uk'),
  ('lookoutdevelopment.com', 'Lookout Development', 'lookoutdevelopment.com'),
  ('ltlproperty.com', 'LTL Property', 'ltlproperty.com'),
  ('lunson-mitchenall.co.uk', 'Lunson Mitchenall', 'lunson-mitchenall.co.uk'),
  ('masonowen.com', 'Mason Owen', 'masonowen.com'),
  ('masonpartners.com', 'Mason Partners', 'masonpartners.com'),
  ('matter.london', 'Matter London', 'matter.london'),
  ('mayandcompany.co.uk', 'May & Company', 'mayandcompany.co.uk'),
  ('mcconnellproperty.com', 'McConnell Property', 'mcconnellproperty.com'),
  ('mcdevitt.com', 'McDevitt', 'mcdevitt.com'),
  ('mckinnonnelson.co.uk', 'McKinnon Nelson', 'mckinnonnelson.co.uk'),
  ('mcmullenre.com', 'McMullen Real Estate', 'mcmullenre.com'),
  ('mcparlane.co.uk', 'McParlane', 'mcparlane.co.uk'),
  ('medwayandlaw.co.uk', 'Medway & Law', 'medwayandlaw.co.uk'),
  ('metisrealestate.com', 'Metis Real Estate', 'metisrealestate.com'),
  ('mkrproperty.co.uk', 'MKR Property', 'mkrproperty.co.uk'),
  ('montagu-evans.co.uk', 'Montagu Evans', 'montagu-evans.co.uk'),
  ('morganwilliams.co.uk', 'Morgan Williams', 'morganwilliams.co.uk'),
  ('mp-pc.co.uk', 'MP Property Consultants', 'mp-pc.co.uk'),
  ('nasurveyors.co.uk', 'NA Surveyors', 'nasurveyors.co.uk'),
  ('newnswebster.com', 'Newns Webster', 'newnswebster.com'),
  ('nmrk.com', 'Newmark', 'nmrk.com'),
  ('norburysansom.com', 'Norbury Sansom', 'norburysansom.com'),
  ('onepoint2.com', 'OnePoint2', 'onepoint2.com'),
  ('ormeproperty.co.uk', 'Orme Property', 'ormeproperty.co.uk'),
  ('p-three.co.uk', 'P-Three', 'p-three.co.uk'),
  ('parkplaceretail.co.uk', 'Park Place Retail', 'parkplaceretail.co.uk'),
  ('portlandla.com', 'Portland', 'portlandla.com'),
  ('prime-retail.com', 'Prime Retail', 'prime-retail.com'),
  ('proactive-leisure.co.uk', 'Proactive Leisure', 'proactive-leisure.co.uk'),
  ('pudneyshuttleworth.co.uk', 'Pudney Shuttleworth', 'pudneyshuttleworth.co.uk'),
  ('punch.org.uk', 'Punch', 'punch.org.uk'),
  ('pwmproperty.co.uk', 'PWM Property', 'pwmproperty.co.uk'),
  ('rabretail.com', 'RAB Retail', 'rabretail.com'),
  ('ramsdens.com', 'Ramsdens', 'ramsdens.com'),
  ('rapleys.com', 'Rapleys', 'rapleys.com'),
  ('realestatedirector.co.uk', 'Real Estate Director', 'realestatedirector.co.uk'),
  ('realfindproperty.com', 'Realfind Property', 'realfindproperty.com'),
  ('retailgrouplondon.co.uk', 'Retail Group London', 'retailgrouplondon.co.uk'),
  ('rhtretail.co.uk', 'RHT Retail', 'rhtretail.co.uk'),
  ('rj-ltd.co.uk', 'RJ Ltd', 'rj-ltd.co.uk'),
  ('rsaprop.co.uk', 'RSA Property', 'rsaprop.co.uk'),
  ('rspartners.co.uk', 'RS Partners', 'rspartners.co.uk'),
  ('ryden.co.uk', 'Ryden', 'ryden.co.uk'),
  ('sansomcommercial.com', 'Sansom Commercial', 'sansomcommercial.com'),
  ('savills.com', 'Savills', 'savills.com'),
  ('savills.ie', 'Savills', 'savills.com'),
  ('sessions.co.uk', 'Sessions', 'sessions.co.uk'),
  ('simsproperty.co.uk', 'Sims Property', 'simsproperty.co.uk'),
  ('smart-4.co.uk', 'Smart 4', 'smart-4.co.uk'),
  ('smithcoleyretail.co.uk', 'Smith Coley Retail', 'smithcoleyretail.co.uk'),
  ('space-rpc.com', 'Space RPC', 'space-rpc.com'),
  ('space.rpc.com', 'Space RPC', 'space-rpc.com'),
  ('stance.london', 'Stance', 'stance.london'),
  ('stockfordanderson.com', 'Stockford Anderson', 'stockfordanderson.com'),
  ('streetpropertyconsultants.com', 'Street Property Consultants', 'streetpropertyconsultants.com'),
  ('teagueandcapital.co.uk', 'Teague & Capital', 'teagueandcapital.co.uk'),
  ('tiendaproperty.co.uk', 'Tienda Property', 'tiendaproperty.co.uk'),
  ('twentyretail.com', 'Twenty Retail', 'twentyretail.com'),
  ('vailwilliams.com', 'Vail Williams', 'vailwilliams.com'),
  ('vedragroup.co.uk', 'Vedra Group', 'vedragroup.co.uk'),
  ('wbf.co.uk', 'WBF', 'wbf.co.uk'),
  ('whitestonerl.co.uk', 'Whitestone', 'whitestonerl.co.uk'),
  ('wrightbuchanan.co.uk', 'Wright Buchanan', 'wrightbuchanan.co.uk'),
  ('wsbproperty.co.uk', 'WSB Property', 'wsbproperty.co.uk'),
  ('xprop.co.uk', 'X Prop', 'xprop.co.uk'),
  ('zeitlynfarrell.co.uk', 'Zeitlyn Farrell', 'zeitlynfarrell.co.uk')
;

CREATE TEMP TABLE agent_rows ON COMMIT DROP AS
WITH rc AS (
  SELECT rc.*, r.brand_id, r.updated_at AS req_updated_at,
    lower(trim(rc.contact_email)) AS em,
    lower(split_part(trim(rc.contact_email), '@', 2)) AS edom,
    lower(regexp_replace(coalesce(b.domain, r.company_domain, ''), '^(https?://)?(www\.)?|/.*$', '', 'g')) AS bdom
  FROM public.requirement_contacts rc
  JOIN public.requirements r ON r.id = rc.requirement_id
  LEFT JOIN public.brands b ON b.id = r.brand_id
)
SELECT rc.*, fm.agency_name, fm.agency_domain
FROM rc
LEFT JOIN firm_map fm ON fm.email_domain = rc.edom
WHERE rc.brand_id IS NOT NULL
  AND rc.em LIKE '%@%'
  AND NOT (rc.bdom <> '' AND (rc.edom = rc.bdom OR rc.edom LIKE '%.' || rc.bdom
                              OR split_part(rc.edom, '.', 1) = split_part(rc.bdom, '.', 1)))
  AND (rc.contact_title ~* '\magent' OR fm.email_domain IS NOT NULL);

-- 1. Agencies, one per firm domain.
INSERT INTO public.directory_agencies (name, domain, website)
SELECT DISTINCT ON (agency_domain) agency_name, agency_domain, 'https://' || agency_domain
FROM agent_rows WHERE agency_domain IS NOT NULL
ORDER BY agency_domain
ON CONFLICT (lower(domain)) WHERE domain IS NOT NULL AND domain <> '' DO NOTHING;

-- 2. Agents, one per email. Where the same person appears on several requirements, take the
--    row with the most filled-in details, then the most recently updated requirement.
INSERT INTO public.directory_agents (agency_id, name, title, email, phone, linkedin_url, headshot_url, region)
SELECT DISTINCT ON (ar.em)
  ag.id,
  coalesce(nullif(trim(ar.contact_name), ''), ar.em),
  nullif(trim(ar.contact_title), ''),
  ar.em,
  nullif(trim(ar.contact_phone), ''),
  nullif(trim(ar.linkedin_url), ''),
  nullif(trim(ar.headshot_url), ''),
  nullif(trim(ar.contact_area), '')
FROM agent_rows ar
LEFT JOIN public.directory_agencies ag ON lower(ag.domain) = ar.agency_domain
ORDER BY ar.em,
  ((ar.contact_phone IS NOT NULL AND ar.contact_phone <> '')::int
   + (ar.linkedin_url IS NOT NULL AND ar.linkedin_url <> '')::int
   + (ar.headshot_url IS NOT NULL AND ar.headshot_url <> '')::int) DESC,
  ar.req_updated_at DESC
ON CONFLICT (lower(email)) WHERE email IS NOT NULL AND email <> '' DO NOTHING;

-- 3. Link every requirement's contacts and create the brand<->agent edges.
SELECT public.link_requirement_contact_agents(r.id) FROM public.requirements r;

-- Summary (what a dry run would have written).
SELECT
  (SELECT count(*) FROM agent_rows)                                             AS agent_contact_rows,
  (SELECT count(*) FROM public.directory_agencies)                              AS agencies,
  (SELECT count(*) FROM public.directory_agents)                                AS agents,
  (SELECT count(*) FROM public.directory_agents WHERE agency_id IS NULL)        AS independent_agents,
  (SELECT count(*) FROM public.brand_agents)                                    AS brand_agent_edges,
  (SELECT count(DISTINCT brand_id) FROM public.brand_agents)                    AS brands_with_agents,
  (SELECT count(*) FROM public.requirement_contacts WHERE agent_id IS NOT NULL) AS linked_requirement_contacts;

ROLLBACK;
