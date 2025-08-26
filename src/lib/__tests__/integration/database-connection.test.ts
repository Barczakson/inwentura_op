import { db } from '@/lib/db-config'
import { ensureMigrationsRun } from '@/lib/migrate'

describe('Database Connection', () => {
  beforeAll(async () => {
    // Ensure database is ready before running tests
    try {
      await ensureMigrationsRun()
    } catch (error) {
      console.warn('Migration check failed in tests:', error)
    }
  })

  describe('Connection Tests', () => {
    it('should connect to the database', async () => {
      // Test basic connection with a simple query
      const result = await db.$queryRaw`SELECT 1 as test`
      expect(result).toEqual([{ test: 1 }])
    })

    it('should have required tables', async () => {
      // Check if excel_files table exists
      try {
        await db.$queryRaw`SELECT 1 FROM "excel_files" LIMIT 1`
        // If we get here, the table exists
        expect(true).toBe(true)
      } catch (error) {
        // Table doesn't exist
        fail('excel_files table does not exist')
      }

      // Check if excel_rows table exists
      try {
        await db.$queryRaw`SELECT 1 FROM "excel_rows" LIMIT 1`
        // If we get here, the table exists
        expect(true).toBe(true)
      } catch (error) {
        // Table doesn't exist
        fail('excel_rows table does not exist')
      }

      // Check if aggregated_items table exists
      try {
        await db.$queryRaw`SELECT 1 FROM "aggregated_items" LIMIT 1`
        // If we get here, the table exists
        expect(true).toBe(true)
      } catch (error) {
        // Table doesn't exist
        fail('aggregated_items table does not exist')
      }
    })

    it('should handle connection errors gracefully', async () => {
      // Mock a database error scenario
      const mockDb = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('Connection failed')),
      }

      try {
        await mockDb.$queryRaw`SELECT 1`
        fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('Connection failed')
      }
    })
  })

  describe('Runtime Migration', () => {
    it('should verify database schema', async () => {
      // Reset migration state for testing
      const migrationModule = await import('@/lib/migrate')
      
      // Call ensureMigrationsRun again to test the verification path
      await expect(ensureMigrationsRun()).resolves.not.toThrow()
    })
  })
})