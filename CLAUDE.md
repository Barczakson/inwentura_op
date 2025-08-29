# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Excel Inventory Manager - a comprehensive Next.js 15 application for uploading, processing, and managing Excel data with real-time features and cloud deployment capabilities. The application features intelligent Excel file processing, flexible column mapping, monthly inventory comparisons, and real-time WebSocket communication.

## Development Commands

### Primary Development
```bash
npm run dev          # Start development server with custom Node.js server + Socket.IO
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint code checking
```

### Testing Commands
```bash
npm test             # Run all tests
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
npm run test:column-mapping # Test column mapping functionality specifically
npm run test:api     # Run server/API tests only
npm run test:client  # Run client/React tests only
npm run test:integration # Integration tests
```

### Database Commands
```bash
npm run db:push      # Push schema to database (development)
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset development database
npm run db:studio    # Open Prisma Studio (database GUI)
npm run db:seed      # Seed database with test data
npm run db:deploy    # Deploy migrations to production
```

### Deployment Commands
```bash
npm run vercel-build # Vercel-specific build with database migrations
npm run db:migrate:deploy # Deploy database migrations to production
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui based on Radix UI
- **Backend**: Custom Node.js server integrating Next.js + Socket.IO
- **Database**: PostgreSQL (production) / SQLite (development) with Prisma ORM
- **Real-time**: Socket.IO for WebSocket communication
- **File Processing**: XLSX library for Excel file parsing
- **State Management**: TanStack Query + Zustand
- **Testing**: Jest with Testing Library, dual environments (jsdom/node)

### Key Features Architecture
- **Flexible Excel Upload**: Column mapping interface supporting various Excel structures
- **Data Aggregation**: Automatic grouping by (itemId, name, unit) with quantity summation
- **Monthly Comparison**: Dedicated `/comparison` page for analyzing inventory changes
- **Real-time Updates**: WebSocket integration for live data synchronization
- **Unit Conversion**: Smart display optimization (1000g → 1kg)

## Database Schema

The application uses Prisma with 6 main models:
- **ExcelFile**: Stores uploaded file metadata and column mappings
- **ExcelRow**: Raw Excel data with original structure preserved
- **AggregatedItem**: Processed inventory data with unique constraint on (itemId, name, unit)
- **ColumnMapping**: Saved column mapping configurations for reuse
- **User**: Basic user model (for future authentication)
- **Post**: Basic post model (legacy, can be removed)

### Database Environment
- **Development**: SQLite (`file:./prisma/dev.db`)
- **Production**: PostgreSQL with Supabase, optimized for Vercel with connection pooling

## Development Workflow

### Server Architecture
The application uses a custom Node.js server (`server.ts`) that combines:
- Next.js application handling
- Socket.IO server for real-time features
- Custom middleware for WebSocket integration

### Testing Structure
Jest is configured with two separate environments:
- **Client tests** (`jsdom`): Components, hooks, utilities
- **Server tests** (`node`): API routes, database integration

### Column Mapping System
The flexible Excel upload feature uses pattern-based auto-detection:
- **Item ID**: Patterns like "nr", "indeks", "id"
- **Name**: Patterns like "nazwa", "towar", "produkt", "item"
- **Quantity**: Numeric columns with headers containing "ilo", "quantity", "amount"
- **Unit**: Standard units like "kg", "g", "l", "ml", "szt"

## File Structure

```
src/
├── app/                     # Next.js App Router
│   ├── api/excel/          # Excel processing API routes
│   │   ├── upload/         # File upload endpoint
│   │   ├── data/           # CRUD operations
│   │   ├── export/         # Export functionality
│   │   └── column-mapping/ # Column mapping API
│   ├── comparison/         # Monthly comparison page
│   └── page.tsx            # Main upload/management page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── column-mapping.tsx  # Column mapping interface
│   ├── data-table.tsx      # Main data table with editing
│   ├── data-charts.tsx     # Data visualization
│   └── virtualized-data-table.tsx # Performance-optimized table
├── lib/
│   ├── db-config.ts        # Database configuration
│   ├── unit-conversion.ts  # Smart unit conversion logic
│   ├── column-detection.ts # Auto column type detection
│   └── socket.ts           # Socket.IO setup
└── hooks/                  # Custom React hooks
```

## Key Implementation Details

### Excel Processing Flow
1. File upload validation (type, size)
2. Excel parsing with XLSX library
3. Column mapping interface (auto-detection + manual adjustment)
4. Data validation and type conversion
5. Aggregation by (itemId, name, unit)
6. Database storage (both raw and aggregated)

### Real-time Features
- WebSocket server at `/api/socketio`
- Real-time data updates across clients
- Connection status monitoring
- Graceful reconnection handling

### Performance Considerations
- Virtual scrolling for large datasets (virtualized-data-table.tsx)
- Database indexing on key fields
- Connection pooling for serverless deployment
- Chunked data processing for large Excel files

## Environment Setup

### Development
Create `.env.local`:
```env
DATABASE_URL="file:./prisma/dev.db"
DIRECT_URL="file:./prisma/dev.db"
```

### Production (Vercel + Supabase)
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## Common Development Tasks

### Adding New API Endpoints
- Place in `src/app/api/` following Next.js App Router conventions
- Use server environment tests (`npm run test:api`)
- Follow existing error handling patterns

### Working with Database
- Always run `npm run db:generate` after schema changes
- Use `npm run db:studio` to inspect data visually
- Test migrations with `npm run db:push` before deployment

### Component Development
- Use shadcn/ui components as base (`@/components/ui/`)
- Follow existing patterns for data tables and forms
- Test with client environment (`npm run test:client`)

### Socket.IO Integration
- Server setup in `src/lib/socket.ts`
- Client usage examples in main page components
- Real-time updates follow established patterns

## Deployment Notes

### Vercel Deployment
- Uses `npm run vercel-build` which includes database migrations
- Requires Supabase PostgreSQL with connection pooling
- Environment variables must be set in Vercel dashboard

### Database Migrations
- Development: `npm run db:push` for schema changes
- Production: `npm run db:deploy` for migration deployment
- Always test migrations locally first

## Testing Guidelines

- Comprehensive test coverage for Excel processing logic
- Integration tests for database operations
- Component testing with Testing Library
- Separate test environments prevent cross-contamination
- Column mapping functionality has dedicated test suite