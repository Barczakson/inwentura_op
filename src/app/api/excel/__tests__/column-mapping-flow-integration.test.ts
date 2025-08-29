/**
 * Column Mapping Flow Integration Tests
 * 
 * Comprehensive integration tests for the column mapping workflow including:
 * - Automatic column detection and suggestions
 * - Manual mapping creation and validation
 * - Mapping usage tracking and persistence
 * - Integration with Excel upload and processing
 * - Real database operations and cleanup
 */

import { GET, POST, PUT, DELETE } from '../column-mapping/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db-config';
import { detectColumns, validateMapping, createDefaultMapping } from '@/lib/column-detection';

describe('Column Mapping Flow Integration Tests', () => {
  let testMappingIds: string[] = [];
  
  const createRequest = (
    url: string = 'http://localhost:3000/api/excel/column-mapping',
    method: string = 'GET',
    body?: any
  ): NextRequest => {
    return new NextRequest(url, {
      method,
      ...(body && {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })
    });
  };

  afterEach(async () => {
    // Cleanup test mappings
    for (const id of testMappingIds) {
      try {
        await db.columnMapping.delete({ where: { id } });
      } catch (error) {
        console.warn('Cleanup failed for mapping:', id, error);
      }
    }
    testMappingIds = [];
  });

  describe('Column Detection and Automatic Mapping', () => {
    it('should detect columns from standard Excel headers', async () => {
      const headers = ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'];
      const sampleData = [
        [1, 'RAW001', 'Mąka pszenna', 100, 'kg'],
        [2, 'RAW002', 'Cukier biały', 50, 'kg']
      ];

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'detect',
        headers,
        sampleData
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.detection).toBeDefined();
      expect(responseData.suggestions).toBeDefined();

      // Verify detection results
      expect(responseData.detection.confidence).toBeGreaterThan(0.7);
      expect(responseData.detection.mapping).toBeDefined();
      expect(responseData.detection.mapping.nameColumn).toBeDefined();
      expect(responseData.detection.mapping.quantityColumn).toBeDefined();
      expect(responseData.detection.mapping.unitColumn).toBeDefined();

      // Verify suggestions are provided
      expect(responseData.suggestions).toBeDefined();
      expect(Array.isArray(responseData.suggestions.possibleMappings)).toBe(true);
    });

    it('should provide fallback suggestions when detection fails', async () => {
      const headers = ['Col1', 'Col2', 'Col3', 'Col4', 'Col5'];
      const sampleData = [
        ['data1', 'data2', 'data3', 'data4', 'data5']
      ];

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'detect',
        headers,
        sampleData
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      
      // When detection fails, should still provide suggestions
      expect(responseData.suggestions).toBeDefined();
      expect(responseData.headers).toEqual(headers);
      expect(responseData.sampleData).toBeDefined();
    });

    it('should handle various header formats and patterns', async () => {
      const testCases = [
        {
          name: 'Polish headers',
          headers: ['Lp', 'Kod', 'Nazwa', 'Ilosc', 'Jednostka'],
          expected: { nameColumn: 2, quantityColumn: 3, unitColumn: 4 }
        },
        {
          name: 'English headers',
          headers: ['No', 'Code', 'Name', 'Quantity', 'Unit'],
          expected: { nameColumn: 2, quantityColumn: 3, unitColumn: 4 }
        },
        {
          name: 'Mixed case headers',
          headers: ['nr', 'KOD_TOWARU', 'nazwa towaru', 'ILOŚĆ', 'jm'],
          expected: { nameColumn: 2, quantityColumn: 3, unitColumn: 4 }
        }
      ];

      for (const testCase of testCases) {
        const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
          action: 'detect',
          headers: testCase.headers,
          sampleData: []
        });

        const response = await POST(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.suggestions).toBeDefined();
        
        // Verify at least some column suggestions are made
        const suggestions = responseData.suggestions;
        expect(suggestions.possibleMappings.length).toBeGreaterThan(0);
      }
    });

    it('should validate headers array requirement for detection', async () => {
      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'detect'
        // Missing headers
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Headers array is required for detection');
    });
  });

  describe('Manual Mapping Creation and Validation', () => {
    it('should save a valid column mapping configuration', async () => {
      const mapping = {
        nameColumn: 2,
        quantityColumn: 3,
        unitColumn: 4,
        itemIdColumn: 1,
        headerRow: 0
      };

      const headers = ['L.p.', 'Nr indeksu', 'Nazwa towaru', 'Ilość', 'JMZ'];

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping,
        headers,
        name: 'Standard Inventory Mapping',
        description: 'Standard mapping for inventory Excel files'
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.mapping).toBeDefined();
      expect(responseData.mapping.id).toBeDefined();
      expect(responseData.mapping.name).toBe('Standard Inventory Mapping');
      expect(responseData.validation.isValid).toBe(true);

      testMappingIds.push(responseData.mapping.id);

      // Verify database persistence
      const savedMapping = await db.columnMapping.findUnique({
        where: { id: responseData.mapping.id }
      });

      expect(savedMapping).toBeTruthy();
      expect(savedMapping!.mapping).toEqual(mapping);
      expect(savedMapping!.headers).toEqual(headers);
      expect(savedMapping!.isDefault).toBe(false);
    });

    it('should reject invalid mapping configurations', async () => {
      const invalidMapping = {
        nameColumn: -1, // Invalid column index
        quantityColumn: 100, // Column doesn't exist
        unitColumn: 'invalid', // Should be number
      };

      const headers = ['Col1', 'Col2', 'Col3'];

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping: invalidMapping,
        headers,
        name: 'Invalid Mapping'
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid mapping');
      expect(responseData.details).toBeDefined();
      expect(Array.isArray(responseData.details)).toBe(true);
    });

    it('should require mapping configuration and name for saving', async () => {
      const requestWithoutMapping = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        name: 'Test Mapping'
        // Missing mapping
      });

      const response1 = await POST(requestWithoutMapping);
      const responseData1 = await response1.json();

      expect(response1.status).toBe(400);
      expect(responseData1.error).toBe('Mapping configuration and name are required');

      const requestWithoutName = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 }
        // Missing name
      });

      const response2 = await POST(requestWithoutName);
      const responseData2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(responseData2.error).toBe('Mapping configuration and name are required');
    });

    it('should handle complex mapping configurations', async () => {
      const complexMapping = {
        nameColumn: 2,
        quantityColumn: 3,
        unitColumn: 4,
        itemIdColumn: 1,
        categoryColumn: 5,
        priceColumn: 6,
        headerRow: 1, // Headers in second row
        skipRows: [0], // Skip first row
        customFields: {
          supplierColumn: 7,
          locationColumn: 8
        }
      };

      const headers = ['Skip', 'L.p.', 'Nr indeksu', 'Nazwa', 'Ilość', 'JMZ', 'Kategoria', 'Cena', 'Dostawca', 'Lokalizacja'];

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping: complexMapping,
        headers,
        name: 'Complex Inventory Mapping',
        description: 'Advanced mapping with custom fields and row skipping'
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.mapping.mapping).toEqual(complexMapping);

      testMappingIds.push(responseData.mapping.id);
    });
  });

  describe('Mapping Retrieval and Management', () => {
    it('should retrieve all saved mappings ordered correctly', async () => {
      // Create test mappings with different properties
      const mapping1 = await db.columnMapping.create({
        data: {
          name: 'Default Test Mapping',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          isDefault: true,
          usageCount: 10
        }
      });

      const mapping2 = await db.columnMapping.create({
        data: {
          name: 'Popular Mapping',
          mapping: { nameColumn: 1, quantityColumn: 2, unitColumn: 3 },
          isDefault: false,
          usageCount: 20,
          lastUsed: new Date('2024-01-01')
        }
      });

      const mapping3 = await db.columnMapping.create({
        data: {
          name: 'Recent Mapping',
          mapping: { nameColumn: 2, quantityColumn: 3, unitColumn: 4 },
          isDefault: false,
          usageCount: 5,
          lastUsed: new Date('2024-02-01')
        }
      });

      testMappingIds.push(mapping1.id, mapping2.id, mapping3.id);

      const request = createRequest();
      const response = await GET(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.mappings).toBeDefined();
      expect(Array.isArray(responseData.mappings)).toBe(true);
      expect(responseData.mappings.length).toBeGreaterThanOrEqual(3);

      // Verify ordering: default first, then by usage count, then by lastUsed
      const defaultMappings = responseData.mappings.filter((m: any) => m.isDefault);
      expect(defaultMappings.length).toBeGreaterThan(0);
      expect(defaultMappings[0].name).toBe('Default Test Mapping');
    });

    it('should track mapping usage correctly', async () => {
      // Create a test mapping
      const mapping = await db.columnMapping.create({
        data: {
          name: 'Usage Tracking Test',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          usageCount: 0
        }
      });

      testMappingIds.push(mapping.id);

      // Use the mapping
      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
        id: mapping.id,
        action: 'use'
      });

      const response = await PUT(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.mapping.usageCount).toBe(1);
      expect(responseData.mapping.lastUsed).toBeDefined();

      // Verify database was updated
      const updatedMapping = await db.columnMapping.findUnique({
        where: { id: mapping.id }
      });

      expect(updatedMapping!.usageCount).toBe(1);
      expect(updatedMapping!.lastUsed).toBeTruthy();
    });

    it('should update mapping configuration', async () => {
      // Create a test mapping
      const mapping = await db.columnMapping.create({
        data: {
          name: 'Original Name',
          description: 'Original description',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 }
        }
      });

      testMappingIds.push(mapping.id);

      // Update the mapping
      const newMapping = { nameColumn: 1, quantityColumn: 2, unitColumn: 3 };
      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
        id: mapping.id,
        action: 'update',
        mapping: newMapping,
        name: 'Updated Name',
        description: 'Updated description'
      });

      const response = await PUT(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.mapping.name).toBe('Updated Name');
      expect(responseData.mapping.description).toBe('Updated description');
      expect(responseData.mapping.mapping).toEqual(newMapping);

      // Verify database was updated
      const updatedMapping = await db.columnMapping.findUnique({
        where: { id: mapping.id }
      });

      expect(updatedMapping!.name).toBe('Updated Name');
      expect(updatedMapping!.mapping).toEqual(newMapping);
    });

    it('should delete non-default mappings', async () => {
      // Create a non-default mapping
      const mapping = await db.columnMapping.create({
        data: {
          name: 'Deletable Mapping',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          isDefault: false
        }
      });

      const request = createRequest(`http://localhost:3000/api/excel/column-mapping?id=${mapping.id}`, 'DELETE');
      const response = await DELETE(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      // Verify mapping was deleted
      const deletedMapping = await db.columnMapping.findUnique({
        where: { id: mapping.id }
      });

      expect(deletedMapping).toBeNull();
    });

    it('should prevent deletion of default mappings', async () => {
      // Create a default mapping
      const mapping = await db.columnMapping.create({
        data: {
          name: 'Protected Default Mapping',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 },
          isDefault: true
        }
      });

      testMappingIds.push(mapping.id);

      const request = createRequest(`http://localhost:3000/api/excel/column-mapping?id=${mapping.id}`, 'DELETE');
      const response = await DELETE(request);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Cannot delete default mapping');

      // Verify mapping still exists
      const existingMapping = await db.columnMapping.findUnique({
        where: { id: mapping.id }
      });

      expect(existingMapping).toBeTruthy();
    });
  });

  describe('Integration with Excel Upload Workflow', () => {
    it('should integrate column mapping with Excel upload process', async () => {
      // First, create a column mapping
      const mapping = {
        nameColumn: 2,
        quantityColumn: 3,
        unitColumn: 4,
        itemIdColumn: 1,
        headerRow: 1
      };

      const saveRequest = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping,
        name: 'Integration Test Mapping',
        description: 'Mapping for integration testing'
      });

      const saveResponse = await POST(saveRequest);
      const saveData = await saveResponse.json();

      expect(saveResponse.status).toBe(200);
      testMappingIds.push(saveData.mapping.id);

      // Now test that the mapping can be retrieved and used
      const getRequest = createRequest();
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      const createdMapping = getData.mappings.find((m: any) => m.id === saveData.mapping.id);
      expect(createdMapping).toBeTruthy();
      expect(createdMapping.mapping).toEqual(mapping);

      // Track usage as would happen during Excel upload
      const useRequest = createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
        id: saveData.mapping.id,
        action: 'use'
      });

      const useResponse = await PUT(useRequest);
      const useData = await useResponse.json();

      expect(useResponse.status).toBe(200);
      expect(useData.mapping.usageCount).toBe(1);
    });

    it('should handle concurrent mapping operations', async () => {
      const concurrentOperations = 5;
      const operations: Promise<Response>[] = [];

      // Create multiple mappings concurrently
      for (let i = 0; i < concurrentOperations; i++) {
        const mapping = {
          nameColumn: i,
          quantityColumn: i + 1,
          unitColumn: i + 2
        };

        const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
          action: 'save',
          mapping,
          name: `Concurrent Mapping ${i}`,
          description: `Mapping created concurrently #${i}`
        });

        operations.push(POST(request));
      }

      // Execute all operations
      const responses = await Promise.all(operations);
      const responseData = await Promise.all(
        responses.map(response => response.json())
      );

      // Verify all operations succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(responseData[index].success).toBe(true);
        expect(responseData[index].mapping.id).toBeDefined();
        
        testMappingIds.push(responseData[index].mapping.id);
      });

      // Verify all mappings were created with unique IDs
      const createdIds = responseData.map(data => data.mapping.id);
      const uniqueIds = new Set(createdIds);
      expect(uniqueIds.size).toBe(concurrentOperations);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid action parameters', async () => {
      const invalidActions = ['invalid', 'unknown', '', null, undefined];

      for (const action of invalidActions) {
        const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
          action,
          headers: ['Col1', 'Col2']
        });

        const response = await POST(request);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.error).toContain('Invalid action');
      }
    });

    it('should handle missing required parameters gracefully', async () => {
      const testCases = [
        {
          description: 'missing ID for PUT request',
          request: createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
            action: 'use'
          }),
          expectedStatus: 400,
          expectedError: 'Mapping ID is required'
        },
        {
          description: 'missing ID for DELETE request',
          request: createRequest('http://localhost:3000/api/excel/column-mapping', 'DELETE'),
          expectedStatus: 400,
          expectedError: 'Mapping ID is required'
        }
      ];

      for (const testCase of testCases) {
        let response: Response;
        
        if (testCase.request.method === 'PUT') {
          response = await PUT(testCase.request);
        } else if (testCase.request.method === 'DELETE') {
          response = await DELETE(testCase.request);
        } else {
          response = await POST(testCase.request);
        }

        const responseData = await response.json();

        expect(response.status).toBe(testCase.expectedStatus);
        expect(responseData.error).toBe(testCase.expectedError);
      }
    });

    it('should handle non-existent mapping IDs', async () => {
      const nonExistentId = 'non-existent-mapping-id';

      // Test PUT with non-existent ID
      const putRequest = createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
        id: nonExistentId,
        action: 'use'
      });

      const putResponse = await PUT(putRequest);
      expect(putResponse.status).toBe(500); // Database error

      // Test DELETE with non-existent ID
      const deleteRequest = createRequest(`http://localhost:3000/api/excel/column-mapping?id=${nonExistentId}`, 'DELETE');
      const deleteResponse = await DELETE(deleteRequest);
      const deleteData = await deleteResponse.json();

      expect(deleteResponse.status).toBe(404);
      expect(deleteData.error).toBe('Mapping not found');
    });

    it('should include performance metrics in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const request = createRequest();
        const response = await GET(request);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.performance).toBeDefined();
        expect(responseData.performance.totalTime).toBeGreaterThan(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should validate mapping updates properly', async () => {
      // Create a test mapping
      const mapping = await db.columnMapping.create({
        data: {
          name: 'Validation Test',
          mapping: { nameColumn: 0, quantityColumn: 1, unitColumn: 2 }
        }
      });

      testMappingIds.push(mapping.id);

      // Try to update with invalid mapping
      const invalidMapping = {
        nameColumn: -1,
        quantityColumn: 'invalid',
        unitColumn: null
      };

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'PUT', {
        id: mapping.id,
        action: 'update',
        mapping: invalidMapping
      });

      const response = await PUT(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid mapping');
      expect(responseData.details).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large mapping configurations efficiently', async () => {
      const largeMapping = {
        nameColumn: 10,
        quantityColumn: 11,
        unitColumn: 12,
        itemIdColumn: 0
      };

      // Add many custom field mappings
      for (let i = 0; i < 100; i++) {
        largeMapping[`customField${i}`] = i + 20;
      }

      const largeHeaders = Array.from({ length: 200 }, (_, i) => `Column${i}`);

      const startTime = Date.now();

      const request = createRequest('http://localhost:3000/api/excel/column-mapping', 'POST', {
        action: 'save',
        mapping: largeMapping,
        headers: largeHeaders,
        name: 'Large Mapping Configuration',
        description: 'Mapping with many custom fields'
      });

      const response = await POST(request);
      const endTime = Date.now();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      testMappingIds.push(responseData.mapping.id);

      // Should handle large configurations quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify the large mapping was saved correctly
      const savedMapping = await db.columnMapping.findUnique({
        where: { id: responseData.mapping.id }
      });

      expect(savedMapping!.mapping).toEqual(largeMapping);
      expect(savedMapping!.headers).toEqual(largeHeaders);
    });

    it('should efficiently retrieve and filter large numbers of mappings', async () => {
      const mappingCount = 50;
      const createdMappings: string[] = [];

      // Create many test mappings
      for (let i = 0; i < mappingCount; i++) {
        const mapping = await db.columnMapping.create({
          data: {
            name: `Performance Test Mapping ${i}`,
            mapping: { nameColumn: i % 5, quantityColumn: (i + 1) % 5, unitColumn: (i + 2) % 5 },
            usageCount: Math.floor(Math.random() * 100),
            lastUsed: new Date(Date.now() - Math.random() * 86400000 * 30) // Random date within 30 days
          }
        });
        createdMappings.push(mapping.id);
      }

      testMappingIds.push(...createdMappings);

      const startTime = Date.now();
      const request = createRequest();
      const response = await GET(request);
      const endTime = Date.now();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.mappings.length).toBeGreaterThanOrEqual(mappingCount);

      // Should retrieve and order many mappings quickly (under 500ms)
      expect(endTime - startTime).toBeLessThan(500);

      // Verify ordering is maintained (default first, then usage count desc, then lastUsed desc)
      const mappings = responseData.mappings;
      let lastWasDefault = true;
      let lastUsageCount = Number.MAX_SAFE_INTEGER;

      for (let i = 0; i < Math.min(10, mappings.length); i++) {
        const mapping = mappings[i];
        
        if (lastWasDefault && !mapping.isDefault) {
          lastWasDefault = false;
          lastUsageCount = mapping.usageCount;
        } else if (!lastWasDefault) {
          expect(mapping.usageCount).toBeLessThanOrEqual(lastUsageCount);
          if (mapping.usageCount < lastUsageCount) {
            lastUsageCount = mapping.usageCount;
          }
        }
      }
    });
  });
});