/**
 * Jest test setup and global configuration
 */

// Import Jest DOM matchers
import '@testing-library/jest-dom'

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Global test configuration
global.console = {
  ...console,
  // Uncomment to hide console logs during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Mock FormData if not available in test environment
if (!global.FormData) {
  global.FormData = class FormData {
    constructor() {
      this.data = new Map()
    }
    
    append(key, value) {
      this.data.set(key, value)
    }
    
    get(key) {
      return this.data.get(key)
    }
    
    has(key) {
      return this.data.has(key)
    }
    
    delete(key) {
      this.data.delete(key)
    }
    
    entries() {
      return this.data.entries()
    }
  }
}

// Mock File API if not available in test environment
if (!global.File) {
  global.File = class File {
    constructor(chunks, filename, options = {}) {
      this.name = filename
      this.size = chunks.reduce((acc, chunk) => acc + (chunk.length || 0), 0)
      this.type = options.type || ''
      this.lastModified = options.lastModified || Date.now()
      this.chunks = chunks
    }
    
    arrayBuffer() {
      return Promise.resolve(Buffer.concat(this.chunks))
    }
    
    text() {
      return Promise.resolve(Buffer.concat(this.chunks).toString())
    }
    
    stream() {
      return new ReadableStream({
        start(controller) {
          this.chunks.forEach(chunk => controller.enqueue(chunk))
          controller.close()
        }
      })
    }
  }
}

// Mock Blob API if not available
if (!global.Blob) {
  global.Blob = class Blob {
    constructor(chunks = [], options = {}) {
      this.size = chunks.reduce((acc, chunk) => acc + (chunk.length || 0), 0)
      this.type = options.type || ''
      this.chunks = chunks
    }
    
    arrayBuffer() {
      return Promise.resolve(Buffer.concat(this.chunks))
    }
    
    text() {
      return Promise.resolve(Buffer.concat(this.chunks).toString())
    }
  }
}

// Mock performance API if not available
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  }
}

// Increase timeout for longer running tests
jest.setTimeout(30000)

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})