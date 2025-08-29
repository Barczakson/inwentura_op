/**
 * Large File Processing Performance Tests
 * 
 * Comprehensive performance tests for processing large Excel files including:
 * - Memory usage monitoring and optimization
 * - Processing time benchmarks
 * - Concurrent file processing
 * - Database batch operations performance
 * - Real-time progress updates under load
 */

import { POST } from '../../../app/api/excel/upload/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db-config';
import * as XLSX from 'xlsx';
import {
  SocketTestServer,
  SocketTestClient,
  SocketTestManager
} from '../../../test-utils/socket-test-helpers';

describe('Large File Processing Performance Tests', () => {
  let testFileIds: string[] = [];
  let socketManager: SocketTestManager;
  let server: SocketTestServer;
  let port: number;

  const createLargeExcelFile = (rowCount: number, fileName: string = 'large-test.xlsx'): File => {
    const data = [
      ['SUROWCE'], // Category header
      ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'] // Column headers
    ];
    
    // Generate large dataset
    for (let i = 1; i <= rowCount; i++) {
      data.push([
        i,
        `ITEM${String(i).padStart(6, '0')}`,
        `Large Dataset Item ${i} with extended description for memory testing`,
        Math.floor(Math.random() * 1000) + 1,
        i % 5 === 0 ? 'kg' : i % 3 === 0 ? 'szt' : i % 2 === 0 ? 'l' : 'g'
      ]);
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new File([buffer], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  };

  const createRequest = (file: File): NextRequest => {
    const formData = new FormData();
    formData.append('file', file);
    
    return new NextRequest('http://localhost:3000/api/excel/upload', {
      method: 'POST',
      body: formData
    });
  };

  const measureMemoryUsage = () => {
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
    };
  };

  beforeAll(async () => {
    socketManager = new SocketTestManager();
    const setup = await socketManager.setup({ enableLogging: false });
    server = setup.server;
    port = setup.port;
  });

  afterAll(async () => {
    await socketManager.teardown();
  });

  afterEach(async () => {
    // Cleanup test data
    for (const fileId of testFileIds) {
      try {
        await db.excelRow.deleteMany({ where: { fileId } });
        await db.aggregatedItem.deleteMany({ where: { fileId } });
        await db.excelFile.delete({ where: { id: fileId } });
      } catch (error) {
        console.warn('Cleanup failed for file:', fileId, error);
      }
    }
    testFileIds = [];
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Usage and Optimization', () => {
    it('should process 10,000 row file without excessive memory usage', async () => {
      const initialMemory = measureMemoryUsage();
      const rowCount = 10000;
      
      const largeFile = createLargeExcelFile(rowCount, `memory-test-${rowCount}.xlsx`);
      const request = createRequest(largeFile);
      
      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024 * 100) / 100;
      
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.rowCount).toBe(rowCount);
      testFileIds.push(responseData.fileId);
      
      // Performance assertions
      expect(processingTime).toBeLessThan(30000); // Under 30 seconds
      expect(memoryIncreaseMB).toBeLessThan(500); // Less than 500MB memory increase
      
      console.log(`✓ Processed ${rowCount} rows in ${processingTime}ms`);
      console.log(`✓ Memory increase: ${memoryIncreaseMB}MB`);
      console.log(`✓ Processing rate: ${Math.round(rowCount / (processingTime / 1000))} rows/second`);
    });

    it('should handle memory cleanup for multiple consecutive large files', async () => {
      const initialMemory = measureMemoryUsage();
      const fileCount = 5;
      const rowsPerFile = 2000;
      
      for (let i = 0; i < fileCount; i++) {
        const file = createLargeExcelFile(rowsPerFile, `consecutive-${i}.xlsx`);
        const request = createRequest(file);
        
        const response = await POST(request);
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        testFileIds.push(responseData.fileId);
        
        // Force garbage collection between files
        if (global.gc) {
          global.gc();
        }
        
        // Small delay to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = measureMemoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = Math.round(totalMemoryIncrease / 1024 / 1024 * 100) / 100;
      
      // Memory usage should not grow linearly with number of files
      expect(memoryIncreaseMB).toBeLessThan(1000); // Less than 1GB total increase
      
      console.log(`✓ Processed ${fileCount} files with ${rowsPerFile} rows each`);
      console.log(`✓ Total memory increase: ${memoryIncreaseMB}MB`);
    });

    it('should process extremely large file (50,000 rows) with chunked processing', async () => {
      const rowCount = 50000;
      const largeFile = createLargeExcelFile(rowCount, `extreme-large-${rowCount}.xlsx`);
      const request = createRequest(largeFile);
      
      const initialMemory = measureMemoryUsage();
      const startTime = Date.now();
      
      const response = await POST(request);
      const responseData = await response.json();
      
      const endTime = Date.now();
      const finalMemory = measureMemoryUsage();
      
      const processingTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024 * 100) / 100;
      
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.rowCount).toBe(rowCount);
      testFileIds.push(responseData.fileId);
      
      // Verify database consistency for large file
      const savedRows = await db.excelRow.count({
        where: { fileId: responseData.fileId }
      });
      expect(savedRows).toBe(rowCount);
      
      // Performance expectations for very large files
      expect(processingTime).toBeLessThan(120000); // Under 2 minutes
      expect(memoryIncreaseMB).toBeLessThan(1000); // Less than 1GB memory increase
      
      const processingRate = Math.round(rowCount / (processingTime / 1000));
      expect(processingRate).toBeGreaterThan(100); // At least 100 rows/second
      
      console.log(`✓ Processed ${rowCount} rows in ${processingTime}ms (${processingRate} rows/sec)`);
      console.log(`✓ Memory increase: ${memoryIncreaseMB}MB`);
    });
  });

  describe('Database Performance Under Load', () => {
    it('should efficiently batch insert large datasets', async () => {
      const rowCount = 15000;
      const file = createLargeExcelFile(rowCount, `batch-insert-test-${rowCount}.xlsx`);
      const request = createRequest(file);
      
      const startTime = Date.now();
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      testFileIds.push(responseData.fileId);
      
      // Measure database query performance
      const queryStart = Date.now();
      const rowCounts = await db.excelRow.groupBy({
        by: ['unit'],
        where: { fileId: responseData.fileId },
        _count: { id: true },
        _sum: { quantity: true }
      });
      const queryEnd = Date.now();
      const queryTime = queryEnd - queryStart;
      
      expect(rowCounts.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(2000); // Query should complete in under 2 seconds
      
      // Test aggregation performance
      const aggStart = Date.now();
      const aggregatedItems = await db.aggregatedItem.findMany({
        where: { fileId: responseData.fileId },
        take: 100
      });
      const aggEnd = Date.now();
      const aggTime = aggEnd - aggStart;
      
      expect(aggregatedItems.length).toBeGreaterThan(0);
      expect(aggTime).toBeLessThan(1000); // Aggregation query under 1 second
      
      const totalTime = Date.now() - startTime;
      console.log(`✓ Full processing time: ${totalTime}ms`);
      console.log(`✓ Database query time: ${queryTime}ms`);
      console.log(`✓ Aggregation time: ${aggTime}ms`);
    });

    it('should maintain performance with concurrent database operations', async () => {
      const fileCount = 3;
      const rowsPerFile = 5000;
      const operations: Promise<Response>[] = [];
      
      // Create concurrent upload operations
      for (let i = 0; i < fileCount; i++) {
        const file = createLargeExcelFile(rowsPerFile, `concurrent-db-${i}.xlsx`);
        const request = createRequest(file);
        operations.push(POST(request));
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all operations succeeded
      const responseData = await Promise.all(responses.map(r => r.json()));
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(responseData[index].success).toBe(true);
        expect(responseData[index].rowCount).toBe(rowsPerFile);
        testFileIds.push(responseData[index].fileId);
      });
      
      // Performance check for concurrent operations
      const avgTimePerFile = totalTime / fileCount;
      expect(avgTimePerFile).toBeLessThan(20000); // Average under 20 seconds per file
      
      // Verify database consistency
      const totalSavedRows = await Promise.all(
        responseData.map(data => 
          db.excelRow.count({ where: { fileId: data.fileId } })
        )
      );
      
      totalSavedRows.forEach(count => {
        expect(count).toBe(rowsPerFile);
      });
      
      console.log(`✓ Processed ${fileCount} concurrent files in ${totalTime}ms`);
      console.log(`✓ Average time per file: ${avgTimePerFile}ms`);
    });

    it('should handle high-frequency database queries efficiently', async () => {
      // Create a moderate dataset for querying
      const file = createLargeExcelFile(5000, 'query-performance-test.xlsx');
      const request = createRequest(file);
      const response = await POST(request);
      const responseData = await response.json();
      
      testFileIds.push(responseData.fileId);
      
      // Perform many concurrent queries
      const queryCount = 100;
      const queryOperations: Promise<any>[] = [];
      
      const queryStartTime = Date.now();
      
      for (let i = 0; i < queryCount; i++) {
        if (i % 4 === 0) {
          // Count queries
          queryOperations.push(
            db.excelRow.count({ where: { fileId: responseData.fileId } })
          );
        } else if (i % 4 === 1) {
          // Find queries
          queryOperations.push(
            db.excelRow.findMany({
              where: { fileId: responseData.fileId },
              take: 10,
              skip: i * 10
            })
          );
        } else if (i % 4 === 2) {
          // Aggregation queries
          queryOperations.push(
            db.excelRow.aggregate({
              where: { fileId: responseData.fileId },
              _sum: { quantity: true },
              _avg: { quantity: true }
            })
          );
        } else {
          // Group by queries
          queryOperations.push(
            db.excelRow.groupBy({
              by: ['unit'],
              where: { fileId: responseData.fileId },
              _count: { id: true }
            })
          );
        }
      }
      
      const queryResults = await Promise.all(queryOperations);
      const queryEndTime = Date.now();
      const totalQueryTime = queryEndTime - queryStartTime;
      
      expect(queryResults.length).toBe(queryCount);
      expect(totalQueryTime).toBeLessThan(15000); // All queries under 15 seconds
      
      const avgQueryTime = totalQueryTime / queryCount;
      expect(avgQueryTime).toBeLessThan(150); // Average query under 150ms
      
      console.log(`✓ Executed ${queryCount} concurrent queries in ${totalQueryTime}ms`);
      console.log(`✓ Average query time: ${avgQueryTime}ms`);
    });
  });

  describe('Concurrent File Processing', () => {
    it('should handle multiple simultaneous file uploads', async () => {
      const concurrentUploads = 5;
      const rowsPerFile = 3000;
      const uploadPromises: Promise<Response>[] = [];
      
      const overallStartTime = Date.now();
      
      // Create concurrent uploads
      for (let i = 0; i < concurrentUploads; i++) {
        const file = createLargeExcelFile(rowsPerFile, `concurrent-upload-${i}.xlsx`);
        const request = createRequest(file);
        uploadPromises.push(POST(request));
      }
      
      const responses = await Promise.all(uploadPromises);
      const overallEndTime = Date.now();
      const totalTime = overallEndTime - overallStartTime;
      
      // Verify all uploads succeeded
      const responseData = await Promise.all(responses.map(r => r.json()));
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(responseData[index].success).toBe(true);
        expect(responseData[index].rowCount).toBe(rowsPerFile);
        testFileIds.push(responseData[index].fileId);
      });
      
      // Performance assertions
      const avgTimePerUpload = totalTime / concurrentUploads;
      expect(avgTimePerUpload).toBeLessThan(25000); // Under 25 seconds average
      
      // Verify concurrency efficiency (should be faster than sequential)
      const sequentialEstimate = avgTimePerUpload * concurrentUploads * 0.8;
      expect(totalTime).toBeLessThan(sequentialEstimate);
      
      // Verify data integrity
      for (const data of responseData) {
        const rowCount = await db.excelRow.count({
          where: { fileId: data.fileId }
        });
        expect(rowCount).toBe(rowsPerFile);
        
        const aggCount = await db.aggregatedItem.count({
          where: { fileId: data.fileId }
        });
        expect(aggCount).toBeGreaterThan(0);
      }
      
      console.log(`✓ Processed ${concurrentUploads} concurrent uploads in ${totalTime}ms`);
      console.log(`✓ Average time per upload: ${avgTimePerUpload}ms`);
      console.log(`✓ Concurrency efficiency: ${Math.round((sequentialEstimate / totalTime) * 100)}%`);
    });

    it('should maintain stability under sustained load', async () => {
      const batchCount = 3;
      const uploadsPerBatch = 3;
      const rowsPerFile = 2000;
      const allFileIds: string[] = [];
      
      for (let batch = 0; batch < batchCount; batch++) {
        console.log(`Starting batch ${batch + 1}/${batchCount}`);
        
        const batchPromises: Promise<Response>[] = [];
        
        for (let upload = 0; upload < uploadsPerBatch; upload++) {
          const fileIndex = batch * uploadsPerBatch + upload;
          const file = createLargeExcelFile(rowsPerFile, `sustained-load-${fileIndex}.xlsx`);
          const request = createRequest(file);
          batchPromises.push(POST(request));
        }
        
        const batchStartTime = Date.now();
        const batchResponses = await Promise.all(batchPromises);
        const batchEndTime = Date.now();
        const batchTime = batchEndTime - batchStartTime;
        
        // Verify batch success
        const batchResponseData = await Promise.all(batchResponses.map(r => r.json()));
        
        batchResponses.forEach((response, index) => {
          expect(response.status).toBe(200);
          expect(batchResponseData[index].success).toBe(true);
          allFileIds.push(batchResponseData[index].fileId);
        });
        
        console.log(`Batch ${batch + 1} completed in ${batchTime}ms`);
        
        // Small delay between batches to simulate realistic usage
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      testFileIds.push(...allFileIds);
      
      // Verify overall system stability
      const totalFiles = batchCount * uploadsPerBatch;
      expect(allFileIds.length).toBe(totalFiles);
      
      // Check database consistency
      const totalRows = await db.excelRow.count({
        where: { fileId: { in: allFileIds } }
      });
      expect(totalRows).toBe(totalFiles * rowsPerFile);
      
      console.log(`✓ Sustained load test completed: ${totalFiles} files, ${totalRows} total rows`);
    });
  });

  describe('Real-time Progress Updates Under Load', () => {
    it('should emit progress updates efficiently during large file processing', async () => {
      const clients = await socketManager.createMultipleClients(port, 3);
      const file = createLargeExcelFile(8000, 'progress-updates-test.xlsx');
      
      // Clear initial events
      clients.forEach(client => client.clearEvents());
      
      // Set up progress tracking
      const progressEvents: any[] = [];
      const uploadId = `upload-${Date.now()}`;
      
      // Simulate progress updates during processing
      const progressUpdateInterval = setInterval(() => {
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        const progressData = {
          uploadId,
          progress: Math.floor(Math.random() * 100),
          phase: ['parsing', 'processing', 'saving'][Math.floor(Math.random() * 3)],
          fileName: 'progress-updates-test.xlsx'
        };
        
        randomClient.emit('upload-progress', progressData);
        progressEvents.push(progressData);
      }, 100);
      
      // Process file
      const request = createRequest(file);
      const startTime = Date.now();
      
      const response = await POST(request);
      const endTime = Date.now();
      
      clearInterval(progressUpdateInterval);
      
      const responseData = await response.json();
      expect(response.status).toBe(200);
      testFileIds.push(responseData.fileId);
      
      // Wait for all progress events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify progress updates were handled efficiently
      const processingTime = endTime - startTime;
      const progressOverhead = progressEvents.length * 10; // Assume 10ms overhead per event
      const overheadPercentage = (progressOverhead / processingTime) * 100;
      
      expect(overheadPercentage).toBeLessThan(10); // Progress updates should add <10% overhead
      
      console.log(`✓ File processing time: ${processingTime}ms`);
      console.log(`✓ Progress events: ${progressEvents.length}`);
      console.log(`✓ Progress overhead: ${overheadPercentage.toFixed(2)}%`);
    });

    it('should handle high-frequency real-time updates without blocking file processing', async () => {
      const clients = await socketManager.createMultipleClients(port, 5);
      
      // Clear initial events
      clients.forEach(client => client.clearEvents());
      
      // Generate high-frequency updates
      const updateCount = 1000;
      const updateInterval = 5; // 5ms intervals = very high frequency
      
      const updatePromise = new Promise<void>(resolve => {
        let updates = 0;
        const interval = setInterval(() => {
          const randomClient = clients[Math.floor(Math.random() * clients.length)];
          
          randomClient.emit('data-sync', {
            type: 'HIGH_FREQUENCY_UPDATE',
            timestamp: Date.now(),
            updateId: updates
          });
          
          updates++;
          if (updates >= updateCount) {
            clearInterval(interval);
            resolve();
          }
        }, updateInterval);
      });
      
      // Simultaneously process files
      const file1 = createLargeExcelFile(5000, 'concurrent-updates-1.xlsx');
      const file2 = createLargeExcelFile(5000, 'concurrent-updates-2.xlsx');
      
      const fileProcessingPromise = Promise.all([
        POST(createRequest(file1)),
        POST(createRequest(file2))
      ]);
      
      // Wait for both updates and file processing
      const [, responses] = await Promise.all([updatePromise, fileProcessingPromise]);
      
      // Verify file processing succeeded despite high update frequency
      const responseData = await Promise.all(responses.map(r => r.json()));
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(responseData[index].success).toBe(true);
        testFileIds.push(responseData[index].fileId);
      });
      
      // Wait for update events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify clients received updates
      let totalUpdatesReceived = 0;
      clients.forEach(client => {
        const updateEvents = client.getEventsByType('data-sync');
        totalUpdatesReceived += updateEvents.length;
      });
      
      // Should have received most updates (allow for some loss under extreme load)
      expect(totalUpdatesReceived).toBeGreaterThan(updateCount * clients.length * 0.8);
      
      console.log(`✓ High-frequency updates: ${updateCount} sent`);
      console.log(`✓ Total updates received: ${totalUpdatesReceived}`);
      console.log(`✓ File processing completed successfully during high-frequency updates`);
    });
  });

  describe('Stress Testing and Limits', () => {
    it('should identify processing limits and graceful degradation', async () => {
      const testSizes = [1000, 5000, 10000, 20000, 30000];
      const results: Array<{
        size: number;
        processingTime: number;
        memoryIncrease: number;
        success: boolean;
      }> = [];
      
      for (const size of testSizes) {
        console.log(`Testing file size: ${size} rows`);
        
        const initialMemory = measureMemoryUsage();
        const file = createLargeExcelFile(size, `stress-test-${size}.xlsx`);
        const request = createRequest(file);
        
        const startTime = Date.now();
        
        try {
          const response = await POST(request);
          const endTime = Date.now();
          const responseData = await response.json();
          
          const finalMemory = measureMemoryUsage();
          const processingTime = endTime - startTime;
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
          
          const success = response.status === 200 && responseData.success;
          if (success) {
            testFileIds.push(responseData.fileId);
          }
          
          results.push({
            size,
            processingTime,
            memoryIncrease: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100,
            success
          });
          
          console.log(`✓ Size ${size}: ${processingTime}ms, ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
          
        } catch (error) {
          console.log(`✗ Size ${size}: Failed - ${error.message}`);
          results.push({
            size,
            processingTime: 0,
            memoryIncrease: 0,
            success: false
          });
        }
        
        // Cleanup between tests
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Analyze results
      const successfulTests = results.filter(r => r.success);
      expect(successfulTests.length).toBeGreaterThan(0);
      
      // Check for reasonable scaling
      for (let i = 1; i < successfulTests.length; i++) {
        const current = successfulTests[i];
        const previous = successfulTests[i - 1];
        
        // Processing time should scale somewhat linearly (not exponentially)
        const timeRatio = current.processingTime / previous.processingTime;
        const sizeRatio = current.size / previous.size;
        
        expect(timeRatio).toBeLessThan(sizeRatio * 3); // Time shouldn't grow more than 3x size ratio
      }
      
      console.log('\n📊 Stress Test Results:');
      results.forEach(result => {
        const status = result.success ? '✓' : '✗';
        console.log(`${status} ${result.size} rows: ${result.processingTime}ms, ${result.memoryIncrease}MB`);
      });
    });

    it('should handle memory pressure gracefully', async () => {
      // Create multiple large files to stress memory
      const files = [
        createLargeExcelFile(8000, 'memory-pressure-1.xlsx'),
        createLargeExcelFile(8000, 'memory-pressure-2.xlsx'),
        createLargeExcelFile(8000, 'memory-pressure-3.xlsx')
      ];
      
      const initialMemory = measureMemoryUsage();
      
      // Process files sequentially to build up memory pressure
      for (let i = 0; i < files.length; i++) {
        const request = createRequest(files[i]);
        const response = await POST(request);
        const responseData = await response.json();
        
        expect(response.status).toBe(200);
        testFileIds.push(responseData.fileId);
        
        const currentMemory = measureMemoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024);
        
        console.log(`File ${i + 1}: Memory usage ${memoryIncreaseMB}MB`);
        
        // Memory shouldn't grow unbounded
        expect(memoryIncreaseMB).toBeLessThan(2000); // Less than 2GB
      }
      
      // Force garbage collection and check memory is reclaimed
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const afterGCMemory = measureMemoryUsage();
        const finalIncrease = afterGCMemory.heapUsed - initialMemory.heapUsed;
        const finalIncreaseMB = Math.round(finalIncrease / 1024 / 1024);
        
        // Memory should be partially reclaimed
        expect(finalIncreaseMB).toBeLessThan(1500); // Less than 1.5GB after GC
        
        console.log(`✓ Memory after GC: ${finalIncreaseMB}MB increase`);
      }
    });
  });
});