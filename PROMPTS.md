# PROMPTS.md

How I used AI while building TrustVault. Entries describe actual work and verification; commit links point to the repository history.

## Reusable context

- [`AI_CONTEXT.md`](AI_CONTEXT.md): Security invariants and review checklist used when working with the AI assistant.
- Standing instruction: “Do not generate the whole application at once. Show the plan, wait for approval, then build one milestone.”

## Entries

### 2026-10-19: Planning before coding

- **Asked:** For a four-day plan, schema, endpoint list with authorization rules, threat model, and test plan for a secure document-sharing application. Asked the tool not to implement anything before approval.
- **Produced:** An initial project plan.
- **Wrong:** The initial plan was created before the official challenge brief was supplied, so it missed requirements including document categories, search, required documentation, and preparation for explaining authorization decisions during an interview.
- **Did instead:** Supplied the official brief and used it to guide the project requirements and implementation. Related project history: [Create PROMPTS.md](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/d202b56).

### 2026-10-20: Initial application foundation

- **Asked:** To build the initial TrustVault application foundation against the project requirements.
- **Produced:** The initial application files and project documentation.
- **Wrong:** Record any specific implementation mistake here only if it can be verified from the actual code, test output, or development history.
- **Did instead:** Continued development and verification locally. Related commit: [Add TrustVault milestone 1 foundation](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/f373ef7).

### 2026-10-21: Document management and permissions

- **Asked:** To implement document management and permission-related API functionality.
- **Produced:** Document routes, permission routes, error-handling changes, and API documentation.
- **Wrong:** Do not claim a specific authorization or access-control defect without verifying the implementation and the test that demonstrates it.
- **Did instead:** Review the authorization checks and test permission grants, denied access, and revocation before recording verified results. Related commit: [Implement document management and permissions](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/457da3e).

### 2026-10-21: Dashboard and API integration

- **Asked:** To connect the frontend dashboard to the backend API and implement document-management interactions.
- **Produced:** The React dashboard and API integration.
- **Wrong:** Record any actual integration issues discovered during testing here; do not invent an AI mistake.
- **Did instead:** Built the frontend successfully and manually checked document upload, download, editing, and persistence. Related commit: [Build document management dashboard and API integration](https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge/commit/8f8d538).

## Next verification

- Verify document access separately for owners, authorized users, and unauthorized users.
- Verify that revoking a permission actually blocks subsequent access.
- Inspect audit logging and confirm sensitive actions are recorded correctly.
- Add findings only after reproducing them and linking the commit that addresses each real issue.
