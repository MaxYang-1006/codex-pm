# Testing Guide

## Test Types

### Unit Tests

Test individual modules:
- Task parser
- Task graph
- Risk gate
- Energy estimator
- Task scorer
- Prompt builder
- Memory write score
- Reward evaluator

### Integration Tests

Test command workflows:
- Scan sample project
- Select next task
- Dry-run prompt generation
- Result write

### Safety Tests

Ensure risk gates work correctly:
- Auth task requires approval
- Payment task requires approval
- Secret file task requires approval
- Destructive migration task requires approval
- Mass deletion task requires approval

## Acceptance Principles

**Do not fake completion.**

A task is not done merely because Codex says it is done.

A task is done only when:
1. Required files are changed within task scope
2. Verification commands pass or are explicitly unavailable for this phase
3. The result schema is saved
4. Task state is updated
5. Audit logs are written

If verification commands are missing, the task may be marked `needs_review`, not automatically `done`, unless the task explicitly allows no verification.

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- task-parser.test.ts
```

## CI/CD Integration

All tests run automatically on CI. A PR must pass all tests before merging.
