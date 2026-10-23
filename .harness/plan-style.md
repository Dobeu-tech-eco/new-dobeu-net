# Plan writing guidance

Form-only guidance derived from the installed DTS2 end-state template and lead output contract. Scope, facts, approvals and acceptance criteria remain in `.harness/end-state.md`; runtime rules remain in the installed DTS2 workflow and `.harness/discipline.md` when scaffolded.

## Read before planning

Read the current task, end state, config, lessons, scout and roster/probe results. For a rebrand task, also read `.agents/product-marketing-context.md` and the latest `.harness/gtm/<stamp>/readiness.md`. GTM recommendations are proposals, not new acceptance criteria or authority to change application behavior.

## Write in this order

1. `## Plan: <title>`: name the outcome. State tier, builder count and applied lesson IDs. Quote the acceptance criteria this run covers.
2. `### Builder N (<agent>)`: list skill order and `complexity: mechanical|normal|design`. Each task has a goal, section IDs, exact owned paths, read-only paths, dependencies and a checkable completion condition. Keep ownership disjoint.
3. Integration: identify its sole owner and prerequisite tasks when shared types, routes or config require it.
4. `### Handoff briefs`: list agent, task, files and done criteria, or `none`.
5. `## Done`: one outcome per line, each with a concrete test command, screen, source check or review axis. Keep this section nonempty.
6. `Axes:`: list required review axes and reviewer skills.
7. `## Blueprint coverage`: map every end-state layer to `Builder N` or `unchanged`.
8. `## Ready queue`: list eligible unassigned sections with paths and complexity, or `none`.
9. Risks: distinguish a decision, missing evidence and a blocker. Give each unresolved item an owner and next check.

## Evidence language

State what was observed, its source and the remaining limit. Source code present, tests passed and production verified are different claims. Preserve historical results with their dates; label new results separately. A report draft does not prove its recommendations were implemented.

Keep factual references and exceptions beside the action they govern. Use short paragraphs and flat lists; preserve required headings and machine-readable field names.
