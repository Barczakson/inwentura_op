/**
 * Database Configuration and Connection Pool Optimization
 * 
 * This module configures Prisma Client with optimized settings
 * for performance and reliability.
 */

import { PrismaClient } from '@prisma/client'
import { DATABASE_CONFIG } from './server-optimizations'

// Global Prisma instance with optimizations
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create optimized Prisma client
export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: DATABASE_CONFIG.query_logging ? [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event', 
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ] : ['error'],
  
  // Connection pool optimization
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  
  // Error handling
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
})

// Performance monitoring for database queries
if (DATABASE_CONFIG.query_logging && process.env.NODE_ENV === 'development') {
  db.$on('query', (e) => {
    if (e.duration > DATABASE_CONFIG.slow_query_threshold) {
      console.warn('Slow Query Detected:', {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
        timestamp: e.timestamp,
      })
    }
  })
  
  db.$on('error', (e) => {
    console.error('Database Error:', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    })
  })
  
  db.$on('warn', (e) => {
    console.warn('Database Warning:', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    })
  })
}

// Connection pool management
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down database connection...')
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down database connection...')
  await db.$disconnect()
  process.exit(0)
})

/**
 * Transaction wrapper with performance monitoring
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>,
  options: {
    maxWait?: number
    timeout?: number
    isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable'
  } = {}
): Promise<T> {
  const startTime = performance.now()
  
  try {
    const result = await db.$transaction(
      callback as any,
      {
        maxWait: options.maxWait || 5000, // 5 seconds
        timeout: options.timeout || 10000, // 10 seconds
        isolationLevel: options.isolationLevel,
      }
    )
    
    const duration = performance.now() - startTime
    
    if (duration > DATABASE_CONFIG.slow_query_threshold) {
      console.warn('Slow Transaction:', {
        duration: `${duration.toFixed(2)}ms`,
        maxWait: options.maxWait,
        timeout: options.timeout,
        isolationLevel: options.isolationLevel,
      })
    }
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    
    console.error('Transaction Error:', {
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration.toFixed(2)}ms`,
      options,
    })
    
    throw error
  }
}

/**
 * Optimized query helpers
 */
export const queries = {
  /**
   * Get aggregated items with optimized select and includes
   */
  async getAggregatedItems(params: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
    includeFile?: boolean
  }) {
    return db.aggregatedItem.findMany({
      select: {
        id: true,
        itemId: true,
        name: true,
        quantity: true,
        unit: true,
        sourceFiles: true,
        count: true,
        createdAt: true,
        updatedAt: true,
        ...(params.includeFile && {
          file: {
            select: {
              id: true,
              fileName: true,
            },
          },
        }),
      },
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    })
  },
  
  /**
   * Get excel rows with optimized select
   */
  async getExcelRows(params: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
    includeFile?: boolean
  }) {
    return db.excelRow.findMany({
      select: {
        id: true,
        itemId: true,
        name: true,
        quantity: true,
        unit: true,
        originalRowIndex: true,
        fileId: true,
        ...(params.includeFile && {
          file: {
            select: {
              fileName: true,
              uploadDate: true,
            },
          },
        }),
      },
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    })
  },
  
  /**
   * Get excel files with optimized select
   */
  async getExcelFiles(params: {
    where?: any
    orderBy?: any
    skip?: number
    take?: number
    includeStats?: boolean
  }) {
    return db.excelFile.findMany({
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        rowCount: true,
        uploadDate: true,
        ...(params.includeStats && {
          _count: {
            rows: true,
            aggregated: true,
          },
        }),
      },
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    })
  },
  
  /**
   * Batch create excel rows with optimized performance
   */
  async batchCreateExcelRows(rows: any[], batchSize = 1000) {
    const results = []
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const result = await db.excelRow.createMany({
        data: batch,
        skipDuplicates: true,
      })
      results.push(result)
      
      // Allow event loop to process other requests
      await new Promise(resolve => setImmediate(resolve))
    }
    
    return results
  },
}

export default db