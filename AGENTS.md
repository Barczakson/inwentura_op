# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js routes (app router), API routes under `src/app/api`.
- `src/components`: UI and feature components; colocated tests in `__tests__`.
- `src/hooks`: Reusable React hooks (files start with `use-...`).
- `src/lib`: Shared utilities, data-access, and adapters.
- `prisma`: Database schema, migrations, and seeds.
- `public`: Static assets. `examples/` contains optional demo pages.
- `__mocks__/`: Jest mocks for external modules.

## Build, Test, and Dev
- `npm run dev`: Start local dev (custom TS server + Next); logs to `dev.log`.
- `npm run build`: Compile Next.js production build.
- `npm start`: Run production server; logs to `server.log`.
- `npm run lint`: ESLint checks.
- `npm test` / `npm run test:watch`: Run Jest suites (client + server).
- Focused tests: e.g., `npm run test:api`, `test:client`, `test:integration`, `test:performance`.
- Prisma: `npm run db:migrate`, `db:push`, `db:seed`, `db:studio`.

## Coding Style & Naming
- Language: TypeScript + React. Indentation: 2 spaces.
- Components: PascalCase (`DataTable.tsx`). Hooks: `use-*.ts`.
- Other files: kebab-case (`file-validation.ts`). Functions/vars: camelCase.
- Prefer named exports from modules in `src/lib` and `src/components`.
- Run `npm run lint` before pushing. Tailwind is used; keep classes readable and grouped logically.

## Testing Guidelines
- Framework: Jest with separate client (`jsdom`) and server (`node`) projects.
- Locations: `src/**/__tests__/**` or `*.{test,spec}.(ts|tsx)` alongside code.
- Coverage: `npm run test:coverage` (target 80%+ where practical).
- Example: `npm run test:socket` to run socket-focused tests.

## Commit & Pull Requests
- Commits: Short, imperative summary (max ~72 chars). Include scope when helpful (e.g., `lib:` or `api:`) and a brief rationale in the body.
- PRs: Clear description, linked issues, reproduction steps, and test coverage. Add screenshots/GIFs for UI changes. Note schema changes and run `db:migrate`/`db:deploy` implications.

## Security & Configuration
- Env: Use `.env.local` for dev and `.env.test.local` for tests. Do not commit secrets.
- Run `node check-env.js` if env issues arise. Prisma runs on postinstall; ensure DB connectivity before tests.
