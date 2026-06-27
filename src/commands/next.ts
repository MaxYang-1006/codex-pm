import { StateManager } from "../core/state-manager.js";
import { TaskScorer } from "../core/task-scorer.js";
import { TaskGraph } from "../core/task-graph.js";
import type { TaskScore } from "../types/state.js";
import type { CodexPmTask } from "../types/task.js";

export type NextMode = "smart" | "sequential";

export interface NextResult {
  success: boolean;
  message: string;
  selectedTask?: TaskScore;
  alternativeTasks?: TaskScore[];
  totalRunnable: number;
  totalPending: number;
  mode: NextMode;
}

export function runNext(maxResults: number = 3, mode: NextMode = "smart"): NextResult {
  const manager = new StateManager();

  if (!manager.isInitialized()) {
    return {
      success: false,
      message: "Project not initialized. Run 'codex-pm scan' first.",
      totalRunnable: 0,
      totalPending: 0,
      mode,
    };
  }

  manager.load();
  const tasks = manager.getTasks();

  let allScores: TaskScore[];

  if (mode === "sequential") {
    allScores = scoreSequential(tasks);
  } else {
    const scorer = new TaskScorer();
    allScores = scorer.scoreAllTasks(tasks);
  }

  const totalRunnable = allScores.length;
  const totalPending = tasks.filter(t => t.status === "pending").length;

  if (allScores.length === 0) {
    return {
      success: true,
      message: "No runnable tasks found.",
      totalRunnable: 0,
      totalPending,
      mode,
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
    mode,
  };
}

function scoreSequential(tasks: CodexPmTask[]): TaskScore[] {
  const graph = new TaskGraph(tasks);
  const runnable = graph.getRunnableTasks();

  return runnable.map(task => ({
    task_id: task.id,
    title: task.title,
    score: 0,
    reason: "Sequential mode: ordered by priority and task ID",
    breakdown: {
      priority: task.priority,
      unlock_count: 0,
      risk_penalty: 0,
      size_penalty: 0,
      failure_penalty: 0,
    },
  })).sort((a, b) => {
    if (b.breakdown.priority !== a.breakdown.priority) {
      return b.breakdown.priority - a.breakdown.priority;
    }
    return a.task_id.localeCompare(b.task_id);
  });
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

  lines.push(`Mode: ${result.mode === "smart" ? "Smart Scoring" : "Sequential"}`);
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