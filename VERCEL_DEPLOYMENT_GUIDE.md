# Vercel Deployment Guide: Excel Data Manager

This comprehensive guide covers deploying the Excel Data Manager application to Vercel with React, TypeScript, TSX, and Prisma.

## Quick Summary

This application is a Next.js-based Excel data management system with:
- **React 19** with TypeScript and TSX components
- **Prisma ORM** with SQLite (dev) and PostgreSQL (production) support
- **Next.js 15** with App Router
- **shadcn/ui** component library
- **Socket.IO** for real-time features
- **File upload** and processing capabilities

## Prerequisites

Before deploying to Vercel, ensure you have:

1. **Node.js 18+** installed locally
2. **Vercel account** (free tier available)
3. **Database** (Vercel Postgres recommended or external PostgreSQL)
4. **Git repository** with your project code

## Step 1: Local Setup & Testing

### 1.1 Install Dependencies

```bash
npm install
```

### 1.2 Set Up Local Environment

Copy the environment template:

```bash
cp .env.example .env
```

Configure your local `.env` file:

```env
# Database Configuration (SQLite for development)
DATABASE_URL="file:./dev.db"

# Application Configuration
NODE_ENV="development"
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 1.3 Generate Prisma Client

```bash
npm run db:generate
```

### 1.4 Push Database Schema

```bash
npm run db:push
```

### 1.5 Seed Database (Optional)

```bash
npm run db:seed
```

### 1.6 Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000` to verify everything works.

## Step 2: Database Setup for Production

### Option 1: Vercel Postgres (Recommended)

1. **Create Vercel Postgres Database**
   - Go to Vercel Dashboard → Storage → Create Database
   - Choose Vercel Postgres
   - Select region and plan

2. **Get Connection String**
   - Once created, copy the connection string
   - It will look like: `postgres://user:password@host-identifier.aws.region.aws.neon.tech/dbname?sslmode=require&pgbouncer=true`

3. **Configure Environment Variables**
   - Add `DATABASE_URL` to your Vercel project settings
   - Use the connection string from step 2

### Option 2: External PostgreSQL

1. **Set up PostgreSQL database**
   - Use services like Neon, Supabase, or your own PostgreSQL server

2. **Get Connection String**
   ```env
   DATABASE_URL="postgresql://username:password@hostname:port/database?sslmode=require"
   ```

3. **Update Prisma Schema for Production**
   - In `prisma/schema.prisma`, comment out SQLite and uncomment PostgreSQL:
   ```prisma
   // datasource db {
   //   provider = "sqlite"
   //   url      = env("DATABASE_URL")
   // }
   
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     relationMode = "prisma"
   }
   ```

## Step 3: Vercel Configuration

### 3.1 Install Vercel CLI

```bash
npm i -g vercel
```

### 3.2 Login to Vercel

```bash
vercel login
```

### 3.3 Configure Environment Variables

Set up environment variables in Vercel Dashboard:

