# @oj/frontend

Next.js (App Router) frontend for the classroom Online Judge. UI language: Vietnamese.
Design notes are in [DESIGN.md](./DESIGN.md).

## Development

```bash
pnpm install                       # from the repo root
cp src/frontend/.env.example src/frontend/.env.local   # optional, defaults to http://localhost:4000/api
pnpm --filter @oj/frontend dev     # http://localhost:3000
```

Other scripts: `build` (builds `@oj/contracts` first, then `next build`), `start`, `typecheck`.

The app is fully client-side against the REST API (`docs/API.md`). The JWT is kept in
`localStorage` (`oj:token`); the current user always comes from `GET /auth/me`.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/login`, `/register` | public | Sign in; student self-registration |
| `/` | all | Role-aware home with the next action |
| `/problems`, `/problems/[id]` | all | Problem catalog; statement + editor + live verdict (`?set=<id>` solves inside a problem set) |
| `/submissions`, `/submissions/[id]` | all | Submissions (students: own; staff: all, filterable) |
| `/sets`, `/sets/[id]` | all | Problem sets; students see their best score per problem |
| `/sets/new`, `/sets/[id]/edit`, `/sets/[id]/results` | staff | Set builder, results table (CSV export) |
| `/sets/[id]/print`, `/sets/[id]/answer-key` | staff | Printable exam paper / answer key (A4, `window.print()`) |
| `/admin/problems/new`, `/admin/problems/[id]` | admin | Problem editor, test cases, solution |
| `/admin/import` | admin | Import .docx/.pdf exams, review drafts, confirm |
| `/admin/users` | admin | Users, create teacher accounts |

## Deploying to Vercel

1. Import the repository in Vercel and set **Root Directory** to `src/frontend`.
   Keep "Include source files outside of the Root Directory" enabled (default) so `src/shared` is available.
2. Framework preset: **Next.js**. Vercel detects the pnpm workspace from `pnpm-lock.yaml` and runs
   the install at the monorepo root. Leave the install command as default (`pnpm install`), or set it
   explicitly to `pnpm install --frozen-lockfile`.
   The root `package.json` pins pnpm via `packageManager`; set the env var `ENABLE_EXPERIMENTAL_COREPACK=1`
   so Vercel uses that exact pnpm version.
3. Build command: default (`pnpm run build`). It runs `pnpm --filter @oj/contracts build && next build`,
   so the shared contracts are compiled before the Next.js build.
4. Environment variable: `NEXT_PUBLIC_API_URL` = public URL of the backend API, e.g.
   `https://api.example.com/api`. It is inlined at build time, so redeploy after changing it.
   The backend must allow the Vercel domain in its CORS settings.

No `vercel.json` is needed.
