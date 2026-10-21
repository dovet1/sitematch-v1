import {
  extractPostcode,
  previewHref,
  readSiteParams,
  toQueryUseClass,
  workspaceHref,
} from '../brand-matcher-link'
import { parseProPlan, PRO_TRIAL_DAYS, trialEndDate } from '../pro-plan'
import { trialEndingEmail } from '../emails/trial-ending'

describe('brand-matcher-link', () => {
  it('pulls a full postcode out of an address, normalised', () => {
    expect(extractPostcode('Unit 4, Castle Retail Park, Nottingham ng72ps')).toBe('NG7 2PS')
    expect(extractPostcode('12 High Street, Guildford GU1 3AA')).toBe('GU1 3AA')
    expect(extractPostcode('Guildford')).toBeNull()
  })

  it('round-trips a site through the preview URL', () => {
    const href = previewHref({ site: '12 High Street, Guildford', postcode: 'GU1 3AA', sqft: 4200, useClass: 'SG' })
    expect(href.startsWith('/brand-matcher?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(readSiteParams(params)).toEqual({ site: '12 High Street, Guildford', postcode: 'GU1 3AA', sqft: 4200, useClass: 'SG' })
  })

  it('leaves uc out for all use classes, and falls back to the postcode in the site text', () => {
    const href = previewHref({ site: 'NG7 2PS', postcode: 'NG7 2PS', sqft: null, useClass: 'all' })
    expect(href).not.toContain('uc=')
    expect(readSiteParams(new URLSearchParams('site=Somewhere%20NG7%202PS'))).toEqual({
      site: 'Somewhere NG7 2PS',
      postcode: 'NG7 2PS',
      sqft: null,
      useClass: 'all',
    })
    expect(readSiteParams(new URLSearchParams('site=Nowhere'))).toBeNull()
  })

  it('maps the homepage use classes onto the matcher', () => {
    expect(toQueryUseClass('all')).toBe('All')
    expect(toQueryUseClass('E')).toBe('E')
    expect(toQueryUseClass('SG')).toBe('Sui Generis')
  })

  it('opens Brand Matcher in the workspace', () => {
    const href = workspaceHref({ site: 'NG7 2PS', postcode: 'NG7 2PS', sqft: 1000, useClass: 'E' }, { welcome: 'trial' })
    const params = new URLSearchParams(href.split('?')[1])
    expect(href.startsWith('/sitematcher-unified?')).toBe(true)
    expect(params.get('mode')).toBe('brand-matcher')
    expect(params.get('welcome')).toBe('trial')
    expect(params.get('uc')).toBe('E')
  })
})

describe('pro-plan', () => {
  it('defaults to monthly', () => {
    expect(parseProPlan(null)).toBe('monthly')
    expect(parseProPlan('annual')).toBe('annual')
    expect(parseProPlan('year')).toBe('annual')
    expect(parseProPlan('nonsense')).toBe('monthly')
  })

  it('takes the first payment 14 days after sign-up', () => {
    const end = trialEndDate(new Date('2026-10-21T10:00:00Z'))
    expect(PRO_TRIAL_DAYS).toBe(14)
    expect(end.toISOString().slice(0, 10)).toBe('2026-11-04')
  })
})

describe('trial ending email', () => {
  it('states the date and the amount for the plan', () => {
    const email = trialEndingEmail({
      trialEnd: new Date('2026-11-04T10:00:00Z'),
      amount: 199000,
      interval: 'year',
      manageUrl: 'https://www.sitematcher.co.uk/account/billing',
    })
    expect(email.subject).toBe('Your SiteMatcher trial ends on 4 November')
    expect(email.text).toContain('£1,990.00 for the year')
    expect(email.html).toContain('https://www.sitematcher.co.uk/account/billing')
  })
})
