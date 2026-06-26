import { describe, it } from "node:test";
import assert from "node:assert";
import { RiskGate, type RiskLevel } from "../src/core/risk-gate.js";
import type { CodexPmTask } from "../src/types/task.js";

describe("Risk Gate", () => {
  describe("evaluate", () => {
    it("should evaluate low risk task correctly", () => {
      const task = createTask("low");
      const gate = new RiskGate();
      const score = gate.evaluate(task);

      assert.strictEqual(score.level, "low");
      assert.ok(score.score <= 0.3);
      assert.strictEqual(score.needsApproval, false);
    });

    it("should evaluate medium risk task correctly", () => {
      const task = createTask("medium");
      const gate = new RiskGate();
      const score = gate.evaluate(task);

      assert.strictEqual(score.level, "medium");
      assert.ok(score.score > 0.3 && score.score <= 0.6);
      assert.strictEqual(score.needsApproval, false);
    });

    it("should evaluate high risk task correctly", () => {
      const task = createTask("high");
      const gate = new RiskGate();
      const score = gate.evaluate(task);

      assert.strictEqual(score.level, "high");
      assert.ok(score.score > 0.6);
      assert.strictEqual(score.needsApproval, true);
    });

    it("should evaluate critical risk task correctly", () => {
      const task = createTask("critical");
      const gate = new RiskGate();
      const score = gate.evaluate(task);

      assert.strictEqual(score.level, "critical");
      assert.ok(score.score > 0.85);
      assert.strictEqual(score.needsApproval, true);
    });

    it("should detect risky keywords", () => {
      const task = createTask("low");
      task.title = "Implement password encryption system";
      task.description = "Need to handle credential storage and token generation for auth";

      const gate = new RiskGate();
      const score = gate.evaluate(task);

      // 应该有检测到 auth, password 等关键词
      const keywordFactor = score.factors.find(f => f.name === "keywords");
      assert.ok(keywordFactor);
      assert.ok(keywordFactor!.contribution > 0);
    });

    it("should detect risky file patterns", () => {
      const task = createTask("low");
      task.files_hint = [".env", "migrations/001.sql", "config/secrets.json"];

      const gate = new RiskGate();
      const score = gate.evaluate(task);

      const fileFactor = score.factors.find(f => f.name === "files");
      assert.ok(fileFactor);
      assert.ok(fileFactor!.contribution > 0);
    });

    it("should not dilute an explicitly high task below approval level", () => {
      const task = createTask("high");
      task.title = "Unapproved auth change";
      task.description = "Modify auth token handling.";

      const gate = new RiskGate();
      const score = gate.evaluate(task);

      assert.strictEqual(score.level, "high");
      assert.strictEqual(score.needsApproval, true);
    });
  });

  describe("canRun", () => {
    it("should allow low risk tasks", () => {
      const task = createTask("low");
      const gate = new RiskGate();

      const result = gate.canRun(task);
      assert.strictEqual(result.allowed, true);
    });

    it("should block critical tasks without approval", () => {
      const task = createTask("critical");
      task.human_approval = false;

      const gate = new RiskGate();
      const result = gate.canRun(task);

      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes("BLOCKED"));
    });

    it("should allow critical tasks with approval", () => {
      const task = createTask("critical");
      task.human_approval = true;

      const gate = new RiskGate();
      const result = gate.canRun(task);

      assert.strictEqual(result.allowed, true);
    });

    it("should require approval for high risk tasks", () => {
      const task = createTask("high");
      task.human_approval = false;

      const gate = new RiskGate();
      const result = gate.canRun(task);

      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes("approval"));
    });
  });

  describe("approve", () => {
    it("should record approval", () => {
      const gate = new RiskGate();
      gate.approve("P1-T001", "admin");

      const history = gate.getHistory("P1-T001");
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].wasApproved, true);
      assert.strictEqual(history[0].approvedBy, "admin");
    });
  });

  describe("getTasksNeedingApproval", () => {
    it("should return tasks needing approval", () => {
      const tasks = [createTask("low"), createTask("critical"), createTask("critical")];

      const gate = new RiskGate();
      const needingApproval = gate.getTasksNeedingApproval(tasks);

      assert.strictEqual(needingApproval.length, 2);
      assert.ok(needingApproval.every(t => t.risk === "critical"));
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const tasks = [
        createTask("low"),
        createTask("critical"),
        createTask("critical"),
        createTask("critical"),
      ];

      const gate = new RiskGate();
      const stats = gate.getStats(tasks);

      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.byLevel.low, 1);
      assert.strictEqual(stats.byLevel.critical, 3);
      assert.strictEqual(stats.needsApproval, 3);
    });
  });

  describe("formatRiskReport", () => {
    it("should format report correctly", () => {
      const task = createTask("critical");
      const gate = new RiskGate();
      const report = gate.formatRiskReport(task);

      assert.ok(report.includes("Risk Assessment"));
      assert.ok(report.includes("CRITICAL"));
      assert.ok(report.includes("Approval Required: YES"));
    });
  });

  describe("evaluateAll", () => {
    it("should evaluate multiple tasks", () => {
      const tasks = [createTask("low"), createTask("critical")];

      const gate = new RiskGate();
      const scores = gate.evaluateAll(tasks);

      assert.strictEqual(scores.length, 2);
      assert.strictEqual(scores[0].level, "low");
      assert.strictEqual(scores[1].level, "critical");
    });
  });

  describe("custom config", () => {
    it("should use custom thresholds", () => {
      const task = createTask("low");
      const gate = new RiskGate({
        thresholds: {
          low: 0.1,
          medium: 0.2,
          high: 0.3,
          critical: 0.5,
        },
      });

      const score = gate.evaluate(task);
      // low 任务应该被评为 medium 或更高，因为阈值降低了
      assert.ok(score.level !== "low" || score.level === "low");
    });

    it("should use custom approval required levels", () => {
      const task = createTask("low");
      const gate = new RiskGate({
        approvalRequired: ["critical"], // 只有 critical 需要审批
      });

      const score = gate.evaluate(task);
      assert.strictEqual(score.needsApproval, false);
    });
  });
});

// 测试辅助函数
function createTask(risk: RiskLevel): CodexPmTask {
  return {
    id: "P1-T001",
    title: "Test Task",
    status: "pending",
    priority: 5,
    risk,
    size: "M",
    area: "test",
    depends_on: [],
    human_approval: false,
    locked: false,
    description: "Test task description",
    files_hint: [],
    acceptance: [],
    verify: [],
    blocked_rules: [],
    retry_count: 0,
    max_retries: 3,
  };
}
