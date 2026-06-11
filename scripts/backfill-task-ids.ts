import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, asc } from 'drizzle-orm';
import * as schema from '../server/db/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection, { schema, mode: 'default' });

  console.log('Fetching boards...');
  const boards = await db.select().from(schema.boards);

  for (const board of boards) {
    console.log(`Backfilling tasks for board: ${board.name} (${board.id})`);
    const tasks = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.boardId, board.id))
      .orderBy(asc(schema.tasks.createdAt));

    console.log(`Found ${tasks.length} tasks.`);
    for (let i = 0; i < tasks.length; i++) {
      const boardTaskId = i + 1;
      await db.update(schema.tasks)
        .set({ boardTaskId })
        .where(eq(schema.tasks.id, tasks[i].id));
    }
    console.log(`Done for board ${board.id}.`);
  }

  console.log('Backfill completed successfully!');
  await connection.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
