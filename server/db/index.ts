import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

function getPoolConfig(): mysql.PoolOptions {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  const baseOpts: mysql.PoolOptions = {
    connectTimeout: 10_000,       // 10 s TCP connect timeout
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  }

  if (databaseUrl) {
    return {
      ...baseOpts,
      uri: databaseUrl,
    }
  }

  return {
    ...baseOpts,
    host: process.env.DB_HOST === 'db' ? 'localhost' : (process.env.DB_HOST || 'localhost'),
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'mootasks',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'mootasks',
    ssl: process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  }
}

let dbConnection: mysql.Connection | mysql.Pool;

if (process.env.DATABASE_URL) {
  dbConnection = await mysql.createConnection(process.env.DATABASE_URL);
} else {
  dbConnection = mysql.createPool(getPoolConfig());
}

export const db = drizzle(dbConnection, { schema, mode: 'default' })
