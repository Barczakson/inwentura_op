import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db-config'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  console.log('=== DEBUG UPLOAD ROUTE ===')
  
  try {
    console.log('1. Receiving request...')
    const formData = await request.formData()
    console.log('2. FormData received')
    
    const file = formData.get('file') as File
    console.log('3. File extracted:', !!file)
    
    if (!file) {
      console.log('❌ No file uploaded')
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    
    console.log('4. File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    })
    
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      console.log('❌ Invalid file type:', file.type)
      return NextResponse.json({ 
        error: `Invalid file type: ${file.type}. Please upload an Excel file.` 
      }, { status: 400 })
    }
    
    console.log('5. File type validation passed')
    
    // Read file buffer
    console.log('6. Reading file buffer...')
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('7. File buffer created, size:', buffer.length)
    
    // Try to read Excel file
    console.log('8. Attempting to read Excel file...')
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log('9. Excel file read successfully')
      console.log('   Sheet names:', workbook.SheetNames)
    } catch (xlsxError) {
      console.log('❌ Failed to read Excel file:', xlsxError)
      return NextResponse.json({ 
        error: 'Failed to process Excel file',
        details: xlsxError instanceof Error ? xlsxError.message : String(xlsxError)
      }, { status: 500 })
    }
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    console.log('10. Using sheet:', sheetName)
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    console.log('11. Converting sheet to JSON...')
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    console.log('12. JSON data converted, rows:', jsonData.length)
    
    // Test database connection
    console.log('13. Testing database connection...')
    try {
      await db.$connect()
      console.log('14. Database connected successfully')
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError)
      return NextResponse.json({ 
        error: 'Database connection failed',
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, { status: 500 })
    }
    
    // Create test ExcelFile record
    console.log('15. Creating ExcelFile record...')
    try {
      const excelFile = await db.excelFile.create({
        data: {
          fileName: file.name,
          fileSize: file.size,
          rowCount: jsonData.length,
          originalStructure: [] // Simplified for testing
        }
      })
      console.log('16. ExcelFile created successfully:', excelFile.id)
      
      // Clean up test record
      await db.excelFile.delete({
        where: { id: excelFile.id }
      })
      console.log('17. Test record cleaned up')
    } catch (dbError) {
      console.log('❌ Database operation failed:', dbError)
      return NextResponse.json({ 
        error: 'Database operation failed',
        details: dbError instanceof Error ? dbError.message : String(dbError)
      }, { status: 500 })
    }
    
    console.log('✅ All tests passed!')
    
    return NextResponse.json({
      success: true,
      message: 'File processed successfully',
      rowCount: jsonData.length
    })
    
  } catch (error) {
    console.log('❌ Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}