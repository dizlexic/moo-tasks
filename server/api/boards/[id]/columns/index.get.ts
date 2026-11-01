import { eq, sql } from 'drizzle-orm';
import { db } from '../../../../db';
import { boardColumns, boards } from '../../../../db/schema';
import { nanoid } from 'nanoid';

export default defineEventHandler(async (event) => {
  const boardId = event.context.params!.id;
  
  let columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, boardId)).orderBy(boardColumns.order);
  
  if (columns.length === 0) {
      const defaultCols = [
        { id: nanoid(12), boardId, name: 'Backlog', order: 0, status: 'backlog' as const },
        { id: nanoid(12), boardId, name: 'To Do', order: 1, status: 'todo' as const },
        { id: nanoid(12), boardId, name: 'In Progress', order: 2, status: 'in_progress' as const },
        { id: nanoid(12), boardId, name: 'Review', order: 3, status: 'review' as const },
        { id: nanoid(12), boardId, name: 'Done', order: 4, status: 'done' as const },
      ];
      await db.transaction(async (tx) => {
        await tx.insert(boardColumns).values(defaultCols.map(c => ({ ...c, createdAt: new Date(), updatedAt: new Date() })));
        await tx.update(boards)
          .set({ mcpMetadataVersion: sql`${boards.mcpMetadataVersion} + 1` })
          .where(eq(boards.id, boardId));
      });
      columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, boardId)).orderBy(boardColumns.order);
  }
  
  return columns;
});
