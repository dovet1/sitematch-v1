// Basic types for the SiteMatch application

export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'business_owner' | 'public'
  created_at: string
  updated_at: string
}

export interface BusinessListing {
  id: string
  name: string
  description?: string
  address: string
  city: string
  state: string
  zip_code: string
  phone?: string
  email?: string
  website?: string
  category: string
  status: 'active' | 'pending' | 'inactive'
  owner_id: string
  created_at: string
  updated_at: string
}

export interface SearchParams {
  query?: string
  category?: string
  location?: string
  radius?: number
  page?: number
  limit?: number
}

export interface APIResponse<T> {
  data: T
  error?: string
  success: boolean
}

export interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}