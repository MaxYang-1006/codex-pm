import { describe, it } from "node:test";
import assert from "node:assert";
import { LoopRunner } from "../src/core/loop-runner.js";

describe("Loop Runner", () => {
  describe("constructor", () => {
    it("should use default values", () => {
      const runner = new LoopRunner();
      assert.ok(runner);
    });

    it("should accept custom options", () => {
      const runner = new LoopRunner({
        maxTasks: 10,
        maxConsecutiveFailures: 3,
        energyBudget: 1000,
        stopOnHighRisk: false,
        dryRun: true,
      });
      assert.ok(runner);
    });
  });

  describe("formatReport", () => {
    it("should format empty report correctly", () => {
      const runner = new LoopRunner();
      const report = {
        success: false,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalEnergyUsed: 0,
        stopReason: "no_runnable_tasks" as const,
        taskResults: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
      };

      const formatted = runner.formatReport(report);
      assert.ok(formatted.includes("Codex PM Run Loop"));
      assert.ok(formatted.includes("No more runnable tasks"));
    });

    it("should format report with task results", () => {
      const runner = new LoopRunner();
      const report = {
        success: true,
        totalTasks: 3,
        completedTasks: 3,
        failedTasks: 0,
        totalEnergyUsed: 120,
        stopReason: "max_tasks_reached" as const,
        taskResults: [
          { taskId: "P0-T001", success: true, duration: 1000, energyCost: 40 },
          { taskId: "P0-T002", success: true, duration: 2000, energyCost: 40 },
          { taskId: "P0-T003", success: true, duration: 1500, energyCost: 40 },
        ],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 4500,
      };

      const formatted = runner.formatReport(report);
      assert.ok(formatted.includes("Total Tasks Run: 3"));
      assert.ok(formatted.includes("Completed: 3"));
      assert.ok(formatted.includes("Failed: 0"));
      assert.ok(formatted.includes("Success Rate: 100%"));
      assert.ok(formatted.includes("Maximum tasks reached"));
    });

    it("should format report with failures", () => {
      const runner = new LoopRunner();
      const report = {
        success: false,
        totalTasks: 2,
        completedTasks: 1,
        failedTasks: 1,
        totalEnergyUsed: 80,
        stopReason: "repeated_failure_stopped" as const,
        taskResults: [
          { taskId: "P0-T001", success: true, duration: 1000, energyCost: 40 },
          {
            taskId: "P0-T002",
            success: false,
            duration: 500,
            energyCost: 40,
            error: "Test failed",
          },
        ],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 1500,
      };

      const formatted = runner.formatReport(report);
      assert.ok(formatted.includes("Completed: 1"));
      assert.ok(formatted.includes("Failed: 1"));
      assert.ok(formatted.includes("Success Rate: 50%"));
      assert.ok(formatted.includes("Stopped due to repeated failures"));
    });
  });

  describe("stop reasons", () => {
    it("should handle all stop reasons in formatReport", () => {
      const runner = new LoopRunner();
      const reasons = [
        "max_tasks_reached",
        "no_runnable_tasks",
        "high_risk_stopped",
        "repeated_failure_stopped",
        "energy_budget_exceeded",
        "user_stopped",
      ] as const;

      for (const reason of reasons) {
        const report = {
          success: false,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalEnergyUsed: 0,
          stopReason: reason,
          taskResults: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: 0,
        };

        const formatted = runner.formatReport(report);
        assert.ok(formatted.length > 0, `Should format report with reason: ${reason}`);
      }
    });
  });
});
