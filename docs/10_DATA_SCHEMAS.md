# 10 — Data Schemas

This document summarizes runtime JSON objects. Canonical JSON Schema files are in `schemas/`.

## Task

```json
{
  "id": "P0-T001",
  "title": "Initialize CLI project",
  "status": "pending",
  "priority": 10,
  "risk": "low",
  "size": "S",
  "area": "foundation",
  "depends_on": [],
  "human_approval": false,
  "locked": false,
  "description": "...",
  "files_hint": [],
  "acceptance": [],
  "verify": [],
  "blocked_rules": [],
  "retry_count": 0,
  "max_retries": 2
}
```

## PM Genome

```json
{
  "id": "balanced-v1",
  "profile": "balanced",
  "weights": {
    "priority": 3,
    "unlock_count": 3,
    "business_value": 2,
    "foundation_value": 2,
    "risk_penalty": 1,
    "size_penalty": 1,
    "failure_penalty": 1
  },
  "thresholds": {
    "auto_run_risk_max": 0.3,
    "approval_risk_min": 0.6,
    "memory_write_threshold": 0.65
  },
  "persona": {
    "risk_tolerance": 0.35,
    "quality_bias": 0.8,
    "speed_bias": 0.6,
    "autonomy_level": 0.6,
    "test_strictness": 0.8
  }
}
```

## Task Result

```json
{
  "task_id": "P0-T001",
  "run_id": "P0-T001-1710000000000",
  "status": "completed",
  "changed_files": [],
  "commands_run": ["codex exec", "npm test"],
  "verification_passed": true,
  "verification_results": [],
  "risks": [],
  "blockers": [],
  "prompt_path": ".codex-pm/prompts/P0-T001.md",
  "written_at": "2026-06-24T00:00:00.000Z",
  "execution": {
    "success": true,
    "exit_code": 0,
    "duration_ms": 1200,
    "stdout": "",
    "stderr": ""
  },
  "reward": 0,
  "penalty": 0
}
```

## Task Run Entry

Each line in `.codex-pm/task-runs.jsonl` is one task run entry. The `run_id`
links the audit entry to `.codex-pm/results/<run_id>.json`.

```json
{
  "task_id": "P0-T001",
  "run_id": "P0-T001-1710000000000",
  "started_at": "2026-06-24T00:00:00.000Z",
  "completed_at": "2026-06-24T00:00:01.200Z",
  "status": "completed",
  "success": true,
  "result_path": ".codex-pm/results/P0-T001-1710000000000.json",
  "prompt_path": ".codex-pm/prompts/P0-T001.md",
  "verification_results": [],
  "verification_passed": true,
  "retry_count": 0,
  "risk_incident": false,
  "duration_ms": 1200,
  "exit_code": 0,
  "reward": 0,
  "penalty": 0
}
```

## Energy State

Stored in `.codex-pm/energy.json`.

```json
{
  "balance": 450,
  "lastUpdatedAt": "2026-06-26T10:30:00.000Z",
  "totalEarned": 1200,
  "totalSpent": 750
}
```

Fields:
- `balance`: Current energy balance (0 to maxEnergy)
- `lastUpdatedAt`: ISO timestamp of last energy change
- `totalEarned`: Total energy earned (initial + refunds + manual refills)
- `totalSpent`: Total energy spent on tasks
