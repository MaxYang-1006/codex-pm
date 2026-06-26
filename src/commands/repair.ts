import { StateManager } from "../core/state-manager.js";
import { RepairBuilder } from "../core/repair-builder.js";
import { ResultWriter, ExecutionResult } from "../core/result-writer.js";
import { CodexExecutor } from "../core/codex-executor.js";
import { Verifier } from "../core/verifier.js";
import type { CodexPmTask } from "../types/task.js";
import type { VerificationResult } from "../types/state.js";

export interface RepairResult {
  success: boolean;
  message: string;
  task?: CodexPmTask;
  promptPath?: string;
  dryRun: boolean;
  executionResult?: ExecutionResult;
}

/**
 * 查找最近失败的任务
 */
function findFailedTask(manager: StateManager, taskId?: string): CodexPmTask | null {
  manager.load();
  const tasks = manager.getTasks();

  if (taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task && (task.status === "failed" || task.status === "needs_review")) {
      return task;
    }
    return null;
  }

  // 查找最近失败的任务（按重试次数排序，重试次数多的优先）
  const failedTasks = tasks.filter(
    t =>
      t.status === "failed" ||
      t.status === "needs_review" ||
      (t.status === "pending" && t.retry_count && t.retry_count > 0)
  );

  if (failedTasks.length === 0) {
    return null;
  }

  // 按重试次数排序，重试次数最多的优先
  failedTasks.sort((a, b) => (b.retry_count || 0) - (a.retry_count || 0));
  return failedTasks[0];
}

/**
 * 执行 repair 命令
 */
export async function runRepair(taskId?: string, dryRun: boolean = false): Promise<RepairResult> {
  const manager = new StateManager();

  if (!manager.isInitialized()) {
    return {
      success: false,
      message: "Project not initialized. Run 'codex-pm scan' first.",
      dryRun,
    };
  }

  // 查找失败任务
  const task = findFailedTask(manager, taskId);

  if (!task) {
    return {
      success: false,
      message: taskId
        ? `Task '${taskId}' is not in a failed or needs_review state.`
        : "No failed tasks found to repair.",
      dryRun,
    };
  }

  // 检查是否超过最大重试次数
  if (task.retry_count && task.retry_count >= task.max_retries) {
    return {
      success: false,
      message: `Task '${task.id}' has exceeded maximum retries (${task.retry_count}/${task.max_retries}).`,
      task,
      dryRun,
    };
  }

  // 获取失败历史记录
  const writer = new ResultWriter();
  const failureHistory = writer.getTaskRuns(task.id);
  const lastFailure =
    failureHistory.length > 0 ? failureHistory[failureHistory.length - 1] : undefined;

  // 构建修复提示词
  const builder = new RepairBuilder();
  const prompt = builder.buildRepairPrompt({
    task,
    failureHistory,
    lastFailure,
    maxRetries: task.max_retries,
  });

  const promptPath = builder.saveRepairPrompt(task.id, prompt);

  if (dryRun) {
    return {
      success: true,
      message: `Dry-run completed for task '${task.id}'. Repair prompt generated.`,
      task,
      promptPath,
      dryRun,
    };
  }

  const runId = manager.addTaskRun(task.id);

  // 执行修复
  const executor = new CodexExecutor();
  const executionResult = await executor.execute({
    dryRun: false,
    promptFile: promptPath,
  });

  // 将执行结果转换为 ExecutionResult 格式
  const execResult: ExecutionResult = {
    success: executionResult.success,
    stdout: executionResult.stdout,
    stderr: executionResult.stderr,
    exitCode: executionResult.exitCode,
    duration: executionResult.duration,
    error: executionResult.error,
  };

  // 如果执行成功，运行验证命令
  let verificationResults: VerificationResult[] = [];
  if (execResult.success && task.verify.length > 0) {
    const verifier = new Verifier();
    verificationResults = await verifier.verifyCommands(task.verify);

    // 检查验证是否全部通过
    const allPassed = verificationResults.every(result => result.success);
    if (!allPassed) {
      execResult.success = false;
      execResult.error = "Verification failed";
    }
  }

  // 写入结果和审计日志
  const runRetryCount = execResult.success ? task.retry_count || 0 : (task.retry_count || 0) + 1;
  const verificationPassed =
    execResult.success &&
    (verificationResults.length === 0 || verificationResults.every(result => result.success));
  const resultPath = writer.writeTaskResult(task.id, execResult, {
    runId,
    promptPath,
    commandsRun: ["codex exec", ...task.verify],
    verificationResults,
    retryCount: runRetryCount,
  });
  writer.appendAuditLog(task.id, execResult, {
    runId,
    resultPath,
    promptPath,
    verificationResults,
    retryCount: runRetryCount,
  });
  manager.updateTaskRun(runId, {
    completed_at: new Date().toISOString(),
    status: execResult.success ? "completed" : "failed",
    success: execResult.success,
    result_path: resultPath,
    prompt_path: promptPath,
    verification_results: verificationResults,
    verification_passed: verificationPassed,
    retry_count: runRetryCount,
    duration_ms: execResult.duration,
    exit_code: execResult.exitCode,
    error_message: execResult.error,
  });

  // 更新任务状态
  writer.updateTaskState(task, execResult, manager);
  manager.save();

  return {
    success: execResult.success,
    message: execResult.success
      ? `Repair for task '${task.id}' completed successfully`
      : `Repair for task '${task.id}' failed: ${execResult.error || "Unknown error"}`,
    task,
    promptPath,
    dryRun: false,
    executionResult: execResult,
  };
}

