# 07 — Task and Docs Spec

## Project docs

Recommended:

```text
docs/
  PRD.md
  ARCHITECTURE.md
  UI_STYLE_GUIDE.md
  API_SPEC.md
  DATABASE_SCHEMA.md
  TESTING.md
  TASKS.md
```

v0.1 requires only:

```text
docs/TASKS.md
```

## Docs authority order

When documents conflict:

```text
AGENTS.md > docs/TASKS.md > docs/ARCHITECTURE.md > docs/TESTING.md > docs/PRD.md > docs/UI_STYLE_GUIDE.md
```

## Strict TASKS.md format

v0.1 supports only strict Markdown tasks.

Example:

```markdown
### P0-T001: Initialize CLI project

Status: pending
Priority: 10
Risk: low
Size: S
Area: foundation
Depends on: none
Human approval: no
Locked: no

Description:
Create the initial TypeScript CLI project structure.

Files hint:
- package.json
- tsconfig.json
- src/cli.ts

Acceptance:
- CLI entry exists
- package builds
- help command works

Verify:
- npm run typecheck
- npm run build

Blocked rules:
- Do not implement task execution yet
- Do not add cloud services
```

## Task fields

Required:

- id from heading
- title from heading
- status
- priority
- risk
- size
- area
- depends_on
- human_approval
- locked
- description
- files_hint
- acceptance
- verify
- blocked_rules

## Status values

```text
pending
running
done
failed
blocked
needs_approval
needs_review
locked
```

## Risk values

```text
low
medium
high
critical
```

## Size values

```text
XS
S
M
L
XL
```

## Runtime state

`docs/TASKS.md` is human source.

`.codex-pm/tasks.json` is machine runtime state.

Do not manually rewrite `docs/TASKS.md` for every execution. Sync it when docs change.
