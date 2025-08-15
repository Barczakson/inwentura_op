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

    // Process the data
    const rows: any[] = []
    const aggregatedData = new Map()

    // Skip header row and process data
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[]
      
      // Skip empty rows or section headers (like "DODANE DO SPISU", "PÓŁPRODUKTY", etc.)
      if (!row || row.length < 5 || !row[0] || typeof row[0] !== 'number') {
        continue
      }
      
      // Your Excel format: L.p. | Nr indeksu | Nazwa towaru | Ilość | JMZ
      // Columns: 0=L.p., 1=Nr indeksu, 2=Nazwa towaru, 3=Ilość, 4=JMZ
      let itemId: string | undefined = String(row[1] || '') // Nr indeksu
      let name: string = String(row[2] || '') // Nazwa towaru  
      let quantity: number = parseFloat(String(row[3] || 0)) // Ilość
      let unit: string = String(row[4] || '').toLowerCase() // JMZ

      // Clean up the data
      name = name.trim()
      unit = unit.trim()


      if (name && !isNaN(quantity) && unit) {
        const rowId = uuidv4()
        rows.push({
          id: rowId,
          itemId,
          name,
          quantity,
          unit
        })

        // Aggregate data
        const key = `${itemId || ''}|${name}|${unit}`
        if (aggregatedData.has(key)) {
          const existing = aggregatedData.get(key)
          existing.quantity += quantity
        } else {
          aggregatedData.set(key, {
            id: uuidv4(),
            itemId,
            name,
            quantity,
            unit
          })
        }
      }
    }

    // Save to database
    let fileId = ''
    let aggregatedWithSourceFiles: any[] = []
    
    if (rows.length > 0) {
      // Create Excel file record
      const excelFile = await db.excelFile.create({
        data: {
          fileName: file.name,
          fileSize: file.size,
          rowCount: rows.length
        }
      })
      fileId = excelFile.id

      // Save all rows
      await db.excelRow.createMany({
        data: rows.map(row => ({
          ...row,
          fileId: excelFile.id
        }))
      })

      // Save aggregated data
      const aggregatedArray = Array.from(aggregatedData.values())
      aggregatedWithSourceFiles = aggregatedArray.map(item => {
        // Find all source rows that contributed to this aggregated item
        const sourceRows = rows.filter(row => 
          row.name === item.name && 
          row.unit === item.unit && 
          (row.itemId || null) === (item.itemId || null)
        )

        return {
          ...item,
          sourceFiles: JSON.stringify([fileId]), // Store as JSON string
          count: sourceRows.length
        }
      })

      for (const item of aggregatedWithSourceFiles) {
        // Check if item already exists to handle sourceFiles correctly
        const existingItem = await db.aggregatedItem.findUnique({
          where: {
            itemId_name_unit: {
              itemId: item.itemId || null,
              name: item.name,
              unit: item.unit
            }
          }
        })

        if (existingItem) {
          // Parse existing sourceFiles and add new file
          let existingSourceFiles: string[] = []
          try {
            existingSourceFiles = existingItem.sourceFiles ? JSON.parse(existingItem.sourceFiles) : []
          } catch (error) {
            console.warn('Failed to parse existing sourceFiles:', error)
            existingSourceFiles = []
          }
          
          // Add new file to source files if not already present
          if (!existingSourceFiles.includes(fileId)) {
            existingSourceFiles.push(fileId)
          }

          await db.aggregatedItem.update({
            where: {
              itemId_name_unit: {
                itemId: item.itemId || null,
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
          // Create new item
          await db.aggregatedItem.create({
            data: {
              ...item,
              fileId: excelFile.id
            }
          })
        }
      }
    } else {
      // If no rows, still return empty aggregated data
      aggregatedWithSourceFiles = []
    }

    return NextResponse.json({
      success: true,
      fileId,
      rows,
      aggregated: aggregatedWithSourceFiles
    })

  } catch (error) {
    console.error('Error processing Excel file:', error)
    return NextResponse.json(
      { error: 'Failed to process Excel file' },
      { status: 500 }
    )
  }
}