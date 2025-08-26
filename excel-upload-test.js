const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

async function testExcelUpload() {
  try {
    console.log('Testing Excel upload functionality...');
    
    // Create Prisma client with explicit connection string
    const db = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://postgres:password@localhost:5432/excel_inventory_dev?sslmode=prefer'
        }
      }
    });
    
    await db.$connect();
    console.log('✅ Database connected successfully');
    
    // Test creating an ExcelFile record (similar to what happens in upload)
    console.log('Testing ExcelFile creation...');
    const testFile = await db.excelFile.create({
      data: {
        fileName: 'test-file.xlsx',
        fileSize: 1024,
        rowCount: 5,
        originalStructure: [{ type: 'header', content: 'Test Header' }],
        columnMapping: { nameColumn: 1, quantityColumn: 2, unitColumn: 3, headerRow: 1 },
        detectedHeaders: ['L.p.', 'Name', 'Quantity', 'Unit']
      }
    });
    console.log('✅ ExcelFile created successfully:', testFile.id);
    
    // Test creating ExcelRow records
    console.log('Testing ExcelRow creation...');
    const testRows = await db.excelRow.createMany({
      data: [
        {
          id: uuidv4(),
          name: 'Test Item 1',
          quantity: 10,
          unit: 'kg',
          originalRowIndex: 1,
          fileId: testFile.id
        },
        {
          id: uuidv4(),
          name: 'Test Item 2',
          quantity: 5,
          unit: 'l',
          originalRowIndex: 2,
          fileId: testFile.id
        }
      ],
      skipDuplicates: true
    });
    console.log('✅ ExcelRows created successfully:', testRows);
    
    // Test creating AggregatedItem records
    console.log('Testing AggregatedItem creation...');
    const testAggregated = await db.aggregatedItem.create({
      data: {
        id: uuidv4(),
        name: 'Test Aggregated Item',
        quantity: 15,
        unit: 'kg',
        sourceFiles: [testFile.id],
        count: 1
      }
    });
    console.log('✅ AggregatedItem created successfully:', testAggregated.id);
    
    // Clean up test data
    console.log('Cleaning up test data...');
    await db.aggregatedItem.deleteMany({
      where: {
        id: testAggregated.id
      }
    });
    
    await db.excelRow.deleteMany({
      where: {
        fileId: testFile.id
      }
    });
    
    await db.excelFile.delete({
      where: {
        id: testFile.id
      }
    });
    
    console.log('✅ Test data cleaned up successfully');
    
    await db.$disconnect();
    console.log('✅ Database disconnected successfully');
    
    console.log('\n🎉 All Excel upload operations completed successfully!');
  } catch (error) {
    console.error('❌ Excel upload test failed:');
    console.error('Error:', error);
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    process.exit(1);
  }
}

testExcelUpload();