/**
 * Integration tests for Excel export functionality
 * @jest-environment node
 */

import { GET as exportGET } from '@/app/api/excel/export/route'
import { POST as manualPOST } from '@/app/api/excel/manual/route'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

// Mock Prisma
jest.mock('@/lib/db', () => {
  const mockData = {
    files: [] as any[],
    rows: [] as any[],
    aggregated: [] as any[],
  }

  return {
    __esModule: true,
    db: {
      excelFile: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.files)),
      },
      excelRow: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.rows)),
      },
      aggregatedItem: {
        upsert: jest.fn().mockImplementation((data) => {
          // Check if item exists
          const existingIndex = mockData.aggregated.findIndex(item => 
            item.itemId === data.where.itemId_name_unit.itemId &&
            item.name === data.where.itemId_name_unit.name &&
            item.unit === data.where.itemId_name_unit.unit
          )
          
          if (existingIndex >= 0) {
            // Update existing item
            mockData.aggregated[existingIndex] = {
              ...mockData.aggregated[existingIndex],
              quantity: mockData.aggregated[existingIndex].quantity + data.update.quantity.increment,
            }
            return Promise.resolve(mockData.aggregated[existingIndex])
          } else {
            // Create new item
            const newItem = {
              id: data.create.id || `item-${Date.now()}`,
              itemId: data.create.itemId,
              name: data.create.name,
              quantity: data.create.quantity,
              unit: data.create.unit,
              count: data.create.count || 1,
              sourceFiles: data.create.sourceFiles || '[]',
            }
            mockData.aggregated.push(newItem)
            return Promise.resolve(newItem)
          }
        }),
      },
    },
  }
})

// Mock XLSX
jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(() => undefined),
    decode_range: jest.fn(() => ({ s: { r: 0 }, e: { r: 0 } })),
    encode_cell: jest.fn(() => 'A1'),
    write: jest.fn(() => Buffer.from('mock excel data')),
  },
}))

describe('Excel Export Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock data
    const prisma = require('@/lib/db').db
    prisma.excelFile.findMany.mockClear()
    prisma.excelRow.findMany.mockClear()
    prisma.aggregatedItem.upsert.mockClear()
    
    // Reset mock data arrays
    const mockDb = require('@/lib/db').db
    mockDb.excelFile.findMany.mock.results[0] = { value: [], type: 'return' }
    mockDb.excelRow.findMany.mock.results[0] = { value: [], type: 'return' }
    mockDb.aggregatedItem.upsert.mock.results = []
  })

  it('should export aggregated data to Excel', async () => {
    // Mock data for export
    const mockFiles = [
      {
        id: 'file1',
        fileName: 'inventory.xlsx',
        originalStructure: [
          { type: 'header', content: 'SUROWCE' },
          { type: 'item', content: { itemId: 'A001', name: 'Product A', unit: 'kg' } },
        ],
        rows: [
          { itemId: 'A001', name: 'Product A', unit: 'kg', quantity: 10, originalRowIndex: 0 },
        ],
      },
    ]

    const prisma = require('@/lib/db').db
    prisma.excelFile.findMany.mockResolvedValue(mockFiles)

    const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated')
    const response = await exportGET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(response.headers.get('Content-Disposition')).toContain('.xlsx')
    
    // Check that XLSX functions were called
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalled()
    expect(XLSX.utils.book_new).toHaveBeenCalled()
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
    expect(XLSX.utils.write).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        type: 'buffer',
        bookType: 'xlsx',
      })
    )
  })

  it('should export raw data to Excel', async () => {
    // Mock data for export
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

    const prisma = require('@/lib/db').db
    prisma.excelRow.findMany.mockResolvedValue(mockRawData)

    const request = new NextRequest('http://localhost:3000/api/excel/export?type=raw')
    const response = await exportGET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(response.headers.get('Content-Disposition')).toContain('.xlsx')
    
    // Check that XLSX functions were called
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalled()
    expect(XLSX.utils.book_new).toHaveBeenCalled()
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
    expect(XLSX.utils.write).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        type: 'buffer',
        bookType: 'xlsx',
      })
    )
  })

  it('should handle export when no data is available', async () => {
    // Mock empty data
    const prisma = require('@/lib/db').db
    prisma.excelFile.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated')
    const response = await exportGET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('No files found')
  })
})