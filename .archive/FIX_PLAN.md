# Plan for Fixing 500 Errors in Excel Data Manager

## Current Issues

Browser console shows:
1. `/api/excel/files` - Failed to load uploaded files: 500
2. `/api/excel/data?includeRaw=true&page=1&limit=25&sortBy=name&sortDirection=asc` - 500 error
3. Generic "[SERVER] Object" error messages

## Diagnostic Plan

### Phase 1: Server-Side Logging Enhancement

1. **Add Detailed Error Logging**
   - Enhance error handling in `/src/app/api/excel/files/route.ts` to log full error stack traces
   - Enhance error handling in `/src/app/api/excel/data/route.ts` to log full error stack traces
   - Add request parameter logging for debugging

2. **Add Request Validation Logging**
   - Log incoming request parameters in both endpoints
   - Log database connection status before queries

### Phase 2: Direct API Testing

1. **Test Endpoints with curl**
   ```bash
   # Test files endpoint
   curl -v "http://localhost:3000/api/excel/files"
   
   # Test data endpoint with full parameters
   curl -v "http://localhost:3000/api/excel/data?includeRaw=true&page=1&limit=25&sortBy=name&sortDirection=asc"
   
   # Test data endpoint with minimal parameters
   curl -v "http://localhost:3000/api/excel/data"
   ```

2. **Check Database State**
   - Verify database contains data
   - Check if required tables exist
   - Verify database connection

### Phase 3: Browser-Specific Debugging

1. **Check Network Tab**
   - Examine actual HTTP response bodies
   - Check request headers
   - Verify content types

2. **Compare Browser vs Direct Requests**
   - Check for differences in headers
   - Check for differences in request timing
   - Check for CORS issues

### Phase 4: Memory and Performance Issues

1. **Monitor Server Resources**
   - Check memory usage during requests
   - Check for timeouts

2. **Test with Reduced Data**
   - Test with `includeRaw=false`
   - Test with smaller `limit` values

## Implementation Steps

### Step 1: Enhance Error Logging in Files Route

Modify `/src/app/api/excel/files/route.ts` to add detailed error logging:

```javascript
// Add at the beginning of each try block
console.log('Files API called at:', new Date().toISOString());

// In catch blocks, enhance error logging
console.error('Error fetching files:', {
  error: error instanceof Error ? error.message : 'Unknown error',
  stack: error instanceof Error ? error.stack : 'No stack trace',
  timestamp: new Date().toISOString()
});
```

### Step 2: Enhance Error Logging in Data Route

Modify `/src/app/api/excel/data/route.ts` to add detailed error logging:

```javascript
// Add at the beginning of the try block
console.log('Data API called with params:', {
  includeRaw,
  fileId,
  search,
  page,
  limit,
  sortBy,
  sortDirection,
  timestamp: new Date().toISOString()
});

// In catch blocks, enhance error logging
console.error('Error fetching data:', {
  error: error instanceof Error ? error.message : 'Unknown error',
  stack: error instanceof Error ? error.stack : 'No stack trace',
  params: {
    includeRaw,
    fileId,
    search,
    page,
    limit,
    sortBy,
    sortDirection
  },
  timestamp: new Date().toISOString()
});
```

### Step 3: Add Request Validation

Add validation to ensure parameters are properly parsed:

```javascript
// In data route, validate parameters
if (isNaN(page) || page < 1) {
  console.warn('Invalid page parameter:', searchParams.get('page'));
  page = 1;
}

if (isNaN(limit) || limit < 1 || limit > 1000) {
  console.warn('Invalid limit parameter:', searchParams.get('limit'));
  limit = 50;
}
```

### Step 4: Add Database Connection Health Check

Add a simple database connectivity test:

```javascript
// In both routes, before queries
try {
  await db.$queryRaw`SELECT 1`;
  console.log('Database connection: OK');
} catch (dbError) {
  console.error('Database connection failed:', dbError);
  return NextResponse.json(
    { error: 'Database connection failed', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
    { status: 500 }
  );
}
```

## Testing Plan

### Test 1: Direct API Calls
- Test with curl to see if server returns proper error details
- Test with different parameter combinations

### Test 2: Browser Testing
- Clear browser cache and cookies
- Test in incognito mode
- Test with browser dev tools open to see network requests

### Test 3: Database State Verification
- Check if database has data
- Verify table structures
- Check database permissions

## Rollback Plan

If changes cause additional issues:
1. Revert modifications to API routes
2. Restore database to previous state if needed
3. Check server logs for rollback-related errors

## Success Criteria

1. API endpoints return 200 status codes
2. Data is properly loaded in the frontend
3. No 500 errors in browser console
4. Error logs show no critical issues