import { NextRequest } from 'next/server'
import { POST } from '../route'
import * as XLSX from 'xlsx'

// Mock XLSX library
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}))

// Mock column detection
jest.mock('@/lib/column-detection', () => ({
  detectColumns: jest.fn(),
  createDefaultMapping: jest.fn(),
}))

import { detectColumns, createDefaultMapping } from '@/lib/column-detection'

const mockDetectColumns = detectColumns as jest.MockedFunction<typeof detectColumns>
const mockCreateDefaultMapping = createDefaultMapping as jest.MockedFunction<typeof createDefaultMapping>
const mockXLSXRead = XLSX.read as jest.MockedFunction<typeof XLSX.read>
const mockSheetToJson = XLSX.utils.sheet_to_json as jest.MockedFunction<typeof XLSX.utils.sheet_to_json>

describe('/api/excel/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockFile = (name: string, size: number, type: string) => {
    const buffer = Buffer.alloc(size, 'mock excel content')
    const file = new File([buffer], name, { type }) as File
    // Override the size property for testing
    Object.defineProperty(file, 'size', { value: size, writable: false })
    return file
  }

  const createMockWorkbook = (sheetNames: string[], worksheets: any) => ({
    SheetNames: sheetNames,
    Sheets: worksheets
  })

  describe('POST - Preview Excel file', () => {
    it('should successfully preview a standard Excel file', async () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], {
        Sheet1: {}
      })
      
      const mockJsonData = [
        ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka'],
        ['1', 'A001', 'Product A', '100', 'kg'],
        ['2', 'B002', 'Product B', '50', 'pcs'],
        ['DODANE DO SPISU'],
        ['3', 'C003', 'Product C', '75', 'l']
      ]

      const mockDetection = {
        mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
        confidence: 95,
        suggestions: []
      }

      const mockSuggestions = [
        { column: 0, possibleTypes: ['lp'], confidence: 90 },
        { column: 1, possibleTypes: ['itemId'], confidence: 85 }
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue(mockDetection)
      mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      expect(data.file).toEqual({
        name: 'test.xlsx',
        size: 1024,
        sheetName: 'Sheet1',
        totalSheets: 1,
        allSheetNames: ['Sheet1']
      })

      expect(data.structure).toEqual({
        headerRowIndex: 0,
        headers: ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka'],
        sampleData: [
          ['1', 'A001', 'Product A', '100', 'kg'],
          ['2', 'B002', 'Product B', '50', 'pcs'],
          ['3', 'C003', 'Product C', '75', 'l']
        ],
        categoryHeaders: ['DODANE DO SPISU'],
        estimatedDataRows: 3,
        totalRows: 5
      })

      expect(data.detection).toEqual({
        mapping: mockDetection.mapping,
        confidence: mockDetection.confidence,
        suggestions: mockDetection.suggestions
      })

      expect(data.defaultSuggestions).toEqual(mockSuggestions)
    })

    it('should handle file without headers in first row', async () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['', '', '', '', ''], // Empty first row
        ['SUROWCE'], // Category header
        ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka'], // Headers in 3rd row
        ['1', 'A001', 'Product A', '100', 'kg']
      ]

      const mockDetection = {
        mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
        confidence: 85,
        suggestions: []
      }

      const mockSuggestions = [
        { column: 0, possibleTypes: ['lp'], confidence: 80 }
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue(mockDetection)
      mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.structure.headerRowIndex).toBe(2)
      expect(data.structure.headers).toEqual(['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka'])
      expect(data.structure.categoryHeaders).toEqual(['SUROWCE'])
    })

    it('should handle minimum column format', async () => {
      const file = createMockFile('simple.xlsx', 512, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Nazwa', 'Ilość', 'Jednostka'],
        ['Product A', '100', 'kg'],
        ['Product B', '50', 'pcs']
      ]

      const mockDetection = {
        mapping: { name: 0, quantity: 1, unit: 2 },
        confidence: 80,
        suggestions: []
      }

      const mockSuggestions = [
        { column: 0, possibleTypes: ['name'], confidence: 85 }
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue(mockDetection)
      mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.structure.headers).toEqual(['Nazwa', 'Ilość', 'Jednostka'])
      expect(data.structure.estimatedDataRows).toBe(2)
      expect(data.detection.mapping).toEqual({ name: 0, quantity: 1, unit: 2 })
    })

    it('should handle detection failure gracefully', async () => {
      const file = createMockFile('ambiguous.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Col1', 'Col2', 'Col3'],
        ['Data1', 'Data2', 'Data3']
      ]

      const mockSuggestions = [
        { column: 0, possibleTypes: ['unknown'], confidence: 30 }
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockImplementation(() => {
        throw new Error('Unable to detect columns automatically')
      })
      mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.detection).toBeNull()
      expect(data.detectionError).toBe('Unable to detect columns automatically')
      expect(data.defaultSuggestions).toEqual(mockSuggestions)
    })

    it('should handle multiple sheets', async () => {
      const file = createMockFile('multi-sheet.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Products', 'Materials', 'Summary'], {
        Products: {},
        Materials: {},
        Summary: {}
      })
      
      const mockJsonData = [
        ['Item', 'Quantity', 'Unit'],
        ['Product A', '100', 'kg']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue({
        mapping: { name: 0, quantity: 1, unit: 2 },
        confidence: 75,
        suggestions: []
      })
      mockCreateDefaultMapping.mockReturnValue([])

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.file.sheetName).toBe('Products')
      expect(data.file.totalSheets).toBe(3)
      expect(data.file.allSheetNames).toEqual(['Products', 'Materials', 'Summary'])
    })

    it('should handle complex category structure', async () => {
      const file = createMockFile('complex.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka'],
        ['DODANE DO SPISU'],
        ['1', 'A001', 'Product A', '100', 'kg'],
        ['PÓŁPRODUKTY'],
        ['2', 'B002', 'Product B', '50', 'pcs'],
        ['SUROWCE'],
        ['3', 'C003', 'Product C', '75', 'l'],
        ['PRODUKCJA'],
        ['4', 'D004', 'Product D', '25', 'kg']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue({
        mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
        confidence: 90,
        suggestions: []
      })
      mockCreateDefaultMapping.mockReturnValue([])

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.structure.categoryHeaders).toEqual([
        'DODANE DO SPISU',
        'PÓŁPRODUKTY',
        'SUROWCE',
        'PRODUKCJA'
      ])
      expect(data.structure.estimatedDataRows).toBe(4)
    })
  })

  describe('File Validation', () => {
    it('should reject request without file', async () => {
      const formData = new FormData()

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file uploaded')
    })

    it('should reject file too large for preview', async () => {
      const file = createMockFile('large.xlsx', 6 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File too large for preview. Maximum size is 5MB')
    })

    it('should reject invalid file type', async () => {
      const file = createMockFile('test.txt', 1024, 'text/plain')

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
    })

    it('should reject invalid file extension', async () => {
      const file = createMockFile('test.pdf', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file extension. Only .xlsx and .xls files are allowed.')
    })
  })

  describe('Excel File Processing', () => {
    it('should handle corrupted Excel file', async () => {
      const file = createMockFile('corrupted.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      mockXLSXRead.mockImplementation(() => {
        throw new Error('File is corrupted')
      })

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Failed to read Excel file. Please ensure the file is not corrupted.')
    })

    it('should handle workbook with no sheets', async () => {
      const file = createMockFile('empty.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook([], {})

      mockXLSXRead.mockReturnValue(mockWorkbook)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Excel file contains no sheets or is corrupted.')
    })

    it('should handle empty sheet', async () => {
      const file = createMockFile('empty-sheet.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue([])

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Excel sheet is empty.')
    })

    it('should handle sheet with no detectable headers', async () => {
      const file = createMockFile('no-headers.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        [''], // Empty rows
        [''],
        ['1', '2', '3'], // Numbers only
        ['4', '5', '6']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Could not detect headers in the Excel file. Please ensure the first row contains column names.')
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const file = createMockFile('large-data.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      // Create large dataset
      const mockJsonData = [
        ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka']
      ]
      
      // Add 1000 data rows
      for (let i = 1; i <= 1000; i++) {
        mockJsonData.push([String(i), `CODE${i}`, `Product ${i}`, '100', 'kg'])
      }

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      mockDetectColumns.mockReturnValue({
        mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
        confidence: 95,
        suggestions: []
      })
      mockCreateDefaultMapping.mockReturnValue([])

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const startTime = performance.now()
      const response = await POST(request)
      const endTime = performance.now()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.structure.estimatedDataRows).toBe(1000)
      expect(data.structure.sampleData).toHaveLength(5) // Should be limited to 5 samples
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      // Mock an unexpected error during processing
      mockXLSXRead.mockImplementation(() => {
        throw new Error('Unexpected processing error')
      })

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Failed to read Excel file. Please ensure the file is not corrupted.')
    })
  })
})