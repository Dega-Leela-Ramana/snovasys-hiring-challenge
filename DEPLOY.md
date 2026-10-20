# Deploying TrustVault

Goal for Day 1: a live URL with HTTPS where you can register, log in and log out.
The app is **one process**: Express serves the API under `/api` and the built React app
for every other URL, so there is a single origin and no CORS.

> These steps were written without access to a hosting account, so they are unverified.
> The first real deploy will teach you something; record it in `PROMPTS.md` if the AI was wrong.

## What the host must give you

1. A **PostgreSQL** database and its connection string.
2. **HTTPS** (every common host does this for you).
3. Somewhere to set **environment variables**.
4. *(From Milestone 2)* a **persistent disk/volume** for uploaded files. Many free tiers wipe the
   disk on every deploy, which would delete documents. Choose a host with a volume
   (Fly.io and Railway offer them) before Milestone 2.

## Environment variables

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on Secure cookies and the strict password cost. |
| `DATABASE_URL` | from your Postgres host | Keep `?sslmode=require` if the host needs TLS. |
| `SESSION_SECRET` | 48+ random characters | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Generate a **new** one for production; never reuse the dev one. |
| `TRUST_PROXY` | `1` on Render / Railway / Fly | Number of proxies in front of the app. **If login "succeeds" but you are immediately logged out, this is wrong.** Do not set it higher than the real number: clients could then fake their IP and dodge rate limits. |
| `PORT` | usually set by the host | |

Never put these values in a file in the repository.

## Option A: Docker (works on Railway, Render, Fly.io)

1. Push the repo to GitHub and create a new service from it. The host finds the `Dockerfile`.
2. Add a PostgreSQL database and set the variables above.
3. Deploy. The container runs `prisma migrate deploy` (creates the tables) and then starts the server.
4. Open `https://<your-app>/api/health`. Expect `{"status":"ok"}`.

## Option B: Node build and start commands

- Build command: `npm run build`
- Start command: `npm start` (runs migrations, then the server)
- Node version 20 or newer.

## Create the demo accounts (once)

Run this where the app's environment variables are available (most hosts have a "shell" or
"run command" feature), with passwords **you** choose:

```
SEED_ADMIN_EMAIL=admin@trustvault.example \
SEED_ADMIN_PASSWORD=<12+ characters> \
SEED_DEMO_PASSWORD=<12+ characters> \
npm run seed
```

This creates `admin@trustvault.example` (ADMIN) and `owner@`, `viewer@`, `stranger@trustvault.example`
(USER). Re-running is safe: existing accounts are left alone. Passwords are never printed.
Put the demo credentials in the README **only for this demo database**.

## After deploying: five-minute check

1. `/api/health` returns ok.
2. Register, refresh the page: still logged in. Log out: back to the form.
3. Browser dev tools, Application, Cookies: `tv.sid` is **HttpOnly** and **Secure**.
4. `curl -i https://<your-app>/api/auth/me` returns **401**.
5. Log in as a second user in a private window to confirm sessions are separate.

## Rolling back

Redeploy the previous commit. Migrations only add tables in Milestone 1; do not edit an applied
migration. Make a new one.
