import { NextRequest, NextResponse } from 'next/server'
import { db, queries } from '@/lib/db-config'
import { ensureMigrationsRun } from '@/lib/migrate'

export async function GET(request: NextRequest) {
  try {
    console.log('Files API called at:', new Date().toISOString());
    
    // Ensure database is ready (runtime migration check)
    await ensureMigrationsRun()
    
    // Test database connection
    try {
      await db.$queryRaw`SELECT 1`;
      console.log('Database connection: OK');
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
        { status: 500 }
      );
    }
    
    const files = await queries.getExcelFiles({
      orderBy: { uploadDate: 'desc' },
      includeStats: true
    })

    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.fileName,
      size: file.fileSize,
      uploadDate: file.uploadDate,
      rowCount: file.rowCount
    }))

    return NextResponse.json(formattedFiles)
  } catch (error) {
    console.error('Error fetching files:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { error: 'Failed to fetch files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Ensure database is ready (runtime migration check)
    await ensureMigrationsRun()
    
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Get the rows that will be deleted to calculate quantity reduction
    const rowsToDelete = await db.excelRow.findMany({
      where: {
        fileId: fileId
      }
    })

    // Group rows by itemId|name|unit for quantity calculation
    const quantityReductionMap = new Map()
    rowsToDelete.forEach(row => {
      const key = `${row.itemId || ''}|${row.name}|${row.unit}`
      const current = quantityReductionMap.get(key) || 0
      quantityReductionMap.set(key, current + row.quantity)
    })

    // Update aggregated items that contain this file in their sourceFiles
    const allAggregatedItems = await db.aggregatedItem.findMany()
    
    for (const item of allAggregatedItems) {
      if (item.sourceFiles) {
        try {
          const sourceFileIds = Array.isArray(item.sourceFiles) 
            ? item.sourceFiles as string[] 
            : []
          
          // Check if this item contains the file we're deleting
          if (sourceFileIds.includes(fileId)) {
            // Remove the file ID from sourceFiles
            const updatedSourceFileIds = sourceFileIds.filter(id => id !== fileId)
            
            // Calculate the quantity to subtract
            const key = `${item.itemId || ''}|${item.name}|${item.unit}`
            const quantityToSubtract = quantityReductionMap.get(key) || 0
            
            if (updatedSourceFileIds.length > 0) {
              // Update the item with new sourceFiles and reduced quantity
              await db.aggregatedItem.update({
                where: { id: item.id },
                data: {
                  sourceFiles: updatedSourceFileIds,
                  quantity: Math.max(0, item.quantity - quantityToSubtract), // Ensure non-negative
                  count: Math.max(0, (item.count || 0) - rowsToDelete.filter(
                    row => (row.itemId || null) === (item.itemId || null) && 
                           row.name === item.name && 
                           row.unit === item.unit
                  ).length)
                }
              })
            } else {
              // If no source files left, delete the aggregated item
              await db.aggregatedItem.delete({
                where: { id: item.id }
              })
            }
          }
        } catch (error) {
          console.warn('Failed to process sourceFiles JSON:', error)
        }
      } else if (item.fileId === fileId) {
        // Handle direct file relationship fallback
        await db.aggregatedItem.delete({
          where: { id: item.id }
        })
      }
    }

    // Delete related rows first
    await db.excelRow.deleteMany({
      where: {
        fileId: fileId
      }
    })

    // Delete aggregated items that have a direct relationship with the file
    // (This might be redundant now but kept for safety)
    await db.aggregatedItem.deleteMany({
      where: {
        fileId: fileId
      }
    })

    // Delete the file
    await db.excelFile.delete({
      where: {
        id: fileId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}