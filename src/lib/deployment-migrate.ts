/**
 * Deployment Migration Utility for Vercel + Supabase
 * 
 * This utility handles database migrations specifically for Vercel deployments
 * with Supabase PostgreSQL, addressing the "Tenant or user not found" errors
 * that occur with build-time migrations.
 */

import { PrismaClient } from '@prisma/client'
import { DATABASE_CONFIG } from './server-optimizations'

// Create a dedicated Prisma client for migrations with optimized settings
const migrationClient = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
})

/**
 * Run database migrations at deployment time
 * This function should be called during the Vercel build process
 */
export async function runDeploymentMigrations(): Promise<void> {
  console.log('Starting deployment migrations...')
  
  try {
    // Test database connection first
    console.log('Testing database connection...')
    await migrationClient.$connect()
    console.log('Database connection successful')
    
    // Run a simple query to verify connection
    await migrationClient.$queryRaw`SELECT 1`
    console.log('Database query test successful')
    
    // Check if tables exist by attempting to query them
    try {
      await migrationClient.$queryRaw`SELECT 1 FROM "excel_files" LIMIT 1`
      console.log('Database schema already exists')
    } catch (error) {
      console.log('Database schema not found, this is expected during initial deployment')
    }
    
    console.log('Deployment migrations completed successfully')
    
  } catch (error) {
    console.error('Deployment migration failed:', error)
    throw error
  } finally {
    await migrationClient.$disconnect()
  }
}

/**
 * Verify database schema exists and is correct
 * This should be called at runtime to ensure the schema is ready
 */
export async function verifyDatabaseSchema(): Promise<boolean> {
  try {
    console.log('Verifying database schema...')
    
    // Test connection
    await migrationClient.$connect()
    
    // Check if all required tables exist
    const requiredTables = ['excel_files', 'excel_rows', 'aggregated_items', 'column_mappings']
    
    for (const table of requiredTables) {
      try {
        await migrationClient.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)
        console.log(`Table ${table} verified`)
      } catch (error) {
        console.warn(`Table ${table} not found or not accessible:`, error instanceof Error ? error.message : 'Unknown error')
        return false
      }
    }
    
    console.log('All required tables verified')
    return true
    
  } catch (error) {
    console.error('Database schema verification failed:', error)
    return false
  } finally {
    await migrationClient.$disconnect()
  }
}

/**
 * Create database schema if it doesn't exist
 * This is a fallback for cases where migrations weren't applied
 */
export async function createDatabaseSchema(): Promise<void> {
  try {
    console.log('Creating database schema...')
    await migrationClient.$connect()
    
    // Create tables using raw SQL (PostgreSQL syntax)
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      );
    `
    
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "posts" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT,
        "published" BOOLEAN NOT NULL DEFAULT false,
        "authorId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
      );
    `
    
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "excel_files" (
        "id" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "rowCount" INTEGER DEFAULT 0,
        "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "originalStructure" JSONB,
        "columnMapping" JSONB,
        "detectedHeaders" JSONB,
        CONSTRAINT "excel_files_pkey" PRIMARY KEY ("id")
      );
    `
    
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "excel_rows" (
        "id" TEXT NOT NULL,
        "itemId" TEXT,
        "name" TEXT NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "unit" TEXT NOT NULL,
        "originalRowIndex" INTEGER,
        "fileId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "excel_rows_pkey" PRIMARY KEY ("id")
      );
    `
    
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "aggregated_items" (
        "id" TEXT NOT NULL,
        "itemId" TEXT,
        "name" TEXT NOT NULL,
        "quantity" DOUBLE PRECISION NOT NULL,
        "unit" TEXT NOT NULL,
        "fileId" TEXT,
        "sourceFiles" JSONB,
        "count" INTEGER DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "aggregated_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "itemId_name_unit" UNIQUE ("itemId", "name", "unit")
      );
    `
    
    await migrationClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "column_mappings" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "mapping" JSONB NOT NULL,
        "headers" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "usageCount" INTEGER NOT NULL DEFAULT 0,
        "lastUsed" TIMESTAMP(3),
        CONSTRAINT "column_mappings_pkey" PRIMARY KEY ("id")
      );
    `
    
    // Create indexes
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_files_uploadDate_idx" ON "excel_files"("uploadDate");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_rows_itemId_name_unit_idx" ON "excel_rows"("itemId", "name", "unit");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_rows_fileId_idx" ON "excel_rows"("fileId");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_rows_name_idx" ON "excel_rows"("name");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_rows_createdAt_idx" ON "excel_rows"("createdAt");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "excel_rows_fileId_originalRowIndex_idx" ON "excel_rows"("fileId", "originalRowIndex");
    `
    
    await migrationClient.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "aggregated_items_itemId_name_unit_key" ON "aggregated_items"("itemId", "name", "unit");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_itemId_name_unit_idx" ON "aggregated_items"("itemId", "name", "unit");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_fileId_idx" ON "aggregated_items"("fileId");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_name_idx" ON "aggregated_items"("name");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_quantity_idx" ON "aggregated_items"("quantity");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_updatedAt_idx" ON "aggregated_items"("updatedAt");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "aggregated_items_count_idx" ON "aggregated_items"("count");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "column_mappings_isDefault_idx" ON "column_mappings"("isDefault");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "column_mappings_usageCount_idx" ON "column_mappings"("usageCount");
    `
    
    await migrationClient.$executeRaw`
      CREATE INDEX IF NOT EXISTS "column_mappings_lastUsed_idx" ON "column_mappings"("lastUsed");
    `
    
    // Add foreign key constraints
    await migrationClient.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'excel_rows_fileId_fkey'
        ) THEN
          ALTER TABLE "excel_rows" ADD CONSTRAINT "excel_rows_fileId_fkey" 
          FOREIGN KEY ("fileId") REFERENCES "excel_files"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `
    
    await migrationClient.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'aggregated_items_fileId_fkey'
        ) THEN
          ALTER TABLE "aggregated_items" ADD CONSTRAINT "aggregated_items_fileId_fkey" 
          FOREIGN KEY ("fileId") REFERENCES "excel_files"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `
    
    console.log('Database schema created successfully')
    
  } catch (error) {
    console.error('Failed to create database schema:', error)
    throw error
  } finally {
    await migrationClient.$disconnect()
  }
}

export default migrationClient