import * as fs from "fs";
import * as path from "path";
import type { TaskRunEntry } from "../types/state.js";
import { ensureDirectoryExists } from "./file-utils.js";
import { normalizeTaskRunEntry } from "./result-writer.js";

export interface FitnessMetrics {
  completionRate: number;
  verificationPassRate: number;
  retryRate: number;
  riskIncidentRate: number;
  totalScore: number;
  totalTasks: number;
  completedTasks: number;
  passedVerifications: number;
  totalVerifications: number;
  totalRetries: number;
  riskIncidents: number;
  averageDuration: number;
  averageReward: number;
}

export interface FitnessOptions {
  baseDir?: string;
  minSampleSize?: number;
}

export class FitnessCalculator {
  private baseDir: string;
  private minSampleSize: number;

  constructor(options: FitnessOptions = {}) {
    this.baseDir = options.baseDir ?? ".codex-pm";
    this.minSampleSize = options.minSampleSize ?? 3;
    ensureDirectoryExists(this.baseDir);
  }

  calculate(): FitnessMetrics {
    const runs = this.loadTaskRuns();

    if (runs.length === 0) {
      return this.getEmptyMetrics();
    }

    return this.computeMetrics(runs);
  }

  calculateForTask(taskId: string): FitnessMetrics {
    const allRuns = this.loadTaskRuns();
    const runs = allRuns.filter(r => r.task_id === taskId);

    if (runs.length === 0) {
      return this.getEmptyMetrics();
    }

    return this.computeMetrics(runs);
  }

  private loadTaskRuns(): TaskRunEntry[] {
    const runsPath = path.join(this.baseDir, "task-runs.jsonl");

    if (!fs.existsSync(runsPath)) {
      return [];
    }

    const content = fs.readFileSync(runsPath, "utf-8");
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");

    return lines
      .map(line => {
        try {
          return normalizeTaskRunEntry(JSON.parse(line));
        } catch {
          return null;
        }
      })
      .filter((run): run is TaskRunEntry => run !== null);
  }

  private computeMetrics(runs: TaskRunEntry[]): FitnessMetrics {
    const totalTasks = runs.length;

    // 计算完成率
    const completedTasks = runs.filter(r => r.status === "completed").length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 计算验证通过率
    let passedVerifications = 0;
    let totalVerifications = 0;

    for (const run of runs) {
      totalVerifications += run.verification_results.length;
      passedVerifications += run.verification_results.filter(r => r.success).length;
    }
    const verificationPassRate =
      totalVerifications > 0 ? Math.round((passedVerifications / totalVerifications) * 100) : 100; // 如果没有验证，默认100%

    // 计算重试率
    const totalRetries = runs.reduce((sum, r) => sum + (r.retry_count || 0), 0);
    const retryRate = totalTasks > 0 ? Math.round((totalRetries / totalTasks) * 100) : 0;

    // 计算风险事件率
    const riskIncidents = runs.filter(r => r.risk_incident).length;
    const riskIncidentRate = totalTasks > 0 ? Math.round((riskIncidents / totalTasks) * 100) : 0;

    // 计算平均执行时间
    const totalDuration = runs.reduce((sum, r) => sum + r.duration_ms, 0);
    const averageDuration = totalTasks > 0 ? Math.round(totalDuration / totalTasks) : 0;

    // 计算平均奖励
    const totalReward = runs.reduce((sum, r) => sum + (r.reward || 0), 0);
    const averageReward = totalTasks > 0 ? Math.round(totalReward / totalTasks) : 0;

    // 计算总分（基于各个指标的加权平均）
    const totalScore = this.calculateTotalScore({
      completionRate,
      verificationPassRate,
      retryRate,
      riskIncidentRate,
    });

    return {
      completionRate,
      verificationPassRate,
      retryRate,
      riskIncidentRate,
      totalScore,
      totalTasks,
      completedTasks,
      passedVerifications,
      totalVerifications,
      totalRetries,
      riskIncidents,
      averageDuration,
      averageReward,
    };
  }

