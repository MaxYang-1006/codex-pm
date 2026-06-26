# 08 — CLI Command Spec

## Command overview

```bash
codex-pm start
codex-pm doctor
codex-pm scan
codex-pm validate-docs
codex-pm status
codex-pm next
codex-pm run-one
codex-pm run
codex-pm repair
codex-pm review
codex-pm memory report
codex-pm fitness
codex-pm evolve
codex-pm energy
```

## start

First-run command.

```bash
codex-pm start
codex-pm start --run-first
codex-pm start --dry-run
```

Behavior:

1. run doctor,
2. scan docs,
3. parse tasks,
4. initialize `.codex-pm/`,
5. recommend next task,
6. ask before code-changing execution unless `--run-first` is present.

## doctor

Checks local environment:

- current directory,
- Git availability,
- Codex CLI availability,
- Node version,
- docs existence,
- task format,
- package manager,
- verify command availability,
- git dirty state.

## scan

Reads docs and generates:

```text
.codex-pm/docs-index.json
.codex-pm/tasks.json
.codex-pm/reports/scan-report.md
```

## status

Shows:

- total tasks,
- done/pending/blocked counts,
- current phase,
- recent failures,
- next recommendation.

## next

Recommends next task without execution.

Options:

```bash
codex-pm next --mode smart
codex-pm next --mode sequential
```

## run-one

Runs one task or writes prompt in dry-run.

```bash
codex-pm run-one
codex-pm run-one --task P1-T002
codex-pm run-one --dry-run
codex-pm run-one --sandbox workspace-write
codex-pm run-one --interactive
```

Options:
- `--interactive`: Prompt for approval on high-risk tasks (high/critical)

Default sandbox mode for real execution is `workspace-write`. Managed execution
must not disable the sandbox; unsafe modes such as `danger-full-access` or
`sandbox=false` are rejected.

## run

Runs several tasks safely.

```bash
codex-pm run --max-tasks 5
codex-pm run --mode smart
codex-pm run --mode guided
codex-pm run --interactive
codex-pm run --refill-energy 1000
```

Options:
- `--interactive`: Prompt for approval on high-risk tasks (high/critical)
- `--refill-energy <number>`: Refill energy before running

## repair

Repairs latest failed task.

```bash
codex-pm repair
codex-pm repair --task P2-T004
```

## review

Reviews current diff and task status.

## memory report

Prints memory summaries.

## fitness

Shows PM fitness metrics.

## evolve

Runs evolution experiment mode.

v0.1 may only record episodes and not mutate strategies automatically.

## energy

Manages energy balance.

```bash
codex-pm energy
codex-pm energy --status
codex-pm energy --refill 500
codex-pm energy --reset
```

Options:
- `--status`: Show current energy status (default)
- `--refill <number>`: Add energy to balance
- `--reset`: Reset energy to initial value (500)

Energy Rules:
- Initial: 500 units
- Max: 2000 units
- Time restore: 50 units/hour
- Success refund: 30% of task cost (only when verification passes)
