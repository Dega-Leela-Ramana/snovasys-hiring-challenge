# THREATS.md

How I think TrustVault could be broken, what I did about each, and what I knowingly left.

**Status as of Milestone 1** (authentication foundation). Legend:

- **Done** – implemented, and a test in `server/tests` covers it.
- **Planned (Mx)** – design decided, lands in that milestone; no code yet.
- **Accepted** – a known weakness I chose to leave, with the reason.

Run `npm test` before trusting any "Done". Entries get updated as milestones land.

The two non-negotiables from the brief, in my own words:

1. A document is reachable only through **one** server-side function, `getDocumentAccess(userId, documentId)` (Milestone 2). Not "the button is hidden", not "the page checks".
2. Taking access away is **immediate**: nothing is cached; permissions and account status are re-read from the database on every request.

---

## A. Access control

| ID | Threat | What I did | Status |
|---|---|---|---|
| T-01 | **IDOR / BOLA**: logged-in user changes a document id in a URL to reach someone else's file | Every document route calls `getDocumentAccess`. UUIDs are not treated as a secret. No-access answers **404**, identical to "does not exist". | Planned (M2) |
| T-02 | **Forgotten authorization on a new route** | All routes live in one table (`registry.js`). Public routes are registered first, then `requireAuth` is installed, then everything else, so a route is public only if it says `public`. A typo in `access` crashes startup. Unknown `/api/*` paths answer 401 to anonymous callers. A test hits every non-public route anonymously. | Done |
| T-03 | **Function-level escalation**: ordinary user calls an admin endpoint | `requireAdmin` reads the role **from the database** (not the session). Test loops over all `admin` routes as a normal user. | Done (no admin routes exist yet; the test activates in M3) |
| T-04 | **READ holder edits, replaces, deletes or re-shares** | Access is a ladder NONE < READ < EDIT < OWNER; each endpoint states the minimum. Delete and permission management are owner-only. | Planned (M2) |
| T-05 | **EDIT holder grants access to others** | Only the owner may call the permission endpoints. | Planned (M2) |
| T-06 | **Revocation not immediate** (cached permissions, role stored in session) | The session holds **only a user id**. `requireAuth` reloads the user every request; deactivated or deleted users get 401 and their session is deleted. A changed role applies on the next request. Document grants are read from the database per request. Cost: one small query per request. | Done for accounts; Planned (M2) for grants |
| T-07 | **Download already in progress when access is revoked** | Authorization is checked when the download starts. Files are size-capped, so a stream finishes quickly. I do not re-check per chunk. | Accepted |
| T-08 | **"Their link still works"** | There are no share links, signed URLs or tokens, so nothing exists that could outlive a revocation. The only credential is the session cookie, which is checked against the database on every request. | Done (by design) |
| T-09 | **Public file URL / direct access to storage** | Files live outside any served directory under random UUID names. No static route points near them. Downloads stream through the authorization check. | Planned (M2) |
| T-10 | **Mass assignment**: `{"role":"ADMIN"}` at registration | Request bodies are parsed with `.strict()` schemas; unknown fields are a 400. The role is never read from a request. | Done |
| T-11 | **Granting to the owner, to yourself, to an inactive or nonexistent user** | Validated in the grant endpoint. | Planned (M2) |
| T-12 | **Powerful admin**: a stolen admin account reads every file | Admins have **no** implicit access to file contents. They manage users and read the audit log only. | Planned (M2/M3) |
| T-13 | **Demo admin credentials are public** (the brief requires credentials in the README) | The demo database holds no real data; the demo admin cannot read document contents (T-12). Never reuse these passwords. | Accepted (demo only) |
| T-14 | **Search leaks existence** of documents the user cannot reach (results, counts, ordering) | The access filter is part of the SQL query itself, before counting and paging, never applied afterwards in JavaScript. | Planned (M2) |
| T-15 | **Orphaned documents** when an owner is deactivated | Documents stay; grants keep working; no one gains access. Ownership transfer is not built. | Accepted |

