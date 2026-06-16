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
    console.log('Using DATABASE_URL:', databaseUrl);
    try {
      const url = new URL(databaseUrl)
      console.log('Parsed URL:', url.hostname, url.port);
      const sslParam = url.searchParams.get('ssl')
      const sslModeParam = url.searchParams.get('ssl-mode')

      // Strip ssl/ssl-mode from URL and pass SSL as a proper config object.
      // mysql2 doesn't recognise ssl-mode (DigitalOcean style) or bare
      // ssl=true strings — it needs an actual ssl options object.
      if (sslParam || sslModeParam) {
        url.searchParams.delete('ssl')
        url.searchParams.delete('ssl-mode')
      }

      const needsSsl = !!(sslParam || sslModeParam)
      const cleanUrl = url.toString()

      return {
        ...baseOpts,
        uri: cleanUrl,
        ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }
    } catch {
      // Fallback to original string if URL parsing fails
      return { ...baseOpts, uri: databaseUrl }
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

const poolConnection = mysql.createPool(getPoolConfig())

export const db = drizzle(poolConnection, { schema, mode: 'default' })
