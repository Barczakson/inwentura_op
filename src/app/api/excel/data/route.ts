import { NextRequest, NextResponse } from 'next/server'
import { kvDB } from '@/lib/kv-adapter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRaw = searchParams.get('includeRaw') === 'true'
    const fileId = searchParams.get('fileId')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get aggregated data
    let aggregatedData = await kvDB.getAggregatedItems()
    
    // Filter by search if provided
    if (search) {
      aggregatedData = aggregatedData.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.itemId && item.itemId.toLowerCase().includes(search.toLowerCase()))
      )
    }

    // Filter by file if specified
    if (fileId) {
      aggregatedData = aggregatedData.filter(item => {
        if (item.fileId === fileId) return true
        if (item.sourceFiles) {
          try {
            const sourceFileIds = JSON.parse(item.sourceFiles)
            return sourceFileIds.includes(fileId)
          } catch {
            return false
          }
        }
        return false
      })
    }

    // Pagination
    const total = aggregatedData.length
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const paginatedData = aggregatedData.slice(offset, offset + limit)

    const response: any = {
      aggregated: paginatedData,
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
      const rawData = await kvDB.getRows(fileId || undefined)
      
      let filteredRawData = rawData
      if (search) {
        filteredRawData = rawData.filter(row =>
          row.name.toLowerCase().includes(search.toLowerCase()) ||
          (row.itemId && row.itemId.toLowerCase().includes(search.toLowerCase()))
        )
      }
      
      response.raw = filteredRawData.slice(offset, offset + limit)
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

    const updatedItem = await kvDB.updateAggregatedItem(id, quantity)
    
    if (!updatedItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

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

    await kvDB.deleteAggregatedItem(id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}