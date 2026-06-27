/**
 * Risk Gate - 风险评分和高风险任务审批
 *
 * 负责：
 * - 基于任务字段、关键词、文件提示进行风险评分
 * - 检查历史风险挂钩
 * - 高风险/关键风险任务需要审批
 */

import type { CodexPmTask } from "../types/task.js";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskScore {
  taskId: string;
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  needsApproval: boolean;
  reason: string;
}

export interface RiskFactor {
  name: string;
  contribution: number;
  weight: number;
  details: string;
}

export interface RiskGateConfig {
  thresholds: {
    low: number; // 0.0 - 0.3
    medium: number; // 0.3 - 0.6
    high: number; // 0.6 - 0.85
    critical: number; // 0.85 - 1.0
  };
  approvalRequired: RiskLevel[];
  stopOnCritical: boolean;
  maxHistoricalRiskScore: number;
  findTaskById?: (taskId: string) => CodexPmTask | null;
}

export interface RiskHistoryEntry {
  taskId: string;
  riskScore: number;
  wasApproved: boolean;
  approvedBy?: string;
  timestamp: string;
}

const DEFAULT_CONFIG: RiskGateConfig = {
  thresholds: {
    low: 0.3,
    medium: 0.6,
    high: 0.85,
    critical: 1.0,
  },
  approvalRequired: ["high", "critical"],
  stopOnCritical: true,
  maxHistoricalRiskScore: 100,
};

const RISKY_KEYWORDS = [
  // 危险操作
  "delete",
  "drop",
  "truncate",
  "remove",
  // 安全相关
  "auth",
  "password",
  "credential",
  "secret",
  "token",
  "security",
  "encryption",
  // 基础设施
  "database",
  "migration",
  "schema",
  "index",
  // 生产环境
  "production",
  "deploy",
  "release",
  "rollback",
  // 系统级
  "root",
  "sudo",
  "admin",
  "privilege",
];

const RISKY_FILE_PATTERNS = [
  /package\.json$/i,
  /tsconfig\.json$/i,
  /\.env(\.|\.|$)/i,
  /docker-compose\.ya?ml$/i,
  /dockerfile$/i,
  /\.gitignore$/i,
  /\.env$/i,
  /config\//i,
  /migrations?\//i,
  /seeds?\//i,
  /scripts?\//i,
  /\.sql$/i,
  /\.sh$/i,
];

