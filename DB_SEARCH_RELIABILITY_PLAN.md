## DB & Search Stabilization Plan (Vercel + Supabase)

- [x] Create plan file with steps
- [x] Inspect env files for DB URLs
- [x] Map Prisma usage and migrations
- [ ] Design attachDatabasePool integration
- [x] Design sourceFiles filter fix
- [x] Implement sourceFiles filter fix
- [x] Outline monitoring additions
- [ ] Confirm implementation steps with user

### Goals
- Stabilize DB connections on Vercel (Fluid Compute, pooling, no leaks).
- Fix search query correctness and reduce unnecessary DB load.
- Add pragmatic monitoring for fast root-cause analysis.

### Constraints
- Vercel dashboard settings (Fluid Compute, Rolling Releases) are applied outside code.
- Supabase pooler limits are low; code must minimize connections per request.

### High-Level Approach
1) Verify env: `DATABASE_URL`/`DIRECT_URL` include pooling flags (`pgbouncer=true`, `connection_limit=1`, `pool_timeout=20`, `sslmode=require`).
2) Single Prisma client: avoid extra clients per request; gate runtime migrations.
3) Vercel integration: use `attachDatabasePool()` to prevent leaks during suspend.
4) Search load: fix `sourceFiles` filter; avoid unsupported JSON path; reduce redundant queries.
5) Monitoring: structured error logs, optional health endpoint, slow-query timing.

### Rollout
- Phase 1: Env validation + attachDatabasePool + remove per-request `SELECT 1`.
- Phase 2: Fix `sourceFiles` filter (JSON array_contains) and query concurrency tweaks.
- Phase 3: Monitoring hooks and health endpoint.

### Design: attachDatabasePool Integration
- Import `attachDatabasePool` from `@vercel/functions` in `src/lib/db-config.ts` and `src/lib/deployment-migrate.ts`.
- After creating the Prisma client, call `attachDatabasePool(db)` and `attachDatabasePool(migrationClient)`.
- Keep a single global instance (already present) and avoid creating clients in request scope.
- Ensure `DATABASE_URL` includes pooling flags; avoid setting pool size in code—defer to connection string.

Example (planned):
```
import { attachDatabasePool } from '@vercel/functions'
export const db = globalForPrisma.prisma ?? new PrismaClient(/* ... */)
attachDatabasePool(db)
```

### Design: `sourceFiles` Filter Fix
- Current (incorrect): Prisma JSON path with `path: ['$[*]']` is unsupported.
- Short-term fix (Postgres): use JSONB containment `sourceFiles @> '["<fileId>"]'` via `db.$queryRaw` (or a helper that augments `where` with raw SQL filter).
- SQLite: keep direct `fileId` equality.
- Longer-term: migrate `sourceFiles` to `String[]` and use Prisma `has/hasSome` for portable filters.

### Monitoring Additions (Planned)
- Add a lightweight `/api/health/db` route that runs `SELECT 1` with timeout and returns pool info hints (env-derived) and timing.
- Standardize error logging: include `code` (e.g., `P1001`), `durationMs`, `queryKind`, `route`, and `requestId` (if present).
- Measure query durations in search and data routes using existing `PerformanceMonitor` and include slow query warnings (`>1s`).
- Optional: add a `DB_DEBUG` flag to enable verbose connection attempts and retry diagnostics in production safely.

### Findings (Step: Env Inspection)
- `.env` contains malformed line: `NEXT_TELEMETRY_DISABLED=1DATABASE_URL=...` (missing newline), which corrupts both variables.
- Multiple DB configs in `.env` (local Postgres and Supabase pooler) co-exist; risk of loading wrong URL depending on runtime.
- `.env.test.local` uses Supabase pooler `:6543` and direct `:5432`; has `pgbouncer=true` but no explicit `connection_limit`/`pool_timeout`/`sslmode=require` flags.
- Vercel uses dashboard env; ensure production `DATABASE_URL` includes pooling flags and correct project/region.

### Findings (Step: Prisma & Migrations Mapping)
- Runtime clients: `db` (src/lib/db-config.ts) + separate `migrationClient` (src/lib/deployment-migrate.ts).
- `ensureMigrationsRun()` is called on hot paths in: `/api/search`, `/api/excel/data`, `/api/excel/files`.
- Per-request connection checks: `/api/excel/data` and `/api/excel/files` run `SELECT 1` before real work.
- Search endpoint issues: uses unsupported JSON path on `sourceFiles` (`path: ['$[*]']`), and runs multiple queries concurrently via `Promise.all`.
