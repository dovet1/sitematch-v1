// =====================================================
// Video URL Utilities
// Helper functions for parsing and embedding external videos
// =====================================================

export type VideoProvider = 'youtube' | 'vimeo' | 'direct';

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract Vimeo video ID from various URL formats
 */
function extractVimeoId(url: string): string | null {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Parse video URL and return provider, ID, and embed URL
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url) return null;

  // Try YouTube
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return {
      provider: 'youtube',
      videoId: youtubeId,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
    };
  }

  // Try Vimeo
  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnailUrl: undefined // Vimeo thumbnails require API call
    };
  }

  // Direct video URL (mp4, webm, etc)
  if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
    return {
      provider: 'direct',
      videoId: url,
      embedUrl: url
    };
  }

  return null;
}

/**
 * Validate if URL is a supported video URL
 */
export function isValidVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

/**
 * Get embed HTML for a video URL
 */
export function getVideoEmbedHtml(url: string, title: string = 'Video'): string | null {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  if (parsed.provider === 'direct') {
    return `<video controls class="w-full h-full"><source src="${parsed.embedUrl}" type="video/mp4"></video>`;
  }

  return `<iframe src="${parsed.embedUrl}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>`;
}