## B. Authentication and sessions

| ID | Threat | What I did | Status |
|---|---|---|---|
| T-20 | **Password guessing** | Per-IP rate limit on login (10 / 15 min) and register; scrypt makes each guess expensive (~250 ms). | Done |
| T-20b | Distributed guessing, no account lockout, no MFA | A per-account lockout would let an attacker lock out victims, so I did not add one. No MFA. | Accepted |
| T-21 | **Account enumeration** via login | Same status and body for unknown email, wrong password and deactivated account. A dummy hash is verified for unknown emails so timing is similar. | Done |
| T-21b | Enumeration via register (`409 EMAIL_TAKEN`) | Needed for usable sign-up without email verification. Rate-limited. | Accepted |
| T-22 | **Session fixation** | New session id on every login; the old id is destroyed. | Done |
| T-23 | **Cookie theft by script** | `HttpOnly`; helmet's CSP; React escapes output; no `dangerouslySetInnerHTML`. | Done |
| T-24 | **CSRF** | `SameSite=Lax` cookie **plus** Origin / Sec-Fetch-Site check on every state-changing request; no CORS headers at all. | Done |
| T-25 | **Cookie sent over plain HTTP** | `Secure` in production (tested with a forwarded-HTTPS request). | Done |
| T-26 | **Logout only clears the browser** | The session row is deleted server-side; test replays the old cookie. | Done |
| T-27 | **Stolen cookie lives forever** | Fixed 8 hour lifetime, not extended by activity. No idle timeout and no "log out everywhere" button yet (the function `destroyUserSessions` exists and is tested). | Done / Accepted |
| T-28 | **Weak or leaked hashes** | scrypt N=2^15, r=8, p=3 (OWASP parameters), 16-byte random salt, parameters stored per hash, constant-time compare. Minimum 12 character passwords. No breached-password check. | Done / Accepted |
| T-29 | **Weak or committed session secret** | App refuses to start unless `SESSION_SECRET` is 32+ characters and not a placeholder. | Done |
| T-30 | **Look-alike emails** | Emails are NFKC-normalised and lowercased. Visually similar characters from other scripts are not blocked. | Done / Accepted |
| T-31 | **Wrong `TRUST_PROXY`**: too low = every user shares one IP and Secure cookies break; too high = attacker forges `X-Forwarded-For` to dodge rate limits | Explicit setting, printed at startup, explained in DEPLOY.md. | Done (documented) |

## C. Files (Milestone 2)

