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

During a run, any response header or body that contains the production project ref aborts the run.

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

No staging project was available. The preflight was tested with a fake response, not against a deployment. `k6 run` was not pointed at any live host.

## Brief 122 B4 — module store token merge (staging only)

This section stands on its own. The profiles above do not call `rpc/sa_put_module_store`.

`loadtest/scenarios/module-store-put.js` is a staging-only k6 script. It is not wired into CI and it was not run. `k6` is still not an npm dependency.

Before any request it uses the harness guard: `assertHostAllowed` on `BASE_URL`, then `assertSupabaseRestUrl` on `LOADTEST_SUPABASE_URL`. A production host, an empty allow-list, the production project ref, or a Supabase URL whose ref is not `LOADTEST_EXPECT_PROJECT_REF` throws and sends nothing. `setup` then preflights `GET /api/loadtest/whoami` and requires `stage: "staging"`.

The run is 20 VUs for 1 minute, all on the same `LOADTEST_COMPANY_ID` and `LOADTEST_MODULE`. Each iteration `POST`s `{supabase}/rest/v1/rpc/sa_put_module_store` with that module's `*_public_token` and `*_client_tokens` keys. The body is identical across VUs, so the calls contend on one GymAdvisor® (`fitgraph`, when that is the module you pass) store row and its token mirror. Thresholds, from Brief 122 B4: p95 under 1 second, mean under 300 ms, and 0 lock timeouts (`55P03`).

The service-role key is an operator secret for the staging project named by `LOADTEST_EXPECT_PROJECT_REF`. Do not point this script at production. Do not print the key.

```bash
k6 run \
  -e BASE_URL=https://your-staging-host.example \
  -e LOADTEST_ALLOWED_HOSTS=your-staging-host.example \
  -e LOADTEST_EXPECT_PROJECT_REF=yourstagingref \
  -e LOADTEST_SUPABASE_URL=https://yourstagingref.supabase.co \
  -e LOADTEST_SERVICE_ROLE_KEY=staging-service-role-key \
  -e LOADTEST_COMPANY_ID=123 \
  -e LOADTEST_MODULE=fitgraph \
  loadtest/scenarios/module-store-put.js
```

ApparelAdvisor® and ConstructionAdvisor® public token reads use the same `profiles.metadata` mirror. This script does not call those public routes. It only writes the module-store RPC on the staging company you name.
