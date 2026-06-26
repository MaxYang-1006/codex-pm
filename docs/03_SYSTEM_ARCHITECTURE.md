# 03 — System Architecture

## Architecture overview

```text
User docs/
  ↓
Project Scanner
  ↓
Docs Index + Task Parser
  ↓
Task Graph
  ↓
Memory Recall
  ↓
PM Cerebellum
  ├── Task Scorer
  ├── Risk Gate
  ├── Energy Gate
  ├── Behavior Policy
  └── Fitness Context
  ↓
Prompt Builder
  ↓
Codex Executor
  ↓
Verification Gate
  ↓
Memory Writer + Reward Evaluator
  ↓
State Store + Reporter
```

## Main runtime directory

```text
.codex-pm/
  config.json
  state.json
  tasks.json
  docs-index.json
  task-runs.jsonl
  energy.json
  prompts/
  results/
  reports/
  memory/
    project-memory.json
    task-memory.jsonl
    risk-memory.json
    prompt-memory.json
    decision-memory.md
    negative-memory.jsonl
    compressed-lessons.md
  evolution/
    genomes.json
    episodes.jsonl
    fitness.json
```

## Module responsibilities

### Project Scanner

Reads `docs/` Markdown files and records file hash, title, and detected sections.

### Task Parser

Parses strict Markdown task format from `docs/TASKS.md`.

v0.1 should not attempt to parse arbitrary messy task documents.

### Task Graph

Builds dependencies and computes runnable tasks.

### PM Cerebellum

Non-LLM controller that decides what should happen next using rules, weights, memory, cost, risk, and profile.

### Energy Gate

Controls task execution through energy budget management:
- Estimates task energy cost based on size, risk, and retry count
- Tracks energy balance with persistence to `energy.json`
- Auto-restores energy at 50 units/hour (max 2000 units)
- Refunds 30% of energy when task succeeds with verification
- Blocks execution when energy is insufficient
- Supports manual energy refill and reset

Energy cost formula:
```
estimatedCost = baseCost × riskMultiplier × retryFactor + verificationCost
baseCost: XS=10, S=20, M=40, L=80, XL=160
riskMultiplier: none=0.8, low=1.0, medium=1.2, high=1.5, critical=2.0
```

### Prompt Builder

Creates concise Codex briefs from task, docs, memory, risk and verification context.

### Codex Executor

Wraps local Codex CLI execution.

v0.1 should support dry-run first, then real `codex exec`.

### Verification Gate

Runs verify commands and checks diff boundaries.

### Memory System

Records task runs, user decisions, negative memories, and compressed lessons.

### Evolution Engine

Runs optional experiments over strategy parameters. v0.1 scaffolds this; v0.3+ implements adaptation.

## Data flow

1. `start` creates state.
2. `scan` syncs docs to machine state.
3. `next` scores runnable tasks.
4. `run-one` creates prompt and executes or dry-runs.
5. `verify` runs commands.
6. `update-state` marks task result.
7. `memory write` records useful lessons.
8. `evolve` optionally updates PM genome after enough evidence.
