/**
 * Memory Usage and Performance Tests
 * 
 * Tests memory efficiency and performance of large file processing
 */

import { ExcelRowProcessor, MEMORY_LIMITS } from '@/lib/server-optimizations'

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn()
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
})

describe('Memory Usage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPerformanceNow.mockReturnValue(0)
  })

  describe('ExcelRowProcessor', () => {
    it('should process small datasets efficiently', async () => {
      const processor = new ExcelRowProcessor(100)
      
      // Add 50 rows (small dataset)
      for (let i = 0; i < 50; i++) {
        processor.addRow({ id: i, name: `Item ${i}`, quantity: i * 10 })
      }

      const startMemory = process.memoryUsage().heapUsed
      
      const results = await processor.processInChunks(async (chunk) => {
        return chunk.map(row => ({ ...row, processed: true }))
      })

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory

      expect(results).toHaveLength(50)
      expect(results[0]).toHaveProperty('processed', true)
      // Memory increase should be reasonable for small dataset
      expect(memoryIncrease).toBeLessThan(1024 * 1024) // Less than 1MB
    })

    it('should handle large datasets with chunking', async () => {
      const processor = new ExcelRowProcessor(1000) // 1000 rows per chunk
      
      // Add 5000 rows (large dataset)
      for (let i = 0; i < 5000; i++) {
        processor.addRow({ 
          id: i, 
          name: `Item ${i}`, 
          quantity: i * 10,
          description: `Description for item ${i}`.repeat(10) // Make rows larger
        })
      }

      const startMemory = process.memoryUsage().heapUsed
      let chunkCount = 0
      
      const results = await processor.processInChunks(async (chunk) => {
        chunkCount++
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 1))
        return chunk.map(row => ({ ...row, processed: true }))
      })

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory

      expect(results).toHaveLength(5000)
      expect(chunkCount).toBe(5) // 5000 rows / 1000 per chunk = 5 chunks
      expect(results[0]).toHaveProperty('processed', true)
      // Memory increase should be controlled even for large dataset
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })

    it('should respect memory limits configuration', () => {
      expect(MEMORY_LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024) // 10MB
      expect(MEMORY_LIMITS.MAX_ROWS_IN_MEMORY).toBe(5000)
      expect(MEMORY_LIMITS.CHUNK_SIZE).toBe(1000)
    })

    it('should clear memory when requested', () => {
      const processor = new ExcelRowProcessor()
      
      // Add some rows
      for (let i = 0; i < 100; i++) {
        processor.addRow({ id: i, name: `Item ${i}` })
      }

      expect(processor.getRowCount()).toBe(100)
      
      processor.clear()
      
      expect(processor.getRowCount()).toBe(0)
    })

    it('should handle memory pressure gracefully', async () => {
      const processor = new ExcelRowProcessor(10) // Very small chunks
      
      // Add many rows to simulate memory pressure
      for (let i = 0; i < 1000; i++) {
        processor.addRow({ 
          id: i, 
          name: `Item ${i}`,
          largeData: new Array(1000).fill('x').join('') // Large string data
        })
      }

      let processedChunks = 0
      const startTime = Date.now()
      
      const results = await processor.processInChunks(async (chunk) => {
        processedChunks++
        // Simulate processing that might use memory
        const processed = chunk.map(row => ({
          ...row,
          processed: true,
          timestamp: Date.now()
        }))
        
        // Force garbage collection opportunity
        if (global.gc) {
          global.gc()
        }
        
        return processed
      })

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(results).toHaveLength(1000)
      expect(processedChunks).toBe(100) // 1000 rows / 10 per chunk = 100 chunks
      expect(processingTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent processing efficiently', async () => {
      const processors = Array.from({ length: 5 }, () => new ExcelRowProcessor(100))
      
      // Add data to each processor
      processors.forEach((processor, index) => {
        for (let i = 0; i < 200; i++) {
          processor.addRow({ 
            id: `${index}-${i}`, 
            name: `Item ${index}-${i}`,
            processorId: index
          })
        }
      })

      const startMemory = process.memoryUsage().heapUsed
      const startTime = Date.now()
      
      // Process all concurrently
      const allResults = await Promise.all(
        processors.map(processor => 
          processor.processInChunks(async (chunk) => {
            await new Promise(resolve => setTimeout(resolve, 1))
            return chunk.map(row => ({ ...row, processed: true }))
          })
        )
      )

      const endTime = Date.now()
      const endMemory = process.memoryUsage().heapUsed
      
      const processingTime = endTime - startTime
      const memoryIncrease = endMemory - startMemory

      expect(allResults).toHaveLength(5)
      allResults.forEach(results => {
        expect(results).toHaveLength(200)
      })
      
      // Concurrent processing should be efficient
      expect(processingTime).toBeLessThan(3000) // Should complete within 3 seconds
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024) // Less than 20MB total
    })

    it('should handle error scenarios without memory leaks', async () => {
      const processor = new ExcelRowProcessor(100)
      
      // Add some rows
      for (let i = 0; i < 500; i++) {
        processor.addRow({ id: i, name: `Item ${i}` })
      }

      const startMemory = process.memoryUsage().heapUsed
      
      try {
        await processor.processInChunks(async (chunk) => {
          if (chunk[0].id === 200) {
            throw new Error('Simulated processing error')
          }
          return chunk.map(row => ({ ...row, processed: true }))
        })
        
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Simulated processing error')
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = endMemory - startMemory
      
      // Memory should not leak significantly even with errors
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
    })
  })

  describe('Memory Monitoring', () => {
    it('should track memory usage patterns', () => {
      const initialMemory = process.memoryUsage()
      
      expect(initialMemory).toHaveProperty('rss')
      expect(initialMemory).toHaveProperty('heapUsed')
      expect(initialMemory).toHaveProperty('heapTotal')
      expect(initialMemory).toHaveProperty('external')
      
      expect(typeof initialMemory.rss).toBe('number')
      expect(typeof initialMemory.heapUsed).toBe('number')
      expect(typeof initialMemory.heapTotal).toBe('number')
      expect(typeof initialMemory.external).toBe('number')
      
      expect(initialMemory.heapUsed).toBeGreaterThan(0)
      expect(initialMemory.heapTotal).toBeGreaterThanOrEqual(initialMemory.heapUsed)
    })

    it('should detect memory leaks in processing', async () => {
      const measurements: number[] = []
      
      // Take baseline measurement
      measurements.push(process.memoryUsage().heapUsed)
      
      // Perform multiple processing cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        const processor = new ExcelRowProcessor(100)
        
        // Add data
        for (let i = 0; i < 200; i++) {
          processor.addRow({ 
            id: `${cycle}-${i}`, 
            data: new Array(100).fill('x').join('')
          })
        }
        
        // Process data
        await processor.processInChunks(async (chunk) => {
          return chunk.map(row => ({ ...row, processed: true }))
        })
        
        // Clear processor
        processor.clear()
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
        
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Take measurement
        measurements.push(process.memoryUsage().heapUsed)
      }
      
      // Check that memory usage doesn't grow significantly over cycles
      const baseline = measurements[0]
      const final = measurements[measurements.length - 1]
      const growth = final - baseline
      
      // Memory growth should be minimal (less than 5MB)
      expect(growth).toBeLessThan(5 * 1024 * 1024)
    })
  })
})
