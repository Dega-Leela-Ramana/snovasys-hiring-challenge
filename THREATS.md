# TrustVault — Threat Model

How TrustVault could be attacked, the controls implemented, and the risks that remain.

**Status:** Core authentication, document management, authorization, audit events, and private production storage are implemented. This document distinguishes implemented controls from partial controls and accepted risks. Automated tests provide evidence for specific behaviors, not proof that the application is free of vulnerabilities.

## Status legend

- **Implemented** — the control exists in the code reviewed.
- **Partial** — some protection exists, but a stated gap remains.
- **Planned** — not implemented.
- **Accepted** — the risk remains in this MVP.

Run `npm test` from the project root before relying on the current test results. Update this document whenever security-relevant behavior changes.

Two core requirements guide the design:

1. Document access is decided by server-side authorization logic, not by hidden buttons or frontend checks.
2. Document permissions and account status are read from the database on requests. Revocation blocks subsequent authorized requests; it cannot retract content already downloaded or a download already in progress.

---

## A. Access control

| ID | Threat | Control and remaining limitation | Status |
|---|---|---|---|
| T-01 | IDOR/BOLA: a user changes a document ID to access another user's file | Document handlers use centralized `getDocumentAccess` checks. Requests without access return 404 to avoid revealing whether a document exists. | Implemented |
| T-02 | A new route accidentally omits authorization | Routes are centrally registered, with public routes separated from authenticated routes and route configuration validated at startup. Automated tests cover route access behavior. | Implemented |
| T-03 | Ordinary users call administrative endpoints | `requireAdmin` checks the user's role from the database. The inspected route registry does not currently expose an admin audit-log endpoint; do not interpret middleware alone as a complete admin interface. | Partial |
| T-04 | A READ user edits, deletes, or manages permissions | READ grants allow reading and downloading; EDIT grants also allow metadata edits. Document deletion and permission management require ownership. There is no file-replacement endpoint. | Implemented |
| T-05 | An EDIT user grants access to others | Permission-management handlers require the document owner. | Implemented |
| T-06 | Revocation or account deactivation does not take effect | Authentication reloads the user from the database, and document permissions are checked on requests rather than trusted from a cached frontend state. A download already in progress is not interrupted. | Implemented, with limitation |
| T-07 | Access is revoked while a download is in progress | Authorization is checked when the download request starts. Access is not rechecked during transfer. | Accepted |
| T-08 | A share link remains valid after revocation | There are no public share links or client-facing signed file URLs. Access requires an authenticated session and server-side checks. | Implemented by design |
| T-09 | Files are accessed directly without authorization | Production uses a private Supabase Storage bucket accessed by the backend. Development uses local storage outside the frontend's served assets. Downloads go through authorized backend routes. | Implemented, configuration-dependent |
| T-10 | Mass assignment gives a user an administrator role | Registration schemas reject unknown fields, and the role is not accepted from the registration request body. | Implemented |
| T-11 | Access is granted to the owner, the requester themselves, or an invalid account | The permission handler validates the target account and grant level, rejects self-grants, and restricts management to the owner. | Implemented |
| T-12 | An administrator automatically gains access to every document | The document access helper grants content access based on ownership or an explicit permission; admin status alone does not grant document access. A complete admin audit interface is not currently exposed by the inspected route registry. | Implemented for document access; admin interface incomplete |
| T-13 | Demo credentials expose sensitive information | Do not use real data with demo accounts, and never reuse demo passwords. Demo credentials must be handled according to the challenge's submission requirements. | Accepted risk |
| T-14 | Document listing reveals documents the user cannot access | The listing query filters documents by ownership or an explicit permission before returning results. | Implemented |
| T-15 | Deactivating an owner leaves documents without a replacement owner | Ownership transfer and automated recovery of orphaned documents are not implemented. Review this scenario before using the application with important data. | Accepted |

## B. Authentication and sessions

