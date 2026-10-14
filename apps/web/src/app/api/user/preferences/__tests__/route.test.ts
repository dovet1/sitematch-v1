/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { createServerClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }))

const getUser = jest.fn()
const updateUser = jest.fn()

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(createServerClient as jest.Mock).mockResolvedValue({ auth: { getUser, updateUser } })
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  updateUser.mockResolvedValue({ error: null })
})

describe('PATCH /api/user/preferences', () => {
  it('rejects a signed-out request', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await patch({ dont_show_mode_chooser: true })
    expect(res.status).toBe(401)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean value', async () => {
    const res = await patch({ dont_show_mode_chooser: 'yes' })
    expect(res.status).toBe(400)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('merges only the known key into the account metadata', async () => {
    const res = await patch({ dont_show_mode_chooser: true, role: 'admin' })
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({ data: { dont_show_mode_chooser: true } })
  })

  it('reports a failed save', async () => {
    updateUser.mockResolvedValue({ error: new Error('nope') })
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await patch({ dont_show_mode_chooser: false })
    expect(res.status).toBe(500)
  })
})
