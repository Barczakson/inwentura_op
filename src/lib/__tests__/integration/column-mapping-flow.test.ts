// Mock Prisma first
const prismaMock = {
  excelFile: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  aggregatedItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  columnMapping: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}

// Mock all dependencies
jest.mock('xlsx')
jest.mock('@/lib/db-config', () => ({
  db: prismaMock,
  withTransaction: jest.fn(),
  queries: {
    batchCreateExcelRows: jest.fn()
  }
}))

// Import after mocking
import { NextRequest } from 'next/server'
import { POST as PreviewPOST } from '../../../app/api/excel/preview/route'
import { POST as MappingPOST } from '../../../app/api/excel/column-mapping/route'
import { POST as UploadPOST } from '../../../app/api/excel/upload/route'
import * as XLSX from 'xlsx'
import { withTransaction, queries } from '@/lib/db-config'

const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>
const mockBatchCreateExcelRows = queries.batchCreateExcelRows as jest.MockedFunction<typeof queries.batchCreateExcelRows>
const mockXLSXRead = XLSX.read as jest.MockedFunction<typeof XLSX.read>
const mockSheetToJson = XLSX.utils.sheet_to_json as jest.MockedFunction<typeof XLSX.utils.sheet_to_json>

describe('Column Mapping Integration Flow', () => {
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

  describe('Complete Flow: Preview → Mapping → Upload', () => {
    it('should handle complete workflow for SAP export format', async () => {
      // Test data setup
      const file = createMockFile('sap-export.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['Material', 'Description', 'Amount', 'UoM', 'Plant'],
        ['MAT001', 'Steel Rod', '1500', 'kg', 'P001'],
        ['MAT002', 'Aluminum Sheet', '750', 'sq.m', 'P002'],
        ['MAT003', 'Copper Wire', '250', 'm', 'P001']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      // STEP 1: Preview the file
      const previewFormData = new FormData()
      previewFormData.append('file', file)

      const previewRequest = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: previewFormData
      })

      const previewResponse = await PreviewPOST(previewRequest)
      const previewData = await previewResponse.json()

      expect(previewResponse.status).toBe(200)
      expect(previewData.success).toBe(true)
      expect(previewData.structure.headers).toEqual(['Material', 'Description', 'Amount', 'UoM', 'Plant'])
      expect(previewData.structure.estimatedDataRows).toBe(3)

      // STEP 2: Detect columns automatically
      const detectionRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detect',
          headers: previewData.structure.headers,
          sampleData: previewData.structure.sampleData
        })
      })

      const detectionResponse = await MappingPOST(detectionRequest)
      const detectionData = await detectionResponse.json()

      expect(detectionResponse.status).toBe(200)
      
      // The detection should identify this as SAP format
      expect(detectionData.detection.mapping).toEqual({
        itemId: 0,    // Material
        name: 1,      // Description  
        quantity: 2,  // Amount
        unit: 3       // UoM
        // Plant column (4) should be ignored
      })
      expect(detectionData.detection.confidence).toBeGreaterThan(70)

      // STEP 3: Save the mapping for future use
      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: detectionData.detection.mapping,
          headers: previewData.structure.headers,
          name: 'SAP Export Format',
          description: 'Standard SAP material export layout'
        })
      })

      const mockSavedMapping = {
        id: 'mapping-sap-1',
        name: 'SAP Export Format',
        description: 'Standard SAP material export layout',
        mapping: detectionData.detection.mapping,
        headers: previewData.structure.headers,
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prismaMock.columnMapping.create.mockResolvedValue(mockSavedMapping)

      const saveResponse = await MappingPOST(saveRequest)
      const saveData = await saveResponse.json()

      expect(saveResponse.status).toBe(200)
      expect(saveData.success).toBe(true)
      expect(saveData.mapping.id).toBe('mapping-sap-1')

      // STEP 4: Upload the file with the detected mapping
      const mockExcelFile = {
        id: 'file-sap-1',
        fileName: 'sap-export.xlsx',
        fileSize: 2048,
        rowCount: 3
      }

      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('columnMapping', JSON.stringify(detectionData.detection.mapping))

      const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await UploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.success).toBe(true)
      expect(uploadData.fileId).toBe('file-sap-1')
      expect(uploadData.rowCount).toBe(3)

      // STEP 5: Track mapping usage
      const useRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'mapping-sap-1',
          action: 'use'
        })
      })

      const mockUsedMapping = {
        ...mockSavedMapping,
        usageCount: 1,
        lastUsed: new Date()
      }

      prismaMock.columnMapping.update.mockResolvedValue(mockUsedMapping)

      const useResponse = await MappingPOST(useRequest)
      const useData = await useResponse.json()

      expect(useResponse.status).toBe(200)
      expect(useData.success).toBe(true)
    })

    it('should handle workflow for minimal format (name, quantity, unit only)', async () => {
      const file = createMockFile('minimal-inventory.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Inventory'], { Inventory: {} })
      
      const mockJsonData = [
        ['Product Name', 'Stock', 'Unit'],
        ['Cement Bags', '500', 'pcs'],
        ['Steel Rods', '1200', 'kg'],
        ['Paint Cans', '75', 'l']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      // Preview
      const previewFormData = new FormData()
      previewFormData.append('file', file)

      const previewRequest = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: previewFormData
      })

      const previewResponse = await PreviewPOST(previewRequest)
      const previewData = await previewResponse.json()

      expect(previewResponse.status).toBe(200)
      expect(previewData.structure.headers).toEqual(['Product Name', 'Stock', 'Unit'])

      // Detection
      const detectionRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detect',
          headers: previewData.structure.headers,
          sampleData: previewData.structure.sampleData
        })
      })

      const detectionResponse = await MappingPOST(detectionRequest)
      const detectionData = await detectionResponse.json()

      expect(detectionResponse.status).toBe(200)
      expect(detectionData.detection.mapping).toEqual({
        name: 0,      // Product Name
        quantity: 1,  // Stock
        unit: 2       // Unit
      })

      // Upload with minimal mapping
      const mockExcelFile = {
        id: 'file-minimal-1',
        fileName: 'minimal-inventory.xlsx',
        fileSize: 1024,
        rowCount: 3
      }

      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('columnMapping', JSON.stringify(detectionData.detection.mapping))

      const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await UploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.success).toBe(true)
      expect(uploadData.rowCount).toBe(3)
    })

    it('should handle manual mapping override for custom format', async () => {
      const file = createMockFile('custom-layout.xlsx', 1536, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Data'], { Data: {} })
      
      const mockJsonData = [
        ['Qty', 'Item Name', 'Code', 'UoM', 'Position'],
        ['150', 'Widget A', 'W001', 'pcs', '1'],
        ['75', 'Gadget B', 'G002', 'kg', '2'],
        ['200', 'Tool C', 'T003', 'set', '3']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      // Preview
      const previewFormData = new FormData()
      previewFormData.append('file', file)

      const previewRequest = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: previewFormData
      })

      const previewResponse = await PreviewPOST(previewRequest)
      const previewData = await previewResponse.json()

      expect(previewResponse.status).toBe(200)

      // Attempt automatic detection (may fail due to unusual order)
      const detectionRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detect',
          headers: previewData.structure.headers,
          sampleData: previewData.structure.sampleData
        })
      })

      const detectionResponse = await MappingPOST(detectionRequest)
      const detectionData = await detectionResponse.json()

      // Manual override - user creates custom mapping
      const manualMapping = {
        quantity: 0,  // Qty
        name: 1,      // Item Name
        itemId: 2,    // Code
        unit: 3,      // UoM
        lp: 4         // Position
      }

      // Save manual mapping
      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: manualMapping,
          headers: previewData.structure.headers,
          name: 'Custom Layout - Qty First',
          description: 'Custom format with quantity in first column'
        })
      })

      const mockManualMapping = {
        id: 'mapping-custom-1',
        name: 'Custom Layout - Qty First',
        description: 'Custom format with quantity in first column',
        mapping: manualMapping,
        headers: previewData.structure.headers,
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prismaMock.columnMapping.create.mockResolvedValue(mockManualMapping)

      const saveResponse = await MappingPOST(saveRequest)
      const saveData = await saveResponse.json()

      expect(saveResponse.status).toBe(200)
      expect(saveData.success).toBe(true)

      // Upload with manual mapping
      const mockExcelFile = {
        id: 'file-custom-1',
        fileName: 'custom-layout.xlsx',
        fileSize: 1536,
        rowCount: 3
      }

      prismaMock.excelFile.create.mockResolvedValue(mockExcelFile)
      mockBatchCreateExcelRows.mockResolvedValue(undefined)

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('columnMapping', JSON.stringify(manualMapping))

      const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await UploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(200)
      expect(uploadData.success).toBe(true)
      expect(uploadData.rowCount).toBe(3)
    })
  })

  describe('Error Scenarios in Integration Flow', () => {
    it('should handle detection failure and manual fallback', async () => {
      const file = createMockFile('problematic.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      
      const mockWorkbook = createMockWorkbook(['Sheet1'], { Sheet1: {} })
      
      const mockJsonData = [
        ['A', 'B', 'C', 'D'], // Very ambiguous headers
        ['x', 'y', 'z', 'w'],
        ['1', '2', '3', '4']
      ]

      mockXLSXRead.mockReturnValue(mockWorkbook)
      mockSheetToJson.mockReturnValue(mockJsonData)

      // Preview should work
      const previewFormData = new FormData()
      previewFormData.append('file', file)

      const previewRequest = new NextRequest('http://localhost:3000/api/excel/preview', {
        method: 'POST',
        body: previewFormData
      })

      const previewResponse = await PreviewPOST(previewRequest)
      const previewData = await previewResponse.json()

      expect(previewResponse.status).toBe(200)

      // Detection should fail but provide fallback suggestions
      const detectionRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detect',
          headers: previewData.structure.headers,
          sampleData: previewData.structure.sampleData
        })
      })

      const detectionResponse = await MappingPOST(detectionRequest)
      const detectionData = await detectionResponse.json()

      expect(detectionResponse.status).toBe(200)
      expect(detectionData.detection).toBeNull()
      expect(detectionData.error).toBeTruthy()
      expect(detectionData.suggestions).toBeDefined()

      // User should still be able to create manual mapping
      const manualMapping = {
        name: 1,      // B
        quantity: 2,  // C  
        unit: 3       // D
      }

      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: manualMapping,
          headers: ['A', 'B', 'C', 'D'],
          name: 'Manual Override'
        })
      })

      const mockSavedMapping = {
        id: 'mapping-manual-1',
        name: 'Manual Override',
        mapping: manualMapping,
        headers: ['A', 'B', 'C', 'D'],
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      prismaMock.columnMapping.create.mockResolvedValue(mockSavedMapping)

      const saveResponse = await MappingPOST(saveRequest)
      expect(saveResponse.status).toBe(200)
    })

    it('should validate mapping before upload', async () => {
      const file = createMockFile('invalid-mapping.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      // Try to save invalid mapping (missing required fields)
      const invalidMapping = {
        name: 0
        // Missing quantity and unit
      }

      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: invalidMapping,
          headers: ['Name'],
          name: 'Invalid Mapping'
        })
      })

      const saveResponse = await MappingPOST(saveRequest)
      const saveData = await saveResponse.json()

      expect(saveResponse.status).toBe(400)
      expect(saveData.error).toBe('Invalid mapping')
      expect(saveData.details).toContain('Missing required field: quantity')
      expect(saveData.details).toContain('Missing required field: unit')
    })
  })

  describe('Saved Mappings Management in Flow', () => {
    it('should allow retrieval and reuse of saved mappings', async () => {
      // Setup existing mappings
      const existingMappings = [
        {
          id: 'mapping-1',
          name: 'Standard Format',
          description: 'Default layout',
          isDefault: true,
          mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
          headers: ['L.p.', 'Nr indeksu', 'Nazwa', 'Ilość', 'JMZ'],
          usageCount: 15,
          lastUsed: new Date('2025-01-15'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mapping-2',
          name: 'SAP Export',
          description: 'SAP system format',
          isDefault: false,
          mapping: { itemId: 0, name: 1, quantity: 2, unit: 3 },
          headers: ['Material', 'Description', 'Amount', 'UoM'],
          usageCount: 8,
          lastUsed: new Date('2025-01-20'),
          createdAt: new Date('2024-06-01'),
        }
      ]

      prismaMock.columnMapping.findMany.mockResolvedValue(existingMappings)

      // Get saved mappings
      const getMappingsRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping')
      const getMappingsResponse = await MappingPOST(getMappingsRequest)
      const getMappingsData = await getMappingsResponse.json()

      expect(getMappingsResponse.status).toBe(200)
      expect(getMappingsData.mappings).toHaveLength(2)
      expect(getMappingsData.mappings[0].name).toBe('Standard Format')
      expect(getMappingsData.mappings[0].isDefault).toBe(true)

      // User selects existing mapping for new file
      const selectedMapping = existingMappings[1] // SAP Export

      // Track usage
      const useRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'PUT',
        body: JSON.stringify({
          id: selectedMapping.id,
          action: 'use'
        })
      })

      const updatedMapping = {
        ...selectedMapping,
        usageCount: 9,
        lastUsed: new Date()
      }

      prismaMock.columnMapping.update.mockResolvedValue(updatedMapping)

      const useResponse = await MappingPOST(useRequest)
      const useData = await useResponse.json()

      expect(useResponse.status).toBe(200)
      expect(useData.success).toBe(true)
      expect(useData.mapping.usageCount).toBe(9)
    })
  })
})