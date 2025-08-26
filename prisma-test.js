const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
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
    
    // Test a simple query
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('✅ Simple query executed successfully:', result);
    
    await db.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database connection test failed:');
    console.error('Error:', error);
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    process.exit(1);
  }
}

testConnection();