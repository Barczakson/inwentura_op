import { NextRequest } from 'next/server'
import { POST } from '../route'
import { db } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    aggregatedItem: {
      upsert: jest.fn(),
    },
  },
}))

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}))

const mockDb = db as jest.Mocked<typeof db>

describe('/api/excel/manual', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should create a new manual entry', async () => {
      const mockItem = {
        id: 'mock-uuid-123',
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
        sourceFiles: [],
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDb.aggregatedItem.upsert.mockResolvedValue(mockItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          itemId: 'A001',
          name: 'Test Product',
          quantity: 10,
          unit: 'kg',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        ...mockItem,
        createdAt: mockItem.createdAt.toISOString(),
        updatedAt: mockItem.updatedAt.toISOString(),
      })
      expect(mockDb.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: 'A001',
            name: 'Test Product',
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
          id: 'mock-uuid-123',
          itemId: 'A001',
          name: 'Test Product',
          quantity: 10,
          unit: 'kg',
          sourceFiles: [],
          count: 1,
        },
      })
    })

    it('should create entry without itemId', async () => {
      const mockItem = {
        id: 'mock-uuid-123',
        itemId: null,
        name: 'Test Product',
        quantity: 5,
        unit: 'l',
        sourceFiles: [],
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDb.aggregatedItem.upsert.mockResolvedValue(mockItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Product',
          quantity: 5,
          unit: 'l',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        ...mockItem,
        createdAt: mockItem.createdAt.toISOString(),
        updatedAt: mockItem.updatedAt.toISOString(),
      })
      expect(mockDb.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: null,
            name: 'Test Product',
            unit: 'l',
          },
        },
        update: {
          quantity: {
            increment: 5,
          },
          count: {
            increment: 1,
          },
        },
        create: {
          id: 'mock-uuid-123',
          itemId: null,
          name: 'Test Product',
          quantity: 5,
          unit: 'l',
          sourceFiles: [],
          count: 1,
        },
      })
    })

    it('should trim whitespace from inputs', async () => {
      const mockItem = {
        id: 'mock-uuid-123',
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
        sourceFiles: [],
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDb.aggregatedItem.upsert.mockResolvedValue(mockItem)

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          itemId: '  A001  ',
          name: '  Test Product  ',
          quantity: 10,
          unit: '  KG  ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockDb.aggregatedItem.upsert).toHaveBeenCalledWith({
        where: {
          itemId_name_unit: {
            itemId: 'A001',
            name: 'Test Product',
            unit: 'kg', // Should be lowercased
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
          id: 'mock-uuid-123',
          itemId: 'A001',
          name: 'Test Product',
          quantity: 10,
          unit: 'kg',
          sourceFiles: [],
          count: 1,
        },
      })
    })

    it('should return 400 for missing name', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          quantity: 10,
          unit: 'kg',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return 400 for missing quantity', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Product',
          unit: 'kg',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return 400 for invalid quantity type', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Product',
          quantity: 'invalid',
          unit: 'kg',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should return 400 for missing unit', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Product',
          quantity: 10,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Name, quantity, and unit are required')
    })

    it('should handle database errors', async () => {
      mockDb.aggregatedItem.upsert.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Product',
          quantity: 10,
          unit: 'kg',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to add manual entry')
    })

    it('should handle JSON parsing errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/manual', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to add manual entry')
    })
  })
})
