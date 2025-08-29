import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-config'
import { ensureMigrationsRun } from '@/lib/migrate'

interface SearchFilters {
  query?: string
  itemId?: string
  units?: string[]
  quantityMin?: number
  quantityMax?: number
  fileIds?: string[]
  dateRange?: {
    from?: string
    to?: string
  }
  categories?: string[]
  hasItemId?: boolean
  aggregatedOnly?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Ensure database is ready
    await ensureMigrationsRun()

    const body = await request.json()
    const {
      filters = {} as SearchFilters,
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortDirection = 'asc'
    } = body

    console.log('Advanced search called with:', {
      filters,
      page,
      limit,
      sortBy,
      sortDirection,
      timestamp: new Date().toISOString()
    })

    // Validate parameters
    const validatedPage = Math.max(1, parseInt(String(page)))
    const validatedLimit = Math.min(1000, Math.max(1, parseInt(String(limit))))
    
    // Build comprehensive where clause
    const where: any = {}
    const conditions: any[] = []
    const isSQLite = process.env.DATABASE_URL?.includes('file:') || process.env.DATABASE_URL?.includes('sqlite')

    // Full-text search across multiple fields
    if (filters.query && filters.query.trim()) {
      const searchTerm = filters.query.trim()
      const searchOptions = isSQLite 
        ? { contains: searchTerm } 
        : { contains: searchTerm, mode: 'insensitive' as const }
      
      // Search in name, itemId, and if available, description
      const searchConditions = [
        { name: searchOptions },
        { itemId: searchOptions }
      ]

      // Advanced search patterns
      if (searchTerm.includes(':')) {
        // Support field:value syntax like "unit:kg" or "quantity:>100"
        const [field, value] = searchTerm.split(':', 2)
        
        switch (field.toLowerCase()) {
          case 'unit':
            searchConditions.push({ unit: searchOptions })
            break
          case 'quantity':
            if (value.startsWith('>')) {
              const num = parseFloat(value.slice(1))
              if (!isNaN(num)) {
                searchConditions.push({ quantity: { gt: num } })
              }
            } else if (value.startsWith('<')) {
              const num = parseFloat(value.slice(1))
              if (!isNaN(num)) {
                searchConditions.push({ quantity: { lt: num } })
              }
            } else {
              const num = parseFloat(value)
              if (!isNaN(num)) {
                searchConditions.push({ quantity: num })
              }
            }
            break
        }
      }

      conditions.push({ OR: searchConditions })
    }

    // Specific Item ID search
    if (filters.itemId && filters.itemId.trim()) {
      const itemIdOptions = isSQLite 
        ? { contains: filters.itemId.trim() } 
        : { contains: filters.itemId.trim(), mode: 'insensitive' as const }
      conditions.push({ itemId: itemIdOptions })
    }

    // Units filter
    if (filters.units && filters.units.length > 0) {
      conditions.push({ unit: { in: filters.units } })
    }

    // Quantity range
    if (filters.quantityMin !== undefined || filters.quantityMax !== undefined) {
      const quantityConditions: any = {}
      if (filters.quantityMin !== undefined) {
        quantityConditions.gte = filters.quantityMin
      }
      if (filters.quantityMax !== undefined) {
        quantityConditions.lte = filters.quantityMax
      }
      conditions.push({ quantity: quantityConditions })
    }

    // File IDs filter
    if (filters.fileIds && filters.fileIds.length > 0) {
      if (isSQLite) {
        conditions.push({ fileId: { in: filters.fileIds } })
      } else {
        // PostgreSQL: search in both fileId and sourceFiles JSON array
        conditions.push({
          OR: [
            { fileId: { in: filters.fileIds } },
            {
              AND: filters.fileIds.map(fileId => ({
                sourceFiles: { path: ['$[*]'], equals: fileId }
              }))
            }
          ]
        })
      }
    }

