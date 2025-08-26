# Database Setup Guide

## Current Configuration

The application currently uses SQLite for local development:
```env
DATABASE_URL="file:./prisma/dev.db"
DIRECT_URL="file:./prisma/dev.db"
```

## Production Configuration (Required for Vercel Deployment)

For production deployment to Vercel with Supabase PostgreSQL, you need to update your `.env.production` file:

```env
# Transaction pooler (port 6543) - for serverless functions on Vercel
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"

# Session pooler (port 5432) - for migrations (IPv4 compatible, NOT direct connection)
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## Environment-Specific Configurations

### Local Development (.env.local)
```env
# For local PostgreSQL development
DATABASE_URL="postgresql://postgres:password@localhost:5432/excel_inventory_dev?sslmode=prefer"
DIRECT_URL="postgresql://postgres:password@localhost:5432/excel_inventory_dev?sslmode=prefer"
```

### Vercel Preview Environments (.env.preview)
```env
# Same as production but with preview database
DATABASE_URL="postgresql://postgres:[PREVIEW-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"
DIRECT_URL="postgresql://postgres:[PREVIEW-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

### Vercel Production (.env.production)
```env
# Production Supabase PostgreSQL
DATABASE_URL="postgresql://postgres:[PROD-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"
DIRECT_URL="postgresql://postgres:[PROD-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## Required Steps for Production Deployment

1. Create a Supabase project
2. Get your database connection credentials from Supabase Dashboard
3. Update your `.env.production` file with the correct credentials
4. Run database migrations using `npm run db:deploy`
5. Deploy to Vercel

## Testing Database Configuration

Run the database configuration tests:
```bash
npm run test:api -- --testPathPatterns=db
```