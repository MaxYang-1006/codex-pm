import { describe, it } from "node:test";
import assert from "node:assert";
import { TaskParser } from "../src/core/task-parser.js";
import { TaskNormalizer } from "../src/core/task-normalizer.js";
import * as fs from "fs";

describe("Task Parser", () => {
  describe("parse", () => {
    it("should parse TASKS.md content", () => {
      const content = fs.readFileSync("./docs/11_TASKS.md", "utf-8");
      const parser = new TaskParser(content);
      const result = parser.parse();

      assert.ok(result.tasks.length > 0, "Should parse at least one task");
      assert.ok(Array.isArray(result.errors), "Errors should be an array");
      assert.ok(Array.isArray(result.warnings), "Warnings should be an array");
    });

    it("should parse task fields correctly", () => {
      const content = `### P0-T001: Test Task

Status: pending
Priority: 10
Risk: low
Size: S
Area: foundation
Depends on: none
Human approval: no
Locked: no

Description:
A test task

Files hint:
- file1.ts
- file2.ts

Acceptance:
- Acceptance criteria

Verify:
- npm test

Blocked rules:
- No blocking`;

      const parser = new TaskParser(content);
      const result = parser.parse();

      assert.strictEqual(result.tasks.length, 1);
      const task = result.tasks[0];
      assert.strictEqual(task.id, "P0-T001");
      assert.strictEqual(task.title, "Test Task");
      assert.strictEqual(task.status, "pending");
      assert.strictEqual(task.priority, 10);
      assert.strictEqual(task.risk, "low");
      assert.strictEqual(task.size, "S");
      assert.strictEqual(task.area, "foundation");
      assert.deepStrictEqual(task.depends_on, []);
      assert.strictEqual(task.human_approval, false);
      assert.strictEqual(task.locked, false);
      assert.strictEqual(task.description, "A test task");
      assert.deepStrictEqual(task.files_hint, ["file1.ts", "file2.ts"]);
      assert.deepStrictEqual(task.acceptance, ["Acceptance criteria"]);
      assert.deepStrictEqual(task.verify, ["npm test"]);
      assert.deepStrictEqual(task.blocked_rules, ["No blocking"]);
    });

    it("should handle 'Depends on: none'", () => {
      const content = `### P0-T001: Task

Status: pending
Priority: 10
Risk: low
Size: S
Area: foundation
Depends on: none
Human approval: no
Locked: no`;

      const parser = new TaskParser(content);
      const result = parser.parse();

      assert.strictEqual(result.tasks.length, 1);
      assert.deepStrictEqual(result.tasks[0].depends_on, []);
    });

    it("should handle multiple dependencies", () => {
      const content = `### P0-T002: Task

Status: pending
Priority: 9
Risk: low
Size: S
Area: plugin
Depends on: P0-T001, P0-T003
Human approval: no
Locked: no`;

      const parser = new TaskParser(content);
      const result = parser.parse();

      assert.strictEqual(result.tasks.length, 1);
      assert.deepStrictEqual(result.tasks[0].depends_on, ["P0-T001", "P0-T003"]);
    });

    it("should reject malformed tasks", () => {
      const content = `### P0-T001: Invalid Task

Status: invalid-status
Priority: not-a-number
Risk: invalid-risk
Size: XXL
Area: test`;

      const parser = new TaskParser(content);
      const result = parser.parse();

      assert.ok(result.errors.length > 0, "Should have parsing errors");
    });
  });
});

describe("Task Normalizer", () => {
  describe("normalize", () => {
    it("should normalize tasks", () => {
      const tasks = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending" as const,
          priority: 10,
          risk: "low" as const,
          size: "S" as const,
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T002",
          title: "Task 2",
          status: "pending" as const,
          priority: 9,
          risk: "low" as const,
          size: "S" as const,
          area: "plugin",
          depends_on: ["P0-T001"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const normalizer = new TaskNormalizer();
      const result = normalizer.normalize(tasks);

      assert.strictEqual(result.tasks.length, 2);
      assert.ok(Array.isArray(result.dependencyErrors));
      assert.ok(Array.isArray(result.warnings));
    });

    it("should detect missing dependencies", () => {
      const tasks = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending" as const,
          priority: 10,
          risk: "low" as const,
          size: "S" as const,
          area: "foundation",
          depends_on: ["P0-T999"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const normalizer = new TaskNormalizer();
      const result = normalizer.normalize(tasks);

      assert.ok(result.dependencyErrors.length > 0);
    });

    it("should sort tasks by dependency", () => {
      const tasks = [
        {
          id: "P0-T002",
          title: "Task 2",
          status: "pending" as const,
          priority: 9,
          risk: "low" as const,
          size: "S" as const,
          area: "plugin",
          depends_on: ["P0-T001"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending" as const,
          priority: 10,
          risk: "low" as const,
          size: "S" as const,
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const normalizer = new TaskNormalizer();
      const result = normalizer.normalize(tasks);

      assert.strictEqual(result.tasks[0].id, "P0-T001");
      assert.strictEqual(result.tasks[1].id, "P0-T002");
    });
  });
});
