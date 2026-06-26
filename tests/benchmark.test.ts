import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import { TaskParser } from "../src/core/task-parser.js";
import { TaskScorer } from "../src/core/task-scorer.js";
import { TaskGraph } from "../src/core/task-graph.js";
import { StateManager } from "../src/core/state-manager.js";
import { Verifier } from "../src/core/verifier.js";
import type { CodexPmTask } from "../src/types/task.js";

function generateBenchmarkTasks(count: number): CodexPmTask[] {
  const tasks: CodexPmTask[] = [];
  for (let i = 0; i < count; i++) {
    const dependsOn: string[] = [];
    if (i > 0) {
      const maxDeps = Math.min(3, i);
      const numDeps = Math.floor(Math.random() * maxDeps);
      for (let j = 0; j < numDeps; j++) {
        dependsOn.push(`TASK-${i - 1 - j}`);
      }
    }
    tasks.push({
      id: `TASK-${i}`,
      title: `Benchmark Task ${i}`,
      status: i < count * 0.3 ? "done" : "pending",
      priority: Math.floor(Math.random() * 10) + 1,
      risk: (["low", "medium", "high", "critical"] as const)[Math.floor(Math.random() * 4)],
      size: (["XS", "S", "M", "L", "XL"] as const)[Math.floor(Math.random() * 5)],
      area: "benchmark",
      depends_on: dependsOn,
      human_approval: false,
      locked: false,
      description: `This is task ${i}`,
      files_hint: [`file${i}.ts`],
      acceptance: [`Acceptance ${i}`],
      verify: [`npm test`],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 2,
    });
  }
  return tasks;
}

describe("Performance Benchmarks", () => {
  describe("TaskParser", () => {
    it("should parse 100 tasks quickly", () => {
      const taskContent = generateBenchmarkTasks(100)
        .map(
          t => `### ${t.id}: ${t.title}
Status: ${t.status}
Priority: ${t.priority}
Risk: ${t.risk}
Size: ${t.size}
Area: ${t.area}
Depends on: ${t.depends_on.join(", ") || "none"}
Human approval: ${t.human_approval ? "yes" : "no"}
Locked: ${t.locked ? "yes" : "no"}
Description: ${t.description}
Files hint:
- ${t.files_hint[0]}
Acceptance:
- ${t.acceptance[0]}
Verify:
- ${t.verify[0]}
`
        )
        .join("\n");

      const startTime = Date.now();
      const parser = new TaskParser(taskContent);
      const result = parser.parse();
      const duration = Date.now() - startTime;

      assert.strictEqual(result.tasks.length, 100);
      assert.ok(duration < 500, `Parsing 100 tasks took ${duration}ms, expected < 500ms`);
    });
  });

  describe("TaskGraph", () => {
    it("should build graph with 100 tasks quickly", () => {
      const tasks = generateBenchmarkTasks(100);
      const startTime = Date.now();
      const graph = new TaskGraph();
      graph.buildFromTasks(tasks);
      const duration = Date.now() - startTime;

      assert.strictEqual(graph.getStats().totalTasks, 100);
      assert.ok(
        duration < 1000,
        `Building graph with 100 tasks took ${duration}ms, expected < 1000ms`
      );
    });

    it("should detect circular dependencies quickly", () => {
      const tasks = generateBenchmarkTasks(50);
      const circularTask: CodexPmTask = {
        ...tasks[0],
        id: "CIRCULAR-A",
        depends_on: ["CIRCULAR-B"],
      };
      const circularTaskB: CodexPmTask = {
        ...tasks[1],
        id: "CIRCULAR-B",
        depends_on: ["CIRCULAR-A"],
      };
      tasks.push(circularTask, circularTaskB);

      const startTime = Date.now();
      const graph = new TaskGraph();
      graph.buildFromTasks(tasks);
      const hasCycle = graph.hasCircularDependencies();
      const duration = Date.now() - startTime;

      assert.ok(hasCycle);
      assert.ok(duration < 500, `Cycle detection took ${duration}ms, expected < 500ms`);
    });
  });

  describe("TaskScorer", () => {
    it("should score 100 tasks quickly", () => {
      const tasks = generateBenchmarkTasks(100);
      const startTime = Date.now();
      const scorer = new TaskScorer();
      const runnable = scorer.getRunnableTasks(tasks);
      const scores = tasks.map(t => scorer.scoreTask(t, tasks));
      const duration = Date.now() - startTime;

      assert.ok(runnable.length >= 0);
      assert.strictEqual(scores.length, 100);
      assert.ok(duration < 300, `Scoring 100 tasks took ${duration}ms, expected < 300ms`);
    });
  });

  describe("StateManager", () => {
    it("should save and load state quickly", () => {
      const manager = new StateManager(".codex-pm-benchmark");
      const tasks = generateBenchmarkTasks(50);

      const startTime = Date.now();
      manager.load();
      manager.setTasks(tasks);
      manager.save();
      manager.load();
      const loadedTasks = manager.getTasks();
      const duration = Date.now() - startTime;

      assert.strictEqual(loadedTasks.length, 50);
      assert.ok(duration < 500, `Save/load cycle took ${duration}ms, expected < 500ms`);

      if (fs.existsSync(".codex-pm-benchmark")) {
        fs.rmSync(".codex-pm-benchmark", { recursive: true, force: true });
      }
    });
  });

  describe("Verifier", () => {
    it("should execute simple command quickly", async () => {
      const verifier = new Verifier({ timeout: 5000 });
      const startTime = Date.now();
      const result = await verifier.verifyCommand("echo 'benchmark'");
      const duration = Date.now() - startTime;

      assert.ok(result.success);
      assert.ok(duration < 3000, `Command execution took ${duration}ms, expected < 3000ms`);
    });
  });
});
