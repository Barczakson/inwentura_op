/**
 * @jest-environment node
 */

import { GET, PUT, DELETE } from '../data/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    aggregatedItem: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    excelRow: {
      findMany: jest.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/excel/data', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return aggregated data only by default', async () => {
      const mockAggregatedData = [
        { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
        { id: '2', itemId: 'A002', name: 'Product B', quantity: 5, unit: 'l' },
      ]

      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData as any)

      const request = new NextRequest('http://localhost:3000/api/excel/data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('aggregated')
      expect(data.aggregated).toEqual(mockAggregatedData)
      expect(data).not.toHaveProperty('raw')
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalled()
      expect(mockPrisma.excelRow.findMany).not.toHaveBeenCalled()
    })

    it('should return both aggregated and raw data when includeRaw=true', async () => {
      const mockAggregatedData = [
        { id: '1', itemId: 'A001', name: 'Product A', quantity: 10, unit: 'kg' },
      ]
      const mockRawData = [
        { id: '1', itemId: 'A001', name: 'Product A', quantity: 8, unit: 'kg' },
        { id: '2', itemId: 'A001', name: 'Product A', quantity: 2, unit: 'kg' },
      ]

      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedData as any)
      mockPrisma.excelRow.findMany.mockResolvedValue(mockRawData as any)

      const request = new NextRequest('http://localhost:3000/api/excel/data?includeRaw=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('aggregated')
      expect(data).toHaveProperty('raw')
      expect(data.aggregated).toEqual(mockAggregatedData)
      expect(data.raw).toEqual(mockRawData)
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalled()
      expect(mockPrisma.excelRow.findMany).toHaveBeenCalled()
    })

    it('should filter by fileId when provided', async () => {
      const fileId = 'file-123'
      mockPrisma.aggregatedItem.findMany.mockResolvedValue([])

      const request = new NextRequest(`http://localhost:3000/api/excel/data?fileId=${fileId}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalledWith({
        where: { fileId },
        orderBy: { name: 'asc' },
      })
    })

    it('should handle database errors', async () => {
      mockPrisma.aggregatedItem.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch data')
    })
  })

  describe('PUT', () => {
    it('should update item quantity successfully', async () => {
      const mockUpdatedItem = {
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 15,
        unit: 'kg',
      }

      mockPrisma.aggregatedItem.update.mockResolvedValue(mockUpdatedItem as any)

      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '1', quantity: 15 }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockUpdatedItem)
      expect(mockPrisma.aggregatedItem.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { quantity: 15 },
      })
    })

    it('should return error for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 15 }), // missing id
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required fields: id, quantity')
    })

    it('should return error for invalid quantity', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '1', quantity: -5 }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Quantity must be a positive number')
    })

    it('should handle database errors during update', async () => {
      mockPrisma.aggregatedItem.update.mockRejectedValue(new Error('Update failed'))

      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '1', quantity: 15 }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update item')
    })
  })

  describe('DELETE', () => {
    it('should delete item successfully', async () => {
      mockPrisma.aggregatedItem.delete.mockResolvedValue({
        id: '1',
        itemId: 'A001',
        name: 'Product A',
        quantity: 10,
        unit: 'kg',
      } as any)

      const request = new NextRequest('http://localhost:3000/api/excel/data?id=1', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Item deleted successfully')
      expect(mockPrisma.aggregatedItem.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      })
    })

    it('should return error when id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/data', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing item ID')
      expect(mockPrisma.aggregatedItem.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors during deletion', async () => {
      mockPrisma.aggregatedItem.delete.mockRejectedValue(new Error('Delete failed'))

      const request = new NextRequest('http://localhost:3000/api/excel/data?id=1', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete item')
    })
  })
})