**Required Variables:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_SECRET` - Generate a secure secret: `openssl rand -base64 32`

**Optional Variables:**
- `NODE_ENV` - Set to `production`
- `NEXTAUTH_URL` - Your Vercel app URL

### 3.4 Configure Build Settings

The `vercel.json` file is already configured with optimal settings:

```json
{
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "framework": "nextjs",
  "functions": {
    "app/**/*.tsx": {
      "maxDuration": 30
    },
    "app/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

## Step 4: Deployment

### 4.1 Deploy to Vercel

**Option A: Automatic Deployment (GitHub Integration)**

1. Push your code to GitHub
2. Connect your Vercel project to the GitHub repository
3. Vercel will automatically deploy on every push to main branch

**Option B: Manual Deployment**

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

### 4.2 Verify Deployment

1. **Check Build Logs**
   - Monitor Vercel dashboard for build progress
   - Ensure `prisma generate` runs successfully
   - Verify Next.js build completes

2. **Test Application**
   - Visit your deployed URL
   - Test file upload functionality
   - Verify data aggregation works
   - Check Socket.IO connections

## Step 5: Post-Deployment Setup

### 5.1 Database Migration (If Needed)

If you're switching from SQLite to PostgreSQL:

```bash
# Generate migration from schema
npx prisma migrate dev --name init

# Deploy migration to production
npx prisma migrate deploy
```

### 5.2 Seed Production Database (Optional)

If you want sample data in production:

```bash
# Run seed script
npm run db:seed
```

### 5.3 Monitor Performance

- Check Vercel Analytics for performance metrics
- Monitor database query performance
- Set up alerts for errors

## Project Structure

```
your-app/
├── app/
│   ├── globals.css
│   ├── layout.tsx          # Root layout component
│   ├── page.tsx           # Home page
│   ├── api/
│   │   └── excel/
│   │       ├── data/route.ts
│   │       ├── files/route.ts
│   │       ├── upload/route.ts
│   │       └── sample/route.ts
│   └── components/
│       ├── data-table.tsx
│       ├── data-charts.tsx
│       └── edit-item-dialog.tsx
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── lib/
│   ├── prisma.ts          # Enhanced Prisma client
│   ├── db.ts              # Database export
│   ├── socket.ts          # Socket.IO setup
│   └── utils.ts
├── public/
├── package.json
├── vercel.json
├── .env.example
├── .env.production
└── VERCEL_DEPLOYMENT_GUIDE.md
```

## Key Configuration Files

### package.json (Critical Scripts)

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "vercel-build": "prisma generate && next build",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite" // Change to "postgresql" for production
  url      = env("DATABASE_URL")
}
```

### Enhanced Prisma Client

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClient = () => {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.includes('pooler')) {
    const { withAccelerate } = require('@prisma/extension-accelerate')
    return new PrismaClient().$extends(withAccelerate())
  } else {
    return new PrismaClient()
  }
}

export const prisma = globalForPrisma.prisma ?? prismaClient()
```

## Common Issues & Solutions

### 1. Prisma Caching Issues

**Problem:** `Prisma has detected that this project was built on Vercel, which caches dependencies`

**Solution:** The `postinstall` script in package.json handles this automatically.

### 2. Database Connection Issues

**Problem:** 500 INTERNAL_SERVER_ERROR or connection timeouts

**Solutions:**
- Use connection pooling with `pgbouncer=true` in DATABASE_URL
- Ensure SSL mode is enabled: `sslmode=require`
- Verify environment variables are correctly set in Vercel

### 3. Build Failures

**Problem:** TypeScript compilation errors or missing dependencies

**Solutions:**
- Ensure `typescript` and `prisma` are in dependencies (not devDependencies)
- Run `npm run build` locally to test
- Check Vercel build logs for specific errors

### 4. Socket.IO Issues

**Problem:** WebSocket connections failing in production

**Solutions:**
- Ensure custom server configuration is compatible with Vercel
- Consider using Vercel's Edge Functions for WebSocket support
- Test Socket.IO connections in production environment

## Performance Optimizations

### 1. Database Optimization

```typescript
// Use connection pooling
const prisma = new PrismaClient().$extends(withAccelerate())

// Optimize queries with select
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true
  }
})
```

### 2. Bundle Size Optimization

```typescript
// Use dynamic imports for large components
import dynamic from 'next/dynamic'
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>
})
```

### 3. Static Generation

```typescript
// app/page.tsx
export const revalidate = 60 // Revalidate every 60 seconds
export default async function Page() {
  const data = await prisma.aggregatedItem.findMany()
  return <HomePage data={data} />
}
```

## Security Best Practices

### 1. Environment Variables

- Use Vercel's encrypted environment variables
- Never commit `.env` files to version control
- Use different databases for preview and production environments

### 2. Database Security

- Enable SSL for all database connections
- Use connection pooling to prevent connection exhaustion
- Implement proper error handling to avoid exposing sensitive information

### 3. API Security

- Validate all user inputs
- Use proper authentication and authorization
- Implement rate limiting for API endpoints

## Monitoring & Maintenance

### 1. Vercel Analytics

- Monitor application performance
- Track user behavior and errors
- Set up alerts for performance degradation

### 2. Database Monitoring

- Use Prisma Studio for local development: `npm run db:studio`
- Monitor query performance in production
- Set up database alerts for unusual activity

### 3. Error Tracking

- Implement error logging and monitoring
- Set up alerts for critical errors
- Regular review of application logs

## Deployment Checklist

- [ ] **Dependencies**: Move `prisma` and `typescript` to dependencies
- [ ] **Scripts**: Add `postinstall` and `vercel-build` scripts
- [ ] **Environment**: Set up `DATABASE_URL` and `NEXTAUTH_SECRET`
- [ ] **Database**: Configure PostgreSQL for production
- [ ] **Prisma**: Update schema for production database
- [ ] **Build**: Test `npm run build` locally
- [ ] **Deploy**: Push to GitHub or use Vercel CLI
- [ ] **Test**: Verify all functionality works in production
- [ ] **Monitor**: Set up monitoring and alerts

## Support

For issues related to:
- **Vercel Deployment**: https://vercel.com/support
- **Prisma**: https://www.prisma.io/support
- **Next.js**: https://nextjs.org/docs/getting-started
- **This Project**: Create an issue in the project repository

This guide ensures your Excel Data Manager application deploys successfully to Vercel with optimal performance, security, and reliability.