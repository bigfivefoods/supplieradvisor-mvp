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
- Unauth API smoke keeps the check name `Unauth API smoke`. It runs from `.github/workflows/e2e-smoke.yml` when a Preview or Production deployment succeeds, against that deployment's URL. `deployment_status` reads the workflow on `main`, so this gates after merge. Manual dispatch takes a `base_url` input (default `https://www.supplieradvisor.com`).
- Session e2e is unchanged (`E2E_ACCESS_TOKEN`, `settle-mutate`) and runs from `.github/workflows/e2e-session.yml` on push, pull request, merge queue, and manual dispatch. It does not run on deployment status.
- Do not loosen smoke assertions to hide deploy lag. The unauth smoke must hit the deployment that contains the change.
