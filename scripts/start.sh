#!/bin/sh
set -e

npm run build

echo "Checking database connection..."
# Wait for database port to be open
node -e "
const net = require('net');
const check = () => {
  const client = net.createConnection({ host: process.env.DB_HOST || 'db', port: process.env.DB_PORT || 3306 }, () => {
    console.log('Database port is open');
    client.end();
    process.exit(0);
  });
  console.log('Attempting to connect to:', process.env.DB_HOST || 'db', 'port:', process.env.DB_PORT || 3306);
  client.on('error', (err) => {
    console.log('Waiting for database connection (' + (process.env.DB_HOST || 'db') + ':' + (process.env.DB_PORT || 3306) + ')... ' + err.message);
    setTimeout(check, 2000);
  });
};
check();
"

# Test actual database login and query
echo "Testing database credentials..."
node -e "
const mysql = require('mysql2/promise');
async function test() {
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('Successfully connected to database');
    const [rows] = await conn.query('SELECT 1 as result');
    console.log('Database query test successful:', rows[0].result);
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('DATABASE CONNECTION ERROR:', err.message);
    process.exit(1);
  }
}
test();
"

echo "Verifying migration files..."
ls -l /app/drizzle

echo "Running migrations..."
echo "DATABASE_URL: $(echo $DATABASE_URL | sed 's/:[^@]*@/:****@/')"

# Run migrations with direct tsx script for better error logging
npx tsx scripts/migrate.ts || {
  echo "------------------------------------------------"
  echo "MIGRATION FAILED!"
  echo "Check the error message above for details."
  echo "------------------------------------------------"
  exit 1
}

echo "Starting server in ${NODE_ENV:-production} mode..."
if [ "${NODE_ENV:-production}" = "production" ]; then
  # Use sh -c to ensure environment variables are expanded correctly
  exec npm run serve
else
  exec npm run dev -- --host 0.0.0.0
fi