  private calculateTotalScore(metrics: {
    completionRate: number;
    verificationPassRate: number;
    retryRate: number;
    riskIncidentRate: number;
  }): number {
    // 权重：完成率 30%, 验证通过率 30%, 重试率（反向）20%, 风险事件率（反向）20%
    const completionWeight = 0.3;
    const verificationWeight = 0.3;
    const retryWeight = 0.2;
    const riskWeight = 0.2;

    const score =
      metrics.completionRate * completionWeight +
      metrics.verificationPassRate * verificationWeight +
      (100 - metrics.retryRate) * retryWeight +
      (100 - metrics.riskIncidentRate) * riskWeight;

    return Math.round(score);
  }

  private getEmptyMetrics(): FitnessMetrics {
    return {
      completionRate: 0,
      verificationPassRate: 0,
      retryRate: 0,
      riskIncidentRate: 0,
      totalScore: 0,
      totalTasks: 0,
      completedTasks: 0,
      passedVerifications: 0,
      totalVerifications: 0,
      totalRetries: 0,
      riskIncidents: 0,
      averageDuration: 0,
      averageReward: 0,
    };
  }

  formatSummary(metrics: FitnessMetrics): string {
    const lines: string[] = [];

    lines.push("=== Fitness Summary ===");
    lines.push("");

    // 总分和任务数
    lines.push(`Total Score: ${metrics.totalScore}/100`);
    lines.push(`Total Tasks: ${metrics.totalTasks}`);
    lines.push("");

    // 各项指标
    lines.push("Metrics:");
    lines.push(
      `  Completion Rate: ${metrics.completionRate}% (${metrics.completedTasks}/${metrics.totalTasks})`
    );
    lines.push(
      `  Verification Pass Rate: ${metrics.verificationPassRate}% (${metrics.passedVerifications}/${metrics.totalVerifications})`
    );
    lines.push(`  Retry Rate: ${metrics.retryRate}% (${metrics.totalRetries} retries)`);
    lines.push(
      `  Risk Incident Rate: ${metrics.riskIncidentRate}% (${metrics.riskIncidents} incidents)`
    );
    lines.push("");

    // 附加信息
    lines.push("Additional Info:");
    lines.push(`  Average Duration: ${metrics.averageDuration}ms`);
    lines.push(`  Average Reward: ${metrics.averageReward}`);
    lines.push("");

    // 评级
    lines.push(`Rating: ${this.getRating(metrics.totalScore)}`);
    lines.push(`Recommendation: ${this.getRecommendation(metrics)}`);

    return lines.join("\n");
  }

  getRating(score: number): string {
    if (score >= 90) return "🌟 Excellent";
    if (score >= 80) return "👍 Good";
    if (score >= 70) return "😊 Fair";
    if (score >= 60) return "😐 Poor";
    return "💥 Critical";
  }

  getRecommendation(metrics: FitnessMetrics): string {
    const issues: string[] = [];

    if (metrics.completionRate < 70) {
      issues.push("improve task completion");
    }
    if (metrics.verificationPassRate < 80) {
      issues.push("increase verification pass rate");
    }
    if (metrics.retryRate > 30) {
      issues.push("reduce retry frequency");
    }
    if (metrics.riskIncidentRate > 10) {
      issues.push("address risk incidents");
    }

    if (issues.length === 0) {
      return "All metrics are healthy. Keep up the good work!";
    }

    return `Focus on: ${issues.join(", ")}.`;
  }

  getTrend(current: FitnessMetrics, previous: FitnessMetrics): "up" | "down" | "stable" {
    const scoreDiff = current.totalScore - previous.totalScore;

    if (scoreDiff > 5) return "up";
    if (scoreDiff < -5) return "down";
    return "stable";
  }

  hasEnoughData(): boolean {
    const runs = this.loadTaskRuns();
    return runs.length >= this.minSampleSize;
  }
}
