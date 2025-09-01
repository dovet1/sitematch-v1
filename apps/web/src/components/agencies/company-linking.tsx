'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Building2, 
  Loader2,
  Link as LinkIcon,
  X,
  Search,
  CheckSquare,
  Square
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { createClientClient } from '@/lib/supabase'

interface Company {
  id: string
  company_name: string
  company_domain?: string
  clearbit_logo: boolean
  logo_url?: string
  logo_bucket?: string
  linked: boolean
}

interface CompanyLinkingProps {
  agencyId: string
}

export function CompanyLinking({ agencyId }: CompanyLinkingProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLinking, setIsLinking] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedForLinking, setSelectedForLinking] = useState<string[]>([])
  const [isBulkLinking, setIsBulkLinking] = useState(false)

  useEffect(() => {
    fetchCompanies()
  }, [agencyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCompanies = async () => {
    try {
      setIsLoading(true)
      
      // Fetch user's approved listings
      const response = await fetch(`/api/agencies/${agencyId}/available-companies`, {
        credentials: 'include'
      })
      if (!response.ok) {
        console.error('Failed to fetch companies, status:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error('Failed to fetch companies')
      }
      
      const result = await response.json()
      console.log('Fetched companies:', result) // Debug log
      const companiesList = result.data || []
      
      // Separate linked and unlinked companies
      const linked = companiesList.filter((c: Company) => c.linked)
      const unlinked = companiesList.filter((c: Company) => !c.linked)
      
      setCompanies(companiesList)
      setLinkedCompanies(linked)
      setSelectedCompanies(linked.map((c: Company) => c.id))
      
    } catch (error) {
      console.error('Error fetching companies:', error)
      toast.error('Failed to load companies')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkCompany = async (companyId: string) => {
    try {
      setIsLinking(companyId)
      
      const newSelection = [...selectedCompanies, companyId]
      setSelectedCompanies(newSelection)
      
      const response = await fetch(`/api/agencies/${agencyId}/link-companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: newSelection })
      })
      
      if (!response.ok) throw new Error('Failed to link company')
      
      toast.success('Company linked successfully')
      await fetchCompanies()
      setIsModalOpen(false)
      setSearchQuery('')
      setSelectedForLinking([])
      
    } catch (error) {
      console.error('Error linking company:', error)
      toast.error('Failed to link company')
      // Revert optimistic update
      setSelectedCompanies(prev => prev.filter(id => id !== companyId))
    } finally {
      setIsLinking(null)
    }
  }

  const handleRemoveLinkedCompany = async (companyId: string) => {
    try {
      setIsLinking(companyId)
      
      const newSelection = selectedCompanies.filter(id => id !== companyId)
      setSelectedCompanies(newSelection)
      
      const response = await fetch(`/api/agencies/${agencyId}/link-companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: newSelection })
      })
      
      if (!response.ok) throw new Error('Failed to remove company link')
      
      toast.success('Company unlinked successfully')
      await fetchCompanies()
      
    } catch (error) {
      console.error('Error removing company link:', error)
      toast.error('Failed to unlink company')
      // Revert optimistic update
      setSelectedCompanies(prev => [...prev, companyId])
    } finally {
      setIsLinking(null)
    }
  }

  const handleBulkLink = async () => {
    if (selectedForLinking.length === 0) return

    try {
      setIsBulkLinking(true)
      
      const newSelection = [...selectedCompanies, ...selectedForLinking]
      setSelectedCompanies(newSelection)
      
      const response = await fetch(`/api/agencies/${agencyId}/link-companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: newSelection })
      })
      
      if (!response.ok) throw new Error('Failed to link companies')
      
      toast.success(`${selectedForLinking.length} companies linked successfully`)
      await fetchCompanies()
      setIsModalOpen(false)
      setSearchQuery('')
      setSelectedForLinking([])
      
    } catch (error) {
      console.error('Error linking companies:', error)
      toast.error('Failed to link companies')
      // Revert optimistic update
      setSelectedCompanies(prev => prev.filter(id => !selectedForLinking.includes(id)))
    } finally {
      setIsBulkLinking(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedForLinking.length === filteredAvailableCompanies.length) {
      setSelectedForLinking([])
    } else {
      setSelectedForLinking(filteredAvailableCompanies.map(c => c.id))
    }
  }

  const handleToggleCompany = (companyId: string) => {
    setSelectedForLinking(prev => 
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  const resetModalState = () => {
    setSearchQuery('')
    setSelectedForLinking([])
  }

  const getCompanyLogo = (company: Company) => {
    if (company.logo_url) {
      // If it's already a full URL, use as-is
      if (company.logo_url.startsWith('http')) {
        return company.logo_url
      }
      
      // If it's a file path, convert to Supabase storage URL using the correct bucket
      const supabase = createClientClient()
      const bucket = company.logo_bucket || 'listings' // fallback to listings if no bucket specified
      const { data } = supabase.storage.from(bucket).getPublicUrl(company.logo_url)
      return data.publicUrl
    } else if (company.clearbit_logo && company.company_domain) {
      return `https://logo.clearbit.com/${company.company_domain}`
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    )
  }

  const availableCompanies = companies.filter(c => !c.linked)
  
  // Filter companies based on search query
  const filteredAvailableCompanies = availableCompanies.filter(company =>
    company.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-violet-600" />
          Client Companies
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Link your active property requirements to showcase your client portfolio
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-slate-900 mb-2">No Companies Available</h4>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            You need approved property listings to link companies. Create and submit listings first, then they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Linked Companies - Primary Focus */}
          {linkedCompanies.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-900">
                  Linked Companies ({linkedCompanies.length})
                </h4>
                {availableCompanies.length > 0 && (
                  <Dialog open={isModalOpen} onOpenChange={(open) => {
                    setIsModalOpen(open)
                    if (!open) resetModalState()
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-violet-300 text-violet-700 hover:bg-violet-50"
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Link More ({availableCompanies.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-violet-600" />
                          Link Companies
                        </DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        {/* Search and Select All */}
                        <div className="space-y-3 p-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                              placeholder="Search companies..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 border-slate-200 focus-visible:border-violet-500"
                            />
                          </div>
                          
                          {filteredAvailableCompanies.length > 0 && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedForLinking.length === filteredAvailableCompanies.length}
                                  onCheckedChange={handleSelectAll}
                                  id="select-all"
                                />
                                <label htmlFor="select-all" className="text-sm text-slate-600 cursor-pointer">
                                  Select all {filteredAvailableCompanies.length} companies
                                </label>
                              </div>
                              
                              {selectedForLinking.length > 0 && (
                                <span className="text-sm text-violet-600 font-medium">
                                  {selectedForLinking.length} selected
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Results */}
                        <div className="flex-1 overflow-y-auto">
                          {filteredAvailableCompanies.length > 0 ? (
                            <div className="space-y-2">
                              {filteredAvailableCompanies.map((company) => (
                                <div
                                  key={company.id}
                                  className={`flex items-center gap-3 p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
                                    selectedForLinking.includes(company.id)
                                      ? 'bg-violet-50 border-violet-300 shadow-sm'
                                      : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm'
                                  }`}
                                  onClick={() => handleToggleCompany(company.id)}
                                >
                                  <Checkbox
                                    checked={selectedForLinking.includes(company.id)}
                                    onCheckedChange={() => handleToggleCompany(company.id)}
                                  />
                                  
                                  {getCompanyLogo(company) ? (
                                    <Image
                                      src={getCompanyLogo(company)!}
                                      alt={company.company_name}
                                      width={40}
                                      height={40}
                                      className="w-10 h-10 object-contain rounded"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                                      <Building2 className="w-5 h-5 text-slate-400" />
                                    </div>
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 truncate">
                                      {company.company_name}
                                    </p>
                                    <p className="text-sm text-slate-500">Property listing</p>
                                  </div>
                                  
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleLinkCompany(company.id)
                                    }}
                                    disabled={isLinking === company.id}
                                    size="sm"
                                    variant="ghost"
                                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                  >
                                    {isLinking === company.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Link'
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                              <p className="text-slate-500">
                                {searchQuery ? 'No companies match your search' : 'No companies available to link'}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Footer Actions */}
                        {selectedForLinking.length > 0 && (
                          <div className="border-t pt-4 space-y-3">
                            <div className="text-sm text-slate-600 text-center">
                              {selectedForLinking.length === 1 
                                ? '1 company selected'
                                : `${selectedForLinking.length} companies selected`
                              }
                            </div>
                            <div className="flex gap-3">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedForLinking([])}
                                disabled={isBulkLinking}
                                className="flex-1"
                              >
                                Clear Selection
                              </Button>
                              <Button
                                onClick={handleBulkLink}
                                disabled={isBulkLinking || selectedForLinking.length === 0}
                                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                              >
                                {isBulkLinking ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Linking...
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    Link {selectedForLinking.length}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {linkedCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="group relative bg-white border border-violet-200/50 rounded-xl p-4 hover:border-violet-300 hover:shadow-md transition-all duration-200"
                  >
                    <button
                      onClick={() => handleRemoveLinkedCompany(company.id)}
                      disabled={isLinking === company.id}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg bg-white/90 hover:bg-red-50 border border-slate-200 hover:border-red-200"
                      title="Unlink company"
                    >
                      {isLinking === company.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                      ) : (
                        <X className="h-3 w-3 text-slate-500 hover:text-red-600" />
                      )}
                    </button>
                    
                    <div className="flex flex-col items-center text-center">
                      {getCompanyLogo(company) ? (
                        <Image
                          src={getCompanyLogo(company)!}
                          alt={company.company_name}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-contain mb-3"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-3">
                          <Building2 className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">
                        {company.company_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-violet-50/30 rounded-xl border-2 border-dashed border-violet-200">
              <LinkIcon className="h-12 w-12 text-violet-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-900 mb-2">No Client Companies Yet</h4>
              <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                Link your active property requirements to showcase the companies you're working with
              </p>
              {availableCompanies.length > 0 && (
                <Dialog open={isModalOpen} onOpenChange={(open) => {
                  setIsModalOpen(open)
                  if (!open) resetModalState()
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Browse {availableCompanies.length} Available Companies
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-violet-600" />
                        Link Companies
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                      {/* Search and Select All */}
                      <div className="space-y-3 p-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                          <Input
                            placeholder="Search companies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 border-slate-200 focus-visible:border-violet-500"
                          />
                        </div>
                        
                        {filteredAvailableCompanies.length > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedForLinking.length === filteredAvailableCompanies.length}
                                onCheckedChange={handleSelectAll}
                                id="select-all-empty"
                              />
                              <label htmlFor="select-all-empty" className="text-sm text-slate-600 cursor-pointer">
                                Select all {filteredAvailableCompanies.length} companies
                              </label>
                            </div>
                            
                            {selectedForLinking.length > 0 && (
                              <span className="text-sm text-violet-600 font-medium">
                                {selectedForLinking.length} selected
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Results */}
                      <div className="flex-1 overflow-y-auto">
                        {filteredAvailableCompanies.length > 0 ? (
                          <div className="space-y-2">
                            {filteredAvailableCompanies.map((company) => (
                              <div
                                key={company.id}
                                className={`flex items-center gap-3 p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
                                  selectedForLinking.includes(company.id)
                                    ? 'bg-violet-50 border-violet-300 shadow-sm'
                                    : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm'
                                }`}
                                onClick={() => handleToggleCompany(company.id)}
                              >
                                <Checkbox
                                  checked={selectedForLinking.includes(company.id)}
                                  onCheckedChange={() => handleToggleCompany(company.id)}
                                />
                                
                                {getCompanyLogo(company) ? (
                                  <Image
                                    src={getCompanyLogo(company)!}
                                    alt={company.company_name}
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 object-contain rounded"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 truncate">
                                    {company.company_name}
                                  </p>
                                  <p className="text-sm text-slate-500">Property listing</p>
                                </div>
                                
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleLinkCompany(company.id)
                                  }}
                                  disabled={isLinking === company.id}
                                  size="sm"
                                  variant="ghost"
                                  className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                >
                                  {isLinking === company.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Link'
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">
                              {searchQuery ? 'No companies match your search' : 'No companies available to link'}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Footer Actions */}
                      {selectedForLinking.length > 0 && (
                        <div className="border-t pt-4 space-y-3">
                          <div className="text-sm text-slate-600 text-center">
                            {selectedForLinking.length === 1 
                              ? '1 company selected'
                              : `${selectedForLinking.length} companies selected`
                            }
                          </div>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setSelectedForLinking([])}
                              disabled={isBulkLinking}
                              className="flex-1"
                            >
                              Clear Selection
                            </Button>
                            <Button
                              onClick={handleBulkLink}
                              disabled={isBulkLinking || selectedForLinking.length === 0}
                              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                            >
                              {isBulkLinking ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Linking...
                                </>
                              ) : (
                                <>
                                  <LinkIcon className="h-4 w-4 mr-2" />
                                  Link {selectedForLinking.length}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}