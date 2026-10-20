# AI working rules for TrustVault

Paste this (or point your AI tool at it) at the start of every coding session.
It is the reusable context the brief asks to see in `PROMPTS.md`.

## Non-negotiable invariants

1. **The server decides.** Never rely on a hidden button or a frontend check. Every route
   re-checks. If the client could skip it, it is not security.
2. **One authorization function for documents:** `getDocumentAccess(userId, documentId)`
   returns `NONE | READ | EDIT | OWNER`. No other code decides document access. No SQL
   elsewhere may return document rows or content without the access filter.
3. **Default deny.** New routes are added to `server/src/routes/registry.js` with an explicit
   `access` value and are added to `API.md` in the same change.
4. **Nothing cached about permissions or roles.** Read from the database on each request.
5. **No access = 404**, not 403, for documents the caller cannot read (no existence leak).
6. **Audit** every upload, download, edit, delete, permission change and denied access,
   in the same transaction as the action. Never claim the log is "tamper-proof".
7. **No secrets in the repo.** `.env` stays ignored; only `.env.example` with placeholders.
8. **Raw SQL only with parameters.** Never build SQL with string concatenation.
9. **Tests must assert the specific denial** (status code AND that no data came back).
   If removing an authorization check does not make a test fail, the test is worthless.
10. **No AI automatic permission changes.** A person confirms every grant.

## Review checklist for AI-generated code (use before every commit)

- Does any query return a document without joining the access filter?
- Does any handler read `role`, `ownerId` or `userId` from the request body?
- Is any error message or log line echoing user input, a password, a path or a stack?
- Does each new endpoint appear in `registry.js`, `API.md` and the threat table?
- Delete the authorization line mentally: does a test fail?
