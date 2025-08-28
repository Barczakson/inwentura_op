import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create a sample Excel file record
  const excelFile = await prisma.excelFile.create({
    data: {
      fileName: 'sample_data.xlsx',
      fileSize: 1024,
      rowCount: 5,
      originalStructure: {
        sheets: ['Sheet1'],
        categories: ['SUROWCE'],
        headers: ['ID', 'Name', 'Quantity', 'Unit']
      },
      detectedHeaders: ['ID', 'Name', 'Quantity', 'Unit']
    }
  })

  console.log('Created Excel file:', excelFile.id)

  // Sample rows data
  const sampleRows = [
    { id: uuidv4(), itemId: '001', name: 'Apple', quantity: 10, unit: 'kg', originalRowIndex: 1 },
    { id: uuidv4(), itemId: '002', name: 'Banana', quantity: 15, unit: 'kg', originalRowIndex: 2 },
    { id: uuidv4(), itemId: '003', name: 'Orange', quantity: 8, unit: 'kg', originalRowIndex: 3 },
    { id: uuidv4(), itemId: '004', name: 'Grapes', quantity: 5, unit: 'kg', originalRowIndex: 4 },
    { id: uuidv4(), itemId: '005', name: 'Mango', quantity: 12, unit: 'kg', originalRowIndex: 5 }
  ]

  // Save sample rows
  await prisma.excelRow.createMany({
    data: sampleRows.map(row => ({
      ...row,
      fileId: excelFile.id
    }))
  })

  console.log('Created sample rows')

  // Create aggregated data
  const aggregatedItems = [
    { 
      id: uuidv4(), 
      itemId: '001', 
      name: 'Apple', 
      quantity: 10, 
      unit: 'kg',
      sourceFiles: [excelFile.id], // JSON field for PostgreSQL
      count: 1,
      fileId: excelFile.id
    },
    { 
      id: uuidv4(), 
      itemId: '002', 
      name: 'Banana', 
      quantity: 15, 
      unit: 'kg',
      sourceFiles: [excelFile.id], // JSON field for PostgreSQL
      count: 1,
      fileId: excelFile.id
    },
    { 
      id: uuidv4(), 
      itemId: '003', 
      name: 'Orange', 
      quantity: 8, 
      unit: 'kg',
      sourceFiles: [excelFile.id], // JSON field for PostgreSQL
      count: 1,
      fileId: excelFile.id
    },
    { 
      id: uuidv4(), 
      itemId: '004', 
      name: 'Grapes', 
      quantity: 5, 
      unit: 'kg',
      sourceFiles: [excelFile.id], // JSON field for PostgreSQL
      count: 1,
      fileId: excelFile.id
    },
    { 
      id: uuidv4(), 
      itemId: '005', 
      name: 'Mango', 
      quantity: 12, 
      unit: 'kg',
      sourceFiles: [excelFile.id], // JSON field for PostgreSQL
      count: 1,
      fileId: excelFile.id
    }
  ]

  // Save aggregated items
  for (const item of aggregatedItems) {
    await prisma.aggregatedItem.create({
      data: item
    })
  }

  console.log('Created aggregated items')
  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })