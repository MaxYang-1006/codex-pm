import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { StateManager } from "../core/state-manager.js";
import { TaskGraph } from "../core/task-graph.js";
import { TaskScorer } from "../core/task-scorer.js";

export interface ReviewResult {
  success: boolean;
  message: string;
  gitDiff?: string;
  gitStatus?: string;
  changedFiles?: string[];
  taskStatus?: ReviewTaskStatus[];
  hasUncommittedChanges: boolean;
}

export interface ReviewTaskStatus {
  taskId: string;
  title: string;
  status: string;
  risk: string;
  priority: number;
  dependsOn: string[];
  blockers: string[];
}

export async function runReview(): Promise<ReviewResult> {
  const result: ReviewResult = {
    success: true,
    message: "Review completed",
    hasUncommittedChanges: false,
    changedFiles: [],
    taskStatus: [],
  };

  try {
    const gitStatusResult = await runGitCommand("status", ["--short"]);
    result.gitStatus = gitStatusResult.stdout;

    if (gitStatusResult.stdout.trim()) {
      result.hasUncommittedChanges = true;

      const diffResult = await runGitCommand("diff", ["--stat"]);
      result.gitDiff = diffResult.stdout;

      const changedFiles = parseChangedFiles(gitStatusResult.stdout);
      result.changedFiles = changedFiles;
    }

  } catch (err) {
    result.success = false;
    result.message = `Failed to get git status: ${(err as Error).message}`;
    return result;
  }

  try {
    const manager = new StateManager();
    if (!manager.isInitialized()) {
      result.message = "Project not initialized. Run 'codex-pm scan' first.";
      return result;
    }

    manager.load();
    const tasks = manager.getTasks();

    if (tasks.length > 0) {
      const taskStatus = buildTaskStatus(tasks);
      result.taskStatus = taskStatus;
    }

  } catch (err) {
    result.message = `Failed to load task status: ${(err as Error).message}`;
  }

  return result;
}

function parseChangedFiles(statusOutput: string): string[] {
  const lines = statusOutput.trim().split(/\r?\n/);
  const files: string[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      files.push(parts[parts.length - 1]);
    }
  }

  return files;
}

function buildTaskStatus(tasks: any[]): ReviewTaskStatus[] {
  const graph = new TaskGraph(tasks);
  const scorer = new TaskScorer();

  const statusList: ReviewTaskStatus[] = [];

  for (const task of tasks) {
    const blockers = graph.getBlockers(task.id);

    statusList.push({
      taskId: task.id,
      title: task.title,
      status: task.status,
      risk: task.risk,
      priority: task.priority,
      dependsOn: task.depends_on || [],
      blockers,
    });
  }

  return statusList.sort((a, b) => b.priority - a.priority);
}

async function runGitCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn("git", [command, ...args], {
      cwd: process.cwd(),
      windowsVerbatimArguments: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
      });
    });

    child.on("error", (error) => {
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: -1,
      });
    });
  });
}

export function formatReviewOutput(result: ReviewResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Review ===");
  lines.push("");

  if (!result.success) {
    lines.push(`❌ ${result.message}`);
    return lines.join("\n");
  }

  lines.push("1. Git Status");
  lines.push("────────────");

  if (result.hasUncommittedChanges) {
    lines.push("⚠️ Uncommitted changes detected");
    lines.push("");

    if (result.changedFiles && result.changedFiles.length > 0) {
      lines.push("Changed files:");
      for (const file of result.changedFiles) {
        lines.push(`  ${file}`);
      }
      lines.push("");
    }

    if (result.gitDiff) {
      lines.push("Diff summary:");
      lines.push(result.gitDiff);
      lines.push("");
    }
  } else {
    lines.push("✅ Working tree is clean");
    lines.push("");
  }

  if (result.taskStatus && result.taskStatus.length > 0) {
    lines.push("2. Task Status");
    lines.push("─────────────");

    const doneTasks = result.taskStatus.filter(t => t.status === "done");
    const pendingTasks = result.taskStatus.filter(t => t.status === "pending");
    const failedTasks = result.taskStatus.filter(t => t.status === "failed");
    const blockedTasks = result.taskStatus.filter(t => t.blockers.length > 0);

    lines.push(`Total: ${result.taskStatus.length}`);
    lines.push(`  Done: ${doneTasks.length}`);
    lines.push(`  Pending: ${pendingTasks.length}`);
    lines.push(`  Failed: ${failedTasks.length}`);
    lines.push(`  Blocked: ${blockedTasks.length}`);
    lines.push("");

    if (pendingTasks.length > 0) {
      lines.push("Pending tasks:");
      for (const task of pendingTasks.slice(0, 5)) {
        const blockers = task.blockers.length > 0 ? ` (blocked: ${task.blockers.join(", ")})` : "";
        lines.push(`  ${task.taskId} [${task.risk}] (priority: ${task.priority})${blockers}`);
        lines.push(`    ${task.title}`);
      }
      lines.push("");
    }

    if (failedTasks.length > 0) {
      lines.push("Failed tasks:");
      for (const task of failedTasks) {
        lines.push(`  ✗ ${task.taskId}: ${task.title}`);
      }
      lines.push("");
    }

    if (blockedTasks.length > 0) {
      lines.push("Blocked tasks:");
      for (const task of blockedTasks) {
        lines.push(`  ⛔ ${task.taskId}: ${task.title}`);
        lines.push(`    Blocked by: ${task.blockers.join(", ")}`);
      }
      lines.push("");
    }
  } else {
    lines.push("2. Task Status");
    lines.push("─────────────");
    lines.push("No tasks loaded. Run 'codex-pm scan' first.");
    lines.push("");
  }

  lines.push("3. Recommendations");
  lines.push("─────────────────");

  if (result.hasUncommittedChanges) {
    lines.push("⚠️ Commit or stash changes before running tasks");
    lines.push("  git add .");
    lines.push("  git commit -m \"your message\"");
    lines.push("");
  }

  if (result.taskStatus) {
    const pendingWithoutBlockers = result.taskStatus.filter(
      t => t.status === "pending" && t.blockers.length === 0
    );

    if (pendingWithoutBlockers.length > 0) {
      lines.push("✅ Ready to run:");
      for (const task of pendingWithoutBlockers.slice(0, 3)) {
        lines.push(`  codex-pm run-one --task ${task.taskId}`);
      }
    } else if (pendingTasks.length > 0) {
      lines.push("⏳ All pending tasks are blocked by dependencies");
      lines.push("  Review and resolve blocking tasks first");
    } else if (doneTasks.length === result.taskStatus.length) {
      lines.push("🎉 All tasks are completed!");
    }
  }

  return lines.join("\n");
}