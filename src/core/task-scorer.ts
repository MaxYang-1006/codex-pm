import type { CodexPmTask } from "../types/task.js";
import type { TaskScore } from "../types/state.js";

export interface ScorerConfig {
  priorityWeight: number;
  unlockWeight: number;
  riskPenaltyLow: number;
  riskPenaltyMedium: number;
  riskPenaltyHigh: number;
  riskPenaltyCritical: number;
  sizePenaltyXS: number;
  sizePenaltyS: number;
  sizePenaltyM: number;
  sizePenaltyL: number;
  sizePenaltyXL: number;
  failurePenalty: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: ScorerConfig = {
  priorityWeight: 10,
  unlockWeight: 5,
  riskPenaltyLow: 0,
  riskPenaltyMedium: -2,
  riskPenaltyHigh: -5,
  riskPenaltyCritical: -10,
  sizePenaltyXS: 0,
  sizePenaltyS: 0,
  sizePenaltyM: -1,
  sizePenaltyL: -2,
  sizePenaltyXL: -4,
  failurePenalty: -3,
  maxRetries: 2,
};

export class TaskScorer {
  private config: ScorerConfig;

  constructor(config: Partial<ScorerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getRunnableTasks(tasks: CodexPmTask[]): CodexPmTask[] {
    const completedTaskIds = new Set(tasks.filter(t => t.status === "done").map(t => t.id));

    return tasks.filter(task => {
      if (task.status !== "pending") {
        return false;
      }

      if (task.locked) {
        return false;
      }

      for (const dep of task.depends_on) {
        if (!completedTaskIds.has(dep)) {
          return false;
        }
      }

      return true;
    });
  }

  countUnlockedTasks(task: CodexPmTask, allTasks: CodexPmTask[]): number {
    return allTasks.filter(t => t.depends_on.includes(task.id)).length;
  }

  scoreTask(task: CodexPmTask, allTasks: CodexPmTask[]): TaskScore {
    const unlockedCount = this.countUnlockedTasks(task, allTasks);

    const priorityScore = task.priority * this.config.priorityWeight;
    const unlockScore = unlockedCount * this.config.unlockWeight;

    const riskPenalty = this.getRiskPenalty(task.risk);
    const sizePenalty = this.getSizePenalty(task.size);

    let failurePenalty = 0;
    if (task.retry_count !== undefined && task.retry_count > 0) {
      failurePenalty = task.retry_count * this.config.failurePenalty;
    }

    const totalScore = priorityScore + unlockScore + riskPenalty + sizePenalty + failurePenalty;

    const breakdown = {
      priority: priorityScore,
      unlock_count: unlockScore,
      risk_penalty: riskPenalty,
      size_penalty: sizePenalty,
      failure_penalty: failurePenalty,
    };

    const reason = this.buildReason(task, unlockedCount, breakdown);

    return {
      task_id: task.id,
      score: totalScore,
      breakdown,
      reason,
    };
  }

  scoreAllTasks(tasks: CodexPmTask[]): TaskScore[] {
    const runnableTasks = this.getRunnableTasks(tasks);
    const scores = runnableTasks.map(task => this.scoreTask(task, tasks));

    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  selectNextTask(tasks: CodexPmTask[]): TaskScore | null {
    const scores = this.scoreAllTasks(tasks);
    return scores.length > 0 ? scores[0] : null;
  }

  private getRiskPenalty(risk: string): number {
    switch (risk) {
      case "low":
        return this.config.riskPenaltyLow;
      case "medium":
        return this.config.riskPenaltyMedium;
      case "high":
        return this.config.riskPenaltyHigh;
      case "critical":
        return this.config.riskPenaltyCritical;
      default:
        return 0;
    }
  }

  private getSizePenalty(size: string): number {
    switch (size) {
      case "XS":
        return this.config.sizePenaltyXS;
      case "S":
        return this.config.sizePenaltyS;
      case "M":
        return this.config.sizePenaltyM;
      case "L":
        return this.config.sizePenaltyL;
      case "XL":
        return this.config.sizePenaltyXL;
      default:
        return 0;
    }
  }

  private buildReason(
    task: CodexPmTask,
    unlockedCount: number,
    breakdown: TaskScore["breakdown"]
  ): string {
    const parts: string[] = [];

    parts.push(`priority=${task.priority}(${breakdown.priority})`);

    if (unlockedCount > 0) {
      parts.push(`unlocks=${unlockedCount}(+${breakdown.unlock_count})`);
    }

    if (breakdown.risk_penalty !== 0) {
      parts.push(`risk=${task.risk}(${breakdown.risk_penalty})`);
    }

    if (breakdown.size_penalty !== 0) {
      parts.push(`size=${task.size}(${breakdown.size_penalty})`);
    }

    if (breakdown.failure_penalty !== 0) {
      parts.push(`retries=${task.retry_count}(${breakdown.failure_penalty})`);
    }

    return parts.join(", ");
  }
}