const RISKY_PATTERNS = [
  // 命令注入
  /eval\s*\(/i,
  /exec\s*\(/i,
  /child_process/i,
  // SQL 注入风险
  /\$\{.*\}/i, // 模板字符串中的变量拼接
  /template\s*literal/i,
  // 动态代码
  /new\s+Function\s*\(/i,
  /setTimeout\s*\(\s*['"`]/i,
  /setInterval\s*\(\s*['"`]/i,
];

export class RiskGate {
  private config: RiskGateConfig;
  private historicalRisks: RiskHistoryEntry[] = [];
  private findTaskFn: (taskId: string) => CodexPmTask | null;

  constructor(config: Partial<RiskGateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.findTaskFn = config.findTaskById || (() => null);
  }

  /**
   * 评估任务风险
   */
  evaluate(task: CodexPmTask): RiskScore {
    const factors: RiskFactor[] = [];

    // 1. 基础风险评分（基于 task.risk 字段）
    const baseScore = this.evaluateBaseRisk(task);
    factors.push(baseScore);

    // 2. 关键词风险
    const keywordScore = this.evaluateKeywords(task);
    factors.push(keywordScore);

    // 3. 文件提示风险
    const fileScore = this.evaluateFiles(task);
    factors.push(fileScore);

    // 4. 模式风险（描述中的危险模式）
    const patternScore = this.evaluatePatterns(task);
    factors.push(patternScore);

    // 5. 历史风险（如果之前有失败的高风险任务）
    const historyScore = this.evaluateHistory(task);
    if (historyScore) {
      factors.push(historyScore);
    }

    // 计算总分（加权平均）
    const totalScore = this.calculateTotalScore(factors);

    // 确定风险等级
    const level = this.determineLevel(totalScore);

    // 是否需要审批
    const needsApproval = this.config.approvalRequired.includes(level);

    // 构建原因
    const reason = this.buildReason(factors, level, needsApproval);

    return {
      taskId: task.id,
      level,
      score: totalScore,
      factors,
      needsApproval,
      reason,
    };
  }

  /**
   * 评估基础风险
   */
  private evaluateBaseRisk(task: CodexPmTask): RiskFactor {
    let contribution = 0;

    switch (task.risk) {
      case "critical":
        contribution = 0.9;
        break;
      case "high":
        contribution = 0.65;
        break;
      case "medium":
        contribution = 0.35;
        break;
      case "low":
      default:
        contribution = 0.1;
    }

    return {
      name: "base_risk",
      contribution,
      weight: 0.4,
      details: `Task risk field: ${task.risk}`,
    };
  }

  /**
   * 评估关键词风险
   */
  private evaluateKeywords(task: CodexPmTask): RiskFactor {
    let contribution = 0;
    const matchedKeywords: string[] = [];

    const text = `${task.title} ${task.description} ${task.area}`.toLowerCase();

    for (const keyword of RISKY_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        contribution += 0.15;
      }
    }

    // 限制最大贡献值
    contribution = Math.min(contribution, 0.5);

    return {
      name: "keywords",
      contribution,
      weight: 0.25,
      details:
        matchedKeywords.length > 0
          ? `Matched: ${matchedKeywords.join(", ")}`
          : "No risky keywords found",
    };
  }

  /**
   * 评估文件提示风险
   */
  private evaluateFiles(task: CodexPmTask): RiskFactor {
    let contribution = 0;
    const matchedFiles: string[] = [];

    for (const fileHint of task.files_hint) {
      for (const pattern of RISKY_FILE_PATTERNS) {
        if (pattern.test(fileHint)) {
          matchedFiles.push(fileHint);
          contribution += 0.2;
          break;
        }
      }
    }

    // 限制最大贡献值
    contribution = Math.min(contribution, 0.6);

    return {
      name: "files",
      contribution,
      weight: 0.2,
      details:
        matchedFiles.length > 0
          ? `Risky files: ${matchedFiles.join(", ")}`
          : "No risky file patterns",
    };
  }

  /**
   * 评估描述中的危险模式
   */
  private evaluatePatterns(task: CodexPmTask): RiskFactor {
    let contribution = 0;
    const matchedPatterns: string[] = [];

    for (const pattern of RISKY_PATTERNS) {
      if (pattern.test(task.description)) {
        matchedPatterns.push(pattern.source);
        contribution += 0.25;
      }
    }

    // 限制最大贡献值
    contribution = Math.min(contribution, 0.5);

    return {
      name: "patterns",
      contribution,
      weight: 0.1,
      details:
        matchedPatterns.length > 0
          ? `Dangerous patterns: ${matchedPatterns.length}`
          : "No dangerous patterns",
    };
  }

  /**
   * 评估历史风险
   */
  private evaluateHistory(task: CodexPmTask): RiskFactor | null {
    // 查找同 area 或相关任务的历史风险
    const relatedRisks = this.historicalRisks.filter(entry => {
      const relatedTask = this.findTaskById(entry.taskId);
      return (
        relatedTask && (relatedTask.area === task.area || task.depends_on.includes(entry.taskId))
      );
    });

    if (relatedRisks.length === 0) {
      return null;
    }

    // 计算平均历史风险
    const avgRisk =
      relatedRisks.reduce((sum, entry) => sum + entry.riskScore, 0) / relatedRisks.length;
    const contribution = Math.min(avgRisk * 0.3, 0.3);

    return {
      name: "history",
      contribution,
      weight: 0.05,
      details: `Average related risk: ${avgRisk.toFixed(2)}`,
    };
  }

  /**
   * 查找任务（通过依赖注入的函数）
   */
  private findTaskById(taskId: string): CodexPmTask | null {
    return this.findTaskFn(taskId);
  }

  /**
   * 计算总分
   */
  private calculateTotalScore(factors: RiskFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      // 只考虑有贡献的因素
      if (factor.contribution > 0) {
        weightedSum += factor.contribution * factor.weight;
        totalWeight += factor.weight;
      }
    }

    const baseFactor = factors.find(f => f.name === "base_risk");
    const baseRisk = baseFactor ? baseFactor.contribution : 0;

    if (totalWeight === 0) {
      return baseRisk;
    }

    // 额外因素可以抬高风险，但不能把任务声明的基础风险稀释掉。
    return Math.max(baseRisk, weightedSum / totalWeight);
  }

  /**
   * 确定风险等级
   */
  private determineLevel(score: number): RiskLevel {
    if (score <= this.config.thresholds.low) {
      return "low";
    } else if (score <= this.config.thresholds.medium) {
      return "medium";
    } else if (score <= this.config.thresholds.high) {
      return "high";
    } else {
      return "critical";
    }
  }

  /**
   * 构建原因说明
   */
  private buildReason(factors: RiskFactor[], level: RiskLevel, needsApproval: boolean): string {
    const parts: string[] = [];

    parts.push(`Risk level: ${level}`);

    const highContributors = factors
      .filter(f => f.contribution > 0.2)
      .sort((a, b) => b.contribution - a.contribution);

    if (highContributors.length > 0) {
      parts.push("Main factors:");
      for (const factor of highContributors.slice(0, 3)) {
        parts.push(`  - ${factor.name}: ${factor.details}`);
      }
    }

    if (needsApproval) {
      parts.push(`Requires approval: ${level === "critical" ? "BLOCKED" : "YES"}`);
    }

    return parts.join("\n");
  }

  /**
   * 检查任务是否可以运行
   */
  canRun(task: CodexPmTask): {
    allowed: boolean;
    reason: string;
    riskScore?: RiskScore;
  } {
    const riskScore = this.evaluate(task);

    // 关键风险任务默认阻止（除非已有审批）
    if (riskScore.level === "critical" && this.config.stopOnCritical && !task.human_approval) {
      return {
        allowed: false,
        reason: `Critical risk task blocked: ${riskScore.reason}`,
        riskScore,
      };
    }

    // 高风险任务需要审批
    if (riskScore.needsApproval && !task.human_approval) {
      return {
        allowed: false,
        reason: `High risk task requires approval: ${riskScore.reason}`,
        riskScore,
      };
    }

    return {
      allowed: true,
      reason: "Risk check passed",
      riskScore,
    };
  }

  /**
   * 审批任务（用于高风险任务）
   */
  approve(taskId: string, approvedBy: string = "system"): void {
    this.historicalRisks.push({
      taskId,
      riskScore: 1.0,
      wasApproved: true,
      approvedBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 记录任务风险评估
   */
  recordRisk(entry: RiskHistoryEntry): void {
    this.historicalRisks.push(entry);

    // 限制历史记录数量
    if (this.historicalRisks.length > this.config.maxHistoricalRiskScore) {
      this.historicalRisks = this.historicalRisks.slice(-this.config.maxHistoricalRiskScore);
    }
  }

  /**
   * 获取历史风险记录
   */
  getHistory(taskId?: string): RiskHistoryEntry[] {
    if (taskId) {
      return this.historicalRisks.filter(e => e.taskId === taskId);
    }
    return [...this.historicalRisks];
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.historicalRisks = [];
  }

  /**
   * 批量评估多个任务
   */
  evaluateAll(tasks: CodexPmTask[]): RiskScore[] {
    return tasks.map(task => this.evaluate(task));
  }

  /**
   * 获取需要审批的任务
   */
  getTasksNeedingApproval(tasks: CodexPmTask[]): CodexPmTask[] {
    return tasks.filter(task => {
      const score = this.evaluate(task);
      return score.needsApproval;
    });
  }

  /**
   * 格式化风险报告
   */
  formatRiskReport(task: CodexPmTask): string {
    const score = this.evaluate(task);
    const lines: string[] = [];

    lines.push(`=== Risk Assessment: ${task.id} ===`);
    lines.push("");
    lines.push(`Level: ${score.level.toUpperCase()}`);
    lines.push(`Score: ${(score.score * 100).toFixed(1)}%`);
    lines.push(`Approval Required: ${score.needsApproval ? "YES" : "NO"}`);
    lines.push("");
    lines.push("Factors:");
    for (const factor of score.factors) {
      lines.push(
        `  ${factor.name}: ${(factor.contribution * 100).toFixed(1)}% (weight: ${factor.weight})`
      );
      lines.push(`    ${factor.details}`);
    }
    lines.push("");
    lines.push("Reason:");
    lines.push(score.reason);

    return lines.join("\n");
  }

  /**
   * 获取风险统计
   */
  getStats(tasks: CodexPmTask[]): {
    total: number;
    byLevel: Record<RiskLevel, number>;
    needsApproval: number;
    averageScore: number;
  } {
    const scores = this.evaluateAll(tasks);

    const byLevel: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const score of scores) {
      byLevel[score.level]++;
    }

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const averageScore = scores.length > 0 ? totalScore / scores.length : 0;

    return {
      total: tasks.length,
      byLevel,
      needsApproval: scores.filter(s => s.needsApproval).length,
      averageScore,
    };
  }
}
