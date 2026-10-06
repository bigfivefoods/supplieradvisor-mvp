# Contributing

- Base branch is `main`; open one brief-focused PR at a time.
- `main` is branch-protected: do not force-push shared branches.
- Required checks for merge are:
  - `tsc --noEmit`
  - `Unauth API smoke`
  - `Session e2e (optional secrets)`
- Re-run Typecheck from CLI:
  - `gh workflow run typecheck.yml --ref <branch>`
- CI also runs on `merge_group` for merge queue readiness.
- Keep CI files least-privilege (`permissions: contents: read`) unless a workflow truly needs more.
- Never commit secrets, tokens, or credentials.
- E2E smoke targets production via `PLAYWRIGHT_BASE_URL` (default `https://www.supplieradvisor.com`).
- Do not add assertions that only pass after deploy; tests must pass against current production behavior.
