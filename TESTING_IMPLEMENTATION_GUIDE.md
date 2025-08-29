# Testing Implementation Guide

**Date**: August 28, 2025  
**Version**: 1.0  
**Project**: Inwentura Operations Excel Manager  
**Stack**: TypeScript, Next.js 15, Socket.IO, XLSX Processing, Vercel Deployment, Supabase/PostgreSQL Integration  

## Overview

This guide provides comprehensive instructions for implementing and maintaining the advanced test suite created for the Inwentura Operations application. The test suite addresses critical gaps identified in the research findings and follows 2025 best practices for testing TypeScript Next.js applications with real-time features.

## Table of Contents

1. [Prerequisites and Setup](#prerequisites-and-setup)
2. [Test Architecture Overview](#test-architecture-overview)
3. [Socket.IO Testing Infrastructure](#socketio-testing-infrastructure)
4. [Integration Testing](#integration-testing)
5. [Performance Testing](#performance-testing)
6. [Error Handling and Boundary Testing](#error-handling-and-boundary-testing)
7. [Running Tests](#running-tests)
8. [Continuous Integration](#continuous-integration)
9. [Maintenance and Extension](#maintenance-and-extension)
10. [Troubleshooting](#troubleshooting)

## Prerequisites and Setup

### System Requirements

- Node.js 18+ (recommended: 20+)
- npm or yarn
- PostgreSQL database (local or Supabase)
- 8GB+ RAM (recommended for large file processing tests)
- 2GB+ free disk space

### Development Environment Setup

```bash
# Install dependencies
npm install

# Install additional test dependencies (if not already present)
npm install -D @types/jest jest-environment-jsdom
npm install -D @testing-library/react @testing-library/user-event
npm install -D socket.io-client @types/socket.io-client

# Set up test database
cp .env.local .env.test.local
# Update DATABASE_URL in .env.test.local to point to test database

# Run database migrations for test environment
NODE_ENV=test npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Environment Variables for Testing

Create `.env.test.local`:

```env
# Test Database (use separate database for tests)
DATABASE_URL="postgresql://postgres:password@localhost:5432/inwentura_test?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/inwentura_test?schema=public"

# Test mode flag
NODE_ENV=test

# Optional: Reduce timeouts for faster tests
TEST_TIMEOUT=10000
```

## Test Architecture Overview

### Directory Structure

```
src/
├── __mocks__/                          # Global mocks
│   ├── socket.io-client.ts            # Socket.IO client mock
│   ├── socket.io.ts                   # Socket.IO server mock
│   └── prisma.ts                      # Existing Prisma mock
├── test-utils/                         # Test utilities
│   ├── socket-test-helpers.ts          # Socket.IO test utilities
│   └── __tests__/
│       └── socket-test-helpers.test.ts # Tests for test utilities
├── lib/__tests__/                      # Library tests
│   ├── socket-integration.test.ts      # Socket.IO integration
│   ├── socket-client.test.ts          # Client-side Socket.IO
│   ├── enhanced-supabase-integration.test.ts # Database integration
│   └── performance/
│       └── large-file-processing.test.ts # Performance tests
├── components/__tests__/               # Component tests
│   ├── socket-realtime-component.test.tsx # Real-time components
│   └── error-boundary.test.tsx        # Error handling
└── app/api/excel/__tests__/           # API route tests
    ├── upload-workflow-integration.test.ts
    └── column-mapping-flow-integration.test.ts
```

### Test Categories

1. **Unit Tests**: Individual component and function testing
2. **Integration Tests**: Database operations, API workflows, component integration
3. **Socket.IO Tests**: Real-time functionality, client-server communication
4. **Performance Tests**: Large file processing, memory usage, concurrent operations
5. **Error Boundary Tests**: Error handling, recovery scenarios
6. **End-to-End Tests**: Complete user workflows (planned for future implementation)

## Socket.IO Testing Infrastructure

### Mock Architecture

The Socket.IO testing infrastructure provides comprehensive mocking for both client and server-side functionality:

#### Client Mock (`__mocks__/socket.io-client.ts`)

- **Event Management**: Tracks all emitted and received events
- **Connection Simulation**: Simulates connection/disconnection cycles
- **Real-time Event Triggering**: Allows manual event triggering for testing
- **Performance Monitoring**: Tracks event frequency and timing

#### Server Mock (`__mocks__/socket.io.ts`)

- **Connection Management**: Simulates multiple client connections
- **Event Broadcasting**: Supports room-based and global broadcasting
- **Socket Lifecycle**: Complete socket connection lifecycle simulation
- **Performance Metrics**: Connection counts, event statistics

### Usage Examples

#### Basic Socket.IO Test

```typescript
import { SocketTestManager } from '@/test-utils/socket-test-helpers';

describe('Socket.IO Feature', () => {
  let manager: SocketTestManager;

  beforeEach(async () => {
    manager = new SocketTestManager();
    const { port } = await manager.setup();
  });

  afterEach(async () => {
    await manager.teardown();
  });

  it('should handle message exchange', async () => {
    const client = await manager.createClient(port);
    
    client.emit('message', { text: 'Hello', senderId: 'test' });
    
    const response = await client.waitForEvent('message', 2000);
    expect(response.data.text).toContain('Echo: Hello');
  });
});
```

#### Advanced Real-time Component Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { triggerSocketEvent } from '../../../__mocks__/socket.io-client';

it('should update UI on real-time events', async () => {
  render(<RealtimeComponent />);
  
  // Simulate server event
  triggerSocketEvent('upload-progress', { 
    progress: 50, 
    fileName: 'test.xlsx' 
  });
  
  await waitFor(() => {
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });
});
```

### Advanced Socket.IO Testing Scenarios

#### Load Testing

```typescript
import { SocketTestScenarios } from '@/test-utils/socket-test-helpers';

it('should handle concurrent connections', async () => {
  const result = await SocketTestScenarios.loadTest(server, 50, 100);
  
  expect(result.success).toBe(true);
  expect(result.stats.averageResponseTime).toBeLessThan(100);
});
```

#### Real-time Data Synchronization

```typescript
it('should synchronize data across clients', async () => {
  const clients = await manager.createMultipleClients(port, 3);
  
  const syncData = {
    type: 'DATA_UPDATE',
    table: 'excel_files',
    data: { id: 'test-id', fileName: 'sync-test.xlsx' }
  };
  
  clients[0].emit('data-sync', syncData);
  
  // All clients should receive the sync event
  for (const client of clients) {
    await client.waitForEvent('data-sync', 2000);
  }
});
```

## Integration Testing

### Database Integration Tests

The enhanced database integration tests simulate Supabase-like environments and test:

- **Connection pooling and performance**
- **Transaction handling and rollback scenarios**
- **Real-time data synchronization patterns**
- **Concurrent operations and data integrity**
- **Schema validation and foreign key relationships**

#### Running Database Tests

```bash
# Ensure test database is set up
NODE_ENV=test npx prisma migrate deploy

# Run database integration tests
npm run test:integration

# Run specific database test suite
npm test -- --testPathPattern="enhanced-supabase-integration"
```

#### Database Test Patterns

```typescript
describe('Database Integration', () => {
  let testFileIds: string[] = [];
  
  afterEach(async () => {
    // Cleanup test data
    for (const fileId of testFileIds) {
      await db.excelRow.deleteMany({ where: { fileId } });
      await db.excelFile.delete({ where: { id: fileId } });
    }
    testFileIds = [];
  });

  it('should handle complex transactions', async () => {
    await db.$transaction(async (tx) => {
      const file = await tx.excelFile.create({ data: { ... } });
      const rows = await tx.excelRow.createMany({ data: [...] });
      
      testFileIds.push(file.id);
    });
  });
});
```

### API Integration Tests

#### Excel Upload Workflow Tests

Tests cover the complete Excel upload pipeline:

1. **File validation** (size, type, structure)
2. **Data parsing and processing**
3. **Database storage with batch operations**
4. **Aggregation and optimization**
5. **Performance monitoring**
6. **Error handling and recovery**

#### Column Mapping Integration Tests

Tests for dynamic column detection and mapping:

1. **Automatic column detection**
2. **Manual mapping creation and validation**
3. **Mapping persistence and retrieval**
4. **Usage tracking and optimization**
5. **Concurrent mapping operations**

#### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific API integration tests
npm test -- --testPathPattern="upload-workflow-integration"
npm test -- --testPathPattern="column-mapping-flow-integration"

# Run with coverage
npm run test:coverage -- --testPathPattern="integration"
```

## Performance Testing

### Large File Processing Tests

The performance test suite evaluates:

- **Memory usage optimization** (large datasets up to 50,000 rows)
- **Processing time benchmarks**
- **Concurrent file processing**
- **Database batch operation performance**
- **Real-time progress updates under load**

#### Memory Monitoring

```typescript
const measureMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();
  return {
    heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100
  };
};

it('should process large files efficiently', async () => {
  const initialMemory = measureMemoryUsage();
  
  // Process large file
  const response = await processLargeFile(50000);
  
  const finalMemory = measureMemoryUsage();
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  
  expect(memoryIncrease).toBeLessThan(500); // Less than 500MB
});
```

#### Performance Benchmarks

- **Small files (1,000 rows)**: < 2 seconds processing
- **Medium files (10,000 rows)**: < 10 seconds processing
- **Large files (50,000 rows)**: < 60 seconds processing
- **Memory usage**: < 500MB increase per large file
- **Concurrent operations**: 5 files simultaneously

#### Running Performance Tests

```bash
# Run performance tests (requires more time and memory)
npm test -- --testPathPattern="large-file-processing" --testTimeout=120000

# Run with memory monitoring (if Node.js started with --expose-gc)
node --expose-gc node_modules/.bin/jest --testPathPattern="performance"

# Monitor memory during tests
npm test -- --testPathPattern="performance" --logHeapUsage
```

### Performance Test Configuration

```typescript
// jest.config.js - Performance test settings
module.exports = {
  testTimeout: 120000, // 2 minutes for performance tests
  maxWorkers: 1, // Ensure consistent memory measurements
  setupFilesAfterEnv: ['<rootDir>/jest.setup.performance.js']
};
```

## Error Handling and Boundary Testing

### React Error Boundaries

Comprehensive error boundary testing includes:

- **Component error catching and display**
- **Error recovery and retry mechanisms**
- **Custom fallback UI rendering**
- **Error reporting and logging**

### API Error Handling

Tests for various HTTP error scenarios:

- **404 Not Found**: Resource not available
- **500 Internal Server Error**: Server-side failures
- **429 Rate Limiting**: Too many requests
- **Network errors**: Connection failures
- **Timeout errors**: Request timeouts

### Form Validation Errors

- **Required field validation**
- **Format validation** (email, file types)
- **Size validation** (file sizes, text length)
- **Custom validation rules**
- **Server-side validation errors**

### Socket.IO Error Handling

- **Connection error recovery**
- **Automatic retry with exponential backoff**
- **Manual reconnection capabilities**
- **Error state management**

#### Running Error Tests

```bash
# Run error boundary tests
npm test -- --testPathPattern="error-boundary"

# Run all error handling tests
npm test -- --testPathPattern="error"

# Test error scenarios with verbose output
npm test -- --testPathPattern="error" --verbose
```

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:client     # Client-side tests only
npm run test:server     # Server-side tests only
npm run test:integration # Integration tests only
```

### Test Categories

```bash
# Socket.IO tests
npm test -- --testPathPattern="socket"

# Database integration tests
npm test -- --testPathPattern="supabase-integration"

# API workflow tests
npm test -- --testPathPattern="workflow-integration"

# Performance tests
npm test -- --testPathPattern="performance"

# Component tests
npm test -- --testPathPattern="components"

# Error handling tests
npm test -- --testPathPattern="error"
```

### Advanced Test Execution

```bash
# Run tests with specific configuration
npm test -- --config=jest.config.performance.js

# Run tests for specific files
npm test -- src/lib/__tests__/socket-integration.test.ts

# Run tests with debugging
npm test -- --runInBand --detectOpenHandles

# Run tests with custom timeout
npm test -- --testTimeout=30000

# Run tests with memory leak detection
npm test -- --logHeapUsage --detectLeaks
```

### Test Output and Reporting

```bash
# Generate coverage report
npm run test:coverage

# Generate detailed HTML coverage report
npm run test:coverage -- --coverage --coverageReporters=html

# Run tests with JUnit reporter (for CI)
npm test -- --reporters=default --reporters=jest-junit
```

## Continuous Integration

### GitHub Actions Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: inwentura_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/inwentura_test
        run: |
          npx prisma migrate deploy
          npx prisma generate

      - name: Run unit tests
        run: npm run test:client

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/inwentura_test
        run: npm run test:integration

      - name: Run performance tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/inwentura_test
        run: npm test -- --testPathPattern="performance" --testTimeout=300000

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
```

### Vercel Integration

For Vercel deployments, add test commands to `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install && npm run test:ci",
  "framework": "nextjs",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

Add CI-specific test script to `package.json`:

```json
{
  "scripts": {
    "test:ci": "jest --ci --coverage --watchAll=false --testTimeout=60000"
  }
}
```

## Maintenance and Extension

### Adding New Tests

#### 1. Socket.IO Feature Tests

When adding new Socket.IO features:

```typescript
// 1. Add to mock if needed (__mocks__/socket.io-client.ts)
// 2. Create test file
describe('New Socket.IO Feature', () => {
  let manager: SocketTestManager;

  beforeEach(async () => {
    manager = new SocketTestManager();
    await manager.setup();
  });

  afterEach(async () => {
    await manager.teardown();
  });

  it('should handle new feature', async () => {
    // Test implementation
  });
});
```

#### 2. Database Integration Tests

For new database features:

```typescript
describe('New Database Feature', () => {
  let testIds: string[] = [];

  afterEach(async () => {
    // Cleanup test data
    // Always clean up in reverse dependency order
  });

  it('should handle new database operation', async () => {
    // Test implementation
  });
});
```

#### 3. Component Tests

For new React components:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('NewComponent', () => {
  beforeEach(() => {
    clearMocks(); // Clear any global mocks
  });

  it('should render correctly', () => {
    render(<NewComponent />);
    expect(screen.getByRole('...').toBeInTheDocument();
  });
});
```

### Test Maintenance Best Practices

#### 1. Regular Updates

- **Monthly review** of test performance and reliability
- **Update test data** to reflect current business requirements
- **Review and update mocks** when dependencies change
- **Performance benchmark updates** as application scales

#### 2. Test Data Management

```typescript
// Create realistic test data generators
const createTestExcelData = (rowCount: number) => {
  return Array.from({ length: rowCount }, (_, i) => ({
    id: `TEST${i.toString().padStart(6, '0')}`,
    name: `Test Item ${i}`,
    quantity: Math.floor(Math.random() * 1000) + 1,
    unit: ['kg', 'szt', 'l', 'g'][i % 4]
  }));
};
```

#### 3. Mock Updates

When updating application code, ensure mocks stay synchronized:

```typescript
// Update Socket.IO mocks when adding new events
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  // Add new methods as needed
  newMethod: jest.fn()
};
```

#### 4. Performance Monitoring

Add performance monitoring to critical tests:

```typescript
it('should maintain performance standards', async () => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  // Test operation
  await performOperation();
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
  expect(endMemory - startMemory).toBeLessThan(MEMORY_THRESHOLD);
});
```

### Extending Test Utilities

#### Adding New Socket.IO Test Scenarios

```typescript
// src/test-utils/socket-test-helpers.ts
export class SocketTestScenarios {
  static async newScenarioTest(
    server: SocketTestServer, 
    clients: SocketTestClient[]
  ): Promise<boolean> {
    // Implementation
    return true;
  }
}
```

#### Custom Test Matchers

```typescript
// Add to test-utils or jest setup
expect.extend({
  toHaveProcessedFile(received, fileName) {
    const pass = received.some(file => file.fileName === fileName);
    return {
      pass,
      message: () => `Expected files to ${pass ? 'not ' : ''}include ${fileName}`
    };
  }
});
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Issues

**Problem**: Tests fail with database connection errors

**Solutions**:
```bash
# Check database is running
pg_isready -h localhost -p 5432

# Reset test database
NODE_ENV=test npx prisma migrate reset --force

# Check environment variables
echo $DATABASE_URL

# Run with connection debugging
DEBUG=prisma:client npm test
```

#### 2. Memory Issues in Performance Tests

**Problem**: Tests run out of memory or fail with large datasets

**Solutions**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=8192" npm test

# Run with garbage collection exposed
node --expose-gc node_modules/.bin/jest

# Run performance tests in isolation
npm test -- --testPathPattern="performance" --runInBand --maxWorkers=1
```

#### 3. Socket.IO Test Timeouts

**Problem**: Socket.IO tests timeout or hang

**Solutions**:
```typescript
// Increase test timeout
jest.setTimeout(30000);

// Ensure proper cleanup
afterEach(async () => {
  await socketManager.teardown();
  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Check for hanging connections
afterAll(async () => {
  // Force close any remaining connections
  await server.stop();
});
```

#### 4. Flaky Tests

**Problem**: Tests pass sometimes but fail other times

**Solutions**:
```typescript
// Add proper waits for async operations
await waitFor(() => {
  expect(condition).toBe(true);
}, { timeout: 5000 });

// Ensure proper test isolation
beforeEach(() => {
  jest.clearAllMocks();
  clearSocketEvents();
});

// Use deterministic test data
const testData = createDeterministicTestData();
```

#### 5. CI/CD Pipeline Issues

**Problem**: Tests pass locally but fail in CI

**Solutions**:

1. **Environment differences**:
   ```yaml
   # GitHub Actions - ensure consistent environment
   env:
     NODE_ENV: test
     DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
     CI: true
   ```

2. **Resource constraints**:
   ```yaml
   # Adjust timeouts for CI
   - name: Run tests
     run: npm test -- --testTimeout=60000 --maxWorkers=2
   ```

3. **Database issues**:
   ```yaml
   # Ensure database is ready
   - name: Wait for PostgreSQL
     run: |
       until pg_isready -h localhost -p 5432; do
         echo "Waiting for PostgreSQL..."
         sleep 2
       done
   ```

### Debugging Test Issues

#### 1. Enable Debug Modes

```bash
# Debug Prisma queries
DEBUG=prisma:query npm test

# Debug Jest execution
npm test -- --verbose --no-cache

# Debug Socket.IO tests
DEBUG=socket.io* npm test -- --testPathPattern="socket"
```

#### 2. Isolate Test Failures

```bash
# Run single test file
npm test -- src/path/to/specific.test.ts

# Run single test case
npm test -- --testNamePattern="specific test name"

# Run without parallel execution
npm test -- --runInBand
```

#### 3. Memory and Performance Debugging

```bash
# Monitor memory usage
npm test -- --logHeapUsage

# Detect memory leaks
npm test -- --detectLeaks

# Check for open handles
npm test -- --detectOpenHandles
```

### Getting Help

1. **Check existing issues** in the project repository
2. **Review test logs** for specific error messages
3. **Use verbose mode** to get detailed test execution information
4. **Isolate the problem** by running minimal test cases
5. **Check dependencies** are up to date and compatible

## Performance Benchmarks and Expectations

### Test Execution Times

- **Unit tests**: < 1 second each
- **Integration tests**: < 10 seconds each
- **Performance tests**: < 2 minutes each
- **Complete test suite**: < 5 minutes

### Resource Usage

- **Memory**: < 2GB peak usage during performance tests
- **CPU**: Tests should complete on 2-core systems
- **Disk**: < 1GB temporary files during large file tests

### Coverage Targets

- **Overall coverage**: > 85%
- **Critical paths**: > 95%
- **Socket.IO functionality**: 100%
- **API routes**: > 90%
- **Components**: > 80%

## Conclusion

This testing implementation provides a robust foundation for ensuring the reliability and performance of the Inwentura Operations application. The test suite addresses the critical gaps identified in the research findings and follows 2025 best practices for TypeScript Next.js applications with real-time features.

Key achievements:

1. **Complete Socket.IO testing infrastructure** with mock servers and clients
2. **Comprehensive integration tests** for database operations and API workflows
3. **Performance testing suite** for large file processing and concurrent operations
4. **Error handling and boundary testing** for robust error recovery
5. **Extensible test utilities** for future feature development
6. **CI/CD integration** for automated testing

Regular maintenance and updates to this test suite will ensure continued reliability as the application evolves. The testing infrastructure is designed to scale with the application and can be extended to support new features and requirements.

---

**Next Steps**:
1. Implement End-to-End testing with Playwright (future enhancement)
2. Add visual regression testing for UI components
3. Implement contract testing for API interfaces
4. Set up performance monitoring in production
5. Consider property-based testing for complex business logic

**Document Maintenance**: This guide should be updated whenever new test patterns are introduced or when testing infrastructure changes significantly.