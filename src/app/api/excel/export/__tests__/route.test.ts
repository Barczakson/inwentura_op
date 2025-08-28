import { NextRequest } from 'next/server'
import { GET } from '../route'
import { db, queries } from '@/lib/db-config'
import * as XLSX from 'xlsx'

// Mock the database config
jest.mock('@/lib/db-config', () => ({
  db: {
    excelFile: {
      findMany: jest.fn(),
    },
  },
  queries: {
    getExcelRows: jest.fn(),
  },
}))

// Mock server optimizations
jest.mock('@/lib/server-optimizations', () => ({
  withTimeout: jest.fn((fn) => fn),
  withErrorHandling: jest.fn((fn) => fn),
  createStreamingResponse: jest.fn(),
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    checkpoint: jest.fn(),
    getReport: jest.fn(() => ({})),
  })),
  REQUEST_TIMEOUTS: {
    EXPORT: 30000,
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
  write: jest.fn(),
}))

const mockDb = db as jest.Mocked<typeof db>
const mockQueries = queries as jest.Mocked<typeof queries>
const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

describe('/api/excel/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should export aggregated data as Excel file', async () => {
      const mockFiles = [
        {
          id: '1',
          fileName: 'file1.xlsx',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          originalStructure: JSON.stringify([
            { type: 'header', content: 'SUROWCE' },
            { type: 'item', content: { itemId: 'A001', name: 'Product A', unit: 'kg' } },
            { type: 'item', content: { itemId: 'A002', name: 'Product B', unit: 'l' } },
          ]),
          rows: [
            {
              id: '1',
              itemId: 'A001',
              name: 'Product A',
              quantity: 100,
              unit: 'kg',
              originalRowIndex: 1,
            },
            {
              id: '2',
              itemId: 'A002',
              name: 'Product B',
              quantity: 50,
              unit: 'l',
              originalRowIndex: 2,
            },
          ],
        },
      ]

      mockDb.excelFile.findMany.mockResolvedValue(mockFiles)

      const mockWorksheet = { '!ref': 'A1:E3', '!cols': [] }
      const mockWorkbook = {}
      const mockBuffer = Buffer.from('mock excel data')

      mockXLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet)
      mockXLSX.utils.book_new.mockReturnValue(mockWorkbook)
      mockXLSX.utils.decode_range.mockReturnValue({ s: { r: 0 }, e: { r: 2 } })
      mockXLSX.utils.encode_cell.mockReturnValue('A1')
      mockXLSX.write.mockReturnValue(mockBuffer)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(response.headers.get('Content-Disposition')).toContain('attachment; filename=')
      expect(response.headers.get('Content-Disposition')).toContain('aggregated_data_')
      expect(response.headers.get('Content-Disposition')).toContain('.xlsx')

      // Verify database query
      expect(mockDb.excelFile.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          uploadDate: true,
          originalStructure: true,
          rows: {
            select: {
              id: true,
              itemId: true,
              name: true,
              quantity: true,
              unit: true,
              originalRowIndex: true
            }
          }
        },
        orderBy: {
          uploadDate: 'asc'
        }
      })

      // Verify Excel generation was called
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalled()
      expect(mockXLSX.utils.book_new).toHaveBeenCalled()
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalledWith(
        mockWorkbook,
        mockWorksheet,
        'Aggregated Data'
      )
      expect(mockXLSX.write).toHaveBeenCalledWith(mockWorkbook, {
        type: 'buffer',
        bookType: 'xlsx',
      })
    })

    it('should handle empty data', async () => {
      mockDb.excelFile.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('No files found')
    })

    it('should export raw data when type=raw', async () => {
      const mockRawData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 100,
          unit: 'kg',
          originalRowIndex: 1,
          file: {
            fileName: 'file1.xlsx',
          },
        },
        {
          id: '2',
          itemId: null,
          name: 'Product B',
          quantity: 50,
          unit: 'l',
          originalRowIndex: 2,
          file: {
            fileName: 'file1.xlsx',
          },
        },
      ]

      mockQueries.getExcelRows.mockResolvedValue(mockRawData)

      const mockWorksheet = { '!cols': [] }
      const mockWorkbook = {}
      const mockBuffer = Buffer.from('mock excel data')

      mockXLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet)
      mockXLSX.utils.book_new.mockReturnValue(mockWorkbook)
      mockXLSX.write.mockReturnValue(mockBuffer)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=raw', {
        method: 'GET',
      })

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toContain('raw_data_')

      // Verify raw data query
      expect(mockQueries.getExcelRows).toHaveBeenCalledWith({
        where: {},
        orderBy: [
          { fileId: 'asc' },
          { originalRowIndex: 'asc' }
        ],
        includeFile: true
      })
    })

    it('should handle database errors', async () => {
      mockDb.excelFile.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to export data')
    })

    it('should handle raw data not found', async () => {
      mockQueries.getExcelRows.mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=raw', {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('No raw data found')
    })

    it('should generate unique filename with date', async () => {
      const mockFiles = [
        {
          id: '1',
          fileName: 'file1.xlsx',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          originalStructure: null,
          rows: [],
        },
      ]

      mockDb.excelFile.findMany.mockResolvedValue(mockFiles)

      const mockWorksheet = { '!ref': 'A1:E1', '!cols': [] }
      const mockWorkbook = {}
      const mockBuffer = Buffer.from('mock excel data')

      mockXLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet)
      mockXLSX.utils.book_new.mockReturnValue(mockWorkbook)
      mockXLSX.utils.decode_range.mockReturnValue({ s: { r: 0 }, e: { r: 0 } })
      mockXLSX.write.mockReturnValue(mockBuffer)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const response = await GET(request)

      const contentDisposition = response.headers.get('Content-Disposition')
      expect(contentDisposition).toMatch(/filename="aggregated_data_\d{4}-\d{2}-\d{2}\.xlsx"/)
    })

    it('should sort files by upload date', async () => {
      const mockFiles = [
        {
          id: '1',
          fileName: 'file1.xlsx',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          originalStructure: null,
          rows: [],
        },
      ]

      mockDb.excelFile.findMany.mockResolvedValue(mockFiles)

      const mockWorksheet = { '!ref': 'A1:E1', '!cols': [] }
      const mockWorkbook = {}
      const mockBuffer = Buffer.from('mock excel data')

      mockXLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet)
      mockXLSX.utils.book_new.mockReturnValue(mockWorkbook)
      mockXLSX.utils.decode_range.mockReturnValue({ s: { r: 0 }, e: { r: 0 } })
      mockXLSX.write.mockReturnValue(mockBuffer)

      const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      await GET(request)

      expect(mockDb.excelFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            uploadDate: 'asc',
          },
        })
      )
    })
  })
})
