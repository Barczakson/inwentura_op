import { PrismaClient } from '@prisma/client'

// Global variable to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a standard Prisma client for now
// Prisma Accelerate can be added later if needed for connection pooling
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma