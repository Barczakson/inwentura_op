const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/lib/socket.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  // Server-side tests (API routes) should use Node environment
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  // Configure different environments for different test types
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/components/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/src/hooks/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/src/lib/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/src/lib/__tests__/**/*.{js,jsx,ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      preset: 'ts-jest',
    },
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/app/api/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/src/app/api/**/__tests__/**/*.{js,jsx,ts,tsx}',
        '<rootDir>/src/lib/__tests__/integration/**/*.{js,jsx,ts,tsx}',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      preset: 'ts-jest',
    }
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)