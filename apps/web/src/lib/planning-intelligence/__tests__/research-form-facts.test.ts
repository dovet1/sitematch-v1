import { standardFormFloorspace, standardFormApplicants } from '../research-form-facts'
const source = { kind: 'document' as const, url: 'https://council.test/form.pdf', text: '' }
it('reads exact commercial totals with page evidence, preserving zero', () => {
  const text = '[PDF page 10] All Types of Development: Non-Residential Floorspace '
    + 'Existing gross internal floorspace (square metres) (a): 12 Totals '
    + 'Existing gross internal floorspace (square metres) (a) 347 '
    + 'Total gross new internal floorspace proposed (including changes of use) (square metres) (c) 347 '
    + 'Net additional gross internal floorspace following development (square metres) (d = c - a) 0 Tradable floor area'
  const result = standardFormFloorspace([{ ...source, text }])
  expect(result.map(f => [f.scope, f.sqm, f.evidencePage])).toEqual([
    ['existing', 347, '10'], ['proposed', 347, '10'], ['net', 0, '10'],
  ])
  expect(result.every(f => text.includes(f.evidenceExcerpt))).toBe(true)
})
it('does not infer totals or interpret residential measurements as commercial', () => {
  expect(standardFormFloorspace([{ ...source, text: 'Totals Existing gross internal floorspace (square metres) (a) 347' }])).toEqual([])
  expect(standardFormFloorspace([{ ...source, text: 'All Types of Development: Non-Residential Floorspace Existing gross internal floorspace (square metres) (a) 347' }])).toEqual([])
})

it('recovers only the labelled company applicant, not an agent on another page', () => {
  const text = '[PDF page 2] Company Name connect UK Address High Street Applicant Details '
    + '[PDF page 3] Agent Details Company Name Squires Planning Address High Street'
  const result = standardFormApplicants([{ ...source, text }])
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ name: 'connect UK', role: 'applicant', evidencePage: '2' })
  expect(text.includes(result[0].evidenceExcerpt)).toBe(true)
})
