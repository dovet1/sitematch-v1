import type { SavedSketch, SiteSketcherState } from '@/types/sitesketcher';

export interface CreateSketchData {
  name: string;
  description?: string;
  data: SiteSketcherState;
  thumbnail_url?: string;
  location?: {
    center: [number, number];
    zoom: number;
  };
}

export interface UpdateSketchData {
  name?: string;
  description?: string;
  data?: SiteSketcherState;
  thumbnail_url?: string;
  location?: {
    center: [number, number];
    zoom: number;
  };
}

/**
 * Fetch all sketches for the current user
 */
export async function fetchSketches(): Promise<SavedSketch[]> {
  const response = await fetch('/api/sitesketcher/sketches');

  if (!response.ok) {
    throw new Error('Failed to fetch sketches');
  }

  const { sketches } = await response.json();
  return sketches;
}

/**
 * Fetch a single sketch by ID
 */
export async function fetchSketch(id: string): Promise<SavedSketch> {
  const response = await fetch(`/api/sitesketcher/sketches/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch sketch');
  }

  const { sketch } = await response.json();
  return sketch;
}

/**
 * Create a new sketch
 */
export async function createSketch(data: CreateSketchData): Promise<SavedSketch> {
  const response = await fetch('/api/sitesketcher/sketches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create sketch');
  }

  const { sketch } = await response.json();
  return sketch;
}

/**
 * Update an existing sketch
 */
export async function updateSketch(
  id: string,
  data: UpdateSketchData
): Promise<SavedSketch> {
  const response = await fetch(`/api/sitesketcher/sketches/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update sketch');
  }

  const { sketch } = await response.json();
  return sketch;
}

/**
 * Delete a sketch
 */
export async function deleteSketch(id: string): Promise<void> {
  const response = await fetch(`/api/sitesketcher/sketches/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete sketch');
  }
}

/**
 * Duplicate a sketch
 */
export async function duplicateSketch(id: string): Promise<SavedSketch> {
  // Fetch the original sketch
  const original = await fetchSketch(id);

  // Create a new sketch with the same data but a new name
  const newSketch = await createSketch({
    name: `${original.name} (Copy)`,
    description: original.description || undefined,
    data: original.data,
    thumbnail_url: original.thumbnail_url || undefined,
    location: original.location || undefined,
  });

  return newSketch;
}
