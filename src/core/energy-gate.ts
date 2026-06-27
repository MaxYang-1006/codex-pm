import * as fs from "fs";
import * as path from "path";
import type { CodexPmTask } from "../types/task.js";
import { ensureDirectoryExists } from "./file-utils.js";

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
  energyFilePath?: string;
  restoreRatePerHour?: number;
  successRefundPercentage?: number;
  maxEnergy?: number;
}

export interface EnergyState {
  balance: number;
  lastUpdatedAt: string;
  totalEarned: number;
  totalSpent: number;
}

const DEFAULT_ENERGY_STATE: EnergyState = {
  balance: 500,
  lastUpdatedAt: new Date().toISOString(),
  totalEarned: 500,
  totalSpent: 0,
};

export class EnergyGate {
  private defaultBudget: number;
  private sizeCosts: Record<string, number>;
  private riskMultipliers: Record<string, number>;
  private retryCost: number;
  private verificationCommandCost: number;
  private energyFilePath: string;
  private restoreRatePerHour: number;
  private successRefundPercentage: number;
  private maxEnergy: number;

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
    this.energyFilePath = options.energyFilePath ?? ".codex-pm/energy.json";
    this.restoreRatePerHour = options.restoreRatePerHour ?? 50;
    this.successRefundPercentage = options.successRefundPercentage ?? 30;
    this.maxEnergy = options.maxEnergy ?? 2000;
  }

  /**
   * 加载能量状态（包含时间恢复）
   */
  loadEnergy(): EnergyState {
    let state: EnergyState;

    try {
      if (fs.existsSync(this.energyFilePath)) {
        const content = fs.readFileSync(this.energyFilePath, "utf-8");
        state = JSON.parse(content);
      } else {
        state = { ...DEFAULT_ENERGY_STATE };
      }
    } catch {
      state = { ...DEFAULT_ENERGY_STATE };
    }

    const restored = this.calculateTimeRestore(state);
    state.balance = Math.min(state.balance + restored, this.maxEnergy);
    state.lastUpdatedAt = new Date().toISOString();

    this.saveEnergy(state);

    return state;
  }

  /**
   * 计算时间恢复的能量
   */
  private calculateTimeRestore(state: EnergyState): number {
    try {
      const lastUpdate = new Date(state.lastUpdatedAt);
      const now = new Date();
      const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastUpdate <= 0) {
        return 0;
      }

      return Math.floor(hoursSinceLastUpdate * this.restoreRatePerHour);
    } catch {
      return 0;
    }
  }

  /**
   * 保存能量状态
   */
  saveEnergy(state: EnergyState): void {
    const dir = path.dirname(this.energyFilePath);
    ensureDirectoryExists(dir);

    fs.writeFileSync(this.energyFilePath, JSON.stringify(state, null, 2));
  }

  /**
   * 获取当前能量余额（包含时间恢复）
   */
  getBalance(): number {
    const state = this.loadEnergy();
    return state.balance;
  }

  /**
   * 消耗能量
   */
  spendEnergy(amount: number): { success: boolean; newBalance: number } {
    const state = this.loadEnergy();

    if (state.balance < amount) {
      return { success: false, newBalance: state.balance };
    }

    state.balance -= amount;
    state.totalSpent += amount;
    state.lastUpdatedAt = new Date().toISOString();

    this.saveEnergy(state);

    return { success: true, newBalance: state.balance };
  }

  /**
   * 任务成功验证通过后返还能量（返还消耗的30%）
   */
  refundEnergy(amount: number): { refunded: number; newBalance: number } {
    const state = this.loadEnergy();

    const refundAmount = Math.round(amount * (this.successRefundPercentage / 100));

    if (refundAmount <= 0) {
      return { refunded: 0, newBalance: state.balance };
    }

    state.balance = Math.min(state.balance + refundAmount, this.maxEnergy);
    state.totalEarned += refundAmount;
    state.lastUpdatedAt = new Date().toISOString();

    this.saveEnergy(state);

    return { refunded: refundAmount, newBalance: state.balance };
  }

  /**
   * 补充能量
   */
  refillEnergy(amount: number): { added: number; newBalance: number } {
    const state = this.loadEnergy();

    const actualAdded = Math.min(amount, this.maxEnergy - state.balance);

    if (actualAdded <= 0) {
      return { added: 0, newBalance: state.balance };
    }

    state.balance += actualAdded;
    state.totalEarned += actualAdded;
    state.lastUpdatedAt = new Date().toISOString();

    this.saveEnergy(state);

    return { added: actualAdded, newBalance: state.balance };
  }

  /**
   * 重置能量到初始值
   */
  resetEnergy(): EnergyState {
    const state = { ...DEFAULT_ENERGY_STATE };
    this.saveEnergy(state);
    return state;
  }

  /**
   * 估算单个任务的能量成本
   */
  estimate(task: CodexPmTask): EnergyEstimate {
    const baseCost = this.sizeCosts[task.size] || this.sizeCosts["M"];

    const riskMultiplier = this.riskMultipliers[task.risk] || this.riskMultipliers["low"];

    const expectedRetries = this.calculateExpectedRetries(task);
    const retryFactor = 1 + (expectedRetries * this.retryCost) / 100;

    const verificationCost = task.verify.length * this.verificationCommandCost;

    const estimatedCost = Math.round(baseCost * riskMultiplier * retryFactor + verificationCost);

    const budget = task.max_retries
      ? this.defaultBudget * (task.max_retries + 1)
      : this.defaultBudget;

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
    const baseRetries = task.retry_count || 0;

    let riskAdjustment = 0;
    switch (task.risk) {
      case "high":
        riskAdjustment = 1;
        break;
      case "critical":
        riskAdjustment = 2;
        break;
    }

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
   * 获取当前能量状态统计
   */
  getCurrentEnergyStats(): EnergyState {
    return this.loadEnergy();
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

  /**
   * 格式化能量状态输出
   */
  formatEnergyStatus(state?: EnergyState): string {
    const currentState = state || this.loadEnergy();
    const lines: string[] = [];

    lines.push("=== Energy Status ===");
    lines.push("");
    lines.push(`Balance: ${currentState.balance} / ${this.maxEnergy} units`);
    lines.push(`Total Earned: ${currentState.totalEarned} units`);
    lines.push(`Total Spent: ${currentState.totalSpent} units`);
    lines.push(`Restore Rate: ${this.restoreRatePerHour} units/hour`);
    lines.push(`Success Refund: ${this.successRefundPercentage}%`);
    lines.push("");

    return lines.join("\n");
  }
}
