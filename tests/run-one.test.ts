import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";

import { runRunOne } from "../src/commands/run-one.js";
import { StateManager } from "../src/core/state-manager.js";
import type { CodexPmTask } from "../src/types/task.js";

describe("Run-One safety", () => {
  const testBaseDir = ".codex-pm-test-run-one";

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it("uses RiskGate semantics so an approved high-risk task can still dry-run", async () => {
    const task = createTask({
      risk: "high",
      human_approval: true,
      title: "Approved database migration",
      description: "Create a migration after manual review.",
      files_hint: ["migrations/001.sql"],
    });
    initializeState(testBaseDir, [task]);

    const result = await runRunOne({
      taskId: task.id,
      dryRun: true,
      baseDir: testBaseDir,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.task?.id, task.id);
    assert.ok(result.promptPath?.startsWith(path.join(testBaseDir, "prompts")));
  });

  it("blocks high-risk tasks without human approval before prompt execution", async () => {
    const task = createTask({
      risk: "high",
      human_approval: false,
      title: "Unapproved auth change",
      description: "Modify auth token handling.",
      files_hint: ["src/auth/token.ts"],
    });
    initializeState(testBaseDir, [task]);

    const result = await runRunOne({
      taskId: task.id,
      dryRun: true,
      baseDir: testBaseDir,
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes("Risk gate blocked"));
    assert.ok(result.message.includes("approval"));
    assert.strictEqual(fs.existsSync(path.join(testBaseDir, "prompts", `${task.id}.md`)), false);
  });
});

function initializeState(baseDir: string, tasks: CodexPmTask[]): void {
  const manager = new StateManager(baseDir);
  manager.load();
  manager.setTasks(tasks);
  manager.setDocIndex([
    {
      filename: "TASKS.md",
      path: "docs/TASKS.md",
      hash: "test",
      size: 1,
      last_modified: new Date().toISOString(),
    },
  ]);
  manager.save();
}

function createTask(overrides: Partial<CodexPmTask> = {}): CodexPmTask {
  return {
    id: "P4-T999",
    title: "Test task",
    status: "pending",
    priority: 10,
    risk: "low",
    size: "M",
    area: "security",
    depends_on: [],
    human_approval: false,
    locked: false,
    description: "Test task",
    files_hint: [],
    acceptance: [],
    verify: [],
    blocked_rules: [],
    retry_count: 0,
    max_retries: 3,
    ...overrides,
  };
}
