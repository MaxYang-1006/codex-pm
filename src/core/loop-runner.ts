import * as fs from "fs";
import * as path from "path";
import { StateManager } from "./state-manager.js";
import { TaskScorer } from "./task-scorer.js";
import { EnergyGate } from "./energy-gate.js";
import { runRunOne, RunOneResult } from "../commands/run-one.js";
import { ensureDirectoryExists } from "./file-utils.js";
import { confirm } from "./interactive-prompt.js";
import { RiskGate } from "./risk-gate.js";
import type { CodexPmTask } from "../types/task.js";

/**
 * 循环运行停止原因
 */
export type LoopStopReason =
  | "max_tasks_reached"
  | "no_runnable_tasks"
  | "high_risk_stopped"
  | "repeated_failure_stopped"
  | "energy_budget_exceeded"
  | "user_stopped";

/**
 * 单个任务运行结果
 */
export interface LoopTaskResult {
  taskId: string;
  success: boolean;
  duration: number;
  error?: string;
  energyCost: number;
}

/**
 * 循环运行报告
 */
export interface LoopReport {
  success: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalEnergyUsed: number;
  stopReason: LoopStopReason;
  taskResults: LoopTaskResult[];
  startedAt: string;
  completedAt: string;
  duration: number;
}

/**
 * 循环运行配置
 */
export interface LoopRunnerOptions {
  maxTasks?: number;
  maxConsecutiveFailures?: number;
  energyBudget?: number;
  stopOnHighRisk?: boolean;
  dryRun?: boolean;
  baseDir?: string;
  interactive?: boolean;
  mode?: "smart" | "guided";
}

const DEFAULT_OPTIONS: Required<
  Pick<
    LoopRunnerOptions,
    "maxTasks" | "maxConsecutiveFailures" | "energyBudget" | "stopOnHighRisk" | "dryRun" | "interactive"
  >
> = {
  maxTasks: 5,
  maxConsecutiveFailures: 2,
  energyBudget: 500,
  stopOnHighRisk: true,
  dryRun: false,
  interactive: false,
};

/**
 * 循环运行器 - 安全地运行多个任务
 *
 * 功能：
 * - 限制最大任务数
 * - 高风险时停止
 * - 连续失败时停止
 * - 能量预算超限时停止
 */
export class LoopRunner {
  private options: Required<
    Pick<
      LoopRunnerOptions,
      "maxTasks" | "maxConsecutiveFailures" | "energyBudget" | "stopOnHighRisk" | "dryRun" | "interactive"
    >
  > & { baseDir?: string; mode?: "smart" | "guided" };

