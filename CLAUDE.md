# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with this Excel Data Manager application.

## Project Overview

This is a **production-ready Excel Data Manager** application successfully deployed on Vercel with Supabase PostgreSQL. The application processes Excel files, aggregates data intelligently, and provides real-time management capabilities.

**Core Purpose:**
- Upload and process Excel inventory files (.xlsx/.xls)
- Automatically aggregate items by ID, name, and unit
- Maintain original Excel structure for perfect export recreation
- Provide real-time collaborative data management
- Deploy seamlessly to cloud infrastructure

**Key Features:**
- ✅ Excel file upload with structure preservation
- ✅ Intelligent data aggregation across multiple files
- ✅ Real-time WebSocket communication via Socket.IO
- ✅ Interactive data tables with editing capabilities
- ✅ Export functionality that recreates original Excel format
- ✅ Unit conversion system for improved UX
- ✅ Manual data entry for additional items
- ✅ Cloud deployment optimized for Vercel + Supabase

## Architecture & Deployment Status

**✅ Successfully Deployed Architecture:**
- **Frontend:** Next.js 15 with App Router, TypeScript, Tailwind CSS 4
- **Backend:** Custom Node.js server combining Next.js + Socket.IO
- **Database:** Supabase PostgreSQL with optimized connection pooling
- **Deployment:** Vercel serverless functions with runtime migration checks
- **State Management:** Zustand + TanStack Query
- **UI Components:** shadcn/ui built on Radix UI primitives

## Development Commands

```bash
# Development (with custom server + Socket.IO)
npm run dev              # Start development server with nodemon + Socket.IO

# Database operations (Supabase PostgreSQL)
npm run db:push          # Push schema changes to Supabase
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations locally
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
npm run db:deploy        # Deploy migrations to production

# Production & Build
npm run build           # Build for production (includes Prisma generation)
npm run start          # Production server with Socket.IO
npm run vercel-build   # Vercel build command (generates + migrates + builds)

# Utilities
npm run lint
npm run test
```

## Custom Server Architecture (Production-Ready)

**✅ Successfully Deployed Custom Server:**
- **Server File:** `server.ts` combines Next.js + Socket.IO
- **Development:** Nodemon watches `server.ts` with hot-reload
- **Production:** TSX executes server in production environment
- **Socket.IO Path:** `/api/socketio` with CORS configuration
- **Request Routing:** Skips Socket.IO requests from Next.js handler
- **Graceful Shutdown:** Proper cleanup on SIGTERM/SIGINT

## Database Schema (Supabase PostgreSQL)

**✅ Production Database Models:**

### Core Tables
- **`ExcelFile`**: File metadata with original structure preservation
  - `originalStructure`: JSON field storing exact Excel layout
  - `columnMapping`: Applied mapping configuration
  - `detectedHeaders`: Automatically detected column headers

- **`ExcelRow`**: Raw data rows from Excel files
  - `originalRowIndex`: Preserves exact position in source file
  - Indexed for performance: `[itemId, name, unit]`, `[fileId]`

- **`AggregatedItem`**: Intelligent aggregation results
  - Unique constraint: `(itemId, name, unit)`
  - `sourceFiles`: JSON array tracking source file IDs
  - `count`: Number of aggregated entries

- **`ColumnMapping`**: Flexible mapping configurations
  - Reusable mapping templates
  - Usage tracking and analytics

**Key Production Optimizations:**
- ✅ JSON fields for PostgreSQL compatibility
- ✅ Proper indexing for query performance
- ✅ Cascade deletions for data integrity
- ✅ Connection pooling optimized for serverless

## API Routes Structure (Production-Optimized)

**✅ Production API Endpoints:**
```
/api/excel/
├── upload/     # POST: Upload + process Excel with structure preservation
├── data/       # GET: Fetch with pagination, PUT: Update, DELETE: Remove
├── files/      # GET: List files with metadata, DELETE: Remove with cleanup
├── export/     # GET: Export with original Excel format recreation
├── manual/     # POST: Add manual entries with validation
└── column-mapping/ # POST: Dynamic column mapping configurations
```

