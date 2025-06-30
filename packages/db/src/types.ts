import type { User, BusinessListing, UserRole, BusinessStatus } from '@prisma/client'

// Re-export Prisma types
export type {
  User,
  BusinessListing,
  UserRole,
  BusinessStatus,
}

// Extended types for API responses
export interface UserWithListings extends User {
  businessListings: BusinessListing[]
}

export interface BusinessListingWithOwner extends BusinessListing {
  owner: User
}

// Create types (without generated fields)
export type CreateUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateUser = Partial<CreateUser>

export type CreateBusinessListing = Omit<BusinessListing, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateBusinessListing = Partial<CreateBusinessListing>

// Search and filter types
export interface BusinessListingFilters {
  category?: string
  city?: string
  state?: string
  status?: BusinessStatus
  search?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
}

export interface PaginatedResults<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}