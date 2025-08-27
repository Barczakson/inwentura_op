/**
 * API Load Testing
 *
 * Tests API endpoints under load conditions
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as healthGet } from '@/app/api/health/route'
import { POST as manualPost } from '@/app/api/excel/manual/route'
import { GET as exportGet } from '@/app/api/excel/export/route'

// Mock dependencies for load testing
jest.mock('@/lib/db-config', () => ({
  db: {
    aggregatedItem: {
      upsert: jest.fn().mockResolvedValue({
        id: 'test-id',
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
        sourceFiles: [],
        count: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    },
    excelFile: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
  queries: {
    getExcelRows: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('@/lib/server-optimizations', () => ({
  withTimeout: jest.fn((fn) => fn),
  withErrorHandling: jest.fn((fn) => fn),
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    checkpoint: jest.fn(),
    getReport: jest.fn(() => ({ totalTime: 100, checkpoints: [] })),
  })),
  REQUEST_TIMEOUTS: {
    EXPORT: 30000,
  },
}))

jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn().mockReturnValue({}),
    book_new: jest.fn().mockReturnValue({}),
    book_append_sheet: jest.fn(),
    decode_range: jest.fn().mockReturnValue({ s: { r: 0 }, e: { r: 0 } }),
    encode_cell: jest.fn().mockReturnValue('A1'),
  },
  write: jest.fn().mockReturnValue(Buffer.from('mock excel data')),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}))

describe('API Load Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Health Endpoint Load Testing', () => {
    it('should handle high frequency requests', async () => {
      const requestCount = 100
      const startTime = performance.now()
      
      const promises = Array.from({ length: requestCount }, () => healthGet())
      const responses = await Promise.all(promises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgResponseTime = totalTime / requestCount
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(10) // Less than 10ms per request
      expect(totalTime).toBeLessThan(1000) // Total under 1 second
    })

    it('should handle burst requests efficiently', async () => {
      const burstSize = 50
      const burstCount = 5
      const results: number[] = []
      
      for (let burst = 0; burst < burstCount; burst++) {
        const startTime = performance.now()
        
        const promises = Array.from({ length: burstSize }, () => healthGet())
        const responses = await Promise.all(promises)
        
        const endTime = performance.now()
        const burstTime = endTime - startTime
        results.push(burstTime)
        
        // All requests in burst should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200)
        })
        
        // Small delay between bursts
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Performance should remain consistent across bursts
      const avgBurstTime = results.reduce((a, b) => a + b, 0) / results.length
      const maxBurstTime = Math.max(...results)
      const minBurstTime = Math.min(...results)
      
      expect(avgBurstTime).toBeLessThan(500) // Average burst under 500ms
      expect(maxBurstTime - minBurstTime).toBeLessThan(1000) // Variance under 1 second
    })
  })

  describe('Manual Entry Endpoint Load Testing', () => {
    it('should handle concurrent manual entries', async () => {
      const entryCount = 20
      const entries = Array.from({ length: entryCount }, (_, i) => ({
        name: `Product ${i}`,
        quantity: 10 + i,
        unit: i % 2 === 0 ? 'kg' : 'l',
        itemId: `A${String(i).padStart(3, '0')}`,
      }))
      
      const startTime = performance.now()
      
      const promises = entries.map(entry => {
        const request = new NextRequest('http://localhost:3000/api/excel/manual', {
          method: 'POST',
          body: JSON.stringify(entry),
          headers: { 'Content-Type': 'application/json' },
        })
        return manualPost(request)
      })
      
      const responses = await Promise.all(promises)
      const endTime = performance.now()
      
      const totalTime = endTime - startTime
      const avgResponseTime = totalTime / entryCount
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      expect(avgResponseTime).toBeLessThan(100) // Less than 100ms per entry
      expect(totalTime).toBeLessThan(2000) // Total under 2 seconds
    })

    it('should handle rapid sequential entries', async () => {
      const entryCount = 50
      const timings: number[] = []
      
      for (let i = 0; i < entryCount; i++) {
        const entry = {
          name: `Sequential Product ${i}`,
          quantity: 5 + i,
          unit: 'kg',
          itemId: `SEQ${String(i).padStart(3, '0')}`,
        }
        
        const request = new NextRequest('http://localhost:3000/api/excel/manual', {
          method: 'POST',
          body: JSON.stringify(entry),
          headers: { 'Content-Type': 'application/json' },
        })
        
        const startTime = performance.now()
        const response = await manualPost(request)
        const endTime = performance.now()
        
        expect(response.status).toBe(200)
        timings.push(endTime - startTime)
      }
      
      // Performance should remain consistent
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
      const maxTime = Math.max(...timings)
      const minTime = Math.min(...timings)
      
      expect(avgTime).toBeLessThan(50) // Average under 50ms
      expect(maxTime).toBeLessThan(200) // Max under 200ms
      expect(maxTime - minTime).toBeLessThan(150) // Variance under 150ms
    })
  })

  describe('Export Endpoint Load Testing', () => {
    it('should handle concurrent export requests', async () => {
      const exportCount = 5 // Fewer concurrent exports due to resource intensity
      
      const startTime = performance.now()
      
      const promises = Array.from({ length: exportCount }, (_, i) => {
        const request = new NextRequest(`http://localhost:3000/api/excel/export?type=aggregated&test=${i}`, {
          method: 'GET',
        })
        return exportGet(request)
      })
      
      const responses = await Promise.all(promises)
      const endTime = performance.now()
      
      const totalTime = endTime - startTime
      const avgResponseTime = totalTime / exportCount
      
      // All requests should succeed (or return 404 for no data)
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status)
      })
      
      expect(avgResponseTime).toBeLessThan(1000) // Less than 1 second per export
      expect(totalTime).toBeLessThan(3000) // Total under 3 seconds
    })

    it('should handle mixed export types efficiently', async () => {
      const requests = [
        new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', { method: 'GET' }),
        new NextRequest('http://localhost:3000/api/excel/export?type=raw', { method: 'GET' }),
        new NextRequest('http://localhost:3000/api/excel/export?type=aggregated', { method: 'GET' }),
        new NextRequest('http://localhost:3000/api/excel/export?type=raw', { method: 'GET' }),
      ]
      
      const startTime = performance.now()
      const responses = await Promise.all(requests.map(req => exportGet(req)))
      const endTime = performance.now()
      
      const totalTime = endTime - startTime
      
      // All requests should complete
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status)
      })
      
      expect(totalTime).toBeLessThan(2000) // Mixed exports under 2 seconds
    })
  })

  describe('Mixed Load Testing', () => {
    it('should handle mixed API load efficiently', async () => {
      const operations = [
        // Health checks
        ...Array.from({ length: 20 }, () => ({ type: 'health', fn: () => healthGet() })),
        
        // Manual entries
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'manual',
          fn: () => {
            const request = new NextRequest('http://localhost:3000/api/excel/manual', {
              method: 'POST',
              body: JSON.stringify({
                name: `Mixed Load Product ${i}`,
                quantity: 10 + i,
                unit: 'kg',
              }),
              headers: { 'Content-Type': 'application/json' },
            })
            return manualPost(request)
          }
        })),
        
        // Exports
        ...Array.from({ length: 3 }, (_, i) => ({
          type: 'export',
          fn: () => {
            const request = new NextRequest(`http://localhost:3000/api/excel/export?type=aggregated&mixed=${i}`, {
              method: 'GET',
            })
            return exportGet(request)
          }
        })),
      ]
      
      // Shuffle operations to simulate real-world mixed load
      const shuffled = operations.sort(() => Math.random() - 0.5)
      
      const startTime = performance.now()
      const responses = await Promise.all(shuffled.map(op => op.fn()))
      const endTime = performance.now()
      
      const totalTime = endTime - startTime
      
      // All operations should complete successfully
      responses.forEach((response, index) => {
        const operation = shuffled[index]
        if (operation.type === 'health' || operation.type === 'manual') {
          expect(response.status).toBe(200)
        } else {
          expect([200, 404]).toContain(response.status)
        }
      })
      
      expect(totalTime).toBeLessThan(5000) // Mixed load under 5 seconds
    })

    it('should maintain performance under sustained load', async () => {
      const duration = 2000 // 2 seconds of sustained load
      const interval = 50 // New request every 50ms
      const startTime = Date.now()
      const responses: any[] = []
      
      while (Date.now() - startTime < duration) {
        const requestType = Math.random()
        
        let promise: Promise<any>
        if (requestType < 0.7) {
          // 70% health checks
          promise = healthGet()
        } else if (requestType < 0.9) {
          // 20% manual entries
          const request = new NextRequest('http://localhost:3000/api/excel/manual', {
            method: 'POST',
            body: JSON.stringify({
              name: `Sustained Load Product ${Date.now()}`,
              quantity: Math.floor(Math.random() * 100) + 1,
              unit: Math.random() > 0.5 ? 'kg' : 'l',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          promise = manualPost(request)
        } else {
          // 10% exports
          const request = new NextRequest(`http://localhost:3000/api/excel/export?type=aggregated&sustained=${Date.now()}`, {
            method: 'GET',
          })
          promise = exportGet(request)
        }
        
        responses.push(promise)
        await new Promise(resolve => setTimeout(resolve, interval))
      }
      
      // Wait for all requests to complete
      const results = await Promise.all(responses)
      
      // All requests should complete successfully
      results.forEach(response => {
        expect([200, 404]).toContain(response.status)
      })
      
      expect(responses.length).toBeGreaterThan(30) // Should have made many requests
    })
  })

  describe('Resource Management Under Load', () => {
    it('should not leak memory under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await healthGet()
        
        if (i % 10 === 0) {
          const request = new NextRequest('http://localhost:3000/api/excel/manual', {
            method: 'POST',
            body: JSON.stringify({
              name: `Memory Test Product ${i}`,
              quantity: i,
              unit: 'kg',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          await manualPost(request)
        }
        
        // Periodic cleanup
        if (i % 20 === 0 && global.gc) {
          global.gc()
        }
      }
      
      // Force final cleanup
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // Less than 20MB
    })
  })
})
