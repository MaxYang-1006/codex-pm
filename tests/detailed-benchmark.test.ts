/**
 * 详细性能测试套件
 * 测试项目核心模块的性能表现
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { TaskParser } from "../src/core/task-parser.js";
import { TaskScorer } from "../src/core/task-scorer.js";
import { TaskGraph } from "../src/core/task-graph.js";
import { StateManager } from "../src/core/state-manager.js";
import { Verifier } from "../src/core/verifier.js";
import { RiskGate } from "../src/core/risk-gate.js";
import { EnergyGate } from "../src/core/energy-gate.js";
import { PromptBuilder } from "../src/core/prompt-builder.js";
import type { CodexPmTask } from "../src/types/task.js";

// 性能指标记录器
interface PerformanceMetrics {
  name: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  memoryUsedKb: number;
  throughput: number;
}

const metrics: PerformanceMetrics[] = [];
const tempDir = path.join(os.tmpdir(), `codex-pm-perf-${Date.now()}`);

// 生成不同规模的任务数据
function generateTasks(count: number, doneRatio = 0.3): CodexPmTask[] {
  const tasks: CodexPmTask[] = [];
  const areas = ["core", "docs", "api", "ui", "test", "infra", "security", "perf"];
  const risks = ["low", "medium", "high", "critical"] as const;
  const sizes = ["XS", "S", "M", "L", "XL"] as const;

  for (let i = 0; i < count; i++) {
    const dependsOn: string[] = [];
    if (i > 0 && Math.random() < 0.3) {
      const numDeps = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numDeps && i - 1 - j >= 0; j++) {
        dependsOn.push(`P${Math.floor((i - 1 - j) / 10)}-T${String(i - 1 - j).padStart(3, "0")}`);
      }
    }

    tasks.push({
      id: `P${Math.floor(i / 10)}-T${String(i % 100).padStart(3, "0")}`,
      title: `Task ${i}: ${areas[i % areas.length]} module implementation`,
      status: i < count * doneRatio ? "done" : "pending",
      priority: Math.floor(Math.random() * 10) + 1,
      risk: risks[Math.floor(Math.random() * risks.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)],
      area: areas[i % areas.length],
      depends_on: dependsOn,
      human_approval: Math.random() < 0.1,
      locked: Math.random() < 0.05,
      description: `Implement ${areas[i % areas.length]} module with feature set ${i}.`,
      files_hint: [`src/${areas[i % areas.length]}/index.ts`],
      acceptance: [`Module compiles`, `Unit tests pass`],
      verify: [`npm run build`],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 2,
    });
  }
  return tasks;
}

// 性能测试工具函数
function measurePerformance<T>(name: string, fn: () => T, iterations = 100): PerformanceMetrics {
  const times: number[] = [];
  const memoryBefore = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    times.push(duration);
  }

  const memoryAfter = process.memoryUsage().heapUsed;
  times.sort((a, b) => a - b);

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;

  const m: PerformanceMetrics = {
    name,
    iterations,
    avgMs: Math.round(avgMs * 100) / 100,
    minMs: Math.round(times[0] * 100) / 100,
    maxMs: Math.round(times[times.length - 1] * 100) / 100,
    p50Ms: Math.round(times[Math.floor(times.length * 0.5)] * 100) / 100,
    p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
    p99Ms: Math.round(times[Math.floor(times.length * 0.99)] * 100) / 100,
    memoryUsedKb: Math.round((memoryAfter - memoryBefore) / 1024),
    throughput: Math.round((1000 / avgMs) * 100) / 100,
  };

  metrics.push(m);
  return m;
}

// 打印性能报告
function printMetricsReport(allMetrics: PerformanceMetrics[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("📊 详细性能测试报告");
  console.log("=".repeat(80));
  console.log(`\n测试时间: ${new Date().toISOString()}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`平台: ${os.platform()} ${os.arch()}`);
  console.log(`CPU: ${os.cpus()[0]?.model || "Unknown"}`);
  console.log(`总内存: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
  console.log("\n" + "-".repeat(80));

  console.log("\n模块 | 迭代 | 平均 | 最小 | 最大 | P50 | P95 | P99 | 内存 | 吞吐量");
  console.log("-".repeat(80));

  for (const m of allMetrics) {
    console.log(
      `${m.name.padEnd(15)} | ` +
        `${String(m.iterations).padStart(4)} | ` +
        `${String(m.avgMs).padStart(6)}ms | ` +
        `${String(m.minMs).padStart(5)}ms | ` +
        `${String(m.maxMs).padStart(5)}ms | ` +
        `${String(m.p50Ms).padStart(5)}ms | ` +
        `${String(m.p95Ms).padStart(5)}ms | ` +
        `${String(m.p99Ms).padStart(5)}ms | ` +
        `${String(m.memoryUsedKb).padStart(5)}KB | ` +
        `${String(m.throughput).padStart(6)}/s`
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("📈 性能评估");
  console.log("=".repeat(80));

  for (const m of allMetrics) {
    const rating =
      m.avgMs < 10 ? "🟢 优秀" : m.avgMs < 50 ? "🟡 良好" : m.avgMs < 200 ? "🟠 一般" : "🔴 需优化";
    console.log(`\n${m.name}: ${rating}`);
    console.log(`  - 平均响应: ${m.avgMs}ms`);
    console.log(`  - 抖动范围: ${m.minMs}ms ~ ${m.maxMs}ms`);
    console.log(`  - 95分位: ${m.p95Ms}ms`);
    console.log(`  - 吞吐量: ${m.throughput} ops/s`);
  }
}

// ========== 测试套件 ==========

describe("详细性能测试套件", { timeout: 120000 }, () => {
  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    printMetricsReport(metrics);
  });

  // ========== TaskParser 性能测试 ==========
  describe("TaskParser", () => {
    it("解析 50 个任务", () => {
      const tasks = generateTasks(50);
      const content = tasks
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
${t.files_hint.map(f => `- ${f}`).join("\n")}
Acceptance:
${t.acceptance.map(a => `- ${a}`).join("\n")}
Verify:
${t.verify.map(v => `- ${v}`).join("\n")}
`
        )
        .join("\n");

      measurePerformance(
        "TaskParser-50",
        () => {
          const parser = new TaskParser(content);
          return parser.parse();
        },
        50
      );
    });

    it("解析 200 个任务", () => {
      const tasks = generateTasks(200);
      const content = tasks
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
`
        )
        .join("\n");

      const result = measurePerformance(
        "TaskParser-200",
        () => {
          const parser = new TaskParser(content);
          return parser.parse();
        },
        20
      );

      assert.ok(result.avgMs < 500, `解析 200 个任务应在 500ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("解析 500 个任务", () => {
      const tasks = generateTasks(500);
      const content = tasks
        .map(
          t => `### ${t.id}: ${t.title}
Status: ${t.status}
Priority: ${t.priority}
Risk: ${t.risk}
Size: ${t.size}
Area: ${t.area}
Depends on: none
Human approval: no
Locked: no
Description: ${t.description}
`
        )
        .join("\n");

      const result = measurePerformance(
        "TaskParser-500",
        () => {
          const parser = new TaskParser(content);
          return parser.parse();
        },
        10
      );

      assert.ok(result.avgMs < 2000, `解析 500 个任务应在 2000ms 内完成，实际: ${result.avgMs}ms`);
    });
  });

  // ========== TaskGraph 性能测试 ==========
  describe("TaskGraph", () => {
    it("构建 100 任务的依赖图", () => {
      const tasks = generateTasks(100, 0.3);

      const result = measurePerformance(
        "TaskGraph-100",
        () => {
          const graph = new TaskGraph();
          graph.buildFromTasks(tasks);
          return graph;
        },
        50
      );

      assert.ok(result.avgMs < 500, `构建 100 任务图应在 500ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("构建 500 任务的依赖图", () => {
      const tasks = generateTasks(500, 0.3);

      const result = measurePerformance(
        "TaskGraph-500",
        () => {
          const graph = new TaskGraph();
          graph.buildFromTasks(tasks);
          return graph;
        },
        10
      );

      assert.ok(result.avgMs < 2000, `构建 500 任务图应在 2000ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("检测 100 任务的循环依赖", () => {
      const tasks = generateTasks(100, 0.3);
      // 创建一个循环依赖
      tasks[50].depends_on = ["P4-T099"];
      tasks[99].depends_on = ["P5-T050"];

      measurePerformance(
        "CycleDetect-100",
        () => {
          const graph = new TaskGraph();
          graph.buildFromTasks(tasks);
          return graph.hasCircularDependencies();
        },
        20
      );
    });

    it("获取可运行任务", () => {
      const tasks = generateTasks(200, 0.3);

      measurePerformance(
        "RunnableTasks-200",
        () => {
          const graph = new TaskGraph();
          graph.buildFromTasks(tasks);
          return graph.getRunnableTasks();
        },
        50
      );
    });
  });

  // ========== TaskScorer 性能测试 ==========
  describe("TaskScorer", () => {
    it("为 100 个任务打分", () => {
      const tasks = generateTasks(100, 0.3);

      const result = measurePerformance(
        "TaskScorer-100",
        () => {
          const scorer = new TaskScorer();
          const scores = scorer.scoreAllTasks(tasks);
          return scores;
        },
        50
      );

      assert.ok(result.avgMs < 200, `为 100 任务打分应在 200ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("为 500 个任务打分", () => {
      const tasks = generateTasks(500, 0.3);

      const result = measurePerformance(
        "TaskScorer-500",
        () => {
          const scorer = new TaskScorer();
          const scores = scorer.scoreAllTasks(tasks);
          return scores;
        },
        10
      );

      assert.ok(result.avgMs < 1000, `为 500 任务打分应在 1000ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("获取排序后的任务列表", () => {
      const tasks = generateTasks(100, 0.3);

      measurePerformance(
        "SortedTasks-100",
        () => {
          const scorer = new TaskScorer();
          const scores = scorer.scoreAllTasks(tasks);
          return scores.sort((a, b) => b.score - a.score);
        },
        50
      );
    });
  });

  // ========== RiskGate 性能测试 ==========
  describe("RiskGate", () => {
    it("评估 100 个任务的风险", () => {
      const tasks = generateTasks(100, 0.3);

      const result = measurePerformance(
        "RiskGate-100",
        () => {
          const gate = new RiskGate();
          return gate.evaluateAll(tasks);
        },
        50
      );

      assert.ok(result.avgMs < 100, `评估 100 任务风险应在 100ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("评估高风险任务", () => {
      const highRiskTasks: CodexPmTask[] = [
        {
          id: "P1-T001",
          title: "Implement user authentication",
          description: "Need to handle password storage and JWT token generation",
          status: "pending",
          priority: 8,
          risk: "high",
          size: "L",
          area: "auth",
          depends_on: [],
          human_approval: false,
          locked: false,
          files_hint: [".env", "config/secrets.json"],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P1-T002",
          title: "Database migration",
          description: "Run destructive database migration to drop old tables",
          status: "pending",
          priority: 9,
          risk: "critical",
          size: "XL",
          area: "database",
          depends_on: [],
          human_approval: true,
          locked: false,
          files_hint: ["migrations/001.sql"],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      measurePerformance(
        "HighRiskEval",
        () => {
          const gate = new RiskGate();
          return gate.evaluateAll(highRiskTasks);
        },
        100
      );
    });
  });

  // ========== EnergyGate 性能测试 ==========
  describe("EnergyGate", () => {
    it("评估 100 个任务的能量消耗", () => {
      const tasks = generateTasks(100, 0.3);

      const result = measurePerformance(
        "EnergyGate-100",
        () => {
          const gate = new EnergyGate();
          return gate.estimateAll(tasks);
        },
        50
      );

      assert.ok(result.avgMs < 50, `评估 100 任务能量应在 50ms 内完成，实际: ${result.avgMs}ms`);
    });

    it("检查能量预算", () => {
      const tasks = generateTasks(50, 0.3);

      measurePerformance(
        "EnergyBudget-50",
        () => {
          const gate = new EnergyGate({ defaultBudget: 500 });
          return gate.getOverBudgetTasks(tasks);
        },
        50
      );
    });
  });

  // ========== StateManager 性能测试 ==========
  describe("StateManager", () => {
    it("保存/加载 50 个任务", () => {
      const stateDir = path.join(tempDir, "state-50");
      fs.mkdirSync(stateDir, { recursive: true });
      const manager = new StateManager(stateDir);
      const tasks = generateTasks(50, 0.3);

      const result = measurePerformance(
        "StateManager-50",
        () => {
          manager.setTasks(tasks);
          manager.save();
          manager.load();
          return manager.getTasks();
        },
        20
      );

      assert.ok(result.avgMs < 500, `StateManager 操作应在 500ms 内完成，实际: ${result.avgMs}ms`);
      // heapUsed 是两次采样差值，GC 释放内存时可能为负；这里验证指标可用而不是强制增长。
      assert.ok(Number.isFinite(result.memoryUsedKb), "memoryUsedKb should be a finite number");
    });

    it("保存/加载 200 个任务", () => {
      const stateDir = path.join(tempDir, "state-200");
      fs.mkdirSync(stateDir, { recursive: true });
      const manager = new StateManager(stateDir);
      const tasks = generateTasks(200, 0.3);

      const result = measurePerformance(
        "StateManager-200",
        () => {
          manager.setTasks(tasks);
          manager.save();
          manager.load();
          return manager.getTasks();
        },
        10
      );

      assert.ok(
        result.avgMs < 1000,
        `StateManager 操作应在 1000ms 内完成，实际: ${result.avgMs}ms`
      );
    });
  });

  // ========== Verifier 性能测试 ==========
  describe("Verifier", () => {
    it("执行简单命令", async () => {
      const verifier = new Verifier({ timeout: 5000 });

      const result = await new Promise<PerformanceMetrics>(resolve => {
        const times: number[] = [];
        const iterations = 20;

        const run = async () => {
          for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await verifier.verifyCommand("echo 'test'");
            times.push(performance.now() - start);
          }

          times.sort((a, b) => a - b);
          const avgMs = times.reduce((a, b) => a + b, 0) / times.length;

          const m: PerformanceMetrics = {
            name: "Verifier-cmd",
            iterations,
            avgMs: Math.round(avgMs * 100) / 100,
            minMs: Math.round(times[0] * 100) / 100,
            maxMs: Math.round(times[times.length - 1] * 100) / 100,
            p50Ms: Math.round(times[Math.floor(times.length * 0.5)] * 100) / 100,
            p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
            p99Ms: Math.round(times[Math.floor(times.length * 0.99)] * 100) / 100,
            memoryUsedKb: 0,
            throughput: Math.round((1000 / avgMs) * 100) / 100,
          };

          metrics.push(m);
          resolve(m);
        };

        run();
      });

      assert.ok(result.avgMs < 1000, `命令执行应在 1000ms 内完成，实际: ${result.avgMs}ms`);
    });
  });

  // ========== PromptBuilder 性能测试 ==========
  describe("PromptBuilder", () => {
    it("构建单个任务 prompt", () => {
      const tasks = generateTasks(1, 0);
      const task = tasks[0];

      measurePerformance(
        "PromptBuilder-1",
        () => {
          const builder = new PromptBuilder();
          return builder.buildPrompt({
            task,
            docs: [],
            memory: [],
          });
        },
        100
      );
    });

    it("构建 50 个任务的 prompts", () => {
      const tasks = generateTasks(50, 0.3);

      const result = measurePerformance(
        "PromptBuilder-50",
        () => {
          const builder = new PromptBuilder();
          return tasks.map(t =>
            builder.buildPrompt({
              task: t,
              docs: [],
              memory: [],
            })
          );
        },
        10
      );

      assert.ok(result.avgMs < 1000, `构建 50 prompts 应在 1000ms 内完成，实际: ${result.avgMs}ms`);
    });
  });

  // ========== 内存压力测试 ==========
  describe("内存压力测试", () => {
    it("大规模任务处理内存使用", () => {
      const memBefore = process.memoryUsage().heapUsed;

      // 处理 1000 个任务
      const tasks = generateTasks(1000, 0.3);
      const graph = new TaskGraph();
      const scorer = new TaskScorer();

      graph.buildFromTasks(tasks);
      scorer.scoreAllTasks(tasks);

      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100;

      console.log(`\n处理 1000 个任务的内存使用: ${memUsed} MB`);

      assert.ok(memUsed < 100, `内存使用应在 100MB 以内，实际: ${memUsed}MB`);
    });
  });

  // ========== 并发测试 ==========
  describe("并发性能测试", () => {
    it("模拟并发任务评估", async () => {
      const tasks = generateTasks(100, 0.3);
      const concurrency = 10;

      const start = performance.now();

      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const scorer = new TaskScorer();
          const gate = new RiskGate();
          return Promise.all(
            tasks
              .slice(0, 10)
              .map(t =>
                Promise.all([
                  Promise.resolve(scorer.scoreTask(t, tasks)),
                  Promise.resolve(gate.evaluate(t)),
                ])
              )
          );
        })
      );

      const duration = Math.round(performance.now() - start);

      console.log(`\n${concurrency} 并发批次，每批 10 任务: ${duration}ms`);
      assert.ok(duration < 5000, `并发处理应在 5000ms 内完成，实际: ${duration}ms`);
    });
  });
});
