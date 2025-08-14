import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRaw = searchParams.get('includeRaw') === 'true'
    const fileId = searchParams.get('fileId')

    // Build where clause for file filtering
    const whereClause = fileId ? { fileId: fileId } : {}

    // Get aggregated data with source file information
    const aggregatedData = await db.aggregatedItem.findMany({
      where: whereClause,
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
    })

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
      rawData = await db.excelRow.findMany({
        where: fileId ? { fileId: fileId } : {},
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

    return NextResponse.json({
      aggregated: aggregatedWithSourceFiles,
      raw: rawData
    })

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