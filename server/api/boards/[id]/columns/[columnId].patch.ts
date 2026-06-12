import { eq, and } from 'drizzle-orm';
import { db } from '#server/db';
import { boardColumns } from '#server/db/schema';
import { invalidateBoardMetadata } from '../../../utils/board-mcp';

export default defineEventHandler(async (event) => {
  const boardId = event.context.params!.id;
  const columnId = event.context.params!.columnId;
  const body = await readBody(event);

  const updateData: any = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.instructions !== undefined) updateData.instructions = body.instructions;
  if (body.permissions !== undefined) updateData.permissions = body.permissions;

  const updatedColumn = await db.update(boardColumns)
    .set(updateData)
    .where(and(eq(boardColumns.id, columnId), eq(boardColumns.boardId, boardId)));

  invalidateBoardMetadata(boardId);
  return updatedColumn;
});
