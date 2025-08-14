'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  X, 
  Mail, 
  Phone, 
  User, 
  UserPlus, 
  Upload, 
  AlertCircle, 
  CheckCircle2,
  Users,
  Send,
  Edit,
  Trash2
} from 'lucide-react'
import Image from 'next/image'

interface DirectAgent {
  email: string
  name: string
  phone: string
  role: 'admin' | 'member'
  coverageArea: string
  headshotFile: File | null
  headshotUrl: string
}

interface InviteAgent {
  email: string
  name: string
  role: 'admin' | 'member'
}

interface WizardData {
  name: string
  description: string
  website: string
  logoFile: File | null
  logoUrl: string
  coverageAreas: string
  specialisms: string[]
  directAgents: DirectAgent[]
  inviteAgents: InviteAgent[]
}

interface TeamBuildingStepProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
  errors: string[]
}

export function TeamBuildingStep({ data, updateData, errors }: TeamBuildingStepProps) {
  const [activeTab, setActiveTab] = useState('direct')
  const [uploadError, setUploadError] = useState<string>('')
  const [editingAgentIndex, setEditingAgentIndex] = useState<number | null>(null)
  const [currentDirectAgent, setCurrentDirectAgent] = useState<DirectAgent>({
    email: '',
    name: '',
    phone: '',
    role: 'member',
    coverageArea: '',
    headshotFile: null,
    headshotUrl: ''
  })
  const [currentInviteAgent, setCurrentInviteAgent] = useState<InviteAgent>({
    email: '',
    name: '',
    role: 'member'
  })

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const isValidPhone = (phone: string): boolean => {
    if (!phone) return true // Phone is optional
    // Remove all spaces, dashes, and parentheses for validation
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    // Allow UK numbers (starting with 0, +44, or 44) and international numbers
    // Must be between 10-15 digits (allowing for country codes)
    const phoneRegex = /^(\+?44|0)?[0-9]{9,14}$/
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 10 && cleanPhone.length <= 15
  }

  const getAllEmails = (): string[] => {
    return [
      ...data.directAgents.map(a => a.email.toLowerCase()),
      ...data.inviteAgents.map(a => a.email.toLowerCase())
    ]
  }

  const addDirectAgent = () => {
    const existingEmails = getAllEmails()
    
    if (!currentDirectAgent.name.trim() || !currentDirectAgent.email.trim()) {
      return
    }

    if (!isValidEmail(currentDirectAgent.email)) {
      return
    }

    if (existingEmails.includes(currentDirectAgent.email.toLowerCase())) {
      return
    }

    if (!isValidPhone(currentDirectAgent.phone)) {
      return
    }

    updateData({
      directAgents: [...data.directAgents, { ...currentDirectAgent }]
    })

    setCurrentDirectAgent({
      email: '',
      name: '',
      phone: '',
      role: 'member',
      coverageArea: '',
      headshotFile: null,
      headshotUrl: ''
    })
  }

  const removeDirectAgent = (index: number) => {
    const updated = data.directAgents.filter((_, i) => i !== index)
    updateData({ directAgents: updated })
    // If we were editing this agent, cancel the edit
    if (editingAgentIndex === index) {
      cancelEdit()
    }
  }

  const startEditAgent = (index: number) => {
    const agent = data.directAgents[index]
    setCurrentDirectAgent({ ...agent })
    setEditingAgentIndex(index)
    setUploadError('')
  }

  const cancelEdit = () => {
    setEditingAgentIndex(null)
    setCurrentDirectAgent({
      email: '',
      name: '',
      phone: '',
      role: 'member',
      coverageArea: '',
      headshotFile: null,
      headshotUrl: ''
    })
    setUploadError('')
  }

  const updateDirectAgent = () => {
    if (editingAgentIndex === null) return

    // Get all emails except the one being edited
    const otherDirectEmails = data.directAgents
      .filter((_, i) => i !== editingAgentIndex)
      .map(a => a.email.toLowerCase())
    const inviteEmails = data.inviteAgents.map(a => a.email.toLowerCase())
    const existingEmails = [...otherDirectEmails, ...inviteEmails]
    
    if (!currentDirectAgent.name.trim() || !currentDirectAgent.email.trim()) {
      return
    }

    if (!isValidEmail(currentDirectAgent.email)) {
      return
    }

    if (existingEmails.includes(currentDirectAgent.email.toLowerCase())) {
      return
    }

    if (!isValidPhone(currentDirectAgent.phone)) {
      return
    }

    const updatedAgents = [...data.directAgents]
    updatedAgents[editingAgentIndex] = { ...currentDirectAgent }
    updateData({ directAgents: updatedAgents })
    cancelEdit()
  }

  const addInviteAgent = () => {
    const existingEmails = getAllEmails()
    
    if (!currentInviteAgent.name.trim() || !currentInviteAgent.email.trim()) {
      return
    }

    if (!isValidEmail(currentInviteAgent.email)) {
      return
    }

    if (existingEmails.includes(currentInviteAgent.email.toLowerCase())) {
      return
    }

    updateData({
      inviteAgents: [...data.inviteAgents, { ...currentInviteAgent }]
    })

    setCurrentInviteAgent({
      email: '',
      name: '',
      role: 'member'
    })
  }

  const removeInviteAgent = (index: number) => {
    const updated = data.inviteAgents.filter((_, i) => i !== index)
    updateData({ inviteAgents: updated })
  }

  const handleHeadshotUpload = (file: File) => {
    // Clear any previous errors
    setUploadError('')
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (JPG, PNG, etc.)')
      return
    }

    try {
      const previewUrl = URL.createObjectURL(file)
      setCurrentDirectAgent(prev => ({
        ...prev,
        headshotFile: file,
        headshotUrl: previewUrl
      }))
    } catch (error) {
      console.error('Error handling headshot upload:', error)
      setUploadError('Failed to process image. Please try again.')
    }
  }

  const removeHeadshot = () => {
    setUploadError('') // Clear any errors
    if (currentDirectAgent.headshotUrl && currentDirectAgent.headshotUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentDirectAgent.headshotUrl)
    }
    setCurrentDirectAgent(prev => ({
      ...prev,
      headshotFile: null,
      headshotUrl: ''
    }))
  }

  const canAddDirectAgent = () => {
    if (editingAgentIndex !== null) {
      // In edit mode, check against other emails excluding the one being edited
      const otherDirectEmails = data.directAgents
        .filter((_, i) => i !== editingAgentIndex)
        .map(a => a.email.toLowerCase())
      const inviteEmails = data.inviteAgents.map(a => a.email.toLowerCase())
      const existingEmails = [...otherDirectEmails, ...inviteEmails]
      
      return currentDirectAgent.name.trim() &&
             isValidEmail(currentDirectAgent.email) &&
             !existingEmails.includes(currentDirectAgent.email.toLowerCase()) &&
             isValidPhone(currentDirectAgent.phone)
    }
    // In add mode, check against all existing emails
    return currentDirectAgent.name.trim() &&
           isValidEmail(currentDirectAgent.email) &&
           !getAllEmails().includes(currentDirectAgent.email.toLowerCase()) &&
           isValidPhone(currentDirectAgent.phone)
  }

  const canAddInviteAgent = () => {
    return currentInviteAgent.name.trim() &&
           isValidEmail(currentInviteAgent.email) &&
           !getAllEmails().includes(currentInviteAgent.email.toLowerCase())
  }

  const totalAgents = data.directAgents.length + data.inviteAgents.length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Team Building
        </h3>
        <p className="text-gray-600">
          Add your team members now or invite them to join later. This step is optional.
        </p>
      </div>

      {/* Team Overview */}
      {totalAgents > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Team Summary</h4>
              <p className="text-sm text-blue-700">
                {data.directAgents.length} direct member{data.directAgents.length !== 1 ? 's' : ''} • 
                {' '}{data.inviteAgents.length} invitation{data.inviteAgents.length !== 1 ? 's' : ''} to send
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Building Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="direct" className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4" />
            <span>Direct Add</span>
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex items-center space-x-2">
            <Send className="w-4 h-4" />
            <span>Send Invitations</span>
          </TabsTrigger>
        </TabsList>

        {/* Direct Add Tab */}
        <TabsContent value="direct" className="space-y-6">
          <Alert>
            <UserPlus className="h-4 w-4" />
            <AlertDescription>
              <strong>Direct Add:</strong> Add team members directly with their details. 
              They'll be able to claim their profile once they sign up.
            </AlertDescription>
          </Alert>

          {/* Add Direct Agent Form */}
          <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900">
              {editingAgentIndex !== null ? 'Edit Team Member' : 'Add Team Member'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="direct-name">Full Name *</Label>
                <Input
                  id="direct-name"
                  value={currentDirectAgent.name}
                  onChange={(e) => setCurrentDirectAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-email">Email Address *</Label>
                <Input
                  id="direct-email"
                  type="email"
                  value={currentDirectAgent.email}
                  onChange={(e) => setCurrentDirectAgent(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  className={!isValidEmail(currentDirectAgent.email) && currentDirectAgent.email 
                    ? 'border-red-300' : ''}
                />
                {currentDirectAgent.email && !isValidEmail(currentDirectAgent.email) && (
                  <p className="text-xs text-red-600">Please enter a valid email address</p>
                )}
                {(() => {
                  if (editingAgentIndex !== null) {
                    // In edit mode, check against other emails
                    const otherDirectEmails = data.directAgents
                      .filter((_, i) => i !== editingAgentIndex)
                      .map(a => a.email.toLowerCase())
                    const inviteEmails = data.inviteAgents.map(a => a.email.toLowerCase())
                    const existingEmails = [...otherDirectEmails, ...inviteEmails]
                    
                    if (existingEmails.includes(currentDirectAgent.email.toLowerCase())) {
                      return <p className="text-xs text-red-600">This email is already added</p>
                    }
                  } else {
                    // In add mode, check against all emails
                    if (getAllEmails().includes(currentDirectAgent.email.toLowerCase())) {
                      return <p className="text-xs text-red-600">This email is already added</p>
                    }
                  }
                  return null
                })()}
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-phone">Phone Number</Label>
                <Input
                  id="direct-phone"
                  type="tel"
                  value={currentDirectAgent.phone}
                  onChange={(e) => setCurrentDirectAgent(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className={!isValidPhone(currentDirectAgent.phone) && currentDirectAgent.phone 
                    ? 'border-red-300' : ''}
                />
                {currentDirectAgent.phone && !isValidPhone(currentDirectAgent.phone) && (
                  <p className="text-xs text-red-600">Please enter a valid phone number</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-coverage">Coverage Area</Label>
                <Input
                  id="direct-coverage"
                  value={currentDirectAgent.coverageArea}
                  onChange={(e) => setCurrentDirectAgent(prev => ({ ...prev, coverageArea: e.target.value }))}
                  placeholder="e.g. London, South East England"
                />
                <p className="text-xs text-gray-500">
                  Geographic areas this person covers (optional)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-role">Role</Label>
                <select
                  id="direct-role"
                  value={currentDirectAgent.role}
                  onChange={(e) => setCurrentDirectAgent(prev => ({ 
                    ...prev, 
                    role: e.target.value as 'admin' | 'member' 
                  }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500">
                  Admins can manage the agency and invite other members
                </p>
              </div>
            </div>

            {/* Headshot Upload */}
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              {!currentDirectAgent.headshotUrl ? (
                <div>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <input
                        type="file"
                        id="headshot-upload"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleHeadshotUpload(file)
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('headshot-upload')?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                      </Button>
                      <p className="text-xs text-gray-500 mt-1">Optional • Max 5MB • JPG, PNG, etc.</p>
                    </div>
                  </div>
                  {uploadError && (
                    <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden">
                    <Image
                      src={currentDirectAgent.headshotUrl}
                      alt="Profile preview"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Profile photo uploaded</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeHeadshot}
                      className="text-red-600 hover:text-red-700 p-0 h-auto"
                    >
                      Remove photo
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                type="button"
                onClick={editingAgentIndex !== null ? updateDirectAgent : addDirectAgent}
                disabled={!canAddDirectAgent()}
                className="flex-1"
              >
                {editingAgentIndex !== null ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Update Team Member
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Team Member
                  </>
                )}
              </Button>
              {editingAgentIndex !== null && (
                <Button
                  type="button"
                  onClick={cancelEdit}
                  variant="outline"
                  className="px-3"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Direct Agents List */}
          {data.directAgents.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Added Team Members ({data.directAgents.length})</h4>
              {data.directAgents.map((agent, index) => (
                <div key={index} className={`flex items-center justify-between p-3 border rounded-lg ${
                  editingAgentIndex === index 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                      {agent.headshotUrl ? (
                        <Image
                          src={agent.headshotUrl}
                          alt={agent.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {agent.email}
                        </div>
                        {agent.phone && (
                          <div className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {agent.phone}
                          </div>
                        )}
                        <Badge variant={agent.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {agent.role}
                        </Badge>
                      </div>
                      {agent.coverageArea && (
                        <p className="text-xs text-gray-500 mt-1">
                          Coverage: {agent.coverageArea}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditAgent(index)}
                      className="text-blue-600 hover:text-blue-700"
                      disabled={editingAgentIndex !== null}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDirectAgent(index)}
                      className="text-red-600 hover:text-red-700"
                      disabled={editingAgentIndex !== null}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invite Tab */}
        <TabsContent value="invite" className="space-y-6">
          <Alert>
            <Send className="h-4 w-4" />
            <AlertDescription>
              <strong>Send Invitations:</strong> Email invitations to team members. 
              They'll receive a link to join your agency and can complete their own profiles.
            </AlertDescription>
          </Alert>

          {/* Add Invitation Form */}
          <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900">Send Invitation</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full Name *</Label>
                <Input
                  id="invite-name"
                  value={currentInviteAgent.name}
                  onChange={(e) => setCurrentInviteAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={currentInviteAgent.email}
                  onChange={(e) => setCurrentInviteAgent(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                  className={!isValidEmail(currentInviteAgent.email) && currentInviteAgent.email 
                    ? 'border-red-300' : ''}
                />
                {currentInviteAgent.email && !isValidEmail(currentInviteAgent.email) && (
                  <p className="text-xs text-red-600">Please enter a valid email address</p>
                )}
                {getAllEmails().includes(currentInviteAgent.email.toLowerCase()) && (
                  <p className="text-xs text-red-600">This email is already added</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={currentInviteAgent.role}
                  onChange={(e) => setCurrentInviteAgent(prev => ({ 
                    ...prev, 
                    role: e.target.value as 'admin' | 'member' 
                  }))}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <Button
              type="button"
              onClick={addInviteAgent}
              disabled={!canAddInviteAgent()}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Invitation List
            </Button>
          </div>

          {/* Invite Agents List */}
          {data.inviteAgents.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                Invitations to Send ({data.inviteAgents.length})
              </h4>
              {data.inviteAgents.map((agent, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <span>{agent.email}</span>
                        <Badge variant={agent.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {agent.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInviteAgent(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Send className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Ready to send</p>
                    <p className="text-blue-700">
                      These invitations will be sent after you create your agency. 
                      Recipients have 7 days to accept.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Skip Option */}
      {totalAgents === 0 && (
        <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="font-medium text-gray-900 mb-2">Build Your Team Later</h4>
          <p className="text-sm text-gray-600 mb-4">
            No problem! You can add team members anytime after creating your agency.
          </p>
          <Button variant="outline" size="sm">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Continue Without Team
          </Button>
        </div>
      )}

    </div>
  )
}