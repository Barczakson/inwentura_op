/**
 * Database Connection Verification Tests
 * 
 * These tests verify that the database connection is properly configured
 * for both development (SQLite) and production (PostgreSQL).
 */

describe('Database Configuration', () => {
  it('should have DATABASE_URL environment variable', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it('should have valid database URL (either SQLite for development or PostgreSQL for production)', () => {
    const databaseUrl = process.env.DATABASE_URL;
    expect(databaseUrl).toBeDefined();
    
    if (databaseUrl) {
      // Skip this test if using example values
      if (databaseUrl.includes('YOUR_PASSWORD') || databaseUrl.includes('YOUR_PROJECT_REF')) {
        console.warn('Using example database URL - skipping protocol validation');
        return;
      }
      
      // Should be either SQLite or PostgreSQL
      const isSQLite = databaseUrl.startsWith('file:') && databaseUrl.includes('.db');
      const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
      
      expect(isSQLite || isPostgres).toBe(true);
    }
  });

  it('should have DIRECT_URL environment variable', () => {
    expect(process.env.DIRECT_URL).toBeDefined();
  });

  it('should have matching protocols for DATABASE_URL and DIRECT_URL', () => {
    const databaseUrl = process.env.DATABASE_URL;
    const directUrl = process.env.DIRECT_URL;
    expect(databaseUrl).toBeDefined();
    expect(directUrl).toBeDefined();
    
    // Skip this test if using example values
    if (
      (databaseUrl && (databaseUrl.includes('YOUR_PASSWORD') || databaseUrl.includes('YOUR_PROJECT_REF'))) ||
      (directUrl && (directUrl.includes('YOUR_PASSWORD') || directUrl.includes('YOUR_PROJECT_REF')))
    ) {
      console.warn('Using example database URLs - skipping protocol matching validation');
      return;
    }
    
    if (databaseUrl && directUrl) {
      // Both should be either SQLite or PostgreSQL
      const databaseIsSQLite = databaseUrl.startsWith('file:') && databaseUrl.includes('.db');
      const databaseIsPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
      
      const directIsSQLite = directUrl.startsWith('file:') && directUrl.includes('.db');
      const directIsPostgres = directUrl.startsWith('postgresql://') || directUrl.startsWith('postgres://');
      
      expect(databaseIsSQLite && directIsSQLite || databaseIsPostgres && directIsPostgres).toBe(true);
    }
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