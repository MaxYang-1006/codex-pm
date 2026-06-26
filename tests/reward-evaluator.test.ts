import { describe, it } from "node:test";
import assert from "node:assert";
import { RewardEvaluator } from "../src/core/reward-evaluator.js";
import { ExecutionResult } from "../src/core/result-writer.js";

describe("Reward Evaluator", () => {
  describe("evaluate", () => {
    it("should reward verification pass", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: ["npm test"],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "All tests passed",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result);

      assert.strictEqual(reward.baseReward, 100);
      assert.strictEqual(reward.verificationBonus, 50);
      assert.strictEqual(reward.oneShotBonus, 30);
      assert.strictEqual(reward.totalReward, 180);
    });

    it("should reward one-shot success", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result);

      assert.strictEqual(reward.oneShotBonus, 30);
    });

    it("should not give one-shot bonus for retried tasks", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 2,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result);

      assert.strictEqual(reward.oneShotBonus, 0);
    });

    it("should reward unlock count", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result, 3);

      assert.strictEqual(reward.unlockBonus, 30);
      assert.strictEqual(reward.totalReward, 210); // base(100) + verification(50) + oneShot(30) + unlock(30)
    });

    it("should penalize failure", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "Error",
        exitCode: 1,
        duration: 100,
        error: "Failed",
      };

      const reward = evaluator.evaluate(task, result);

      assert.strictEqual(reward.failurePenalty, -100);
      assert.strictEqual(reward.totalReward, -100);
    });

    it("should penalize retry", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 3,
        max_retries: 5,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "Error",
        exitCode: 1,
        duration: 100,
        error: "Failed",
      };

      const reward = evaluator.evaluate(task, result);

      assert.strictEqual(reward.retryPenalty, -60);
      assert.strictEqual(reward.totalReward, -160);
    });

    it("should penalize scope creep", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result, 0, true);

      assert.strictEqual(reward.scopeCreepPenalty, -30);
      assert.strictEqual(reward.totalReward, 150); // base(100) + verification(50) + oneShot(30) - scopeCreep(30)
    });

    it("should penalize risk incident", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "high" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result, 0, false, true);

      assert.strictEqual(reward.riskIncidentPenalty, -50);
      assert.strictEqual(reward.totalReward, 130); // base(100) + verification(50) + oneShot(30) - riskIncident(50)
    });

    it("should combine all factors", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "medium" as const,
        size: "M" as const,
        area: "core",
        retry_count: 1,
        max_retries: 3,
        acceptance: [],
        verify: ["npm test"],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "Tests passed",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluate(task, result, 2, false, false);

      assert.strictEqual(reward.baseReward, 100);
      assert.strictEqual(reward.verificationBonus, 50);
      assert.strictEqual(reward.oneShotBonus, 0); // retry_count > 0
      assert.strictEqual(reward.unlockBonus, 20);
      assert.strictEqual(reward.totalReward, 170);
    });
  });

  describe("formatBreakdown", () => {
    it("should format breakdown correctly", () => {
      const evaluator = new RewardEvaluator();
      const breakdown = {
        baseReward: 100,
        verificationBonus: 50,
        oneShotBonus: 30,
        unlockBonus: 20,
        failurePenalty: 0,
        retryPenalty: 0,
        scopeCreepPenalty: 0,
        riskIncidentPenalty: 0,
        totalReward: 200,
      };

      const formatted = evaluator.formatBreakdown(breakdown);

      assert.ok(formatted.includes("Reward Breakdown"));
      assert.ok(formatted.includes("+100 Base Reward"));
      assert.ok(formatted.includes("+50 Verification Bonus"));
      assert.ok(formatted.includes("Total Reward: 200"));
    });

    it("should format negative breakdown", () => {
      const evaluator = new RewardEvaluator();
      const breakdown = {
        baseReward: 0,
        verificationBonus: 0,
        oneShotBonus: 0,
        unlockBonus: 0,
        failurePenalty: -100,
        retryPenalty: -40,
        scopeCreepPenalty: -30,
        riskIncidentPenalty: -50,
        totalReward: -220,
      };

      const formatted = evaluator.formatBreakdown(breakdown);

      assert.ok(formatted.includes("-100 Failure Penalty"));
      assert.ok(formatted.includes("-40 Retry Penalty"));
      assert.ok(formatted.includes("Total Reward: -220"));
    });
  });

  describe("getRewardLevel", () => {
    it("should return excellent for high reward", () => {
      const evaluator = new RewardEvaluator();
      assert.strictEqual(evaluator.getRewardLevel(200), "excellent");
      assert.strictEqual(evaluator.getRewardLevel(150), "excellent");
    });

    it("should return good for medium reward", () => {
      const evaluator = new RewardEvaluator();
      assert.strictEqual(evaluator.getRewardLevel(120), "good");
      assert.strictEqual(evaluator.getRewardLevel(100), "good");
    });

    it("should return neutral for low positive reward", () => {
      const evaluator = new RewardEvaluator();
      assert.strictEqual(evaluator.getRewardLevel(75), "neutral");
      assert.strictEqual(evaluator.getRewardLevel(50), "neutral");
    });

    it("should return poor for very low reward", () => {
      const evaluator = new RewardEvaluator();
      assert.strictEqual(evaluator.getRewardLevel(25), "poor");
      assert.strictEqual(evaluator.getRewardLevel(1), "poor");
    });

    it("should return failed for negative reward", () => {
      const evaluator = new RewardEvaluator();
      assert.strictEqual(evaluator.getRewardLevel(-50), "failed");
      assert.strictEqual(evaluator.getRewardLevel(-100), "failed");
      assert.strictEqual(evaluator.getRewardLevel(0), "failed");
    });
  });

  describe("getRewardMessage", () => {
    it("should return appropriate messages", () => {
      const evaluator = new RewardEvaluator();

      assert.ok(evaluator.getRewardMessage(200).includes("Outstanding"));
      assert.ok(evaluator.getRewardMessage(120).includes("Good job"));
      assert.ok(evaluator.getRewardMessage(75).includes("Neutral"));
      assert.ok(evaluator.getRewardMessage(25).includes("Poor"));
      assert.ok(evaluator.getRewardMessage(-50).includes("failed"));
    });
  });

  describe("calculateEfficiency", () => {
    it("should calculate efficiency", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const efficiency = evaluator.calculateEfficiency(task, result);

      assert.ok(efficiency > 0);
    });
  });

  describe("evaluateWithDefaults", () => {
    it("should use default values", () => {
      const evaluator = new RewardEvaluator();
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const reward = evaluator.evaluateWithDefaults(task, result);

      // base(100) + verification(50) - 没有验证命令时默认通过 + oneShot(30)
      assert.strictEqual(reward.totalReward, 180);
    });
  });
});
