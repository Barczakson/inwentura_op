/**
 * @jest-environment node
 */

import { GET, DELETE } from '../files/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  db: {
    excelFile: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    excelRow: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    aggregatedItem: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'

const mockPrisma = db as jest.Mocked<typeof db>

describe('/api/excel/files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return list of files', async () => {
      const mockFiles = [
        {
          id: 'file1',
          fileName: 'inventory.xlsx',
          fileSize: 1024,
          uploadDate: new Date('2023-01-01'),
          rowCount: 10,
        },
      ]

      const expectedFiles = [
        {
          id: 'file1',
          name: 'inventory.xlsx',
          size: 1024,
          uploadDate: '2023-01-01T00:00:00.000Z',
          rowCount: 10,
        },
      ]

      mockPrisma.excelFile.findMany.mockResolvedValue(mockFiles)

      const request = new NextRequest('http://localhost:3000/api/excel/files')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(expectedFiles)
      expect(mockPrisma.excelFile.findMany).toHaveBeenCalledWith({
        orderBy: {
          uploadDate: 'desc',
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.excelFile.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/excel/files')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch files')
    })
  })

  describe('DELETE', () => {
    it('should delete a file and its related data successfully', async () => {
      const fileId = 'file1'
      
      // Mock data for rows to delete
      const mockRowsToDelete = [
        { 
          id: 'row1', 
          itemId: 'A001', 
          name: 'Product A', 
          unit: 'kg', 
          quantity: 10,
          fileId: 'file1'
        },
      ]
      
      // Mock aggregated items
      const mockAggregatedItems = [
        {
          id: 'item1',
          itemId: 'A001',
          name: 'Product A',
          unit: 'kg',
          quantity: 15,
          count: 2,
          sourceFiles: '["file1", "file2"]',
        },
      ]
      
      mockPrisma.excelRow.findMany.mockResolvedValue(mockRowsToDelete)
      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedItems)
      mockPrisma.aggregatedItem.update.mockResolvedValue({
        ...mockAggregatedItems[0],
        quantity: 5, // 15 - 10
        count: 1, // 2 - 1
        sourceFiles: '["file2"]',
      })
      mockPrisma.excelRow.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.excelFile.delete.mockResolvedValue({})

      const request = new NextRequest(`http://localhost:3000/api/excel/files?id=${fileId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Check that all the necessary database operations were called
      expect(mockPrisma.excelRow.findMany).toHaveBeenCalledWith({
        where: { fileId },
      })
      
      expect(mockPrisma.aggregatedItem.findMany).toHaveBeenCalled()
      
      expect(mockPrisma.aggregatedItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: {
          sourceFiles: '["file2"]',
          quantity: 5,
          count: 1,
        },
      })
      
      expect(mockPrisma.excelRow.deleteMany).toHaveBeenCalledWith({
        where: { fileId },
      })
      
      expect(mockPrisma.excelFile.delete).toHaveBeenCalledWith({
        where: { id: fileId },
      })
    })

    it('should delete aggregated items when no source files remain', async () => {
      const fileId = 'file1'
      
      // Mock data for rows to delete
      const mockRowsToDelete = [
        { 
          id: 'row1', 
          itemId: 'A001', 
          name: 'Product A', 
          unit: 'kg', 
          quantity: 10,
          fileId: 'file1'
        },
      ]
      
      // Mock aggregated items with only this file as source
      const mockAggregatedItems = [
        {
          id: 'item1',
          itemId: 'A001',
          name: 'Product A',
          unit: 'kg',
          quantity: 10,
          count: 1,
          sourceFiles: '["file1"]',
        },
      ]
      
      mockPrisma.excelRow.findMany.mockResolvedValue(mockRowsToDelete)
      mockPrisma.aggregatedItem.findMany.mockResolvedValue(mockAggregatedItems)
      mockPrisma.aggregatedItem.delete.mockResolvedValue({})
      mockPrisma.excelRow.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.excelFile.delete.mockResolvedValue({})

      const request = new NextRequest(`http://localhost:3000/api/excel/files?id=${fileId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Check that the aggregated item was deleted
      expect(mockPrisma.aggregatedItem.delete).toHaveBeenCalledWith({
        where: { id: 'item1' },
      })
    })

    it('should return error when file ID is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/excel/files')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File ID is required')
    })

    it('should handle database errors gracefully', async () => {
      const fileId = 'file1'
      
      mockPrisma.excelRow.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/excel/files?id=${fileId}`)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete file')
    })
  })
})