# TrustVault

**Secure document sharing with server-side authorization and auditable access decisions.**

TrustVault is a secure document management application built individually for the **Snovasys Fresher Hiring Challenge 2026**. It allows users to upload documents, manage their files, share documents with specific users, and control access through `READ` and `EDIT` permissions.

**Developer:** Dega Leela Ramana

## Live Demo

**Application:** https://trustvault-app-fczr.onrender.com/

The application is deployed using Render and Supabase. The free hosting instance may take some time to wake up after inactivity.

### Demo Accounts

The following accounts have been created in the production database and their logins have been verified.

| Role / Purpose | Email |
|---|---|
| Administrator | `admin@trustvault.example` |
| Document owner | `owner@trustvault.example` |
| Read-only recipient | `viewer@trustvault.example` |
| Independent user | `stranger@trustvault.example` |

**Demo password instructions:**

- Administrator: `AdministratoR`
- Owner, viewer, and stranger: `UserdemopasS`

## Features

- User registration, login, and logout with server-side sessions.
- Document upload, metadata viewing, editing, and deletion.
- Per-document `READ` and `EDIT` permissions.
- Owner-controlled sharing, permission updates, and revocation.
- Server-side authorization for document access and downloads.
- Private Supabase Storage in production and local storage in development.
- Upload size and allowed MIME-type validation.
- Audit events for implemented document and permission actions.
- Role-based administrative middleware.
- Request rate limiting and security headers.
- Automated tests for authentication, permissions, and document access.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| ORM and migrations | Prisma |
| Authentication | Server-side sessions, scrypt password hashing |
| File storage | Supabase Storage in production |
| Testing | Vitest, Supertest, PostgreSQL test database |
| Deployment | Render and Supabase |

## Roles and Permission Model

| Role / Permission | Capabilities |
|---|---|
| Owner | Read, edit, delete their document, and manage its sharing permissions |
| `READ` recipient | Read and download a shared document |
| `EDIT` recipient | Read and download a shared document and edit its metadata |
| Administrator | Access designated administrative functionality; does not automatically gain access to document contents |

Authorization is enforced on the server, not only by hiding frontend controls. Permission changes are read from the database on subsequent requests. Unauthorized document access returns `404` where implemented to avoid revealing whether a document exists.

## Security and Auditability

TrustVault includes:

- Server-side document authorization.
- Password hashing and server-side session management.
- Private document storage with random storage identifiers.
- Input and upload validation.
- Audit events and a SHA-256 hash chain linking audit records.
- An administrator-only audit-chain verification endpoint.
- Automated tests for permission enforcement and access restrictions.

The audit hash chain can help detect changes to recorded events and broken links. It is not an externally anchored immutable log: an attacker with sufficient database privileges may be able to rewrite the chain. See `THREATS.md` for the threat model, controls, and accepted risks.

## Project Documentation

- [`API.md`](API.md) — API endpoints and access requirements.
- [`THREATS.md`](THREATS.md) — security threats, implemented controls, and accepted risks.
- [`PROMPTS.md`](PROMPTS.md) — AI usage diary and implementation decisions.
- [`AI_CONTEXT.md`](AI_CONTEXT.md) — project context and AI-related notes.
- [`DEPLOY.md`](DEPLOY.md) — deployment configuration and instructions.

## Run Locally

### Requirements

- Node.js 20 or later.
- PostgreSQL 14 or later.
- npm.

### 1. Configure the database

Create a development database and a separate test database. If Docker is installed, you can use:

```bash
docker run --name trustvault-db \
  -e POSTGRES_PASSWORD=devpassword \
  -p 5432:5432 -d postgres:16

docker exec trustvault-db createdb -U postgres trustvault
docker exec trustvault-db createdb -U postgres trustvault_test
```

Use a separate, disposable test database. Do not use real production data for testing.

### 2. Configure environment variables

Create `server/.env` based on `server/.env.example`.

Configure the required database connection strings, a strong session secret, and any other required environment variables. Follow `DEPLOY.md` for environment-specific configuration.

### 3. Install dependencies and run migrations

From the repository root:

```bash
npm run install:all
npm --prefix server run db:migrate:dev
```

### 4. Start the application

Start the backend in one terminal:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev:client
```

Open:

http://localhost:5173/

### 5. Seed demo accounts (optional)

Configure the required `SEED_*` environment variables as documented in `server/scripts/seed.js` and run:

```bash
npm --prefix server run seed
```

The seed script creates demo accounts and leaves existing accounts unchanged by default. Setting `SEED_RESET_PASSWORDS=true` overwrites passwords for accounts included in the seed operation. Use this option carefully and only against the intended database.

## Run Tests

From the repository root:

```bash
npm test
```

The test database name must contain `test`. The test suite modifies and clears test data and is designed to reject unsafe database targets. Never point test configuration at a database containing real data.

## Scope and Limitations

The current scope does not include folders, group sharing, public share links, external sharing, version history, trash and recovery, multi-factor authentication, or password reset.

A user-facing administrative audit-log interface is not currently exposed. See `THREATS.md` for further limitations, including audit-log tampering boundaries, file validation, and storage cleanup.

## Project Structure

```text
client/                       React frontend
server/
  src/
    app.js                    Express application and middleware
    server.js                 Server startup
    config.js                 Environment configuration
    routes/
      registry.js              Central API route table
      auth.js                  Authentication handlers
      documents.js             Document handlers
      permissions.js           Permission management
    middleware/                Authentication and security checks
    security/password.js       Password hashing
    services/
      documentAccess.js        Document authorization
      documentStorage.js       File storage and validation
      sessions.js              Session helpers
      auditLog.js              Audit logging
  prisma/                      Database schema and migrations
  scripts/seed.js              Demo account creation
  tests/                       Automated tests
```

## Individual Project

TrustVault was designed, implemented, and tested individually by **Dega Leela Ramana** for the Snovasys Fresher Hiring Challenge 2026.