import { describe, it } from "node:test";
import assert from "node:assert";
import { TaskGraph } from "../src/core/task-graph.js";
import type { CodexPmTask } from "../src/types/task.js";

describe("Task Graph", () => {
  describe("constructor", () => {
    it("should create empty graph", () => {
      const graph = new TaskGraph();
      assert.strictEqual(graph.getAllTasks().length, 0);
    });

    it("should build from tasks", () => {
      const tasks = createTestTasks();
      const graph = new TaskGraph(tasks);
      assert.strictEqual(graph.getAllTasks().length, tasks.length);
    });
  });

  describe("buildFromTasks", () => {
    it("should build correct dependency structure", () => {
      const tasks = createTestTasks();
      const graph = new TaskGraph(tasks);

      const node = graph.getNode("P0-T001");
      assert.ok(node);
      assert.deepStrictEqual(node!.dependencies, []);
    });

    it("should calculate depths correctly", () => {
      const tasks = createTestTasks();
      const graph = new TaskGraph(tasks);

      // P0-T001 没有依赖，深度应为 0
      assert.strictEqual(graph.getDepth("P0-T001"), 0);

      // P1-T001 依赖 P0-T001，深度应为 1
      assert.strictEqual(graph.getDepth("P1-T001"), 1);

      // P2-T001 依赖 P1-T001，深度应为 2
      assert.strictEqual(graph.getDepth("P2-T001"), 2);
    });
  });

  describe("getRunnableTasks", () => {
    it("should return only pending tasks with completed dependencies", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
        createTask("P2-T001", "pending", ["P1-T001"]),
      ];

      // P0-T001 完成
      tasks[0].status = "done";

      const graph = new TaskGraph(tasks);
      const runnable = graph.getRunnableTasks();

      assert.strictEqual(runnable.length, 1);
      assert.strictEqual(runnable[0].id, "P1-T001");
    });

    it("should exclude locked tasks", () => {
      const tasks: CodexPmTask[] = [createTask("P0-T001", "pending", [])];
      tasks[0].locked = true;

      const graph = new TaskGraph(tasks);
      const runnable = graph.getRunnableTasks();

      assert.strictEqual(runnable.length, 0);
    });

    it("should return empty when no tasks are pending", () => {
      const tasks: CodexPmTask[] = [createTask("P0-T001", "done", [])];

      const graph = new TaskGraph(tasks);
      const runnable = graph.getRunnableTasks();

      assert.strictEqual(runnable.length, 0);
    });

    it("should exclude tasks with incomplete dependencies", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      const runnable = graph.getRunnableTasks();

      // P0-T001 未完成，P1-T001 不可运行（返回空，因为 P0-T001 也是 pending）
      // 但 P0-T001 没有依赖，应该可运行
      assert.strictEqual(runnable.length, 1);
      assert.strictEqual(runnable[0].id, "P0-T001");
    });
  });

  describe("getDependencyInfo", () => {
    it("should return correct dependency info", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "done", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      const info = graph.getDependencyInfo("P1-T001");

      assert.strictEqual(info.taskId, "P1-T001");
      assert.deepStrictEqual(info.dependencies, ["P0-T001"]);
      assert.strictEqual(info.isReady, true);
    });

    it("should detect missing dependencies", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      const info = graph.getDependencyInfo("P1-T001");

      assert.strictEqual(info.isReady, false);
      assert.deepStrictEqual(info.missingDependencies, ["P0-T001"]);
    });
  });

  describe("hasCircularDependencies", () => {
    it("should return false for acyclic graph", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "done", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
        createTask("P2-T001", "pending", ["P1-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      assert.strictEqual(graph.hasCircularDependencies(), false);
    });

    it("should return true for cyclic graph", () => {
      // A -> B -> C -> A (循环)
      const tasks: CodexPmTask[] = [
        createTask("A", "pending", ["C"]),
        createTask("B", "pending", ["A"]),
        createTask("C", "pending", ["B"]),
      ];

      const graph = new TaskGraph(tasks);
      assert.strictEqual(graph.hasCircularDependencies(), true);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P0-T002", "done", []),
        createTask("P0-T003", "failed", []),
      ];

      const graph = new TaskGraph(tasks);
      const stats = graph.getStats();

      assert.strictEqual(stats.totalTasks, 3);
      assert.strictEqual(stats.pendingTasks, 1);
      assert.strictEqual(stats.completedTasks, 1);
      assert.strictEqual(stats.failedTasks, 1);
    });
  });

  describe("getBlockedTasks", () => {
    it("should return tasks with incomplete dependencies", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      const blocked = graph.getBlockedTasks();

      assert.strictEqual(blocked.length, 1);
      assert.strictEqual(blocked[0].id, "P1-T001");
    });
  });

  describe("formatDependencyTree", () => {
    it("should format tree correctly", () => {
      const tasks: CodexPmTask[] = [
        createTask("P0-T001", "pending", []),
        createTask("P1-T001", "pending", ["P0-T001"]),
      ];

      const graph = new TaskGraph(tasks);
      const tree = graph.formatDependencyTree();

      assert.ok(tree.includes("Task Dependency Tree"));
      assert.ok(tree.includes("P0-T001"));
      assert.ok(tree.includes("P1-T001"));
    });
  });
});

// 测试辅助函数
function createTask(id: string, status: string, dependsOn: string[]): CodexPmTask {
  return {
    id,
    title: `Task ${id}`,
    status: status as CodexPmTask["status"],
    priority: 5,
    risk: "low",
    size: "M",
    area: "test",
    depends_on: dependsOn,
    human_approval: false,
    locked: false,
    description: "",
    files_hint: [],
    acceptance: [],
    verify: [],
    blocked_rules: [],
    retry_count: 0,
    max_retries: 3,
  };
}

function createTestTasks(): CodexPmTask[] {
  return [
    {
      id: "P0-T001",
      title: "Setup project",
      status: "pending",
      priority: 10,
      risk: "low",
      size: "S",
      area: "setup",
      depends_on: [],
      human_approval: false,
      locked: false,
      description: "Initial project setup",
      files_hint: [],
      acceptance: [],
      verify: [],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 3,
    },
    {
      id: "P1-T001",
      title: "Implement core",
      status: "pending",
      priority: 8,
      risk: "medium",
      size: "M",
      area: "core",
      depends_on: ["P0-T001"],
      human_approval: false,
      locked: false,
      description: "Core functionality",
      files_hint: [],
      acceptance: [],
      verify: [],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 3,
    },
    {
      id: "P2-T001",
      title: "Add tests",
      status: "pending",
      priority: 6,
      risk: "low",
      size: "M",
      area: "test",
      depends_on: ["P1-T001"],
      human_approval: false,
      locked: false,
      description: "Add unit tests",
      files_hint: [],
      acceptance: [],
      verify: [],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 3,
    },
  ];
}
