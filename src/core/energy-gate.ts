import type { CodexPmTask } from "../types/task.js";

export interface EnergyEstimate {
  taskId: string;
  baseCost: number;
  sizeMultiplier: number;
  riskMultiplier: number;
  retryFactor: number;
  verificationCost: number;
  estimatedCost: number;
  budget: number;
  overBudget: boolean;
  overBudgetBy?: number;
}

export interface EnergyGateOptions {
  defaultBudget?: number;
  sizeCosts?: Record<string, number>;
  riskMultipliers?: Record<string, number>;
  retryCost?: number;
  verificationCommandCost?: number;
}

export class EnergyGate {
  private defaultBudget: number;
  private sizeCosts: Record<string, number>;
  private riskMultipliers: Record<string, number>;
  private retryCost: number;
  private verificationCommandCost: number;

  constructor(options: EnergyGateOptions = {}) {
    this.defaultBudget = options.defaultBudget ?? 100;
    this.sizeCosts = options.sizeCosts ?? {
      XS: 10,
      S: 20,
      M: 40,
      L: 80,
      XL: 160,
    };
    this.riskMultipliers = options.riskMultipliers ?? {
      none: 0.8,
      low: 1.0,
      medium: 1.2,
      high: 1.5,
      critical: 2.0,
    };
    this.retryCost = options.retryCost ?? 15;
    this.verificationCommandCost = options.verificationCommandCost ?? 5;
  }

  /**
   * 估算单个任务的能量成本
   */
  estimate(task: CodexPmTask): EnergyEstimate {
    // 基础成本基于任务大小
    const baseCost = this.sizeCosts[task.size] || this.sizeCosts["M"];

    // 风险乘数
    const riskMultiplier = this.riskMultipliers[task.risk] || this.riskMultipliers["low"];

    // 重试成本（基于最大重试次数的预期值）
    const expectedRetries = this.calculateExpectedRetries(task);
    const retryFactor = 1 + (expectedRetries * this.retryCost) / 100;

    // 验证命令成本
    const verificationCost = task.verify.length * this.verificationCommandCost;

    // 计算估算成本
    const estimatedCost = Math.round(baseCost * riskMultiplier * retryFactor + verificationCost);

    // 确定预算（使用任务特定预算或默认预算）
    const budget = task.max_retries
      ? this.defaultBudget * (task.max_retries + 1)
      : this.defaultBudget;

    // 检查是否超预算
    const overBudget = estimatedCost > budget;

    return {
      taskId: task.id,
      baseCost,
      sizeMultiplier: 1,
      riskMultiplier,
      retryFactor,
      verificationCost,
      estimatedCost,
      budget,
      overBudget,
      overBudgetBy: overBudget ? estimatedCost - budget : undefined,
    };
  }

  /**
   * 估算多个任务的总能量成本
   */
  estimateAll(tasks: CodexPmTask[]): EnergyEstimate[] {
    return tasks.map(task => this.estimate(task));
  }

  /**
   * 获取超预算的任务列表
   */
  getOverBudgetTasks(tasks: CodexPmTask[]): EnergyEstimate[] {
    return this.estimateAll(tasks).filter(estimate => estimate.overBudget);
  }

  /**
   * 检查任务是否在预算内
   */
  isWithinBudget(task: CodexPmTask): boolean {
    return !this.estimate(task).overBudget;
  }

  /**
   * 获取任务的预算警告级别
   */
  getBudgetWarning(task: CodexPmTask): "ok" | "warning" | "critical" {
    const estimate = this.estimate(task);
    const ratio = estimate.estimatedCost / estimate.budget;

    if (ratio <= 0.75) {
      return "ok";
    } else if (ratio <= 1.0) {
      return "warning";
    } else {
      return "critical";
    }
  }

  /**
   * 计算预期重试次数
   */
  private calculateExpectedRetries(task: CodexPmTask): number {
    // 根据风险和历史重试次数估算预期重试次数
    const baseRetries = task.retry_count || 0;

    // 高风险任务更可能需要更多重试
    let riskAdjustment = 0;
    switch (task.risk) {
      case "high":
        riskAdjustment = 1;
        break;
      case "critical":
        riskAdjustment = 2;
        break;
    }

    // 返回预期重试次数（不超过最大重试次数的一半）
    const maxExpected = task.max_retries ? Math.floor(task.max_retries / 2) : 2;
    return Math.min(baseRetries + riskAdjustment, maxExpected);
  }

  /**
   * 获取总能量统计
   */
  getEnergyStats(tasks: CodexPmTask[]): {
    totalEstimatedCost: number;
    totalBudget: number;
    overBudgetCount: number;
    averageCost: number;
    maxCost: number;
    minCost: number;
  } {
    const estimates = this.estimateAll(tasks);

    const totalEstimatedCost = estimates.reduce((sum, e) => sum + e.estimatedCost, 0);
    const totalBudget = estimates.reduce((sum, e) => sum + e.budget, 0);
    const overBudgetCount = estimates.filter(e => e.overBudget).length;
    const costs = estimates.map(e => e.estimatedCost);

    return {
      totalEstimatedCost,
      totalBudget,
      overBudgetCount,
      averageCost: costs.length > 0 ? Math.round(totalEstimatedCost / costs.length) : 0,
      maxCost: costs.length > 0 ? Math.max(...costs) : 0,
      minCost: costs.length > 0 ? Math.min(...costs) : 0,
    };
  }

  /**
   * 格式化能量估算结果
   */
  formatEstimate(estimate: EnergyEstimate): string {
    const lines: string[] = [];

    lines.push(`Task: ${estimate.taskId}`);
    lines.push(`  Estimated Cost: ${estimate.estimatedCost} units`);
    lines.push(`  Budget: ${estimate.budget} units`);
    lines.push(`  Status: ${estimate.overBudget ? "⚠️ OVER BUDGET" : "✅ Within Budget"}`);

    if (estimate.overBudgetBy) {
      lines.push(`  Over Budget by: ${estimate.overBudgetBy} units`);
    }

    lines.push("");
    lines.push("  Breakdown:");
    lines.push(`    Base cost (size): ${estimate.baseCost}`);
    lines.push(`    Risk multiplier: x${estimate.riskMultiplier}`);
    lines.push(`    Retry factor: x${estimate.retryFactor.toFixed(2)}`);
    lines.push(`    Verification cost: ${estimate.verificationCost}`);

    return lines.join("\n");
  }

  /**
   * 获取可用预算警告消息
   */
  getBudgetWarningMessage(task: CodexPmTask): string | null {
    const estimate = this.estimate(task);
    const warning = this.getBudgetWarning(task);

    if (warning === "ok") {
      return null;
    }

    if (warning === "warning") {
      return `Warning: Task ${task.id} is approaching budget (${estimate.estimatedCost}/${estimate.budget} units)`;
    }

    return `Critical: Task ${task.id} exceeds budget by ${estimate.overBudgetBy} units (${estimate.estimatedCost}/${estimate.budget})`;
  }
}
