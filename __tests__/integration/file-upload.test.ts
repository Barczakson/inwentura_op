/**
 * Integration tests for file upload workflow
 * @jest-environment node
 */

import { POST as uploadPOST } from '@/app/api/excel/upload/route'
import { GET as dataGET } from '@/app/api/excel/data/route'
import { NextRequest } from 'next/server'

// Mock Prisma with realistic responses
jest.mock('@/lib/prisma', () => {
  const mockData = {
    files: [] as any[],
    rows: [] as any[],
    aggregatedItems: [] as any[],
  }

  return {
    __esModule: true,
    default: {
      excelFile: {
        create: jest.fn((data) => {
          const file = { 
            id: `file-${Date.now()}`, 
            ...data.data,
            uploadDate: new Date() 
          }
          mockData.files.push(file)
          return Promise.resolve(file)
        }),
      },
      excelRow: {
        createMany: jest.fn((data) => {
          mockData.rows.push(...data.data)
          return Promise.resolve({ count: data.data.length })
        }),
        findMany: jest.fn(() => Promise.resolve(mockData.rows)),
      },
      aggregatedItem: {
        createMany: jest.fn((data) => {
          mockData.aggregatedItems.push(...data.data)
          return Promise.resolve({ count: data.data.length })
        }),
        findMany: jest.fn(() => Promise.resolve(mockData.aggregatedItems)),
      },
    },
  }
})

// Mock XLSX
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}))

import * as XLSX from 'xlsx'
const mockXLSX = XLSX as jest.Mocked<typeof XLSX>

describe('File Upload Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock data
    const prisma = require('@/lib/prisma').default
    prisma.excelFile.create.mockClear()
    prisma.excelRow.createMany.mockClear()
    prisma.aggregatedItem.createMany.mockClear()
  })

  it('should handle complete upload workflow', async () => {
    // Mock Excel data
    const mockExcelData = [
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Produkt A', 'Ilosc': 10, 'Jednostka': 'kg' },
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Produkt A', 'Ilosc': 5, 'Jednostka': 'kg' },
      { 'Nr indeksu': 'A002', 'Nazwa towaru': 'Produkt B', 'Ilosc': 3, 'Jednostka': 'l' },
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    // Step 1: Upload file
    const formData = new FormData()
    const file = new File(['excel content'], 'test-integration.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const uploadResponse = await uploadPOST(uploadRequest)
    expect(uploadResponse.status).toBe(200)

    const uploadData = await uploadResponse.json()
    expect(uploadData).toHaveProperty('fileId')
    expect(uploadData.rows).toHaveLength(3)
    expect(uploadData.aggregated).toHaveLength(2) // A001 should be aggregated

    // Check aggregation logic
    const aggregatedA001 = uploadData.aggregated.find((item: any) => item.itemId === 'A001')
    expect(aggregatedA001.quantity).toBe(15) // 10 + 5

    // Step 2: Retrieve data
    const dataRequest = new NextRequest('http://localhost:3000/api/excel/data?includeRaw=true')
    const dataResponse = await dataGET(dataRequest)
    expect(dataResponse.status).toBe(200)

    const data = await dataResponse.json()
    expect(data).toHaveProperty('aggregated')
    expect(data).toHaveProperty('raw')
    expect(data.aggregated).toHaveLength(2)
    expect(data.raw).toHaveLength(3)
  })

  it('should handle multiple file uploads and maintain separate data', async () => {
    // First file
    const mockExcelData1 = [
      { 'Nr indeksu': 'A001', 'Nazwa towaru': 'Produkt A', 'Ilosc': 10, 'Jednostka': 'kg' },
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData1)

    const formData1 = new FormData()
    const file1 = new File(['excel content 1'], 'test1.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData1.append('file', file1)

    const uploadRequest1 = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData1,
    })

    const uploadResponse1 = await uploadPOST(uploadRequest1)
    expect(uploadResponse1.status).toBe(200)

    // Second file
    const mockExcelData2 = [
      { 'Nr indeksu': 'B001', 'Nazwa towaru': 'Produkt B', 'Ilosc': 5, 'Jednostka': 'l' },
    ]
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData2)

    const formData2 = new FormData()
    const file2 = new File(['excel content 2'], 'test2.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData2.append('file', file2)

    const uploadRequest2 = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData2,
    })

    const uploadResponse2 = await uploadPOST(uploadRequest2)
    expect(uploadResponse2.status).toBe(200)

    // Verify both files are processed
    const dataRequest = new NextRequest('http://localhost:3000/api/excel/data?includeRaw=true')
    const dataResponse = await dataGET(dataRequest)
    const data = await dataResponse.json()

    expect(data.aggregated).toHaveLength(2) // One from each file
    expect(data.raw).toHaveLength(2) // One row from each file
  })

  it('should handle files with different column structures', async () => {
    // File with different column names (without ID column)
    const mockExcelData = [
      { 'Nazwa towaru': 'Produkt bez ID', 'Ilosc': 8, 'Jednostka': 'szt' },
      { 'Nazwa towaru': 'Inny produkt', 'Ilosc': 12, 'Jednostka': 'kg' },
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    const formData = new FormData()
    const file = new File(['excel content'], 'no-id-columns.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const uploadResponse = await uploadPOST(uploadRequest)
    expect(uploadResponse.status).toBe(200)

    const uploadData = await uploadResponse.json()
    expect(uploadData.rows).toHaveLength(2)
    expect(uploadData.aggregated).toHaveLength(2)

    // Items without ID should still be processed
    uploadData.aggregated.forEach((item: any) => {
      expect(item.itemId).toBeNull()
      expect(item.name).toBeTruthy()
    })
  })

  it('should handle large files with many items', async () => {
    // Generate large dataset
    const mockExcelData = []
    for (let i = 1; i <= 100; i++) {
      mockExcelData.push({
        'Nr indeksu': `A${i.toString().padStart(3, '0')}`,
        'Nazwa towaru': `Produkt ${i}`,
        'Ilosc': Math.floor(Math.random() * 100) + 1,
        'Jednostka': i % 2 === 0 ? 'kg' : 'l',
      })
    }

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    const formData = new FormData()
    const file = new File(['large excel content'], 'large-file.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const uploadResponse = await uploadPOST(uploadRequest)
    expect(uploadResponse.status).toBe(200)

    const uploadData = await uploadResponse.json()
    expect(uploadData.rows).toHaveLength(100)
    expect(uploadData.aggregated).toHaveLength(100) // All unique items
  })

  it('should handle edge case with empty Excel file', async () => {
    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue([])

    const formData = new FormData()
    const file = new File(['empty excel'], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)

    const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })

    const uploadResponse = await uploadPOST(uploadRequest)
    expect(uploadResponse.status).toBe(200)

    const uploadData = await uploadResponse.json()
    expect(uploadData.rows).toHaveLength(0)
    expect(uploadData.aggregated).toHaveLength(0)
  })
})