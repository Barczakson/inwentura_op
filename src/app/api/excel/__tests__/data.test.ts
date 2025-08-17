/**
 * @jest-environment node
 */

import { GET, PUT, DELETE } from '../data/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  db: {
    aggregatedItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    excelRow: {
      findMany: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'

const mockPrisma = db as jest.Mocked<typeof db>

describe('/api/excel/data', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return aggregated data without raw data by default', async () => {
      const mockAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1"]',
          count: 1,
        },
      ]

      const mockSourceRows = [
        { fileId: 'file1' },
      ]

      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData)
      mockPrisma.excelRow.findMany.mockResolvedValue(mockSourceRows)

      const request = new NextRequest('http://localhost:3000/api/excel/data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('aggregated')
      expect(data).not.toHaveProperty('raw')
      expect(data.aggregated).toHaveLength(1)
      expect(data.aggregated[0]).toHaveProperty('sourceFiles')
    })

    it('should return aggregated and raw data when includeRaw is true', async () => {
      const mockAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1"]',
          count: 1,
        },
      ]

      const mockRawData = [
        {
          id: 'row1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          fileId: 'file1',
        },
      ]

      const mockSourceRows = [
        { fileId: 'file1' },
      ]

      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData)
      mockPrisma.excelRow.findMany.mockResolvedValueOnce(mockSourceRows).mockResolvedValueOnce(mockRawData)

      const request = new NextRequest('http://localhost:3000/api/excel/data?includeRaw=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('aggregated')
      expect(data).toHaveProperty('raw')
      expect(data.aggregated).toHaveLength(1)
      expect(data.raw).toHaveLength(1)
    })

    it('should filter data by fileId when provided', async () => {
      const mockAllAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1", "file2"]',
          count: 2,
          fileId: 'file1',
        },
        {
          id: '2',
          itemId: 'A002',
          name: 'Product B',
          quantity: 5,
          unit: 'l',
          sourceFiles: '["file2"]',
          count: 1,
          fileId: 'file2',
        },
      ]

      const mockSourceRows1 = [
        { fileId: 'file1' },
        { fileId: 'file2' },
      ]

      const mockSourceRows2 = [
        { fileId: 'file2' },
      ]

      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAllAggregatedData)
      mockPrisma.excelRow.findMany
        .mockResolvedValueOnce(mockSourceRows1)
        .mockResolvedValueOnce(mockSourceRows2)

      const request = new NextRequest('http://localhost:3000/api/excel/data?fileId=file1')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.aggregated).toHaveLength(1) // Only items from file1
      expect(data.aggregated[0].id).toBe('1')
    })

    it('should handle search parameter', async () => {
      const mockAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1"]',
          count: 1,
        },
      ]

      const mockSourceRows = [
        { fileId: 'file1' },
      ]

      mockPrisma.aggregatedItem.count.mockResolvedValue(1)
      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData)
      mockPrisma.excelRow.findMany.mockResolvedValue(mockSourceRows)

      const request = new NextRequest('http://localhost:3000/api/excel/data?search=Product')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Check that the where clause was correctly passed to findMany
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'Product', mode: 'insensitive' } },
              { itemId: { contains: 'Product', mode: 'insensitive' } },
            ],
          },
        })
      )
    })

    it('should handle pagination parameters', async () => {
      const mockAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1"]',
          count: 1,
        },
      ]

      const mockSourceRows = [
        { fileId: 'file1' },
      ]

      mockPrisma.aggregatedItem.count.mockResolvedValue(100)
      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData)
      mockPrisma.excelRow.findMany.mockResolvedValue(mockSourceRows)

      const request = new NextRequest('http://localhost:3000/api/excel/data?page=2&limit=25')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('pagination')
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(25)
      expect(data.pagination.total).toBe(100)
      expect(data.pagination.totalPages).toBe(4)
    })

    it('should handle sorting parameters', async () => {
      const mockAggregatedData = [
        {
          id: '1',
          itemId: 'A001',
          name: 'Product A',
          quantity: 10,
          unit: 'kg',
          sourceFiles: '["file1"]',
          count: 1,
        },
      ]

      const mockSourceRows = [
        { fileId: 'file1' },
      ]

      mockPrisma.aggregatedItem.count.mockResolvedValue(1)
      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData)
      mockPrisma.excelRow.findMany.mockResolvedValue(mockSourceRows)

      const request = new NextRequest('http://localhost:3000/api/excel/data?sortBy=quantity&sortDirection=desc')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Check that the orderBy clause was correctly passed to findMany
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            quantity: 'desc',
          },
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.aggregatedItem.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch data')
    })
  })

  describe('PUT', () => {
    it('should update an item successfully', async () => {
      const mockUpdatedItem = {
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 15, // Updated quantity
        unit: 'kg',
      }

      mockPrisma.aggregatedItem.update.mockResolvedValue(mockUpdatedItem)

      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          quantity: 15,
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.quantity).toBe(15)
      expect(mockPrisma.aggregatedItem.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { quantity: 15 },
      })
    })

    it('should return error when id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          quantity: 15,
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })

    it('should return error when quantity is not a number', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          quantity: 'not-a-number',
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request data')
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.aggregatedItem.update.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        body: JSON.stringify({
          id: '1',
          quantity: 15,
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update item')
    })
  })

  describe('DELETE', () => {
    it('should delete an item successfully', async () => {
      mockPrisma.aggregatedItem.delete.mockResolvedValue({})

      const request = new NextRequest('http://localhost:3000/api/excel/data?id=1')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrisma.aggregatedItem.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      })
    })

    it('should return error when id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Item ID is required')
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.aggregatedItem.delete.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/data?id=1')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete item')
    })
  })
})