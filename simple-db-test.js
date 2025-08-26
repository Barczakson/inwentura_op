const { db } = require('./src/lib/db-config');

async function testConnection() {
  try {
    console.log('Testing database connection...');
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
    
    process.exit(1);
  }
}

testConnection();