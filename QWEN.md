# Project Context for Qwen Code

This document provides essential context for Qwen Code to understand and assist with this project.

## Project Overview

This is a **Next.js 15** web application built with **TypeScript 5** and **Tailwind CSS 4**. It uses a modern stack including **shadcn/ui** components, **Prisma** ORM with **SQLite**, and **Socket.IO** for real-time communication. The application is designed as an "Excel Inventory Manager" that allows users to upload Excel files, automatically aggregate data based on item names and IDs, and manage inventory items with features like editing, deleting, and exporting.

Key features include:
- Excel file upload and parsing (`.xlsx`, `.xls`)
- Automatic aggregation of items with the same name/ID
- Real-time communication via Socket.IO
- Data management (CRUD operations)
- Data export to Excel
- Manual item entry
- Responsive UI with dark mode support

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui, Radix UI, Lucide React icons
- **State Management**: Zustand (mentioned in package.json, not heavily used in current code)
- **Data Fetching**: TanStack Query (mentioned in package.json, not heavily used in current code), Axios
- **Forms**: React Hook Form, Zod
- **Database**: Prisma ORM with SQLite (easily switchable to PostgreSQL)
- **Real-time**: Socket.IO
- **Excel Processing**: xlsx
- **Unit Conversion**: Custom library
- **Testing**: Jest, React Testing Library
- **Deployment**: Vercel compatible

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
│   └── unit-conversion.ts # Unit conversion utilities
└── prisma/             # Prisma schema and migrations
```

## Key Files

1.  **`server.ts`**: Custom Next.js server with Socket.IO integration.
2.  **`src/app/page.tsx`**: Main application page with file upload, data display, and management features.
3.  **`src/components/data-table.tsx`**: Reusable data table component with sorting, filtering, and inline editing.
4.  **`src/lib/unit-conversion.ts`**: Utility functions for converting and formatting units (weight/volume).
5.  **`prisma/schema.prisma`**: Prisma schema defining the database models (User, Post, ExcelFile, ExcelRow, AggregatedItem).
6.  **`next.config.ts`**: Next.js configuration with optimizations.
7.  **`package.json`**: Project dependencies and scripts.

## Building and Running

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

## Development Conventions

- Uses TypeScript for type safety throughout the codebase.
- Follows Next.js App Router conventions for file-based routing.
- Uses Tailwind CSS for styling with a focus on utility classes.
- Employs shadcn/ui components for consistent UI elements.
- Implements a custom server (`server.ts`) for Socket.IO integration.
- Uses Prisma for database operations with a SQLite database.
- Includes unit conversion logic for displaying quantities in appropriate units.
- Uses Jest for testing.
- Follows a component-based architecture for UI development.

## API Routes

The application uses Next.js API routes located in `src/app/api/`. Key routes include:
- `/api/excel/upload`: Handles Excel file upload and processing.
- `/api/excel/data`: Manages aggregated and raw data (GET, PUT, DELETE).
- `/api/excel/export`: Exports data to Excel format.
- `/api/excel/files`: Manages uploaded files (GET, DELETE).
- `/api/excel/manual`: Adds manual entries.
- `/api/socketio`: Socket.IO endpoint for real-time communication.

## Database Schema

The Prisma schema defines several models:
- `User`: Basic user model.
- `Post`: Example post model.
- `ExcelFile`: Represents an uploaded Excel file.
- `ExcelRow`: Represents a row in an Excel file.
- `AggregatedItem`: Represents an aggregated item based on name/unit/itemId.

## Testing

Tests are written using Jest and React Testing Library. Configuration files include `jest.config.js` and `jest.setup.js`.
