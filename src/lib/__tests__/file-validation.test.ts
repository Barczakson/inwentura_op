import {
  validateFile,
  validateExcelStructure,
  formatFileSize,
  getValidationSummary,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
} from '../file-validation'

// Mock File constructor for testing
class MockFile {
  constructor(
    private content: string,
    public name: string,
    private options: { type?: string } = {}
  ) {}

  get size() {
    return this.content.length
  }

  get type() {
    return this.options.type || ''
  }

  arrayBuffer() {
    const encoder = new TextEncoder()
    return Promise.resolve(encoder.encode(this.content).buffer)
  }
}

// Helper to create mock files
const createMockFile = (name: string, size: number, type: string = '') => {
  const content = 'x'.repeat(size)
  return new MockFile(content, name, { type }) as unknown as File
}

// Helper to create XLSX-like file with proper header
const createMockXlsxFile = (name: string, size: number) => {
  // XLSX files start with ZIP header: PK\x03\x04
  const zipHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04])
  const content = String.fromCharCode(...zipHeader) + 'x'.repeat(size - 4)
  return new MockFile(content, name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) as unknown as File
}

describe('File Validation', () => {
  describe('validateFile', () => {
    it('should validate a correct Excel file', () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.warnings).toBeUndefined()
    })

    it('should reject files that are too large', () => {
      const file = createMockFile('large.xlsx', MAX_FILE_SIZE + 1, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Plik jest za duży')
      expect(result.error).toContain('10MB')
    })

    it('should reject files with invalid extensions', () => {
      const file = createMockFile('test.txt', 1024, 'text/plain')
      const result = validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Nieprawidłowe rozszerzenie pliku')
      expect(result.error).toContain('.xlsx, .xls')
    })

    it('should reject files that are too small', () => {
      const file = createMockFile('tiny.xlsx', 50, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('podejrzanie mały')
    })

    it('should warn about large files', () => {
      const file = createMockFile('large.xlsx', 6 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Plik jest bardzo duży')
    })

    it('should warn about octet-stream MIME type', () => {
      const file = createMockFile('test.xlsx', 1024, 'application/octet-stream')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Typ pliku nie został rozpoznany automatycznie')
    })

    it('should warn about unknown MIME types', () => {
      const file = createMockFile('test.xlsx', 1024, 'application/unknown')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Nietypowy typ MIME')
      expect(result.warnings?.[0]).toContain('application/unknown')
    })

    it('should handle files without extensions', () => {
      const file = createMockFile('test', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Nieprawidłowe rozszerzenie pliku')
    })

    it('should handle case-insensitive extensions', () => {
      const file = createMockFile('test.XLSX', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
    })

    it('should validate .xls files', () => {
      const file = createMockFile('test.xls', 1024, 'application/vnd.ms-excel')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
    })

    it('should handle multiple warnings', () => {
      const file = createMockFile('large.xlsx', 6 * 1024 * 1024, 'application/unknown')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings).toContain('Plik jest bardzo duży')
      expect(result.warnings?.[1]).toContain('Nietypowy typ MIME')
    })
  })

  describe('validateExcelStructure', () => {
    it('should validate XLSX file structure', async () => {
      const file = createMockXlsxFile('test.xlsx', 1024)
      const result = await validateExcelStructure(file)

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject XLSX files without ZIP header', async () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = await validateExcelStructure(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('nie jest prawidłowym plikiem XLSX')
    })

    it('should reject files that are too small for Excel structure', async () => {
      const file = createMockFile('test.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = await validateExcelStructure(file)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('za mały aby być prawidłowym plikiem Excel')
    })

    it('should handle file reading errors', async () => {
      // Create a file that will throw an error when reading
      const mockFile = {
        name: 'test.xlsx',
        arrayBuffer: jest.fn().mockRejectedValue(new Error('Read error'))
      } as unknown as File

      const result = await validateExcelStructure(mockFile)

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Nie udało się przeczytać pliku')
    })

    it('should validate .xls files (non-ZIP format)', async () => {
      const file = createMockFile('test.xls', 1024, 'application/vnd.ms-excel')
      const result = await validateExcelStructure(file)

      expect(result.isValid).toBe(true)
    })

    it('should handle files with minimum valid size', async () => {
      const file = createMockXlsxFile('test.xlsx', 512)
      const result = await validateExcelStructure(file)

      expect(result.isValid).toBe(true)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(512)).toBe('512 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('should handle large numbers', () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
      expect(formatFileSize(1.75 * 1024 * 1024 * 1024)).toBe('1.75 GB')
    })

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1234567)).toBe('1.18 MB')
      expect(formatFileSize(1234)).toBe('1.21 KB')
    })
  })

  describe('getValidationSummary', () => {
    it('should return error message for invalid files', () => {
      const file = createMockFile('test.txt', 1024)
      const result = { isValid: false, error: 'Invalid file type' }
      
      const summary = getValidationSummary(result, file)
      
      expect(summary).toBe('Invalid file type')
    })

    it('should return default error for invalid files without error message', () => {
      const file = createMockFile('test.txt', 1024)
      const result = { isValid: false }
      
      const summary = getValidationSummary(result, file)
      
      expect(summary).toBe('Plik jest nieprawidłowy')
    })

    it('should return success message for valid files', () => {
      const file = createMockFile('test.xlsx', 1024)
      const result = { isValid: true }
      
      const summary = getValidationSummary(result, file)
      
      expect(summary).toBe('✅ Plik prawidłowy (1 KB)')
    })

    it('should include warnings in summary', () => {
      const file = createMockFile('test.xlsx', 6 * 1024 * 1024)
      const result = { 
        isValid: true, 
        warnings: ['Plik jest bardzo duży', 'Nietypowy typ MIME'] 
      }
      
      const summary = getValidationSummary(result, file)
      
      expect(summary).toContain('✅ Plik prawidłowy (6 MB)')
      expect(summary).toContain('⚠️ Ostrzeżenia: Plik jest bardzo duży, Nietypowy typ MIME')
    })

    it('should handle empty warnings array', () => {
      const file = createMockFile('test.xlsx', 1024)
      const result = { isValid: true, warnings: [] }
      
      const summary = getValidationSummary(result, file)
      
      expect(summary).toBe('✅ Plik prawidłowy (1 KB)')
      expect(summary).not.toContain('⚠️')
    })
  })

  describe('Constants', () => {
    it('should have correct MAX_FILE_SIZE', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024) // 10MB
    })

    it('should have correct ALLOWED_MIME_TYPES', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(ALLOWED_MIME_TYPES).toContain('application/vnd.ms-excel')
      expect(ALLOWED_MIME_TYPES).toContain('application/octet-stream')
    })

    it('should have correct ALLOWED_EXTENSIONS', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.xlsx')
      expect(ALLOWED_EXTENSIONS).toContain('.xls')
    })
  })

  describe('Edge Cases', () => {
    it('should handle files with multiple dots in name', () => {
      const file = createMockFile('test.backup.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
    })

    it('should handle files with no extension but ending with dot', () => {
      const file = createMockFile('test.', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(false)
    })

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(200) + '.xlsx'
      const file = createMockFile(longName, 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const result = validateFile(file)

      expect(result.isValid).toBe(true)
    })

    it('should handle files at exact size limits', () => {
      // File at exact max size
      const maxSizeFile = createMockFile('max.xlsx', MAX_FILE_SIZE, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const maxResult = validateFile(maxSizeFile)
      expect(maxResult.isValid).toBe(true)

      // File at warning threshold
      const warningFile = createMockFile('warning.xlsx', 5 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const warningResult = validateFile(warningFile)
      expect(warningResult.isValid).toBe(true)
      expect(warningResult.warnings).toBeUndefined()

      // File just over warning threshold
      const overWarningFile = createMockFile('over.xlsx', 5 * 1024 * 1024 + 1, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const overWarningResult = validateFile(overWarningFile)
      expect(overWarningResult.isValid).toBe(true)
      expect(overWarningResult.warnings).toContain('Plik jest bardzo duży')
    })
  })
})
