# 11 — TASKS

This file is the implementation plan for Codex. Follow it phase by phase. Complete one task at a time.

---

## P0 — Project Skeleton

### P0-T001: Initialize TypeScript CLI skeleton

Status: done
Priority: 10
Risk: low
Size: S
Area: foundation
Depends on: none
Human approval: no
Locked: no

Description:
Create the initial TypeScript CLI project structure for Codex PM.

Files hint:
- package.json
- tsconfig.json
- src/cli.ts
- src/commands/
- src/core/
- src/types/

Acceptance:
- `codex-pm --help` command is defined
- project compiles with TypeScript
- command modules are structured

Verify:
- npm run typecheck
- npm run build

Blocked rules:
- Do not implement Codex execution yet
- Do not add cloud services

### P0-T002: Add plugin and skill files

Status: done
Priority: 9
Risk: low
Size: S
Area: plugin
Depends on: P0-T001
Human approval: no
Locked: no

Description:
Ensure `.codex-plugin/plugin.json` and `skills/codex-pm/SKILL.md` are valid and included in the repo.

Files hint:
- .codex-plugin/plugin.json
- skills/codex-pm/SKILL.md
- skills/codex-pm/references/

Acceptance:
- plugin manifest exists
- skill file explains Codex PM behavior
- references explain docs and safety conventions

Verify:
- npm run typecheck

Blocked rules:
- Do not implement MCP

### P0-T003: Define shared TypeScript types

Status: done
Priority: 10
Risk: low
Size: M
Area: foundation
Depends on: P0-T001
Human approval: no
Locked: no

Description:
Implement shared TypeScript types for tasks, state, task results, PM genome, memory records, and command options.

Files hint:
- src/types/task.ts
- src/types/state.ts
- src/types/memory.ts
- src/types/genome.ts
- src/types/result.ts

Acceptance:
- all core data models are typed
- status/risk/size unions are defined
- types match docs/10_DATA_SCHEMAS.md

Verify:
- npm run typecheck

Blocked rules:
- Do not implement business logic here

### P0-T004: Add baseline tests and test command

Status: done
Priority: 8
Risk: low
Size: S
Area: testing
Depends on: P0-T001
Human approval: no
Locked: no

Description:
Add a minimal test setup using Node test runner or another simple local test runner.

Files hint:
- tests/
- package.json

Acceptance:
- `npm test` runs successfully
- at least one smoke test exists

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not add heavy test frameworks unless necessary

---

## P1 — Docs Scanner and Task Parser

### P1-T001: Implement docs scanner

Status: done
Priority: 10
Risk: low
Size: M
Area: docs
Depends on: P0-T003
Human approval: no
Locked: no

Description:
Implement scanner that reads Markdown files under `docs/`, computes basic metadata and hashes, and writes docs index.

Files hint:
- src/core/docs-scanner.ts
- src/core/file-utils.ts
- tests/docs-scanner.test.ts

Acceptance:
- scans docs directory
- detects missing docs gracefully
- writes docs-index compatible object

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not parse tasks in this task

### P1-T002: Implement strict TASKS.md parser

Status: done
Priority: 10
Risk: medium
Size: L
Area: parser
Depends on: P1-T001
Human approval: no
Locked: no

Description:
Parse strict Markdown task format from docs/TASKS.md into structured tasks.

Files hint:
- src/core/task-parser.ts
- src/core/task-normalizer.ts
- tests/task-parser.test.ts

Acceptance:
- parses heading-based tasks
- parses required fields
- rejects malformed tasks with actionable errors
- supports `Depends on: none`

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not implement fuzzy parsing in v0.1

### P1-T003: Implement state store

Status: done
Priority: 10
Risk: low
Size: M
Area: state
Depends on: P1-T002
Human approval: no
Locked: no

Description:
Implement `.codex-pm/` state creation, reading and writing.

Files hint:
- src/core/state-store.ts
- src/core/file-utils.ts
- tests/state-store.test.ts

