# Open pull request triage (26 Oct 2026)

SupplierAdvisor® had 24 open pull requests when this review was written. Nothing here was merged or closed. Recommendations are for Craig.

Later drafts from this same improvement pass (#302, #303, #305) are not part of the 24.

## Merge

| PR | Why |
| --- | --- |
| [#211](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/211) | `actions/setup-node` 4 to 7. Three files. Mergeable. Typecheck, unauth smoke, and the preview deployment are green. |
| [#212](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/212) | `actions/checkout` 4 to 7. Three files. Mergeable. The same checks are green. |

## Close

These are drafts from June 2026, each about 20,000 lines, all based on the same old `main`. `app/dashboard/select-company/page.tsx` already exists on current `main`. Keeping them open hides newer work.

| PR | Title |
| --- | --- |
| [#2](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/2) | ContainerSpaza profile and ordering |
| [#4](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/4) | Owned-company scoping |
| [#5](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/5) | select-company TypeScript rebuild |
| [#6](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/6) | Restore select-company |
| [#7](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/7) | UID-scoped company pages and CIPC |
| [#8](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/8) | Multi-country verification registry |
| [#9](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/9) | Get Verified button |
| [#10](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/10) | Returning-user company association |

## Close the July CRM stack

[#12](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/12) through [#20](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/20) are a stack. Each PR targets the previous stack branch, not current `main`. Customer invitations already exist on `main` (`customer_invitations` in `lib/customers/access.ts`). #20 is not a draft and changes about 27,000 lines on top of that stack. Merging the stack would not land it on `main`.

Close #12, #13, #14, #15, #16, #17, #18, #19, and #20. If a piece is still missing, rework that piece onto current `main` as a new draft.

## Rework

| PR | Recommendation |
| --- | --- |
| [#31](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/31) | AFS honesty pack. `lib/accounting/afs-honesty.ts` is not on `main`. The branch also adds `supabase/migrations/20260913_brief7_afs_honesty.sql`. Rebase onto current `main` and let the database work land separately. Do not merge the stale SQL with the app diff. |
| [#205](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/205) | Brief 79 credit applications. `lib/credit/` is not on `main`, so the feature is still absent. The draft also carries `RUN_THIS_FOR_BRIEF79.sql` and portal changes. Rebase onto current `main`, drop the root SQL from the app PR, and re-run typecheck before review. |
| [#300](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/300) | Eighteen minor and patch bumps, including Privy 3.18 to 3.50, Next.js 16.4.0 to 16.4.2, and pdfkit 0.19 to 0.20. Typecheck and unauth smoke failed on the PR. Do not merge until those are green. The Privy bump needs a sign-in check. |

## Major upgrades

| PR | Recommendation |
| --- | --- |
| [#214](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/214) | stripe 16 to 23. Lockfiles only. No application file imports the `stripe` package today (payments in the product go through Paystack). Do not merge the untouched Dependabot branch. Use the tested upgrade branch from this triage instead. |
| [#215](https://github.com/bigfivefoods/supplieradvisor-mvp/pull/215) | jose 5 to 6. **NEEDS APPROVAL.** `lib/auth/verify-privy.ts` verifies Privy access tokens with `jose`. Do not merge the untouched Dependabot branch. Use the tested upgrade branch from this triage, and do not deploy it without Craig's approval. |
