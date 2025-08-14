import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    // Create a sample Excel file record
    const excelFile = await db.excelFile.create({
      data: {
        fileName: 'sample_data.xlsx',
        fileSize: 1024,
        rowCount: 5
      }
    })

    // Sample rows data
    const sampleRows = [
      { id: uuidv4(), itemId: '001', name: 'Apple', quantity: 10, unit: 'kg' },
      { id: uuidv4(), itemId: '002', name: 'Banana', quantity: 15, unit: 'kg' },
      { id: uuidv4(), itemId: '003', name: 'Orange', quantity: 8, unit: 'kg' },
      { id: uuidv4(), itemId: '004', name: 'Grapes', quantity: 5, unit: 'kg' },
      { id: uuidv4(), itemId: '005', name: 'Mango', quantity: 12, unit: 'kg' }
    ]

    // Save sample rows
    await db.excelRow.createMany({
      data: sampleRows.map(row => ({
        ...row,
        fileId: excelFile.id
      }))
    })

    // Create aggregated data
    const aggregatedItems = [
      { 
        id: uuidv4(), 
        itemId: '001', 
        name: 'Apple', 
        quantity: 10, 
        unit: 'kg',
        sourceFiles: JSON.stringify([excelFile.id]),
        count: 1,
        fileId: excelFile.id
      },
      { 
        id: uuidv4(), 
        itemId: '002', 
        name: 'Banana', 
        quantity: 15, 
        unit: 'kg',
        sourceFiles: JSON.stringify([excelFile.id]),
        count: 1,
        fileId: excelFile.id
      },
      { 
        id: uuidv4(), 
        itemId: '003', 
        name: 'Orange', 
        quantity: 8, 
        unit: 'kg',
        sourceFiles: JSON.stringify([excelFile.id]),
        count: 1,
        fileId: excelFile.id
      },
      { 
        id: uuidv4(), 
        itemId: '004', 
        name: 'Grapes', 
        quantity: 5, 
        unit: 'kg',
        sourceFiles: JSON.stringify([excelFile.id]),
        count: 1,
        fileId: excelFile.id
      },
      { 
        id: uuidv4(), 
        itemId: '005', 
        name: 'Mango', 
        quantity: 12, 
        unit: 'kg',
        sourceFiles: JSON.stringify([excelFile.id]),
        count: 1,
        fileId: excelFile.id
      }
    ]

    // Save aggregated items
    for (const item of aggregatedItems) {
      await db.aggregatedItem.create({
        data: item
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      fileId: excelFile.id,
      rows: sampleRows,
      aggregated: aggregatedItems
    })

  } catch (error) {
    console.error('Error creating sample data:', error)
    return NextResponse.json(
      { error: 'Failed to create sample data' },
      { status: 500 }
    )
  }
}