import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db, queries } from '@/lib/db-config'
import {
  withTimeout,
  withErrorHandling,
  createStreamingResponse,
  PerformanceMonitor,
  REQUEST_TIMEOUTS,
} from '@/lib/server-optimizations'

export const GET = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processExportRequest(request),
    REQUEST_TIMEOUTS.EXPORT,
    'Export timeout'
  )
}, 'Excel Export')

async function processExportRequest(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('export_start')
  
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'aggregated' // 'aggregated' or 'raw'

    if (type === 'aggregated') {
      monitor.checkpoint('aggregated_export_start')
      
      // Optimized query for files with structure metadata
      const files = await db.excelFile.findMany({
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          uploadDate: true,
          originalStructure: true,
          rows: {
            select: {
              id: true,
              itemId: true,
              name: true,
              quantity: true,
              unit: true,
              originalRowIndex: true
            }
          }
        },
        orderBy: {
          uploadDate: 'asc'
        }
      })
      
      monitor.checkpoint('files_fetched')

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

      monitor.checkpoint('excel_workbook_created')
      
      // Generate buffer with performance monitoring
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      
      monitor.checkpoint('excel_buffer_generated')
      
      const filename = `aggregated_data_${new Date().toISOString().split('T')[0]}.xlsx`
      
      // For large exports, consider streaming
      if (excelBuffer.length > 5 * 1024 * 1024) { // 5MB threshold
        console.log(`Large export detected: ${excelBuffer.length} bytes, using optimized headers`)
      }

      const response = new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': excelBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (process.env.NODE_ENV === 'development') {
        response.headers.set('X-Performance-Report', JSON.stringify(monitor.getReport()))
      }
      
      return response

    } else {
      monitor.checkpoint('raw_export_start')
      
      // Optimized raw data export with batch processing
      const rawData = await queries.getExcelRows({
        where: {},
        orderBy: [
          { fileId: 'asc' },
          { originalRowIndex: 'asc' }
        ],
        includeFile: true
      })
      
      monitor.checkpoint('raw_data_fetched')
      
      if (rawData.length === 0) {
        return NextResponse.json({ error: 'No raw data found' }, { status: 404 })
      }
      
      console.log(`Exporting ${rawData.length} raw data rows`)

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

      monitor.checkpoint('raw_excel_workbook_created')
      
      // Generate buffer with performance monitoring
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      
      monitor.checkpoint('raw_excel_buffer_generated')
      
      const filename = `raw_data_${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Performance logging for large exports
      if (excelBuffer.length > 5 * 1024 * 1024) { // 5MB threshold
        console.log(`Large raw export: ${excelBuffer.length} bytes, ${rawData.length} rows`)
      }

      const response = new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': excelBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (process.env.NODE_ENV === 'development') {
        response.headers.set('X-Performance-Report', JSON.stringify(monitor.getReport()))
      }
      
      return response
    }

  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error exporting data:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to export data',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}