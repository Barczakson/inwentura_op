/**
 * Integration tests for aggregated data CRUD operations
 * @jest-environment node
 */

import { GET, PUT, DELETE } from '@/app/api/excel/data/route'
import { POST as manualPOST } from '@/app/api/excel/manual/route'
import { NextRequest } from 'next/server'

// Mock Prisma with realistic responses
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
        update: jest.fn().mockImplementation((data) => {
          const index = mockData.aggregated.findIndex(item => item.id === data.where.id)
          if (index >= 0) {
            mockData.aggregated[index] = { ...mockData.aggregated[index], ...data.data }
            return Promise.resolve(mockData.aggregated[index])
          }
          return Promise.reject(new Error('Item not found'))
        }),
        delete: jest.fn().mockImplementation((data) => {
          mockData.aggregated = mockData.aggregated.filter(item => item.id !== data.where.id)
          return Promise.resolve({ count: 1 })
        }),
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
      },
    },
  }
})

describe('Aggregated Data CRUD Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock data
    const prisma = require('@/lib/db').db
    prisma.aggregatedItem.findMany.mockClear()
    prisma.aggregatedItem.update.mockClear()
    prisma.aggregatedItem.delete.mockClear()
    prisma.aggregatedItem.upsert.mockClear()
    prisma.excelRow.findMany.mockClear()
    
    // Reset mock data array
    const mockData = require('@/lib/db').db.aggregatedItem.findMany.mock.results[0]?.value || []
    mockData.length = 0
  })

  it('should handle complete CRUD workflow for aggregated data', async () => {
    // Step 1: Add a manual entry
    const manualEntryRequest = new NextRequest('http://localhost:3000/api/excel/manual', {
      method: 'POST',
      body: JSON.stringify({
        itemId: 'A001',
        name: 'Test Product',
        quantity: 10,
        unit: 'kg',
      }),
    })

    const manualEntryResponse = await manualPOST(manualEntryRequest)
    expect(manualEntryResponse.status).toBe(200)

    const manualEntryData = await manualEntryResponse.json()
    expect(manualEntryData).toHaveProperty('id')
    expect(manualEntryData.name).toBe('Test Product')
    expect(manualEntryData.quantity).toBe(10)
    expect(manualEntryData.unit).toBe('kg')

    // Step 2: Retrieve the data
    const getResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(getResponse.status).toBe(200)

    const getData = await getResponse.json()
    expect(getData.aggregated).toHaveLength(1)
    expect(getData.aggregated[0].name).toBe('Test Product')
    expect(getData.aggregated[0].quantity).toBe(10)

    // Step 3: Update the item
    const updateRequest = new NextRequest('http://localhost:3000/api/excel/data', {
      method: 'PUT',
      body: JSON.stringify({
        id: manualEntryData.id,
        quantity: 15,
      }),
    })

    const updateResponse = await PUT(updateRequest)
    expect(updateResponse.status).toBe(200)

    const updateData = await updateResponse.json()
    expect(updateData.quantity).toBe(15)

    // Step 4: Verify the update
    const verifyResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(verifyResponse.status).toBe(200)

    const verifyData = await verifyResponse.json()
    expect(verifyData.aggregated).toHaveLength(1)
    expect(verifyData.aggregated[0].quantity).toBe(15)

    // Step 5: Delete the item
    const deleteRequest = new NextRequest(`http://localhost:3000/api/excel/data?id=${manualEntryData.id}`)
    const deleteResponse = await DELETE(deleteRequest)
    expect(deleteResponse.status).toBe(200)

    const deleteData = await deleteResponse.json()
    expect(deleteData.success).toBe(true)

    // Step 6: Verify the deletion
    const finalResponse = await GET(new NextRequest('http://localhost:3000/api/excel/data'))
    expect(finalResponse.status).toBe(200)

    const finalData = await finalResponse.json()
    expect(finalData.aggregated).toHaveLength(0)
  })

  it('should handle adding multiple entries for the same item (aggregation)', async () => {
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

    const entry1Response = await manualPOST(entry1Request)
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

    const entry2Response = await manualPOST(entry2Request)
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

  it('should handle entries with different units separately', async () => {
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

    const kgEntryResponse = await manualPOST(kgEntryRequest)
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

    const gEntryResponse = await manualPOST(gEntryRequest)
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
})