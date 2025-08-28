/**
 * Server-Side Performance Optimizations
 * 
 * This module provides comprehensive server-side optimization utilities
 * for the Excel Data Manager application.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'

// Request timeout configuration
export const REQUEST_TIMEOUTS = {
  UPLOAD: 30000,      // 30s for file uploads
  EXPORT: 60000,      // 60s for exports
  DEFAULT: 15000,     // 15s for regular API calls
} as const

// Memory limits for file processing
export const MEMORY_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,     // 10MB
  MAX_ROWS_IN_MEMORY: 5000,            // Process in chunks if more
  CHUNK_SIZE: 1000,                    // Process 1000 rows at a time
} as const

/**
 * Request timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeout: number, 
  errorMessage = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeout)
    ),
  ])
}

/**
 * Memory-efficient Excel row processing
 */
export class ExcelRowProcessor {
  private rows: any[] = []
  private chunkSize: number
  
  constructor(chunkSize = MEMORY_LIMITS.CHUNK_SIZE) {
    this.chunkSize = chunkSize
  }
  
  addRow(row: any): void {
    this.rows.push(row)
  }
  
  async processInChunks<T>(
    processor: (chunk: any[]) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < this.rows.length; i += this.chunkSize) {
      const chunk = this.rows.slice(i, i + this.chunkSize)
      const chunkResults = await processor(chunk)
      results.push(...chunkResults)
      
      // Allow event loop to process other requests
      await new Promise(resolve => setImmediate(resolve))
    }
    
    return results
  }
  
  getRowCount(): number {
    return this.rows.length
  }
  
  clear(): void {
    this.rows = []
  }
}

/**
 * Response compression helper
 */
export function createCompressedResponse(
  data: any, 
  options: {
    filename?: string
    contentType?: string
    status?: number
  } = {}
): NextResponse {
  const response = NextResponse.json(data, { status: options.status || 200 })
  
  // Add compression headers
  response.headers.set('Content-Encoding', 'gzip')
  response.headers.set('Vary', 'Accept-Encoding')
  
  // Add caching headers for static content
  if (options.filename) {
    response.headers.set('Cache-Control', 'public, max-age=3600')
    response.headers.set('ETag', `"${Date.now()}"`)
  }
  
  return response
}

/**
 * Streaming response helper for large datasets
 */
export function createStreamingResponse(
  generator: () => AsyncGenerator<string>,
  options: {
    filename?: string
    contentType?: string
  } = {}
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator()) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
  
  const headers = new Headers({
    'Content-Type': options.contentType || 'application/octet-stream',
    'Transfer-Encoding': 'chunked',
  })
  
  if (options.filename) {
    headers.set('Content-Disposition', `attachment; filename="${options.filename}"`)
  }
  
  return new Response(stream, { headers })
}

/**
 * Database query optimization helpers
 */
export const OPTIMIZED_QUERIES = {
  // Optimized select fields for common queries
  AGGREGATED_ITEM_SELECT: {
    id: true,
    itemId: true,
    name: true,
    quantity: true,
    unit: true,
    sourceFiles: true,
    count: true,
    createdAt: true,
    updatedAt: true,
  },
  
  EXCEL_ROW_SELECT: {
    id: true,
    itemId: true,
    name: true,
    quantity: true,
    unit: true,
    originalRowIndex: true,
    fileId: true,
  },
  
  EXCEL_FILE_SELECT: {
    id: true,
    fileName: true,
    fileSize: true,
    rowCount: true,
    uploadDate: true,
  },
} as const

/**
 * Batch operation helper
 */
