import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { itemId, name, quantity, unit } = await request.json()

    if (!name || typeof quantity !== 'number' || !unit) {
      return NextResponse.json(
        { error: 'Name, quantity, and unit are required' },
        { status: 400 }
      )
    }

    // Clean up the data
    const cleanName = name.trim()
    const cleanUnit = unit.trim().toLowerCase()
    const cleanItemId = itemId ? itemId.trim() : null

    // Create or update aggregated item
    const aggregatedItem = await db.aggregatedItem.upsert({
      where: {
        itemId_name_unit: {
          itemId: cleanItemId,
          name: cleanName,
          unit: cleanUnit
        }
      },
      update: {
        quantity: {
          increment: quantity
        },
        count: {
          increment: 1
        }
      },
      create: {
        id: uuidv4(),
        itemId: cleanItemId,
        name: cleanName,
        quantity,
        unit: cleanUnit,
        sourceFiles: JSON.stringify([]), // Manual entries have no source files
        count: 1 // First manual entry for this item
      }
    })

    // Return the item with source file information
    const itemWithSourceInfo = {
      ...aggregatedItem,
      sourceFiles: [], // Manual entries have no source files
    }

    return NextResponse.json(itemWithSourceInfo)

  } catch (error) {
    console.error('Error adding manual entry:', error)
    return NextResponse.json(
      { error: 'Failed to add manual entry' },
      { status: 500 }
    )
  }
}