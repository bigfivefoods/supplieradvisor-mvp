# Load-test harness

k6 is a standalone binary. It is not an npm dependency and it is not installed by `npm ci`. Do not add it to `package.json`.

Install (operator machine only): see the k6 install page for the current package. This repository does not download it in CI.

CI workflows do not run k6. Do not add a workflow that does. A run needs a named staging target, a cost cap, and a start time. That is a separate approval.

## What this directory does

`loadtest/lib/guard.js` throws before any request unless all of the following are true:

- `BASE_URL` is a URL whose host is in `LOADTEST_ALLOWED_HOSTS` (comma-separated, no default).
- That host is not the production site, the production `vercel.app` alias, a subdomain of the production site, or a host that contains the production Supabase project ref `onkklullmgrdqoertngp`. Putting a production host on the allow-list does not override this.
- `LOADTEST_EXPECT_PROJECT_REF` is set and is not the production ref.
- A preflight `GET` to `/api/_loadtest/whoami` returns HTTP 200 with `stage: "staging"` and `projectRef` equal to `LOADTEST_EXPECT_PROJECT_REF`.

During a run, any response header or body that contains the production project ref aborts the run.

The profiles (`smoke`, `baseline`, `step`, `soak`, `spike`, `breakpoint`) only call that whoami route after the guard. They do not log in and they do not write. The weighted mixes (login, dashboard, lists, writes, imports, public pages, webhooks, crons) belong in a later scenarios change.

## Route

`GET /api/_loadtest/whoami` is public so the preflight can reach it without a session. It returns 404 unless `LOADTEST_ENDPOINTS=1`. That variable is not set by this change. Setting it on a staging deployment is an environment change and needs approval. The 200 body is `{ "projectRef", "stage": "staging" }` and nothing else. `projectRef` is the hostname label of `NEXT_PUBLIC_SUPABASE_URL`, which is already public.

## Example (staging only)

```bash
k6 run \
  -e BASE_URL=https://your-staging-host.example \
  -e LOADTEST_ALLOWED_HOSTS=your-staging-host.example \
  -e LOADTEST_EXPECT_PROJECT_REF=yourstagingref \
  loadtest/profiles/smoke.js
```

A production URL exits non-zero and sends no request. An empty allow-list does the same.

## Not verified here

No staging project was available. The preflight was tested with a fake response, not against a deployment. `k6 run` was not pointed at any live host.