    // Date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      const dateConditions: any = {}
      if (filters.dateRange.from) {
        dateConditions.gte = new Date(filters.dateRange.from)
      }
      if (filters.dateRange.to) {
        dateConditions.lte = new Date(filters.dateRange.to)
      }
      conditions.push({ createdAt: dateConditions })
    }

    // Has Item ID filter
    if (filters.hasItemId !== undefined) {
      if (filters.hasItemId) {
        conditions.push({ itemId: { not: null } })
        conditions.push({ itemId: { not: '' } })
      } else {
        conditions.push({
          OR: [
            { itemId: null },
            { itemId: '' }
          ]
        })
      }
    }

    // Combine all conditions
    if (conditions.length === 1) {
      Object.assign(where, conditions[0])
    } else if (conditions.length > 1) {
      where.AND = conditions
    }

    // Build order by clause
    const validSortFields = ['name', 'itemId', 'quantity', 'unit', 'createdAt', 'updatedAt', 'count']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
    const sortDir = ['asc', 'desc'].includes(sortDirection.toLowerCase()) ? sortDirection.toLowerCase() : 'asc'
    const orderBy: any = { [sortField]: sortDir }

    // Add secondary sort for consistency
    if (sortField !== 'name') {
      orderBy.name = 'asc'
    }

    console.log('Search query:', { where, orderBy })

    // Execute search query
    const offset = (validatedPage - 1) * validatedLimit

    // Get results based on aggregatedOnly filter
    let results, total
    
    if (filters.aggregatedOnly) {
      // Search only aggregated items
      [results, total] = await Promise.all([
        db.aggregatedItem.findMany({
          where,
          orderBy,
          skip: offset,
          take: validatedLimit,
          include: {
            file: {
              select: {
                id: true,
                fileName: true,
                uploadDate: true
              }
            }
          }
        }),
        db.aggregatedItem.count({ where })
      ])
    } else {
      // Search both aggregated and raw items
      const [aggregatedResults, rawResults, aggregatedTotal, rawTotal] = await Promise.all([
        db.aggregatedItem.findMany({
          where,
          orderBy,
          skip: offset,
          take: Math.ceil(validatedLimit / 2), // Split results
          include: {
            file: {
              select: {
                id: true,
                fileName: true,
                uploadDate: true
              }
            }
          }
        }),
        db.excelRow.findMany({
          where: { ...where },
          orderBy,
          skip: offset,
          take: Math.floor(validatedLimit / 2),
          include: {
            file: {
              select: {
                id: true,
                fileName: true,
                uploadDate: true
              }
            }
          }
        }),
        db.aggregatedItem.count({ where }),
        db.excelRow.count({ where: { ...where } })
      ])

      // Combine and sort results
      const combinedResults = [
        ...aggregatedResults.map(item => ({ ...item, isAggregated: true })),
        ...rawResults.map(item => ({ ...item, isAggregated: false }))
      ]

      // Sort combined results
      combinedResults.sort((a, b) => {
        const aValue = a[sortField as keyof typeof a]
        const bValue = b[sortField as keyof typeof b]
        
        if (aValue < bValue) return sortDir === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDir === 'asc' ? 1 : -1
        return 0
      })

      results = combinedResults.slice(0, validatedLimit)
      total = aggregatedTotal + rawTotal
    }

    const totalPages = Math.ceil(total / validatedLimit)

    // Calculate search stats
    const stats = {
      totalResults: total,
      aggregatedCount: filters.aggregatedOnly ? total : results.filter(r => r.isAggregated).length,
      rawCount: filters.aggregatedOnly ? 0 : results.filter(r => !r.isAggregated).length,
      uniqueUnits: [...new Set(results.map(r => r.unit))],
      quantityRange: results.length > 0 ? {
        min: Math.min(...results.map(r => r.quantity)),
        max: Math.max(...results.map(r => r.quantity))
      } : { min: 0, max: 0 }
    }

    const response = {
      results,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        totalPages,
        hasNext: validatedPage < totalPages,
        hasPrev: validatedPage > 1
      },
      stats,
      appliedFilters: filters,
      searchTerm: filters.query || '',
      executionTime: Date.now()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Advanced search error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        results: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        stats: { totalResults: 0, aggregatedCount: 0, rawCount: 0, uniqueUnits: [], quantityRange: { min: 0, max: 0 } }
      },
      { status: 500 }
    )
  }
}

// GET endpoint for search suggestions
export async function GET(request: NextRequest) {
  try {
    await ensureMigrationsRun()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'units', 'items', 'files', 'all'
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10')))

    const suggestions: any[] = []
    const isSQLite = process.env.DATABASE_URL?.includes('file:') || process.env.DATABASE_URL?.includes('sqlite')

    if (query.length < 2) {
      // Return popular/recent items for empty queries
      if (type === 'all' || type === 'items') {
        const popularItems = await db.aggregatedItem.findMany({
          select: { name: true, count: true },
          orderBy: { count: 'desc' },
          take: limit,
          distinct: ['name']
        })
        suggestions.push(...popularItems.map(item => ({
          text: item.name,
          type: 'item',
          count: item.count
        })))
      }
    } else {
      const searchOptions = isSQLite 
        ? { contains: query } 
        : { contains: query, mode: 'insensitive' as const }

      if (type === 'all' || type === 'items') {
        // Item name suggestions
        const itemSuggestions = await db.aggregatedItem.findMany({
          where: { name: searchOptions },
          select: { name: true, count: true },
          orderBy: { count: 'desc' },
          take: Math.ceil(limit / 3),
          distinct: ['name']
        })
        suggestions.push(...itemSuggestions.map(item => ({
          text: item.name,
          type: 'item',
          count: item.count
        })))

        // Item ID suggestions
        const itemIdSuggestions = await db.aggregatedItem.findMany({
          where: { 
            itemId: searchOptions,
            itemId: { not: null }
          },
          select: { itemId: true, name: true },
          take: Math.ceil(limit / 3),
          distinct: ['itemId']
        })
        suggestions.push(...itemIdSuggestions.map(item => ({
          text: item.itemId,
          type: 'itemId',
          description: item.name
        })))
      }

      if (type === 'all' || type === 'units') {
        // Unit suggestions
        const unitSuggestions = await db.aggregatedItem.groupBy({
          by: ['unit'],
          where: { unit: searchOptions },
          _count: { unit: true },
          orderBy: { _count: { unit: 'desc' } },
          take: Math.ceil(limit / 3)
        })
        suggestions.push(...unitSuggestions.map(unit => ({
          text: unit.unit,
          type: 'unit',
          count: unit._count.unit
        })))
      }

      if (type === 'all' || type === 'files') {
        // File suggestions
        const fileSuggestions = await db.excelFile.findMany({
          where: { fileName: searchOptions },
          select: { id: true, fileName: true, rowCount: true },
          orderBy: { uploadDate: 'desc' },
          take: Math.ceil(limit / 3)
        })
        suggestions.push(...fileSuggestions.map(file => ({
          text: file.fileName,
          type: 'file',
          id: file.id,
          count: file.rowCount
        })))
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
      )
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, limit)

    return NextResponse.json({
      suggestions: uniqueSuggestions,
      query,
      type
    })

  } catch (error) {
    console.error('Search suggestions error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get suggestions',
        suggestions: [],
        query: '',
        type: 'all'
      },
      { status: 500 }
    )
  }
}