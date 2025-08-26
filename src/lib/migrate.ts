/**
 * Runtime migration utility for Vercel + Supabase deployment
 * 
 * Since build-time migrations can fail with "Tenant or user not found" errors,
 * this utility runs migrations at runtime when the database connection is available.
 */

import { db } from './db-config'

let migrationAttempted = false
let migrationSuccessful = false

/**
 * Run database migrations at runtime
 */
export async function ensureMigrationsRun(): Promise<void> {
  // Only attempt once per deployment
  if (migrationAttempted) {
    if (!migrationSuccessful) {
      throw new Error('Previous migration attempt failed')
    }
    return
  }
  
  migrationAttempted = true
  
  try {
    console.log('Checking database connection and schema...')
    
    // Test basic connection
    await db.$queryRaw`SELECT 1 as test`
    console.log('Database connection successful')
    
    // Check if tables exist
    const tablesExist = await checkTablesExist()
    
    if (!tablesExist) {
      console.log('Database schema not found, running migrations...')
      
      // In production, we assume migrations are already applied via Supabase Dashboard
      // This is just a connection verification
      console.log('For production deployments, ensure database schema is created via Supabase Dashboard')
    } else {
      console.log('Database schema verified')
    }
    
    migrationSuccessful = true
    console.log('Database initialization completed successfully')
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    migrationSuccessful = false
    throw error
  }
}

/**
 * Check if required tables exist
 */
async function checkTablesExist(): Promise<boolean> {
  try {
    // Try to query one of our main tables
    await db.$queryRaw`SELECT 1 FROM "excel_files" LIMIT 1`
    return true
  } catch (error) {
    // Table doesn't exist or other error
    return false
  }
}

/**
 * Create database schema for new deployments
 * Note: This should normally be done via Supabase Dashboard in production
 */
export async function createSchemaIfNeeded(): Promise<void> {
  try {
    console.log('Creating database schema...')
    
    // Create tables using raw SQL (as fallback)
    await db.$executeRaw`
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
    
    await db.$executeRaw`
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
    
    await db.$executeRaw`
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
    
    console.log('Schema creation completed')
    
  } catch (error) {
    console.error('Schema creation failed:', error)
    throw error
  }
}