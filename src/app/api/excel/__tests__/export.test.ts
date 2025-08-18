/**
 * @jest-environment node
 */

import { GET } from '../export/route'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  db: {
    excelFile: {
      findMany: jest.fn(),
    },
    excelRow: {
      findMany: jest.fn(),
    },
  },
}))

// Mock XLSX
jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn(),
    book_new: jest.fn(),
    book_append_sheet: jest.fn(),
    decode_range: jest.fn(),
    encode_cell: jest.fn(),
  },
  write: jest.fn(), // This should be directly on XLSX, not utils
}))

import { db } from '@/lib/db'

const mockPrisma = db as jest.Mocked<typeof db>
const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

describe('/api/excel/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock XLSX functions with simpler mocks that work with NextResponse
    const mockWorksheet = {
      '!ref': 'A1:E3',
      A1: { v: 'Test' },
    }
    
    mockXLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet as any)
    mockXLSX.utils.book_new.mockReturnValue({ Sheets: {}, SheetNames: [] } as any)
    mockXLSX.utils.book_append_sheet.mockReturnValue(undefined)
    mockXLSX.utils.decode_range.mockReturnValue({ s: { r: 0, c: 0 }, e: { r: 2, c: 4 } })
    mockXLSX.utils.encode_cell.mockReturnValue('A1')
    mockXLSX.write.mockReturnValue(Buffer.from('mock-excel-buffer')) // Use Buffer instead of Uint8Array
  })

  describe('GET aggregated data', () => {
    it('should export aggregated data successfully', async () => {
      const mockFiles = [
        {
          id: 'file1',
          fileName: 'inventory1.xlsx',
          originalStructure: [
            { type: 'header', content: 'SUROWCE' },
            { type: 'item', content: { itemId: 'A001', name: 'Product A', unit: 'kg' } },
          ],
          rows: [
            { itemId: 'A001', name: 'Product A', unit: 'kg', quantity: 10, originalRowIndex: 0 },
          ],
        },
        {
          id: 'file2',
          fileName: 'inventory2.xlsx',
          originalStructure: [],
          rows: [
            { itemId: 'A001', name: 'Product A', unit: 'kg', quantity: 5, originalRowIndex: 0 },
          ],
        },
      ]

      mockPrisma.excelFile.findMany.mockResolvedValue(mockFiles)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated')
      
      const response = await GET(request)
      
      // Debug the response if it's not 200
      if (response.status !== 200) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        console.error('Response error:', response.status, errorBody)
      }
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(response.headers.get('Content-Disposition')).toContain('aggregated_data_')
      
      // Check that XLSX functions were called
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled()
      expect(mockXLSX.utils.book_new).toHaveBeenCalled()
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalled()
      expect(mockXLSX.write).toHaveBeenCalled()
    })

    it('should return error when no files are found', async () => {
      mockPrisma.excelFile.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('No files found')
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.excelFile.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to export data')
    })
  })

  describe('GET raw data', () => {
    it('should export raw data successfully', async () => {
      const mockRawData = [
        {
          id: 'row1',
          itemId: 'A001',
          name: 'Product A',
          unit: 'kg',
          quantity: 10,
          originalRowIndex: 0,
          file: {
            fileName: 'inventory.xlsx',
          },
        },
      ]

      mockPrisma.excelRow.findMany.mockResolvedValue(mockRawData)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=raw')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(response.headers.get('Content-Disposition')).toContain('raw_data_')
      
      // Check that XLSX functions were called
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled()
      expect(mockXLSX.utils.book_new).toHaveBeenCalled()
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalled()
      expect(mockXLSX.write).toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.excelRow.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=raw')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to export data')
    })
  })

  it('should default to aggregated data when type parameter is not provided', async () => {
    const mockFiles = [
      {
        id: 'file1',
        fileName: 'inventory1.xlsx',
        originalStructure: [],
        rows: [],
      },
    ]

    mockPrisma.excelFile.findMany.mockResolvedValue(mockFiles)

    const request = new NextRequest('http://localhost:3000/api/excel/export')
    const response = await GET(request)

    expect(response.status).toBe(200)
    // Should have called the aggregated data export logic
    expect(mockPrisma.excelFile.findMany).toHaveBeenCalled()
  })
})