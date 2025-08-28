import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

// Mock Prisma first
const prismaMock = {
  excelFile: {
    create: jest.fn(),
  },
  aggregatedItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
}

// Mock dependencies
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn()
  }
}))

jest.mock('@/lib/db-config', () => ({
  db: prismaMock,
  withTransaction: jest.fn(),
  queries: {
    batchCreateExcelRows: jest.fn()
  }
}))

jest.mock('@/lib/column-detection', () => ({
  applyMapping: jest.fn()
}))

// Import after mocking
import { POST } from '../route'
import { applyMapping } from '@/lib/column-detection'
import { withTransaction, queries } from '@/lib/db-config'

const mockApplyMapping = applyMapping as jest.MockedFunction<typeof applyMapping>
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>
const mockBatchCreateExcelRows = queries.batchCreateExcelRows as jest.MockedFunction<typeof queries.batchCreateExcelRows>
const mockXLSXRead = XLSX.read as jest.MockedFunction<typeof XLSX.read>
const mockSheetToJson = XLSX.utils.sheet_to_json as jest.MockedFunction<typeof XLSX.utils.sheet_to_json>

describe('/api/excel/upload - Flexible Column Mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default transaction mock
    mockWithTransaction.mockImplementation(async (callback) => {
      return await callback(prismaMock)
    })
  })

  const createMockFile = (name: string, size: number, type: string) => {
    const buffer = Buffer.from('mock excel content')
    return new File([buffer], name, { type }) as File
  }

  const createMockWorkbook = (sheetNames: string[], worksheets: any) => ({
    SheetNames: sheetNames,
    Sheets: worksheets
  })

  describe('Standard Format Upload (Backward Compatibility)', () => {
    it('should process standard format without custom mapping', async () => {
      const file = createMockFile('standard.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'],
        ['1', 'A001', 'Product A', '100', 'kg'],
        ['2', 'B002', 'Product B', '50', 'pcs']
      ]

      const mockExcelFile = {
        id: 'file-id-1',
        fileName: 'standard.xlsx',
        fileSize: 1024,
        rowCount: 2
      }

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.fileId).toBe('file-id-1')
      expect(data.rowCount).toBe(2)
    })
  })

  describe('Custom Column Mapping Upload', () => {
    it('should process file with custom column mapping', async () => {
      const file = createMockFile('custom.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Product Name', 'Quantity', 'Unit', 'Code'], // Custom order
        ['Product A', '100', 'kg', 'A001'],
        ['Product B', '50', 'pcs', 'B002']
      ]

      const customMapping = {
        name: 0,      // Product Name
        quantity: 1,  // Quantity  
        unit: 2,      // Unit
        itemId: 3     // Code
      }

      const mockExcelFile = {
        id: 'file-id-2',
        fileName: 'custom.xlsx',
        fileSize: 1024,
        rowCount: 2
      }

      // Mock applyMapping to return proper data structure
      mockApplyMapping.mockImplementation((row, mapping) => {
        if (JSON.stringify(mapping) === JSON.stringify(customMapping)) {
          const [name, quantity, unit, itemId] = row
          return {
            name: String(name),
            quantity: parseFloat(String(quantity)),
            unit: String(unit).toLowerCase(),
            itemId: String(itemId)
          }
        }
        return {
          name: '',
          quantity: 0,
          unit: ''
        }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(customMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.fileId).toBe('file-id-2')
      expect(data.rowCount).toBe(2)
      
      // Verify applyMapping was called for each data row
      expect(mockApplyMapping).toHaveBeenCalledTimes(2)
      expect(mockApplyMapping).toHaveBeenCalledWith(
        ['Product A', '100', 'kg', 'A001'],
        customMapping
      )
    })

    it('should handle minimum required mapping (name, quantity, unit)', async () => {
      const file = createMockFile('minimal.xlsx', 512, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Item', 'Qty', 'UoM'],
        ['Cement', '1000', 'kg'],
        ['Water', '500', 'l']
      ]

      const minimalMapping = {
        name: 0,
        quantity: 1,
        unit: 2
      }

      const mockExcelFile = {
        id: 'file-id-3',
        fileName: 'minimal.xlsx',
        fileSize: 512,
        rowCount: 2
      }

      mockApplyMapping.mockImplementation((row) => {
        const [name, quantity, unit] = row
        return {
          name: String(name),
          quantity: parseFloat(String(quantity)),
          unit: String(unit).toLowerCase()
        }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(minimalMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rowCount).toBe(2)
    })

    it('should handle SAP export format mapping', async () => {
      const file = createMockFile('sap-export.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Material', 'Description', 'Amount', 'UoM'],
        ['MAT001', 'Material A', '1500', 'kg'],
        ['MAT002', 'Material B', '750', 'l'],
        ['MAT003', 'Material C', '250', 'pcs']
      ]

      const sapMapping = {
        itemId: 0,    // Material
        name: 1,      // Description
        quantity: 2,  // Amount
        unit: 3       // UoM
      }

      const mockExcelFile = {
        id: 'file-id-4',
        fileName: 'sap-export.xlsx',
        fileSize: 2048,
        rowCount: 3
      }

      mockApplyMapping.mockImplementation((row) => {
        const [itemId, name, quantity, unit] = row
        return {
          itemId: String(itemId),
          name: String(name),
          quantity: parseFloat(String(quantity)),
          unit: String(unit).toLowerCase()
        }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(sapMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rowCount).toBe(3)
      
      expect(mockApplyMapping).toHaveBeenCalledTimes(3)
      expect(mockApplyMapping).toHaveBeenCalledWith(
        ['MAT001', 'Material A', '1500', 'kg'],
        sapMapping
      )
    })
  })

  describe('Mixed Format with Categories', () => {
    it('should handle custom mapping with category headers', async () => {
      const file = createMockFile('mixed-format.xlsx', 1536, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Item Code', 'Product', 'Amt', 'Unit', 'Pos'],
        ['DODANE DO SPISU'],
        ['A001', 'Product A', '100', 'kg', '1'],
        ['PÓŁPRODUKTY'],
        ['B002', 'Product B', '50', 'pcs', '2'],
        ['SUROWCE'],
        ['C003', 'Product C', '75', 'l', '3']
      ]

      const customMapping = {
        itemId: 0,    // Item Code
        name: 1,      // Product
        quantity: 2,  // Amt
        unit: 3,      // Unit
        lp: 4         // Pos
      }

      const mockExcelFile = {
        id: 'file-id-5',
        fileName: 'mixed-format.xlsx',
        fileSize: 1536,
        rowCount: 3
      }

      mockApplyMapping.mockImplementation((row) => {
        if (row.length >= 5) {
          const [itemId, name, quantity, unit, lp] = row
          return {
            itemId: String(itemId),
            name: String(name),
            quantity: parseFloat(String(quantity)),
            unit: String(unit).toLowerCase(),
            lp: parseInt(String(lp))
          }
        }
        return { name: '', quantity: 0, unit: '' }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(customMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rowCount).toBe(3)
      
      // Verify structure includes categories
      expect(data.structure).toBeDefined()
      const categoryItems = data.structure.filter((item: any) => item.type === 'header')
      expect(categoryItems).toHaveLength(3)
      expect(categoryItems.map((item: any) => item.content)).toEqual([
        'DODANE DO SPISU',
        'PÓŁPRODUKTY', 
        'SUROWCE'
      ])
    })
  })

  describe('Error Handling for Custom Mappings', () => {
    it('should reject invalid column mapping JSON', async () => {
      const file = createMockFile('test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', 'invalid json')

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process Excel file')
    })

    it('should handle applyMapping throwing errors', async () => {
      const file = createMockFile('error-mapping.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Col1', 'Col2', 'Col3'],
        ['Data1', 'Data2', 'Data3']
      ]

      const invalidMapping = {
        name: 0,
        quantity: 1,
        unit: 5 // Out of bounds
      }

      mockApplyMapping.mockImplementation(() => {
        throw new Error('Column index out of bounds: 5')
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(invalidMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process Excel file')
    })

    it('should handle missing required mapping fields', async () => {
      const file = createMockFile('incomplete.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Name', 'Quantity'],
        ['Product A', '100']
      ]

      const incompleteMapping = {
        name: 0,
        quantity: 1
        // Missing unit field
      }

      mockApplyMapping.mockImplementation(() => ({
        name: 'Product A',
        quantity: 100
        // Missing unit will cause validation issues
      }))

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(incompleteMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process Excel file')
    })
  })

  describe('Data Aggregation with Custom Mappings', () => {
    it('should properly aggregate items with custom column mapping', async () => {
      const file = createMockFile('aggregation-test.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Product', 'Amount', 'UoM', 'ID'],
        ['Product A', '100', 'kg', 'A001'],
        ['Product B', '50', 'pcs', 'B002'],
        ['Product A', '25', 'kg', 'A001'] // Duplicate for aggregation
      ]

      const customMapping = {
        name: 0,
        quantity: 1,
        unit: 2,
        itemId: 3
      }

      const mockExcelFile = {
        id: 'file-id-6',
        fileName: 'aggregation-test.xlsx',
        fileSize: 1024,
        rowCount: 3
      }

      mockApplyMapping.mockImplementation((row) => {
        const [name, quantity, unit, itemId] = row
        return {
          name: String(name),
          quantity: parseFloat(String(quantity)),
          unit: String(unit).toLowerCase(),
          itemId: String(itemId)
        }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      // Mock aggregated item operations
      prismaMock.aggregatedItem.findUnique.mockResolvedValue(null)
      prismaMock.aggregatedItem.create.mockResolvedValue({
        id: 'agg-1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 125, // 100 + 25
        unit: 'kg',
        count: 2
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(customMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rowCount).toBe(3)
      expect(data.aggregated).toBeDefined()
    })
  })

  describe('Performance with Custom Mappings', () => {
    it('should handle large files with custom mappings efficiently', async () => {
      const file = createMockFile('large-custom.xlsx', 3072, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      // Generate large dataset
      const mockJsonData = [['Item', 'Qty', 'Unit', 'Code']]
      for (let i = 1; i <= 500; i++) {
        mockJsonData.push([`Product ${i}`, '100', 'kg', `CODE${i}`])
      }

      const customMapping = {
        name: 0,
        quantity: 1,
        unit: 2,
        itemId: 3
      }

      const mockExcelFile = {
        id: 'file-id-7',
        fileName: 'large-custom.xlsx',
        fileSize: 3072,
        rowCount: 500
      }

      mockApplyMapping.mockImplementation((row) => {
        const [name, quantity, unit, itemId] = row
        return {
          name: String(name),
          quantity: parseFloat(String(quantity)),
          unit: String(unit).toLowerCase(),
          itemId: String(itemId)
        }
      })

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)
      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('columnMapping', JSON.stringify(customMapping))

      const request = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: formData
      })

      const startTime = performance.now()
      const response = await POST(request)
      const endTime = performance.now()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.rowCount).toBe(500)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete within 10 seconds
      
      // Verify applyMapping was called for each data row
      expect(mockApplyMapping).toHaveBeenCalledTimes(500)
    })
  })
})