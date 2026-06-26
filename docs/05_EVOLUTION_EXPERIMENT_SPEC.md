# 05 — Evolution Experiment Spec

## Research goal

Test whether a non-LLM small-brain agent can improve project delivery performance by adapting strategy through memory and feedback while using Codex as its LLM brain.

## Definition of evolution

In this project, evolution means:

> Agent behavior strategy changes based on historical feedback, and the changed strategy improves measurable fitness.

It does not mean consciousness or uncontrolled self-modification.

## Evolution targets

Allowed to adapt:

- task scoring weights,
- risk threshold within approved ranges,
- memory recall weights,
- prompt template preference,
- retry strategy within limits,
- task splitting bias,
- energy allocation.

Not allowed to adapt automatically:

- sandbox safety,
- approval gates,
- auth/payment/secret safety rules,
- database destructive migration rules,
- production deployment rules,
- audit log retention,
- plugin source code.

## Episode

One episode equals one task execution attempt.

Episode record:

```json
{
  "episode_id": "E000001",
  "timestamp": "2026-06-24T00:00:00Z",
  "task_id": "P1-T003",
  "genome_id": "balanced-v1",
  "selected_task_score": 72.4,
  "risk_score": 0.32,
  "energy_cost": 12,
  "codex_status": "completed",
  "verify_passed": true,
  "retry_count": 0,
  "changed_files": 4,
  "diff_lines": 180,
  "reward": 9,
  "penalty": 1,
  "fitness_delta": 0.04
}
```

## Fitness formula v0.1

```text
fitness =
  completion_rate * 0.25
+ verification_pass_rate * 0.25
+ one_shot_success_rate * 0.15
+ unlock_efficiency * 0.15
+ cost_efficiency * 0.10
- risk_incident_rate * 0.10
```

## Genome profiles

### Balanced PM

Default baseline.

### Conservative PM

Low risk, high verification, slow but safe.

### Startup PM

Fast MVP delivery, accepts controlled technical debt.

### Research PM

Allows experiments, records hypotheses and lessons.

## Experiment commands

```bash
codex-pm evolve --episodes 20 --profile balanced
codex-pm fitness
codex-pm genome list
codex-pm genome compare
```

## Success condition

The experiment succeeds if over enough episodes:

1. strategy parameters change,
2. changes are caused by recorded feedback,
3. measured fitness improves,
4. risk incidents do not increase beyond threshold.
