import { describe, expect, it } from 'vitest'
import { getMysqlConnectionOptions } from '../../server/db/mysql-connection-options'

describe('getMysqlConnectionOptions', () => {
  it('translates ssl-mode=REQUIRED into mysql2 TLS options', () => {
    const options = getMysqlConnectionOptions('mysql://user:pass@db:3306/tasks?ssl-mode=REQUIRED&charset=utf8mb4')

    expect(options.uri).toBe('mysql://user:pass@db:3306/tasks?charset=utf8mb4')
    expect(options.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('uses DB_SSL when the URL does not specify an SSL mode', () => {
    const options = getMysqlConnectionOptions('mysql://user:pass@db:3306/tasks', 'REQUIRED')

    expect(options.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('allows an explicit disabled mode to override DB_SSL', () => {
    const options = getMysqlConnectionOptions('mysql://user:pass@db:3306/tasks?ssl-mode=DISABLED', 'REQUIRED')

    expect(options.ssl).toBeUndefined()
  })

  it('rejects unsupported SSL modes instead of silently ignoring them', () => {
    expect(() => getMysqlConnectionOptions('mysql://user:pass@db:3306/tasks?ssl-mode=UNKNOWN')).toThrow(
      'Unsupported MySQL ssl-mode: UNKNOWN',
    )
  })
})