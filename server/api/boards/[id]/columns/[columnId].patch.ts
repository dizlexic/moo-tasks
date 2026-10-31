import { eq, and } from 'drizzle-orm';
import { db } from '#server/db';
import { boardColumns, boardMembers } from '#server/db/schema';
import { invalidateBoardMetadata } from '#server/utils/board-mcp';

export default defineEventHandler(async (event) => {
  const boardId = event.context.params!.id;
  const columnId = event.context.params!.columnId;
  const session = await requireUserSession(event);
  const memberships = await db.select().from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.user.id)));
  if (memberships[0]?.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the board owner can update column permissions' });
  }

  const body = await readBody(event);

  const updateData: any = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.instructions !== undefined) updateData.instructions = body.instructions;
  if (body.permissions !== undefined) {
    const allowedPermissions = ['view', 'add', 'move', 'delete'] as const;
    if (!body.permissions || typeof body.permissions !== 'object' || Array.isArray(body.permissions)
      || Object.entries(body.permissions).some(([permission, value]) =>
        !allowedPermissions.includes(permission as typeof allowedPermissions[number]) || typeof value !== 'boolean'
      )) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid column permissions' });
    }
    updateData.permissions = {
      view: true,
      add: true,
      move: true,
      delete: true,
      ...body.permissions,
    };
  }

  const updatedColumn = await db.update(boardColumns)
    .set(updateData)
    .where(and(eq(boardColumns.id, columnId), eq(boardColumns.boardId, boardId)));

  invalidateBoardMetadata(boardId);
  return updatedColumn;
});