  constructor(options: LoopRunnerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 运行任务循环
   */
  async run(): Promise<LoopReport> {
    const startedAt = new Date();
    const taskResults: LoopTaskResult[] = [];
    const processedTaskIds = new Set<string>();
    let consecutiveFailures = 0;
    let totalEnergyUsed = 0;
    let stopReason: LoopStopReason = "max_tasks_reached";

    const manager = new StateManager(this.options.baseDir);

    // 检查项目是否已初始化
    if (!manager.isInitialized()) {
      return this.buildEmptyReport(
        "no_runnable_tasks",
        startedAt,
        "Project not initialized. Run 'codex-pm scan' first."
      );
    }

    const energyGate = new EnergyGate();

    try {
      for (let i = 0; i < this.options.maxTasks; i++) {
        // 重新加载状态（每次循环都刷新）
        manager.load();
        const tasks = manager.getTasks();
        const scorer = new TaskScorer();

        // 获取所有可运行任务
        const allScores = scorer.scoreAllTasks(tasks);

        // 过滤掉已处理的任务（dry-run 模式下任务状态不会更新）
        const availableScores = allScores.filter(s => !processedTaskIds.has(s.task_id));

        if (availableScores.length === 0) {
          stopReason = "no_runnable_tasks";
          break;
        }

        const nextTask = availableScores[0];
        const task = tasks.find(t => t.id === nextTask.task_id);
        if (!task) {
          stopReason = "no_runnable_tasks";
          break;
        }

        // 检查高风险任务
        const isHighRisk = task.risk === "high" || task.risk === "critical";
        if (isHighRisk) {
          // 交互式模式下询问用户
          if (this.options.interactive) {
            const approved = await this.promptHighRiskApproval(task);
            if (!approved) {
              stopReason = "high_risk_stopped";
              break;
            }
            // 用户批准后继续执行
          } else if (this.options.stopOnHighRisk) {
            // 非交互式且设置了停止，则停止
            stopReason = "high_risk_stopped";
            break;
          }
          // 如果 stopOnHighRisk 为 false 且非交互式，则直接继续（不安全但用户配置了）
        }

        // 检查能量预算（使用持久化能量）
        const estimate = energyGate.estimate(task);
        const currentBalance = energyGate.getBalance();

        if (!this.options.dryRun && currentBalance < estimate.estimatedCost) {
          stopReason = "energy_budget_exceeded";
          break;
        }

        // 标记任务为已处理
        processedTaskIds.add(task.id);

        // 执行单个任务
        const result = await this.executeTask(task.id);

        // 计算实际能量消耗（使用估算值作为实际消耗）
        const actualEnergyCost = estimate.estimatedCost;
        totalEnergyUsed += actualEnergyCost;

        // 非 dry-run 模式下实际消耗能量
        if (!this.options.dryRun) {
          energyGate.spendEnergy(actualEnergyCost);

          // 任务成功且验证通过时返还30%能量
          if (result.success) {
            const refundResult = energyGate.refundEnergy(actualEnergyCost);
            if (refundResult.refunded > 0) {
              totalEnergyUsed -= refundResult.refunded;
            }
          }
        }

        // 记录结果
        taskResults.push({
          taskId: task.id,
          success: result.success,
          duration: result.executionResult?.duration || 0,
          error: result.success ? undefined : result.message,
          energyCost: actualEnergyCost,
        });

        // 处理连续失败
        if (!result.success) {
          consecutiveFailures++;
          if (consecutiveFailures >= this.options.maxConsecutiveFailures) {
            stopReason = "repeated_failure_stopped";
            break;
          }
        } else {
          consecutiveFailures = 0;
        }
      }
    } catch (error) {
      // 意外错误也需要记录
      stopReason = "user_stopped";
    }

    const completedAt = new Date();

    const report: LoopReport = {
      success: taskResults.length > 0 && taskResults.every(r => r.success),
      totalTasks: taskResults.length,
      completedTasks: taskResults.filter(r => r.success).length,
      failedTasks: taskResults.filter(r => !r.success).length,
      totalEnergyUsed,
      stopReason,
      taskResults,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration: completedAt.getTime() - startedAt.getTime(),
    };

    // 保存循环报告
    this.saveLoopReport(report);

    return report;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(taskId: string): Promise<RunOneResult> {
    return await runRunOne(taskId, this.options.dryRun);
  }

  /**
   * 交互式询问用户是否批准高风险任务
   */
  private async promptHighRiskApproval(task: CodexPmTask): Promise<boolean> {
    const riskGate = new RiskGate();
    const riskResult = riskGate.evaluate(task);

    const details: string[] = [];
    details.push("");
    details.push("⚠  HIGH RISK TASK DETECTED");
    details.push("");
    details.push(`  Task ID:   ${task.id}`);
    details.push(`  Title:     ${task.title}`);
    details.push(`  Risk:      ${task.risk} (${Math.round(riskResult.score * 100)}%)`);
    details.push(`  Priority:  ${task.priority}`);
    details.push(`  Size:      ${task.size}`);
    details.push("");

    if (riskResult.factors.length > 0) {
      details.push("  Risk factors:");
      for (const factor of riskResult.factors.slice(0, 5)) {
        if (factor.contribution > 0) {
          details.push(`    - ${factor.name}: ${factor.details}`);
        }
      }
      details.push("");
    }

    if (task.description) {
      details.push("  Description:");
      details.push(`    ${task.description.substring(0, 150)}${task.description.length > 150 ? "..." : ""}`);
      details.push("");
    }

    const approved = await confirm({
      question: "Approve this high-risk task and continue?",
      default: false,
      details,
    });

    return approved;
  }

  /**
   * 构建空报告（异常情况）
   */
  private buildEmptyReport(reason: LoopStopReason, startedAt: Date, _message: string): LoopReport {
    const completedAt = new Date();
    return {
      success: false,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalEnergyUsed: 0,
      stopReason: reason,
      taskResults: [],
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration: 0,
    };
  }

  /**
   * 保存循环报告
   */
  private saveLoopReport(report: LoopReport): void {
    const baseDir = this.options.baseDir || ".codex-pm";
    const reportsDir = path.join(baseDir, "reports");

    // 确保报告目录存在
    ensureDirectoryExists(reportsDir);

    const reportPath = path.join(reportsDir, `loop-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * 格式化循环报告输出
   */
  formatReport(report: LoopReport): string {
    const lines: string[] = [];

    lines.push("=== Codex PM Run Loop ===");
    lines.push("");

    // 基本信息
    lines.push(`Mode: ${this.options.dryRun ? "DRY-RUN" : "EXECUTION"}`);
    lines.push(`Total Tasks Run: ${report.totalTasks}`);
    lines.push(`Completed: ${report.completedTasks}`);
    lines.push(`Failed: ${report.failedTasks}`);
    lines.push(`Duration: ${report.duration}ms`);
    lines.push(`Energy Used: ${report.totalEnergyUsed} units`);
    lines.push("");

    // 停止原因
    lines.push(`Stop Reason: ${this.formatStopReason(report.stopReason)}`);
    lines.push("");

    // 任务结果列表
    if (report.taskResults.length > 0) {
      lines.push("Task Results:");
      for (const result of report.taskResults) {
        const statusIcon = result.success ? "✓" : "✗";
        lines.push(`  ${statusIcon} ${result.taskId} (${result.energyCost} units)`);
        if (!result.success && result.error) {
          lines.push(`      Error: ${result.error.substring(0, 80)}`);
        }
      }
      lines.push("");
    }

    // 统计摘要
    if (report.totalTasks > 0) {
      const successRate = Math.round((report.completedTasks / report.totalTasks) * 100);
      lines.push(`Success Rate: ${successRate}%`);
    }

    return lines.join("\n");
  }

  /**
   * 格式化停止原因
   */
  private formatStopReason(reason: LoopStopReason): string {
    const reasonMap: Record<LoopStopReason, string> = {
      max_tasks_reached: "Maximum tasks reached",
      no_runnable_tasks: "No more runnable tasks",
      high_risk_stopped: "Stopped due to high risk task",
      repeated_failure_stopped: "Stopped due to repeated failures",
      energy_budget_exceeded: "Energy budget exceeded",
      user_stopped: "Stopped by user or error",
    };
    return reasonMap[reason] || reason;
  }
}
