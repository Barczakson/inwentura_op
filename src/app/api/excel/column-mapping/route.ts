import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-config'
import { 
  detectColumns, 
  validateMapping, 
  createDefaultMapping,
  type ColumnMapping 
} from '@/lib/column-detection'
import {
  withTimeout,
  withErrorHandling,
  PerformanceMonitor,
  REQUEST_TIMEOUTS,
} from '@/lib/server-optimizations'

/**
 * GET - Get all saved column mappings
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processGetMappings(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Get mappings timeout'
  )
}, 'Column Mappings GET')

async function processGetMappings(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const mappings = await db.columnMapping.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { usageCount: 'desc' },
        { lastUsed: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        mapping: true,
        headers: true,
        usageCount: true,
        lastUsed: true,
        createdAt: true,
      }
    })
    
    monitor.checkpoint('mappings_fetched')
    
    return NextResponse.json({
      mappings,
      ...(process.env.NODE_ENV === 'development' && {
        performance: monitor.getReport()
      })
    })
    
  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error fetching column mappings:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch column mappings',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Detect columns automatically or save new mapping
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processPostMapping(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Column mapping timeout'
  )
}, 'Column Mappings POST')

async function processPostMapping(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const body = await request.json()
    const { action, headers, sampleData, mapping, name, description } = body
    
    if (action === 'detect') {
      // Automatic column detection
      if (!headers || !Array.isArray(headers)) {
        return NextResponse.json(
          { error: 'Headers array is required for detection' },
          { status: 400 }
        )
      }
      
      monitor.checkpoint('detection_start')
      
      try {
        const detection = detectColumns(headers, sampleData || [])
        monitor.checkpoint('detection_complete')
        
        // Also provide default suggestions
        const suggestions = createDefaultMapping(headers)
        
        return NextResponse.json({
          detection,
          suggestions,
          ...(process.env.NODE_ENV === 'development' && {
            performance: monitor.getReport()
          })
        })
        
      } catch (detectionError) {
        // If automatic detection fails, provide manual options
        const suggestions = createDefaultMapping(headers)
        
        return NextResponse.json({
          detection: null,
          error: detectionError instanceof Error ? detectionError.message : String(detectionError),
          suggestions,
          headers,
          sampleData: sampleData?.slice(0, 5) || [],
        })
      }
      
    } else if (action === 'save') {
      // Save new column mapping
      if (!mapping || !name) {
        return NextResponse.json(
          { error: 'Mapping configuration and name are required' },
          { status: 400 }
        )
      }
      
      // Validate the mapping
      const validation = validateMapping(mapping, headers || [])
      if (!validation.isValid) {
        return NextResponse.json(
          { error: 'Invalid mapping', details: validation.errors },
          { status: 400 }
        )
      }
      
      monitor.checkpoint('validation_complete')
      
      // Save to database
      const savedMapping = await db.columnMapping.create({
        data: {
          name,
          description: description || null,
          mapping: mapping,
          headers: headers || null,
          isDefault: false,
        }
      })
      
      monitor.checkpoint('mapping_saved')
      
      return NextResponse.json({
        success: true,
        mapping: savedMapping,
        validation,
        ...(process.env.NODE_ENV === 'development' && {
          performance: monitor.getReport()
        })
      })
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "detect" or "save"' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error processing column mapping:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to process column mapping',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update existing mapping and track usage
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processPutMapping(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Update mapping timeout'
  )
}, 'Column Mappings PUT')

async function processPutMapping(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const body = await request.json()
    const { id, action, mapping, name, description } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      )
    }
    
    if (action === 'use') {
      // Track usage of existing mapping
      const updatedMapping = await db.columnMapping.update({
        where: { id },
        data: {
          usageCount: { increment: 1 },
          lastUsed: new Date(),
        }
      })
      
      monitor.checkpoint('usage_tracked')
      
      return NextResponse.json({
        success: true,
        mapping: updatedMapping,
        ...(process.env.NODE_ENV === 'development' && {
          performance: monitor.getReport()
        })
      })
      
    } else if (action === 'update') {
      // Update mapping configuration
      const updateData: any = {}
      
      if (mapping) {
        // Validate the new mapping
        const validation = validateMapping(mapping, [])
        if (!validation.isValid) {
          return NextResponse.json(
            { error: 'Invalid mapping', details: validation.errors },
            { status: 400 }
          )
        }
        updateData.mapping = mapping
      }
      
      if (name) updateData.name = name
      if (description !== undefined) updateData.description = description
      
      const updatedMapping = await db.columnMapping.update({
        where: { id },
        data: updateData
      })
      
      monitor.checkpoint('mapping_updated')
      
      return NextResponse.json({
        success: true,
        mapping: updatedMapping,
        ...(process.env.NODE_ENV === 'development' && {
          performance: monitor.getReport()
        })
      })
      
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "use" or "update"' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error updating column mapping:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to update column mapping',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove column mapping
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processDeleteMapping(request),
    REQUEST_TIMEOUTS.DEFAULT,
    'Delete mapping timeout'
  )
}, 'Column Mappings DELETE')

async function processDeleteMapping(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      )
    }
    
    // Check if it's a default mapping
    const existing = await db.columnMapping.findUnique({
      where: { id },
      select: { isDefault: true, name: true }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      )
    }
    
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default mapping' },
        { status: 403 }
      )
    }
    
    await db.columnMapping.delete({
      where: { id }
    })
    
    monitor.checkpoint('mapping_deleted')
    
    return NextResponse.json({
      success: true,
      ...(process.env.NODE_ENV === 'development' && {
        performance: monitor.getReport()
      })
    })
    
  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error deleting column mapping:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to delete column mapping',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}