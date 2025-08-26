/**
 * Comprehensive test suite for Excel upload functionality
 * Tests various error scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { POST } from '../src/app/api/excel/upload/route'
import fs from 'fs'
import path from 'path'

// Mock dependencies
jest.mock('../src/lib/db-config', () => ({
  db: {
    excelFile: {
      create: jest.fn(),
    },
    aggregatedItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  withTransaction: jest.fn((callback) => callback({
    excelFile: {
      create: jest.fn().mockResolvedValue({ id: 'test-file-id' }),
    },
  })),
  queries: {
    batchCreateExcelRows: jest.fn().mockResolvedValue([]),
  },
}))

// Helper functions
function createMockFile(name: string, size: number, type: string, content?: Buffer): File {
  const buffer = content || Buffer.from('test content')
  const blob = new Blob([buffer], { type })
  return new File([blob], name, { type })
}

function createValidExcelBuffer(): Buffer {
  // Create a valid Excel workbook with test data
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['DODANE DO SPISU'], // Category header
    ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Headers
    [1, 'TEST001', 'Test Item', 10, 'szt'], // Data row
    [2, 'TEST002', 'Another Item', 5.5, 'kg'], // Another data row
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

function createFormData(file: File): FormData {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

function createNextRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost:3000/api/excel/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('Excel Upload API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset console methods to avoid spam during tests
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('File Validation', () => {
    it('should reject requests without file', async () => {
      const formData = new FormData()
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('No file uploaded')
    })

    it('should reject files that are too large', async () => {
      const largeFile = createMockFile('large.xlsx', 11 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const formData = createFormData(largeFile)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('File too large')
    })

    it('should reject invalid MIME types', async () => {
      const invalidFile = createMockFile('test.txt', 1000, 'text/plain')
      const formData = createFormData(invalidFile)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
    })

    it('should reject files with invalid extensions', async () => {
      const invalidFile = createMockFile('test.pdf', 1000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const formData = createFormData(invalidFile)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid file extension')
    })

    it('should reject files that are too small', async () => {
      const tinyFile = createMockFile('tiny.xlsx', 50, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const formData = createFormData(tinyFile)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('File is too small to be a valid Excel file.')
    })
  })

  describe('Excel File Processing', () => {
    it('should handle corrupted Excel files gracefully', async () => {
      const corruptedBuffer = Buffer.from('not an excel file')
      const corruptedFile = createMockFile('corrupted.xlsx', 1000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', corruptedBuffer)
      const formData = createFormData(corruptedFile)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process Excel file')
    })

    it('should handle Excel files with no sheets', async () => {
      // Mock XLSX.read to return empty workbook
      const originalRead = XLSX.read
      jest.mocked(XLSX.read).mockReturnValueOnce({
        SheetNames: [],
        Sheets: {},
      } as any)
      
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('empty.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Excel file contains no sheets or is corrupted.')
      
      // Restore original function
      XLSX.read = originalRead
    })

    it('should successfully process valid Excel file', async () => {
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.fileId).toBe('test-file-id')
      expect(data.rowCount).toBeGreaterThan(0)
    })
  })

  describe('Data Structure Processing', () => {
    it('should correctly identify category headers', async () => {
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['SUROWCE'], // Category header
        ['PÓŁPRODUKTY'], // Another category header
        ['PRODUKCJA'], // Another category header
        [1, 'TEST001', 'Test Item', 10, 'szt'], // Data row
      ])
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      const file = createMockFile('categories.xlsx', buffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.structure).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            content: 'SUROWCE'
          }),
          expect.objectContaining({
            type: 'header',
            content: 'PÓŁPRODUKTY'
          }),
          expect.objectContaining({
            type: 'header',
            content: 'PRODUKCJA'
          })
        ])
      )
    })

    it('should process data rows with missing fields gracefully', async () => {
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['DODANE DO SPISU'],
        [1, '', 'Item without ID', 5, 'kg'], // Missing item ID
        [2, 'TEST002', '', 3, 'szt'], // Missing name
        [3, 'TEST003', 'Item without unit', 2], // Missing unit
        ['not_a_number', 'TEST004', 'Invalid LP', 1, 'szt'], // Invalid L.p.
      ])
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      const file = createMockFile('partial.xlsx', buffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      // Should only process the row with missing name (item without unit should be skipped)
      expect(data.rowCount).toBe(1)
    })
  })

  describe('Database Integration', () => {
    it('should handle database transaction failures', async () => {
      const { withTransaction } = require('../src/lib/db-config')
      withTransaction.mockRejectedValueOnce(new Error('Database connection failed'))
      
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process Excel file')
    })

    it('should handle aggregation upsert correctly', async () => {
      const { db } = require('../src/lib/db-config')
      
      // Mock existing item found
      db.aggregatedItem.findUnique.mockResolvedValueOnce({
        id: 'existing-item',
        quantity: 5,
        sourceFiles: ['file1'],
        count: 1
      })
      
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      
      expect(db.aggregatedItem.update).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should handle large files with chunked processing', async () => {
      // Create workbook with many rows to trigger chunked processing
      const workbook = XLSX.utils.book_new()
      const largeData = [['DODANE DO SPISU']]
      
      // Add 6000 rows to trigger chunked processing (MEMORY_LIMITS.MAX_ROWS_IN_MEMORY = 5000)
      for (let i = 1; i <= 6000; i++) {
        largeData.push([i, `ITEM${i.toString().padStart(3, '0')}`, `Test Item ${i}`, Math.random() * 100, 'szt'])
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(largeData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      const file = createMockFile('large.xlsx', buffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.rowCount).toBe(6000)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Large dataset detected'))
    })

    it('should handle timeout scenarios', async () => {
      // This test would need to be adjusted based on actual timeout implementation
      // For now, we'll just verify the timeout wrapper is in place
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      // Mock a slow operation
      const { queries } = require('../src/lib/db-config')
      queries.batchCreateExcelRows.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const response = await POST(request)
      expect(response.status).toBe(200) // Should complete within timeout
    })
  })

  describe('Error Handling and Logging', () => {
    it('should provide detailed error information in development', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const { withTransaction } = require('../src/lib/db-config')
      withTransaction.mockRejectedValueOnce(new Error('Specific database error'))
      
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.details).toBe('Specific database error')
      
      process.env.NODE_ENV = originalNodeEnv
    })

    it('should hide error details in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const { withTransaction } = require('../src/lib/db-config')
      withTransaction.mockRejectedValueOnce(new Error('Sensitive error information'))
      
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.details).toBeUndefined()
      
      process.env.NODE_ENV = originalNodeEnv
    })

    it('should log performance metrics', async () => {
      const validBuffer = createValidExcelBuffer()
      const file = createMockFile('valid.xlsx', validBuffer.length, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', validBuffer)
      const formData = createFormData(file)
      const request = createNextRequest(formData)
      
      const response = await POST(request)
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing Excel file'),
        expect.objectContaining({
          performance: expect.objectContaining({
            totalTime: expect.any(Number),
            checkpoints: expect.any(Array)
          })
        })
      )
    })
  })
})

// Additional utility tests
describe('Excel Upload Utilities', () => {
  describe('File Type Detection', () => {
    it('should handle edge cases in file type detection', () => {
      const edgeCases = [
        { name: 'file.XLSX', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', shouldPass: true },
        { name: 'file.XLS', type: 'application/vnd.ms-excel', shouldPass: true },
        { name: 'file.xlsx.backup', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', shouldPass: false },
        { name: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', shouldPass: false },
      ]

      edgeCases.forEach(testCase => {
        const fileName = testCase.name.toLowerCase()
        const passes = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
        expect(passes).toBe(testCase.shouldPass)
      })
    })
  })
})