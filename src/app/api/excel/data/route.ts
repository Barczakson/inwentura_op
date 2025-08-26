import { NextRequest, NextResponse } from 'next/server'
import { db, queries } from '@/lib/db-config'
import { ensureMigrationsRun } from '@/lib/migrate'

export async function GET(request: NextRequest) {
  try {
    // Ensure database is ready (runtime migration check)
    await ensureMigrationsRun()
    
    const { searchParams } = new URL(request.url)
    const includeRaw = searchParams.get('includeRaw') === 'true'
    const fileId = searchParams.get('fileId')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDirection = searchParams.get('sortDirection') || 'asc'

    // Build where clause for search and fileId
    const where: any = {}
    const conditions: any[] = []
    const isSQLite = process.env.DATABASE_URL?.includes('file:') || process.env.DATABASE_URL?.includes('sqlite')
    
    if (search) {
      // SQLite doesn't support case insensitive mode, PostgreSQL does
      const searchOptions = isSQLite 
        ? { contains: search } 
        : { contains: search, mode: 'insensitive' as const }
      
      conditions.push({
        OR: [
          { name: searchOptions },
          { itemId: searchOptions }
        ]
      })
    }
    
    if (fileId) {
      // Handle fileId search - different approach for SQLite vs PostgreSQL
      if (isSQLite) {
        // For SQLite, just match fileId directly (simpler approach)
        conditions.push({ fileId: fileId })
      } else {
        // For PostgreSQL, use JSON path search for sourceFiles array
        conditions.push({
          OR: [
            { fileId: fileId },
            { sourceFiles: { path: ['$[*]'], equals: fileId } }
          ]
        })
      }
    }
    
    // Combine all conditions with AND
    if (conditions.length === 1) {
      Object.assign(where, conditions[0])
    } else if (conditions.length > 1) {
      where.AND = conditions
    }

    // Build order by clause with validation
    const validSortFields = ['name', 'itemId', 'quantity', 'unit', 'createdAt', 'updatedAt']
    const validSortDirections = ['asc', 'desc']
    
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
    const sortDir = validSortDirections.includes(sortDirection.toLowerCase()) ? sortDirection.toLowerCase() : 'asc'
    
    const orderBy: any = { [sortField]: sortDir }

    // Get total count
    const total = await db.aggregatedItem.count({ where })
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit

    // Get paginated data
    const aggregatedData = await queries.getAggregatedItems({
      where,
      orderBy,
      skip: offset,
      take: limit
    })

    const response: any = {
      aggregated: aggregatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }

    // Include raw data if requested
    if (includeRaw) {
      const rawWhere: any = fileId ? { fileId } : {}
      
      if (search) {
        // SQLite doesn't support case insensitive mode, PostgreSQL does
        const isSQLite = process.env.DATABASE_URL?.includes('file:') || process.env.DATABASE_URL?.includes('sqlite')
        const searchOptions = isSQLite 
          ? { contains: search } 
          : { contains: search, mode: 'insensitive' as const }
          
        rawWhere.OR = [
          { name: searchOptions },
          { itemId: searchOptions }
        ]
      }
      
      // Build raw data order by clause (limited to relevant fields for raw data)
      const rawValidSortFields = ['name', 'itemId', 'quantity', 'unit', 'originalRowIndex']
      const rawSortField = rawValidSortFields.includes(sortBy) ? sortBy : 'originalRowIndex'
      const rawOrderBy: any = { [rawSortField]: sortDir }

      const rawData = await queries.getExcelRows({
        where: rawWhere,
        orderBy: rawOrderBy,
        skip: offset,
        take: limit
      })
      
      response.raw = rawData
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, quantity } = await request.json()

    if (!id || typeof quantity !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const updatedItem = await db.aggregatedItem.update({
      where: { id },
      data: { 
        quantity,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(updatedItem)

  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    await db.aggregatedItem.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}