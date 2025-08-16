/**
 * @jest-environment node
 */

import { POST } from '../upload-flexible/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  db: {
    excelFile: {
      create: jest.fn(),
    },
    excelRow: {
      createMany: jest.fn(),
    },
    aggregatedItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// Mock XLSX
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}))

import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

const mockPrisma = db as jest.Mocked<typeof db>
const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

describe('/api/excel/upload-flexible', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle flexible file upload successfully with column mapping', async () => {
    // Mock Excel file content with custom column structure
    const mockExcelData = [
      ['L.p.', 'Kod', 'Opis', 'Sztuki', 'JM'], // Header row
      [1, 'A001', 'Product A', 10, 'kg'],
      [2, 'A002', 'Product B', 5, 'l'],
    ]

    // Mock XLSX functions
    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    // Mock Prisma responses
    mockPrisma.excelFile.create.mockResolvedValue({
      id: 'file-123',
      fileName: 'test.xlsx',
      fileSize: 1024,
      rowCount: 2,
    } as any)

    mockPrisma.excelRow.createMany.mockResolvedValue({ count: 2 })
    
    mockPrisma.aggregatedItem.findUnique.mockResolvedValue(null)
    mockPrisma.aggregatedItem.create.mockResolvedValue({
      id: 'item-123',
      itemId: 'A001',
      name: 'Product A',
      quantity: 10,
      unit: 'kg',
      sourceFiles: '["file-123"]',
      count: 1,
      fileId: 'file-123',
    } as any)

    // Create mock request with file and column mapping
    const formData = new FormData()
    const file = new File(['excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    
    const columnMapping = {
      itemIdColumn: 1,    // 'Kod' column
      nameColumn: 2,      // 'Opis' column
      quantityColumn: 3,  // 'Sztuki' column
      unitColumn: 4,      // 'JM' column
      headerRow: 0        // First row is header
    }
    formData.append('columnMapping', JSON.stringify(columnMapping))

    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('fileId')
    expect(data).toHaveProperty('rows')
    expect(data).toHaveProperty('aggregated')
    expect(mockPrisma.excelFile.create).toHaveBeenCalled()
    expect(mockPrisma.excelRow.createMany).toHaveBeenCalled()
    expect(mockPrisma.aggregatedItem.create).toHaveBeenCalled()
  })

  it('should handle file upload without item ID column', async () => {
    // Mock Excel file content without item ID
    const mockExcelData = [
      ['Nazwa', 'Ilość', 'Jednostka'], // Header row
      ['Product A', 10, 'kg'],
      ['Product B', 5, 'l'],
    ]

    // Mock XLSX functions
    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    // Mock Prisma responses
    mockPrisma.excelFile.create.mockResolvedValue({
      id: 'file-123',
      fileName: 'test.xlsx',
      fileSize: 1024,
      rowCount: 2,
    } as any)

    mockPrisma.excelRow.createMany.mockResolvedValue({ count: 2 })
    
    mockPrisma.aggregatedItem.findUnique.mockResolvedValue(null)
    mockPrisma.aggregatedItem.create.mockResolvedValue({
      id: 'item-123',
      name: 'Product A',
      quantity: 10,
      unit: 'kg',
      sourceFiles: '["file-123"]',
      count: 1,
      fileId: 'file-123',
    } as any)

    // Create mock request with file and column mapping (no item ID)
    const formData = new FormData()
    const file = new File(['excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    
    const columnMapping = {
      itemIdColumn: undefined, // No item ID column
      nameColumn: 0,           // 'Nazwa' column
      quantityColumn: 1,       // 'Ilość' column
      unitColumn: 2,           // 'Jednostka' column
      headerRow: 0             // First row is header
    }
    formData.append('columnMapping', JSON.stringify(columnMapping))

    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('fileId')
    expect(data).toHaveProperty('rows')
    expect(data).toHaveProperty('aggregated')
    expect(mockPrisma.excelFile.create).toHaveBeenCalled()
    expect(mockPrisma.excelRow.createMany).toHaveBeenCalled()
    expect(mockPrisma.aggregatedItem.create).toHaveBeenCalled()
  })

  it('should return error when no file is provided', async () => {
    const formData = new FormData()
    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No file provided')
  })

  it('should return error with invalid column mapping', async () => {
    const formData = new FormData()
    const file = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    formData.append('columnMapping', 'invalid-json')

    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid column mapping')
  })

  it('should handle empty Excel file', async () => {
    // Mock empty Excel file
    const mockExcelData = []

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    const formData = new FormData()
    const file = new File(['excel content'], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    
    const columnMapping = {
      nameColumn: 0,
      quantityColumn: 1,
      unitColumn: 2,
      headerRow: 0
    }
    formData.append('columnMapping', JSON.stringify(columnMapping))

    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Empty Excel file')
  })

  it('should aggregate items correctly with flexible mapping', async () => {
    const mockExcelData = [
      ['Name', 'Qty', 'Unit'],
      ['Product A', 10, 'kg'],
      ['Product A', 5, 'kg'],
      ['Product B', 3, 'l'],
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    mockPrisma.excelFile.create.mockResolvedValue({
      id: 'file-123',
      fileName: 'test.xlsx',
      fileSize: 1024,
      rowCount: 3,
    } as any)

    mockPrisma.excelRow.createMany.mockResolvedValue({ count: 3 })
    
    // Mock findUnique to return null for first item (new item)
    mockPrisma.aggregatedItem.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'item-123', // Existing item with same name/unit
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        sourceFiles: '["file-xyz"]',
        count: 1,
      } as any)
      .mockResolvedValueOnce(null)
    
    // Mock create for new items
    mockPrisma.aggregatedItem.create.mockResolvedValue({
      id: 'item-123',
      name: 'Product A',
      quantity: 10,
      unit: 'kg',
      sourceFiles: '["file-123"]',
      count: 1,
      fileId: 'file-123',
    } as any)
    
    // Mock update for existing items
    mockPrisma.aggregatedItem.update.mockResolvedValue({
      id: 'item-123',
      name: 'Product A',
      quantity: 15, // Updated quantity (10 + 5)
      unit: 'kg',
      sourceFiles: '["file-xyz","file-123"]',
      count: 2,
    } as any)

    const formData = new FormData()
    const file = new File(['excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    
    const columnMapping = {
      nameColumn: 0,
      quantityColumn: 1,
      unitColumn: 2,
      headerRow: 0
    }
    formData.append('columnMapping', JSON.stringify(columnMapping))

    const request = new NextRequest('http://localhost:3000/api/excel/upload-flexible', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    
    // Check that we called findUnique 2 times (once for each unique item)
    expect(mockPrisma.aggregatedItem.findUnique).toHaveBeenCalledTimes(2)
    
    // Check that we called create for new items and update for existing
    expect(mockPrisma.aggregatedItem.create).toHaveBeenCalled()
    expect(mockPrisma.aggregatedItem.update).toHaveBeenCalled()
  })
})