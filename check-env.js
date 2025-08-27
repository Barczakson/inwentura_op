// Simple script to check environment variables
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DIRECT_URL:', process.env.DIRECT_URL);

// Check if .env.local exists
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '..', '..', '.env.local');
console.log('Looking for .env.local at:', envLocalPath);

if (fs.existsSync(envLocalPath)) {
  console.log('.env.local exists');
  const content = fs.readFileSync(envLocalPath, 'utf8');
  console.log('.env.local content:');
  console.log(content);
} else {
  console.log('.env.local does not exist');
}

// Check if .env exists
const envPath = path.join(__dirname, '..', '..', '.env');
console.log('Looking for .env at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env exists');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('.env content:');
  console.log(content);
} else {
  console.log('.env does not exist');
}