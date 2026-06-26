import { StateManager } from "../core/state-manager.js";
import { TaskScorer } from "../core/task-scorer.js";
import type { TaskScore } from "../types/state.js";

export interface NextResult {
  success: boolean;
  message: string;
  selectedTask?: TaskScore;
  alternativeTasks?: TaskScore[];
  totalRunnable: number;
  totalPending: number;
}

export function runNext(maxResults: number = 3): NextResult {
  const manager = new StateManager();

  if (!manager.isInitialized()) {
    return {
      success: false,
      message: "Project not initialized. Run 'codex-pm scan' first.",
      totalRunnable: 0,
      totalPending: 0,
    };
  }

  manager.load();
  const tasks = manager.getTasks();
  const scorer = new TaskScorer();

  const allScores = scorer.scoreAllTasks(tasks);
  const totalRunnable = allScores.length;
  const totalPending = tasks.filter(t => t.status === "pending").length;

  if (allScores.length === 0) {
    return {
      success: true,
      message: "No runnable tasks found.",
      totalRunnable: 0,
      totalPending,
    };
  }

  const selectedTask = allScores[0];
  const alternativeTasks = allScores.slice(1, maxResults);

  return {
    success: true,
    message: "Found next runnable task",
    selectedTask,
    alternativeTasks,
    totalRunnable,
    totalPending,
  };
}

export function formatNextOutput(result: NextResult): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push("=== Codex PM Next ===");
    lines.push("");
    lines.push(`✗ ${result.message}`);
    return lines.join("\n");
  }

  lines.push("=== Codex PM Next ===");
  lines.push("");

  if (!result.selectedTask) {
    lines.push("No runnable tasks at this time.");
    lines.push("");
    lines.push(`Total pending tasks: ${result.totalPending}`);
    if (result.totalPending > 0) {
      lines.push("(Some tasks may be blocked by dependencies)");
    }
    return lines.join("\n");
  }

  const task = result.selectedTask;

  lines.push("Recommended task:");
  lines.push("");
  lines.push(`  ${task.task_id}`);
  lines.push(`  Score: ${task.score}`);
  lines.push(`  Reason: ${task.reason}`);
  lines.push("");

  lines.push("Breakdown:");
  lines.push(`  Priority contribution:  +${task.breakdown.priority}`);
  lines.push(`  Unlock contribution:   +${task.breakdown.unlock_count}`);
  lines.push(`  Risk penalty:         ${task.breakdown.risk_penalty}`);
  lines.push(`  Size penalty:         ${task.breakdown.size_penalty}`);
  lines.push(`  Failure penalty:      ${task.breakdown.failure_penalty}`);
  lines.push("");

  if (result.alternativeTasks && result.alternativeTasks.length > 0) {
    lines.push("Alternative tasks:");
    for (const alt of result.alternativeTasks) {
      lines.push(`  ${alt.task_id} (score: ${alt.score})`);
    }
    lines.push("");
  }

  lines.push(`Runnable tasks: ${result.totalRunnable} / ${result.totalPending} pending`);
  lines.push("");
  lines.push("Run with: codex-pm run-one --task " + task.task_id);

  return lines.join("\n");
}
