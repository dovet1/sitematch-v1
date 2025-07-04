// =====================================================
// File Upload Security Service - Story 3.1 Enhancement
// Server-side file validation and security measures
// =====================================================

import { createHash } from 'crypto';

// Allowed MIME types with strict validation
export const ALLOWED_IMAGE_TYPES = {
  'image/png': { ext: '.png', maxSize: 2048 * 1024, description: 'PNG Image' },
  'image/jpeg': { ext: '.jpg', maxSize: 2048 * 1024, description: 'JPEG Image' },
  'image/jpg': { ext: '.jpg', maxSize: 2048 * 1024, description: 'JPG Image' },
  'image/svg+xml': { ext: '.svg', maxSize: 1024 * 1024, description: 'SVG Image' }, // Smaller limit for SVG
} as const;

export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': { ext: '.pdf', maxSize: 10 * 1024 * 1024, description: 'PDF Document' },
  'application/msword': { ext: '.doc', maxSize: 5 * 1024 * 1024, description: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', maxSize: 5 * 1024 * 1024, description: 'Word Document' },
} as const;

// File signature (magic bytes) validation
const FILE_SIGNATURES = {
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/jpg': [0xFF, 0xD8, 0xFF],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2D], // %PDF-
} as const;

// Dangerous SVG patterns to check for
const DANGEROUS_SVG_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onload, etc.
  /<iframe[\s\S]*?>/gi,
  /<object[\s\S]*?>/gi,
  /<embed[\s\S]*?>/gi,
  /<link[\s\S]*?>/gi,
  /<meta[\s\S]*?>/gi,
];

export interface FileValidationError {
  code: string;
  message: string;
  details?: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: FileValidationError[];
  sanitizedContent?: string; // For SVG files
  fileInfo?: {
    originalName: string;
    sanitizedName: string;
    mimeType: string;
    size: number;
    hash: string;
  };
}

/**
 * Comprehensive server-side file validation
 */
export async function validateUploadedFile(
  file: File | Buffer,
  fileName: string,
  mimeType: string,
  fileCategory: 'image' | 'document' = 'image'
): Promise<FileValidationResult> {
  const errors: FileValidationError[] = [];
  
  try {
    // Get file buffer
    const buffer = file instanceof Buffer ? file : Buffer.from(await (file as File).arrayBuffer());
    
    // 1. File size validation
    const allowedTypes = fileCategory === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
    const typeConfig = (allowedTypes as any)[mimeType];
    
    if (!typeConfig) {
      errors.push({
        code: 'INVALID_MIME_TYPE',
        message: `File type ${mimeType} is not allowed`,
        details: `Allowed types: ${Object.keys(allowedTypes).join(', ')}`
      });
    } else if (buffer.length > typeConfig.maxSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `File size ${buffer.length} exceeds maximum ${typeConfig.maxSize} bytes`,
        details: `Maximum size: ${Math.round(typeConfig.maxSize / 1024 / 1024)}MB`
      });
    }

    // 2. File signature validation (magic bytes)
    const signatureValid = validateFileSignature(buffer, mimeType);
    if (!signatureValid) {
      errors.push({
        code: 'INVALID_FILE_SIGNATURE',
        message: 'File content does not match declared MIME type',
        details: 'File may be corrupted or have incorrect extension'
      });
    }

    // 3. Filename sanitization
    const sanitizedName = sanitizeFileName(fileName);
    if (sanitizedName !== fileName) {
      // This is a warning, not an error
      console.warn(`Filename sanitized: ${fileName} -> ${sanitizedName}`);
    }

    // 4. SVG-specific security validation
    let sanitizedContent: string | undefined;
    if (mimeType === 'image/svg+xml') {
      const svgValidation = await validateSVGContent(buffer.toString('utf-8'));
      if (!svgValidation.valid) {
        errors.push(...svgValidation.errors);
      } else {
        sanitizedContent = svgValidation.sanitizedContent;
      }
    }

    // 5. Generate file hash for integrity checking
    const hash = createHash('sha256').update(buffer).digest('hex');

    // 6. Additional malware scanning patterns (basic)
    const malwareCheck = scanForMalwarePatterns(buffer);
    if (!malwareCheck.valid) {
      errors.push(...malwareCheck.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedContent,
      fileInfo: {
        originalName: fileName,
        sanitizedName,
        mimeType,
        size: buffer.length,
        hash
      }
    };

  } catch (error) {
    return {
      valid: false,
      errors: [{
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }]
    };
  }
}

