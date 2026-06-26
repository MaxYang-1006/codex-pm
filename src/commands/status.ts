import { StateManager } from "../core/state-manager.js";
import type { CodexPmTask } from "../types/task.js";

export interface StatusResult {
  success: boolean;
  message: string;
  taskCount: number;
  completedCount: number;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  blockedCount: number;
  statusByArea: Record<string, { total: number; completed: number }>;
  recentTasks: CodexPmTask[];
  lastScanAt?: string;
}

export function runStatus(): StatusResult {
  const manager = new StateManager();

  if (!manager.isInitialized()) {
    return {
      success: false,
      message: "Project not initialized. Run 'codex-pm scan' first.",
      taskCount: 0,
      completedCount: 0,
      pendingCount: 0,
      runningCount: 0,
      failedCount: 0,
      blockedCount: 0,
      statusByArea: {},
      recentTasks: [],
    };
  }

  manager.load();
  const tasks = manager.getTasks();
  const state = manager.getState();

  const completedCount = tasks.filter(t => t.status === "done").length;
  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const runningCount = tasks.filter(t => t.status === "running").length;
  const failedCount = tasks.filter(t => t.status === "failed").length;
  const blockedCount = tasks.filter(t => t.status === "blocked" || t.locked).length;

  const statusByArea: Record<string, { total: number; completed: number }> = {};
  for (const task of tasks) {
    if (!statusByArea[task.area]) {
      statusByArea[task.area] = { total: 0, completed: 0 };
    }
    statusByArea[task.area].total++;
    if (task.status === "done") {
      statusByArea[task.area].completed++;
    }
  }

  const recentTasks = tasks
    .filter(t => t.status !== "pending")
    .sort((a, b) => {
      const aTime = a.updated_at || a.title;
      const bTime = b.updated_at || b.title;
      return aTime > bTime ? -1 : 1;
    })
    .slice(0, 5);

  return {
    success: true,
    message: `Project status for ${state.project_id}`,
    taskCount: tasks.length,
    completedCount,
    pendingCount,
    runningCount,
    failedCount,
    blockedCount,
    statusByArea,
    recentTasks,
    lastScanAt: state.last_scan_at,
  };
}

export function formatStatusOutput(result: StatusResult): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push("=== Codex PM Status ===");
    lines.push("");
    lines.push(`✗ ${result.message}`);
    return lines.join("\n");
  }

  lines.push("=== Codex PM Status ===");
  lines.push("");

  const progressBar = createProgressBar(result.completedCount, result.taskCount);
  lines.push(
    `Progress: ${progressBar} ${result.completedCount}/${result.taskCount} (${result.pendingCount} pending)`
  );
  lines.push("");

  lines.push("Task Status:");
  lines.push(`  ✓ Completed: ${result.completedCount}`);
  lines.push(`  ○ Pending:  ${result.pendingCount}`);
  lines.push(`  ⟳ Running:  ${result.runningCount}`);
  lines.push(`  ✗ Failed:   ${result.failedCount}`);
  lines.push(`  ⊘ Blocked:  ${result.blockedCount}`);
  lines.push("");

  if (Object.keys(result.statusByArea).length > 0) {
    lines.push("Progress by Area:");
    for (const [area, stats] of Object.entries(result.statusByArea)) {
      const percentage = Math.round((stats.completed / stats.total) * 100);
      lines.push(`  ${area}: ${stats.completed}/${stats.total} (${percentage}%)`);
    }
    lines.push("");
  }

  if (result.recentTasks.length > 0) {
    lines.push("Recent Activity:");
    for (const task of result.recentTasks) {
      const statusIcon = getStatusIcon(task.status);
      lines.push(`  ${statusIcon} ${task.id}: ${task.title} (${task.status})`);
    }
    lines.push("");
  }

  if (result.lastScanAt) {
    lines.push(`Last scan: ${new Date(result.lastScanAt).toLocaleString()}`);
  }

  return lines.join("\n");
}

function createProgressBar(completed: number, total: number): string {
  const width = 20;
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "done":
      return "✓";
    case "running":
      return "⟳";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    case "needs_approval":
      return "⚠";
    case "needs_review":
      return "?";
    default:
      return "○";
  }
}
