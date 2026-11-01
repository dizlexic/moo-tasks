# Drizzle migrations playbook

This document is the long-form companion to the **Database schema &
migrations (Drizzle)** section in [`AGENTS.md`](../AGENTS.md). It is aimed at
both humans and AI coding agents working on this repository.

The TL;DR is in `AGENTS.md`. Read this when you need to *understand* what
Drizzle is doing under the hood, debug a broken migration, or design a
non-trivial schema change.

---

## 1. Layout

```
server/db/schema.ts        # Source of truth for the schema (TypeScript)
drizzle.config.ts          # Tells drizzle-kit where the schema and DB are
drizzle/
├── 0000_*.sql             # Generated SQL migration files
├── 0001_*.sql
├── 0002_*.sql
├── 0003_*.sql
└── meta/
    ├── _journal.json      # Ordered list of every migration + timestamp ("when")
    ├── 0000_snapshot.json # Snapshot of the schema *after* each migration
    ├── 0001_snapshot.json
    └── ...
```

Database side:

- `__drizzle_migrations` — Drizzle's bookkeeping table. Each row is
  `{ id, hash, created_at }` for one applied migration. The `hash` is a
  **SHA-256 of the concatenated, trimmed statements** of the SQL file
  (split on `--> statement-breakpoint`).

If `drizzle/`, `_journal.json`, and `__drizzle_migrations` agree, everything
"just works". Drift between any two of them is the source of ~all migration
pain.

---

## 2. Day-to-day workflow

### Adding a column / table / index

1. Edit `server/db/schema.ts`.
2. Run:
   ```bash
   npm run db:generate
   ```
   Drizzle-kit will:
   - Create `drizzle/<NNNN>_<slug>.sql`.
   - Append an entry to `drizzle/meta/_journal.json`.
   - Write `drizzle/meta/<NNNN>_snapshot.json`.
3. **Read the generated SQL.** If it contains anything destructive
   (`DROP COLUMN`, `DROP TABLE`, `MODIFY COLUMN ... NOT NULL` on existing
   data, `RENAME`, etc.), stop and reconsider — see §3 below.
4. Apply locally:
   ```bash
   npm run db:migrate
   ```
5. Commit **all** of the generated files together with the schema change.

### Reviewing a migration PR

Checklist:

- [ ] Exactly one new file in `drizzle/`, sequentially numbered.
- [ ] `drizzle/meta/_journal.json` has exactly one new entry, matching the
      file's number/tag.
- [ ] Exactly one new `drizzle/meta/<NNNN>_snapshot.json`.
- [ ] No edits to previously-merged `*.sql` files or older snapshots.
- [ ] SQL is non-destructive (or destructive changes are explicitly called
      out and staged across releases — see §3).
- [ ] New `NOT NULL` columns have a default *or* the table is empty.
- [ ] Migration succeeds against a copy of staging data, not just an empty DB.

### Per-board task ID allocation

