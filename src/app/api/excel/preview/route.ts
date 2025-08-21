import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { detectColumns, createDefaultMapping } from '@/lib/column-detection'
import {
  withTimeout,
  withErrorHandling,
  PerformanceMonitor,
  REQUEST_TIMEOUTS,
  MEMORY_LIMITS,
} from '@/lib/server-optimizations'

// File validation constants
const MAX_PREVIEW_FILE_SIZE = 5 * 1024 * 1024 // 5MB for preview
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream'
]

/**
 * POST - Preview Excel file and detect columns
 * This endpoint allows users to preview file structure and map columns
 * before committing to full upload
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return withTimeout(
    processPreview(request),
    REQUEST_TIMEOUTS.UPLOAD,
    'File preview timeout'
  )
}, 'Excel Preview')

async function processPreview(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  monitor.checkpoint('preview_start')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    
    monitor.checkpoint('file_received')
    
    // Basic file validation
    if (file.size > MAX_PREVIEW_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large for preview. Maximum size is ${MAX_PREVIEW_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 400 })
    }
    
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' 
      }, { status: 400 })
    }
    
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ 
        error: 'Invalid file extension. Only .xlsx and .xls files are allowed.' 
      }, { status: 400 })
    }
    
    monitor.checkpoint('file_validated')
    
    // Read and parse Excel file
    const buffer = Buffer.from(await file.arrayBuffer())
    let workbook: XLSX.WorkBook
    
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch (xlsxError) {
      console.warn('XLSX read failed:', xlsxError)
      return NextResponse.json({ 
        error: 'Failed to read Excel file. Please ensure the file is not corrupted.' 
      }, { status: 400 })
    }
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json({ 
        error: 'Excel file contains no sheets or is corrupted.' 
      }, { status: 400 })
    }
    
    monitor.checkpoint('excel_parsed')
    
    // Get the first sheet for preview
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length === 0) {
      return NextResponse.json({ 
        error: 'Excel sheet is empty.' 
      }, { status: 400 })
    }
    
    monitor.checkpoint('data_extracted')
    
    // Find potential header row
    let headerRowIndex = -1
    let headers: string[] = []
    let sampleDataRows: any[][] = []
    
    // Look for the first row that looks like headers
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
      const row = jsonData[i] as any[]
      
      if (!row || row.length === 0) continue
      
      // Check if this row contains text that could be headers
      const textCells = row.filter(cell => 
        cell && typeof cell === 'string' && cell.trim().length > 0
      ).length
      
      // If more than half the cells contain text, consider it a header row
      if (textCells >= Math.min(3, row.length * 0.5)) {
        headerRowIndex = i
        headers = row.map(cell => String(cell || '').trim()).filter(Boolean)
        
        // Get sample data rows (next 5-10 rows after header)
        sampleDataRows = jsonData
          .slice(i + 1, i + 11)
          .filter(row => row && row.length > 0)
          .slice(0, 5) as any[][]
        
        break
      }
    }
    
    if (headers.length === 0) {
      return NextResponse.json({ 
        error: 'Could not detect headers in the Excel file. Please ensure the first row contains column names.' 
      }, { status: 400 })
    }
    
    monitor.checkpoint('headers_detected')
    
    // Attempt automatic column detection
    let detection = null
    let detectionError = null
    
    try {
      detection = detectColumns(headers, sampleDataRows)
    } catch (error) {
      detectionError = error instanceof Error ? error.message : String(error)
      console.warn('Automatic column detection failed:', error)
    }
    
    // Always provide default suggestions
    const suggestions = createDefaultMapping(headers)
    
    monitor.checkpoint('detection_complete')
    
    // Analyze file structure for categories
    const categoryHeaders: string[] = []
    const knownCategories = ['DODANE DO SPISU', 'PÓŁPRODUKTY', 'SUROWCE', 'PRODUKCJA']
    
    for (let i = headerRowIndex + 1; i < Math.min(jsonData.length, 50); i++) {
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue
      
      const firstCell = String(row[0] || '').trim()
      const isKnownCategory = knownCategories.some(cat => 
        firstCell.toUpperCase().includes(cat.toUpperCase())
      )
      
      if (isKnownCategory && !categoryHeaders.includes(firstCell)) {
        categoryHeaders.push(firstCell)
      }
    }
    
    // Count potential data rows
    let dataRowCount = 0
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      if (!row || row.length === 0) continue
      
      // Skip category headers
      const firstCell = String(row[0] || '').trim()
      const isCategory = knownCategories.some(cat => 
        firstCell.toUpperCase().includes(cat.toUpperCase())
      )
      
      if (!isCategory) {
        // Check if this looks like a data row
        const lp = Number(row[0])
        if (!isNaN(lp) && lp > 0 && row.length >= 3) {
          dataRowCount++
        }
      }
    }
    
    monitor.checkpoint('analysis_complete')
    
    const response = {
      success: true,
      file: {
        name: file.name,
        size: file.size,
        sheetName: sheetName,
        totalSheets: workbook.SheetNames.length,
        allSheetNames: workbook.SheetNames,
      },
      structure: {
        headerRowIndex,
        headers,
        sampleData: sampleDataRows,
        categoryHeaders,
        estimatedDataRows: dataRowCount,
        totalRows: jsonData.length,
      },
      detection: detection ? {
        mapping: detection.mapping,
        confidence: detection.confidence,
        suggestions: detection.suggestions,
      } : null,
      detectionError,
      defaultSuggestions: suggestions,
      ...(process.env.NODE_ENV === 'development' && {
        performance: monitor.getReport()
      })
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    monitor.checkpoint('error_occurred')
    
    console.error('Error previewing Excel file:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      performance: monitor.getReport(),
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to preview Excel file',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }
}