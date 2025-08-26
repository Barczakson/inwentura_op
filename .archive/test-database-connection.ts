// Simple database connection test
import { db } from '@/lib/db-config';

async function testDatabaseConnection() {
  try {
    // Try to connect to the database
    await db.$connect();
    console.log('Database connection successful');
    
    // Try a simple query
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('Database query successful:', result);
    
    // Disconnect from the database
    await db.$disconnect();
    console.log('Database disconnection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

// Run the test
testDatabaseConnection();