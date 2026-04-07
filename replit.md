# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (via `@clerk/express` server-side, `@clerk/react` client-side)
- **Frontend**: React + Vite, TanStack Query, Wouter routing, Tailwind CSS + shadcn/ui

## Artifacts

- `artifacts/api-server` — Express REST API, port via `$PORT`, base path `/api`
- `artifacts/home-inventory` — React+Vite frontend, dark theme

## Auth Architecture

- Clerk keys auto-provisioned (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`)
- All API routes protected by `requireAuth` middleware (uses `getAuth(req)` from `@clerk/express`)
- `req.userId` (Clerk user ID) used server-side instead of any client-supplied `createdBy`
- Households are filtered by `userId` (column on `households` table)
- Frontend: `ClerkProvider` wraps app inside `<WouterRouter>`, home route (`/`) is public landing page, authenticated users redirect to `/dashboard`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
