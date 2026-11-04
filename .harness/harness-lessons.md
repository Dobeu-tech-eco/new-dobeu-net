# Harness lessons

- [H-001] Validate a nonempty builder artifact rather than accepting a zero CLI exit status as completed work. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [H-002] The daily skills-check sweep's `npx skills update -p -y` re-links copy-installed skills as symlinks into .agents/skills when their skills-lock.json entry lacks installMode; tracked skill directories show as deleted. Reinstall with `-a claude-code --copy -y` so the lock records copy, or make the sweep pass --copy. (seen 1x, last 2026-11-04, source: run 20261103-213646 resume)
- [H-003] handoff-write.py derives Next action from the first open action item, so a mid-run checkpoint (uncommitted work awaiting ship approval) is only visible in Last decision; have next_action read a 'checkpoint' marker from state.md before falling back to the item list. (seen 1x, last 2026-11-04, source: run 20261103-213646 resume)
