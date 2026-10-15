# ConstructionAdvisor® redesign (Brief 113)

The desk is ConstructionAdvisor®. The module id stays `constructiongraph`.

Navigation is the core sidebar group only: Home, Core, Ops, Money, Assure, Handover, Insights, and Grow. There is no in-page sidebar.

Roles come from the existing company permissions. The staff API returns `storeForRole`. A site manager response omits money keys. Brief 112 (hashed portal tokens, compare-and-swap writes, and the durable throttle) is not on `main` at the base of this branch, so this change does not reimplement that work.

Sample screens live at `/preview/constructiongraph` and do not call the API. Amounts are rand numbers as entered. The book does not calculate VAT.
