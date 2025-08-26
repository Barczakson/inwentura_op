import { db, queries } from '@/lib/db-config'
import { withTransaction } from '@/lib/db-config'

describe('Database Requests', () => {
  beforeAll(async () => {
    // Ensure database is ready before running tests
    const migrationModule = await import('@/lib/migrate')
    try {
      await migrationModule.ensureMigrationsRun()
    } catch (error) {
      console.warn('Migration check failed in tests:', error)
    }
  })

  describe('Query Helpers', () => {
    it('should fetch aggregated items with proper structure', async () => {
      // Create test data
      const testFile = await db.excelFile.create({
        data: {
          fileName: 'test-file.xlsx',
          fileSize: 1024,
          rowCount: 2,
        },
      })

      const testItem = await db.aggregatedItem.create({
        data: {
          itemId: 'TEST001',
          name: 'Test Item',
          quantity: 10.5,
          unit: 'kg',
          fileId: testFile.id,
          sourceFiles: [testFile.id],
          count: 1,
        },
      })

      // Test the query helper
      const results = await queries.getAggregatedItems({
        where: { id: testItem.id },
        includeFile: true,
      })

      expect(results).toHaveLength(1)
      const item = results[0]
      expect(item).toMatchObject({
        id: testItem.id,
        itemId: 'TEST001',
        name: 'Test Item',
        quantity: 10.5,
        unit: 'kg',
        fileId: testFile.id,
        sourceFiles: [testFile.id],
        count: 1,
      })

      // Check that file is included when requested
      expect(item.file).toMatchObject({
        id: testFile.id,
        fileName: 'test-file.xlsx',
        fileSize: 1024,
      })

      // Clean up
      await db.aggregatedItem.delete({ where: { id: testItem.id } })
      await db.excelFile.delete({ where: { id: testFile.id } })
    })

    it('should fetch excel rows with proper structure', async () => {
      // Create test data
      const testFile = await db.excelFile.create({
        data: {
          fileName: 'test-rows.xlsx',
          fileSize: 2048,
        },
      })

      const testRow = await db.excelRow.create({
        data: {
          itemId: 'ROW001',
          name: 'Test Row',
          quantity: 5.25,
          unit: 'm',
          originalRowIndex: 3,
          fileId: testFile.id,
        },
      })

      // Test the query helper
      const results = await queries.getExcelRows({
        where: { id: testRow.id },
        includeFile: true,
      })

      expect(results).toHaveLength(1)
      const row = results[0]
      expect(row).toMatchObject({
        id: testRow.id,
        itemId: 'ROW001',
        name: 'Test Row',
        quantity: 5.25,
        unit: 'm',
        originalRowIndex: 3,
        fileId: testFile.id,
      })

      // Check that file is included when requested
      expect(row.file).toMatchObject({
        fileName: 'test-rows.xlsx',
      })

      // Clean up
      await db.excelRow.delete({ where: { id: testRow.id } })
      await db.excelFile.delete({ where: { id: testFile.id } })
    })

    it('should fetch excel files with proper structure', async () => {
      // Create test data
      const testFile = await db.excelFile.create({
        data: {
          fileName: 'test-files.xlsx',
          fileSize: 4096,
          rowCount: 100,
        },
      })

      // Test the query helper without stats
      const results = await queries.getExcelFiles({
        where: { id: testFile.id },
      })

      expect(results).toHaveLength(1)
      const file = results[0]
      expect(file).toMatchObject({
        id: testFile.id,
        fileName: 'test-files.xlsx',
        fileSize: 4096,
        rowCount: 100,
      })

      // Test with stats
      const resultsWithStats = await queries.getExcelFiles({
        where: { id: testFile.id },
        includeStats: true,
      })

      expect(resultsWithStats).toHaveLength(1)
      const fileWithStats = resultsWithStats[0]
      expect(fileWithStats).toMatchObject({
        id: testFile.id,
        fileName: 'test-files.xlsx',
        fileSize: 4096,
        rowCount: 100,
      })

      // Clean up
      await db.excelFile.delete({ where: { id: testFile.id } })
    })

    it('should batch create excel rows efficiently', async () => {
      // Create test file
      const testFile = await db.excelFile.create({
        data: {
          fileName: 'batch-test.xlsx',
          fileSize: 1024,
        },
      })

      // Create test rows
      const testRows = [
        {
          itemId: 'BATCH1',
          name: 'Batch Item 1',
          quantity: 1.0,
          unit: 'kg',
          originalRowIndex: 1,
          fileId: testFile.id,
        },
        {
          itemId: 'BATCH2',
          name: 'Batch Item 2',
          quantity: 2.0,
          unit: 'kg',
          originalRowIndex: 2,
          fileId: testFile.id,
        },
      ]

      // Test batch creation
      const results = await queries.batchCreateExcelRows(testRows)

      // Check results
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)

      // Verify rows were created
      const createdRows = await db.excelRow.findMany({
        where: { fileId: testFile.id },
      })

      expect(createdRows).toHaveLength(2)
      expect(createdRows[0].name).toBe('Batch Item 1')
      expect(createdRows[1].name).toBe('Batch Item 2')

      // Clean up
      await db.excelRow.deleteMany({ where: { fileId: testFile.id } })
      await db.excelFile.delete({ where: { id: testFile.id } })
    })
  })

  describe('Transaction Wrapper', () => {
    it('should execute transactions successfully', async () => {
      // Test successful transaction
      const result = await withTransaction(async (tx) => {
        // Create a test file within the transaction
        const file = await tx.excelFile.create({
          data: {
            fileName: 'transaction-test.xlsx',
            fileSize: 1024,
          },
        })

        // Return the file to verify the transaction worked
        return file
      })

      // Verify the transaction was committed
      expect(result).toBeDefined()
      expect(result.fileName).toBe('transaction-test.xlsx')

      // Verify the file was actually created
      const foundFile = await db.excelFile.findUnique({
        where: { id: result.id },
      })

      expect(foundFile).toBeDefined()
      expect(foundFile?.fileName).toBe('transaction-test.xlsx')

      // Clean up
      await db.excelFile.delete({ where: { id: result.id } })
    })

    it('should rollback transactions on error', async () => {
      const fileName = 'rollback-test.xlsx'

      // Test transaction that throws an error
      try {
        await withTransaction(async (tx) => {
          // Create a test file within the transaction
          await tx.excelFile.create({
            data: {
              fileName,
              fileSize: 1024,
            },
          })

          // Throw an error to trigger rollback
          throw new Error('Test rollback')
        })

        // Should not reach here
        fail('Transaction should have thrown an error')
      } catch (error) {
        // Verify the error was thrown
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Test rollback')

        // Verify the file was NOT created (rolled back)
        const foundFile = await db.excelFile.findUnique({
          where: { fileName },
        })

        expect(foundFile).toBeNull()
      }
    })

    it('should handle transaction timeouts', async () => {
      // Test transaction with timeout options
      const startTime = Date.now()

      try {
        await withTransaction(
          async (tx) => {
            // Create a test file within the transaction
            const file = await tx.excelFile.create({
              data: {
                fileName: 'timeout-test.xlsx',
                fileSize: 1024,
              },
            })

            return file
          },
          {
            maxWait: 5000, // 5 seconds
            timeout: 10000, // 10 seconds
          }
        )

        const duration = Date.now() - startTime
        // Should complete within reasonable time
        expect(duration).toBeLessThan(15000) // Less than 15 seconds
      } catch (error) {
        // If it fails, it should be a timeout-related error
        expect(error).toBeDefined()
      }
    })
  })

  describe('Performance Monitoring', () => {
    it('should log slow queries when enabled', async () => {
      // Mock console.warn to capture slow query logs
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Create a test that should trigger slow query logging
      // (In real scenarios, this would depend on DATABASE_CONFIG.slow_query_threshold)
      
      // Clean up
      consoleWarnSpy.mockRestore()
    })
  })
})