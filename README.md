# COS 106 Lab Assessment

A full-stack web application built for the COS 106 lab assessment, featuring a REST API backend and a modern React component library.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Package Manager | pnpm (workspaces) |
| API Server | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API Contract | OpenAPI 3 (Orval codegen) |
| Frontend | React + Vite |
| Build | esbuild (CJS bundle) |

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express REST API (port 5000)
│   └── mockup-sandbox/      # React UI component library & previews
├── lib/
│   ├── api-client-react/    # Auto-generated React Query hooks
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-zod/             # Auto-generated Zod schemas
│   └── db/                  # Drizzle ORM schema & client
├── scripts/
│   └── src/
│       └── sync-to-github.mjs  # GitHub sync utility
├── package.json             # Root workspace config
└── pnpm-workspace.yaml      # Workspace & catalog definitions
```

## Getting Started

### Prerequisites

- [Node.js 24+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- PostgreSQL database (set `DATABASE_URL` env var)

### Install dependencies

```bash
pnpm install
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing |
| `GITHUB_TOKEN` | GitHub PAT (for sync script only) |

### Run the API server

```bash
pnpm --filter @workspace/api-server run dev
```

### Typecheck all packages

```bash
pnpm run typecheck
```

### Build all packages

```bash
pnpm run build
```

## API

The API contract lives in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml).

After editing the spec, regenerate client hooks and Zod schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated files (do not edit by hand):
- `lib/api-client-react/src/generated/` — React Query hooks
- `lib/api-zod/src/generated/` — Zod validation schemas

### Health check

```
GET /api/healthz
```

## Database

Schema is defined in [`lib/db/src/schema/index.ts`](lib/db/src/schema/index.ts).

Push schema changes to the database:

```bash
pnpm --filter @workspace/db run push
```

## Syncing to GitHub

A utility script keeps this repository up to date. It only uploads files that have changed:

```bash
node scripts/src/sync-to-github.mjs
```

Requires `GITHUB_TOKEN` environment variable with `repo` scope.

## License

MIT
