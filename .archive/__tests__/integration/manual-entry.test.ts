/**
 * Integration tests for manual entry functionality
 * @jest-environment node
 */

import { POST } from '@/app/api/excel/manual/route'
import { GET } from '@/app/api/excel/data/route'
import { NextRequest } from 'next/server'

// Mock Prisma
jest.mock('@/lib/db', () => {
  const mockData = {
    aggregated: [] as any[],
  }

  return {
    __esModule: true,
    db: {
      aggregatedItem: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(mockData.aggregated)),
        count: jest.fn().mockImplementation(() => Promise.resolve(mockData.aggregated.length)),
        upsert: jest.fn().mockImplementation((data) => {
          // Check if item exists
          const existingIndex = mockData.aggregated.findIndex(item => 
            item.itemId === data.where.itemId_name_unit.itemId &&
            item.name === data.where.itemId_name_unit.name &&
            item.unit === data.where.itemId_name_unit.unit
          )
          
          if (existingIndex >= 0) {
            // Update existing item
            mockData.aggregated[existingIndex] = {
              ...mockData.aggregated[existingIndex],
              quantity: mockData.aggregated[existingIndex].quantity + data.update.quantity.increment,
              count: (mockData.aggregated[existingIndex].count || 0) + 1
            }
            return Promise.resolve(mockData.aggregated[existingIndex])
          } else {
            // Create new item
            const newItem = {
              id: data.create.id || `item-${Date.now()}`,
              itemId: data.create.itemId,
              name: data.create.name,
              quantity: data.create.quantity,
              unit: data.create.unit,
              count: data.create.count || 1,
              sourceFiles: data.create.sourceFiles || '[]',
            }
            mockData.aggregated.push(newItem)
            return Promise.resolve(newItem)
          }
        }),
      },
      excelRow: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
        count: jest.fn().mockImplementation(() => Promise.resolve(0)),
      },
    },
  }
})

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}))

describe('Manual Entry Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock data
    const mockData = [] as any[]
    
    const prisma = require('@/lib/db').db
    prisma.aggregatedItem.findMany.mockImplementation(() => Promise.resolve(mockData))
    prisma.aggregatedItem.count.mockImplementation(() => Promise.resolve(mockData.length))
    prisma.aggregatedItem.upsert.mockImplementation((data) => {
      // Check if item exists
      const existingIndex = mockData.findIndex(item => 
        item.itemId === data.where.itemId_name_unit.itemId &&
        item.name === data.where.itemId_name_unit.name &&
        item.unit === data.where.itemId_name_unit.unit
      )
      
      if (existingIndex >= 0) {
        // Update existing item
        mockData[existingIndex] = {
          ...mockData[existingIndex],
          quantity: mockData[existingIndex].quantity + data.update.quantity.increment,
          count: (mockData[existingIndex].count || 1) + 1
        }
        return Promise.resolve(mockData[existingIndex])
      } else {
        // Create new item
        const newItem = {
          id: data.create.id || `item-${Date.now()}`,
          itemId: data.create.itemId,
          name: data.create.name,
          quantity: data.create.quantity,
          unit: data.create.unit,
          count: data.create.count || 1,
          sourceFiles: data.create.sourceFiles || '[]',
        }
        mockData.push(newItem)
        return Promise.resolve(newItem)
      }
    })
    
    prisma.excelRow.findMany.mockImplementation(() => Promise.resolve([]))
    prisma.excelRow.count.mockImplementation(() => Promise.resolve(0))
  })

  it('should add a manual entry and retrieve it', async () => {
    // Add manual entry
    const addRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
      }),
    })

    const addResponse = await POST(addRequest)
    expect(addResponse.status).toBe(200)

    const addData = await addResponse.json()
    expect(addData).toHaveProperty('id')
    expect(addData.itemId).toBe('A001')
    expect(addData.name).toBe('Test Product')
    expect(addData.quantity).toBe(10)
    expect(addData.unit).toBe('kg')
    expect(addData.count).toBe(1)
    expect(addData.sourceFiles).toEqual([])

    // Retrieve data to verify entry was added
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(1)
    expect(getData.aggregated[0].itemId).toBe('A001')
    expect(getData.aggregated[0].name).toBe('Test Product')
    expect(getData.aggregated[0].quantity).toBe(10)
    expect(getData.aggregated[0].unit).toBe('kg')
  })

  it('should aggregate multiple entries for the same item', async () => {
    // Add first entry
    const entry1Request = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
      }),
    })

    const entry1Response = await POST(entry1Request)
    expect(entry1Response.status).toBe(200)

    // Add second entry for the same item
    const entry2Request = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 5,
        unit: 'kg',
      }),
    })

    const entry2Response = await POST(entry2Request)
    expect(entry2Response.status).toBe(200)

    const entry2Data = await entry2Response.json()
    expect(entry2Data.quantity).toBe(15) // 10 + 5
    expect(entry2Data.count).toBe(2)

    // Verify final state
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(1)
    expect(getData.aggregated[0].quantity).toBe(15)
    expect(getData.aggregated[0].count).toBe(2)
  })

  it('should treat items with different units as separate entries', async () => {
    // Add entry with kg unit
    const kgEntryRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
      }),
    })

    const kgEntryResponse = await POST(kgEntryRequest)
    expect(kgEntryResponse.status).toBe(200)

    // Add entry with g unit (same item, different unit)
    const gEntryRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 500,
        unit: 'g',
      }),
    })

    const gEntryResponse = await POST(gEntryRequest)
    expect(gEntryResponse.status).toBe(200)

    // Verify both entries exist separately
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(2)

    const kgItem = getData.aggregated.find((item: any) => item.unit === 'kg')
    const gItem = getData.aggregated.find((item: any) => item.unit === 'g')

    expect(kgItem).toBeDefined()
    expect(kgItem.quantity).toBe(10)
    expect(gItem).toBeDefined()
    expect(gItem.quantity).toBe(500)
  })

  it('should handle entries without item ID', async () => {
    // Add entry without item ID
    const entryRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Product Without ID',
        quantity: 5,
        unit: 'l',
      }),
    })

    const entryResponse = await POST(entryRequest)
    expect(entryResponse.status).toBe(200)

    const entryData = await entryResponse.json()
    expect(entryData.itemId).toBeNull()
    expect(entryData.name).toBe('Product Without ID')
    expect(entryData.quantity).toBe(5)
    expect(entryData.unit).toBe('l')

    // Verify entry was added
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(1)
    expect(getData.aggregated[0].itemId).toBeNull()
    expect(getData.aggregated[0].name).toBe('Product Without ID')
    expect(getData.aggregated[0].quantity).toBe(5)
    expect(getData.aggregated[0].unit).toBe('l')
  })

  it('should normalize and clean input data', async () => {
    // Add entry with extra whitespace and mixed case
    const entryRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: ' A001 ', // Whitespace
        name: ' Test Product ', // Whitespace
        quantity: 10,
        unit: ' KG ', // Uppercase and whitespace
      }),
    })

    const entryResponse = await POST(entryRequest)
    expect(entryResponse.status).toBe(200)

    const entryData = await entryResponse.json()
    expect(entryData.itemId).toBe('A001') // Trimmed
    expect(entryData.name).toBe('Test Product') // Trimmed
    expect(entryData.unit).toBe('kg') // Lowercased

    // Verify entry was added with cleaned data
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(1)
    expect(getData.aggregated[0].itemId).toBe('A001')
    expect(getData.aggregated[0].name).toBe('Test Product')
    expect(getData.aggregated[0].unit).toBe('kg')
  })
})