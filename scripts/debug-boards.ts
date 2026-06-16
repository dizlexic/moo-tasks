import { db } from '../server/db/index.js';
import { boards, boardMembers } from '../server/db/schema.js';

async function debugBoards() {
  try {
    console.log('Fetching boards...');
    const results = await db.select().from(boards);
    console.log('Boards count:', results.length);
    console.log('Boards:', JSON.stringify(results, null, 2));

    console.log('Fetching members...');
    const members = await db.select().from(boardMembers);
    console.log('Members count:', members.length);
    console.log('Members:', JSON.stringify(members, null, 2));
  } catch (e) {
    console.error('Error debugging boards:', e);
  }
  process.exit(0);
}
debugBoards();
