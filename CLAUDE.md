# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Excel Data Manager application built with Next.js 15, designed for uploading, processing, and visualizing Excel data. The application features a custom Socket.IO server integration, real-time data aggregation, and comprehensive unit conversion capabilities.

**Key Features:**
- Excel file upload and processing (.xlsx/.xls)
- Automatic data aggregation by item ID, name, and unit
- Real-time WebSocket communication
- Interactive data tables with editing capabilities
- Data visualization with charts
- Unit conversion system for weights and volumes
- Manual data entry
- Export functionality

## Architecture

**Frontend:** Next.js 15 with App Router, TypeScript, Tailwind CSS 4, shadcn/ui components
**Backend:** Custom Node.js server combining Next.js with Socket.IO
**Database:** SQLite (development) / PostgreSQL (production) with Prisma ORM
**State Management:** Zustand + TanStack Query
**UI Components:** shadcn/ui built on Radix UI primitives

## Development Commands

```bash
# Development (with custom server + Socket.IO)
npm run dev

# Database operations
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:reset         # Reset database
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database

# Production
npm run build
npm start               # Production server with custom Socket.IO integration

# Utilities
npm run lint
```

## Custom Server Architecture

The application uses a **custom server** (`server.ts`) that combines Next.js with Socket.IO:

- **Development:** Uses nodemon to watch `server.ts` and restart on changes
- **Socket.IO Path:** `/api/socketio` 
- **Custom Request Handling:** Skips Socket.IO requests from Next.js handler
- **Graceful Shutdown:** Handles SIGTERM/SIGINT with cleanup

## Database Schema

**Core Models:**
- `User`: Basic user management
- `ExcelFile`: Uploaded file metadata
- `ExcelRow`: Raw Excel data rows
- `AggregatedItem`: Automatically aggregated data by itemId + name + unit

**Key Relationships:**
- ExcelFile → ExcelRow (one-to-many)
- ExcelFile → AggregatedItem (one-to-many)
- AggregatedItem has unique constraint on (itemId, name, unit)

## API Routes Structure

```
/api/excel/
├── upload/     # POST: Upload and process Excel files
├── data/       # GET: Fetch data, PUT: Update items, DELETE: Delete items
├── files/      # GET: List uploaded files, DELETE: Delete files
├── export/     # GET: Export data to Excel
├── manual/     # POST: Add manual entries
└── sample/     # GET: Download sample Excel template
```

## Key Components

- **DataTable** (`/components/data-table.tsx`): TanStack Table with editing/deletion
- **DataCharts** (`/components/data-charts.tsx`): Recharts visualizations
- **EditItemDialog** (`/components/edit-item-dialog.tsx`): Modal for editing items
- **Unit Conversion** (`/lib/unit-conversion.ts`): Weight/volume conversion utilities

## Excel Processing Logic

1. **File Upload:** XLSX parsing with metadata-based structure preservation
2. **Data Extraction:** Supports category headers (DODANE DO SPISU, PÓŁPRODUKTY, SUROWCE, PRODUKCJA) and data rows
3. **Structure Preservation:** Stores original file structure in `originalStructure` JSON field
4. **Aggregation:** Global aggregation across all files during export, preserving original format
5. **Database Storage:** Saves raw rows with original indices and aggregated items
6. **Unit Conversion:** Automatic display optimization (e.g., 1000g → 1kg)

## Recent Major Changes (2025-08-16)

### Metadata-Based Export System
- **Problem Solved:** Excel exports now perfectly recreate original file format with categories
- **Implementation:** Uses `originalStructure` JSON field to store exact file layout
- **Export Logic:** Global aggregation during export rather than upload-time aggregation
- **Categories:** Hidden from UI but preserved in export for format recreation

### UI Cleanup
- **Removed:** Aggregation indicator badges ("Zagregowane z X plików")
- **Removed:** Bulk edit functionality and associated buttons
- **Kept:** Individual item editing and deletion capabilities
- **Export:** Maintained export functionality for both aggregated and raw data

## Socket.IO Integration

- **Setup:** `setupSocket()` in `/lib/socket.ts`
- **Current Features:** Echo server for testing WebSocket connectivity
- **Path:** `/api/socketio` with CORS configuration
- **Production Ready:** Optimized transports and timeouts

## Development Patterns

- **State Loading:** Components use `useEffect` without dependency arrays for constant reloading (debugging approach)
- **Error Handling:** Comprehensive try-catch with toast notifications
- **Data Fetching:** Native fetch API with proper error handling
- **File Handling:** React Dropzone for drag-and-drop uploads

## Important Notes

- The app uses SQLite for development but includes PostgreSQL configuration for production
- Custom server setup means standard `next dev` won't work - always use `npm run dev`
- Database schema includes preview features for driver adapters (Neon/Vercel compatibility)
- All Excel processing happens server-side with XLSX library
- Unit conversions are automatically applied for better UX (display optimization)

## Debugging Features

The main page includes debug information showing current state and render times. Remove these in production builds by searching for debug-related console logs and UI elements.