Acceptance:
- creates `.codex-pm/` directories
- writes tasks.json/state.json safely
- can load existing state

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not use external database

### P1-T004: Implement scan command

Status: done
Priority: 9
Risk: low
Size: M
Area: cli
Depends on: P1-T001, P1-T002, P1-T003
Human approval: no
Locked: no

Description:
Wire docs scanner, task parser, and state store into `codex-pm scan`.

Files hint:
- src/commands/scan.ts
- src/cli.ts

Acceptance:
- `codex-pm scan` creates `.codex-pm/tasks.json`
- scan report is printed
- malformed tasks produce readable errors

Verify:
- npm test
- npm run typecheck
- npm run build

Blocked rules:
- Do not execute Codex

---

## P2 — PM Cerebellum v0.1

### P2-T001: Implement task graph and dependency checker

Status: done
Priority: 10
Risk: low
Size: M
Area: scheduler
Depends on: P1-T003
Human approval: no
Locked: no

Description:
Build task graph, dependency checks, and runnable task filtering.

Files hint:
- src/core/task-graph.ts
- tests/task-graph.test.ts

Acceptance:
- filters pending tasks whose dependencies are done
- excludes locked tasks
- excludes tasks needing approval
- detects missing dependency IDs

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not implement Codex execution

### P2-T002: Implement risk gate

Status: done
Priority: 10
Risk: medium
Size: M
Area: risk
Depends on: P2-T001
Human approval: no
Locked: no

Description:
Implement rule-based risk scoring and high-risk stop conditions.

Files hint:
- src/core/risk-gate.ts
- tests/risk-gate.test.ts

Acceptance:
- scores risk based on task risk field, keywords, files hint, and historical risk hooks
- marks high/critical tasks as needs_approval
- supports hard-coded safety categories

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not allow disabling safety gates

### P2-T003: Implement energy/cost estimator

Status: done
Priority: 8
Risk: low
Size: M
Area: cost
Depends on: P2-T001
Human approval: no
Locked: no

Description:
Implement basic energy estimation for task size, risk, expected retries, and verify command count.

Files hint:
- src/core/energy-gate.ts
- tests/energy-gate.test.ts

Acceptance:
- estimates energy cost per task
- supports default per-task budget
- flags over-budget tasks for guided mode

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not integrate real billing APIs

### P2-T004: Implement task scorer and next command

Status: done
Priority: 10
Risk: low
Size: L
Area: scheduler
Depends on: P2-T001, P2-T002, P2-T003
Human approval: no
Locked: no

Description:
Implement deterministic task scoring and `codex-pm next`.

Files hint:
- src/core/task-scorer.ts
- src/commands/next.ts
- tests/task-scorer.test.ts

Acceptance:
- scores runnable tasks by priority, unlock count, risk, size, and failure history
- returns reason for selected task
- `codex-pm next` prints selected task and explanation

Verify:
- npm test
- npm run typecheck
- npm run build

Blocked rules:
- Do not call Codex yet

---

## P3 — Prompt Builder and Dry Run

### P3-T001: Implement memory recall stub

Status: done
Priority: 8
Risk: low
Size: M
Area: memory
Depends on: P1-T003
Human approval: no
Locked: no

Description:
Implement memory store scaffold and simple keyword-based recall stub.

Files hint:
- src/core/memory-store.ts
- src/core/memory-recall.ts
- tests/memory-recall.test.ts

Acceptance:
- can load memory files if present
- returns empty recall safely when memory is missing
- supports basic relevant memory records

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not implement full memory evolution yet

### P3-T002: Implement task prompt builder

Status: done
Priority: 10
Risk: low
Size: M
Area: prompt
Depends on: P2-T004, P3-T001
Human approval: no
Locked: no

Description:
Build task prompt from task, docs summary, recalled memory, acceptance, verify commands, and boundaries.

Files hint:
- src/core/prompt-builder.ts
- templates/prompts/task-execution.md
- tests/prompt-builder.test.ts

