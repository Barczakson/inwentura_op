// Log the actual environment variable values
console.log('DATABASE_URL value:', process.env.DATABASE_URL)
console.log('DIRECT_URL value:', process.env.DIRECT_URL)

// Check if they're being overridden somewhere
console.log('All env vars with "DATABASE" or "POSTGRES":')
Object.keys(process.env).filter(key => 
  key.includes('DATABASE') || key.includes('POSTGRES')
).forEach(key => {
  console.log(`${key}: ${process.env[key]}`)
})