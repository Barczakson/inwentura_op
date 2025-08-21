import { NextRequest, NextResponse } from 'next/server'
import { db, queries } from '@/lib/db-config'
import {
  withTimeout,
  withErrorHandling,
  createCompressedResponse,
  validateAndSanitizeRequest,
  PerformanceMonitor,
  REQUEST_TIMEOUTS,
  OPTIMIZED_QUERIES,
} from '@/lib/server-optimizations'

export const GET = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processGetRequest(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Data fetch timeout'
  )
}, 'Excel Data GET')

async function processGetRequest(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  // Validate and sanitize request
  const validation = validateAndSanitizeRequest(request)
  if (!validation.isValid) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.errors },
      { status: 400 }
    )
  }
  
  try {
    const { searchParams } = validation.sanitized.searchParams
    const includeRaw = searchParams.get('includeRaw') === 'true'
    const rawOnly = searchParams.get('rawOnly') === 'true'
    const fileId = searchParams.get('fileId')
    
    // console.log('Parsed parameters:', { includeRaw, rawOnly, fileId })
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Search parameters
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDirection = searchParams.get('sortDirection') || 'asc'

    // console.log('Pagination and search parameters:', { page, limit, offset, search, sortBy, sortDirection })

    monitor.checkpoint('parameters_parsed')
    
    // Get aggregated data with optimized queries
    let aggregatedData: any[] = []
    let paginationMeta: any = null
    
    if (rawOnly) {
      // Skip aggregated data when rawOnly is true
      aggregatedData = []
    } else if (fileId) {
      // Optimized query for file-specific aggregated items
      const allAggregatedData = await queries.getAggregatedItems({
        where: {},
        orderBy: [
          { name: 'asc' },
          { unit: 'asc' }
        ],
        includeFile: true
      })
      
      monitor.checkpoint('file_aggregated_data_fetched')
      
      // Filter aggregated items that contain the specific fileId in their sourceFiles
      aggregatedData = allAggregatedData.filter(item => {
        if (item.sourceFiles) {
          try {
            const sourceFileIds = JSON.parse(item.sourceFiles) as string[];
            return sourceFileIds.includes(fileId);
          } catch (error) {
            console.warn('Failed to parse sourceFiles JSON:', error);
            return false;
          }
        }
        return item.fileId === fileId; // Fallback to direct fileId match
      });
    } else {
      // Build where clause for search
      const whereClause: any = {}
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { itemId: { contains: search, mode: 'insensitive' } }
        ]
      }

      // Get total count for pagination
      const totalCount = await db.aggregatedItem.count({
        where: whereClause
      })

      // Optimized aggregated data query with pagination
      aggregatedData = await queries.getAggregatedItems({
        where: whereClause,
        orderBy: {
          [sortBy]: sortDirection as 'asc' | 'desc'
        },
        skip: offset,
        take: limit,
        includeFile: true
      })
      
      monitor.checkpoint('aggregated_data_fetched')

      // Add pagination metadata to response
      paginationMeta = {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    }

    // Optimized source files processing with batch queries
    const aggregatedWithSourceFiles = await processSourceFiles(aggregatedData, monitor)

    let rawData: any[] = []
    if (includeRaw) {
      monitor.checkpoint('raw_data_processing_start')
      
      // Build optimized where clause for raw data
      const rawWhereClause: any = fileId ? { fileId: fileId } : {}
      
      // Add search functionality for raw data
      if (search && fileId) {
        rawWhereClause.AND = [
          { fileId: fileId },
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { itemId: { contains: search, mode: 'insensitive' } }
            ]
          }
        ]
      }
      
      // Add search functionality for raw data when not filtered by file
      if (search && !fileId) {
        rawWhereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { itemId: { contains: search, mode: 'insensitive' } }
        ]
      }
      
      // If we're viewing a specific file or rawOnly mode, add pagination for raw data
      if (fileId || rawOnly) {
        // Get total count for file raw data
        const rawTotalCount = await db.excelRow.count({
          where: rawWhereClause
        })
        
        // Optimized raw data query
        rawData = await queries.getExcelRows({
          where: rawWhereClause,
          orderBy: {
            [sortBy === 'quantity' ? 'quantity' : sortBy === 'unit' ? 'unit' : 'name']: sortDirection as 'asc' | 'desc'
          },
          skip: offset,
          take: limit,
          includeFile: true
        })
        
        // Update pagination metadata for raw data when viewing a file or in rawOnly mode
        paginationMeta = {
          page,
          limit,
          total: rawTotalCount,
          totalPages: Math.ceil(rawTotalCount / limit),
          hasNext: page * limit < rawTotalCount,
          hasPrev: page > 1
        }
      } else {
        // Optimized raw data query without pagination
        rawData = await queries.getExcelRows({
          where: rawWhereClause,
          orderBy: {
            createdAt: 'desc'
          },
          includeFile: true
        })
      }
    }

    monitor.checkpoint('data_processing_complete')
    
    const response: any = {
      aggregated: aggregatedWithSourceFiles
    }

    // Add raw data only when requested
    if (includeRaw) {
      response.raw = rawData
      monitor.checkpoint('raw_data_added')
    }

    // Add pagination metadata if available
    if (paginationMeta) {
      response.pagination = paginationMeta
    }
    
    // Add performance data in development
    if (process.env.NODE_ENV === 'development') {
      response.performance = monitor.getReport()
    }

    // Return compressed response for large datasets
    if (JSON.stringify(response).length > 10000) {
      return createCompressedResponse(response)
    }

    return NextResponse.json(response)

  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error fetching data:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch data', 
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Optimized source files processing with batch queries
 */
