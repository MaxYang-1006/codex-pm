import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import { ResultWriter, ExecutionResult } from "../src/core/result-writer.js";

describe("Result Writer", () => {
  const testBaseDir = ".codex-pm-test-result";
  let writer: ResultWriter;

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    writer = new ResultWriter({
      baseDir: testBaseDir,
      resultsDir: `${testBaseDir}/results`,
      auditLogPath: `${testBaseDir}/task-runs.jsonl`,
    });
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("writeTaskResult", () => {
    it("should write result to file", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "test output",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const filepath = writer.writeTaskResult("P0-T001", result);

      assert.ok(fs.existsSync(filepath));
      const content = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      assert.strictEqual(content.task_id, "P0-T001");
      assert.strictEqual(content.status, "completed");
      assert.strictEqual(content.execution.success, true);
      assert.strictEqual(content.execution.stdout, "test output");
      assert.ok(content.written_at);
    });

    it("should set needs_review status when needed", () => {
      const result: ExecutionResult = {
        success: false,
        stdout: "partial output",
        stderr: "error",
        exitCode: 1,
        duration: 250,
        error: "Test error",
        needsReview: true,
      };

      const filepath = writer.writeTaskResult("P0-T002", result);
      const content = JSON.parse(fs.readFileSync(filepath, "utf-8"));

      assert.strictEqual(content.status, "needs_review");
      assert.strictEqual(content.execution.error, "Test error");
    });

    it("should set failed status when execution fails", () => {
      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 100,
      };

      const filepath = writer.writeTaskResult("P0-T003", result);
      const content = JSON.parse(fs.readFileSync(filepath, "utf-8"));

      assert.strictEqual(content.status, "failed");
    });

    it("should include metadata in result", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      const metadata = {
        changedFiles: ["src/a.ts", "src/b.ts"],
        commandsRun: ["npm run build", "npm test"],
        risks: ["Potential breaking change"],
        blockers: [],
      };

      const filepath = writer.writeTaskResult("P0-T004", result, metadata);
      const content = JSON.parse(fs.readFileSync(filepath, "utf-8"));

      assert.deepStrictEqual(content.changed_files, ["src/a.ts", "src/b.ts"]);
      assert.deepStrictEqual(content.commands_run, ["npm run build", "npm test"]);
      assert.deepStrictEqual(content.risks, ["Potential breaking change"]);
    });
  });

  describe("appendAuditLog", () => {
    it("should append entry to audit log", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "output",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      writer.appendAuditLog("P0-T001", result, "run-123");

      assert.ok(fs.existsSync(`${testBaseDir}/task-runs.jsonl`));
      const content = fs.readFileSync(`${testBaseDir}/task-runs.jsonl`, "utf-8");
      const entry = JSON.parse(content.trim());

      assert.strictEqual(entry.task_id, "P0-T001");
      assert.strictEqual(entry.run_id, "run-123");
      assert.strictEqual(entry.status, "completed");
      assert.strictEqual(entry.success, true);
    });

    it("should append multiple entries", () => {
      const result1: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };
      const result2: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 100,
      };

      writer.appendAuditLog("P0-T001", result1);
      writer.appendAuditLog("P0-T002", result2);

      const content = fs.readFileSync(`${testBaseDir}/task-runs.jsonl`, "utf-8");
      const lines = content.trim().split("\n");

      assert.strictEqual(lines.length, 2);
      assert.strictEqual(JSON.parse(lines[0]).task_id, "P0-T001");
      assert.strictEqual(JSON.parse(lines[1]).task_id, "P0-T002");
    });
  });

  describe("updateTaskState", () => {
    it("should update task to done on success", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        status: "running" as const,
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        depends_on: [] as string[],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [] as string[],
        acceptance: [] as string[],
        verify: [] as string[],
        blocked_rules: [] as string[],
        retry_count: 1,
        max_retries: 3,
      };

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const mockManager = {
        updateTask: (id: string, updates: any) => {
          assert.strictEqual(id, "P0-T001");
          assert.strictEqual(updates.status, "done");
          assert.strictEqual(updates.retry_count, 0);
          return true;
        },
      };

      const updatedTask = writer.updateTaskState(task, result, mockManager);

      assert.strictEqual(updatedTask.status, "done");
      assert.strictEqual(updatedTask.retry_count, 0);
    });

    it("should update task to needs_review when needed", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        status: "running" as const,
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        depends_on: [] as string[],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [] as string[],
        acceptance: [] as string[],
        verify: [] as string[],
        blocked_rules: [] as string[],
        retry_count: 0,
        max_retries: 3,
      };

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        duration: 100,
        needsReview: true,
      };

      const mockManager = {
        updateTask: (id: string, updates: any) => {
          assert.strictEqual(updates.status, "needs_review");
          return true;
        },
      };

      const updatedTask = writer.updateTaskState(task, result, mockManager);

      assert.strictEqual(updatedTask.status, "needs_review");
    });

    it("should increment retry count on failure", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        status: "running" as const,
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        depends_on: [] as string[],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [] as string[],
        acceptance: [] as string[],
        verify: [] as string[],
        blocked_rules: [] as string[],
        retry_count: 1,
        max_retries: 3,
      };

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        duration: 100,
      };

      const mockManager = {
        updateTask: (id: string, updates: any) => {
          assert.strictEqual(updates.retry_count, 2);
          return true;
        },
      };

      const updatedTask = writer.updateTaskState(task, result, mockManager);

      assert.strictEqual(updatedTask.retry_count, 2);
      assert.strictEqual(updatedTask.status, "pending");
    });

    it("should mark as failed after max retries", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        status: "running" as const,
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        depends_on: [] as string[],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [] as string[],
        acceptance: [] as string[],
        verify: [] as string[],
        blocked_rules: [] as string[],
        retry_count: 2,
        max_retries: 3,
      };

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        duration: 100,
      };

      const mockManager = {
        updateTask: (id: string, updates: any) => {
          assert.strictEqual(updates.status, "failed");
          return true;
        },
      };

      const updatedTask = writer.updateTaskState(task, result, mockManager);

      assert.strictEqual(updatedTask.status, "failed");
    });
  });

  describe("readAuditLog", () => {
    it("should return empty array if no log exists", () => {
      const entries = writer.readAuditLog();
      assert.deepStrictEqual(entries, []);
    });

    it("should read all entries", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      writer.appendAuditLog("P0-T001", result);
      writer.appendAuditLog("P0-T002", result);

      const entries = writer.readAuditLog();
      assert.strictEqual(entries.length, 2);
    });

    it("should respect limit parameter", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      for (let i = 0; i < 5; i++) {
        writer.appendAuditLog(`P0-T00${i}`, result);
      }

      const entries = writer.readAuditLog(3);
      assert.strictEqual(entries.length, 3);
    });
  });

  describe("getTaskRuns", () => {
    it("should return runs for specific task", () => {
      const result1: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };
      const result2: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: 1,
        duration: 100,
      };

      writer.appendAuditLog("P0-T001", result1);
      writer.appendAuditLog("P0-T002", result2);
      writer.appendAuditLog("P0-T001", result2);

      const runs = writer.getTaskRuns("P0-T001");
      assert.strictEqual(runs.length, 2);
      assert.ok(runs.every(r => r.task_id === "P0-T001"));
    });
  });

  describe("formatExecutionResult", () => {
    it("should format success result", () => {
      const result: ExecutionResult = {
        success: true,
        stdout: "output",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const formatted = ResultWriter.formatExecutionResult(result);

      assert.ok(formatted.includes("SUCCESS"));
      assert.ok(formatted.includes("Exit Code: 0"));
      assert.ok(formatted.includes("Duration: 100ms"));
      assert.ok(formatted.includes("output"));
    });

    it("should format failure result with error", () => {
      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 50,
        error: "Test failed",
      };

      const formatted = ResultWriter.formatExecutionResult(result);

      assert.ok(formatted.includes("FAILED"));
      assert.ok(formatted.includes("Test failed"));
      assert.ok(formatted.includes("error"));
    });
  });
});
