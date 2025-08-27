/**
 * End-to-End Integration Tests
 *
 * Tests complete user workflows from file upload to data export
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as PreviewPOST } from '@/app/api/excel/preview/route'
import { POST as MappingPOST, PUT as MappingPUT } from '@/app/api/excel/column-mapping/route'
import { POST as UploadPOST } from '@/app/api/excel/upload/route'
import { GET as ExportGET } from '@/app/api/excel/export/route'
import { POST as ManualPOST } from '@/app/api/excel/manual/route'

// Mock dependencies
jest.mock('@/lib/db-config', () => ({
  db: {
    excelFile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    excelRow: {
      createMany: jest.fn(),
    },
    aggregatedItem: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    columnMapping: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
  queries: {
    getExcelRows: jest.fn(),
    batchCreateExcelRows: jest.fn(),
  },
}))

jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
    json_to_sheet: jest.fn(),
    book_new: jest.fn(),
    book_append_sheet: jest.fn(),
    decode_range: jest.fn(),
    encode_cell: jest.fn(),
  },
  write: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}))

jest.mock('@/lib/server-optimizations', () => ({
  withTimeout: jest.fn((fn) => fn),
  withErrorHandling: jest.fn((fn) => fn),
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    checkpoint: jest.fn(),
    getReport: jest.fn(() => ({ totalTime: 100, checkpoints: [] })),
  })),
  REQUEST_TIMEOUTS: {
    UPLOAD: 30000,
    EXPORT: 60000,
  },
}))

// Import mocked modules
const { db, queries } = require('@/lib/db-config')
const XLSX = require('xlsx')

// Helper to create mock files
const createMockFile = (name: string, size: number, type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
  const content = 'x'.repeat(size)
  return {
    name,
    size,
    type,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(size)),
  } as File
}

describe('End-to-End Workflow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete File Processing Workflow', () => {
    it('should handle complete workflow: Preview → Mapping → Upload → Export', async () => {
      // STEP 1: File Preview
      const file = createMockFile('inventory.xlsx', 2048)
      
      const mockWorkbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
      const mockJsonData = [
        ['Nr indeksu', 'Nazwa towaru', 'Ilość', 'Jednostka'],
        ['A001', 'Steel Rod', '1500', 'kg'],
        ['A002', 'Aluminum Sheet', '750', 'sq.m'],
        ['A003', 'Copper Wire', '250', 'm']
      ]

      XLSX.read.mockReturnValue(mockWorkbook)
      XLSX.utils.sheet_to_json.mockReturnValue(mockJsonData)

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
      expect(previewData.structure.headers).toEqual(['Nr indeksu', 'Nazwa towaru', 'Ilość', 'Jednostka'])
      expect(previewData.structure.estimatedDataRows).toBe(3)

      // STEP 2: Column Mapping Detection
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
      expect(detectionData.success).toBe(true)
      expect(detectionData.detection.mapping).toHaveProperty('itemId')
      expect(detectionData.detection.mapping).toHaveProperty('name')
      expect(detectionData.detection.mapping).toHaveProperty('quantity')
      expect(detectionData.detection.mapping).toHaveProperty('unit')

      // STEP 3: Save Column Mapping
      const mockSavedMapping = {
        id: 'mapping-1',
        name: 'Standard Inventory Format',
        mapping: detectionData.detection.mapping,
        headers: previewData.structure.headers,
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      db.columnMapping.create.mockResolvedValue(mockSavedMapping)

      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: detectionData.detection.mapping,
          headers: previewData.structure.headers,
          name: 'Standard Inventory Format',
          description: 'Standard inventory layout with item ID'
        })
      })

      const saveResponse = await MappingPOST(saveRequest)
      const saveData = await saveResponse.json()

      expect(saveResponse.status).toBe(200)
      expect(saveData.success).toBe(true)
      expect(saveData.mapping.id).toBe('mapping-1')

      // STEP 4: File Upload with Mapping
      const mockExcelFile = {
        id: 'file-1',
        fileName: 'inventory.xlsx',
        fileSize: 2048,
        rowCount: 3,
        uploadDate: new Date(),
        originalStructure: previewData.structure
      }

      const mockExcelRows = [
        { id: 'row-1', itemId: 'A001', name: 'Steel Rod', quantity: 1500, unit: 'kg', fileId: 'file-1' },
        { id: 'row-2', itemId: 'A002', name: 'Aluminum Sheet', quantity: 750, unit: 'sq.m', fileId: 'file-1' },
        { id: 'row-3', itemId: 'A003', name: 'Copper Wire', quantity: 250, unit: 'm', fileId: 'file-1' }
      ]

      db.excelFile.create.mockResolvedValue(mockExcelFile)
      queries.batchCreateExcelRows.mockResolvedValue(undefined)

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
      expect(uploadData.fileId).toBe('file-1')
      expect(uploadData.rowCount).toBe(3)

      // STEP 5: Track Mapping Usage
      const mockUsedMapping = {
        ...mockSavedMapping,
        usageCount: 1,
        lastUsed: new Date()
      }

      db.columnMapping.update.mockResolvedValue(mockUsedMapping)

      const useRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'mapping-1',
          action: 'use'
        })
      })

      const useResponse = await MappingPUT(useRequest)
      const useData = await useResponse.json()

      expect(useResponse.status).toBe(200)
      expect(useData.success).toBe(true)

      // STEP 6: Export Data
      db.excelFile.findMany.mockResolvedValue([mockExcelFile])
      
      const mockWorksheet = { '!ref': 'A1:E4', '!cols': [] }
      const mockExportWorkbook = {}
      const mockBuffer = Buffer.from('mock excel data')

      XLSX.utils.json_to_sheet.mockReturnValue(mockWorksheet)
      XLSX.utils.book_new.mockReturnValue(mockExportWorkbook)
      XLSX.utils.decode_range.mockReturnValue({ s: { r: 0 }, e: { r: 3 } })
      XLSX.write.mockReturnValue(mockBuffer)

      const exportRequest = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const exportResponse = await ExportGET(exportRequest)

      expect(exportResponse.status).toBe(200)
      expect(exportResponse.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(exportResponse.headers.get('Content-Disposition')).toContain('attachment')

      // Verify all database operations were called
      expect(db.columnMapping.create).toHaveBeenCalled()
      expect(db.excelFile.create).toHaveBeenCalled()
      expect(db.columnMapping.update).toHaveBeenCalled()
      expect(db.excelFile.findMany).toHaveBeenCalled()
    })

    it('should handle workflow with manual data entry', async () => {
      // STEP 1: Manual Entry
      const mockAggregatedItem = {
        id: 'item-1',
        itemId: 'M001',
        name: 'Manual Entry Product',
        quantity: 100,
        unit: 'kg',
        count: 1,
        sourceFiles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      db.aggregatedItem.upsert.mockResolvedValue(mockAggregatedItem)

      const manualRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'M001',
          name: 'Manual Entry Product',
          quantity: 100,
          unit: 'kg'
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const manualResponse = await ManualPOST(manualRequest)
      const manualData = await manualResponse.json()

      expect(manualResponse.status).toBe(200)
      expect(manualData.success).toBe(true)
      expect(manualData.item.itemId).toBe('M001')

      // STEP 2: Export with Manual Data
      db.excelFile.findMany.mockResolvedValue([])
      db.aggregatedItem.findMany.mockResolvedValue([mockAggregatedItem])

      const exportRequest = new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', {
        method: 'GET',
      })

      const exportResponse = await ExportGET(exportRequest)

      expect(exportResponse.status).toBe(200)
      expect(db.aggregatedItem.upsert).toHaveBeenCalled()
    })
  })

  describe('Error Recovery Workflows', () => {
    it('should handle failed upload and retry workflow', async () => {
      // STEP 1: Failed Upload
      const file = createMockFile('problematic.xlsx', 2048)
      
      db.excelFile.create.mockRejectedValueOnce(new Error('Database error'))

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('columnMapping', JSON.stringify({ name: 0, quantity: 1, unit: 2 }))

      const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const uploadResponse = await UploadPOST(uploadRequest)
      const uploadData = await uploadResponse.json()

      expect(uploadResponse.status).toBe(500)
      expect(uploadData.error).toBeDefined()

      // STEP 2: Retry with Success
      const mockExcelFile = {
        id: 'file-retry-1',
        fileName: 'problematic.xlsx',
        fileSize: 2048,
        rowCount: 1
      }

      db.excelFile.create.mockResolvedValue(mockExcelFile)
      db.queries.batchCreateExcelRows.mockResolvedValue(undefined)

      const retryRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
        method: 'POST',
        body: uploadFormData
      })

      const retryResponse = await UploadPOST(retryRequest)
      const retryData = await retryResponse.json()

      expect(retryResponse.status).toBe(200)
      expect(retryData.success).toBe(true)
      expect(retryData.fileId).toBe('file-retry-1')
    })

    it('should handle mapping detection failure and manual override', async () => {
      // STEP 1: Detection Failure
      const detectionRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'detect',
          headers: ['A', 'B', 'C', 'D'], // Ambiguous headers
          sampleData: [['x', 'y', 'z', 'w']]
        })
      })

      const detectionResponse = await MappingPOST(detectionRequest)
      const detectionData = await detectionResponse.json()

      expect(detectionResponse.status).toBe(200)
      expect(detectionData.detection.confidence).toBeLessThan(50) // Low confidence

      // STEP 2: Manual Override
      const manualMapping = {
        name: 1,
        quantity: 2,
        unit: 3,
        itemId: 0
      }

      const mockManualMapping = {
        id: 'mapping-manual-1',
        name: 'Manual Override Mapping',
        mapping: manualMapping,
        headers: ['A', 'B', 'C', 'D'],
        isDefault: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      db.columnMapping.create.mockResolvedValue(mockManualMapping)

      const saveRequest = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: manualMapping,
          headers: ['A', 'B', 'C', 'D'],
          name: 'Manual Override Mapping',
          description: 'Manually created mapping for ambiguous headers'
        })
      })

      const saveResponse = await MappingPOST(saveRequest)
      const saveData = await saveResponse.json()

      expect(saveResponse.status).toBe(200)
      expect(saveData.success).toBe(true)
      expect(saveData.mapping.name).toBe('Manual Override Mapping')
    })
  })

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent workflows', async () => {
      const workflows = Array.from({ length: 5 }, (_, i) => ({
        file: createMockFile(`file-${i}.xlsx`, 1024),
        mapping: { name: 0, quantity: 1, unit: 2 }
      }))

      // Mock successful responses for all workflows
      workflows.forEach((_, i) => {
        db.excelFile.create.mockResolvedValueOnce({
          id: `file-${i}`,
          fileName: `file-${i}.xlsx`,
          fileSize: 1024,
          rowCount: 1
        })
      })

      queries.batchCreateExcelRows.mockResolvedValue(undefined)

      const startTime = Date.now()

      // Execute all workflows concurrently
      const promises = workflows.map(async (workflow, i) => {
        const uploadFormData = new FormData()
        uploadFormData.append('file', workflow.file)
        uploadFormData.append('columnMapping', JSON.stringify(workflow.mapping))

        const uploadRequest = new NextRequest('http://localhost:3000/api/excel/upload', {
          method: 'POST',
          body: uploadFormData
        })

        return UploadPOST(uploadRequest)
      })

      const responses = await Promise.all(promises)
      const endTime = Date.now()

      // All workflows should succeed
      responses.forEach((response, i) => {
        expect(response.status).toBe(200)
      })

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000) // 5 seconds

      // Verify all database operations were called
      expect(db.excelFile.create).toHaveBeenCalledTimes(5)
    })
  })
})
