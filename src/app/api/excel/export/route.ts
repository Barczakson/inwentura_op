import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'aggregated' // 'aggregated' or 'raw'

    let data: any[] = []
    
    if (type === 'aggregated') {
      data = await db.aggregatedItem.findMany({
        orderBy: [
          { name: 'asc' },
          { unit: 'asc' }
        ]
      })
    } else {
      data = await db.excelRow.findMany({
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

    // Prepare data for Excel export
    const excelData = data.map(item => {
      if (type === 'aggregated') {
        return {
          'Item ID': item.itemId || '',
          'Name': item.name,
          'Quantity': item.quantity,
          'Unit': item.unit,
          'Formatted': `${item.quantity} ${item.unit}`
        }
      } else {
        return {
          'Item ID': item.itemId || '',
          'Name': item.name,
          'Quantity': item.quantity,
          'Unit': item.unit,
          'Source File': item.file?.fileName || '',
          'Upload Date': item.file?.uploadDate || '',
          'Formatted': `${item.quantity} ${item.unit}`
        }
      }
    })

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, type === 'aggregated' ? 'Aggregated Data' : 'Raw Data')

    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // Item ID
      { wch: 30 }, // Name
      { wch: 12 }, // Quantity
      { wch: 10 }, // Unit
      { wch: 20 }, // Formatted or Source File
    ]
    
    if (type === 'raw') {
      colWidths.push({ wch: 15 }) // Upload Date
    }
    
    ws['!cols'] = colWidths

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${type === 'aggregated' ? 'aggregated_data' : 'raw_data'}_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}