Acceptance:
- generates stable Markdown prompt
- includes task fields and boundaries
- writes prompt to `.codex-pm/prompts/<task-id>.md`

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not execute Codex in this task

### P3-T003: Implement run-one dry-run

Status: done
Priority: 10
Risk: low
Size: M
Area: cli
Depends on: P3-T002
Human approval: no
Locked: no

Description:
Implement `codex-pm run-one --dry-run` to select a task and write the Codex prompt without executing.

Files hint:
- src/commands/run-one.ts
- src/cli.ts

Acceptance:
- selects next task if no task id provided
- writes prompt file
- prints prompt path and selected task
- does not modify code outside `.codex-pm/`

Verify:
- npm test
- npm run typecheck
- npm run build

Blocked rules:
- Do not execute Codex yet

---

## P4 — Codex Execution and Verification

### P4-T001: Implement Codex executor wrapper

Status: done
Priority: 10
Risk: medium
Size: L
Area: executor
Depends on: P3-T003
Human approval: no
Locked: no

Description:
Implement local Codex CLI wrapper with dry-run support, timeout, stdout/stderr capture, and result file output.

Files hint:
- src/core/codex-executor.ts
- tests/codex-executor.test.ts

Acceptance:
- supports dry-run mode
- supports real command configuration
- captures logs
- does not use dangerous sandbox by default

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not bypass sandbox
- Do not require external cloud service

### P4-T002: Implement verification runner

Status: done
Priority: 10
Risk: medium
Size: M
Area: verification
Depends on: P4-T001
Human approval: no
Locked: no

Description:
Run task verify commands and capture results.

Files hint:
- src/core/verifier.ts
- tests/verifier.test.ts

Acceptance:
- runs commands sequentially
- captures exit code and output
- handles missing commands clearly
- supports timeout

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not mark task done without verification result

### P4-T003: Implement task result updater

Status: done
Priority: 10
Risk: low
Size: M
Area: state
Depends on: P4-T002
Human approval: no
Locked: no

Description:
Update task state after execution, write result JSON, and append task-runs.jsonl.

Files hint:
- src/core/result-writer.ts
- src/core/state-store.ts
- tests/result-writer.test.ts

Acceptance:
- writes structured task result
- appends JSONL audit log
- updates retry count and status
- handles failure and needs_review

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not delete old audit logs

### P4-T004: Implement real run-one

Status: done
Priority: 10
Risk: medium
Size: L
Area: cli
Depends on: P4-T001, P4-T002, P4-T003
Human approval: no
Locked: no

Description:
Implement full `codex-pm run-one` flow.

Files hint:
- src/commands/run-one.ts
- src/core/

Acceptance:
- selects or accepts task id
- applies risk gate
- builds prompt
- executes Codex unless dry-run
- verifies result
- updates state and memory log

Verify:
- npm test
- npm run typecheck
- npm run build

Blocked rules:
- Do not auto-run high-risk tasks

---

## P5 — Memory, Feedback, Fitness

### P5-T001: Implement memory write threshold

Status: done
Priority: 8
Risk: low
Size: M
Area: memory
Depends on: P4-T003
Human approval: no
Locked: no

Description:
Implement memory write scoring and selective memory persistence.

Files hint:
- src/core/memory-writer.ts
- tests/memory-writer.test.ts

Acceptance:
- computes memory write score
- writes only above threshold
- records negative memory for important failures

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not write every event into long-term memory

### P5-T002: Implement reward evaluator

Status: done
Priority: 8
Risk: low
Size: M
Area: learning
Depends on: P4-T003
Human approval: no
Locked: no

Description:
Compute reward and penalty from task result.

Files hint:
- src/core/reward-evaluator.ts
- tests/reward-evaluator.test.ts

Acceptance:
- rewards verification pass, one-shot success, unlock count
- penalizes failure, retry, scope creep, risk incident
- stores reward in task result

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not mutate genome yet

### P5-T003: Implement fitness metrics

Status: done
Priority: 8
Risk: low
Size: M
Area: fitness
Depends on: P5-T002
Human approval: no
Locked: no

