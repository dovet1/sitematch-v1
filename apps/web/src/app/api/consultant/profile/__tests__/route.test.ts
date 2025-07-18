import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '../route';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Mock the dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/supabase/server');

const mockUser = { id: 'test-user-id', email: 'test@example.com' };
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
  (createClient as jest.Mock).mockReturnValue(mockSupabase);
});

describe('/api/consultant/profile', () => {
  describe('GET', () => {
    it('returns 401 for unauthenticated user', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/consultant/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('returns 403 for non-consultant user', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { user_type: 'Occupier' },
        error: null
      });

      const request = new NextRequest('http://localhost/api/consultant/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Access denied. Only consultants can access profiles.');
    });

    it('returns null for consultant without profile', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { user_type: 'Consultant' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const request = new NextRequest('http://localhost/api/consultant/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBe(null);
    });

    it('returns profile data for consultant with profile', async () => {
      const mockProfile = {
        id: 'profile-id',
        user_id: 'test-user-id',
        full_name: 'John Doe',
        company_name: 'Test Company',
        profile_completed: true
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: { user_type: 'Consultant' }, error: null })
        .mockResolvedValueOnce({ data: mockProfile, error: null });

      const request = new NextRequest('http://localhost/api/consultant/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProfile);
    });
  });

  describe('POST', () => {
    const validProfileData = {
      full_name: 'John Doe',
      job_title: 'Senior Consultant',
      phone_number: '+44 7700 900123',
      company_name: 'Test Company',
      specializations: ['Office'],
      service_areas: ['London']
    };

    it('creates new profile successfully', async () => {
      const mockCreatedProfile = { id: 'new-profile-id', ...validProfileData };

      mockSupabase.single
        .mockResolvedValueOnce({ data: { user_type: 'Consultant' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockSupabase.insert.mockResolvedValue({ data: mockCreatedProfile, error: null });

      const request = new NextRequest('http://localhost/api/consultant/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData)
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCreatedProfile);
    });

    it('returns 400 for invalid data', async () => {
      const invalidData = { full_name: '' }; // Missing required fields

      mockSupabase.single.mockResolvedValue({
        data: { user_type: 'Consultant' },
        error: null
      });

      const request = new NextRequest('http://localhost/api/consultant/profile', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
    });

    it('returns 409 if profile already exists', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { user_type: 'Consultant' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'existing-profile' }, error: null });

      const request = new NextRequest('http://localhost/api/consultant/profile', {
        method: 'POST',
        body: JSON.stringify(validProfileData)
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Profile already exists. Use PUT to update.');
    });
  });

  describe('PUT', () => {
    const validProfileData = {
      full_name: 'John Doe Updated',
      job_title: 'Senior Consultant',
      phone_number: '+44 7700 900123',
      company_name: 'Test Company Updated',
      specializations: ['Office', 'Retail'],
      service_areas: ['London', 'Manchester']
    };

    it('updates profile successfully', async () => {
      const mockUpdatedProfile = { id: 'profile-id', ...validProfileData };

      mockSupabase.single.mockResolvedValue({
        data: { user_type: 'Consultant' },
        error: null
      });

      mockSupabase.update.mockResolvedValue({ data: mockUpdatedProfile, error: null });

      const request = new NextRequest('http://localhost/api/consultant/profile', {
        method: 'PUT',
        body: JSON.stringify(validProfileData)
      });
      
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedProfile);
    });

    it('returns 400 for invalid data', async () => {
      const invalidData = { full_name: '', phone_number: 'invalid' };

      mockSupabase.single.mockResolvedValue({
        data: { user_type: 'Consultant' },
        error: null
      });

      const request = new NextRequest('http://localhost/api/consultant/profile', {
        method: 'PUT',
        body: JSON.stringify(invalidData)
      });
      
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation error');
    });
  });
});