/**
 * @jest-environment node
 */

import { POST } from '../upload/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    excelFile: {
      create: jest.fn(),
    },
    excelRow: {
      createMany: jest.fn(),
    },
    aggregatedItem: {
      createMany: jest.fn(),
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

import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

describe('/api/excel/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle file upload successfully', async () => {
    // Mock Excel file content
    const mockExcelData = [
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Product A', 'Ilosc': 10, 'Jednostka': 'kg' },
      { 'Nr indeksu': 'A002', 'Nazwa towaru': 'Product B', 'Ilosc': 5, 'Jednostka': 'l' },
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
      name: 'test.xlsx',
      size: 1024,
      uploadDate: new Date(),
    } as any)

    mockPrisma.excelRow.createMany.mockResolvedValue({ count: 2 })
    mockPrisma.aggregatedItem.createMany.mockResolvedValue({ count: 2 })

    // Create mock request with file
    const formData = new FormData()
    const file = new File(['excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const request = new NextRequest('http://localhost:3000/api/excel/upload', {
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
    expect(mockPrisma.aggregatedItem.createMany).toHaveBeenCalled()
  })

  it('should return error when no file is provided', async () => {
    const formData = new FormData()
    const request = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No file uploaded')
  })

  it('should return error for invalid file type', async () => {
    const formData = new FormData()
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    formData.append('file', file)

    const request = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
  })

  it('should handle Excel parsing errors', async () => {
    mockXLSX.read.mockImplementation(() => {
      throw new Error('Invalid Excel file')
    })

    const formData = new FormData()
    const file = new File(['invalid content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const request = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to process Excel file')
  })

  it('should aggregate items correctly', async () => {
    const mockExcelData = [
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Product A', 'Ilosc': 10, 'Jednostka': 'kg' },
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Product A', 'Ilosc': 5, 'Jednostka': 'kg' },
      { 'Nr indeksu': 'A002', 'Nazwa towaru': 'Product B', 'Ilosc': 3, 'Jednostka': 'l' },
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    mockPrisma.excelFile.create.mockResolvedValue({
      id: 'file-123',
      name: 'test.xlsx',
      size: 1024,
      uploadDate: new Date(),
    } as any)

    mockPrisma.excelRow.createMany.mockResolvedValue({ count: 3 })
    mockPrisma.aggregatedItem.createMany.mockResolvedValue({ count: 2 })

    const formData = new FormData()
    const file = new File(['excel content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const request = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    
    // Check aggregation logic - A001 should be aggregated to 15kg
    const aggregatedCall = mockPrisma.aggregatedItem.createMany.mock.calls[0][0]
    const aggregatedData = aggregatedCall.data as any[]
    
    const productA = aggregatedData.find(item => item.itemId === 'A001')
    expect(productA).toBeDefined()
    expect(productA.quantity).toBe(15) // 10 + 5
    
    const productB = aggregatedData.find(item => item.itemId === 'A002')
    expect(productB).toBeDefined()
    expect(productB.quantity).toBe(3)
  })
})