export type LeadPersona = 'agent' | 'investor' | 'landlord' | 'vendor';

export interface Lead {
  id: string;
  email: string;
  persona: LeadPersona;
  created_at: string;
}

export interface LeadCaptureFormData {
  email: string;
  persona: LeadPersona;
}

export interface LeadCaptureResponse {
  success: boolean;
  message?: string;
  error?: string;
}