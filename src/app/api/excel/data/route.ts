import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRaw = searchParams.get('includeRaw') === 'true'
    const rawOnly = searchParams.get('rawOnly') === 'true'
    const fileId = searchParams.get('fileId')
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Search parameters
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortDirection = searchParams.get('sortDirection') || 'asc'

    // Get aggregated data with source file information (skip if rawOnly)
    let aggregatedData = [];
    let paginationMeta: any = null;
    
    if (rawOnly) {
      // Skip aggregated data when rawOnly is true
      aggregatedData = [];
    } else if (fileId) {
      // When filtering by file, find aggregated items that include this file in their sourceFiles
      const allAggregatedData = await db.aggregatedItem.findMany({
        include: {
          file: {
            select: {
              id: true,
              fileName: true
            }
          }
        },
        orderBy: [
          { name: 'asc' },
          { unit: 'asc' }
        ]
      });
      
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

      // Get all aggregated data when no file filter is specified
      aggregatedData = await db.aggregatedItem.findMany({
        where: whereClause,
        include: {
          file: {
            select: {
              id: true,
              fileName: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortDirection as 'asc' | 'desc'
        },
        skip: offset,
        take: limit
      })

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

    // Get source files for each aggregated item
    const aggregatedWithSourceFiles = await Promise.all(
      aggregatedData.map(async (item) => {
        // Find all source rows that contributed to this aggregated item
        const sourceRows = await db.excelRow.findMany({
          where: {
            name: item.name,
            unit: item.unit,
            itemId: item.itemId || null
          },
          select: {
            fileId: true
          }
        })

        const sourceFileIds = [...new Set(sourceRows.map(row => row.fileId))]
        
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
          count: item.count || sourceRows.length
        }
      })
    )

    let rawData: any[] = []
    if (includeRaw) {
      // Build where clause for raw data
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
        
        rawData = await db.excelRow.findMany({
          where: rawWhereClause,
          include: {
            file: {
              select: {
                fileName: true,
                uploadDate: true
              }
            }
          },
          orderBy: {
            [sortBy === 'quantity' ? 'quantity' : sortBy === 'unit' ? 'unit' : 'name']: sortDirection as 'asc' | 'desc'
          },
          skip: offset,
          take: limit
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
        rawData = await db.excelRow.findMany({
          where: rawWhereClause,
          include: {
            file: {
              select: {
                fileName: true,
                uploadDate: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      }
    }

    const response: any = {
      aggregated: aggregatedWithSourceFiles,
      raw: rawData
    }

    // Add pagination metadata if available
    if (paginationMeta) {
      response.pagination = paginationMeta
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
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
      data: { quantity }
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