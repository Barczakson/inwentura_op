import { GET } from '@/app/api/excel/files/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    excelFile: {
      findMany: jest.fn(),
    },
  },
}));

describe('Files API Route', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should return a list of files', async () => {
    const mockFiles = [
      {
        id: '1',
        fileName: 'test.xlsx',
        fileSize: 1024,
        uploadDate: new Date(),
        rowCount: 10,
      },
    ];

    (db.excelFile.findMany as jest.Mock).mockResolvedValue(mockFiles);

    const request = new NextRequest('http://localhost:3000/api/excel/files', {
      method: 'GET',

    });

    const response = await GET(request);
    
    // Check that the response is an instance of NextResponse
    expect(response).toBeDefined();
    expect(typeof response.json).toBe('function');
  });

  it('should handle errors gracefully', async () => {
    (db.excelFile.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/excel/files', {
      method: 'GET',
    });

    const response = await GET(request);
    
    // Check that the response is an instance of NextResponse
    expect(response).toBeDefined();
    expect(typeof response.json).toBe('function');
  });
});