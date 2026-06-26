# 01 — PRD

## 1. Background

Developers using Codex often prepare strong project documents, but still need to manually prompt Codex task by task. This creates repeated context work, inconsistent task boundaries, skipped verification, and weak long-term learning.

Codex PM solves this by adding a project manager layer around Codex.

## 2. Target users

### Primary users

- Codex-heavy individual developers
- solo founders
- AI-native software builders
- researchers experimenting with agent behavior
- developers who maintain PRD/architecture/tasks in Markdown

### Secondary users

- small teams using docs-first development
- open-source maintainers
- prompt/workflow engineers

## 3. User problem

The user has project docs, but Codex does not continuously manage delivery.

The user currently must:

- choose the next task manually,
- copy relevant docs into prompts,
- remind Codex of boundaries,
- run tests manually,
- judge whether work is complete,
- retry failures manually,
- keep task progress updated manually.

## 4. Product goals

Codex PM should:

1. read `docs/`,
2. parse project tasks,
3. build a task graph,
4. choose safe runnable tasks,
5. brief Codex clearly,
6. execute one task at a time,
7. verify results,
8. write memory,
9. update progress,
10. gradually improve scheduling strategy.

## 5. Non-goals

v0.1 must not:

- build a web app,
- add a cloud backend,
- store remote telemetry,
- replace Codex with another LLM,
- auto-modify its own source code,
- bypass sandbox or user approval,
- claim one-click full project completion.

## 6. Capability levels

| Level | Name | Description |
|---|---|---|
| L0 | Docs Doctor | Validate `docs/` and task format. |
| L1 | PM Recommendation | Recommend next runnable task. |
| L2 | Single Task Execution | Brief Codex, execute one task, verify result. |
| L3 | Short Safe Loop | Execute several low-risk tasks with stop gates. |
| L4 | Memory-Enhanced PM | Use task history and failure memory to improve decisions. |
| L5 | Evolving PM | Adapt strategy and evaluate fitness over episodes. |

v0.1 target: L2-L3.

## 7. Success metrics

- percentage of tasks parsed correctly,
- next-task recommendation quality,
- one-task execution success rate,
- verification pass rate,
- retry rate,
- high-risk task stop accuracy,
- reduction in manual prompting,
- number of tasks completed per human intervention,
- improvement in fitness score over episodes.
