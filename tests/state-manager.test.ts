import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";

import { StateManager } from "../src/core/state-manager.js";

describe("State Manager", () => {
  beforeEach(() => {
    if (fs.existsSync(".codex-pm-test")) {
      fs.rmSync(".codex-pm-test", { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(".codex-pm-test")) {
      fs.rmSync(".codex-pm-test", { recursive: true, force: true });
    }
  });

  describe("load and save", () => {
    it("should initialize with empty state", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const state = manager.getState();
      assert.ok(state);
      assert.strictEqual(state.version, "0.1.0");
      assert.ok(state.project_id);
      assert.ok(state.created_at);
      assert.ok(state.updated_at);
      assert.deepStrictEqual(state.tasks, []);
    });

    it("should save and load state", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const state = manager.getState();
      state.project_id = "test-project";
      manager.save();

      const manager2 = new StateManager(".codex-pm-test");
      manager2.load();

      assert.strictEqual(manager2.getState().project_id, "test-project");
    });
  });

  describe("tasks", () => {
    it("should add and retrieve tasks", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const tasks = [
        {
          id: "P0-T001",
          title: "Test Task",
          status: "pending" as const,
          priority: 10,
          risk: "low" as const,
          size: "S" as const,
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "Test",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      manager.setTasks(tasks);
      assert.strictEqual(manager.getTasks().length, 1);
      assert.strictEqual(manager.getTasks()[0].id, "P0-T001");
    });

    it("should get task by id", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

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

      manager.setTasks(tasks);

      const task = manager.getTaskById("P0-T002");
      assert.ok(task);
      assert.strictEqual(task?.id, "P0-T002");
      assert.strictEqual(task?.title, "Task 2");
    });

    it("should update task", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const tasks = [
        {
          id: "P0-T001",
          title: "Task",
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

      manager.setTasks(tasks);
      const success = manager.updateTask("P0-T001", { status: "done", priority: 5 });

      assert.ok(success);
      const updatedTask = manager.getTaskById("P0-T001");
      assert.strictEqual(updatedTask?.status, "done");
      assert.strictEqual(updatedTask?.priority, 5);
    });

    it("should return false when updating non-existent task", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const success = manager.updateTask("P0-T999", { status: "done" });
      assert.strictEqual(success, false);
    });
  });

  describe("doc index", () => {
    it("should set and get doc index", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const entries = [
        {
          filename: "TASKS.md",
          path: "./docs/TASKS.md",
          hash: "abc123",
          size: 1000,
          last_modified: new Date().toISOString(),
        },
      ];

      manager.setDocIndex(entries);
      assert.strictEqual(manager.getDocIndex().length, 1);
      assert.strictEqual(manager.getDocIndex()[0].filename, "TASKS.md");
    });

    it("should get doc by filename", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const entries = [
        {
          filename: "TASKS.md",
          path: "./docs/TASKS.md",
          hash: "abc123",
          size: 1000,
          last_modified: new Date().toISOString(),
        },
      ];

      manager.setDocIndex(entries);

      const doc = manager.getDocByFilename("TASKS.md");
      assert.ok(doc);
      assert.strictEqual(doc?.filename, "TASKS.md");
    });
  });

  describe("task runs", () => {
    it("should add task run", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const runId = manager.addTaskRun("P0-T001");
      assert.ok(runId);
      assert.ok(runId.startsWith("P0-T001"));

      const runs = manager.getTaskRuns("P0-T001");
      assert.strictEqual(runs.length, 1);
      assert.strictEqual(runs[0].run_id, runId);
      assert.strictEqual(runs[0].status, "running");
    });

    it("should update task run", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();

      const runId = manager.addTaskRun("P0-T001");
      const success = manager.updateTaskRun(runId, {
        status: "completed",
        completed_at: new Date().toISOString(),
      });

      assert.ok(success);
      const run = manager.getTaskRuns("P0-T001")[0];
      assert.strictEqual(run.status, "completed");
      assert.ok(run.completed_at);
    });
  });

  describe("isInitialized", () => {
    it("should return false when state file does not exist", () => {
      const manager = new StateManager(".codex-pm-test");
      assert.strictEqual(manager.isInitialized(), false);
    });

    it("should return true after saving", () => {
      const manager = new StateManager(".codex-pm-test");
      manager.load();
      manager.save();

      assert.strictEqual(manager.isInitialized(), true);
    });
  });
});