| ID | Threat | Control and remaining limitation | Status |
|---|---|---|---|
| T-20 | Password guessing | Login and registration use rate limiting; passwords are hashed with scrypt. Rate limits do not eliminate distributed attacks. | Implemented |
| T-20b | Distributed guessing, account lockout abuse, or missing MFA | There is no MFA or per-account lockout. Per-account lockout can itself be abused to deny service to legitimate users. | Accepted |
| T-21 | Login responses reveal whether an account exists | Login uses a consistent failure response and performs a dummy hash verification for unknown accounts to reduce timing differences. | Implemented |
| T-21b | Registration reveals that an email is already registered | Registration returns an account-conflict response to support usable sign-up. Rate limiting reduces, but does not eliminate, enumeration. | Accepted |
| T-22 | Session fixation | Login regenerates the session ID and destroys the previous session. | Implemented |
| T-23 | Client-side script steals the session cookie | Cookies use `HttpOnly`; security headers include a Content Security Policy, and React escapes rendered text by default. XSS defenses are not a substitute for safe handling of untrusted content. | Implemented |
| T-24 | Cross-site request forgery | State-changing requests use origin-related checks and the session cookie uses `SameSite=Lax`. The application does not rely on CORS as a CSRF defense. | Implemented |
| T-25 | Session cookie is sent over plain HTTP | Production configuration enables secure cookies. This depends on correct HTTPS and reverse-proxy configuration. | Implemented, configuration-dependent |
| T-26 | Logout only clears the browser cookie | Logout destroys the server-side session. | Implemented |
| T-27 | Stolen session remains valid indefinitely | Sessions have a fixed lifetime. Immediate revocation depends on the server-side session being invalidated; a user-facing “log out everywhere” workflow is not exposed. | Partial |
| T-28 | Weak password hashing or weak passwords | Passwords use scrypt with configured parameters and random salts; a minimum password length is enforced. Breached-password screening is not implemented. | Implemented, with limitation |
| T-29 | Weak or placeholder session secret | Configuration validation rejects a missing, short, or known placeholder session secret. Secrets must be supplied securely in each deployment environment. | Implemented |
| T-30 | Visually similar email addresses confuse users | Emails are normalized before account lookup. Visually similar characters from different writing systems are not comprehensively detected. | Partial |
| T-31 | Incorrect reverse-proxy trust setting affects IP-based controls | Proxy trust is configurable. Incorrect settings can undermine client-IP attribution or rate limiting; forwarded IP values are evidence, not proof of identity. | Configuration-dependent |

## C. File handling and storage

| ID | Threat | Control and remaining limitation | Status |
|---|---|---|---|
| T-40 | Path traversal through the original filename | Files use random storage identifiers rather than client-supplied filenames as paths. The original filename is retained as metadata. | Implemented |
| T-41 | Malicious file types or spoofed MIME types | Uploads are limited to 10 MiB and an allowlist of PDF, JPEG, PNG, and plain text MIME types. File contents are not verified using magic-byte inspection, so MIME spoofing remains possible. | Partial |
| T-42 | Stored XSS from uploaded HTML or SVG | HTML and SVG are not in the upload allowlist. Downloads use attachment disposition and `X-Content-Type-Options: nosniff`. | Implemented for the current allowlist |
| T-43 | Header injection through the original filename | The filename is reduced to a basename and length-limited before being used in the download response. Continue testing unusual Unicode and control-character filenames. | Partial |
| T-44 | Malware inside an allowed file | The application does not scan uploads for malware and does not render file contents in the application. Users must treat downloaded documents as untrusted. | Accepted |
| T-45 | Storage exhaustion | Per-file size limits and request rate limits exist. Per-user storage quotas and retention policies are not implemented. | Partial |
| T-46 | A stored file changes without the application noticing | SHA-256 is calculated and stored on upload, but the digest is not reverified when the file is downloaded. | Partial |
| T-47 | Files are exposed through storage or host compromise | Production storage is configured as a private Supabase bucket accessed by the backend secret key. Security still depends on provider controls, secret protection, and deployment configuration. | Partial |
| T-48 | Concurrent replacement/deletion or failed storage cleanup | No file-replacement endpoint is currently exposed. Database deletion and its audit entry are transactional, but physical storage cleanup occurs afterward and can fail, leaving an orphaned object. | Partial |

## D. Audit trail

