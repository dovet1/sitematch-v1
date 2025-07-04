import {
  validateUploadedFile,
  generateSecureFileName,
  validateUploadQuota,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES
} from '../file-upload-security';

describe('File Upload Security Service', () => {
  // Helper to create test files
  const createTestFile = (content: string | number[], mimeType: string): Buffer => {
    if (Array.isArray(content)) {
      return Buffer.from(content);
    }
    return Buffer.from(content, 'utf-8');
  };

  describe('validateUploadedFile', () => {
    describe('Image validation', () => {
      it('should validate a proper PNG file', async () => {
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        const buffer = createTestFile([...pngSignature, ...Array(100).fill(0)], 'image/png');
        
        const result = await validateUploadedFile(buffer, 'test.png', 'image/png', 'image');
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.fileInfo?.mimeType).toBe('image/png');
        expect(result.fileInfo?.hash).toBeDefined();
      });

      it('should validate a proper JPEG file', async () => {
        const jpegSignature = [0xFF, 0xD8, 0xFF];
        const buffer = createTestFile([...jpegSignature, ...Array(100).fill(0)], 'image/jpeg');
        
        const result = await validateUploadedFile(buffer, 'test.jpg', 'image/jpeg', 'image');
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject file with invalid MIME type', async () => {
        const buffer = createTestFile('test content', 'text/plain');
        
        const result = await validateUploadedFile(buffer, 'test.txt', 'text/plain', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_MIME_TYPE');
      });

      it('should reject file that is too large', async () => {
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        const largeContent = Array(3 * 1024 * 1024).fill(0); // 3MB
        const buffer = createTestFile([...pngSignature, ...largeContent], 'image/png');
        
        const result = await validateUploadedFile(buffer, 'large.png', 'image/png', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
      });

      it('should reject file with mismatched signature', async () => {
        // Create a file with PNG MIME type but JPEG signature
        const jpegSignature = [0xFF, 0xD8, 0xFF];
        const buffer = createTestFile([...jpegSignature, ...Array(100).fill(0)], 'image/png');
        
        const result = await validateUploadedFile(buffer, 'fake.png', 'image/png', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_FILE_SIGNATURE')).toBe(true);
      });
    });

    describe('SVG validation', () => {
      it('should validate safe SVG content', async () => {
        const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
        const buffer = createTestFile(safeSvg, 'image/svg+xml');
        
        const result = await validateUploadedFile(buffer, 'safe.svg', 'image/svg+xml', 'image');
        
        expect(result.valid).toBe(true);
        expect(result.sanitizedContent).toBeDefined();
      });

      it('should reject SVG with script tags', async () => {
        const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><circle cx="50" cy="50" r="40"/></svg>';
        const buffer = createTestFile(maliciousSvg, 'image/svg+xml');
        
        const result = await validateUploadedFile(buffer, 'malicious.svg', 'image/svg+xml', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'DANGEROUS_SVG_CONTENT')).toBe(true);
      });

      it('should reject SVG with javascript: URLs', async () => {
        const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle cx="50" cy="50" r="40"/></a></svg>';
        const buffer = createTestFile(maliciousSvg, 'image/svg+xml');
        
        const result = await validateUploadedFile(buffer, 'malicious.svg', 'image/svg+xml', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'DANGEROUS_SVG_CONTENT')).toBe(true);
      });

      it('should reject SVG with event handlers', async () => {
        const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" onclick="alert(1)"/></svg>';
        const buffer = createTestFile(maliciousSvg, 'image/svg+xml');
        
        const result = await validateUploadedFile(buffer, 'malicious.svg', 'image/svg+xml', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'DANGEROUS_SVG_CONTENT')).toBe(true);
      });

      it('should reject invalid SVG structure', async () => {
        const invalidSvg = '<notsvg>invalid content</notsvg>';
        const buffer = createTestFile(invalidSvg, 'image/svg+xml');
        
        const result = await validateUploadedFile(buffer, 'invalid.svg', 'image/svg+xml', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_SVG_STRUCTURE')).toBe(true);
      });
    });

    describe('Document validation', () => {
      it('should validate PDF files', async () => {
        const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-
        const buffer = createTestFile([...pdfSignature, ...Array(100).fill(0)], 'application/pdf');
        
        const result = await validateUploadedFile(buffer, 'document.pdf', 'application/pdf', 'document');
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject document files in image category', async () => {
        const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2D];
        const buffer = createTestFile([...pdfSignature, ...Array(100).fill(0)], 'application/pdf');
        
        const result = await validateUploadedFile(buffer, 'document.pdf', 'application/pdf', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_MIME_TYPE');
      });
    });

    describe('Malware scanning', () => {
      it('should detect suspicious JavaScript patterns', async () => {
        const suspiciousContent = 'eval(document.cookie)';
        const buffer = createTestFile(suspiciousContent, 'text/plain');
        
        const result = await validateUploadedFile(buffer, 'suspicious.txt', 'text/plain', 'document');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'SUSPICIOUS_CONTENT')).toBe(true);
      });

      it('should detect XMLHttpRequest patterns', async () => {
        const suspiciousContent = 'new XMLHttpRequest()';
        const buffer = createTestFile(suspiciousContent, 'text/plain');
        
        const result = await validateUploadedFile(buffer, 'suspicious.txt', 'text/plain', 'document');
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'SUSPICIOUS_CONTENT')).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should handle validation errors gracefully', async () => {
        // Mock a scenario where buffer processing fails
        const invalidBuffer = {} as Buffer;
        
        const result = await validateUploadedFile(invalidBuffer, 'test.png', 'image/png', 'image');
        
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('generateSecureFileName', () => {
    it('should generate secure filename with timestamp and hash', () => {
      const originalName = 'my test file.png';
      const hash = 'abcdef1234567890abcdef1234567890abcdef12';
      
      const result = generateSecureFileName(originalName, hash);
      
      expect(result).toMatch(/^\d+_abcdef12\.png$/);
    });

    it('should handle files without extensions', () => {
      const originalName = 'noextension';
      const hash = 'abcdef1234567890abcdef1234567890abcdef12';
      
      const result = generateSecureFileName(originalName, hash);
      
      expect(result).toMatch(/^\d+_abcdef12\.bin$/);
    });

    it('should sanitize special characters in filename', () => {
      const originalName = '../../../etc/passwd.png';
      const hash = 'abcdef1234567890abcdef1234567890abcdef12';
      
      const result = generateSecureFileName(originalName, hash);
      
      expect(result).toMatch(/^\d+_abcdef12\.png$/);
      expect(result).not.toContain('../');
      expect(result).not.toContain('/');
    });
  });

  describe('validateUploadQuota', () => {
    it('should allow files within size limits', () => {
      const result = validateUploadQuota('user-123', 1024 * 1024); // 1MB
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject files that are too large', () => {
      const result = validateUploadQuota('user-123', 15 * 1024 * 1024); // 15MB
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds 10MB limit');
    });
  });

  describe('Constants validation', () => {
    it('should have proper image type configurations', () => {
      expect(ALLOWED_IMAGE_TYPES['image/png']).toBeDefined();
      expect(ALLOWED_IMAGE_TYPES['image/jpeg']).toBeDefined();
      expect(ALLOWED_IMAGE_TYPES['image/svg+xml']).toBeDefined();
      
      Object.values(ALLOWED_IMAGE_TYPES).forEach(config => {
        expect(config.ext).toBeDefined();
        expect(config.maxSize).toBeGreaterThan(0);
        expect(config.description).toBeDefined();
      });
    });

    it('should have proper document type configurations', () => {
      expect(ALLOWED_DOCUMENT_TYPES['application/pdf']).toBeDefined();
      
      Object.values(ALLOWED_DOCUMENT_TYPES).forEach(config => {
        expect(config.ext).toBeDefined();
        expect(config.maxSize).toBeGreaterThan(0);
        expect(config.description).toBeDefined();
      });
    });

    it('should have reasonable size limits', () => {
      // Images should be smaller than documents
      const maxImageSize = Math.max(...Object.values(ALLOWED_IMAGE_TYPES).map(c => c.maxSize));
      const maxDocumentSize = Math.max(...Object.values(ALLOWED_DOCUMENT_TYPES).map(c => c.maxSize));
      
      expect(maxImageSize).toBeLessThanOrEqual(maxDocumentSize);
      
      // SVG should have smaller limit than other images
      expect(ALLOWED_IMAGE_TYPES['image/svg+xml'].maxSize).toBeLessThan(ALLOWED_IMAGE_TYPES['image/png'].maxSize);
    });
  });
});