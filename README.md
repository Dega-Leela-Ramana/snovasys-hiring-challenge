# TrustVault

Secure document sharing where the wrong person cannot read a file, and access decisions can be checked and audited.

Built individually for the Snovasys Fresher Hiring Challenge 2026.

**Current status:** Core document management, authentication, permissions, and private document storage are implemented. Automated tests cover the application; see the test suite and `THREATS.md` for the verified security controls and remaining limitations.

## Technology stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL, Prisma |
| Authentication | PostgreSQL-backed server-side sessions; scrypt password hashing |
| File storage | Private Supabase Storage in production; local storage in development |
| Testing | Vitest, Supertest, PostgreSQL test database |

## Project documentation

- [`API.md`](API.md) — API endpoints and access requirements
- [`THREATS.md`](THREATS.md) — security threats, implemented controls, and accepted risks
- [`PROMPTS.md`](PROMPTS.md) — AI usage diary and implementation decisions
- [`AI_CONTEXT.md`](AI_CONTEXT.md) — project context and AI-related notes
- [`DEPLOY.md`](DEPLOY.md) — deployment configuration and instructions

## Features

- User registration, login, logout, and server-side sessions
- Document upload, metadata viewing, editing, and deletion
- Per-document `READ` and `EDIT` permissions
- Owner-only permission granting, updating, and revocation
- Authorization checks on document access and download requests
- Private file storage with random storage identifiers
- Upload size and allowed MIME-type checks
- Audit events for implemented document and permission actions
- Role-based administrative middleware
- Request rate limiting and security headers

## Roles and permission model

- **Owner:** owns the uploaded document; can read, edit, delete, and manage its permissions.
- **READ:** can read and download a shared document.
- **EDIT:** can read and download a shared document and edit its metadata.
- **Administrator:** has a global administrative role, but does not automatically gain access to document contents.

Document access is checked on the server. Permission changes are read from the database on subsequent requests. Unauthorized document access returns a `404` response to avoid revealing whether a document exists.

File replacement, version history, and a user-facing administrative audit-log interface are not currently exposed by the routes inspected.

## Run locally

Requirements: Node.js 20+ and PostgreSQL 14+.

If Docker is available, create a development database and a separate test database:

```bash
docker run --name trustvault-db -e POSTGRES_PASSWORD=devpassword -p 5432:5432 -d postgres:16
docker exec trustvault-db createdb -U postgres trustvault
docker exec trustvault-db createdb -U postgres trustvault_test
```

Configure `server/.env` using `server/.env.example`. Set the database connection strings and a strong session secret as described in the example file.

Install dependencies and prepare the database:

```bash
npm run install:all
npm --prefix server run db:migrate:dev
```

Optionally seed demo accounts using the `SEED_*` variables documented in the server configuration:

```bash
npm run seed
```

Start the backend in one terminal:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev:client
```

Open `http://localhost:5173`.

## Run tests

From the project root:

```bash
npm test
```

**Important:** The test database name must contain `test`. The tests modify and clear test data, and are designed to reject unsafe database targets. Never point the test configuration at a database containing real data.

## Scope and limitations

The current scope does not include folders, group sharing, public share links, external sharing, version history, trash and recovery, MFA, or password reset.

Security controls and known limitations—including audit-log tampering boundaries, file validation, and storage cleanup—are documented in [`THREATS.md`](THREATS.md).

## Project layout

```text
client/                  React frontend
server/src/
  app.js                 Express application and middleware
  server.js              Server startup
  config.js              Environment configuration and validation
  routes/registry.js     Central API route table
  routes/auth.js         Authentication handlers
  routes/documents.js    Document handlers
  routes/permissions.js  Permission management handlers
  middleware/            Authentication, origin and error checks
  security/password.js   Password hashing
  services/documentAccess.js   Document authorization
  services/documentStorage.js  File storage and validation
  services/sessions.js   Session helpers
server/prisma/           Database schema and migrations
server/scripts/seed.js   Demo account creation
server/tests/            Automated tests
```
