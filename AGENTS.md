# AGENTS.md

> Drop this file into the root of any project that uses a **Moo Tasks** board as
> its task queue. It tells AI coding agents how to discover, accept, and complete work for this
> repository through the board's MCP server.

---

## 1. What is the Moo Tasks board?

Moo Tasks is a kanban board (available at [mootasks.dev](https://mootasks.dev)) that exposes each board as its own
[Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
(MCP) server. The endpoint is **scoped to a single board** — an agent connected
to one board can never see or modify tasks on any other board.

Each task on the board has two identifiers:
- **ID**: A unique, permanent string ID (e.g., \`A86rlBBUBe3f\`) used in tool calls.
- **Board Task ID**: A sequential numeric ID specific to the board (e.g., \`1\`, \`2\`). Use this for easier reference in conversation.

- **Endpoint URL:** `https://mootasks.dev/api/boards/<boardId>/mcp` (or your self-hosted host)
- **Global Endpoint:** `https://mootasks.dev/api/mcp` (requires account token)
- **Transport:** `streamable-http`
- **Authorization Flow:** All requests must include the `Authorization` header.
  Use the format: `Authorization: Bearer <your-bearer-token>` (per
  [MCP basic spec](https://modelcontextprotocol.io/specification/2025-11-25/basic))

> ⚠️ Tokens via `?token=` query string are **not supported**. Always use the
> `Authorization` header.

---

## 2. Connecting your agent

On the board page, click **Show MCP Config → 📋 Copy JSON**. Paste the snippet
into your MCP client's config:

```json
{
  "mcpServers": {
    "moo-tasks": {
      "type": "streamable-http",
      "url": "https://mootasks.dev/api/boards/<boardId>/mcp",
      "headers": {
        "Authorization": "Bearer <your-bearer-token>"
      }
    }
  }
}
```

Common locations:

| Client       | Path                            |
|--------------|---------------------------------|
| Claude Code  | `~/.claude.json` or project `.mcp.json` |
| Cursor       | `.cursor/mcp.json`              |
| VS Code      | `.vscode/mcp.json`              |
| JetBrains    | Settings → Tools → MCP Servers  |
| Junie        | Settings → MCP Servers          |

---

## 3. Available MCP tools

Once connected, the following tools are available (subject to per-board toggles in board settings).

Note: The MCP server dynamically checks your board's `mcpEnabledFunctions` configuration when you invoke these tools. If a tool is disabled in the board settings, the agent will receive a "Tool disabled" error if it attempts to invoke it.

| Tool                  | Purpose                                               |
|-----------------------|-------------------------------------------------------|
| `list-tasks`          | Discover open tasks (filter by status/priority/limit — `todo` limited to 10 by default) |
| `get-task`            | Read full details of a single task                    |
| `get-comments`        | Read all comments on a task                           |
| `accept-task`         | Claim a task — assigns you and sets `in_progress`     |
| `add-comment`         | Post progress notes / questions on a task             |
| `update-task-status`  | Move a task between columns                           |
| `submit-for-review`   | Mark a task ready for human review                    |
| `request-corrections` | Create a linked correction task off a reviewed task   |
| `reject-task`         | Reject a task review and move it back to todo (AI review) |
| `create-task`         | File a new task on the board                          |
| `delete-task`         | Remove a task (use sparingly)                         |
| `generate-changelog`  | Generate a markdown changelog based on completed (done) tasks |
| `list-plans`          | Discover available task plans (templates) |
| `apply-plan`         | Apply a task plan to this board |
| `create-board`        | Create a new board (requires account token or board owner context) |
| `get-installation-instructions` | Get instructions for installing/setting up Moo Tasks |

Plus resources/prompts:

- Resource `moo-tasks://<boardId>/board-state` — full board snapshot
- Resource `moo-tasks://<boardId>/agent-instructions` — board-specific guidance
- Prompt `task-workflow` — guided workflow for picking up & finishing tasks

---

## 4. Recommended workflow for agents

When a human asks you to "work on the board" (or whenever you have idle
capacity on this project), follow this loop:

1. **Read instructions first.** Fetch the
   `moo-tasks://<boardId>/agent-instructions` resource and the `task-workflow`
   prompt — these may contain project-specific rules that override this file.
2. **Discover work.** Call `list-tasks` (filter `status=todo`, sort by priority)
   to find unclaimed tasks. Note: `todo` results are limited to 10 by default; 
   explicitly use the `limit` parameter to retrieve more tasks if needed. If AI review is enabled, you can 
   also filter by `status=review` to find tasks that need verification.
3. **Pick one task.** Prefer `critical` > `high` > `medium` > `low`. Read the
   full task with `get-task` and any prior `get-comments`.
4. **Accept it.** Call `accept-task` with a stable, unique `agentName` (e.g. `"<model>-<handle>"`). This locks the task to
   you and moves it to `in_progress`. This helps humans and other agents identify who is working on the task.
5. **Work in this repository.** Make the code changes the task describes, or 
   if you are reviewing, verify the implementation.
6. **Communicate.** Use `add-comment` for non-trivial decisions, blockers,
   or questions. Comments are visible to humans on the board in real time.
7. **Submit for review.** When done, comment a summary of your changes as a "Task Result" in markdown, then call `submit-for-review` with the task ID. 
   If you were reviewing, call `update-task-status` to move it to `done` if it passes, 
   or `reject-task` if it fails.
   Do **not** mark tasks `done` yourself unless you are reviewing another agent's task — humans (or a reviewer agent) move
   tasks from `review` to `done` after verifying.
8. **Handle corrections.** If a human creates a correction task linked to your
   original (parent) task, treat it as a new top-priority item: accept it,
   address the feedback, and submit it for review.

### Rules of thumb

- ✅ Always `accept-task` **before** writing code, so humans see who's working.
- ✅ **Always check for comments** before starting work; they often contain
  crucial context, constraints, or previous discussions.
- ✅ One task at a time per agent identity.
- ✅ If a task is unclear, leave a comment asking for clarification rather than
  guessing — and leave the task in `todo` (don't accept it yet).
- ❌ Don't `delete-task` unless explicitly told to.
- ❌ Don't move tasks straight to `done` — always go through `review`.
- ❌ Don't try to access tasks from other boards; this token only works for
  the single board it was issued for.

### Self-Sustaining Loop (TDD & Automation)

To ensure continuous project improvement, follow this loop when no tasks are assigned or the board is empty:

1. **Discovery:** If `list-tasks` returns zero `todo` tasks, run the discovery script: `node scripts/discover-gaps.mjs`. This script analyzes the codebase and identifies gaps in tests, documentation, or features.
2. **Generation:** Create new discrete tasks using the `create-task` tool based on the findings from the discovery script. Each task should focus on one of the following areas:
   - **Test implementation:** Unit, integration, or E2E tests for existing or new logic.
   - **Performance & Fuzzing:** Add benchmarks or fuzz tests to stress-test critical components.
   - **Security:** Audit sensitive areas (auth, DB access) and add security-focused tests.
   - **Refactoring:** Identify technical debt and propose refactoring tasks with a focus on TDD.
3. **TDD Best Practices:** When creating tasks, structure them to follow TDD (red-green-refactor). Start by defining a reproduction script or a failing test case that demonstrates the need for the change.
4. **Maintenance:** Periodically review `done` tasks and run `generate-changelog` to keep documentation up to date.

---

## 5. Security notes for humans

- Treat the bearer token like a password. Anyone with it can act as an agent
  on your board.
- Rotate tokens from the board settings drawer if a token leaks; revocation
  is instant.
- Prefer per-agent or per-environment tokens if your deployment supports it.
- Public boards (`mcpPublic = true`) skip auth entirely and should only be
  used for read-only demos.

---

## 6. Database schema & migrations (Drizzle)

This project uses [Drizzle ORM](https://orm.drizzle.team) with the **MySQL**
dialect. The schema lives in `server/db/schema.ts`, and generated SQL
migrations live in `drizzle/` (with the source-of-truth journal at
`drizzle/meta/_journal.json`). Agents must follow the rules below to keep
the schema consistent and migrations **non-destructive**.

### Available scripts

| Script              | What it does                                                           |
|---------------------|------------------------------------------------------------------------|
| `npm run db:generate` | Diff `server/db/schema.ts` vs the latest snapshot → emit a new `drizzle/<NNNN>_*.sql` and update `meta/`. **Use this for every schema change.** |
| `npm run db:migrate`  | Apply pending migrations (in journal order) inside a transaction. Tracked via `__drizzle_migrations`. |
| `npm run db:push`     | Push schema directly to the DB **without** writing a migration file. ⚠️ Dev-only / scratch DBs — never use against shared, staging, or prod data. |
| `npm run db:seed`     | Run the seed script.                                                  |

### Golden rules for agents

- ✅ **Edit `server/db/schema.ts` first**, then run `npm run db:generate`. Never
  hand-write a migration file unless an existing generated one needs a small,
  documented tweak.
- ✅ **Commit the generated artifacts together**: the new `drizzle/<NNNN>_*.sql`,
  the updated `drizzle/meta/_journal.json`, and the new
  `drizzle/meta/<NNNN>_snapshot.json`. They are a single atomic unit.
- ✅ **Keep migrations append-only.** Once a migration has been merged or run
  against any shared environment, treat it as immutable. Fix mistakes by
  generating a *new* migration on top.
- ✅ **Preserve sequential numbering** (`0000`, `0001`, `0002`, …) and the
  numbering style Drizzle emits. The number must match the entry in
  `_journal.json`.
- ❌ **Never drop journal entries or delete an applied migration file.** Drizzle
  hashes file content; a missing/altered file mid-history breaks `db:migrate`
  for everyone.
- ❌ **Never add a `.sql` file to `drizzle/` without a matching journal entry.**
  Orphaned files are ignored at best and cause hash drift at worst.
- ❌ **Don't use `db:push` against the dev DB shared with humans** — it skips
  the journal, so the next `db:migrate` will diverge.

### Writing non-destructive migrations

Production data must survive every migration. When generating or reviewing a
migration, follow these patterns:

1. **Additive over destructive.** Prefer `ADD COLUMN`, `CREATE TABLE`,
   `CREATE INDEX`. Avoid `DROP COLUMN`, `DROP TABLE`, `RENAME COLUMN`, or
   narrowing type changes in a single step.
2. **New columns must be nullable or have a default.** MySQL will fail
   `ADD COLUMN <x> NOT NULL` on a non-empty table without a default. Either
   make the column nullable, give it a default, or split the change into:
   *(a)* add nullable → *(b)* backfill data → *(c)* a later migration
   tightening the constraint.
3. **Renames are two-step.** To rename `foo` → `bar`: add `bar`, dual-write
   in code, backfill, switch reads to `bar`, then drop `foo` in a *later*
   migration once nothing references it.
4. **Drops are two-step too.** First stop writing the column/table in code
   and ship that release; then generate a migration that drops it.
5. **Backfills go in their own migration** (or a separate idempotent script
   under `scripts/`). Keep DDL and large `UPDATE`s separated so a slow
   backfill doesn't hold a DDL lock.
6. **MySQL has no `IF NOT EXISTS` for `ADD COLUMN`.** Don't try to make
   migrations idempotent by hand — rely on the `__drizzle_migrations`
   table to ensure each migration runs exactly once.
7. **Foreign keys / indexes:** add them in a follow-up migration after the
   column is populated, especially on large tables.

### Recovering from drift

If `db:migrate` fails with `ER_DUP_FIELDNAME` (or similar) it usually means
the DB already has a change that Drizzle thinks is pending — the
`__drizzle_migrations` table is out of sync with `drizzle/`.

**For a fresh start in Docker:**
If you are seeing errors about "Duplicate column" or "Table already exists" during the initial setup, it's often because a previous failed attempt left the database in a partially initialized state. Run the following command to start from a clean slate:

```bash
docker compose down -v && docker compose up --build
```

The `-v` flag is critical as it removes the persistent database volume.

**Manual recovery:**
1. Confirm the column/table actually exists in the DB.
2. Verify the migration file content matches `drizzle/meta/_journal.json`
   (don't edit the SQL after the fact).
3. Compute the migration hash the same way Drizzle does and insert it into
   `__drizzle_migrations` so the migration is marked applied:

   ```bash
   FILE=drizzle/0001_add_mcp_enabled_functions.sql
   HASH=$(node -e "const c=require('fs').readFileSync('$FILE','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean); console.log(require('crypto').createHash('sha256').update(c.join('')).digest('hex'))")
   # use the matching `when` value from drizzle/meta/_journal.json
   mysql ... -e "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('$HASH', <when>);"
   ```

4. Re-run `npm run db:migrate` and confirm `[✓] migrations applied successfully!`.

See [`docs/drizzle-migrations.md`](docs/drizzle-migrations.md) for the full
playbook, including snapshot/journal anatomy and review checklist.

---

## 7. AI Integration (Ollama)

This project supports local AI integration via [Ollama](https://ollama.com).

### Configuration
Configure the Ollama connection via environment variables:

- `OLLAMA_API_URL` (default: `http://localhost:11434`)
- `OLLAMA_MODEL` (default: `llama3`)

---

## 8. Customizing this file

The `agent-instructions` resource on the board lets you ship board-specific
overrides without editing this file. Keep `AGENTS.md` for repo-level
conventions (build commands, code style, test commands) and use the board's
agent instructions for workflow tweaks.
