import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

// Create a mock PrismaClient
export const prismaMock = mockDeep<PrismaClient>()

// Export a function to reset the mock between tests
export const resetPrismaMock = () => mockReset(prismaMock)

// Type for the mock
export type MockPrismaClient = DeepMockProxy<PrismaClient>