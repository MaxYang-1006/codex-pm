# AGENTS.md — Codex PM Development Rules

You are developing **Codex PM**, an open-source Codex-native project manager plugin.

## Required reading order

Before coding, read:

1. `CODEX_START_PROMPT.md`
2. `docs/00_PRODUCT_BRIEF.md`
3. `docs/01_PRD.md`
4. `docs/03_SYSTEM_ARCHITECTURE.md`
5. `docs/05_EVOLUTION_EXPERIMENT_SPEC.md`
6. `docs/06_MEMORY_SYSTEM_SPEC.md`
7. `docs/07_TASK_AND_DOCS_SPEC.md`
8. `docs/08_CLI_COMMAND_SPEC.md`
9. `docs/11_TASKS.md`
10. `docs/15_ROADMAP.md`

## Role model

- Codex is the LLM brain and engineer.
- Codex PM is the small-brain / cerebellum controller.
- Codex PM must not try to replace Codex with another model.
- Codex PM controls scheduling, risk, cost, memory, verification, and learning.

## Engineering rules

- Implement one task at a time.
- Do not implement future tasks early.
- Do not add cloud services.
- Do not add remote telemetry.
- Do not require proprietary APIs beyond the local Codex CLI.
- Prefer local files under `.codex-pm/` for state.
- Use TypeScript for the CLI implementation.
- Keep code modular and testable.
- CLI commands must have deterministic behavior where possible.
- v0.1 must work without a database.

## Safety rules

Never auto-run high-risk tasks without explicit approval:

- auth / login / permission systems
- payment / billing / subscription
- secrets / tokens / credentials
- database destructive migrations
- production deployment
- deleting many files
- modifying CI secrets
- user privacy or data-upload logic
- disabling verification or sandbox

## Verification rules

A task is not done merely because Codex says it is done.

A task is done only when:

1. required files are changed within task scope,
2. verification commands pass or are explicitly unavailable for this phase,
3. the result schema is saved,
4. task state is updated,
5. audit logs are written.

## Development order

Follow `docs/11_TASKS.md` from P0 onward.

Start with the simplest working CLI loop:

```bash
codex-pm doctor
codex-pm scan
codex-pm status
codex-pm next
codex-pm run-one --dry-run
```

Only after these work should you implement real Codex execution.
