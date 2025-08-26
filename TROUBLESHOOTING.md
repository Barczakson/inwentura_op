# Troubleshooting Supabase Authentication (P1000 Error)

## Error: P1000 Authentication Failed

If you're getting `Authentication failed against database server`, follow this checklist:

## 1. **Check Password Special Characters**

**Issue**: Passwords with special characters need URL encoding.

**Special characters that need encoding:**
- `@` → `%40`
- `#` → `%23` 
- `$` → `%24`
- `%` → `%25`
- `^` → `%5E`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

**Example:**
```bash
# Original password: myP@ssw0rd#123
# URL encoded: myP%40ssw0rd%23123
```

## 2. **Verify Connection String Format**

Your connection strings should look exactly like this:

```env
DATABASE_URL="postgresql://postgres:[URL-ENCODED-PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require"

DIRECT_URL="postgresql://postgres:[URL-ENCODED-PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## 3. **Check Supabase Project Status**

1. Go to your Supabase dashboard
2. Verify project is **not paused**
3. Check **Project Settings > Database > Database password**
4. Try resetting the password if unsure

## 4. **Check IP Bans**

1. Go to **Project Settings > Database > Network Bans**
2. Look for your IP or Vercel's IP ranges
3. Remove any bans if found

## 5. **Verify Project Reference**

1. Go to **Project Settings > API**
2. Copy the **Project URL**: `https://[PROJECT-REF].supabase.co`
3. Extract `[PROJECT-REF]` from the URL
4. Ensure it matches your connection string

## 6. **Test Connection Locally**

Before deploying, test the connection:

```bash
# Install Supabase CLI
npm install -g supabase

# Test connection with your credentials
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

## 7. **Environment Variables in Vercel**

1. Go to Vercel Project Settings > Environment Variables
2. Add/Update both `DATABASE_URL` and `DIRECT_URL`
3. **Important**: Redeploy after changing environment variables

```bash
vercel --prod  # Force new deployment
```

## 8. **Check Database User**

- **Username should be**: `postgres` (not your email)
- **Database name should be**: `postgres` (default)
- **Port for transaction pooling**: `6543`
- **Port for session pooling**: `5432`

## 9. **Connection Limit Issues**

If you're still getting connection errors:

```env
# Try even more restrictive limits
DATABASE_URL="...?connection_limit=1&pool_timeout=10&sslmode=require"
```

## 10. **Regional Issues**

Ensure your connection string region matches your project:
- `aws-0-eu-north-1` for Stockholm
- `aws-0-eu-west-1` for Ireland  
- `aws-0-us-east-1` for Virginia
- etc.

## Quick Test Script

Create `test-connection.js`:

```javascript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    const result = await prisma.$queryRaw`SELECT version()`
    console.log('Database version:', result)
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
```

Run locally:
```bash
node test-connection.js
```

## Common Working Configuration

```env
# Replace [PASSWORD] and [PROJECT-REF] with actual values
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].pooler.supabase.com:5432/postgres?sslmode=require"
```

This configuration works with Vercel's IPv4-only environment and Supabase's connection pooling requirements.