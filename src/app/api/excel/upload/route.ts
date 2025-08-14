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
      
      // Try to identify columns dynamically
      let itemId: string | undefined
      let name: string = ''
      let quantity: number = 0
      let unit: string = ''

      // Assume columns are in order: ID (optional), Name, Quantity, Unit
      // Adjust based on your Excel format
      if (row.length >= 3) {
        // If first column looks like an ID (numeric or string)
        if (typeof row[0] === 'number' || (typeof row[0] === 'string' && row[0].trim())) {
          itemId = String(row[0])
          name = String(row[1] || '')
          quantity = parseFloat(String(row[2] || 0))
          unit = String(row[3] || '').toLowerCase()
        } else {
          // No ID column
          name = String(row[0] || '')
          quantity = parseFloat(String(row[1] || 0))
          unit = String(row[2] || '').toLowerCase()
        }
      }

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
        await db.aggregatedItem.upsert({
          where: {
            itemId_name_unit: {
              itemId: item.itemId || null,
              name: item.name,
              unit: item.unit
            }
          },
          update: {
            quantity: {
              increment: item.quantity
            }
          },
          create: {
            ...item,
            fileId: excelFile.id
          }
        })
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