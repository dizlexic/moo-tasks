import type mysql from 'mysql2'

export function getMysqlConnectionOptions(databaseUrl: string, defaultSslMode?: string): mysql.ConnectionOptions {
  const url = new URL(databaseUrl)
  const sslMode = url.searchParams.get('ssl-mode') ?? defaultSslMode
  url.searchParams.delete('ssl-mode')

  const options: mysql.ConnectionOptions = { uri: url.toString() }
  if (!sslMode) {
    return options
  }

  switch (sslMode.toUpperCase()) {
    case 'DISABLED':
      return options
    case 'REQUIRED':
      options.ssl = { rejectUnauthorized: false }
      return options
    case 'VERIFY_CA':
    case 'VERIFY_IDENTITY':
      options.ssl = { rejectUnauthorized: true }
      return options
    default:
      throw new Error(`Unsupported MySQL ssl-mode: ${sslMode}`)
  }
}