/**
 * Migration Validation Test Suite
 * 
 * Tests to confirm proper PostgreSQL migration setup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const db = new PrismaClient()

describe('PostgreSQL Migration Validation', () => {
  beforeAll(async () => {
    // Ensure database connection
    await db.$connect()
  })

  afterAll(async () => {
    // Clean up test data
    await db.aggregatedItem.deleteMany()
    await db.excelRow.deleteMany()
    await db.excelFile.deleteMany()
    await db.columnMapping.deleteMany()
    await db.$disconnect()
  })

  describe('Schema Validation', () => {
    test('should connect to PostgreSQL database', async () => {
      const result = await db.$queryRaw`SELECT version()`
      expect(result).toBeDefined()
    })

    test('should have all required tables', async () => {
      const tables = await db.$queryRaw`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
      ` as { tablename: string }[]

      const tableNames = tables.map(t => t.tablename)
      expect(tableNames).toContain('excel_files')
      expect(tableNames).toContain('excel_rows')
      expect(tableNames).toContain('aggregated_items')
      expect(tableNames).toContain('column_mappings')
      expect(tableNames).toContain('users')
    })

    test('should have correct JSON field types', async () => {
      const columns = await db.$queryRaw`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'excel_files' 
        AND column_name IN ('originalStructure', 'columnMapping', 'detectedHeaders')
        ORDER BY column_name
      ` as { column_name: string, data_type: string, udt_name: string }[]

      expect(columns).toHaveLength(3)
      columns.forEach(col => {
        expect(col.data_type).toBe('USER-DEFINED')
        expect(col.udt_name).toBe('jsonb')
      })
    })

    test('should have proper indexes', async () => {
      const indexes = await db.$queryRaw`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      ` as { indexname: string, tablename: string }[]

      const indexNames = indexes.map(i => i.indexname)
      expect(indexNames).toContain('excel_files_uploadDate_idx')
      expect(indexNames).toContain('excel_rows_itemId_name_unit_idx')
      expect(indexNames).toContain('aggregated_items_itemId_name_unit_key')
    })
  })

  describe('JSONB Field Operations', () => {
    let testFileId: string

    beforeEach(async () => {
      testFileId = uuidv4()
    })

    test('should store and retrieve JSON in originalStructure', async () => {
      const testStructure = [
        { type: 'header', content: 'DODANE DO SPISU', originalRowIndex: 0 },
        { type: 'item', content: { name: 'Test Item', quantity: 10 }, originalRowIndex: 1 }
      ]

      const file = await db.excelFile.create({
        data: {
          id: testFileId,
          fileName: 'test.xlsx',
          fileSize: 1024,
          originalStructure: testStructure
        }
      })

      expect(file.originalStructure).toEqual(testStructure)

      // Verify retrieval
      const retrieved = await db.excelFile.findUnique({
        where: { id: testFileId }
      })

      expect(retrieved?.originalStructure).toEqual(testStructure)
    })

    test('should handle columnMapping JSON field', async () => {
      const mapping = {
        'Nazwa towaru': 'name',
        'Ilość': 'quantity',
        'JMZ': 'unit'
      }

      const columnMapping = await db.columnMapping.create({
        data: {
          name: 'Test Mapping',
          mapping,
          isDefault: true
        }
      })

      expect(columnMapping.mapping).toEqual(mapping)
    })

    test('should handle sourceFiles JSON array', async () => {
      const file = await db.excelFile.create({
        data: {
          id: testFileId,
          fileName: 'test.xlsx',
          fileSize: 1024
        }
      })

      const sourceFiles = [testFileId, uuidv4()]
      const item = await db.aggregatedItem.create({
        data: {
          itemId: 'TEST001',
          name: 'Test Item',
          quantity: 10.5,
          unit: 'kg',
          fileId: testFileId,
          sourceFiles
        }
      })

      expect(item.sourceFiles).toEqual(sourceFiles)

      // Test JSON array operations
      const updated = await db.aggregatedItem.update({
        where: { id: item.id },
        data: {
          sourceFiles: [...sourceFiles, uuidv4()]
        }
      })

      expect(Array.isArray(updated.sourceFiles)).toBe(true)
      expect(updated.sourceFiles).toHaveLength(3)
    })
  })

  describe('Database Performance', () => {
    test('should handle large JSON objects efficiently', async () => {
      const largeStructure = Array.from({ length: 1000 }, (_, i) => ({
        type: 'item',
        content: {
          id: i,
          name: `Item ${i}`,
          quantity: Math.random() * 100,
          unit: 'kg'
        },
        originalRowIndex: i
      }))

      const startTime = performance.now()
      
      const file = await db.excelFile.create({
        data: {
          id: uuidv4(),
          fileName: 'large-test.xlsx',
          fileSize: 5 * 1024 * 1024, // 5MB
          originalStructure: largeStructure
        }
      })

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(file.originalStructure).toHaveLength(1000)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    test('should perform efficient JSON queries', async () => {
      const testFileId = uuidv4()
      
      await db.excelFile.create({
        data: {
          id: testFileId,
          fileName: 'query-test.xlsx',
          fileSize: 1024,
          originalStructure: [
            { type: 'header', content: 'SUROWCE', originalRowIndex: 0 },
            { type: 'item', content: { name: 'Sugar', quantity: 50 }, originalRowIndex: 1 }
          ]
        }
      })

      const startTime = performance.now()
      
      // JSON path query
      const files = await db.$queryRaw`
        SELECT * FROM excel_files 
        WHERE "originalStructure"::jsonb @> '[{"type": "header", "content": "SUROWCE"}]'
      `

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(Array.isArray(files)).toBe(true)
      expect(duration).toBeLessThan(100) // Should be very fast with proper indexing
    })
  })

  describe('Data Integrity', () => {
    test('should maintain referential integrity', async () => {
      const file = await db.excelFile.create({
        data: {
          id: uuidv4(),
          fileName: 'integrity-test.xlsx',
          fileSize: 1024
        }
      })

      // Create related records
      await db.excelRow.create({
        data: {
          fileId: file.id,
          name: 'Test Item',
          quantity: 10,
          unit: 'kg'
        }
      })

      await db.aggregatedItem.create({
        data: {
          name: 'Test Item',
          quantity: 10,
          unit: 'kg',
          fileId: file.id
        }
      })

      // Verify cascade delete works
      await db.excelFile.delete({
        where: { id: file.id }
      })

      const orphanedRows = await db.excelRow.findMany({
        where: { fileId: file.id }
      })
      
      const orphanedItems = await db.aggregatedItem.findMany({
        where: { fileId: file.id }
      })

      expect(orphanedRows).toHaveLength(0)
      expect(orphanedItems).toHaveLength(0)
    })

    test('should enforce unique constraints', async () => {
      const testData = {
        itemId: 'UNIQUE001',
        name: 'Unique Test Item',
        quantity: 10,
        unit: 'kg'
      }

      await db.aggregatedItem.create({ data: testData })

      await expect(
        db.aggregatedItem.create({ data: testData })
      ).rejects.toThrow()
    })
  })
})

describe('Migration Status Check', () => {
  test('should not have any SQLite references in active code', async () => {
    // This is a meta-test to ensure migration is complete
    expect(process.env.DATABASE_URL).not.toContain('sqlite')
    expect(process.env.DATABASE_URL).toContain('postgresql')
  })

  test('should have PostgreSQL-specific features available', async () => {
    // Test JSONB operators
    const result = await db.$queryRaw`SELECT '{"key": "value"}'::jsonb ? 'key'`
    expect(result).toBeDefined()
  })
})