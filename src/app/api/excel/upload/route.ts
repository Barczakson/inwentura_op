import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read the file
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Process the data and build structure metadata
    const rows: any[] = []
    const structure: any[] = []
    const aggregatedData = new Map()
    
    console.log('Processing Excel file with', jsonData.length, 'rows')

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
        console.log(`Found header at row ${i + 1}: ${firstCell}`)
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
          
          rows.push(rowData)
          
          // Add to structure
          structure.push({
            type: 'item',
            content: {
              lp: lp,
              itemId: itemId || null,
              name,
              quantity,
              unit
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
              name,
              quantity,
              unit,
              sourceRowIds: [rowId]
            })
          }
          
          console.log(`Found item at row ${i + 1}: ${name} (${quantity} ${unit})`)
        }
      }
    }

    // Save to database
    let fileId = ''
    let aggregatedWithSourceFiles: any[] = []
    
    if (rows.length > 0) {
      // Create Excel file record with structure metadata
      const excelFile = await db.excelFile.create({
        data: {
          fileName: file.name,
          fileSize: file.size,
          rowCount: rows.length,
          originalStructure: structure // Store the complete structure
        }
      })
      fileId = excelFile.id

      // Save all rows (no aggregation during upload)
      await db.excelRow.createMany({
        data: rows.map(row => ({
          ...row,
          fileId: excelFile.id
        }))
      })

      // Save aggregated data for quick queries
      const aggregatedArray = Array.from(aggregatedData.values())
      aggregatedWithSourceFiles = aggregatedArray.map(item => ({
        ...item,
        sourceFiles: JSON.stringify([fileId]),
        count: item.sourceRowIds.length,
        fileId: excelFile.id
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
              fileId: excelFile.id,
              sourceFiles: item.sourceFiles,
              count: item.count
            }
          })
        }
      }
    }

    console.log(`Successfully processed ${rows.length} items with ${structure.length} structure elements`)

    return NextResponse.json({
      success: true,
      fileId,
      rows,
      aggregated: aggregatedWithSourceFiles,
      structure: structure
    })

  } catch (error) {
    console.error('Error processing Excel file:', error)
    return NextResponse.json(
      { error: 'Failed to process Excel file' },
      { status: 500 }
    )
  }
}