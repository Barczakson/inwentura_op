const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    console.log('1. Testing basic connection...')
    await prisma.$connect()
    console.log('✅ Connected to database')

    // Test creating a simple record
    console.log('2. Testing ExcelFile creation...')
    const testFile = await prisma.excelFile.create({
      data: {
        fileName: 'test.xlsx',
        fileSize: 1000,
        rowCount: 5,
        originalStructure: []
      }
    })
    console.log('✅ Created test file:', testFile.id)

    // Test creating ExcelRow records one by one instead of createMany
    console.log('3. Testing individual ExcelRow creation...')
    const testRows = [
      {
        id: 'test-1',
        itemId: 'TEST001',
        name: 'Test Item 1',
        quantity: 10,
        unit: 'szt',
        originalRowIndex: 1,
        fileId: testFile.id
      },
      {
        id: 'test-2',
        itemId: 'TEST002',
        name: 'Test Item 2',
        quantity: 5,
        unit: 'kg',
        originalRowIndex: 2,
        fileId: testFile.id
      }
    ]

    // Create rows individually
    for (const row of testRows) {
      const createdRow = await prisma.excelRow.create({ data: row })
      console.log('✅ Created row:', createdRow.id)
    }

    // Test createMany
    console.log('4. Testing createMany...')
    const additionalRows = [
      {
        id: 'test-3',
        itemId: 'TEST003',
        name: 'Test Item 3',
        quantity: 2.5,
        unit: 'l',
        originalRowIndex: 3,
        fileId: testFile.id
      }
    ]

    const result = await prisma.excelRow.createMany({
      data: additionalRows
    })
    console.log('✅ CreateMany result:', result)

    // Clean up
    console.log('5. Cleaning up...')
    await prisma.excelRow.deleteMany({ where: { fileId: testFile.id } })
    await prisma.excelFile.delete({ where: { id: testFile.id } })
    console.log('✅ Cleanup complete')

  } catch (error) {
    console.error('❌ Database test failed:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    })
  } finally {
    await prisma.$disconnect()
    console.log('Disconnected from database')
  }
}

testConnection()