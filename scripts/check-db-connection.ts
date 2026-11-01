import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getMysqlConnectionOptions } from '../server/db/mysql-connection-options';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const connection = await mysql.createConnection(
    getMysqlConnectionOptions(databaseUrl, process.env.DB_SSL),
  );
  try {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT 1 AS result');
    console.log('Successfully connected to database');
    console.log('Database query test successful:', rows[0]?.result);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('DATABASE CONNECTION ERROR:', error);
  process.exitCode = 1;
});