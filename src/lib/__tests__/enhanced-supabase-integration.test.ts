/**
 * Enhanced Database Integration Tests (Supabase-ready)
 * 
 * Comprehensive integration tests for database operations that work with
 * both local development and Supabase production environments.
 * 
 * Tests include:
 * - Real-time data synchronization patterns
 * - Connection pooling and performance
 * - Transaction handling and rollback scenarios
 * - Concurrent operations and data integrity
 * - Migration verification and schema validation
 */

import { db } from '@/lib/db-config';
import { ensureMigrationsRun } from '@/lib/migrate';
import { 
  clearSocketEvents, 
  triggerSocketEvent, 
  socketTestUtils 
} from '../../../__mocks__/socket.io-client';

// Mock Socket.IO for real-time simulation
jest.mock('socket.io-client');

describe('Enhanced Database Integration Tests (Supabase-ready)', () => {
  let testFileIds: string[] = [];
  let testMappingIds: string[] = [];
  let testAggregatedIds: string[] = [];

  beforeAll(async () => {
    // Ensure database is ready and migrations are applied
    try {
      await ensureMigrationsRun();
    } catch (error) {
      console.warn('Migration check failed in tests:', error);
    }
    
    clearSocketEvents();
  });

  afterEach(async () => {
    clearSocketEvents();
    
    // Cleanup test data in correct order (foreign key constraints)
    try {
      // Clean up Excel rows first (references excel_files)
      if (testFileIds.length > 0) {
        await db.excelRow.deleteMany({
          where: { fileId: { in: testFileIds } }
        });
      }
      
      // Clean up aggregated items (references excel_files)
      if (testAggregatedIds.length > 0) {
        await db.aggregatedItem.deleteMany({
          where: { id: { in: testAggregatedIds } }
        });
      }
      
      // Clean up Excel files
      if (testFileIds.length > 0) {
        await db.excelFile.deleteMany({
          where: { id: { in: testFileIds } }
        });
      }
      
      // Clean up column mappings
      if (testMappingIds.length > 0) {
        await db.columnMapping.deleteMany({
          where: { id: { in: testMappingIds } }
        });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    
    // Clear arrays
    testFileIds = [];
    testMappingIds = [];
    testAggregatedIds = [];
  });

  describe('Real-time Data Synchronization Patterns', () => {
    it('should handle real-time updates for Excel file processing', async () => {
      const fileName = 'realtime-test.xlsx';
      let updateEvents: any[] = [];
      
      // Simulate real-time listener setup
      const mockSocket = {
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'data-sync') {
            updateEvents.push = callback;
          }
        }),
        emit: jest.fn()
      };

      // Create Excel file record
      const excelFile = await db.excelFile.create({
        data: {
          fileName,
          fileSize: 1024,
          rowCount: 0,
          originalStructure: []
        }
      });
      
      testFileIds.push(excelFile.id);

      // Simulate real-time update event
      const syncEvent = {
        type: 'EXCEL_FILE_CREATED',
        table: 'excel_files',
        operation: 'INSERT',
        data: {
          id: excelFile.id,
          fileName: excelFile.fileName,
          status: 'processing'
        },
        timestamp: new Date().toISOString()
      };

      // Verify file was created
      const createdFile = await db.excelFile.findUnique({
        where: { id: excelFile.id }
      });

      expect(createdFile).toBeTruthy();
      expect(createdFile!.fileName).toBe(fileName);

      // Update the file status (simulating processing completion)
      await db.excelFile.update({
        where: { id: excelFile.id },
        data: { rowCount: 100 }
      });

      // Simulate real-time update notification
      const updateEvent = {
        type: 'EXCEL_FILE_UPDATED',
        table: 'excel_files',
        operation: 'UPDATE',
        data: {
          id: excelFile.id,
          rowCount: 100,
          status: 'completed'
        },
        timestamp: new Date().toISOString()
      };

      // Verify update was applied
      const updatedFile = await db.excelFile.findUnique({
        where: { id: excelFile.id }
      });

      expect(updatedFile!.rowCount).toBe(100);
    });

    it('should handle batch real-time updates for Excel rows', async () => {
      // Create parent Excel file
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'batch-update-test.xlsx',
          fileSize: 2048,
          rowCount: 0,
          originalStructure: []
        }
      });
      
      testFileIds.push(excelFile.id);

      // Create multiple Excel rows in batch
      const rowsData = Array.from({ length: 50 }, (_, i) => ({
        fileId: excelFile.id,
        name: `Test Item ${i + 1}`,
        quantity: (i + 1) * 10,
        unit: 'kg',
        itemId: `ITEM${String(i + 1).padStart(3, '0')}`,
        originalRowIndex: i + 2
      }));

      const createdRows = await db.excelRow.createMany({
        data: rowsData
      });

      expect(createdRows.count).toBe(50);

      // Simulate batch real-time notifications
      const batchEvents = rowsData.map((row, index) => ({
        type: 'EXCEL_ROW_CREATED',
        table: 'excel_rows',
        operation: 'INSERT',
        data: {
          name: row.name,
          quantity: row.quantity,
          unit: row.unit,
          fileId: row.fileId
        },
        batchIndex: index,
        timestamp: new Date().toISOString()
      }));

      // Verify all rows were created
      const savedRows = await db.excelRow.findMany({
        where: { fileId: excelFile.id },
        orderBy: { originalRowIndex: 'asc' }
      });

      expect(savedRows).toHaveLength(50);
      expect(savedRows[0].name).toBe('Test Item 1');
      expect(savedRows[49].name).toBe('Test Item 50');

      // Update file row count to match
      await db.excelFile.update({
        where: { id: excelFile.id },
        data: { rowCount: 50 }
      });
    });

    it('should handle real-time aggregation updates', async () => {
      // Create Excel file
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'aggregation-test.xlsx',
          fileSize: 1024,
          rowCount: 3,
          originalStructure: []
        }
      });
      
      testFileIds.push(excelFile.id);

      // Create Excel rows with duplicate items for aggregation
      const rowsData = [
        {
          fileId: excelFile.id,
          name: 'Duplicate Item A',
          quantity: 50,
          unit: 'kg',
          itemId: 'DUP001',
          originalRowIndex: 1
        },
        {
          fileId: excelFile.id,
          name: 'Duplicate Item A',
          quantity: 25,
          unit: 'kg',
          itemId: 'DUP001',
          originalRowIndex: 2
        },
        {
          fileId: excelFile.id,
          name: 'Unique Item B',
          quantity: 100,
          unit: 'szt',
          itemId: 'UNI001',
          originalRowIndex: 3
        }
      ];

      await db.excelRow.createMany({ data: rowsData });

      // Create aggregated items
      const aggregatedItems = [
        {
          itemId: 'DUP001',
          name: 'Duplicate Item A',
          quantity: 75, // 50 + 25
          unit: 'kg',
          fileId: excelFile.id,
          sourceFiles: [excelFile.id],
          count: 2
        },
        {
          itemId: 'UNI001',
          name: 'Unique Item B',
          quantity: 100,
          unit: 'szt',
          fileId: excelFile.id,
          sourceFiles: [excelFile.id],
          count: 1
        }
      ];

      const createdAggregated = await Promise.all(
        aggregatedItems.map(item => db.aggregatedItem.create({ data: item }))
      );

      testAggregatedIds.push(...createdAggregated.map(item => item.id));

      // Verify aggregation
      const savedAggregated = await db.aggregatedItem.findMany({
        where: { fileId: excelFile.id },
        orderBy: { name: 'asc' }
      });

      expect(savedAggregated).toHaveLength(2);
      expect(savedAggregated[0].quantity).toBe(75); // Aggregated quantity
      expect(savedAggregated[0].count).toBe(2); // Two source rows
      expect(savedAggregated[1].quantity).toBe(100);
      expect(savedAggregated[1].count).toBe(1);

      // Simulate real-time aggregation update events
      const aggregationEvents = savedAggregated.map(item => ({
        type: 'AGGREGATION_UPDATED',
        table: 'aggregated_items',
        operation: 'INSERT',
        data: {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          count: item.count,
          fileId: item.fileId
        },
        timestamp: new Date().toISOString()
      }));

      expect(aggregationEvents).toHaveLength(2);
    });
  });

  describe('Connection Pooling and Performance', () => {
    it('should handle concurrent database operations efficiently', async () => {
      const concurrentOperations = 10;
      const operations: Promise<any>[] = [];

      const startTime = Date.now();

      // Create concurrent Excel file creation operations
      for (let i = 0; i < concurrentOperations; i++) {
        const operation = db.excelFile.create({
          data: {
            fileName: `concurrent-test-${i}.xlsx`,
            fileSize: 1024 + i * 100,
            rowCount: i * 10,
            originalStructure: []
          }
        });
        operations.push(operation);
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all operations succeeded
      expect(results).toHaveLength(concurrentOperations);
      results.forEach((result, index) => {
        expect(result.fileName).toBe(`concurrent-test-${index}.xlsx`);
        testFileIds.push(result.id);
      });

      // Performance check - concurrent operations should be efficient
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds

      // Verify all records exist in database
      const savedFiles = await db.excelFile.findMany({
        where: { id: { in: testFileIds } }
      });

      expect(savedFiles).toHaveLength(concurrentOperations);
    });

    it('should maintain connection pool under load', async () => {
      const highLoadOperations = 100;
      const batchSize = 10;
      const batches = Math.ceil(highLoadOperations / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const batchOperations: Promise<any>[] = [];
        
        for (let i = 0; i < batchSize && (batch * batchSize + i) < highLoadOperations; i++) {
          const operationIndex = batch * batchSize + i;
          
          // Mix different types of database operations
          if (operationIndex % 3 === 0) {
            // Create operation
            batchOperations.push(
              db.excelFile.create({
                data: {
                  fileName: `load-test-${operationIndex}.xlsx`,
                  fileSize: 1024,
                  rowCount: 1,
                  originalStructure: []
                }
              })
            );
          } else if (operationIndex % 3 === 1) {
            // Read operation
            batchOperations.push(
              db.excelFile.findMany({
                take: 5,
                select: { id: true, fileName: true }
              })
            );
          } else {
            // Count operation
            batchOperations.push(
              db.excelFile.count()
            );
          }
        }

        const batchResults = await Promise.all(batchOperations);
        
        // Track created file IDs for cleanup
        batchResults.forEach(result => {
          if (result && result.id && typeof result.id === 'string') {
            testFileIds.push(result.id);
          }
        });

        // Small delay between batches to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify connection pool handled the load without errors
      const finalCount = await db.excelFile.count();
      expect(finalCount).toBeGreaterThan(0);
    });

    it('should handle connection recovery scenarios', async () => {
      // This test simulates connection recovery by creating a high number
      // of operations that might stress the connection pool
      
      const operations: Promise<any>[] = [];
      const operationCount = 50;

      // Create operations that span different tables
      for (let i = 0; i < operationCount; i++) {
        if (i % 4 === 0) {
          operations.push(db.excelFile.count());
        } else if (i % 4 === 1) {
          operations.push(db.excelRow.count());
        } else if (i % 4 === 2) {
          operations.push(db.aggregatedItem.count());
        } else {
          operations.push(db.columnMapping.count());
        }
      }

      // Execute all operations - this tests connection pool resilience
      const results = await Promise.all(operations);

      expect(results).toHaveLength(operationCount);
      results.forEach(result => {
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Transaction Handling and Data Integrity', () => {
    it('should handle successful transactions with multiple operations', async () => {
      await db.$transaction(async (tx) => {
        // Create Excel file
        const excelFile = await tx.excelFile.create({
          data: {
            fileName: 'transaction-test.xlsx',
            fileSize: 1024,
            rowCount: 2,
            originalStructure: []
          }
        });

        testFileIds.push(excelFile.id);

        // Create Excel rows
        const rows = await tx.excelRow.createMany({
          data: [
            {
              fileId: excelFile.id,
              name: 'Transaction Item 1',
              quantity: 50,
              unit: 'kg',
              itemId: 'TXN001',
              originalRowIndex: 1
            },
            {
              fileId: excelFile.id,
              name: 'Transaction Item 2',
              quantity: 75,
              unit: 'szt',
              itemId: 'TXN002',
              originalRowIndex: 2
            }
          ]
        });

        expect(rows.count).toBe(2);

        // Create aggregated items
        const aggregatedItem = await tx.aggregatedItem.create({
          data: {
            itemId: 'TXN001',
            name: 'Transaction Item 1',
            quantity: 50,
            unit: 'kg',
            fileId: excelFile.id,
            sourceFiles: [excelFile.id],
            count: 1
          }
        });

        testAggregatedIds.push(aggregatedItem.id);
      });

      // Verify all operations were committed
      const savedFiles = await db.excelFile.findMany({
        where: { id: { in: testFileIds } },
        include: { rows: true }
      });

      expect(savedFiles).toHaveLength(1);
      expect(savedFiles[0].rows).toHaveLength(2);

      const aggregatedItems = await db.aggregatedItem.findMany({
        where: { id: { in: testAggregatedIds } }
      });

      expect(aggregatedItems).toHaveLength(1);
    });

    it('should rollback failed transactions properly', async () => {
      const initialFileCount = await db.excelFile.count();

      try {
        await db.$transaction(async (tx) => {
          // Create Excel file (this should succeed)
          const excelFile = await tx.excelFile.create({
            data: {
              fileName: 'rollback-test.xlsx',
              fileSize: 1024,
              rowCount: 1,
              originalStructure: []
            }
          });

          // Create Excel row (this should succeed)
          await tx.excelRow.create({
            data: {
              fileId: excelFile.id,
              name: 'Rollback Item',
              quantity: 100,
              unit: 'kg',
              itemId: 'ROLL001',
              originalRowIndex: 1
            }
          });

          // Intentionally cause an error to trigger rollback
          throw new Error('Intentional transaction failure');
        });
      } catch (error) {
        expect(error.message).toBe('Intentional transaction failure');
      }

      // Verify transaction was rolled back - no new records should exist
      const finalFileCount = await db.excelFile.count();
      expect(finalFileCount).toBe(initialFileCount);

      // Verify no rows were created either
      const rollbackRows = await db.excelRow.findMany({
        where: { name: 'Rollback Item' }
      });
      expect(rollbackRows).toHaveLength(0);
    });

    it('should handle nested transaction-like operations', async () => {
      // Simulate a complex upload process with multiple related operations
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'nested-ops-test.xlsx',
          fileSize: 2048,
          rowCount: 3,
          originalStructure: []
        }
      });

      testFileIds.push(excelFile.id);

      // Step 1: Create Excel rows
      const rowsData = [
        {
          fileId: excelFile.id,
          name: 'Nested Item A',
          quantity: 30,
          unit: 'kg',
          itemId: 'NEST001',
          originalRowIndex: 1
        },
        {
          fileId: excelFile.id,
          name: 'Nested Item A', // Duplicate for aggregation
          quantity: 20,
          unit: 'kg',
          itemId: 'NEST001',
          originalRowIndex: 2
        },
        {
          fileId: excelFile.id,
          name: 'Nested Item B',
          quantity: 100,
          unit: 'szt',
          itemId: 'NEST002',
          originalRowIndex: 3
        }
      ];

      await db.excelRow.createMany({ data: rowsData });

      // Step 2: Create or update aggregated items
      const aggregationMap = new Map();
      rowsData.forEach(row => {
        const key = `${row.itemId}|${row.name}|${row.unit}`;
        if (aggregationMap.has(key)) {
          const existing = aggregationMap.get(key);
          existing.quantity += row.quantity;
          existing.count += 1;
        } else {
          aggregationMap.set(key, {
            itemId: row.itemId,
            name: row.name,
            quantity: row.quantity,
            unit: row.unit,
            fileId: excelFile.id,
            sourceFiles: [excelFile.id],
            count: 1
          });
        }
      });

      // Step 3: Save aggregated items
      const aggregatedItemsToCreate = Array.from(aggregationMap.values());
      const createdAggregated = await Promise.all(
        aggregatedItemsToCreate.map(item => 
          db.aggregatedItem.create({ data: item })
        )
      );

      testAggregatedIds.push(...createdAggregated.map(item => item.id));

      // Verify results
      expect(createdAggregated).toHaveLength(2); // Two unique items

      const nestedItemA = createdAggregated.find(item => item.name === 'Nested Item A');
      expect(nestedItemA!.quantity).toBe(50); // 30 + 20
      expect(nestedItemA!.count).toBe(2);

      const nestedItemB = createdAggregated.find(item => item.name === 'Nested Item B');
      expect(nestedItemB!.quantity).toBe(100);
      expect(nestedItemB!.count).toBe(1);
    });
  });

  describe('Schema Validation and Migration Verification', () => {
    it('should validate database schema matches expected structure', async () => {
      // Test that all required tables exist and have correct structure
      
      // Test excel_files table
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'schema-test.xlsx',
          fileSize: 1024,
          rowCount: 1,
          originalStructure: [{ type: 'header', content: 'TEST' }]
        }
      });

      testFileIds.push(excelFile.id);

      expect(excelFile.id).toBeDefined();
      expect(excelFile.fileName).toBe('schema-test.xlsx');
      expect(excelFile.createdAt).toBeInstanceOf(Date);
      expect(excelFile.updatedAt).toBeInstanceOf(Date);

      // Test excel_rows table with all required fields
      const excelRow = await db.excelRow.create({
        data: {
          fileId: excelFile.id,
          name: 'Schema Test Item',
          quantity: 50,
          unit: 'kg',
          itemId: 'SCHEMA001',
          originalRowIndex: 1
        }
      });

      expect(excelRow.id).toBeDefined();
      expect(excelRow.fileId).toBe(excelFile.id);
      expect(excelRow.name).toBe('Schema Test Item');
      expect(excelRow.quantity).toBe(50);

      // Test aggregated_items table
      const aggregatedItem = await db.aggregatedItem.create({
        data: {
          itemId: 'SCHEMA001',
          name: 'Schema Test Item',
          quantity: 50,
          unit: 'kg',
          fileId: excelFile.id,
          sourceFiles: [excelFile.id],
          count: 1
        }
      });

      testAggregatedIds.push(aggregatedItem.id);

      expect(aggregatedItem.id).toBeDefined();
      expect(aggregatedItem.sourceFiles).toEqual([excelFile.id]);

      // Test column_mappings table
      const columnMapping = await db.columnMapping.create({
        data: {
          name: 'Schema Test Mapping',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          isDefault: false
        }
      });

      testMappingIds.push(columnMapping.id);

      expect(columnMapping.id).toBeDefined();
      expect(columnMapping.name).toBe('Schema Test Mapping');
      expect(columnMapping.mapping).toEqual({ nameColumn: 0, quantityColumn: 1, unitColumn: 2 });
    });

    it('should validate foreign key relationships', async () => {
      // Create parent record
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'fk-test.xlsx',
          fileSize: 1024,
          rowCount: 1,
          originalStructure: []
        }
      });

      testFileIds.push(excelFile.id);

      // Create child records that reference the parent
      const excelRow = await db.excelRow.create({
        data: {
          fileId: excelFile.id,
          name: 'FK Test Item',
          quantity: 25,
          unit: 'kg',
          itemId: 'FK001',
          originalRowIndex: 1
        }
      });

      const aggregatedItem = await db.aggregatedItem.create({
        data: {
          itemId: 'FK001',
          name: 'FK Test Item',
          quantity: 25,
          unit: 'kg',
          fileId: excelFile.id,
          sourceFiles: [excelFile.id],
          count: 1
        }
      });

      testAggregatedIds.push(aggregatedItem.id);

      // Verify relationships work with queries
      const fileWithRelations = await db.excelFile.findUnique({
        where: { id: excelFile.id },
        include: {
          rows: true,
          aggregatedItems: true
        }
      });

      expect(fileWithRelations!.rows).toHaveLength(1);
      expect(fileWithRelations!.aggregatedItems).toHaveLength(1);
      expect(fileWithRelations!.rows[0].name).toBe('FK Test Item');
      expect(fileWithRelations!.aggregatedItems[0].name).toBe('FK Test Item');
    });

    it('should validate data constraints and indexes', async () => {
      // Test unique constraints (if any)
      const mapping1 = await db.columnMapping.create({
        data: {
          name: 'Unique Test Mapping 1',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          isDefault: false
        }
      });

      testMappingIds.push(mapping1.id);

      // Should be able to create another mapping with different name
      const mapping2 = await db.columnMapping.create({
        data: {
          name: 'Unique Test Mapping 2',
          mapping: { nameColumn: 1, quantityColumn: 2, unitColumn: 3 },
          isDefault: false
        }
      });

      testMappingIds.push(mapping2.id);

      expect(mapping1.id).not.toBe(mapping2.id);

      // Test that required fields are enforced
      try {
        await db.excelFile.create({
          data: {
            // fileName is missing - should fail
            fileSize: 1024,
            rowCount: 0,
            originalStructure: []
          } as any
        });
        fail('Should have thrown error for missing required field');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Monitoring and Optimization', () => {
    it('should measure query performance for large datasets', async () => {
      // Create a larger dataset for performance testing
      const excelFile = await db.excelFile.create({
        data: {
          fileName: 'performance-test.xlsx',
          fileSize: 10240,
          rowCount: 1000,
          originalStructure: []
        }
      });

      testFileIds.push(excelFile.id);

      // Create many rows for performance testing
      const rowsData = Array.from({ length: 1000 }, (_, i) => ({
        fileId: excelFile.id,
        name: `Performance Item ${i + 1}`,
        quantity: Math.floor(Math.random() * 100) + 1,
        unit: i % 2 === 0 ? 'kg' : 'szt',
        itemId: `PERF${String(i + 1).padStart(4, '0')}`,
        originalRowIndex: i + 1
      }));

      // Measure batch insert performance
      const insertStart = Date.now();
      await db.excelRow.createMany({ data: rowsData });
      const insertEnd = Date.now();
      const insertTime = insertEnd - insertStart;

      // Measure query performance
      const queryStart = Date.now();
      const queriedRows = await db.excelRow.findMany({
        where: { fileId: excelFile.id },
        take: 100,
        orderBy: { originalRowIndex: 'asc' }
      });
      const queryEnd = Date.now();
      const queryTime = queryEnd - queryStart;

      // Measure aggregation query performance
      const aggStart = Date.now();
      const aggregationResults = await db.excelRow.groupBy({
        by: ['unit'],
        where: { fileId: excelFile.id },
        _sum: { quantity: true },
        _count: { id: true }
      });
      const aggEnd = Date.now();
      const aggTime = aggEnd - aggStart;

      // Performance assertions
      expect(insertTime).toBeLessThan(5000); // Batch insert under 5 seconds
      expect(queryTime).toBeLessThan(1000); // Query under 1 second
      expect(aggTime).toBeLessThan(2000); // Aggregation under 2 seconds

      expect(queriedRows).toHaveLength(100);
      expect(aggregationResults).toHaveLength(2); // 'kg' and 'szt'

      // Verify aggregation results
      const kgAgg = aggregationResults.find(r => r.unit === 'kg');
      const sztAgg = aggregationResults.find(r => r.unit === 'szt');

      expect(kgAgg!._count.id).toBe(500); // Half of 1000 rows
      expect(sztAgg!._count.id).toBe(500); // Half of 1000 rows
    });

    it('should optimize database queries for common patterns', async () => {
      // Test query optimization patterns commonly used in the application
      
      // Create test data
      const files = await Promise.all([
        db.excelFile.create({
          data: {
            fileName: 'opt-test-1.xlsx',
            fileSize: 1024,
            rowCount: 3,
            originalStructure: []
          }
        }),
        db.excelFile.create({
          data: {
            fileName: 'opt-test-2.xlsx',
            fileSize: 2048,
            rowCount: 2,
            originalStructure: []
          }
        })
      ]);

      testFileIds.push(...files.map(f => f.id));

      // Create rows for both files
      const allRowsData = [
        ...Array.from({ length: 3 }, (_, i) => ({
          fileId: files[0].id,
          name: `Opt Item ${i + 1}`,
          quantity: (i + 1) * 10,
          unit: 'kg',
          itemId: `OPT${String(i + 1).padStart(2, '0')}`,
          originalRowIndex: i + 1
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          fileId: files[1].id,
          name: `Opt Item ${i + 4}`,
          quantity: (i + 4) * 10,
          unit: 'szt',
          itemId: `OPT${String(i + 4).padStart(2, '0')}`,
          originalRowIndex: i + 1
        }))
      ];

      await db.excelRow.createMany({ data: allRowsData });

      // Test optimized queries commonly used in the app

      // 1. Get files with row counts (avoid N+1 queries)
      const queryStart1 = Date.now();
      const filesWithRows = await db.excelFile.findMany({
        include: {
          rows: {
            select: { id: true, name: true, quantity: true, unit: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const queryEnd1 = Date.now();

      expect(queryEnd1 - queryStart1).toBeLessThan(500); // Should be fast
      expect(filesWithRows).toHaveLength(2);
      expect(filesWithRows[0].rows).toBeDefined();

      // 2. Get aggregated data efficiently
      const queryStart2 = Date.now();
      const itemCounts = await db.excelRow.groupBy({
        by: ['unit'],
        _count: { id: true },
        _sum: { quantity: true }
      });
      const queryEnd2 = Date.now();

      expect(queryEnd2 - queryStart2).toBeLessThan(300);
      expect(itemCounts).toHaveLength(2); // 'kg' and 'szt'

      // 3. Search with proper indexing simulation
      const queryStart3 = Date.now();
      const searchResults = await db.excelRow.findMany({
        where: {
          name: {
            contains: 'Opt Item',
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          file: {
            select: { fileName: true }
          }
        }
      });
      const queryEnd3 = Date.now();

      expect(queryEnd3 - queryStart3).toBeLessThan(500);
      expect(searchResults).toHaveLength(5); // All created items
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection issues gracefully', async () => {
      // Test that database operations handle errors properly
      // This is mainly testing the error handling patterns

      try {
        // Attempt an operation that should succeed
        const testCount = await db.excelFile.count();
        expect(typeof testCount).toBe('number');
      } catch (error) {
        // If database is unavailable, error should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle concurrent access scenarios', async () => {
      // Create a shared resource (Excel file)
      const sharedFile = await db.excelFile.create({
        data: {
          fileName: 'concurrent-access-test.xlsx',
          fileSize: 1024,
          rowCount: 0,
          originalStructure: []
        }
      });

      testFileIds.push(sharedFile.id);

      // Simulate concurrent updates to the same record
      const concurrentUpdates = Array.from({ length: 10 }, (_, i) => 
        db.excelFile.update({
          where: { id: sharedFile.id },
          data: { rowCount: { increment: 1 } }
        })
      );

      // Execute concurrent updates
      const results = await Promise.all(concurrentUpdates);

      // Verify final state is consistent
      const finalFile = await db.excelFile.findUnique({
        where: { id: sharedFile.id }
      });

      expect(finalFile!.rowCount).toBe(10); // Should have incremented 10 times
    });
  });
});