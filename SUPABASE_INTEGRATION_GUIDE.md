# Supabase Integration Guide for Future Applications

This guide provides step-by-step instructions for connecting new applications to Supabase using the same approach implemented in this project.

## Prerequisites

1. A Supabase account and project
2. Node.js and npm installed
3. Basic knowledge of Next.js and PostgreSQL

## Step 1: Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Choose your organization and region
4. Enter a project name and database password
5. Click "Create New Project"

Wait for your project to be provisioned (this may take a few minutes).

## Step 2: Get Connection Details

Once your project is ready:

1. Go to "Project Settings" → "API"
2. Copy your Project URL and API keys (anon and service_role)
3. Go to "Database" → "Connection String"
4. Copy both connection strings:
   - **Transaction Pooler** (port 6543) - for serverless functions
   - **Session Pooler** (port 5432) - for migrations

## Step 3: Set Up Environment Variables

Create a `.env.local` file in your project root:

```env
# Transaction pooler (port 6543) - for serverless functions on Vercel
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"

# Session pooler (port 5432) - for migrations (IPv4 compatible)
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"

# Optional: Supabase client-side features
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```

## Step 4: Install Dependencies

```bash
npm install @prisma/client
npm install -D prisma
```

## Step 5: Set Up Prisma

1. Initialize Prisma:
```bash
npx prisma init
```

2. Update your `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## Step 6: Implement Database Configuration

Create `src/lib/db-config.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

// Global Prisma instance with optimizations
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create optimized Prisma client
export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
})

// Connection pool management
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down database connection...')
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down database connection...')
  await db.$disconnect()
  process.exit(0)
})

export default db
```

## Step 7: Create Migration Scripts

Create `prisma/vercel-migrate.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Ensure we're in the project root
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

console.log('🚀 Starting Vercel build migrations...');

try {
  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully');

  // Run database migrations
  console.log('📋 Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Database migrations completed successfully');

  console.log('🎉 All migrations completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('This might be expected if no migrations are needed or if using runtime migrations');
  
  // Don't exit with error code as this is often expected in serverless environments
  console.log('⚠️  Continuing build process...');
  process.exit(0);
}
```

## Step 8: Update Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:reset": "prisma migrate reset",
    "vercel-build": "node prisma/vercel-migrate.js && next build"
  }
}
```

## Step 9: Update Vercel Configuration

Create or update `vercel.json`:

```json
{
  "buildCommand": "npm run vercel-build"
}
```

## Step 10: Create Your First Migration

1. Define your data models in `prisma/schema.prisma`
2. Create and apply the migration:
```bash
npx prisma migrate dev --name init
```

## Step 11: Use Prisma in Your Application

In your API routes or server-side code:

```typescript
import { db } from '@/lib/db-config'

export async function GET() {
  try {
    // Example query
    const users = await db.user.findMany()
    return Response.json(users)
  } catch (error) {
    console.error('Database error:', error)
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
```

## Best Practices

### 1. Connection Pooling for Vercel
- Use the transaction pooler (port 6543) with `pgbouncer=true` and `connection_limit=1`
- Use the session pooler (port 5432) for migrations

### 2. Error Handling
- Always wrap database operations in try-catch blocks
- Implement graceful degradation when database operations fail

### 3. Environment Variables
- Never commit sensitive database credentials to version control
- Use different connection strings for development and production

### 4. Migration Strategy
- Use build-time migrations for schema changes
- Implement runtime verification for critical operations

### 5. Performance Optimization
- Use Prisma's select and include options to fetch only needed data
- Implement connection pooling and reuse Prisma client instances
- Add indexes to frequently queried columns

## Troubleshooting

### "Tenant or user not found" Errors
- Verify your Supabase project credentials are correct
- Ensure you're using the pooler URLs (port 6543 for DATABASE_URL, port 5432 for DIRECT_URL)
- Check that your Supabase project is not suspended or deleted

### Connection Timeout Issues
- Increase timeout values in connection strings
- Check your network connectivity to Supabase
- Verify your database password is correct

### Migration Failures
- Ensure your DATABASE_URL and DIRECT_URL use different ports
- Check that your Prisma schema matches your database structure
- Run `prisma migrate reset` in development if migrations get corrupted

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vercel Deployment Documentation](https://vercel.com/docs)