| ID | Threat | Control and remaining limitation | Status |
|---|---|---|---|
| T-50 | Audit rows are silently edited or deleted | A database trigger rejects UPDATE and DELETE operations on audit rows. This does not prevent every form of tampering: a sufficiently privileged database owner may alter the trigger, and row triggers do not block every bulk operation. | Partial |
| T-51 | A privileged attacker tampers with audit history | A hash chain, external checkpointing, and a verification endpoint are not implemented. | Planned |
| T-52 | An action occurs without its audit event | Permission grants/revocations, metadata edits, and database document deletion pair the action and audit insert in a transaction. Upload audit creation occurs separately, with cleanup attempted on failure; this is not a fully atomic upload-and-audit transaction. | Partial |
| T-53 | Denied access attempts are not recorded | Unauthorized document requests return a not-found response, but denied attempts are not consistently written as audit events. | Planned |
| T-54 | User-controlled text forges or pollutes log entries | Audit data is stored as structured database fields, but length limits, display escaping, and safe handling of every logged value must be reviewed for each event and UI. | Partial |
| T-55 | Audit events are flooded by repeated requests | Request rate limiting reduces abuse. There is no complete audit retention or archival policy. | Partial |
| T-56 | Passwords or session tokens leak into logs | Error handling should not log credentials or request bodies. Review production log configuration and dependencies whenever logging changes. | Implemented, subject to review |
| T-57 | A forwarded IP address is spoofed | Express proxy trust is explicitly configured. IP addresses are supporting evidence, not proof of a user's identity. | Configuration-dependent |
| T-58 | Viewing the audit log is itself unrecorded | An admin audit-log viewing endpoint and associated access-view audit events are not currently exposed by the inspected route registry. | Planned |

## E. Platform and process

| ID | Threat | Control and remaining limitation | Status |
|---|---|---|---|
| T-60 | SQL injection | Normal database access uses Prisma. Review any raw SQL additions for parameterization. | Implemented for reviewed queries |
| T-61 | Secrets are committed to Git | Local environment files should be ignored; only placeholder examples should be committed. Rotate any credential that may have been exposed. Verify tracked files and run a secret scan before submission. | Requires verification |
| T-62 | Vulnerable dependencies | Lockfiles are committed. The most recent build reported six server dependency audit findings (one moderate, three high, two critical) and zero client findings. These findings require triage; do not assume all are exploitable or that they are harmless. | Needs review |
| T-63 | Clickjacking, MIME sniffing, or missing security headers | Helmet configures security headers, including content-security and MIME-sniffing protections. Verify the deployed response headers before submission. | Implemented, deployment-dependent |
| T-64 | Verbose errors expose internal details | The error handler is intended to return a generic response for unexpected failures. Keep detailed diagnostics out of client responses. | Implemented for reviewed handler |
| T-65 | Oversized request bodies exhaust resources | JSON input is limited to 100 KB; multipart uploads and fields have configured limits. | Implemented |
| T-66 | Tests erase or modify a real database | Test configuration includes database-target safeguards. Confirm the test database is separate before running destructive tests. | Implemented for reviewed tests |
| T-67 | Cross-origin websites read API responses | The application does not intentionally enable cross-origin API access; development uses a same-origin proxy. Verify deployed headers and origin checks after configuration changes. | Implemented, configuration-dependent |
| T-68 | Restoring a backup restores revoked access | A complete backup and restore policy is not configured as part of this MVP. Restores must be treated as security-sensitive operations. | Accepted |
| T-69 | Prototype pollution or ReDoS through input parsing | Schemas validate request fields and the reviewed handlers do not use user-supplied regular expressions. Reassess this when new parsing or merging logic is added. | Implemented for reviewed paths |
| T-70 | Insecure deployment settings or missing environment variables | Configuration validation rejects required missing or invalid production settings. HTTPS, secure cookies, trusted-proxy configuration, and private-storage secrets must be configured correctly in the hosting environment. | Implemented, configuration-dependent |

---

## Known limitations and deferred scope

- No folders, groups, or inherited permissions.
- No public share links or external sharing.
- No file-replacement endpoint or retained version history.
- No trash or recovery workflow.
- No MFA, email verification, or password reset.
- No malware scanning or file-content magic-byte verification.
- Stored SHA-256 hashes are not checked during download.
- Denied access attempts are not consistently audited.
- No implemented audit hash chain or external audit checkpoint.
- No user-facing admin audit-log endpoint in the inspected route registry.
- Storage cleanup can fail after a database deletion, potentially leaving an orphaned object.
- Dependency audit findings require review before final submission.

This threat model describes the implementation reviewed for this project. It is not a claim of independent security certification or a guarantee that every possible attack has been prevented.
