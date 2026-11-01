import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import * as schema from '../server/db/schema';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateId } from '../server/utils/id';
import { DEFAULT_AGENT_INSTRUCTIONS, DEFAULT_TASK_WORKFLOW } from '../server/db/defaults';
import { getMysqlConnectionOptions } from '../server/db/mysql-connection-options';

const MIGRATION_LOCK_NAME = 'moo-agent-board:migrations';
const MIGRATION_LOCK_TIMEOUT_SECONDS = 300;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Starting migration script...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const migrationsFolder = path.join(__dirname, '../drizzle');
  console.log(`Migrations folder: ${migrationsFolder}`);

  if (fs.existsSync(migrationsFolder)) {
    const files = fs.readdirSync(migrationsFolder);
    console.log('Files in migrations folder:', files);
    files.forEach(file => {
      if (file.endsWith('.sql')) {
        const content = fs.readFileSync(path.join(migrationsFolder, file), 'utf8');
        console.log(`--- Content of ${file} (first 100 chars) ---`);
        console.log(content.substring(0, 100).replace(/\n/g, ' '));
        console.log('-----------------------------------------');
      }
    });
  } else {
    console.error('Migrations folder does not exist!');
  }

  console.log('Connecting to database...');
  const connection = await mysql.createConnection(
    getMysqlConnectionOptions(databaseUrl, process.env.DB_SSL),
  );
  const db = drizzle(connection, { schema, mode: 'default' });

  let migrationLockAcquired = false;
  try {
    console.log('Waiting for the database migration lock...');
    const [lockRows] = await connection.query<RowDataPacket[]>(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [MIGRATION_LOCK_NAME, MIGRATION_LOCK_TIMEOUT_SECONDS],
    );
    if (lockRows[0]?.acquired !== 1) {
      throw new Error(`Could not acquire database migration lock within ${MIGRATION_LOCK_TIMEOUT_SECONDS} seconds`);
    }
    migrationLockAcquired = true;

    console.log('Running migrations...');
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully!');
    
    console.log('Seeding default instructions...');
    const existing = await db.select().from(schema.instructions);
    if (existing.length === 0) {
      const now = new Date();
      await db.insert(schema.instructions).values([
        {
          id: generateId(),
          boardId: null,
          type: 'agent_instructions',
          content: DEFAULT_AGENT_INSTRUCTIONS,
          isDefault: true,
          updatedAt: now,
          updatedBy: null,
        },
        {
          id: generateId(),
          boardId: null,
          type: 'task_workflow',
          content: DEFAULT_TASK_WORKFLOW,
          isDefault: true,
          updatedAt: now,
          updatedBy: null,
        },
      ]);
      console.log('Default instructions seeded.');
    } else {
      console.log('Instructions already exist, skipping seed.');
    }

  } catch (error) {
    console.error('Migration failed!');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (migrationLockAcquired) {
      try {
        await connection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]);
      } catch (error) {
        console.error('Failed to release database migration lock:', error);
        process.exitCode = 1;
      }
    }
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Unexpected error in migration script:');
  console.error(err);
  process.exitCode = 1;
});
