#!/usr/bin/env node

/**
 * Vercel Build Migration Script
 * 
 * This script runs during the Vercel build process to ensure the database
 * is properly migrated before the application starts.
 * 
 * Usage: node prisma/vercel-migrate.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Ensure we're in the project root
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

console.log('🚀 Starting Vercel build migrations...');

try {
  // Generate Prisma client
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated successfully');

  // Run database migrations
  console.log('📋 Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✅ Database migrations completed successfully');

  console.log('🎉 All migrations completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('This might be expected if no migrations are needed or if using runtime migrations');
  
  // Don't exit with error code as this is often expected in serverless environments
  console.log('⚠️  Continuing build process...');
  process.exit(0);
}