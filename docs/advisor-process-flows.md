# Advisor process flows

One shared diagram for an advisor Command page. The component draws whatever a typed data file describes. It does not fetch, it does not count rows, and it does not open a new route.

## Types

| Name | Role |
| --- | --- |
| `AdvisorFlowDef` | One module: phases, steps, roles, guardrails, roots |
| `FlowStepDef` | One step: status, target, who, sources |
| `FlowTarget` | A module path or an absolute in-app path |
| `FlowStatus` | `live`, `partial`, or `soon` |
| `AdvisorFlowView` | What the component renders after `resolveAdvisorFlow` |
| `FlowNodeView` | One step in that view: `id`, `n`, `title`, `desc`, `who`, `icon`, `state`, `linkHref`, `chips`, `mine`, `ariaLabel`, `secondary` |

`recovergraph` has its own diagram (`RecoverProcessFlow`) and is not in `ADVISOR_FLOWS`.

## How to add a module

1. Add `lib/advisors/process-flows/<module>.ts` exporting an `AdvisorFlowDef`. Read the screens before writing the copy. If a step is less built than it looks, mark it `partial` or `soon`.
2. Register it in `ADVISOR_FLOWS` inside `lib/advisors/process-flows/index.ts`. That map is the only registry.
3. Mount `<AdvisorProcessFlow module="..." />` once on that module's Command page. Pass the role, capability object, and `hrefBase` the page already has.
4. Add one row to `SHARED_MOUNTED` in `lib/advisors/process-flows/brief120-flow-mounts.test.ts`.

Ids that are not in that mount table and not in its `OWN` map are not registered. The test derives that remainder from `ADVISOR_OS_MODULE_IDS`, so there is no second list to edit.

Reuse an icon from `FLOW_ICON_NAMES`. A new picture is one name in that list and one entry in the `ICONS` map in `components/advisors/AdvisorProcessFlow.tsx`. TypeScript rejects a name with no icon. A module that reuses a name does not edit the component.

No new route, no sidebar edit, no migration. This doc does not keep a per-module id table.

## Status

- **live**: the screen does what the sentence says, and the step is a link.
- **partial**: the screen exists, and the note says what is missing. The step can still be a link.
- **soon**: there is no screen. `to` is null, the note is visible, and the step is not a link.

Downgrade beats overclaim. A step that cannot be shown from the code is not live.

## Links

A step is a link only when it has a target and the capability it needs is not false. Otherwise the card says "Not available to your role".

On a signed-out preview (`hrefBase` starts with `/preview/`):

- A module path is a link only when that path is in `previewPaths`. Other module paths say "Open in the signed-in app".
- An app path is plain text unless it has a `previewHref`.
- A known preview role is kept on the link as `?role=`, so the visitor stays in the role they chose. A `previewHref` that already sets `role` is left as written.

`soon` is never a link. Nothing uses `href="#"`.

Every flow starts closed for every role. Owner, manager, admin, an unknown role, and no role all start closed. The choice is not stored, and it does not change when the role loads or changes. The header always shows the title and the step and status summary. The toggle is a button. Tab reaches it, and Enter or Space opens and closes it. It sets `aria-expanded` and `aria-controls`. The panel those attributes name stays in the page when the flow is closed.

TradeAdvisor®, ApparelAdvisor® and ContainerAdvisor® have no module role on the Command page. The signed-in mount reads the company role already cached for the session. That role marks "You" and chooses which links stay available. It does not open the flow. ContainerAdvisor® does not mount until the company role is known, so a loading role is not drawn as a viewer. ApparelAdvisor® and ContainerAdvisor® have no signed-out preview, so their mounts are only on the signed-in Command page. The signed-out TradeAdvisor® preview does not call that hook. The module diagrams that keep their own components, and RecoverAdvisor®, start closed the same way.

Role `none` does not mount the diagram. FleetAdvisor® also leaves it unmounted while the company role has not been read, or while database setup is still pending, so that window is not drawn as a viewer.

HealthAdvisor® has no signed-out preview. Its Command page has three branches. Each branch mounts only the steps whose audiences include that branch, and only after the programme role has loaded. An unresolved role is not drawn as a clinic or hospital. The facilities, health map and management addresses are redirects, so the diagram links to the department desk, the schools map and the report.

## Colour and the registered mark

Cyan `#00b4d8` fill, navy `#0f172a` text on it, `#0077b6` for links and text on white. Never white text on cyan. The component does not use amber or stone utility classes, and it does not use a dark-mode variant.

Write the registered mark after the product name in prose (`TradeAdvisor®`). Do not put it in routes, ids, anchors, or test ids.

## Modules

The ids live in `ADVISOR_OS_MODULE_IDS`. Own diagrams, including RecoverAdvisor®, are the `OWN` map in the mounts test. Shared diagrams are the keys of `ADVISOR_FLOWS`. TradeAdvisor®, ConstructionAdvisor®, FleetAdvisor®, ApparelAdvisor®, ContainerAdvisor® and HealthAdvisor® are registered today.

## Left out on purpose

Live counts on a step, a PDF of the diagram, a chain of pills, a separate "who does what" grid, and any progress percentage. The optional `chips` prop can show a count later, only where an exact scoped query already exists. Nothing in the current registry passes chips.
