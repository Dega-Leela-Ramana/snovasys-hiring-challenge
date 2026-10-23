# TrustVault API Documentation

## Overview

TrustVault provides secure document storage, sharing, and audit verification.

- **Base path:** `/api`
- **Authentication:** Session cookie
- **Content type:** JSON unless an endpoint requires multipart form data
- **Production URL:** https://trustvault-app-fczr.onrender.com/

## Authentication and Security

- Registration and login are public endpoints protected by rate limits.
- All other implemented endpoints require an authenticated session.
- The audit verification endpoint additionally requires administrator access.
- State-changing requests that include an `Origin` header must use the application's own origin or an origin allowed by `ALLOWED_ORIGINS`.
- The session cookie is named `tv.sid`, is HTTP-only, uses `SameSite=Lax`, is secure in production, and has an eight-hour lifetime.
- Document access is checked by the server. Knowing a document ID does not grant permission.
- Unauthorized or inaccessible document resources may return `404 NOT_FOUND` to avoid disclosing their existence.

## Implemented Endpoints

### Health

#### `GET /api/health`

Checks application/database health.

- Authentication: Public
- Success: `200 OK`

Example response:

```json
{
  "status": "ok"
}
```

### Authentication

#### `POST /api/auth/register`

Creates a user account and establishes a session.

- Authentication: Public
- Rate limited
- Required fields: `email`, `name`, `password`
- Password length: 12â€“128 characters
- The requested role cannot be supplied to assign privileges.

#### `POST /api/auth/login`

Authenticates an existing user and establishes a session.

- Authentication: Public
- Rate limited

#### `GET /api/auth/me`

Returns information about the currently authenticated user.

- Authentication: Required

#### `POST /api/auth/logout`

Logs out the current user and ends the session.

- Authentication: Required

### Documents

#### `GET /api/documents`

Lists documents owned by the authenticated user or shared with them.

- Authentication: Required

#### `POST /api/documents`

Uploads a document owned by the authenticated user.

- Authentication: Required
- Content type: `multipart/form-data`
- File field: `file`
- Required text field: `title`
- Optional text fields: `description`, `category`
- Maximum file size: 10 MB
- Supported declared file types: PDF, JPEG, PNG, and plain text

Files are stored privately. The application calculates a SHA-256 checksum for uploaded content.

#### `GET /api/documents/:id`

Returns document details when the authenticated user has read access.

- Authentication: Required
- Access: Owner or a user with `READ` or `EDIT` permission

#### `GET /api/documents/:id/download`

Downloads the document when the authenticated user has read access.

- Authentication: Required
- Access: Owner or a user with `READ` or `EDIT` permission
- Successful downloads are recorded in the audit trail.

#### `PATCH /api/documents/:id`

Updates document metadata.

- Authentication: Required
- Access: Owner or a user with `EDIT` permission
- Successful edits are recorded in the audit trail.

#### `DELETE /api/documents/:id`

Deletes a document.

- Authentication: Required
- Access: Owner only
- Successful deletions are recorded in the audit trail.

### Document Permissions

#### `GET /api/documents/:id/permissions`

Lists sharing permissions for a document.

- Authentication: Required
- Access: Owner only

#### `POST /api/documents/:id/permissions`

Grants a user access to a document.

- Authentication: Required
- Access: Owner only
- Required JSON fields: `email`, `level`
- `email`: Email address of an existing active user
- `level`: `READ` or `EDIT`
- The owner cannot grant a separate permission to themselves.

Example request:

```json
{
  "email": "viewer@example.com",
  "level": "READ"
}
```

Use the email address of an actual existing account in your environment.

#### `DELETE /api/documents/:id/permissions/:userId`

Revokes a user's permission to access a document.

- Authentication: Required
- Access: Owner only
- `userId`: ID of the user whose permission should be revoked
- Successful response: `204 No Content`

### Audit Verification

#### `GET /api/admin/audit/verify`

Verifies the integrity and linkage of the audit chain.

- Authentication: Administrator only
- Returns `200 OK` when verification succeeds.
- Returns `409 Conflict` when verification detects an invalid audit chain.

This endpoint verifies the stored chain; it does not make the database owner incapable of rewriting the entire chain. Independent, external anchoring would be needed to protect against that threat.

## Document Access Rules

| Action | Owner | READ permission | EDIT permission |
|---|---|---|---|
| View document details | Yes | Yes | Yes |
| Download document | Yes | Yes | Yes |
| Edit document metadata | Yes | No | Yes |
| Delete document | Yes | No | No |
| Manage sharing permissions | Yes | No | No |

Permission levels apply to documents, not to user account roles. Administrator access to audit verification is a separate authorization check.

## Common HTTP Status Codes

The exact status depends on the endpoint and failure condition.

| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created, where returned by the endpoint |
| `204 No Content` | Request succeeded without a response body |
| `400 Bad Request` | Invalid request data |
| `401 Unauthorized` | Authentication required or invalid session |
| `403 Forbidden` | Request blocked, including a disallowed origin |
| `404 Not Found` | Resource missing or inaccessible |
| `409 Conflict` | Conflict or failed audit-chain verification |
| `413 Payload Too Large` | Upload exceeds the configured size limit |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |

## Error Responses

Errors are returned as JSON. The exact error code and message depend on the failure.

Example:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

Clients should use the HTTP status and error code to handle failures rather than relying on the wording of the message.

## Notes

- All paths above are relative to the `/api` base path.
- `access: user` means a valid authenticated session is required; it does not automatically grant access to every document.
- Resource-level permissions are enforced by the relevant route handlers.
- The audit verification endpoint is implemented. A general `GET /api/admin/audit` listing endpoint is not included in the current route registry.
- This document describes implemented endpoints only; it does not list planned routes as if they were available.
'@ | Set-Content -LiteralPath .\API.md -Encoding utf8
