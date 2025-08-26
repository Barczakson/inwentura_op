// Set environment variables programmatically for testing
process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/excel_inventory_dev?sslmode=prefer"
process.env.DIRECT_URL = "postgresql://postgres:password@localhost:5432/excel_inventory_dev?sslmode=prefer"

console.log('Testing with updated environment variables:')
console.log('DATABASE_URL:', process.env.DATABASE_URL)
console.log('DIRECT_URL:', process.env.DIRECT_URL)

import { PrismaClient } from '@prisma/client'

async function testConnection() {
  try {
    console.log('Creating Prisma client with updated environment variables...')
    const db = new PrismaClient({
      log: ['query', 'info', 'warn', 'error']
    })
    
    console.log('Attempting to connect to database...')
    await db.$connect()
    console.log('✅ Database connected successfully')
    
    // Test a simple query
    console.log('Testing simple query...')
    const result = await db.$queryRaw`SELECT 1 as test`
    console.log('✅ Simple query executed successfully:', result)
    
    await db.$disconnect()
    console.log('✅ Database disconnected successfully')
  } catch (error) {
    console.log('❌ Database connection test failed:')
    console.log('Error:', error)
    
    if (error instanceof Error) {
      console.log('Error message:', error.message)
      if (error.message.includes('connect')) {
        console.log('This suggests the database server is not running or not accessible')
      }
    }
  }
}

testConnection()