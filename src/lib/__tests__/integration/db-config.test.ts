/**
 * Database Connection Configuration Tests
 * 
 * These tests verify that the database connection is properly configured
 * for both development (SQLite) and production (Vercel + Supabase PostgreSQL).
 */

describe('Database Configuration', () => {
  describe('Development Configuration (SQLite)', () => {
    it('should allow SQLite configuration for local development', () => {
      const databaseUrl = process.env.DATABASE_URL;
      expect(databaseUrl).toBeDefined();
      
      if (databaseUrl) {
        // Should be either SQLite or PostgreSQL
        const isSQLite = databaseUrl.startsWith('file:') && databaseUrl.includes('.db');
        const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
        
        expect(isSQLite || isPostgres).toBe(true);
      }
    });
  });

  describe('Production Configuration (PostgreSQL)', () => {
    it('should have DATABASE_URL configured for Vercel + Supabase when using PostgreSQL', () => {
      const databaseUrl = process.env.DATABASE_URL;
      expect(databaseUrl).toBeDefined();
      
      // If using example values, skip detailed validation
      if (databaseUrl && (databaseUrl.includes('YOUR_PASSWORD') || databaseUrl.includes('YOUR_PROJECT_REF'))) {
        console.warn('Using example database URL - skipping detailed validation');
        return;
      }
      
      // Skip if using SQLite for development
      if (databaseUrl && databaseUrl.startsWith('file:') && databaseUrl.includes('.db')) {
        console.info('Using SQLite for development - skipping PostgreSQL validation');
        return;
      }
      
      if (databaseUrl) {
        // Should be a PostgreSQL connection string for production
        expect(
          databaseUrl.startsWith('postgresql://') || 
          databaseUrl.startsWith('postgres://')
        ).toBe(true);
        
        // Should require SSL for secure connection
        expect(databaseUrl.includes('sslmode=require')).toBe(true);
        
        // Should include required parameters for Vercel serverless
        expect(databaseUrl.includes('pgbouncer=true')).toBe(true);
        expect(databaseUrl.includes('connection_limit=1')).toBe(true);
      }
    });

    it('should have DIRECT_URL configured for migrations when using PostgreSQL', () => {
      const directUrl = process.env.DIRECT_URL;
      expect(directUrl).toBeDefined();
      
      // If using example values, skip detailed validation
      if (directUrl && (directUrl.includes('YOUR_PASSWORD') || directUrl.includes('YOUR_PROJECT_REF'))) {
        console.warn('Using example DIRECT_URL - skipping detailed validation');
        return;
      }
      
      // Skip if using SQLite for development
      if (directUrl && directUrl.startsWith('file:') && directUrl.includes('.db')) {
        console.info('Using SQLite for development - skipping PostgreSQL validation');
        return;
      }
      
      if (directUrl) {
        // Should be a PostgreSQL connection string
        expect(
          directUrl.startsWith('postgresql://') || 
          directUrl.startsWith('postgres://')
        ).toBe(true);
        
        // Should require SSL for secure connection
        expect(directUrl.includes('sslmode=require')).toBe(true);
      }
    });

    it('should have different ports for DATABASE_URL and DIRECT_URL when using PostgreSQL', () => {
      const databaseUrl = process.env.DATABASE_URL;
      const directUrl = process.env.DIRECT_URL;
      
      // Skip if using example values
      if (
        databaseUrl && directUrl &&
        (databaseUrl.includes('YOUR_PASSWORD') || databaseUrl.includes('YOUR_PROJECT_REF') ||
         directUrl.includes('YOUR_PASSWORD') || directUrl.includes('YOUR_PROJECT_REF'))
      ) {
        console.warn('Using example URLs - skipping port validation');
        return;
      }
      
      // Skip if using SQLite for development
      if (databaseUrl && databaseUrl.startsWith('file:') && databaseUrl.includes('.db')) {
        console.info('Using SQLite for development - skipping port validation');
        return;
      }
      
      expect(databaseUrl).toBeDefined();
      expect(directUrl).toBeDefined();
      
      if (databaseUrl && directUrl) {
        // DATABASE_URL should use transaction pooler (port 6543)
        expect(databaseUrl.includes(':6543')).toBe(true);
        
        // DIRECT_URL should use session pooler (port 5432)
        expect(directUrl.includes(':5432')).toBe(true);
      }
    });

    it('should have connection parameters optimized for Vercel serverless when using PostgreSQL', () => {
      const databaseUrl = process.env.DATABASE_URL;
      
      // Skip if using example values
      if (databaseUrl && (databaseUrl.includes('YOUR_PASSWORD') || databaseUrl.includes('YOUR_PROJECT_REF'))) {
        console.warn('Using example database URL - skipping parameter validation');
        return;
      }
      
      // Skip if using SQLite for development
      if (databaseUrl && databaseUrl.startsWith('file:') && databaseUrl.includes('.db')) {
        console.info('Using SQLite for development - skipping parameter validation');
        return;
      }
      
      expect(databaseUrl).toBeDefined();
      
      if (databaseUrl) {
        // Connection limit should be 1 for Vercel serverless functions
        expect(databaseUrl.includes('connection_limit=1')).toBe(true);
        
        // Should include pgbouncer for connection pooling
        expect(databaseUrl.includes('pgbouncer=true')).toBe(true);
        
        // Should require SSL
        expect(databaseUrl.includes('sslmode=require')).toBe(true);
      }
    });
  });

  describe('Configuration Warnings', () => {
    it('should warn about using SQLite in production', () => {
      const databaseUrl = process.env.DATABASE_URL;
      
      if (databaseUrl && databaseUrl.startsWith('file:') && databaseUrl.includes('.db')) {
        console.warn('⚠️  WARNING: Using SQLite for database. For production deployment to Vercel, use PostgreSQL.');
      }
    });
  });
});