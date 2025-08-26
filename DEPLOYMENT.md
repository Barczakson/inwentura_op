# Deployment Guide - Vercel + Supabase (IPv4 Compatible)

## Issue: Vercel IPv4-Only Limitation

**Problem**: Vercel only supports IPv4 connections, but Supabase direct connections use IPv6.

**Error**: `Can't reach database server` during `prisma migrate deploy` on Vercel

**Solution**: Use Supabase pooler URLs for both `DATABASE_URL` and `DIRECT_URL`

## Environment Variables for Vercel

```env
# Transaction pooler (port 6543) - for runtime operations
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session pooler (port 5432) - for migrations (IPv4 compatible)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:5432/postgres"
```

## Key Configuration Points

### 1. **Both URLs use `.pooler.supabase.com`**
- ✅ `db.[PROJECT-REF].pooler.supabase.com` (IPv4 compatible)
- ❌ `db.[PROJECT-REF].supabase.co` (IPv6 only, fails on Vercel)

### 2. **Port Configuration**
- **Port 6543**: Transaction pooler with `pgbouncer=true` for serverless functions
- **Port 5432**: Session pooler for migrations and admin operations

### 3. **Build Process**
```json
"buildCommand": "prisma generate && prisma migrate deploy && npm run build"
```

## Deployment Steps

1. **Create Supabase Project**
   - Get your project reference and password
   - Note: Use pooler URLs, not direct connection URLs

2. **Set Vercel Environment Variables**
   ```bash
   # Via Vercel Dashboard
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[REF].pooler.supabase.com:5432/postgres
   
   # Via Vercel CLI
   vercel env add DATABASE_URL
   vercel env add DIRECT_URL
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

## Why This Configuration Works

- **IPv4 Compatibility**: Pooler URLs work on Vercel's IPv4-only infrastructure
- **Migration Support**: Session pooler (port 5432) supports schema migrations
- **Runtime Optimization**: Transaction pooler (port 6543) optimized for serverless
- **Connection Pooling**: Prevents connection exhaustion in serverless functions

## Alternative Solutions

If you need a true direct connection:
1. **Purchase Supabase IPv4 Add-on**: Enables direct IPv4 connections
2. **Use Different Platform**: Deploy to platforms with IPv6 support (Railway, Fly.io)
3. **Hybrid Approach**: Run migrations locally, deploy functions only

## Verification

After deployment, check Vercel Function Logs for:
- ✅ `prisma migrate deploy` success
- ✅ Database connections working
- ✅ No IPv4/IPv6 connection errors