async function processSourceFiles(aggregatedData: any[], monitor: PerformanceMonitor) {
  if (aggregatedData.length === 0) return []
  
  // Batch query for all source rows to minimize database calls
  const uniqueItems = aggregatedData.map(item => ({
    itemId: item.itemId,
    name: item.name,
    unit: item.unit
  }))
  
  // Build OR conditions for batch query
  const sourceRowsQuery = {
    OR: uniqueItems.map(item => ({
      itemId: item.itemId || null,
      name: item.name,
      unit: item.unit
    }))
  }
  
  const sourceRows = await queries.getExcelRows({
    where: sourceRowsQuery,
    includeFile: false
  })
  
  monitor.checkpoint('source_files_batch_fetched')
  
  // Group source rows by item key
  const sourceRowsMap = new Map()
  sourceRows.forEach(row => {
    const key = `${row.itemId || ''}|${row.name}|${row.unit}`
    if (!sourceRowsMap.has(key)) {
      sourceRowsMap.set(key, [])
    }
    sourceRowsMap.get(key).push(row)
  })
  
  // Process aggregated data with source files
  return aggregatedData.map(item => {
    const key = `${item.itemId || ''}|${item.name}|${item.unit}`
    const itemSourceRows = sourceRowsMap.get(key) || []
    const sourceFileIds = [...new Set(itemSourceRows.map(row => row.fileId))]
    
    let sourceFiles: string[] = sourceFileIds
    if (item.sourceFiles) {
      try {
        sourceFiles = JSON.parse(item.sourceFiles) as string[]
      } catch (error) {
        console.warn('Failed to parse sourceFiles JSON:', error)
        sourceFiles = sourceFileIds
      }
    }
    
    return {
      ...item,
      sourceFiles,
      count: item.count || itemSourceRows.length
    }
  })
}

export const PUT = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processPutRequest(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Data update timeout'
  )
}, 'Excel Data PUT')

async function processPutRequest(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const { id, quantity } = await request.json()

    if (!id || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    monitor.checkpoint('validation_complete')
    
    const updatedItem = await db.aggregatedItem.update({
      where: { id },
      data: { 
        quantity,
        updatedAt: new Date()
      },
      select: OPTIMIZED_QUERIES.AGGREGATED_ITEM_SELECT
    })
    
    monitor.checkpoint('item_updated')

    return NextResponse.json({
      ...updatedItem,
      ...(process.env.NODE_ENV === 'development' && {
        performance: monitor.getReport()
      })
    })

  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error updating item:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to update item',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}

export const DELETE = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processDeleteRequest(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Data deletion timeout'
  )
}, 'Excel Data DELETE')

async function processDeleteRequest(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    monitor.checkpoint('validation_complete')
    
    await db.aggregatedItem.delete({
      where: { id }
    })
    
    monitor.checkpoint('item_deleted')

    return NextResponse.json({ 
      success: true,
      ...(process.env.NODE_ENV === 'development' && {
        performance: monitor.getReport()
      })
    })

  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error deleting item:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to delete item',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}