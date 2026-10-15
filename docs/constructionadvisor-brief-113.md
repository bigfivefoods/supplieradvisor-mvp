# ConstructionAdvisor® redesign (Brief 113)

The desk is ConstructionAdvisor®. The module id stays `constructiongraph`.

Navigation on the dashboard is the core sidebar group only: Home, Core, Ops, Money, Assure, Handover, Insights, and Grow. There is no in-page sidebar on the desk.

Three installable apps follow TradeAdvisor®: owner at `/work/constructiongraph`, workers at `/crew/constructiongraph/[token]`, and client at `/customer/constructiongraph/[token]`. Issued links still open at `/construction/[token]` and dispatch by portal kind. There is no subcontractor login. The subcontractor list is a record of the trades on a site, with an Invite to TradeAdvisor® placeholder labelled Site Link coming next.

Roles come from the existing company permissions. The staff API returns `storeForRole`. A site manager response omits money keys unless the owner sets `workers_see_money`, and that flag is owner/admin only. Brief 112 is on `main`: portal tokens are hashed, writes use compare-and-swap, and the public route keeps the durable throttle.

Sample screens live at `/preview/constructiongraph` and do not call the API. Amounts are rand numbers as entered. The book does not calculate VAT.
