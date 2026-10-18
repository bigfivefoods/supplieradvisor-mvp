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

## Staging sign-in

Authenticated k6 scenarios use `loadtest/scenarios/authed.js`. It mints a short-lived HMAC token with `LOADTEST_SIGNING_KEY` from the environment and sends it as `Authorization: Bearer`. The key is not printed.

The server accepts that token only when all of these are true: `VERCEL_ENV=preview`, both Supabase URLs are staging ref `wpchtkfkaavcjyfgmktn`, `LOADTEST_ENDPOINTS=1`, and `LOADTEST_SIGNING_KEY` is at least 32 characters. `VERCEL_ENV=production` refuses before the key is used. No other variable turns it on. Privy verification is unchanged for every other token.

`LOADTEST_USERS` is a JSON list of the seeded users the scenario may call, with the `profile_id` values read from `business_users` after a seed. The mapped subjects are `loadtest-user-1-1`, `loadtest-user-1-2`, `loadtest-user-2-1`, and `loadtest-user-3-1`. A token subject must match `loadtest-user-<company>-<index>`. It cannot name a Privy user. `profile_id` is a required claim. Company access still goes through the existing membership check.

Tokens carry `exp` at most one hour after `iat`, a nonce, and `ref` equal to the staging project. Expired tokens, a wrong key, a wrong ref, and missing claims are rejected. The same token can be replayed until `exp`. There is no cross-instance nonce denylist.

A leaked `LOADTEST_SIGNING_KEY` can mint those tokens on the staging preview only. It cannot turn the verifier on in production, and it is not a Privy signing key.

Pass `LOADTEST_SIGNING_KEY` into k6 from the environment. Do not echo the expanded command and do not write the key into a file in this repo. `loadtest/scenarios/authed.js` reads `__ENV.LOADTEST_SIGNING_KEY` and `__ENV.LOADTEST_USERS`. The smoke profile does not call that scenario. This repository does not run k6 in CI.

## Not verified here

`k6 run` was not pointed at the staging preview. The preflight, including the report-only CSP exemption, was tested with a fake response, not against a deployment.
