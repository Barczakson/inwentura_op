import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const files = await db.excelFile.findMany({
      orderBy: {
        uploadDate: 'desc'
      }
    })

    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.fileName,
      size: file.fileSize,
      uploadDate: file.uploadDate.toISOString(),
      rowCount: file.rowCount
    }))

    return NextResponse.json(formattedFiles)
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Delete related rows first
    await db.excelRow.deleteMany({
      where: {
        fileId: fileId
      }
    })

    // Delete aggregated items related to this file
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