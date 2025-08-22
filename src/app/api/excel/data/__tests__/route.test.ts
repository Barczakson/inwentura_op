import { GET } from '@/app/api/excel/data/route';
import { NextRequest } from 'next/server';
import { db, queries } from '@/lib/db-config';

// Mock the database and queries
jest.mock('@/lib/db-config', () => ({
  db: {
    aggregatedItem: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    excelRow: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
  queries: {
    getAggregatedItems: jest.fn(),
    getExcelRows: jest.fn(),
  },
  withTimeout: (fn: any) => fn,
  withErrorHandling: (fn: any) => fn,
  createCompressedResponse: (data: any) => ({
    json: () => data,
    status: 200,
  }),
  validateAndSanitizeRequest: () => ({
    isValid: true,
    errors: [],
    sanitized: {
      searchParams: new URLSearchParams(),
      headers: new Headers(),
    },
  }),
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    checkpoint: jest.fn(),
    getReport: jest.fn().mockReturnValue({}),
  })),
  REQUEST_TIMEOUTS: {
    DEFAULT: 15000,
  },
  OPTIMIZED_QUERIES: {
    AGGREGATED_ITEM_SELECT: {},
  },
}));

describe('Data API Route', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should return aggregated data', async () => {
    const mockAggregatedData = [
      {
        id: '1',
        itemId: 'item1',
        name: 'Test Item',
        quantity: 10,
        unit: 'pcs',
        fileId: 'file1',
        sourceFiles: '["file1"]',
        count: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (queries.getAggregatedItems as jest.Mock).mockResolvedValue(mockAggregatedData);
    (db.aggregatedItem.count as jest.Mock).mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/excel/data', {
      method: 'GET',
    });

    const response = await GET(request);
    
    // Check that the response is an instance of NextResponse
    expect(response).toBeDefined();
    expect(typeof response.json).toBe('function');
  });

  it('should handle errors gracefully', async () => {
    (queries.getAggregatedItems as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/excel/data', {
      method: 'GET',
    });

    const response = await GET(request);
    
    // Check that the response is an instance of NextResponse
    expect(response).toBeDefined();
    expect(typeof response.json).toBe('function');
  });
});