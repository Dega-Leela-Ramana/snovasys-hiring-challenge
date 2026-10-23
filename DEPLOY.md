# Deploying TrustVault

This guide describes the deployed TrustVault architecture and how to configure a new environment from a clean clone.

## Production deployment

- **Application:** https://trustvault-app-fczr.onrender.com/
- **Hosting:** Render
- **Database:** Supabase PostgreSQL
- **File storage:** Private Supabase Storage bucket
- **Runtime:** Node.js 22 or later
- **Application architecture:** Express serves the API under `/api` and the built React frontend from the same origin.

The free hosting instance may take time to wake after inactivity.

## Requirements

- Node.js 22 or later
- npm
- A PostgreSQL database
- A Render service or another compatible Node.js host
- A private Supabase Storage bucket and server-side credentials when using Supabase storage

## Production configuration

Configure environment variables in the hosting provider's dashboard. Do not commit production values to Git.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set to `production`. |
| `DATABASE_URL` | PostgreSQL connection string for the application. |
| `SESSION_SECRET` | Strong, unique production session secret. |
| `TRUST_PROXY` | Configure according to the actual trusted proxy setup of the host. |
| `PORT` | Set by Render or the hosting environment when applicable. |
| SUPABASE_URL | Supabase project URL. Required in production. |
| SUPABASE_SECRET_KEY | Server-side Supabase secret key. Required in production; never expose it in the browser. |
| Storage bucket | The application currently uses the hardcoded private bucket name 	trustvault-documents. |
| Seed variables | Only set when intentionally running the seed script against the intended database. |

Use the application's environment configuration and `server/.env.example` to confirm exact variable names. Never copy production credentials into `.env.example`, documentation, logs, or source control.

## Render build and start

For the current root-level package scripts, use:

- **Build command:** `npm run build`
- **Start command:** `npm start`

The build script installs the server and client dependencies and builds the frontend. The production start script runs the configured database migrations and starts the server.

After deployment, check:

`https://trustvault-app-fczr.onrender.com/api/health`

Expect a successful JSON response indicating that the application and database are healthy.

## Database setup and migrations

For a new environment:

1. Create a PostgreSQL database.
2. Configure `DATABASE_URL` for that database.
3. Install dependencies with `npm run install:all`.
4. Apply the committed migrations using the project's migration workflow.
5. Deploy the application and check `/api/health`.

Production deployments use Prisma migrations. Do not edit an already-applied migration; create a new migration for schema changes.

Use a separate, disposable test database for automated tests. Never point tests at production data.

## Private file storage

Production documents must remain in a private Supabase Storage bucket. Downloads should go through the authenticated backend, which checks document permissions before returning file content.

Do not make the bucket public or expose a Supabase service-role key to the browser. Configure SUPABASE_URL and SUPABASE_SECRET_KEY in the hosting provider's environment settings. The configured Supabase project must contain a private Storage bucket named 	trustvault-documents, matching the name in server/src/config.js.

## Seed demo accounts

The seed script supports the demo accounts used by the challenge:

- `admin@trustvault.example`
- `owner@trustvault.example`
- `viewer@trustvault.example`
- `stranger@trustvault.example`

Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_DEMO_PASSWORD` only in the intended environment, then run:

```bash
npm run seed
```

The seed script leaves existing accounts unchanged by default. `SEED_RESET_PASSWORDS=true` resets passwords for accounts included in the seed operation. Use it only when deliberately resetting the intended database.

The challenge requires demo credentials in the README. Use demo-only passwords and ensure the accounts contain no real personal information or production data.

## Post-deployment verification

1. Open the live application and verify that the login page loads.
2. Check `/api/health`.
3. Log in with each demo account and verify the expected role or sharing scenario.
4. Verify that users cannot access documents they do not own or have permission to read.
5. Confirm that `READ` recipients cannot edit metadata or delete documents.
6. Confirm that `EDIT` recipients can edit metadata but cannot delete documents or manage sharing.
7. Confirm that only an administrator can access `/api/admin/audit/verify`.
8. Run the automated tests against the separate test database before releasing changes.

## Rollback

If a deployment fails, inspect the Render deployment logs and redeploy a known-good commit when appropriate. Review database migration compatibility before rolling back application code. Do not assume a database schema change can safely be reversed by redeploying an older application version.
