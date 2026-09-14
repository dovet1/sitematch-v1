import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewEditor, type ReviewDevelopment } from '../planning-review'
const development: ReviewDevelopment = {
  id: '11111111-1111-4111-8111-111111111111',
  canonical_name: 'Test foodstore',
  relevance: 'high',
  confidence: 0.6,
  summary: 'New foodstore with housing',
  updated_at: '2026-09-12T00:00:00Z',
  unanswered_questions: ['Who will operate it?'],
  model_dwelling_count: 20,
  creates_commercial_space: 'yes',
  commercial_use_classes: ['E'],
  applications: [
    {
      planning_applications: {
        raw: {
          id: 'one',
          reference: '26/1',
          authority: { slug: 'test', name: 'Test council' },
          description: 'Erection of a foodstore and 20 homes',
        },
        stated_dwelling_count: 30,
      },
    },
  ],
  brandSignals: [],
  observations: [],
}
const fetchMock = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  })
})
it('shows source evidence and records a corrected unknown without converting it to zero', async () => {
  const saved = jest.fn()
  render(<ReviewEditor development={development} onSaved={saved} />)
  expect(screen.getByText('Source dwelling count: 30')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Dwelling count'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await waitFor(() => expect(saved).toHaveBeenCalled())
  const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(payload).toMatchObject({
    decision: 'corrected',
    expectedUpdatedAt: development.updated_at,
    fields: { dwellingCount: null },
  })
})
it('keeps edits visible and explains a concurrent change', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({
      error: 'This development changed. Reload before saving.',
    }),
  })
  const saved = jest.fn()
  render(<ReviewEditor development={development} onSaved={saved} />)
  fireEvent.change(screen.getByLabelText('Summary'), {
    target: { value: 'My correction' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Reload before saving'
  )
  expect(screen.getByLabelText('Summary')).toHaveValue('My correction')
  expect(saved).not.toHaveBeenCalled()
})
it('rejects without claiming a save before the server responds', async () => {
  const saved = jest.fn()
  render(<ReviewEditor development={development} onSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Reject classification' }))
  await waitFor(() => expect(saved).toHaveBeenCalled())
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).decision).toBe('rejected')
})
