import { db } from '@/lib/db-config'

async function testConnection() {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    await db.$connect()
    console.log('✅ Database connected successfully')
    
    // Test a simple query
    const result = await db.$queryRaw`SELECT 1 as test`
    console.log('✅ Simple query executed successfully:', result)
    
    // Test ExcelFile model
    const count = await db.excelFile.count()
    console.log('✅ ExcelFile model accessible, count:', count)
    
    await db.$disconnect()
    console.log('✅ Database disconnected successfully')
  } catch (error) {
    console.error('❌ Database connection test failed:')
    console.error('Error:', error)
    
    if (error instanceof Error) {
      console.error('Message:', error.message)
      console.error('Stack:', error.stack)
    }
    
    process.exit(1)
  }
}

testConnection()