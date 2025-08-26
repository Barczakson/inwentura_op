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

    // Get total count
    const total = await db.aggregatedItem.count({ where })
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit

    // Get paginated data
    const aggregatedData = await queries.getAggregatedItems({
      where,
      orderBy: { name: 'asc' },
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
      
      const rawData = await queries.getExcelRows({
        where: rawWhere,
        orderBy: { originalRowIndex: 'asc' },
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