/**
 * File Processing Performance Tests
 * 
 * Tests performance of file upload, processing, and validation
 */

import { validateFile, validateExcelStructure, MAX_FILE_SIZE } from '@/lib/file-validation'
import { PerformanceMonitor } from '@/lib/server-optimizations'

// Mock File constructor for testing
class MockFile {
  constructor(
    private content: ArrayBuffer,
    public name: string,
    private options: { type?: string } = {}
  ) {}

  get size() {
    return this.content.byteLength
  }

  get type() {
    return this.options.type || ''
  }

  arrayBuffer() {
    return Promise.resolve(this.content)
  }
}

// Helper to create mock files of specific sizes
const createMockFile = (name: string, sizeInMB: number, type: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') => {
  const sizeInBytes = sizeInMB * 1024 * 1024
  const buffer = new ArrayBuffer(sizeInBytes)
  
  // Add XLSX header for structure validation
  if (name.endsWith('.xlsx')) {
    const view = new Uint8Array(buffer)
    view[0] = 0x50 // ZIP header
    view[1] = 0x4B
    view[2] = 0x03
    view[3] = 0x04
  }
  
  return new MockFile(buffer, name, { type }) as unknown as File
}

describe('File Processing Performance Tests', () => {
  describe('File Validation Performance', () => {
    it('should validate small files quickly', () => {
      const file = createMockFile('small.xlsx', 0.1) // 100KB
      
      const startTime = performance.now()
      const result = validateFile(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(10) // Less than 10ms
    })

    it('should validate medium files efficiently', () => {
      const file = createMockFile('medium.xlsx', 2) // 2MB
      
      const startTime = performance.now()
      const result = validateFile(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(50) // Less than 50ms
    })

    it('should handle large files within time limits', () => {
      const file = createMockFile('large.xlsx', 8) // 8MB (close to limit)
      
      const startTime = performance.now()
      const result = validateFile(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Less than 100ms
    })

    it('should reject oversized files quickly', () => {
      const file = createMockFile('oversized.xlsx', 15) // 15MB (over limit)
      
      const startTime = performance.now()
      const result = validateFile(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('za duży')
      expect(endTime - startTime).toBeLessThan(10) // Should fail fast
    })

    it('should validate multiple files concurrently', () => {
      const files = [
        createMockFile('file1.xlsx', 1),
        createMockFile('file2.xlsx', 1.5),
        createMockFile('file3.xlsx', 2),
        createMockFile('file4.xlsx', 0.5),
        createMockFile('file5.xlsx', 3),
      ]
      
      const startTime = performance.now()
      const results = files.map(file => validateFile(file))
      const endTime = performance.now()
      
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result.isValid).toBe(true)
      })
      expect(endTime - startTime).toBeLessThan(100) // All validations under 100ms
    })
  })

  describe('Excel Structure Validation Performance', () => {
    it('should validate Excel structure efficiently', async () => {
      const file = createMockFile('test.xlsx', 1)
      
      const startTime = performance.now()
      const result = await validateExcelStructure(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Less than 100ms
    })

    it('should handle corrupted files quickly', async () => {
      // Create a file with wrong header
      const buffer = new ArrayBuffer(1024)
      const view = new Uint8Array(buffer)
      view[0] = 0xFF // Wrong header
      view[1] = 0xFF
      view[2] = 0xFF
      view[3] = 0xFF
      
      const file = new MockFile(buffer, 'corrupted.xlsx') as unknown as File
      
      const startTime = performance.now()
      const result = await validateExcelStructure(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(false)
      expect(endTime - startTime).toBeLessThan(50) // Should detect corruption quickly
    })

    it('should handle large file structure validation', async () => {
      const file = createMockFile('large.xlsx', 5) // 5MB
      
      const startTime = performance.now()
      const result = await validateExcelStructure(file)
      const endTime = performance.now()
      
      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(500) // Less than 500ms for large files
    })
  })

  describe('Performance Monitoring', () => {
    it('should track performance checkpoints accurately', () => {
      const monitor = new PerformanceMonitor()
      
      // Simulate some work with checkpoints
      monitor.checkpoint('start')
      
      // Simulate work
      const start = Date.now()
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
      
      monitor.checkpoint('middle')
      
      // More work
      const start2 = Date.now()
      while (Date.now() - start2 < 5) {
        // Busy wait for 5ms
      }
      
      monitor.checkpoint('end')
      
      const report = monitor.getReport()
      
      expect(report).toHaveProperty('totalTime')
      expect(report).toHaveProperty('checkpoints')
      expect(report.checkpoints).toHaveLength(3)
      
      expect(report.checkpoints[0].name).toBe('start')
      expect(report.checkpoints[1].name).toBe('middle')
      expect(report.checkpoints[2].name).toBe('end')
      
      // Check that times are reasonable
      expect(report.totalTime).toBeGreaterThan(10)
      expect(report.checkpoints[1].delta).toBeGreaterThan(5)
      expect(report.checkpoints[2].delta).toBeGreaterThan(2)
    })

    it('should handle rapid checkpoint creation', () => {
      const monitor = new PerformanceMonitor()
      
      // Create many checkpoints rapidly
      for (let i = 0; i < 100; i++) {
        monitor.checkpoint(`checkpoint_${i}`)
      }
      
      const report = monitor.getReport()
      
      expect(report.checkpoints).toHaveLength(100)
      expect(report.totalTime).toBeGreaterThan(0)
      
      // All checkpoints should have valid times
      report.checkpoints.forEach((checkpoint, index) => {
        expect(checkpoint.name).toBe(`checkpoint_${index}`)
        expect(checkpoint.time).toBeGreaterThanOrEqual(0)
        expect(checkpoint.delta).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Load Testing Scenarios', () => {
    it('should handle burst file validation', () => {
      const fileCount = 50
      const files = Array.from({ length: fileCount }, (_, i) => 
        createMockFile(`file_${i}.xlsx`, Math.random() * 5 + 0.5) // 0.5-5.5MB files
      )
      
      const startTime = performance.now()
      const results = files.map(file => validateFile(file))
      const endTime = performance.now()
      
      expect(results).toHaveLength(fileCount)
      results.forEach(result => {
        expect(result.isValid).toBe(true)
      })
      
      const avgTimePerFile = (endTime - startTime) / fileCount
      expect(avgTimePerFile).toBeLessThan(10) // Less than 10ms per file on average
    })

    it('should handle concurrent structure validations', async () => {
      const fileCount = 10
      const files = Array.from({ length: fileCount }, (_, i) => 
        createMockFile(`file_${i}.xlsx`, 1 + i * 0.5) // Varying sizes
      )
      
      const startTime = performance.now()
      const results = await Promise.all(
        files.map(file => validateExcelStructure(file))
      )
      const endTime = performance.now()
      
      expect(results).toHaveLength(fileCount)
      results.forEach(result => {
        expect(result.isValid).toBe(true)
      })
      
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(2000) // All concurrent validations under 2 seconds
    })

    it('should maintain performance under memory pressure', async () => {
      const iterations = 20
      const timings: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const file = createMockFile(`pressure_test_${i}.xlsx`, 2)
        
        const startTime = performance.now()
        const result = await validateExcelStructure(file)
        const endTime = performance.now()
        
        expect(result.isValid).toBe(true)
        timings.push(endTime - startTime)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      // Performance should remain consistent
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
      const maxTime = Math.max(...timings)
      const minTime = Math.min(...timings)
      
      expect(avgTime).toBeLessThan(200) // Average under 200ms
      expect(maxTime - minTime).toBeLessThan(500) // Variance under 500ms
    })

    it('should handle edge case file sizes efficiently', () => {
      const edgeCases = [
        { name: 'tiny.xlsx', size: 0.001 }, // 1KB
        { name: 'exactly_limit.xlsx', size: MAX_FILE_SIZE / (1024 * 1024) }, // Exactly at limit
        { name: 'just_under.xlsx', size: (MAX_FILE_SIZE - 1) / (1024 * 1024) }, // Just under limit
      ]
      
      edgeCases.forEach(({ name, size }) => {
        const file = createMockFile(name, size)
        
        const startTime = performance.now()
        const result = validateFile(file)
        const endTime = performance.now()
        
        if (size >= 0.0001) { // Files larger than 100 bytes should be valid
          expect(result.isValid).toBe(true)
        }
        expect(endTime - startTime).toBeLessThan(20) // All edge cases under 20ms
      })
    })
  })

  describe('Resource Cleanup', () => {
    it('should not leak memory during repeated validations', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform many validations
      for (let i = 0; i < 100; i++) {
        const file = createMockFile(`cleanup_test_${i}.xlsx`, 1)
        await validateExcelStructure(file)
        
        // Periodic cleanup
        if (i % 10 === 0 && global.gc) {
          global.gc()
        }
      }
      
      // Force final cleanup
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })
  })
})
