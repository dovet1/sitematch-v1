/**
 * @jest-environment node
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/supabase', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'test-id', email: 'test@example.com', persona: 'agent' },
            error: null
          }))
        }))
      }))
    }))
  }))
}));

jest.mock('@/lib/resend', () => ({
  subscribeToNewsletter: jest.fn(() => Promise.resolve({ success: true }))
}));

describe('/api/leads POST', () => {
  it('should create a lead successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        persona: 'agent'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Thank you for your interest');
  });

  it('should return 400 for missing email', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        persona: 'agent'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Email and persona are required');
  });

  it('should return 400 for invalid email format', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        persona: 'agent'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid email format');
  });

  it('should return 400 for invalid persona', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        persona: 'invalid'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid persona');
  });
});