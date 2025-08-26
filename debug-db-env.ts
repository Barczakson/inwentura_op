import { PrismaClient } from '@prisma/client'

// Check environment variables
console.log('Environment variables:')
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
console.log('DIRECT_URL exists:', !!process.env.DIRECT_URL)

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL starts with postgres:', process.env.DATABASE_URL.startsWith('postgres'))
  console.log('DATABASE_URL length:', process.env.DATABASE_URL.length)
  
  // Check if it contains placeholder values
  if (process.env.DATABASE_URL.includes('YOUR_PASSWORD') || 
      process.env.DATABASE_URL.includes('YOUR_PROJECT_REF')) {
    console.log('❌ DATABASE_URL contains placeholder values')
  } else {
    console.log('✅ DATABASE_URL appears to have real values')
  }
}

// Try to create Prisma client
try {
  console.log('Creating Prisma client...')
  const db = new PrismaClient({
    log: ['query', 'info', 'warn', 'error']
  })
  console.log('✅ Prisma client created successfully')
} catch (error) {
  console.log('❌ Failed to create Prisma client:')
  console.log('Error:', error)
  
  if (error instanceof Error) {
    console.log('Error message:', error.message)
    if (error.message.includes('DATABASE_URL')) {
      console.log('This suggests an issue with your DATABASE_URL environment variable')
    }
  }
}