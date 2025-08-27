# Quick Start: Connect Your App to Supabase

Follow these steps to connect your Next.js application to Supabase using the proven approach from this project.

## 1. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your connection strings from Database → Connection String:
   - Copy **Transaction Pooler** (port 6543) for `DATABASE_URL`
   - Copy **Session Pooler** (port 5432) for `DIRECT_URL`

## 2. Configure Environment Variables

Create `.env.local`:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## 3. Install Dependencies

```bash
npm install @prisma/client
npm install -D prisma
```

## 4. Initialize Prisma

```bash
npx prisma init
```

Update `prisma/schema.prisma`:

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

## 5. Create Database Configuration

Create `src/lib/db-config.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export default db
```

## 6. Set Up Migration Script

Create `prisma/vercel-migrate.js`:

```javascript
const { execSync } = require('child_process')

try {
  execSync('npx prisma generate', { stdio: 'inherit' })
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  process.exit(0)
} catch (error) {
  console.log('Migration continuing...')
  process.exit(0)
}
```

## 7. Update Package.json

```json
{
  "scripts": {
    "vercel-build": "node prisma/vercel-migrate.js && next build",
    "db:generate": "prisma generate",
    "db:deploy": "prisma migrate deploy"
  }
}
```

## 8. Configure Vercel

Create `vercel.json`:

```json
{
  "buildCommand": "npm run vercel-build"
}
```

## 9. Create Your First Migration

```bash
# Define models in prisma/schema.prisma, then:
npx prisma migrate dev --name init
```

## 10. Use in Your App

```typescript
import { db } from '@/lib/db-config'

// In API routes
export async function GET() {
  const data = await db.user.findMany()
  return Response.json(data)
}
```

## Deploy

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel project settings
4. Deploy!

Your app is now connected to Supabase with optimized configuration for Vercel!