export class BatchProcessor<T> {
  private items: T[] = []
  private batchSize: number
  private processor: (items: T[]) => Promise<void>
  
  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize = 100
  ) {
    this.processor = processor
    this.batchSize = batchSize
  }
  
  add(item: T): void {
    this.items.push(item)
  }
  
  async flush(): Promise<void> {
    if (this.items.length === 0) return
    
    for (let i = 0; i < this.items.length; i += this.batchSize) {
      const batch = this.items.slice(i, i + this.batchSize)
      await this.processor(batch)
      
      // Allow event loop to process other requests
      await new Promise(resolve => setImmediate(resolve))
    }
    
    this.items = []
  }
  
  async addAndFlushIfNeeded(item: T): Promise<void> {
    this.add(item)
    
    if (this.items.length >= this.batchSize) {
      await this.flush()
    }
  }
}

/**
 * Request validation and sanitization
 */
export function validateAndSanitizeRequest(request: NextRequest): {
  isValid: boolean
  errors: string[]
  sanitized: {
    searchParams: URLSearchParams
    headers: Headers
  }
} {
  const errors: string[] = []
  const url = new URL(request.url)
  
  // Validate content-type for POST/PUT requests
  if (['POST', 'PUT'].includes(request.method)) {
    const contentType = request.headers.get('content-type')
    if (!contentType) {
      errors.push('Content-Type header is required')
    }
  }
  
  // Sanitize search parameters
  const sanitizedParams = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    // Basic XSS prevention
    const sanitizedValue = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    sanitizedParams.set(key, sanitizedValue)
  }
  
  // Create sanitized headers
  const sanitizedHeaders = new Headers()
  const allowedHeaders = [
    'content-type', 'authorization', 'user-agent', 
    'accept', 'accept-encoding', 'accept-language'
  ]
  
  for (const [key, value] of request.headers) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitizedHeaders.set(key, value)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      searchParams: sanitizedParams,
      headers: sanitizedHeaders,
    },
  }
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  private startTime: number
  private checkpoints: { name: string; time: number }[] = []
  
  constructor() {
    this.startTime = performance.now()
  }
  
  checkpoint(name: string): void {
    this.checkpoints.push({
      name,
      time: performance.now() - this.startTime,
    })
  }
  
  getReport(): {
    totalTime: number
    checkpoints: { name: string; time: number; delta: number }[]
  } {
    const totalTime = performance.now() - this.startTime
    const checkpoints = this.checkpoints.map((checkpoint, index) => ({
      name: checkpoint.name,
      time: checkpoint.time,
      delta: index > 0 ? checkpoint.time - this.checkpoints[index - 1].time : checkpoint.time,
    }))
    
    return { totalTime, checkpoints }
  }
  
  log(context: string): void {
    const report = this.getReport()
    console.log(`Performance Report - ${context}:`, {
      totalTime: `${report.totalTime.toFixed(2)}ms`,
      checkpoints: report.checkpoints,
    })
  }
}

/**
 * Error handling wrapper with proper logging
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) {
  return async (...args: T): Promise<R> => {
    const monitor = new PerformanceMonitor()
    
    try {
      monitor.checkpoint('start')
      const result = await fn(...args)
      monitor.checkpoint('success')
      
      if (process.env.NODE_ENV === 'development') {
        monitor.log(context)
      }
      
      return result
    } catch (error) {
      monitor.checkpoint('error')
      
      console.error(`Error in ${context}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        performance: monitor.getReport(),
      })
      
      throw error
    }
  }
}

/**
 * Connection pool configuration for Prisma on Vercel + Supabase
 */
export const DATABASE_CONFIG = {
  // Optimized for Vercel serverless functions + Supabase pooling
  connection_limit: 1,        // Required for Vercel serverless
  pool_timeout: 20,          // 20 seconds for pooled connections
  statement_timeout: '30s',   // 30 seconds for complex queries
  
  // Query optimization
  query_logging: process.env.NODE_ENV === 'development',
  log_slow_queries: true,
  slow_query_threshold: 1000, // 1 second
  
  // Vercel/Supabase specific settings
  ssl_mode: 'require',       // SSL required for Supabase
  pgbouncer: true,          // Enable pgBouncer compatibility
} as const