Description:
Compute PM fitness metrics from task-runs.jsonl.

Files hint:
- src/core/fitness.ts
- src/commands/fitness.ts
- tests/fitness.test.ts

Acceptance:
- computes completion rate
- computes verification pass rate
- computes retry rate
- computes risk incident rate
- prints fitness summary

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not claim true evolution from insufficient data

---

## P6 — Short Loop and Repair

### P6-T001: Implement run loop with max tasks

Status: done
Priority: 9
Risk: medium
Size: L
Area: loop
Depends on: P4-T004
Human approval: no
Locked: no

Description:
Implement `codex-pm run --max-tasks N` for short safe loops.

Files hint:
- src/commands/run.ts
- src/core/loop-runner.ts

Acceptance:
- runs up to max tasks
- stops on high risk
- stops on repeated failure
- stops on energy budget exceeded
- writes loop report

Verify:
- npm test
- npm run typecheck
- npm run build

Blocked rules:
- Do not implement infinite unattended loop

### P6-T002: Implement repair command

Status: done
Priority: 8
Risk: medium
Size: M
Area: recovery
Depends on: P4-T004
Human approval: no
Locked: no

Description:
Implement repair prompt generation and optional repair execution.

Files hint:
- src/commands/repair.ts
- src/core/repair-builder.ts

Acceptance:
- finds latest failed task
- builds repair prompt
- supports dry-run
- limits scope to failure repair

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not retry more than configured max retries

---

## P7 — Evolution Experiment Scaffold

### P7-T001: Implement PM genome defaults

Status: done
Priority: 7
Risk: low
Size: M
Area: evolution
Depends on: P5-T003
Human approval: no
Locked: no

Description:
Implement default PM genomes: balanced, conservative, startup, research.

Files hint:
- src/core/genome.ts
- experiments/default-genomes.json
- tests/genome.test.ts

Acceptance:
- default genomes load
- genome fields match schema
- profile affects task scoring weights

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not auto-mutate safety boundaries

### P7-T002: Implement episode logger

Status: done
Priority: 7
Risk: low
Size: M
Area: evolution
Depends on: P5-T003, P7-T001
Human approval: no
Locked: no

Description:
Log task execution episodes for later evolution analysis.

Files hint:
- src/core/episode-logger.ts
- tests/episode-logger.test.ts

Acceptance:
- writes episodes.jsonl
- links task result, genome id, reward, penalty, fitness delta
- never deletes episode logs

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not perform automatic genome mutation yet

### P7-T003: Implement evolve report command

Status: done
Priority: 6
Risk: low
Size: M
Area: evolution
Depends on: P7-T002
Human approval: no
Locked: no

Description:
Implement `codex-pm evolve --report` to analyze whether strategy performance improved.

Files hint:
- src/commands/evolve.ts
- src/core/evolution-report.ts

Acceptance:
- reads episode logs
- compares profile performance
- outputs cautious conclusions
- recommends strategy changes without applying automatically

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Do not claim autonomous evolution without evidence

---

## P8 — Open Source Polish

### P8-T001: Write user-facing README

Status: done
Priority: 8
Risk: low
Size: M
Area: docs
Depends on: P6-T001
Human approval: no
Locked: no

Description:
Write practical README for installation, first start, task format, safety, and experiments.

Files hint:
- README.md

Acceptance:
- explains docs-first workflow
- explains safety gates
- includes minimal example
- avoids overclaiming one-click full project completion

Verify:
- npm run typecheck

Blocked rules:
- Do not oversell autonomous completion

### P8-T002: Add minimal example project

Status: done
Priority: 7
Risk: low
Size: S
Area: examples
Depends on: P6-T001
Human approval: no
Locked: no

Description:
Add a minimal example project under examples/.

Files hint:
- examples/minimal-project/docs/

Acceptance:
- includes PRD, ARCHITECTURE, TASKS
- can be scanned by codex-pm

Verify:
- npm test
- npm run typecheck

Blocked rules:
- Keep example small
