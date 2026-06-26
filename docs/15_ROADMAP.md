# Roadmap

## v0.1 — Verified task loop (当前版本)

**Goal**: Prove the basic Codex PM loop works.

### Features
- `doctor` - Environment diagnostics
- `scan` - Parse docs and build task graph
- `status` - Show project and task status
- `next` - Recommend next runnable task
- `run-one --dry-run` - Generate task prompt without execution
- `run-one` - Real task execution with Codex
- `verification` - Run verify commands and check results
- `task-runs` - Audit log
- `risk gate` - Block high-risk tasks

### Acceptance Criteria
1. `codex-pm doctor` runs
2. `codex-pm scan` parses strict `docs/TASKS.md`
3. `.codex-pm/tasks.json` is created
4. `codex-pm next` recommends a runnable task with reason
5. `codex-pm run-one --dry-run` writes a valid task prompt
6. `codex-pm run-one` can execute a configured command safely
7. Verify commands are run and captured
8. Task state is updated
9. task-runs.jsonl is written
10. High-risk tasks are stopped

---

## v0.2 — Memory-enhanced PM

**Goal**: Use memory to improve decisions.

### Features
- Write threshold
- Simple recall
- Negative memory
- Compressed lessons
- Memory report

---

## v0.3 — Policy profiles

**Goal**: Support different PM personalities.

### Features
- balanced profile
- conservative profile
- startup profile
- research profile
- Task scoring affected by profile

---

## v0.4 — Feedback learning

**Goal**: Adapt weights from reward and penalty.

### Features
- Reward evaluator
- Fitness metrics
- Strategy recommendation
- User-approved strategy update

---

## v0.5 — Evolution experiments

**Goal**: Run repeatable experiments.

### Features
- Genome comparison
- Episode logs
- PM profile tournament
- Evolution report

---

## v0.6 — Optional lightweight model

**Goal**: Predict task success probability after enough data exists.

> Do not implement before enough task-runs data is available.

---

## v1.0 — Stable release

Stable Codex PM plugin and CLI for docs-first project delivery.

---

## Release Philosophy

- **v0.1-v0.5**: Experiment and prove core concepts
- **v1.0**: Stable API, documented, community-ready
- **No cloud services** in any version
- **No remote telemetry** in any version
- **Local-first** data storage

---

## Testing Requirements by Version

### v0.1
- Unit tests for core modules
- Integration tests for CLI commands
- Safety tests for risk gates

### v0.2+
- Memory utility evaluation
- Profile comparison tests
- Evolution experiment validation