**Runtime Features:**
- ✅ **Runtime Migration Checks**: `ensureMigrationsRun()` in each route
- ✅ **Connection Pooling**: Optimized for Vercel serverless functions
- ✅ **Error Handling**: Comprehensive try-catch with proper HTTP codes
- ✅ **Performance Monitoring**: Built-in timing and optimization
- ✅ **Data Validation**: Input sanitization and type checking

## Key Components (Production-Ready)

**✅ Core UI Components:**
- **`DataTable`** (`/components/data-table.tsx`): TanStack Table with real-time editing
- **`DataCharts`** (`/components/data-charts.tsx`): Recharts with responsive design
- **`EditItemDialog`** (`/components/edit-item-dialog.tsx`): Modal editing interface
- **`FileUpload`**: Drag-and-drop with progress indicators
- **`ExportButton`**: One-click Excel export with format preservation

**✅ Core Libraries:**
- **`/lib/db-config.ts`**: PostgreSQL-optimized Prisma configuration
- **`/lib/migrate.ts`**: Runtime migration system for Vercel deployment
- **`/lib/server-optimizations.ts`**: Connection pooling and performance utilities
- **`/lib/unit-conversion.ts`**: Smart weight/volume conversion system

## Excel Processing Logic (Production-Optimized)

**✅ Advanced Processing Pipeline:**
1. **File Upload:** XLSX parsing with complete structure preservation
2. **Data Extraction:** Smart recognition of Excel categories and data sections
3. **Structure Preservation:** `originalStructure` JSON field stores exact layout
4. **Intelligent Aggregation:** Real-time grouping by itemId + name + unit
5. **Database Optimization:** Batch operations with connection pooling
6. **Export Recreation:** Perfect recreation of original Excel format with aggregated data

**✅ Production Features:**
- **Memory Efficiency:** Chunked processing for large files (5000+ rows)
- **Error Recovery:** Graceful handling of malformed Excel files
- **Performance Monitoring:** Built-in timing and optimization tracking
- **Unit Normalization:** Smart conversion (1000g → 1kg) with original preservation

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

## Important Deployment Notes

**✅ Production Configuration:**
- **Database:** Supabase PostgreSQL with pooler URLs for IPv4 compatibility
- **Server:** Custom server required - always use `npm run dev` (not `next dev`)
- **Build Process:** Includes Prisma generation and optimized for Vercel
- **Connection Strings:** Use transaction pooler (port 6543) and session pooler (port 5432)
- **Runtime Migrations:** Database verification happens at API route level
- **Environment Variables:** Properly configured for Vercel with sensitive data protection

## Troubleshooting Resources

**📚 Available Documentation:**
- `TROUBLESHOOTING.md` - Database connection and authentication issues
- `DEPLOYMENT.md` - Vercel deployment and IPv4 compatibility
- `README.md` - Complete setup and usage guide

**🔧 Common Solutions:**
- Authentication errors: Check connection string format and Supabase status
- Build failures: Verify TypeScript compatibility and environment variables
- Performance issues: Review connection pooling and runtime migration settings

---

## 🚀 **DEPLOYMENT STATUS: SUCCESSFUL** 

✅ **Application successfully deployed to Vercel with Supabase PostgreSQL**  
✅ **All authentication and connection issues resolved**  
✅ **Runtime migration system working properly**  
✅ **TypeScript compilation successful**  
✅ **Production-ready with optimized performance**  

---

## Important Instructions for Claude Code

**✅ PROJECT STATUS: PRODUCTION-READY**
- This is a **successfully deployed** application on Vercel + Supabase
- All major technical challenges have been resolved
- Database is properly configured with connection pooling
- Build process is optimized for serverless deployment

**🔧 DEVELOPMENT GUIDELINES:**
- Always use `npm run dev` (never `next dev`) due to custom server
- Database operations use Prisma with PostgreSQL optimizations
- Runtime migration checks ensure database availability
- Connection pooling configured for Vercel serverless functions

**📋 CONTEXT AWARENESS:**
- App migrated from SQLite to Supabase PostgreSQL (completed)
- IPv4 compatibility issues resolved for Vercel deployment
- Authentication errors fixed with proper connection string format
- TypeScript compatibility ensured across all database operations

**⚠️ CRITICAL REMINDERS:**
- Do what has been asked; nothing more, nothing less
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation unless explicitly requested
- Reference existing documentation in troubleshooting scenarios