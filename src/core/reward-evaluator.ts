import type { CodexPmTask } from "../types/task.js";
import type { ExecutionResult } from "./result-writer.js";

export interface RewardBreakdown {
  baseReward: number;
  verificationBonus: number;
  oneShotBonus: number;
  unlockBonus: number;
  failurePenalty: number;
  retryPenalty: number;
  scopeCreepPenalty: number;
  riskIncidentPenalty: number;
  totalReward: number;
}

export interface RewardOptions {
  baseReward?: number;
  verificationBonus?: number;
  oneShotBonus?: number;
  unlockBonusMultiplier?: number;
  failurePenalty?: number;
  retryPenalty?: number;
  scopeCreepPenalty?: number;
  riskIncidentPenalty?: number;
}

export class RewardEvaluator {
  private baseReward: number;
  private verificationBonus: number;
  private oneShotBonus: number;
  private unlockBonusMultiplier: number;
  private failurePenalty: number;
  private retryPenalty: number;
  private scopeCreepPenalty: number;
  private riskIncidentPenalty: number;

  constructor(options: RewardOptions = {}) {
    this.baseReward = options.baseReward ?? 100;
    this.verificationBonus = options.verificationBonus ?? 50;
    this.oneShotBonus = options.oneShotBonus ?? 30;
    this.unlockBonusMultiplier = options.unlockBonusMultiplier ?? 10;
    this.failurePenalty = options.failurePenalty ?? -100;
    this.retryPenalty = options.retryPenalty ?? -20;
    this.scopeCreepPenalty = options.scopeCreepPenalty ?? -30;
    this.riskIncidentPenalty = options.riskIncidentPenalty ?? -50;
  }

  evaluate(
    task: CodexPmTask,
    executionResult: ExecutionResult,
    unlockCount: number = 0,
    scopeChanged: boolean = false,
    riskIncident: boolean = false
  ): RewardBreakdown {
    const breakdown: RewardBreakdown = {
      baseReward: 0,
      verificationBonus: 0,
      oneShotBonus: 0,
      unlockBonus: 0,
      failurePenalty: 0,
      retryPenalty: 0,
      scopeCreepPenalty: 0,
      riskIncidentPenalty: 0,
      totalReward: 0,
    };

    if (executionResult.success) {
      breakdown.baseReward = this.baseReward;

      // 验证通过奖励
      if (this.hasVerificationPassed(task, executionResult)) {
        breakdown.verificationBonus = this.verificationBonus;
      }

      // 一次性成功奖励（首次尝试成功）
      if (task.retry_count === 0) {
        breakdown.oneShotBonus = this.oneShotBonus;
      }

      // 解锁任务奖励
      breakdown.unlockBonus = unlockCount * this.unlockBonusMultiplier;
    } else {
      // 失败惩罚
      breakdown.failurePenalty = this.failurePenalty;

      // 重试惩罚
      if (task.retry_count > 0) {
        breakdown.retryPenalty = this.retryPenalty * task.retry_count;
      }
    }

    // 范围蔓延惩罚
    if (scopeChanged) {
      breakdown.scopeCreepPenalty = this.scopeCreepPenalty;
    }

    // 风险事件惩罚
    if (riskIncident) {
      breakdown.riskIncidentPenalty = this.riskIncidentPenalty;
    }

    // 计算总奖励
    breakdown.totalReward = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return breakdown;
  }

  evaluateWithDefaults(task: CodexPmTask, executionResult: ExecutionResult): RewardBreakdown {
    return this.evaluate(task, executionResult, 0, false, false);
  }

  private hasVerificationPassed(task: CodexPmTask, executionResult: ExecutionResult): boolean {
    // 如果没有验证命令，默认认为验证通过
    if (task.verify.length === 0) {
      return true;
    }

    // 如果执行成功且没有错误输出，认为验证通过
    if (executionResult.success && !executionResult.stderr) {
      return true;
    }

    // 如果有成功的验证结果（需要更复杂的验证逻辑）
    // 这里简化处理：执行成功即认为验证通过
    return executionResult.success;
  }

  formatBreakdown(breakdown: RewardBreakdown): string {
    const lines: string[] = [];

    lines.push("=== Reward Breakdown ===");
    lines.push("");

    const positiveItems: { label: string; value: number }[] = [];
    const negativeItems: { label: string; value: number }[] = [];

    if (breakdown.baseReward !== 0) {
      positiveItems.push({ label: "Base Reward", value: breakdown.baseReward });
    }
    if (breakdown.verificationBonus !== 0) {
      positiveItems.push({ label: "Verification Bonus", value: breakdown.verificationBonus });
    }
    if (breakdown.oneShotBonus !== 0) {
      positiveItems.push({ label: "One-Shot Bonus", value: breakdown.oneShotBonus });
    }
    if (breakdown.unlockBonus !== 0) {
      positiveItems.push({ label: "Unlock Bonus", value: breakdown.unlockBonus });
    }
    if (breakdown.failurePenalty !== 0) {
      negativeItems.push({ label: "Failure Penalty", value: breakdown.failurePenalty });
    }
    if (breakdown.retryPenalty !== 0) {
      negativeItems.push({ label: "Retry Penalty", value: breakdown.retryPenalty });
    }
    if (breakdown.scopeCreepPenalty !== 0) {
      negativeItems.push({ label: "Scope Creep Penalty", value: breakdown.scopeCreepPenalty });
    }
    if (breakdown.riskIncidentPenalty !== 0) {
      negativeItems.push({ label: "Risk Incident Penalty", value: breakdown.riskIncidentPenalty });
    }

    if (positiveItems.length > 0) {
      lines.push("Positive:");
      for (const item of positiveItems) {
        lines.push(`  +${item.value} ${item.label}`);
      }
      lines.push("");
    }

    if (negativeItems.length > 0) {
      lines.push("Negative:");
      for (const item of negativeItems) {
        lines.push(`  ${item.value} ${item.label}`);
      }
      lines.push("");
    }

    lines.push(`Total Reward: ${breakdown.totalReward}`);
    lines.push("");

    return lines.join("\n");
  }

  getRewardLevel(reward: number): "excellent" | "good" | "neutral" | "poor" | "failed" {
    if (reward >= 150) {
      return "excellent";
    } else if (reward >= 100) {
      return "good";
    } else if (reward >= 50) {
      return "neutral";
    } else if (reward > 0) {
      return "poor";
    } else {
      return "failed";
    }
  }

  getRewardMessage(reward: number): string {
    const level = this.getRewardLevel(reward);
    const messages: Record<string, string> = {
      excellent: "🌟 Outstanding! Perfect execution with all bonuses.",
      good: "👍 Good job! Task completed successfully.",
      neutral: "😐 Neutral result. Room for improvement.",
      poor: "👎 Poor performance. Consider optimizing.",
      failed: "💥 Task failed. Need to retry or fix.",
    };
    return messages[level];
  }

  calculateEfficiency(task: CodexPmTask, executionResult: ExecutionResult): number {
    const reward = this.evaluate(task, executionResult).totalReward;
    const cost = this.estimateCost(task);

    if (cost === 0) {
      return reward;
    }

    return Math.round((reward / cost) * 100);
  }

  private estimateCost(task: CodexPmTask): number {
    const sizeCosts: Record<string, number> = {
      XS: 10,
      S: 20,
      M: 40,
      L: 80,
      XL: 160,
    };

    const riskMultiplier: Record<string, number> = {
      none: 0.8,
      low: 1.0,
      medium: 1.2,
      high: 1.5,
      critical: 2.0,
    };

    return Math.round(sizeCosts[task.size] * riskMultiplier[task.risk]);
  }
}
