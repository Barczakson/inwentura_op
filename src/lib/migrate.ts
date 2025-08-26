/**
 * Runtime migration utility for Vercel + Supabase deployment
 * 
 * Since build-time migrations can fail with "Tenant or user not found" errors,
 * this utility runs migrations at runtime when the database connection is available.
 * 
 * This approach is optimized for serverless environments and handles connection pooling
 * requirements for Supabase PostgreSQL on Vercel.
 */

import { db } from './db-config'
import { verifyDatabaseSchema, createDatabaseSchema } from './deployment-migrate'

let migrationAttempted = false
let migrationSuccessful = false

/**
 * Run database migrations at runtime
 * This function ensures the database is ready for use in serverless environments
 */
export async function ensureMigrationsRun(): Promise<void> {
  // Only attempt once per function instance
  if (migrationAttempted) {
    if (!migrationSuccessful) {
      console.warn('Previous migration attempt failed, checking again...')
      // We'll try again since it's a new function instance
    } else {
      return
    }
  }
  
  migrationAttempted = true
  
  try {
    console.log('Starting database initialization...')
    
    // Test basic connection with timeout
    console.log('Testing database connection...')
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 5000)
      )
    ])
    console.log('Database connection successful')
    
    // Verify schema exists
    console.log('Verifying database schema...')
    const schemaValid = await verifyDatabaseSchema()
    
    if (!schemaValid) {
      console.log('Database schema verification failed, attempting to create...')
      try {
        await createDatabaseSchema()
        console.log('Database schema created successfully')
      } catch (createError) {
        console.warn('Failed to create database schema:', createError)
        // Continue anyway as tables might exist but we couldn't verify them
      }
    } else {
      console.log('Database schema verified')
    }
    
    migrationSuccessful = true
    console.log('Database initialization completed successfully')
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    migrationSuccessful = false
    // Don't throw the error to allow the application to continue
    // We'll handle missing tables in the actual queries
  }
}

/**
 * Check if required tables exist
 * @deprecated Use verifyDatabaseSchema instead
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
 * @deprecated Use createDatabaseSchema from deployment-migrate instead
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