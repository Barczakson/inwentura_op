/**
 * Debug script for testing Excel upload functionality
 * Run this script to test various upload scenarios and debug issues
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

// Create test Excel files for debugging
function createTestFiles() {
  console.log('Creating test Excel files for debugging...')
  
  // Create a valid Excel file
  const validWorkbook = XLSX.utils.book_new()
  const validData = [
    ['DODANE DO SPISU'], // Category header
    ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'], // Headers
    [1, 'TEST001', 'Test Item 1', 10, 'szt'],
    [2, 'TEST002', 'Test Item 2', 5.5, 'kg'],
    [3, 'TEST003', 'Test Item 3', 2.75, 'l'],
  ]
  const validWorksheet = XLSX.utils.aoa_to_sheet(validData)
  XLSX.utils.book_append_sheet(validWorkbook, validWorksheet, 'Sheet1')
  XLSX.writeFile(validWorkbook, 'test-files/valid-test.xlsx')
  
  // Create a large Excel file
  const largeWorkbook = XLSX.utils.book_new()
  const largeData = [['DODANE DO SPISU']]
  for (let i = 1; i <= 1000; i++) {
    largeData.push([i, `ITEM${i.toString().padStart(4, '0')}`, `Test Item ${i}`, Math.random() * 100, 'szt'])
  }
  const largeWorksheet = XLSX.utils.aoa_to_sheet(largeData)
  XLSX.utils.book_append_sheet(largeWorkbook, largeWorksheet, 'Sheet1')
  XLSX.writeFile(largeWorkbook, 'test-files/large-test.xlsx')
  
  // Create an empty Excel file
  const emptyWorkbook = XLSX.utils.book_new()
  const emptyWorksheet = XLSX.utils.aoa_to_sheet([])
  XLSX.utils.book_append_sheet(emptyWorkbook, emptyWorksheet, 'Sheet1')
  XLSX.writeFile(emptyWorkbook, 'test-files/empty-test.xlsx')
  
  // Create malformed data
  const malformedWorkbook = XLSX.utils.book_new()
  const malformedData = [
    ['DODANE DO SPISU'],
    ['Not a valid data row'],
    ['Another invalid row', 'with', 'random', 'data'],
    [1, 'VALID001', 'Valid Item', 10, 'szt'], // One valid row
    ['Invalid row again'],
  ]
  const malformedWorksheet = XLSX.utils.aoa_to_sheet(malformedData)
  XLSX.utils.book_append_sheet(malformedWorkbook, malformedWorksheet, 'Sheet1')
  XLSX.writeFile(malformedWorkbook, 'test-files/malformed-test.xlsx')
  
  console.log('Test files created in test-files/ directory')
}

// Test upload function
async function testUpload(filePath) {
  const fileName = path.basename(filePath)
  console.log(`\n=== Testing ${fileName} ===`)
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      return
    }
    
    // Get file stats
    const stats = fs.statSync(filePath)
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`)
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath)
    
    // Test Excel parsing
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      console.log(`Sheet names: ${workbook.SheetNames.join(', ')}`)
      
      if (workbook.SheetNames.length > 0) {
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        console.log(`Row count: ${jsonData.length}`)
        console.log(`Sample data:`, jsonData.slice(0, 3))
        
        // Analyze data structure
        let headerCount = 0
        let dataRowCount = 0
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length === 0 || row.every(cell => !cell)) continue
          
          const firstCell = String(row[0] || '').trim()
          const knownCategories = ['DODANE DO SPISU', 'PÓŁPRODUKTY', 'SUROWCE', 'PRODUKCJA']
          const isKnownCategory = knownCategories.some(cat => 
            firstCell.toUpperCase().includes(cat.toUpperCase())
          )
          
          if (isKnownCategory) {
            headerCount++
            console.log(`Found header at row ${i + 1}: ${firstCell}`)
          } else {
            const lp = Number(row[0])
            if (!isNaN(lp) && lp > 0 && row.length >= 4) {
              const itemId = String(row[1] || '').trim()
              const name = String(row[2] || '').trim()
              const quantity = parseFloat(String(row[3] || 0))
              const unit = String(row[4] || '').trim().toLowerCase()
              
              if (name && !isNaN(quantity) && unit) {
                dataRowCount++
                if (dataRowCount <= 3) {
                  console.log(`Data row ${dataRowCount}: ${itemId} | ${name} | ${quantity} ${unit}`)
                }
              }
            }
          }
        }
        
        console.log(`Summary: ${headerCount} headers, ${dataRowCount} valid data rows`)
      }
    } catch (xlsxError) {
      console.error(`Excel parsing error: ${xlsxError.message}`)
    }
    
    // Simulate upload to API
    const formData = new FormData()
    const blob = new Blob([fileBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const file = new File([blob], fileName, { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    formData.append('file', file)
    
    console.log('Making API request...')
    const response = await fetch('http://localhost:3001/api/excel/upload', {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('✅ Upload successful!')
      console.log(`File ID: ${result.fileId}`)
      console.log(`Processed ${result.rowCount} rows`)
      console.log(`Performance: ${result.performance?.totalTime.toFixed(2)}ms`)
    } else {
      console.error('❌ Upload failed!')
      console.error(`Status: ${response.status}`)
      console.error(`Error: ${result.error}`)
      if (result.details) {
        console.error(`Details: ${result.details}`)
      }
      if (result.errorCode) {
        console.error(`Error Code: ${result.errorCode}`)
      }
    }
    
  } catch (error) {
    console.error(`Test error: ${error.message}`)
    console.error(error.stack)
  }
}

// Main debug function
async function debugUpload() {
  console.log('Excel Upload Debug Tool')
  console.log('=======================')
  
  // Create test-files directory
  if (!fs.existsSync('test-files')) {
    fs.mkdirSync('test-files')
  }
  
  // Create test files
  createTestFiles()
  
  // Test different scenarios
  const testFiles = [
    'test-files/valid-test.xlsx',
    'test-files/large-test.xlsx', 
    'test-files/empty-test.xlsx',
    'test-files/malformed-test.xlsx',
  ]
  
  for (const filePath of testFiles) {
    await testUpload(filePath)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second between tests
  }
  
  console.log('\n=== Debug Complete ===')
  console.log('Check the server logs for detailed error information')
  console.log('Test files are available in test-files/ directory')
}

// Run if called directly
if (require.main === module) {
  debugUpload().catch(console.error)
}

module.exports = { debugUpload, testUpload, createTestFiles }