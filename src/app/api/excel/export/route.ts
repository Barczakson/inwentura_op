import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'aggregated' // 'aggregated' or 'raw'

    if (type === 'aggregated') {
      // Get all files with their structure metadata
      const files = await db.excelFile.findMany({
        include: {
          rows: true
        },
        orderBy: {
          uploadDate: 'asc'
        }
      })

      if (files.length === 0) {
        return NextResponse.json({ error: 'No files found' }, { status: 404 })
      }

      // Build aggregated data respecting original structure
      const excelData: any[] = []
      let globalIndex = 1

      // First, collect all items from all files and aggregate globally
      const globalAggregation = new Map()
      const allStructureElements: any[] = []

      for (const file of files) {
        const structure = file.originalStructure as any[]
        
        // Collect all rows for global aggregation
        file.rows.forEach(row => {
          const key = `${row.itemId || ''}|${row.name}|${row.unit}`
          if (!globalAggregation.has(key)) {
            globalAggregation.set(key, {
              itemId: row.itemId,
              name: row.name,
              unit: row.unit,
              quantity: 0,
              firstSeen: row.originalRowIndex,
              fileId: file.id
            })
          }
          const existing = globalAggregation.get(key)
          existing.quantity += row.quantity
        })

        // Collect structure elements from first file (use as template)
        if (structure && structure.length > 0) {
          allStructureElements.push(...structure)
        }
      }

      // Use structure from first file as template, but with globally aggregated quantities
      const processedItems = new Set()
      
      for (const element of allStructureElements) {
        if (element.type === 'header') {
          // Add category header (only once per unique header)
          if (!excelData.some(row => row['L.p.'] === element.content)) {
            excelData.push({
              'L.p.': element.content,
              'Nr indeksu': '',
              'Nazwa towaru': '',
              'Ilość': '',
              'JMZ': ''
            })
          }
        } else if (element.type === 'item') {
          // Find the globally aggregated data for this item
          const key = `${element.content.itemId || ''}|${element.content.name}|${element.content.unit}`
          const aggregatedItem = globalAggregation.get(key)
          
          if (aggregatedItem && !processedItems.has(key)) {
            excelData.push({
              'L.p.': globalIndex++,
              'Nr indeksu': aggregatedItem.itemId || '',
              'Nazwa towaru': aggregatedItem.name,
              'Ilość': aggregatedItem.quantity,
              'JMZ': aggregatedItem.unit
            })
            processedItems.add(key)
          }
        }
      }

      // Add any remaining items that weren't in any structure
      for (const [key, item] of globalAggregation) {
        if (!processedItems.has(key)) {
          excelData.push({
            'L.p.': globalIndex++,
            'Nr indeksu': item.itemId || '',
            'Nazwa towaru': item.name,
            'Ilość': item.quantity,
            'JMZ': item.unit
          })
        }
      }

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Aggregated Data')

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },  // L.p.
        { wch: 15 }, // Nr indeksu
        { wch: 40 }, // Nazwa towaru
        { wch: 12 }, // Ilość
        { wch: 10 }, // JMZ
      ]

      // Style category headers
      const categoryHeaders = ['DODANE DO SPISU', 'PÓŁPRODUKTY', 'SUROWCE', 'PRODUKCJA']
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 })
        const cell = ws[cellRef]
        
        if (cell && typeof cell.v === 'string' && categoryHeaders.includes(cell.v)) {
          // Style entire category row
          for (let C = 0; C < 5; C++) {
            const headerCellRef = XLSX.utils.encode_cell({ r: R, c: C })
            if (!ws[headerCellRef]) ws[headerCellRef] = { v: '', t: 's' }
            ws[headerCellRef].s = {
              font: { bold: true },
              alignment: { horizontal: 'left' },
              fill: { fgColor: { rgb: 'E6E6E6' } }
            }
          }
        }
      }

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="aggregated_data_${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      })

    } else {
      // Raw data export - show original rows without aggregation
      const rawData = await db.excelRow.findMany({
        include: {
          file: {
            select: {
              fileName: true,
              uploadDate: true
            }
          }
        },
        orderBy: [
          { fileId: 'asc' },
          { originalRowIndex: 'asc' }
        ]
      })

      const excelData = rawData.map((item, index) => ({
        'L.p.': index + 1,
        'Nr indeksu': item.itemId || '',
        'Nazwa towaru': item.name,
        'Ilość': item.quantity,
        'JMZ': item.unit,
        'Plik źródłowy': item.file?.fileName || '',
        'Pozycja w oryginalnym pliku': item.originalRowIndex ? item.originalRowIndex + 1 : ''
      }))

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Raw Data')

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },  // L.p.
        { wch: 15 }, // Nr indeksu
        { wch: 40 }, // Nazwa towaru
        { wch: 12 }, // Ilość
        { wch: 10 }, // JMZ
        { wch: 20 }, // Plik źródłowy
        { wch: 15 }, // Pozycja w oryginalnym pliku
      ]

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="raw_data_${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      })
    }

  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}