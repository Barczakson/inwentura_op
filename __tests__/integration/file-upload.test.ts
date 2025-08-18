/**
 * Integration tests for file upload workflow
 * @jest-environment node
 */

import { POST as uploadPOST } from '@/app/api/excel/upload/route'
import { GET as dataGET } from '@/app/api/excel/data/route'
import { NextRequest } from 'next/server'

// Mock Prisma with realistic responses
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
        create: jest.fn().mockImplementation((data) => {
          const file = { id: `file-${Date.now()}`, ...data.data }
          mockData.files.push(file)
          return Promise.resolve(file)
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.files)),
        delete: jest.fn().mockImplementation((where) => {
          mockData.files = mockData.files.filter(file => file.id !== where.where.id)
          return Promise.resolve({ count: 1 })
        }),
      },
      excelRow: {
        createMany: jest.fn().mockImplementation((data) => {
          mockData.rows.push(...data.data.map((row: any) => ({ id: `row-${Date.now()}`, ...row })))
          return Promise.resolve({ count: data.data.length })
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.rows)),
      },
      aggregatedItem: {
        create: jest.fn().mockImplementation((data) => {
          const item = { id: `item-${Date.now()}`, ...data.data }
          mockData.aggregated.push(item)
          return Promise.resolve(item)
        }),
        createMany: jest.fn().mockImplementation((data) => {
          const items = data.data.map((item: any) => ({ id: `item-${Date.now()}`, ...item }))
          mockData.aggregated.push(...items)
          return Promise.resolve({ count: items.length })
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.aggregated)),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
        update: jest.fn().mockImplementation((data) => {
          const index = mockData.aggregated.findIndex(item => 
            item.itemId === data.where.itemId_name_unit.itemId &&
            item.name === data.where.itemId_name_unit.name &&
            item.unit === data.where.itemId_name_unit.unit
          )
          if (index >= 0) {
            mockData.aggregated[index] = { ...mockData.aggregated[index], ...data.data }
            return Promise.resolve(mockData.aggregated[index])
          }
          return Promise.reject(new Error('Item not found'))
        }),
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
    // Mock data will be cleared by jest.clearAllMocks() since we mock the entire module
  })

  it('should handle complete upload workflow', async () => {
    // Mock Excel data with correct column structure and headers
    const mockExcelData = [
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Header row
      [1, 'A001', 'Produkt A', 10, 'kg'],
      [2, 'A001', 'Produkt A', 5, 'kg'],
      [3, 'A002', 'Produkt B', 3, 'l'],
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    // Step 1: Upload file
    console.log('Creating FormData')
    const formData = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent = 'A'.repeat(150) // 150 bytes of content
    const file = new File([largeFileContent], 'test-integration.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    formData.append('file', file)
    console.log('FormData created')

    console.log('Creating NextRequest')
    const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData,
    })
    console.log('NextRequest created')

    console.log('Calling uploadPOST')
    const uploadResponse = await uploadPOST(uploadRequest)
    console.log('uploadPOST completed, status:', uploadResponse.status)
    // Remove this line: const uploadDataText = await uploadResponse.text()
    // console.log('Response data:', uploadDataText)
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
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Header row
      [1, 'A001', 'Produkt A', 10, 'kg'],
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData1)

    const formData1 = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent1 = 'B'.repeat(150) // 150 bytes of content
    const file1 = new File([largeFileContent1], 'test1.xlsx', {
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
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Header row
      [1, 'B001', 'Produkt B', 5, 'l'],
    ]
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData2)

    const formData2 = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent2 = 'C'.repeat(150) // 150 bytes of content
    const file2 = new File([largeFileContent2], 'test2.xlsx', {
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
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Header row
      [1, null, 'Produkt bez ID', 8, 'szt'],
      [2, null, 'Inny produkt', 12, 'kg'],
    ]

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    const formData = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent = 'D'.repeat(150) // 150 bytes of content
    const file = new File([largeFileContent], 'no-id-columns.xlsx', {
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
    // Generate large dataset with correct structure
    const mockExcelData = [['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ']] // Header row
    for (let i = 1; i <= 100; i++) {
      mockExcelData.push([
        i, 
        `A${i.toString().padStart(3, '0')}`,
        `Produkt ${i}`,
        Math.floor(Math.random() * 100) + 1,
        i % 2 === 0 ? 'kg' : 'l'
      ])
    }

    mockXLSX.read.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as any)
    
    mockXLSX.utils.sheet_to_json.mockReturnValue(mockExcelData)

    const formData = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent = 'E'.repeat(150) // 150 bytes of content
    const file = new File([largeFileContent], 'large-file.xlsx', {
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
    
    mockXLSX.utils.sheet_to_json.mockReturnValue([['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ']]) // Just header row

    const formData = new FormData()
    // Create a larger mock file content to pass the size check
    const largeFileContent = 'F'.repeat(150) // 150 bytes of content
    const file = new File([largeFileContent], 'empty.xlsx', {
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