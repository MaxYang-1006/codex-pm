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
```

Default sandbox mode for real execution is `workspace-write`. Managed execution
must not disable the sandbox; unsafe modes such as `danger-full-access` or
`sandbox=false` are rejected.

## run

Runs several tasks safely.

```bash
codex-pm run --max-tasks 5
codex-pm run --mode smart
codex-pm run --mode guided
```

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
