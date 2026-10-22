# PROMPTS.md

How I used AI while building TrustVault. Entries describe actual work and verification; commit links point to repository history.

## Reusable context

- [AI_CONTEXT.md](AI_CONTEXT.md): Security invariants and review checklist used when working with the AI assistant.
- Standing instruction: “Do not generate the whole application at once. Show the plan, wait for approval, then build one milestone.”

## Entries

### 2026-10-19: Planning before coding

- **Asked:** For a four-day plan, schema, endpoint list with authorization rules, threat model, and test plan for a secure document-sharing application. Asked the tool not to implement anything before approval.
- **Produced:** An initial project plan.
- **Wrong:** The initial plan was created before the official challenge brief was supplied, so it missed requirements including document categories, search, required documentation, and preparation for explaining authorization decisions during an interview.
- **Did instead:** Supplied the official brief and used it to guide the project requirements and implementation.
- **Related commit:** [Create PROMPTS.md](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/d202b56).

### 2026-10-20: Initial application foundation

- **Asked:** To build the initial TrustVault application foundation against the project requirements.
- **Produced:** The initial application files and project documentation.
- **Wrong:** The initial foundation needed further development to cover the complete document-management and security requirements.
- **Did instead:** Continued implementation in milestones and reviewed the application against the challenge requirements.
- **Related commit:** [Add TrustVault milestone 1 foundation](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/f373ef7).

### 2026-10-21: Document management and permissions

- **Asked:** To implement document management and permission-related API functionality.
- **Produced:** Document routes, permission routes, error-handling changes, and API documentation.
- **Wrong:** The initial implementation was not treated as sufficient evidence of correct authorization without testing actual access outcomes.
- **Did instead:** Reviewed authorization checks and manually tested permission grants, denied access, and revocation. After revocation, a second account could no longer access the document through the tested API endpoints, while the owner retained access.
- **Related commit:** [Implement document management and permissions](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/457da3e).

### 2026-10-21: Dashboard and API integration

- **Asked:** To connect the frontend dashboard to the backend API and implement document-management interactions.
- **Produced:** The React dashboard and API integration.
- **Wrong:** The frontend needed end-to-end verification rather than relying only on successful compilation.
- **Did instead:** Manually checked document upload, download, editing, and persistence after refreshing the page.
- **Related commit:** [Build document management dashboard and API integration](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/8f8d538).

### 2026-10-22: Private storage and security documentation

- **Asked:** To integrate private production document storage and align the README and threat model with implemented controls and known limitations.
- **Produced:** Supabase Storage integration for production document files and updates to `README.md` and `THREATS.md`.
- **Wrong:** Earlier documentation did not accurately distinguish implemented controls from partial protections and planned work. File-type checks based on the declared MIME type alone were also insufficient to establish that uploaded bytes matched the claimed type.
- **Did instead:** Added checks for PDF, JPEG, and PNG file signatures, UTF-8 validity for text files, null bytes, and consistency between the reported file size and the actual buffer. Ran the test suite and production build; both passed. These signature checks are basic validation, not complete file-format verification. The deletion test had previously emitted a storage-cleanup `ENOENT` warning despite passing, which warranted review.
- **Related commits:** [Update project and security documentation](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/d7860be) and [Integrate private Supabase document storage](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/21b5ee6).
- **Verification note:** The current local storage-validation changes are not yet represented by a commit link. Add their real commit hash after committing them; do not invent a link.

## Remaining verification

- Review audit logging to confirm sensitive actions are recorded accurately and consistently.
- Confirm that the threat model describes the actual implementation and does not imply guarantees the code does not provide.
- Record further findings only after reproducing them, verifying the result, and linking the real commit that addresses each issue.