Migration `0023_large_sharon_carter.sql` creates the per-board task ID counter,
repairs only duplicate human-readable `board_task_id` values (keeping the
oldest task's value), adds a unique `(board_id, board_task_id)` constraint, and
backfills counters from existing tasks. Opaque task IDs and task data are not
changed. The startup migration step must complete before the updated app serves
task writes; if deploying alongside older application instances, drain those
writers first because they do not use the counter.

---

## 3. Non-destructive migration patterns

The goal: **no migration should ever lose data or break a running release.**
Use these recipes.

### Adding a NOT NULL column to a populated table

❌ One-shot:
```sql
ALTER TABLE tasks ADD COLUMN priority VARCHAR(16) NOT NULL;
-- fails on non-empty table without a default
```

✅ Three-step (across at least two releases):
1. **Migration A** — add nullable (or with a safe default):
   ```sql
   ALTER TABLE tasks ADD COLUMN priority VARCHAR(16) NULL;
   ```
2. **Migration B** — backfill (own migration, or a script in `scripts/`):
   ```sql
   UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;
   ```
3. **Migration C** — tighten the constraint once code always writes it:
   ```sql
   ALTER TABLE tasks MODIFY COLUMN priority VARCHAR(16) NOT NULL;
   ```

### Renaming a column

Don't rename in place. Expand → migrate → contract:

1. Add the new column.
2. Update code to write **both** columns.
3. Backfill old → new.
4. Switch reads to the new column.
5. Stop writing the old column.
6. In a later migration, drop the old column.

### Dropping a column or table

1. Stop reading and writing it in code; ship that release.
2. Verify with logs/metrics that nothing touches it.
3. Generate a migration that drops it.

### Changing a column type

- Widening (e.g., `VARCHAR(64)` → `VARCHAR(255)`, `INT` → `BIGINT`) is
  usually safe in one step.
- Narrowing or changing semantics (e.g., `VARCHAR` → `JSON`) should follow
  the rename pattern: add a new column, dual-write, backfill, switch, drop.

### Indexes and foreign keys

- Add them in a follow-up migration **after** the column is populated.
- For large tables, consider running `ALTER TABLE ... ALGORITHM=INPLACE,
  LOCK=NONE` manually outside the migration, then mark the migration as
  applied via `__drizzle_migrations` (see §5).

### MySQL gotchas

- ❌ `ADD COLUMN IF NOT EXISTS` — **not supported** in MySQL. Don't try to
  make migrations idempotent by hand.
- DDL is **not transactional** in MySQL — a failed multi-statement migration
  can leave the DB half-applied. The migration runner cannot make MySQL DDL
  rollback-atomic by wrapping it in a transaction. Inspect the schema and
  migration journal before retrying a failed migration, and keep migrations
  small and focused.
- `RENAME COLUMN` requires MySQL 8.0+; older servers need `CHANGE COLUMN`.

### Bearer-token digest conversion

Migrations `0020_bitter_toxin` and `0021_exotic_thunderball` convert existing
account, board, and member bearer tokens to SHA-256 digests, add unique indexes,
and clear the legacy plaintext columns. Existing account tokens receive a
90-day grace period starting when migration `0021` is applied; newly generated
account tokens expire 90 days after creation. Board and member tokens remain
revocable and board-scoped. Migration `0022_lying_wolfpack` changes the default
so new boards do not accept account-wide tokens unless an owner opts in; it
preserves existing boards' `allow_account_token` values.

The production startup script runs `scripts/migrate.ts` before starting the
application, so these migrations complete before the new digest-only handlers
serve requests. If migration fails, startup stops; inspect partial MySQL DDL
before retrying rather than starting the application against a half-migrated
schema.

---

## 4. `db:push` vs `db:migrate`

| Command          | Writes a migration file? | Tracked in `__drizzle_migrations`? | Use it for…                 |
|------------------|--------------------------|------------------------------------|-----------------------------|
| `db:generate`    | Yes (only writes file)   | n/a                                | Authoring schema changes.   |
| `db:migrate`     | No                       | Yes                                | Applying changes anywhere.  |
| `db:push`        | No                       | **No**                             | Throwaway local prototyping. |

`db:push` is convenient but **dangerous on any DB shared with humans or
deployed environments** — it skips the journal, so the next `db:migrate`
will see drift. As a rule: don't run `db:push` in this project.

---

## 5. Recovering from drift

Symptoms:

- `db:migrate` fails with `ER_DUP_FIELDNAME` / "Duplicate column name".
- `db:migrate` fails with "Unknown column" on something the schema clearly
  defines.
- `__drizzle_migrations` has fewer rows than there are files in `drizzle/`,
  even though the schema looks up to date.

Procedure:

1. **Don't edit applied migration files.** Their hash is locked in.
2. **Don't delete journal entries.** That breaks every other developer.
3. Inspect reality:
   ```sql
   SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;
   SHOW COLUMNS FROM <table>;
   ```
4. If the DB *already has* the change a pending migration wants to apply,
   mark that migration as applied by inserting its hash:
   ```bash
   FILE=drizzle/0001_add_mcp_enabled_functions.sql
   HASH=$(node -e "const c=require('fs').readFileSync('$FILE','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean); console.log(require('crypto').createHash('sha256').update(c.join('')).digest('hex'))")
   # Use the `when` value for this migration from drizzle/meta/_journal.json
   mysql ... -e "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('$HASH', <when>);"
   ```
5. Re-run `npm run db:migrate` and confirm:
   ```
   [✓] migrations applied successfully!
   ```
6. If a stray, journal-less `.sql` file exists in `drizzle/`, delete it
   (Drizzle ignores it but it confuses humans). Never delete a file that *is*
   in `_journal.json`.

---

## 6. When in doubt

- Re-read [`AGENTS.md` §6](../AGENTS.md#6-database-schema--migrations-drizzle).
- Open a comment on the related Moo Tasks board task and ask before doing
  anything destructive — schema changes are very hard to undo on shared
  data.
