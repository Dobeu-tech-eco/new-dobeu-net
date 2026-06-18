#!/bin/bash
echo "@echo off" > close-stale-prs.cmd
echo "echo Closing stale PR branches..." >> close-stale-prs.cmd
git branch -r | grep -v main | grep -v HEAD | sed 's/ *origin\///' | grep -v "add-claude-github-actions" | grep -v "cc-dev" | grep -v "claude/" | grep -v "codex/" | grep -E '^bolt|^palette|^sentinel|^perf|^ux|^fix|^feat|^chore|^security|^copilot' | while read branch; do
  echo "git push origin --delete \"$branch\"" >> close-stale-prs.cmd
done
echo "echo Done!" >> close-stale-prs.cmd