/**
 * 格式化 repair 命令输出
 */
export function formatRepairOutput(result: RepairResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Repair ===");
  lines.push("");

  if (!result.success) {
    lines.push(`✗ ${result.message}`);
    if (result.task) {
      lines.push("");
      lines.push("Task:");
      lines.push(`  ID:    ${result.task.id}`);
      lines.push(`  Title: ${result.task.title}`);
    }
    return lines.join("\n");
  }

  if (result.dryRun) {
    lines.push("Mode: DRY-RUN (prompt only, no execution)");
    lines.push("");
  } else {
    lines.push("Mode: EXECUTION");
    lines.push("");
  }

  if (result.task) {
    lines.push("Repairing Task:");
    lines.push(`  ID:       ${result.task.id}`);
    lines.push(`  Title:    ${result.task.title}`);
    lines.push(`  Status:   ${result.task.status}`);
    lines.push(`  Retries:  ${result.task.retry_count || 0}/${result.task.max_retries}`);
    lines.push("");
  }

  if (result.promptPath) {
    lines.push("Repair Prompt:");
    lines.push(`  ${result.promptPath}`);
    lines.push("");
  }

  if (result.executionResult && !result.dryRun) {
    lines.push("Execution Result:");
    lines.push(`  Status:    ${result.executionResult.success ? "SUCCESS" : "FAILED"}`);
    lines.push(`  Exit Code: ${result.executionResult.exitCode ?? "N/A"}`);
    lines.push(`  Duration:  ${result.executionResult.duration}ms`);

    if (result.executionResult.error) {
      lines.push(`  Error:     ${result.executionResult.error}`);
    }
    lines.push("");

    if (result.executionResult.stdout) {
      lines.push("stdout:");
      const stdoutLines = result.executionResult.stdout.split("\n");
      for (const line of stdoutLines.slice(0, 10)) {
        lines.push(`  ${line}`);
      }
      if (stdoutLines.length > 10) {
        lines.push(`  ... (${stdoutLines.length - 10} more lines)`);
      }
      lines.push("");
    }

    if (result.executionResult.stderr) {
      lines.push("stderr:");
      const stderrLines = result.executionResult.stderr.split("\n");
      for (const line of stderrLines.slice(0, 10)) {
        lines.push(`  ${line}`);
      }
      if (stderrLines.length > 10) {
        lines.push(`  ... (${stderrLines.length - 10} more lines)`);
      }
      lines.push("");
    }
  }

  lines.push(result.message);

  return lines.join("\n");
}
