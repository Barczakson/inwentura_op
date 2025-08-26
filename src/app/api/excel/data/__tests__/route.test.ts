import { NextRequest } from 'next/server'
import * as dataRoute from '@/app/api/excel/data/route'
import { db } from '@/lib/db-config'

// Mock the database
jest.mock('@/lib/db-config', () => {
  const actual = jest.requireActual('@/lib/db-config')
  return {
    ...actual,
    db: {
      $queryRaw: jest.fn(),
      aggregatedItem: {
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      excelRow: {
        findMany: jest.fn(),
      },
    },
    queries: {
      getAggregatedItems: jest.fn(),
      getExcelRows: jest.fn(),
    },
  }
})

// Mock the migration function
jest.mock('@/lib/migrate', () => ({
  ensureMigrationsRun: jest.fn(),
}))

describe('Data API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET Handler', () => {
    it('should return aggregated data successfully', async () => {
      // Mock database responses
      ;(db.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }])
      ;(db.aggregatedItem.count as jest.Mock).mockResolvedValue(2)
      ;(db.queries.getAggregatedItems as jest.Mock).mockResolvedValue([
        {
          id: '1',
          name: 'Test Item 1',
          quantity: 10,
          unit: 'kg',
        },
        {
          id: '2',
          name: 'Test Item 2',
          quantity: 20,
          unit: 'm',
        },
      ])

      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'GET',
      })

      // Call the GET handler
      const response = await dataRoute.GET(request)
      const data = await response.json()

      // Verify response
      expect(response.status).toBe(200)
      expect(data.aggregated).toHaveLength(2)
      expect(data.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
    })

    it('should handle database connection errors', async () => {
      // Mock database connection failure
      ;(db.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )

      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'GET',
      })

      // Call the GET handler
      const response = await dataRoute.GET(request)
      const data = await response.json()

      // Verify error response
      expect(response.status).toBe(500)
      expect(data.error).toBe('Database connection failed')
    })

    it('should handle search parameters correctly', async () => {
      // Mock database responses
      ;(db.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }])
      ;(db.aggregatedItem.count as jest.Mock).mockResolvedValue(1)
      ;(db.queries.getAggregatedItems as jest.Mock).mockResolvedValue([
        {
          id: '1',
          name: 'Search Result',
          quantity: 15,
          unit: 'kg',
        },
      ])

      // Create a mock request with search parameters
      const request = new NextRequest(
        'http://localhost:3000/api/excel/data?search=test&page=2&limit=25&sortBy=quantity&sortDirection=desc',
        {
          method: 'GET',
        }
      )

      // Call the GET handler
      const response = await dataRoute.GET(request)
      const data = await response.json()

      // Verify response
      expect(response.status).toBe(200)
      expect(data.aggregated).toHaveLength(1)
      expect(data.pagination).toMatchObject({
        page: 2,
        limit: 25,
        total: 1,
        totalPages: 1,
      })
    })

    it('should include raw data when requested', async () => {
      // Mock database responses
      ;(db.$queryRaw as jest.Mock).mockResolvedValue([{ test: 1 }])
      ;(db.aggregatedItem.count as jest.Mock).mockResolvedValue(1)
      ;(db.queries.getAggregatedItems as jest.Mock).mockResolvedValue([
        {
          id: '1',
          name: 'Aggregated Item',
          quantity: 10,
          unit: 'kg',
        },
      ])
      ;(db.queries.getExcelRows as jest.Mock).mockResolvedValue([
        {
          id: 'row1',
          name: 'Raw Item',
          quantity: 5,
          unit: 'kg',
        },
      ])

      // Create a mock request with includeRaw parameter
      const request = new NextRequest(
        'http://localhost:3000/api/excel/data?includeRaw=true',
        {
          method: 'GET',
        }
      )

      // Call the GET handler
      const response = await dataRoute.GET(request)
      const data = await response.json()

      // Verify response includes raw data
      expect(response.status).toBe(200)
      expect(data.aggregated).toHaveLength(1)
      expect(data.raw).toHaveLength(1)
    })
  })

  describe('PUT Handler', () => {
    it('should update an item successfully', async () => {
      // Mock database response
      ;(db.aggregatedItem.update as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Updated Item',
        quantity: 25.5,
        unit: 'kg',
      })

      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          quantity: 25.5,
        }),
      })

      // Call the PUT handler
      const response = await dataRoute.PUT(request)
      const data = await response.json()

      // Verify response
      expect(response.status).toBe(200)
      expect(data.quantity).toBe(25.5)
    })

    it('should handle invalid request data', async () => {
      // Create a mock request with invalid data
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          // Missing quantity
        }),
      })

      // Call the PUT handler
      const response = await dataRoute.PUT(request)
      const data = await response.json()

      // Verify error response
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })

    it('should handle update errors', async () => {
      // Mock database error
      ;(db.aggregatedItem.update as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      )

      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          quantity: 25.5,
        }),
      })

      // Call the PUT handler
      const response = await dataRoute.PUT(request)
      const data = await response.json()

      // Verify error response
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update item')
    })
  })

  describe('DELETE Handler', () => {
    it('should delete an item successfully', async () => {
      // Mock database response
      ;(db.aggregatedItem.delete as jest.Mock).mockResolvedValue({})

      // Create a mock request
      const request = new NextRequest(
        'http://localhost:3000/api/excel/data?id=1',
        {
          method: 'DELETE',
        }
      )

      // Call the DELETE handler
      const response = await dataRoute.DELETE(request)
      const data = await response.json()

      // Verify response
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle missing item ID', async () => {
      // Create a mock request without ID
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'DELETE',
      })

      // Call the DELETE handler
      const response = await dataRoute.DELETE(request)
      const data = await response.json()

      // Verify error response
      expect(response.status).toBe(400)
      expect(data.error).toBe('Item ID is required')
    })

    it('should handle delete errors', async () => {
      // Mock database error
      ;(db.aggregatedItem.delete as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      )

      // Create a mock request
      const request = new NextRequest(
        'http://localhost:3000/api/excel/data?id=1',
        {
          method: 'DELETE',
        }
      )

      // Call the DELETE handler
      const response = await dataRoute.DELETE(request)
      const data = await response.json()

      // Verify error response
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete item')
    })
  })
})