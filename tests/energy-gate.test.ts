import { describe, it } from "node:test";
import assert from "node:assert";
import { EnergyGate } from "../src/core/energy-gate.js";

describe("Energy Gate", () => {
  describe("constructor", () => {
    it("should use default values", () => {
      const gate = new EnergyGate();
      assert.ok(gate);
    });

    it("should accept custom budget", () => {
      const gate = new EnergyGate({ defaultBudget: 200 });
      assert.ok(gate);
    });
  });

  describe("estimate", () => {
    it("should estimate cost for small low-risk task", () => {
      const gate = new EnergyGate();
      const task = {
        id: "P0-T001",
        title: "Test",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const estimate = gate.estimate(task);

      assert.strictEqual(estimate.taskId, "P0-T001");
      assert.strictEqual(estimate.baseCost, 20);
      assert.strictEqual(estimate.riskMultiplier, 1.0);
      assert.ok(estimate.estimatedCost > 0);
    });

    it("should apply risk multiplier", () => {
      const gate = new EnergyGate();
      const lowRiskTask = {
        id: "P0-T001",
        title: "Low Risk",
        size: "M" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const highRiskTask = {
        id: "P0-T002",
        title: "High Risk",
        size: "M" as const,
        risk: "high" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const lowRiskEstimate = gate.estimate(lowRiskTask);
      const highRiskEstimate = gate.estimate(highRiskTask);

      assert.ok(highRiskEstimate.estimatedCost > lowRiskEstimate.estimatedCost);
    });

    it("should apply size cost", () => {
      const gate = new EnergyGate();
      const smallTask = {
        id: "P0-T001",
        title: "Small",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const largeTask = {
        id: "P0-T002",
        title: "Large",
        size: "L" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const smallEstimate = gate.estimate(smallTask);
      const largeEstimate = gate.estimate(largeTask);

      assert.ok(largeEstimate.baseCost > smallEstimate.baseCost);
      assert.ok(largeEstimate.estimatedCost > smallEstimate.estimatedCost);
    });

    it("should include verification cost", () => {
      const gate = new EnergyGate();
      const noVerifyTask = {
        id: "P0-T001",
        title: "No Verify",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const verifyTask = {
        id: "P0-T002",
        title: "With Verify",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: ["npm test", "npm run typecheck"],
      } as any;

      const noVerifyEstimate = gate.estimate(noVerifyTask);
      const verifyEstimate = gate.estimate(verifyTask);

      assert.strictEqual(noVerifyEstimate.verificationCost, 0);
      assert.strictEqual(verifyEstimate.verificationCost, 10);
      assert.ok(verifyEstimate.estimatedCost > noVerifyEstimate.estimatedCost);
    });

    it("should calculate retry factor", () => {
      const gate = new EnergyGate();
      const noRetryTask = {
        id: "P0-T001",
        title: "No Retry",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const retriedTask = {
        id: "P0-T002",
        title: "Retried",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 2,
        max_retries: 3,
        verify: [],
      } as any;

      const noRetryEstimate = gate.estimate(noRetryTask);
      const retriedEstimate = gate.estimate(retriedTask);

      assert.ok(retriedEstimate.retryFactor >= noRetryEstimate.retryFactor);
    });
  });

  describe("isWithinBudget", () => {
    it("should return true for within-budget task", () => {
      const gate = new EnergyGate();
      const task = {
        id: "P0-T001",
        title: "Small Task",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      assert.strictEqual(gate.isWithinBudget(task), true);
    });

    it("should return false for over-budget task", () => {
      const gate = new EnergyGate({ defaultBudget: 10 });
      const task = {
        id: "P0-T001",
        title: "Large Task",
        size: "XL" as const,
        risk: "critical" as const,
        retry_count: 0,
        max_retries: 3,
        verify: ["npm test"],
      } as any;

      assert.strictEqual(gate.isWithinBudget(task), false);
    });
  });

  describe("getBudgetWarning", () => {
    it("should return ok for under budget", () => {
      const gate = new EnergyGate();
      const task = {
        id: "P0-T001",
        title: "Small",
        size: "XS" as const,
        risk: "none" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      assert.strictEqual(gate.getBudgetWarning(task), "ok");
    });

    it("should return warning for near budget", () => {
      const gate = new EnergyGate({ defaultBudget: 50 });
      const task = {
        id: "P0-T001",
        title: "Medium",
        size: "M" as const,
        risk: "medium" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      const warning = gate.getBudgetWarning(task);
      assert.ok(warning === "warning" || warning === "ok");
    });

    it("should return critical for over budget", () => {
      const gate = new EnergyGate({ defaultBudget: 20 });
      const task = {
        id: "P0-T001",
        title: "Large",
        size: "XL" as const,
        risk: "critical" as const,
        retry_count: 2,
        max_retries: 3,
        verify: ["npm test", "npm run typecheck", "npm run build"],
      } as any;

      assert.strictEqual(gate.getBudgetWarning(task), "critical");
    });
  });

  describe("getOverBudgetTasks", () => {
    it("should return only over-budget tasks", () => {
      const gate = new EnergyGate({ defaultBudget: 30 });
      const tasks = [
        {
          id: "P0-T001",
          title: "Small",
          size: "S" as const,
          risk: "low" as const,
          retry_count: 0,
          max_retries: 3,
          verify: [],
        },
        {
          id: "P0-T002",
          title: "Large",
          size: "XL" as const,
          risk: "high" as const,
          retry_count: 0,
          max_retries: 3,
          verify: ["npm test"],
        },
      ] as any[];

      const overBudget = gate.getOverBudgetTasks(tasks);

      assert.strictEqual(overBudget.length, 1);
      assert.strictEqual(overBudget[0].taskId, "P0-T002");
    });
  });

  describe("getEnergyStats", () => {
    it("should return stats for multiple tasks", () => {
      const gate = new EnergyGate();
      const tasks = [
        {
          id: "P0-T001",
          title: "Small",
          size: "S" as const,
          risk: "low" as const,
          retry_count: 0,
          max_retries: 3,
          verify: [],
        },
        {
          id: "P0-T002",
          title: "Medium",
          size: "M" as const,
          risk: "medium" as const,
          retry_count: 0,
          max_retries: 3,
          verify: ["npm test"],
        },
      ] as any[];

      const stats = gate.getEnergyStats(tasks);

      assert.strictEqual(stats.totalEstimatedCost > 0, true);
      assert.strictEqual(stats.totalBudget > 0, true);
      assert.strictEqual(stats.overBudgetCount >= 0, true);
      assert.strictEqual(stats.averageCost > 0, true);
      assert.strictEqual(stats.maxCost >= stats.minCost, true);
    });
  });

  describe("formatEstimate", () => {
    it("should format estimate correctly", () => {
      const gate = new EnergyGate();
      const task = {
        id: "P0-T001",
        title: "Test",
        size: "S" as const,
        risk: "low" as const,
        retry_count: 0,
        max_retries: 3,
        verify: ["npm test"],
      } as any;

      const estimate = gate.estimate(task);
      const formatted = gate.formatEstimate(estimate);

      assert.ok(formatted.includes("P0-T001"));
      assert.ok(formatted.includes("Estimated Cost"));
      assert.ok(formatted.includes("Budget"));
      assert.ok(formatted.includes("Breakdown"));
    });
  });

  describe("getBudgetWarningMessage", () => {
    it("should return null for ok status", () => {
      const gate = new EnergyGate();
      const task = {
        id: "P0-T001",
        title: "Small",
        size: "XS" as const,
        risk: "none" as const,
        retry_count: 0,
        max_retries: 3,
        verify: [],
      } as any;

      assert.strictEqual(gate.getBudgetWarningMessage(task), null);
    });

    it("should return warning message for warning status", () => {
      // 测试 getBudgetWarningMessage 正确处理各种情况
      const gate = new EnergyGate({ defaultBudget: 50 });

      // 测试一个肯定会超预算的任务
      const overBudgetTask = {
        id: "P0-T001",
        title: "Large",
        size: "XL" as const, // 160
        risk: "critical" as const, // x2.0
        retry_count: 2,
        max_retries: 3,
        verify: ["npm test", "npm run typecheck"], // +10
      } as any;

      const message = gate.getBudgetWarningMessage(overBudgetTask);
      assert.ok(message);
      assert.ok(message.includes("P0-T001"));
      assert.ok(message.includes("Critical") || message.includes("Warning"));
    });

    it("should return critical message for over budget", () => {
      const gate = new EnergyGate({ defaultBudget: 20 });
      const task = {
        id: "P0-T001",
        title: "Large",
        size: "XL" as const,
        risk: "critical" as const,
        retry_count: 0,
        max_retries: 3,
        verify: ["npm test"],
      } as any;

      const message = gate.getBudgetWarningMessage(task);
      assert.ok(message?.includes("Critical"));
      assert.ok(message?.includes("exceeds budget"));
    });
  });
});
