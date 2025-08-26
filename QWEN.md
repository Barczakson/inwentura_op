# Project Context for Qwen Code

This document provides essential context for Qwen Code to understand and assist with this project.

## Project Overview

This is a **production-ready Excel Data Manager** web application successfully deployed on Vercel with Supabase PostgreSQL. It's built with **Next.js 15** and **TypeScript 5**, using a modern stack including **shadcn/ui** components, **Prisma** ORM with **PostgreSQL**, and **Socket.IO** for real-time communication. The application processes Excel files, aggregates data intelligently, and provides real-time management capabilities.

**Core Purpose:**
- Upload and process Excel inventory files (.xlsx/.xls)
- Automatically aggregate items by ID, name, and unit
- Maintain original Excel structure for perfect export recreation
- Provide real-time collaborative data management
- Deploy seamlessly to cloud infrastructure

Key features include:
- ✅ Excel file upload with structure preservation
- ✅ Intelligent data aggregation across multiple files
- ✅ Real-time WebSocket communication via Socket.IO
- ✅ Interactive data tables with editing capabilities
- ✅ Export functionality that recreates original Excel format
- ✅ Unit conversion system for improved UX
- ✅ Manual data entry for additional items
- ✅ Cloud deployment optimized for Vercel + Supabase
- ✅ Robust error handling with comprehensive error types and user-friendly messages

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui, Radix UI, Lucide React icons
- **State Management**: Zustand (mentioned in package.json, not heavily used in current code)
- **Data Fetching**: TanStack Query (mentioned in package.json, not heavily used in current code), Axios
- **Forms**: React Hook Form, Zod
- **Database**: Prisma ORM with Supabase PostgreSQL (migrated from SQLite)
- **Real-time**: Socket.IO
- **Excel Processing**: xlsx
- **Unit Conversion**: Custom library
- **Testing**: Jest, React Testing Library
- **Deployment**: Vercel + Supabase PostgreSQL

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/             # API routes
│   ├── comparison/      # Comparison page
│   └── page.tsx         # Main page
├── components/          # Reusable React components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
│   ├── socket.ts       # Socket.IO setup
│   ├── unit-conversion.ts # Unit conversion utilities
│   ├── db-config.ts    # PostgreSQL-optimized Prisma configuration
│   ├── migrate.ts      # Runtime migration system for Vercel deployment
│   ├── error-handler.ts # Standardized error handling utilities
│   └── server-optimizations.ts # Connection pooling and performance utilities
└── prisma/             # Prisma schema and migrations
```

## Key Files

1.  **`server.ts`**: Custom Next.js server with Socket.IO integration.
2.  **`src/app/page.tsx`**: Main application page with file upload, data display, and management features.
3.  **`src/app/comparison/page.tsx`**: Monthly comparison page for analyzing inventory changes.
4.  **`src/components/data-table.tsx`**: Reusable data table component with sorting, filtering, and inline editing.
5.  **`src/lib/unit-conversion.ts`**: Utility functions for converting and formatting units (weight/volume).
6.  **`src/lib/db-config.ts`**: PostgreSQL-optimized Prisma configuration with connection pooling.
7.  **`src/lib/migrate.ts`**: Runtime migration system for Vercel deployment.
8.  **`src/lib/error-handler.ts`**: Standardized error handling with multiple error types and user-friendly messages.
9.  **`src/lib/server-optimizations.ts`**: Connection pooling and performance utilities.
10. **`prisma/schema.prisma`**: Prisma schema defining the database models.
11. **`next.config.ts`**: Next.js configuration with optimizations.
12. **`package.json`**: Project dependencies and scripts.

## Building and Running

**Important**: Always use `npm run dev` (never `next dev`) due to custom server with Socket.IO integration.

- **Install dependencies**: `npm install`
- **Development server**: `npm run dev` (uses nodemon to watch for changes)
- **Build for production**: `npm run build`
- **Start production server**: `npm start`
- **Run tests**: `npm test`
- **Database operations**:
  - Push schema: `npm run db:push`
  - Generate client: `npm run db:generate`
  - Migrate: `npm run db:migrate`
  - Reset: `npm run db:reset`
  - Studio: `npm run db:studio`
  - Seed: `npm run db:seed`
  - Deploy migrations: `npm run db:deploy`

## Development Conventions

- Uses TypeScript for type safety throughout the codebase.
- Follows Next.js App Router conventions for file-based routing.
- Uses Tailwind CSS for styling with a focus on utility classes.
- Employs shadcn/ui components for consistent UI elements.
- Implements a custom server (`server.ts`) for Socket.IO integration.
- Uses Prisma for database operations with PostgreSQL optimizations.
- Includes unit conversion logic for displaying quantities in appropriate units.
- Uses Jest for testing.
- Follows a component-based architecture for UI development.
- Implements standardized error handling with the error-handler utility.

## API Routes

The application uses Next.js API routes located in `src/app/api/`. Key routes include:
- `/api/excel/upload`: Handles Excel file upload and processing with structure preservation.
- `/api/excel/data`: Manages aggregated and raw data (GET, PUT, DELETE).
- `/api/excel/export`: Exports data to Excel format with original structure recreation.
- `/api/excel/files`: Manages uploaded files (GET, DELETE).
- `/api/excel/manual`: Adds manual entries.
- `/api/socketio`: Socket.IO endpoint for real-time communication.

## Database Schema (Supabase PostgreSQL)

The Prisma schema defines several models:
- `User`: Basic user model.
- `Post`: Example post model.
- `ExcelFile`: Represents an uploaded Excel file with original structure preservation.
  - `originalStructure`: JSON field storing exact Excel layout
  - `columnMapping`: Applied mapping configuration
  - `detectedHeaders`: Automatically detected column headers
- `ExcelRow`: Represents a row in an Excel file.
  - `originalRowIndex`: Preserves exact position in source file
- `AggregatedItem`: Represents an aggregated item based on name/unit/itemId.
  - Unique constraint: `(itemId, name, unit)`
  - `sourceFiles`: JSON array tracking source file IDs
  - `count`: Number of aggregated entries

## Testing

Tests are written using Jest and React Testing Library. Configuration files include `jest.config.js` and `jest.setup.js`.

## Deployment Success & Architecture (2025)

### ✅ **Vercel + Supabase Migration (Completed)**
- **Database Migration:** Successfully moved from SQLite to Supabase PostgreSQL
- **Connection Optimization:** Implemented proper pooling for serverless functions
- **IPv4 Compatibility:** Configured for Vercel's network requirements
- **Runtime Migrations:** Deployed with runtime database verification
- **Build Optimization:** Removed build-time migrations to prevent authentication errors

### ✅ **Key Technical Achievements**
- **Authentication Fixed:** Resolved "Tenant or user not found" errors
- **Connection Pooling:** `connection_limit=1` optimized for serverless
- **SSL Configuration:** Proper `sslmode=require` for Supabase connections
- **TypeScript Compatibility:** All SQLite references converted to PostgreSQL
- **Performance Optimized:** Runtime checks ensure database availability
- **Error Handling:** Robust error handling system with multiple error types

## Socket.IO Integration (Production-Ready)

**✅ Real-time Communication:**
- **Setup:** Custom server with Socket.IO at `/api/socketio`
- **CORS Configuration:** Properly configured for Vercel deployment
- **Transport Optimization:** WebSocket with fallback transports
- **Connection Management:** Automatic reconnection and error handling
- **Production Features:** Optimized timeouts and connection limits

## Development Patterns (Production-Tested)

**✅ Established Patterns:**
- **Error Handling:** Comprehensive try-catch with proper HTTP status codes
- **Data Fetching:** Prisma ORM with TanStack Query for caching
- **File Handling:** React Dropzone with progress tracking
- **State Management:** Zustand for client state, TanStack Query for server state
- **Database Operations:** Connection pooling with runtime migration checks
- **Performance:** Built-in monitoring and optimization utilities
- **Standardized Errors:** Consistent error handling across the application

## Important Deployment Notes

**✅ Production Configuration:**
- **Database:** Supabase PostgreSQL with pooler URLs for IPv4 compatibility
- **Server:** Custom server required - always use `npm run dev` (not `next dev`)
- **Build Process:** Includes Prisma generation and optimized for Vercel
- **Connection Strings:** Use transaction pooler (port 6543) and session pooler (port 5432)
- **Runtime Migrations:** Database verification happens at API route level
- **Environment Variables:** Properly configured for Vercel with sensitive data protection

## Recent Fixes and Improvements

### Error Handling System
- **Enhanced Error Handler**: Improved `showErrorToast` and `handleAsyncOperation` functions with better validation
- **Defensive Programming**: Added checks to prevent runtime errors when handling error objects
- **Fallback Handling**: Added fallback mechanisms for unknown error types
- **Better Logging**: Enhanced error logging for debugging purposes