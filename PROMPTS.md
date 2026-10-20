# PROMPTS.md

How I used AI on this project. **Write entries as you go, with the real commit that fixed the
problem.** The brief requires at least five dated entries, and at least two must be about
authorization, access control or the audit trail. "It was all fine" does not count; if the AI
got something right in a sensitive area, show the code you checked and how you checked it.

> **Note for the owner of this repo:** Milestone 1 was generated with an AI assistant. The
> entries below are what actually happened up to now, stated honestly. Add your own entries
> every time you catch the tool being wrong, and replace each `<commit>` with a real link.
> Do not invent problems, and do not leave real ones out.

## Reusable context and instructions

- [`AI_CONTEXT.md`](AI_CONTEXT.md): the security invariants and the review checklist I give the tool at the start of every session.
- Standing instruction used in every prompt: *"Do not generate the whole application at once. Show the plan, wait for approval, then build one milestone."*

## Entry template

```
### YYYY-MM-DD: short title
- Asked: what I told the tool to do (prompt or fair summary)
- Produced: what it gave back
- Wrong: what was wrong with it, specifically
- Did instead: what I changed, with a link to the commit
```

## Entries

### 2026-10-19: Planning before coding
- **Asked:** For a four-day plan, schema, endpoint list with authorization rules, threat model and test plan for a secure document-sharing app, and not to implement anything until I approved.
- **Produced:** A complete plan.
- **Wrong:** The plan was written before I had given the tool the official brief, so it missed things the brief asks for: a document **category** and date/owner/category search, `THREATS.md`, `PROMPTS.md`, API documentation, a demo video and a written write-up. It also gave no thought to the live interview, where I will be asked where the authorization decision is made when someone downloads a file.
- **Did instead:** Gave the tool the brief PDF, then Milestone 1 was built with the category column, `THREATS.md`, `PROMPTS.md` and `API.md` from day one. Commit: `<commit>`

### 2026-10-19: Tool could not install packages (environment failure, not a code error)
- **Asked:** Build Milestone 1 and run its tests.
- **Produced:** The tool reported that the sandbox could not reach the npm registry (network policy blocked it), so it could not run Express, Prisma or Vitest. It wrote all the files and verified what it could instead: Node-only logic checks and the SQL migration against a real PostgreSQL 16.
- **Wrong:** Nothing in the code, but the integration tests in `server/tests` had **never been executed** when I received them. Treat the first `npm test` run as the real verification.
- **Did instead:** Ran the tests locally and recorded any failures as entries here. Commit: `<commit>`

<!-- Add entries 3 to 5+ below as you catch real mistakes. At least two must concern
     authorization, access control or the audit trail. -->
