```bash
# Development Commands
npm run dev              # Start development server with Socket.IO (REQUIRED - not next dev)
npm run build           # Build for production (includes Prisma generation)
npm run start           # Production server with Socket.IO
npm run lint            # Run ESLint

# Testing Commands
npm run test            # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:client     # Run client-side tests only
npm run test:api        # Run server-side API tests only
npm run test:integration # Run integration tests
npm test -- path/to/test/file.tsx  # Run single test file

# Database Commands
npm run db:push         # Push schema changes to Supabase
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run migrations locally
npm run db:studio       # Open Prisma Studio
npm run db:seed         # Seed database
npm run db:deploy       # Deploy migrations to production
```

## Code Style Guidelines

### Imports & Organization
- Use absolute imports: `@/components/ui/button`, `@/lib/utils`
- Group imports: external libraries first, then internal imports
- Keep import statements organized and alphabetized within groups

### TypeScript & Types
- Use type assertions sparingly; prefer type inference
- Interface names use PascalCase: `DataTableProps`
- Type names use PascalCase: `ClassValue`
- Use `type` for simple types, `interface` for object shapes

### Naming Conventions
- Components: PascalCase (`DataTable`, `EditItemDialog`)
- Functions: camelCase (`formatQuantityWithConversion`)
- Variables: camelCase (`searchParams`, `includeRaw`)
- Constants: UPPER_SNAKE_CASE when appropriate
- Files: kebab-case for page routes, PascalCase for components

### React/Next.js Patterns
- Use `'use client'` directive for client components
- Prefer functional components with hooks
- Use TypeScript interfaces for component props
- Keep components small and focused

### Error Handling
- Use try-catch blocks in API routes
- Provide meaningful error messages
- Use proper HTTP status codes
- Log errors for debugging but don't expose sensitive data

### Testing Patterns
- Use `describe` blocks for grouping tests
- Write descriptive test names with `it` or `test`
- Use `expect` with clear matchers
- Test both success and error cases
- Mock external dependencies appropriately