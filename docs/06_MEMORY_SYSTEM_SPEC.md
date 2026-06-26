# 06 — Memory System Spec

## Purpose

Codex PM memory is not chat memory. It is project execution memory.

It helps the PM:

- avoid repeating failures,
- recall user decisions,
- choose safer tasks,
- improve prompts,
- control risk,
- measure learning.

## Memory types

### Project Memory

Long-term project goals, architecture decisions, constraints.

### Task Memory

Per-task execution history.

### Risk Memory

Files, task types, and patterns that caused incidents.

### Prompt Memory

Prompt templates and their success/failure history.

### Decision Memory

User-approved decisions and constraints.

### Negative Memory

Failures, bad strategies, scope creep, rejected changes.

### Compressed Lessons

Summaries created from raw logs.

## Required mechanisms

### 1. Write threshold

Not every event becomes long-term memory.

```text
memory_write_score =
  importance * 0.35
+ recurrence * 0.20
+ risk_value * 0.20
+ future_usefulness * 0.20
- noise_score * 0.15
```

Default write threshold:

```json
{ "memory_write_threshold": 0.65 }
```

### 2. Recall weights

```text
recall_score =
  semantic_relevance * 0.35
+ task_area_match * 0.20
+ recency * 0.15
+ risk_relevance * 0.15
+ user_decision_weight * 0.15
```

v0.1 can implement keyword-based recall. v0.2 can improve recall scoring.

### 3. Forgetting

Memory states:

- active
- archived
- discarded
- superseded
- invalid
- rejected_by_user

### 4. Compression

Raw task logs should be compressed into reusable lessons.

Example:

```text
Database migration tasks failed twice due to incorrect migration path. For future db tasks, include migration path checks in the Codex brief.
```

### 5. Negative memory handling

Negative memory must become future guardrails, not vague failure logs.

### 6. Memory utility evaluation

If recalled memory helps a task succeed, increase utility.

If recalled memory is irrelevant or harmful, decrease utility.

### 7. Memory pollution cleanup

Pollution sources:

- outdated architecture,
- rejected user decisions,
- false Codex summaries,
- duplicated facts,
- low-value noise.

Cleanup should mark memory status rather than deleting important history.

## Storage

```text
.codex-pm/memory/
  project-memory.json
  task-memory.jsonl
  risk-memory.json
  prompt-memory.json
  decision-memory.md
  negative-memory.jsonl
  compressed-lessons.md
```
