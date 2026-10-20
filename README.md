# TrustVault

Secure document sharing where the wrong person cannot read a file, and you can prove who did.
Built for the Snovasys Fresher Hiring Challenge 2026.

**Status: Milestone 1 of 4.** Authentication, sessions, schema, tests and deploy setup are in.
Documents, permissions, audit logging and the admin dashboard come in Milestones 2 and 3.
See [`THREATS.md`](THREATS.md) for exactly what is done, planned and knowingly accepted.

| | |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express (one process also serves the built frontend) |
| Database | PostgreSQL + Prisma |
| Auth | Server-side sessions stored in PostgreSQL; passwords hashed with scrypt |
| Tests | Vitest + Supertest, against a real PostgreSQL test database |

## Documents in this repo

- [`API.md`](API.md): every endpoint and who may call it
- [`THREATS.md`](THREATS.md): threats, what I did, what I accepted
- [`PROMPTS.md`](PROMPTS.md) and [`AI_CONTEXT.md`](AI_CONTEXT.md): how AI was used, and where it was wrong
- [`DEPLOY.md`](DEPLOY.md): deploying from a clean clone

## Run it locally

You need Node 20+ and PostgreSQL 14+. If you have Docker:

```
docker run --name trustvault-db -e POSTGRES_PASSWORD=devpassword -p 5432:5432 -d postgres:16
docker exec trustvault-db createdb -U postgres trustvault
docker exec trustvault-db createdb -U postgres trustvault_test
```

Then:

```
cp server/.env.example server/.env      # fill in the passwords and SESSION_SECRET (see comments inside)
npm run install:all
npm --prefix server run db:migrate:dev  # creates the tables
npm run seed                            # optional: demo accounts (needs SEED_* variables in server/.env)
npm run dev:server                      # terminal 1, http://localhost:4000
npm run dev:client                      # terminal 2, http://localhost:5173
```

Open <http://localhost:5173>.

## Run the tests

```
npm test
```

The test database name **must contain "test"**: the tests wipe it, and refuse to run against anything else.
Tests apply migrations to the test database automatically.

## Demo accounts (live deployment)

*Fill this in after you seed the deployed database.*

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@trustvault.example` | *(your SEED_ADMIN_PASSWORD)* |
| Document owner | `owner@trustvault.example` | *(your SEED_DEMO_PASSWORD)* |
| Viewer | `viewer@trustvault.example` | *(your SEED_DEMO_PASSWORD)* |
| Unrelated user | `stranger@trustvault.example` | *(your SEED_DEMO_PASSWORD)* |

These passwords are public by design (the challenge requires it). The demo contains no real data.

## Roles and permission model (in my own words)

- **Administrator** (global role): manages users and reads the audit log. Does **not** automatically
  get to read document contents; an admin who is not the owner or a grantee gets "not found" like anyone else.
- **Owner** (per document): whoever uploaded it. Only the owner can delete it or grant and revoke access.
- **Viewer / editor** (per document): a named user holding a `READ` or `EDIT` grant. `EDIT` includes `READ` and
  allows changing the title and description and replacing the file.
- A document is reachable **only** if you own it or hold a grant. No folders, groups or share links.
- "No access" always looks like "does not exist" (404), so nobody can probe which documents exist.
- Access is re-read from the database on every request, so revocation applies on the very next one.

## Scope decisions

Not built, on purpose: folders and groups, share links, external sharing, version history,
trash and recovery, MFA, password reset. Reasons are in `THREATS.md`.

## Project layout

```
client/                React app (UI only; makes no security decisions)
server/src/
  app.js               builds the Express app
  server.js            starts it
  config.js            validates environment variables; refuses unsafe settings
  routes/registry.js   THE ROUTE TABLE: every endpoint and its access level
  routes/auth.js       register / login / me / logout
  middleware/          requireAuth, requireAdmin, origin check, error handler
  security/password.js scrypt hashing
  services/sessions.js session helpers, "log out everywhere"
server/prisma/         schema and migrations
server/scripts/seed.js creates demo accounts from environment variables
server/tests/          Vitest + Supertest
```