| ID | Threat | Plan | Status |
|---|---|---|---|
| T-40 | Path traversal through the filename | Stored name is a random UUID; the client's filename is display metadata only. | Planned (M2) |
| T-41 | Malicious file types, spoofed MIME type or extension | Extension allowlist **and** magic-byte check; size limit. | Planned (M2) |
| T-42 | Stored XSS by serving an uploaded HTML/SVG file | Always `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, generic content type for risky types. | Planned (M2) |
| T-43 | Header injection through the filename | Filename is sanitised and encoded before it goes in a header. | Planned (M2) |
| T-44 | Malware inside an allowed file (PDF, Office) | No scanning. The server never opens or renders uploads; users download them. | Accepted |
| T-45 | Disk exhaustion | Per-file size cap and rate limit; no per-user quota. | Accepted |
| T-46 | File changed on disk behind the app's back | `sha256` stored at upload and checked when serving. | Planned (M2) |
| T-47 | Files not encrypted at rest by the app | Relies on the host's disk encryption. | Accepted |
| T-48 | Two simultaneous replace/delete operations | Database transaction around metadata; file written first, row updated after. | Planned (M2) |

## D. Audit trail

| ID | Threat | What I did | Status |
|---|---|---|---|
| T-50 | **Quiet editing or deletion of audit rows** | A database trigger rejects `UPDATE` and `DELETE` on `AuditLog` (tested). **Known gaps:** `TRUNCATE` does not fire row triggers; and the table owner can drop the trigger. I will run the app with a limited database role (no ownership, no `TRUNCATE`) and say plainly that a database superuser can still alter history. | Done (trigger) / Planned (M3: DB role) |
| T-51 | Tampering that the trigger cannot stop (superuser) | Hash chain with a server-side secret (HMAC) plus a verify endpoint, so edits to past rows are **detectable**. The log is "tamper-evident", never "tamper-proof": someone with database **and** secret access can rebuild the chain. Exporting the latest hash elsewhere would close that gap; not built. | Planned (M3) |
| T-52 | **An action happens without being logged** | Audit insert in the **same transaction** as the action. A test asserts one entry per mutating endpoint. If logging fails, the action fails. | Planned (M2/M3) |
| T-53 | **Denied attempts not logged** | Every 403/404 on a document writes an `ACCESS_DENIED` entry with actor, document and IP. | Planned (M2) |
| T-54 | Log forging through user-controlled text (filenames, user agent) | Stored as structured JSON, length-limited, shown as plain text in the UI. | Planned (M3) |
| T-55 | Audit flooding (spam of denied requests) | Global and per-route rate limits. No retention or archival policy. | Done (limits) / Accepted |
| T-56 | Passwords or tokens leaking into logs | Error logging never includes request bodies; production logs only error name and code. | Done |
| T-57 | Spoofed IP in the log | IP comes from Express with an explicit `trust proxy` count; the IP is evidence, not proof. | Done (see T-31) |
| T-58 | Admin reading the audit log is itself unobserved | Log admin audit views. | Planned (M3) |

## E. Platform and process

| ID | Threat | What I did | Status |
|---|---|---|---|
| T-60 | SQL injection | Prisma for all normal queries. The only raw SQL (session cleanup, health check) uses parameters. | Done |
| T-61 | Secrets committed to Git | `.gitignore` excludes `.env*`; only `.env.example` with placeholders is tracked; secret scan before first push (M4). If anything ever leaks, it gets rotated. | Done / Planned (M4 scan) |
| T-62 | Vulnerable or malicious dependencies | Few dependencies; lockfiles committed; `npm audit` in M4. No automated scanning. | Planned (M4) / Accepted |
| T-63 | Clickjacking, MIME sniffing, missing headers | helmet (CSP, frame-ancestors, nosniff, HSTS). | Done |
| T-64 | Verbose errors reveal internals | One error shape; unknown errors become a generic 500 (tested with a stub that throws a secret-looking message). | Done |
| T-65 | Oversized request bodies | JSON limited to 100 KB (tested). File limit in M2. | Done |
| T-66 | **Tests wiping the real database** | Test setup refuses to run unless the database name contains "test" and differs from `DATABASE_URL`. | Done |
| T-67 | Cross-origin reads of API responses | No CORS headers are sent; development uses a same-origin proxy. | Done |
| T-68 | Restoring a backup resurrects revoked access | No backups configured in this MVP. | Accepted |
| T-69 | Prototype pollution / ReDoS through input parsing | Only schema-validated fields are read; no deep merges of user input; no user-supplied regular expressions. | Done |
| T-70 | Deployment misconfiguration (HTTP, missing env, dev mode) | App exits on invalid config; `Secure` cookies and strict scrypt cost enforced in production. | Done |

---

## What I chose not to build (and why)

- **Folders, groups and permission inheritance.** Each makes "who can reach this file?" harder to answer. Per-document grants keep the answer one query long.
- **Share links and sharing with people outside the company.** A link is a credential that can outlive a revocation (see T-08). Named, logged-in users only.
- **Version history, trash and recovery.** Delete is permanent and audited. Replacing a file bumps a version number but keeps no old copy.
- **MFA, email verification, password reset.** Out of scope for a four-day MVP; listed as accepted risk above.
- **AI-suggested permissions.** The brief allows it only with a human confirming and both the suggestion and decision audited. Not built.
