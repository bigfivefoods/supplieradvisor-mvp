# Load-test harness

k6 is a standalone binary. It is not an npm dependency and it is not installed by `npm ci`. Do not add it to `package.json`.

Install (operator machine only): see the k6 install page for the current package. This repository does not download it in CI.

CI workflows do not run k6. Do not add a workflow that does. A run needs a named staging target, a cost cap, and a start time. That is a separate approval.

## What this directory does

`loadtest/lib/guard.js` throws before any request unless all of the following are true:

- `BASE_URL` is a URL whose host is in `LOADTEST_ALLOWED_HOSTS` (comma-separated, no default).
- That host is not the production site, the production `vercel.app` alias, a subdomain of the production site, or a host that contains the production Supabase project ref `onkklullmgrdqoertngp`. Putting a production host on the allow-list does not override this.
- `LOADTEST_EXPECT_PROJECT_REF` is set and is not the production ref.
- A preflight `GET` to `/api/loadtest/whoami` returns HTTP 200 with `stage: "staging"` and `projectRef` equal to `LOADTEST_EXPECT_PROJECT_REF`. The server ref and the public ref must be the same value. A trailing dot on a host is stripped before the deny list and the allow-list. The allow-list is an exact host match.

During a run, any response header or body that contains the production project ref aborts the run. The one exception is the report-only `Content-Security-Policy-Report-Only` header. The staging preview sends that header with the production Supabase host in `connect-src`, and the header is not enforced. The enforced `Content-Security-Policy` header is still scanned. Any other header, the body, `BASE_URL`, `LOADTEST_ALLOWED_HOSTS`, and `LOADTEST_EXPECT_PROJECT_REF` still abort the run when they name the production project ref.

The profiles (`smoke`, `baseline`, `step`, `soak`, `spike`, `breakpoint`) only call that whoami route after the guard. They do not log in and they do not write. The weighted mixes (login, dashboard, lists, writes, imports, public pages, webhooks, crons) belong in a later scenarios change.

## Route

`GET /api/loadtest/whoami` is public so the preflight can reach it without a session. The folder is not a private underscore path, so Next.js routes it. It returns 404 unless `LOADTEST_ENDPOINTS=1`. It also returns 404 when `VERCEL_ENV` is `production`, when either Supabase URL is the production project, or when `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` name different projects. The server client prefers `SUPABASE_URL`. That variable is not set by this change. Setting `LOADTEST_ENDPOINTS=1` on a staging deployment is an environment change and needs approval. The 200 body is the two public refs and `stage: "staging"`. Pooler URLs take the ref from the `postgres.<ref>` user, not from the pooler host label.

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

`k6 run` was not pointed at the staging preview. The preflight, including the report-only CSP exemption, was tested with a fake response, not against a deployment.
