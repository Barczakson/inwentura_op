# Database Migration Setup for Vercel + Supabase Deployment

This document explains how database migrations work in this application, particularly for Vercel deployments with Supabase PostgreSQL.

## Migration Strategy

The application uses a hybrid migration approach:

1. **Build-time migrations** via `prisma migrate deploy` during the Vercel build process
2. **Runtime schema verification** to ensure tables exist when the application runs
3. **Fallback schema creation** if tables are missing

## How It Works

### During Vercel Build (`vercel-build` script)

1. The `vercel-build` script in `package.json` runs `node prisma/vercel-migrate.js`
2. This script:
   - Generates the Prisma client
   - Runs `prisma migrate deploy` to apply any pending migrations
   - Builds the Next.js application

### At Runtime

1. Each API route calls `ensureMigrationsRun()` from `src/lib/migrate.ts`
2. This function:
   - Verifies database connectivity
   - Checks if required tables exist
   - Attempts to create schema if missing (fallback)

## Environment Variables

Make sure your `.env` file has the correct Supabase connection URLs:

```env
# Transaction pooler (port 6543) - for serverless functions on Vercel
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"

# Session pooler (port 5432) - for migrations (IPv4 compatible)
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## Manual Migration Commands

```bash
# Generate Prisma client
npm run db:generate

# Create a new migration
npm run db:migrate

# Deploy migrations to production
npm run db:deploy

# Reset database (development only)
npm run db:reset
```

## Troubleshooting

If you encounter "Tenant or user not found" errors:

1. Ensure your Supabase project credentials are correct
2. Verify that you're using the pooler URLs (port 6543 for DATABASE_URL, port 5432 for DIRECT_URL)
3. Check that your Supabase project is not suspended or deleted
4. Make sure your database password is correct

The application should now work correctly both locally and when deployed to Vercel.