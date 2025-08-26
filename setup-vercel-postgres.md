# Vercel PostgreSQL Setup Instructions

After completing the Vercel login in your terminal, run these commands:

## 1. Link your project to Vercel
```bash
vercel link
```

## 2. Set up Vercel Postgres Database
Go to your Vercel dashboard and:
1. Navigate to your project
2. Go to Storage tab
3. Create a new Postgres database
4. Follow the setup wizard

## 3. Pull environment variables
```bash
vercel env pull .env.development.local
```

This will create/update your `.env.development.local` file with:
- `DATABASE_URL` - Connection string for Prisma
- `DIRECT_URL` - Direct connection for migrations (if available)

## 4. Alternative: Manual Environment Setup
If you prefer to set up manually, create `.env.development.local`:

```env
# Vercel Postgres URLs (get these from Vercel dashboard)
DATABASE_URL="postgres://default:password@host:5432/verceldb?sslmode=require"
DIRECT_URL="postgres://default:password@host:5432/verceldb?sslmode=require"
```

## Next Steps
Once environment variables are set up, run:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```