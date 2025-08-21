import { NextRequest } from 'next/server'
import { GET, POST, PUT, DELETE } from '../route'
import { db } from '@/lib/db-config'
import { prismaMock } from '../../../../../../__mocks__/prisma'

// Mock the database
jest.mock('@/lib/db-config', () => ({
  db: prismaMock,
}))

// Mock column detection functions
jest.mock('@/lib/column-detection', () => ({
  detectColumns: jest.fn(),
  validateMapping: jest.fn(),
  createDefaultMapping: jest.fn(),
}))

import { detectColumns, validateMapping, createDefaultMapping } from '@/lib/column-detection'

const mockDetectColumns = detectColumns as jest.MockedFunction<typeof detectColumns>
const mockValidateMapping = validateMapping as jest.MockedFunction<typeof validateMapping>
const mockCreateDefaultMapping = createDefaultMapping as jest.MockedFunction<typeof createDefaultMapping>

describe('/api/excel/column-mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET - Fetch column mappings', () => {
    it('should return all column mappings ordered correctly', async () => {
      const mockMappings = [
        {
          id: 'mapping1',
          name: 'Default Mapping',
          description: 'Standard layout',
          isDefault: true,
          mapping: { name: 0, quantity: 1, unit: 2 },
          headers: ['Nazwa', 'Ilość', 'Jednostka'],
          usageCount: 10,
          lastUsed: new Date('2025-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'mapping2',
          name: 'SAP Export',
          description: 'SAP system export format',
          isDefault: false,
          mapping: { itemId: 0, name: 1, quantity: 2, unit: 3 },
          headers: ['Material', 'Description', 'Amount', 'UoM'],
          usageCount: 5,
          lastUsed: new Date('2025-01-02'),
          createdAt: new Date('2024-02-01'),
        }
      ]

      prismaMock.columnMapping.findMany.mockResolvedValue(mockMappings)

      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.mappings).toHaveLength(2)
      expect(data.mappings[0].name).toBe('Default Mapping')
      expect(data.mappings[1].name).toBe('SAP Export')
      
      expect(prismaMock.columnMapping.findMany).toHaveBeenCalledWith({
        orderBy: [
          { isDefault: 'desc' },
          { usageCount: 'desc' },
          { lastUsed: 'desc' },
        ],
        select: {
          id: true,
          name: true,
          description: true,
          isDefault: true,
          mapping: true,
          headers: true,
          usageCount: true,
          lastUsed: true,
          createdAt: true,
        }
      })
    })

    it('should handle database errors gracefully', async () => {
      prismaMock.columnMapping.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch column mappings')
    })
  })

  describe('POST - Detect columns or save mapping', () => {
    describe('action: detect', () => {
      it('should detect columns automatically', async () => {
        const headers = ['L.p.', 'Kod', 'Nazwa', 'Ilość', 'Jednostka']
        const sampleData = [['1', 'A001', 'Product A', '100', 'kg']]
        
        const mockDetection = {
          mapping: { lp: 0, itemId: 1, name: 2, quantity: 3, unit: 4 },
          confidence: 95,
          suggestions: []
        }
        
        const mockSuggestions = [
          { column: 0, possibleTypes: ['lp'], confidence: 90 },
          { column: 1, possibleTypes: ['itemId'], confidence: 85 }
        ]

        mockDetectColumns.mockReturnValue(mockDetection)
        mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'detect',
            headers,
            sampleData
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.detection).toEqual(mockDetection)
        expect(data.suggestions).toEqual(mockSuggestions)
        expect(mockDetectColumns).toHaveBeenCalledWith(headers, sampleData)
        expect(mockCreateDefaultMapping).toHaveBeenCalledWith(headers)
      })

      it('should handle detection failure and provide suggestions', async () => {
        const headers = ['Col1', 'Col2', 'Col3']
        const mockSuggestions = [
          { column: 0, possibleTypes: ['unknown'], confidence: 30 }
        ]

        mockDetectColumns.mockImplementation(() => {
          throw new Error('Unable to detect columns automatically')
        })
        mockCreateDefaultMapping.mockReturnValue(mockSuggestions)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'detect',
            headers
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.detection).toBeNull()
        expect(data.error).toBe('Unable to detect columns automatically')
        expect(data.suggestions).toEqual(mockSuggestions)
      })

      it('should reject detection without headers', async () => {
        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'detect'
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Headers array is required for detection')
      })
    })

    describe('action: save', () => {
      it('should save valid column mapping', async () => {
        const mapping = { name: 0, quantity: 1, unit: 2 }
        const headers = ['Nazwa', 'Ilość', 'Jednostka']
        const name = 'My Custom Mapping'
        const description = 'Custom layout for our files'

        const mockValidation = {
          isValid: true,
          errors: []
        }

        const mockSavedMapping = {
          id: 'new-mapping-id',
          name,
          description,
          mapping,
          headers,
          isDefault: false,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        mockValidateMapping.mockReturnValue(mockValidation)
        prismaMock.columnMapping.create.mockResolvedValue(mockSavedMapping)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'save',
            mapping,
            headers,
            name,
            description
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.mapping).toEqual(mockSavedMapping)
        expect(data.validation).toEqual(mockValidation)
        
        expect(mockValidateMapping).toHaveBeenCalledWith(mapping, headers)
        expect(prismaMock.columnMapping.create).toHaveBeenCalledWith({
          data: {
            name,
            description,
            mapping,
            headers,
            isDefault: false,
          }
        })
      })

      it('should reject invalid mapping', async () => {
        const mapping = { name: 0 } // Missing required fields
        const headers = ['Nazwa']
        const name = 'Invalid Mapping'

        const mockValidation = {
          isValid: false,
          errors: ['Missing required field: quantity', 'Missing required field: unit']
        }

        mockValidateMapping.mockReturnValue(mockValidation)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'save',
            mapping,
            headers,
            name
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid mapping')
        expect(data.details).toEqual(mockValidation.errors)
      })

      it('should reject save without mapping or name', async () => {
        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'POST',
          body: JSON.stringify({
            action: 'save'
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Mapping configuration and name are required')
      })
    })

    it('should reject invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid action. Use "detect" or "save"')
    })
  })

  describe('PUT - Update mapping', () => {
    describe('action: use', () => {
      it('should track mapping usage', async () => {
        const mappingId = 'mapping-id'
        const mockUpdatedMapping = {
          id: mappingId,
          name: 'Test Mapping',
          usageCount: 6,
          lastUsed: new Date(),
        }

        prismaMock.columnMapping.update.mockResolvedValue(mockUpdatedMapping)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'PUT',
          body: JSON.stringify({
            id: mappingId,
            action: 'use'
          })
        })

        const response = await PUT(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.mapping).toEqual(mockUpdatedMapping)
        
        expect(prismaMock.columnMapping.update).toHaveBeenCalledWith({
          where: { id: mappingId },
          data: {
            usageCount: { increment: 1 },
            lastUsed: expect.any(Date),
          }
        })
      })
    })

    describe('action: update', () => {
      it('should update mapping configuration', async () => {
        const mappingId = 'mapping-id'
        const newMapping = { name: 0, quantity: 1, unit: 2 }
        const newName = 'Updated Name'
        const newDescription = 'Updated description'

        const mockValidation = {
          isValid: true,
          errors: []
        }

        const mockUpdatedMapping = {
          id: mappingId,
          name: newName,
          description: newDescription,
          mapping: newMapping,
        }

        mockValidateMapping.mockReturnValue(mockValidation)
        prismaMock.columnMapping.update.mockResolvedValue(mockUpdatedMapping)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'PUT',
          body: JSON.stringify({
            id: mappingId,
            action: 'update',
            mapping: newMapping,
            name: newName,
            description: newDescription
          })
        })

        const response = await PUT(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.mapping).toEqual(mockUpdatedMapping)
        
        expect(prismaMock.columnMapping.update).toHaveBeenCalledWith({
          where: { id: mappingId },
          data: {
            mapping: newMapping,
            name: newName,
            description: newDescription
          }
        })
      })

      it('should reject invalid mapping update', async () => {
        const mappingId = 'mapping-id'
        const invalidMapping = { name: 0 } // Missing required fields

        const mockValidation = {
          isValid: false,
          errors: ['Missing required field: quantity']
        }

        mockValidateMapping.mockReturnValue(mockValidation)

        const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
          method: 'PUT',
          body: JSON.stringify({
            id: mappingId,
            action: 'update',
            mapping: invalidMapping
          })
        })

        const response = await PUT(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid mapping')
        expect(data.details).toEqual(mockValidation.errors)
      })
    })

    it('should reject update without ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'use'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Mapping ID is required')
    })

    it('should reject invalid update action', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'mapping-id',
          action: 'invalid'
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid action. Use "use" or "update"')
    })
  })

  describe('DELETE - Remove mapping', () => {
    it('should delete non-default mapping', async () => {
      const mappingId = 'mapping-id'
      
      const mockExisting = {
        isDefault: false,
        name: 'Custom Mapping'
      }

      prismaMock.columnMapping.findUnique.mockResolvedValue(mockExisting)
      prismaMock.columnMapping.delete.mockResolvedValue({ id: mappingId })

      const request = new NextRequest(`http://localhost:3000/api/excel/column-mapping?id=${mappingId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      expect(prismaMock.columnMapping.findUnique).toHaveBeenCalledWith({
        where: { id: mappingId },
        select: { isDefault: true, name: true }
      })
      
      expect(prismaMock.columnMapping.delete).toHaveBeenCalledWith({
        where: { id: mappingId }
      })
    })

    it('should reject deletion of default mapping', async () => {
      const mappingId = 'default-mapping-id'
      
      const mockExisting = {
        isDefault: true,
        name: 'Default Mapping'
      }

      prismaMock.columnMapping.findUnique.mockResolvedValue(mockExisting)

      const request = new NextRequest(`http://localhost:3000/api/excel/column-mapping?id=${mappingId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot delete default mapping')
      expect(prismaMock.columnMapping.delete).not.toHaveBeenCalled()
    })

    it('should reject deletion of non-existent mapping', async () => {
      const mappingId = 'non-existent-id'
      
      prismaMock.columnMapping.findUnique.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/excel/column-mapping?id=${mappingId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Mapping not found')
      expect(prismaMock.columnMapping.delete).not.toHaveBeenCalled()
    })

    it('should reject deletion without ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Mapping ID is required')
    })
  })

  describe('Error Handling', () => {
    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process column mapping')
    })

    it('should handle database connection errors', async () => {
      prismaMock.columnMapping.create.mockRejectedValue(new Error('Database connection lost'))

      const request = new NextRequest('http://localhost:3000/api/excel/column-mapping', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          mapping: { name: 0, quantity: 1, unit: 2 },
          name: 'Test Mapping'
        })
      })

      mockValidateMapping.mockReturnValue({ isValid: true, errors: [] })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process column mapping')
    })
  })
})