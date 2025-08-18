/**
 * @jest-environment node
 */

import { POST } from '../manual/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  db: {
    aggregatedItem: {
      upsert: jest.fn(),
    },
  },
}))

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}))

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

const mockPrisma = db as jest.Mocked<typeof db>
const mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe('/api/excel/manual', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should add a manual entry successfully', async () => {
      const mockAggregatedItem = {
        id: 'mock-uuid',
        itemId: 'A001',
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        sourceFiles: '[]',
        count: 1,
      }

      const expectedItem = {
        ...mockAggregatedItem,
        sourceFiles: [],
      }

      mockPrisma.aggregatedItem.upsert.mockResolvedValue(mockAggregatedItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(expectedItem)
      
      // Check that the upsert was called with correct parameters
      expect(mockPrisma.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: 'A001',
            name: 'Product A',
            unit: 'kg',
          },
        },
        update: {
          quantity: {
            increment: 10,
          },
          count: {
            increment: 1,
          },
        },
        create: {
          id: 'mock-uuid',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '[]',
          count: 1,
        },
      })
    })

    it('should add a manual entry without item ID', async () => {
      const mockAggregatedItem = {
        id: 'mock-uuid',
        itemId: null,
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        sourceFiles: '[]',
        count: 1,
      }

      const expectedItem = {
        ...mockAggregatedItem,
        sourceFiles: [],
      }

      mockPrisma.aggregatedItem.upsert.mockResolvedValue(mockAggregatedItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(expectedItem)
      
      // Check that the upsert was called with correct parameters
      expect(mockPrisma.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: null,
            name: 'Product A',
            unit: 'kg',
          },
        },
        update: {
          quantity: {
            increment: 10,
          },
          count: {
            increment: 1,
          },
        },
        create: {
          id: 'mock-uuid',
          itemId: null,
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '[]',
          count: 1,
        },
      })
    })

    it('should return error when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          quantity: 10,
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return error when quantity is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Product A',
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return error when unit is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Product A',
          quantity: 10,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return error when quantity is not a number', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Product A',
          quantity: 'not-a-number',
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should trim and normalize input data', async () => {
      const mockAggregatedItem = {
        id: 'mock-uuid',
        itemId: 'A001',
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
        sourceFiles: '[]',
        count: 1,
      }

      mockPrisma.aggregatedItem.upsert.mockResolvedValue(mockAggregatedItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          itemId: ' A001 ', // Whitespace around
          name: ' Product A ', // Whitespace around
          quantity: 10,
          unit: ' KG ', // Uppercase and whitespace
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      
      // Check that the upsert was called with cleaned data
      expect(mockPrisma.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: 'A001', // Trimmed
            name: 'Product A', // Trimmed
            unit: 'kg', // Lowercased
          },
        },
        update: {
          quantity: {
            increment: 10,
          },
          count: {
            increment: 1,
          },
        },
        create: {
          id: 'mock-uuid',
          itemId: 'A001', // Trimmed
          name: 'Product A', // Trimmed
          quantity: 10,
          unit: 'kg', // Lowercased
          sourceFiles: '[]',
          count: 1,
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.aggregatedItem.upsert.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to add manual entry')
    })
  })
})