# TrustVault API

Base path: `/api`. All bodies are JSON. The test suite fails if a route exists in
`server/src/routes/registry.js` but is missing from the table below.

## Who may call what

|Endpoint|Who may call it|What it does|
|-|-|-|
|`GET /api/health`|Anyone|Liveness and database check. Returns `{ "status": "ok" }`.|
|`POST /api/auth/register`|Anyone (rate-limited: 10 per IP per hour)|Creates a `USER` account and logs in. Body: `email`, `name`, `password` (12 to 128 chars). Any other field, including `role`, is rejected with 400.|
|`POST /api/auth/login`|Anyone (rate-limited: 10 per IP per 15 min)|Body: `email`, `password`. Returns the user and sets the session cookie. A new session id is issued on every login.|
|`GET /api/auth/me`|Any logged-in, active user|Returns `{ user: { id, email, name, role } }`. The role is read from the database on every request.|
|`POST /api/auth/logout`|Any logged-in, active user|Destroys the server-side session. Returns 204.|
|`GET /api/documents/:id/permissions`|Logged-in document owner|Lists permissions granted for the document.|
|`POST /api/documents/:id/permissions`|Logged-in document owner|Grants or updates a recipient's READ or EDIT permission. JSON body: `userId`, `level`.|
|`DELETE /api/documents/:id/permissions/:userId`|Logged-in document owner|Revokes the recipient's permission. Returns 204.|

Anything under `/api` that is not listed as "Anyone" requires a session. Anonymous
callers get `401` for every other path, including paths that do not exist.

## Conventions

* **Authentication:** an HTTP-only session cookie named `tv.sid` (`SameSite=Lax`, `Secure` in production, 8 hour lifetime). There are no API keys or bearer tokens.
* **Errors** always look like `{ "error": { "code": "â€¦", "message": "â€¦", "details": \[...] } }`. `details` appears only for validation errors.
* **State-changing requests** (`POST`, `PUT`, `PATCH`, `DELETE`) that carry an `Origin` header must come from the site's own origin or an origin listed in `ALLOWED\_ORIGINS`; otherwise `403 BAD\_ORIGIN`.
* **Status codes:** `400` bad input, `401` not logged in, `403` logged in but not allowed (admin routes, or READ-only on an edit), `404` not found **or not permitted** (documents, from Milestone 2), `409` conflict, `413` body too large, `429` rate limited.

|Code|Meaning|
|-|-|
|`UNAUTHENTICATED`|No valid session|
|`INVALID\_CREDENTIALS`|Wrong email, wrong password, or deactivated account (deliberately not distinguished)|
|`VALIDATION\_ERROR`|Body failed validation|
|`EMAIL\_TAKEN`|Email already registered|
|`BAD\_ORIGIN`|State-changing request from a foreign origin|
|`RATE\_LIMITED`|Too many requests|
|`FORBIDDEN`|Logged in, but the role is not allowed|

## Planned (not implemented yet; not part of Milestone 1)

Milestone 2: `POST /api/documents`, `GET /api/documents`, `GET /api/documents/:id`,
`GET /api/documents/:id/download`, `PATCH /api/documents/:id`, `PUT /api/documents/:id/file`,
`DELETE /api/documents/:id`, `GET|PUT|DELETE /api/documents/:id/permissionsâ€¦`,
`GET /api/users/lookup`.
Milestone 3: `GET /api/admin/audit`, `GET /api/admin/audit/verify`.
Each will be added to the table above, with its authorization rule, in the same commit that adds the route.



\### List Documents



\- \*\*Method:\*\* GET

\- \*\*Endpoint:\*\* `/api/documents`

\- \*\*Authentication:\*\* Required

\- \*\*Description:\*\* Lists documents owned by the logged-in user or shared with them.



\### Get Document Details



\- \*\*Method:\*\* GET

\- \*\*Endpoint:\*\* `/api/documents/:id`

\- \*\*Authentication:\*\* Required

\- \*\*Description:\*\* Returns document details if the logged-in user owns the document or has READ or EDIT permission. Returns 404 if the document is unavailable or the user does not have access.



\### Upload Document



\- \*\*Method:\*\* POST

\- \*\*Endpoint:\*\* `/api/documents`

\- \*\*Authentication:\*\* Required

\- \*\*Content-Type:\*\* `multipart/form-data`

\- \*\*File field:\*\* `file`

\- \*\*Other fields:\*\* `title` (required), `description` (optional), `category` (optional)

\- \*\*File size limit:\*\* 10 MB

\- \*\*Supported declared file types:\*\* PDF, JPEG, PNG, and plain text

\- \*\*Description:\*\* Uploads a document to private server storage and records its metadata and SHA-256 checksum.



\### Download Document



\- \*\*Method:\*\* GET

\- \*\*Endpoint:\*\* `/api/documents/:id/download`

\- \*\*Authentication:\*\* Required

\- \*\*Description:\*\* Downloads the original file for a document.

\- \*\*Access control:\*\* The user must own the document or have `READ` or `EDIT` permission. Returns `404 Not Found` if the document does not exist or the user lacks access.

\- \*\*Audit:\*\* Records successful download attempts.
