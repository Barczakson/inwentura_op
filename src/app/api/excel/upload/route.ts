import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db, withTransaction, queries } from '@/lib/db-config'
import { v4 as uuidv4 } from 'uuid'
import {
  withTimeout,
  withErrorHandling,
  ExcelRowProcessor,
  PerformanceMonitor,
  REQUEST_TIMEOUTS,
  MEMORY_LIMITS,
} from '@/lib/server-optimizations'

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream'
]

export const POST = withErrorHandling(async (request: NextRequest) => {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('request_start')

  return withTimeout(
    processUpload(request, monitor),
    REQUEST_TIMEOUTS.UPLOAD,
    'File upload timeout'
  )
}, 'Excel Upload')

async function processUpload(request: NextRequest, monitor: PerformanceMonitor) {
  try {
    // console.log('File upload POST called')
    const formData = await request.formData()
    // console.log('FormData received')
    const file = formData.get('file') as File
    // console.log('File extracted from FormData:', file ? 'found' : 'not found')

    if (!file) {
      // console.log('No file uploaded')
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    // console.log('File details:', {
    //   name: file.name,
    //   size: file.size,
    //   type: file.type
    // })

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB, but received ${(file.size / 1024 / 1024).toFixed(2)}MB`
      // console.log(errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const errorMsg = `Invalid file type. Please upload an Excel file (.xlsx or .xls)`
      // console.log(`Invalid file type: ${file.type}`, errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    // Validate file extension
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      const errorMsg = 'Invalid file extension. Only .xlsx and .ls files are allowed.'
      // console.log(`Invalid file extension: ${fileName}`, errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    // Check for suspiciously small files
    if (file.size < 100) {
      const errorMsg = 'File is too small to be a valid Excel file.'
      // console.log(errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }
    // console.log('File validation passed')

    monitor.checkpoint('file_validation_complete')

    // Memory-efficient file reading
    const arrayBuffer = await file.arrayBuffer()
    monitor.checkpoint('file_buffer_created')
    
    // Check if file is too large for memory processing
    if (file.size > MEMORY_LIMITS.MAX_FILE_SIZE) {
      console.warn(`Large file detected: ${file.size} bytes, processing with memory optimization`)
    }
    
    const buffer = Buffer.from(arrayBuffer)
    let workbook: XLSX.WorkBook
    
    try {
      // console.log('Attempting to read Excel file')
      workbook = XLSX.read(buffer, { type: 'buffer' })
      // console.log('Excel file read successfully')
    } catch (xlsxError) {
      console.warn('XLSX read failed, attempting recovery:', xlsxError)
      
      // Try with different options for corrupted files
      try {
        workbook = XLSX.read(buffer, { 
          type: 'buffer', 
          cellText: false,
          cellNF: false,
          cellDates: true
        })
        // console.log('File recovered with alternative settings')
      } catch (recoveryError) {
        console.error('File recovery failed:', recoveryError)
        return NextResponse.json({ 
          error: 'Failed to process Excel file' 
        }, { status: 500 })
      }
    }

    // Validate workbook structure
    // console.log('Workbook structure:', {
    //   sheetNames: workbook.SheetNames,
    //   hasSheets: !!workbook.Sheets,
    //   sheetCount: workbook.SheetNames?.length || 0
    // })
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      const errorMsg = 'Excel file contains no sheets or is corrupted.'
      // console.log(errorMsg)
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    // console.log('Using sheet:', sheetName)
    const worksheet = workbook.Sheets[sheetName]
    // console.log('Worksheet exists:', !!worksheet)

    // Convert to JSON
    // console.log('Converting sheet to JSON with header:1 option')
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    // console.log('JSON data converted, row count:', jsonData.length)
    // console.log('Sample data:', jsonData.slice(0, 3))

    monitor.checkpoint('excel_parsed')

    // Initialize memory-efficient row processor
    const rowProcessor = new ExcelRowProcessor(MEMORY_LIMITS.CHUNK_SIZE)
    const structure: any[] = []
    const aggregatedData = new Map()
    
    // Check if we need chunked processing
    const needsChunkedProcessing = jsonData.length > MEMORY_LIMITS.MAX_ROWS_IN_MEMORY
    if (needsChunkedProcessing) {
      console.log(`Large dataset detected: ${jsonData.length} rows, using chunked processing`)
    }

    // Process each row and capture structure
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      
      // Skip completely empty rows
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue
      }

      const firstCell = String(row[0] || '').trim()
      
      // Check if this is a known category header
      const knownCategories = ['DODANE DO SPISU', 'PÓŁPRODUKTY', 'SUROWCE', 'PRODUKCJA']
      const isKnownCategory = knownCategories.some(cat => 
        firstCell.toUpperCase().includes(cat.toUpperCase())
      )
      
      if (isKnownCategory) {
        // This is a category header
        structure.push({
          type: 'header',
          content: firstCell.toUpperCase(),
          originalRowIndex: i,
          excelRow: i + 1 // Excel is 1-indexed
        })
        // console.log(`Found header at row ${i + 1}: ${firstCell}`)
        continue
      }

      // Check if this is a data row (has numeric L.p. and required columns)
      const lp = Number(row[0])
      if (!isNaN(lp) && lp > 0 && row.length >= 4) {
        // This is a data row: L.p. | Nr indeksu | Nazwa towaru | Ilość | JMZ
        const itemId = String(row[1] || '').trim()
        const name = String(row[2] || '').trim()
        const quantity = parseFloat(String(row[3] || 0))
        const unit = String(row[4] || '').trim().toLowerCase()

        if (name && !isNaN(quantity) && unit) {
          const rowId = uuidv4()
          const rowData = {
            id: rowId,
            itemId: itemId || null,
            name,
            quantity,
            unit,
            originalRowIndex: i
          }
          
          rowProcessor.addRow(rowData)
          
          // Add to structure
          structure.push({
            type: 'item',
            content: {
              lp: lp,
              itemId: itemId || null,
              name: name,
              quantity: quantity,
              unit: unit
            },
            originalRowIndex: i,
            excelRow: i + 1,
            rowId: rowId
          })

          // Build aggregation data (for quick access later)
          const key = `${itemId || ''}|${name}|${unit}`
          if (aggregatedData.has(key)) {
            const existing = aggregatedData.get(key)
            existing.quantity += quantity
            existing.sourceRowIds.push(rowId)
          } else {
            aggregatedData.set(key, {
              id: uuidv4(),
              itemId: itemId || null,
              name: name,
              quantity: quantity,
              unit: unit,
              sourceRowIds: [rowId]
            })
          }
          
          // console.log(`Found item at row ${i + 1}: ${name} (${quantity} ${unit})`)
        }
      }
    }

    monitor.checkpoint('data_processing_complete')

    // Save to database with optimized batch processing
    let fileId = ''
    let aggregatedWithSourceFiles: any[] = []
    const rowCount = rowProcessor.getRowCount()
    
    if (rowCount > 0) {
      // Use transaction for data consistency
      const result = await withTransaction(async (tx) => {
        // Create Excel file record with structure metadata
        const excelFile = await tx.excelFile.create({
          data: {
            fileName: file.name,
            fileSize: file.size,
            rowCount,
            originalStructure: process.env.NODE_ENV === 'development' 
              ? JSON.stringify(structure) as any
              : structure as any
          }
        })
        
        monitor.checkpoint('file_record_created')

        // Process rows in chunks to avoid memory issues
        const rowsWithFileId = await rowProcessor.processInChunks(async (chunk) => {
          return chunk.map(row => ({
            ...row,
            fileId: excelFile.id
          }))
        })
        
        monitor.checkpoint('rows_processed')

        // Batch insert with optimized performance
        await queries.batchCreateExcelRows(rowsWithFileId.flat())
        
        monitor.checkpoint('rows_saved')
        
        return excelFile
      })
      
      fileId = result.id

      // Save aggregated data for quick queries
      const aggregatedArray = Array.from(aggregatedData.values())
      aggregatedWithSourceFiles = aggregatedArray.map(item => ({
        ...item,
        sourceFiles: JSON.stringify([fileId]),
        count: item.sourceRowIds.length,
        fileId: fileId
      }))

      for (const item of aggregatedWithSourceFiles) {
        const existingItem = await db.aggregatedItem.findUnique({
          where: {
            itemId_name_unit: {
              itemId: item.itemId,
              name: item.name,
              unit: item.unit
            }
          }
        })

        if (existingItem) {
          // Update existing aggregated item
          let existingSourceFiles: string[] = []
          try {
            existingSourceFiles = existingItem.sourceFiles ? JSON.parse(existingItem.sourceFiles) : []
          } catch (error) {
            console.warn('Failed to parse existing sourceFiles:', error)
            existingSourceFiles = []
          }
          
          if (!existingSourceFiles.includes(fileId)) {
            existingSourceFiles.push(fileId)
          }

          await db.aggregatedItem.update({
            where: {
              itemId_name_unit: {
                itemId: item.itemId,
                name: item.name,
                unit: item.unit
              }
            },
            data: {
              quantity: {
                increment: item.quantity
              },
              sourceFiles: JSON.stringify(existingSourceFiles),
              count: existingItem.count ? existingItem.count + item.count : item.count
            }
          })
        } else {
          // Create new aggregated item
          await db.aggregatedItem.create({
            data: {
              id: item.id,
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              fileId: fileId,
              sourceFiles: item.sourceFiles,
              count: item.count
            }
          })
        }
      }
    }

    monitor.checkpoint('database_operations_complete')
    
    // Clear processor memory
    rowProcessor.clear()
    
    const processingReport = monitor.getReport()
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Successfully processed ${rowCount} items in ${processingReport.totalTime.toFixed(2)}ms`)
    }

    return NextResponse.json({
      success: true,
      fileId,
      rowCount,
      aggregated: aggregatedWithSourceFiles,
      structure: structure,
      ...(process.env.NODE_ENV === 'development' && {
        performance: processingReport
      })
    })

  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error processing Excel file:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to process Excel file',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}