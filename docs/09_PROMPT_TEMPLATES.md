# 09 — Prompt Templates

## Task execution prompt

```markdown
# Codex PM Task Brief

You are Codex, acting as the project engineer.
Codex PM is the project manager controller.

## Required reading

Read if present:

- AGENTS.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/TESTING.md
- docs/TASKS.md

## Current task

ID: {{task.id}}
Title: {{task.title}}
Area: {{task.area}}
Risk: {{task.risk}}
Size: {{task.size}}

## Description

{{task.description}}

## Relevant memory

{{memory.recalled}}

## Files hint

{{task.files_hint}}

## Acceptance criteria

{{task.acceptance}}

## Verify commands

{{task.verify}}

## Boundaries

- Complete only this task.
- Do not implement future tasks.
- Do not rewrite unrelated modules.
- Do not delete files outside the task scope.
- Do not add cloud services.
- If blocked, report the blocker.

## Final response

Return a short summary and a JSON block matching the task result schema.
```

## Repair prompt

```markdown
# Codex PM Repair Brief

The previous attempt for task {{task.id}} failed.

Failure summary:
{{failure.summary}}

Verification output:
{{failure.verify_output}}

Your job:
- only repair the failure,
- do not expand task scope,
- do not refactor unrelated files,
- rerun or explain verification.
```

## Task selection prompt

v0.1 can use deterministic scoring only. Later versions may ask Codex to review candidates.

```markdown
Given these runnable tasks, choose the safest and highest-value next task.
Only choose from the candidate list.
Return JSON only.
```