/**
 * Validate file signature (magic bytes)
 */
function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signature = FILE_SIGNATURES[mimeType as keyof typeof FILE_SIGNATURES];
  if (!signature) {
    // If we don't have a signature for this type, skip validation
    return true;
  }

  if (buffer.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, '') // Remove trailing dots
    .slice(0, 255) // Limit length
    .toLowerCase();
}

/**
 * Validate and sanitize SVG content
 */
async function validateSVGContent(content: string): Promise<{
  valid: boolean;
  errors: FileValidationError[];
  sanitizedContent?: string;
}> {
  const errors: FileValidationError[] = [];
  let sanitizedContent = content;

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_SVG_PATTERNS) {
    if (pattern.test(content)) {
      errors.push({
        code: 'DANGEROUS_SVG_CONTENT',
        message: 'SVG contains potentially dangerous content',
        details: `Matched pattern: ${pattern.source}`
      });
    }
  }

  // Basic SVG structure validation
  if (!content.includes('<svg') || !content.includes('</svg>')) {
    errors.push({
      code: 'INVALID_SVG_STRUCTURE',
      message: 'File does not appear to be a valid SVG',
      details: 'Missing required SVG tags'
    });
  }

  // If no errors, sanitize by removing dangerous patterns
  if (errors.length === 0) {
    for (const pattern of DANGEROUS_SVG_PATTERNS) {
      sanitizedContent = sanitizedContent.replace(pattern, '');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedContent: errors.length === 0 ? sanitizedContent : undefined
  };
}

/**
 * Basic malware pattern scanning
 */
function scanForMalwarePatterns(buffer: Buffer): {
  valid: boolean;
  errors: FileValidationError[];
} {
  const errors: FileValidationError[] = [];
  
  // Convert to string for pattern matching
  const content = buffer.toString('ascii').toLowerCase();
  
  // Suspicious patterns
  const suspiciousPatterns = [
    'eval(',
    'document.cookie',
    'window.location',
    'xmlhttprequest',
    'activexobject',
    '<script',
    'javascript:',
    'vbscript:',
    'data:text/html',
  ];

  for (const pattern of suspiciousPatterns) {
    if (content.includes(pattern)) {
      errors.push({
        code: 'SUSPICIOUS_CONTENT',
        message: 'File contains suspicious content patterns',
        details: `Suspicious pattern detected: ${pattern}`
      });
      break; // Only report the first match to avoid spam
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate secure filename for storage
 */
export function generateSecureFileName(originalName: string, hash: string): string {
  const sanitized = sanitizeFileName(originalName);
  const extension = sanitized.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const shortHash = hash.substring(0, 8);
  
  return `${timestamp}_${shortHash}.${extension}`;
}

/**
 * Validate file upload quota and rate limiting
 */
export function validateUploadQuota(
  userId: string,
  fileSize: number,
  maxFilesPerHour: number = 10,
  maxBytesPerHour: number = 50 * 1024 * 1024 // 50MB
): { allowed: boolean; reason?: string } {
  // This would integrate with a rate limiting service
  // For now, return basic validation
  
  if (fileSize > 10 * 1024 * 1024) { // 10MB per file
    return {
      allowed: false,
      reason: 'Individual file size exceeds 10MB limit'
    };
  }

  return { allowed: true };
}

/**
 * Create audit log entry for file uploads
 */
export function createFileUploadAuditLog(
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  validationResult: FileValidationResult,
  uploadResult: 'success' | 'failed',
  errorDetails?: string
): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    userId,
    fileName,
    fileSize,
    mimeType,
    validationErrors: validationResult.errors,
    uploadResult,
    errorDetails,
    fileHash: validationResult.fileInfo?.hash
  };

  // Log to audit system (console for now, would be sent to monitoring service)
  console.log('File Upload Audit:', auditEntry);
  
  // In production, this would send to a secure audit logging service
  // await auditLogger.log('file_upload', auditEntry);
}