'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface AgencyData {
  id: string
  name: string
  logo_url: string | null
  coverage_areas: string | null
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  approved_at: string | null
}

interface AgentMember {
  user_id?: string
  email: string
  name: string
  phone: string
  role: 'admin' | 'member'
  coverage_area: string
  is_registered: boolean
  joined_at: string | null
  headshot_url: string | null
}

interface AgencyEditFormSimpleProps {
  agency: AgencyData
  members: AgentMember[]
  currentUserId: string
}

export function AgencyEditFormSimple({ agency, members, currentUserId }: AgencyEditFormSimpleProps) {
  const [name, setName] = useState(agency.name)
  const router = useRouter()

  const handleCancel = () => {
    router.push('/agents/settings')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border-l-4 border-violet-500 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Simple Edit Test
          </h1>
          <p>Agency: {agency.name}</p>
          <p>Status: {agency.status}</p>
          <p>Members: {members.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agency Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex justify-between items-center">
          <Button onClick={handleCancel} variant="outline">
            Back to Settings
          </Button>
          <Button>
            Test Save
          </Button>
        </div>
      </div>
    </div>
  )
}