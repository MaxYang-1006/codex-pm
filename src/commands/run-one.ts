import { StateManager } from "../core/state-manager.js";
import { TaskScorer } from "../core/task-scorer.js";
import { PromptBuilder } from "../core/prompt-builder.js";
import { CodexExecutor, type CodexSandboxMode } from "../core/codex-executor.js";
import { Verifier } from "../core/verifier.js";
import { ResultWriter, ExecutionResult } from "../core/result-writer.js";
import { RiskGate } from "../core/risk-gate.js";
import { ensureDirectoryExists } from "../core/file-utils.js";
import { confirm } from "../core/interactive-prompt.js";
import type { CodexPmTask } from "../types/task.js";
import type { VerificationResult } from "../types/state.js";
import * as path from "path";

export interface RunOneResult {
  success: boolean;
  message: string;
  task?: CodexPmTask;
  promptPath?: string;
  dryRun: boolean;
  executionResult?: ExecutionResult;
  verificationResults?: VerificationResult[];
}

export interface RunOneOptions {
  taskId?: string;
  dryRun?: boolean;
  baseDir?: string;
  sandbox?: CodexSandboxMode;
  codexExtraArgs?: string[];
  interactive?: boolean;
}

export async function runRunOne(options: RunOneOptions): Promise<RunOneResult> {
  const normalized = normalizeRunOneOptions(options);
  const { taskId, dryRun, baseDir, sandbox, codexExtraArgs, interactive } = normalized;
  const manager = new StateManager(baseDir);

  if (!manager.isInitialized()) {
    return {
      success: false,
      message: "Project not initialized. Run 'codex-pm scan' first.",
      dryRun,
    };
  }

  manager.load();
  const tasks = manager.getTasks();
  const scorer = new TaskScorer();

  let selectedTask: CodexPmTask | undefined;

  if (taskId) {
    selectedTask = tasks.find(t => t.id === taskId);

    if (!selectedTask) {
      return {
        success: false,
        message: `Task '${taskId}' not found in task list.`,
        dryRun,
      };
    }

    if (selectedTask.status !== "pending") {
      return {
        success: false,
        message: `Task '${taskId}' is not in 'pending' status (current: ${selectedTask.status}).`,
        dryRun,
      };
    }

    const runnableTasks = scorer.getRunnableTasks(tasks);
    if (!runnableTasks.some(t => t.id === taskId)) {
      return {
        success: false,
        message: `Task '${taskId}' cannot be run (dependencies not met or task is locked).`,
        dryRun,
      };
    }
  } else {
    const nextTask = scorer.selectNextTask(tasks);

    if (!nextTask) {
      return {
        success: false,
        message: "No runnable tasks found. All tasks may be completed or blocked.",
        dryRun,
      };
    }

    selectedTask = tasks.find(t => t.id === nextTask.task_id);
  }

  if (!selectedTask) {
    return {
      success: false,
      message: "Failed to select task.",
      dryRun,
    };
  }

  // 应用风险门检查
  const riskGate = new RiskGate();
  const riskGateResult = riskGate.canRun(selectedTask);
  if (!riskGateResult.allowed) {
    // 交互式模式下询问用户是否批准
    if (interactive && !dryRun) {
      const approved = await promptInteractiveApproval(selectedTask, riskGate);
      if (!approved) {
        return {
          success: false,
          message: "Task rejected by user in interactive mode",
          task: selectedTask,
          dryRun,
        };
      }
      // 用户批准后继续执行
    } else {
      return {
        success: false,
        message: `Risk gate blocked task execution: ${riskGateResult.reason}`,
        task: selectedTask,
        dryRun,
      };
    }
  }

  // 构建 prompt
  const builder = new PromptBuilder({ baseDir });
  const docIndex = manager.getDocIndex();

  const relevantDocs = docIndex.filter(doc => {
    const lowerFilename = doc.filename.toLowerCase();
    const lowerTitle = selectedTask.title.toLowerCase();
    return lowerFilename.includes(lowerTitle.split(" ")[0]) || doc.filename.includes("TASKS");
  });

  const prompt = builder.buildPrompt({
    task: selectedTask,
    docs: relevantDocs,
  });

  const promptPath = builder.savePrompt(selectedTask.id, prompt);

  if (dryRun) {
    return {
      success: true,
      message: `Dry-run completed for task '${selectedTask.id}'`,
      task: selectedTask,
      promptPath,
      dryRun,
    };
  }

  const runId = manager.addTaskRun(selectedTask.id);
  const resultsDir = path.join(baseDir, "results");
  ensureDirectoryExists(resultsDir);

  // 执行 Codex
  const executor = new CodexExecutor();
  const executionResult = await executor.execute({
    dryRun: false,
    promptFile: promptPath,
    extraArgs: codexExtraArgs,
    sandbox,
    resultFile: path.join(resultsDir, `${runId}-codex-output.json`),
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
  if (execResult.success && selectedTask.verify.length > 0) {
    const verifier = new Verifier();
    verificationResults = await verifier.verifyCommands(selectedTask.verify);

    // 检查验证是否全部通过
    const allPassed = verificationResults.every(result => result.success);
    if (!allPassed) {
      execResult.success = false;
      execResult.error = "Verification failed";
    }
  }

  // 写入结果和审计日志
  const writer = new ResultWriter({
    baseDir,
    resultsDir,
    auditLogPath: path.join(baseDir, "task-runs.jsonl"),
  });
  const runRetryCount = execResult.success
    ? selectedTask.retry_count || 0
    : (selectedTask.retry_count || 0) + 1;
  const verificationPassed =
    execResult.success &&
    (verificationResults.length === 0 || verificationResults.every(result => result.success));
  const completedAt = new Date().toISOString();
  const commandsRun = ["codex exec", ...selectedTask.verify];
  const resultPath = writer.writeTaskResult(selectedTask.id, execResult, {
    runId,
    promptPath,
    commandsRun,
    verificationResults,
    retryCount: runRetryCount,
  });
  writer.appendAuditLog(selectedTask.id, execResult, {
    runId,
    resultPath,
    promptPath,
    verificationResults,
    retryCount: runRetryCount,
  });
  manager.updateTaskRun(runId, {
    completed_at: completedAt,
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
  writer.updateTaskState(selectedTask, execResult, manager);

  // 保存状态
  manager.save();

  return {
    success: execResult.success,
    message: execResult.success
      ? `Task '${selectedTask.id}' completed successfully`
      : `Task '${selectedTask.id}' failed: ${execResult.error || "Unknown error"}`,
    task: selectedTask,
    promptPath,
    dryRun: false,
    executionResult: execResult,
    verificationResults,
  };
}

function normalizeRunOneOptions(
  options: RunOneOptions
): Required<Pick<RunOneOptions, "dryRun" | "baseDir" | "sandbox" | "codexExtraArgs" | "interactive">> &
  Pick<RunOneOptions, "taskId"> {
  return {
    taskId: options.taskId,
    dryRun: options.dryRun ?? false,
    baseDir: options.baseDir ?? ".codex-pm",
    sandbox: options.sandbox ?? "workspace-write",
    codexExtraArgs: options.codexExtraArgs ?? [],
    interactive: options.interactive ?? false,
  };
}

/**
 * 交互式询问用户是否批准高风险任务
 */
async function promptInteractiveApproval(
  task: CodexPmTask,
  riskGate: RiskGate
): Promise<boolean> {
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
    question: "Approve this high-risk task?",
    default: false,
    details,
  });

  return approved;
}

export function formatRunOneOutput(result: RunOneResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Run-One ===");
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
    lines.push("Selected Task:");
    lines.push(`  ID:       ${result.task.id}`);
    lines.push(`  Title:    ${result.task.title}`);
    lines.push(`  Priority: ${result.task.priority}`);
    lines.push(`  Risk:     ${result.task.risk}`);
    lines.push(`  Size:     ${result.task.size}`);
    lines.push(`  Area:     ${result.task.area}`);
    lines.push("");

    if (result.task.description) {
      lines.push("Description:");
      lines.push(`  ${result.task.description}`);
      lines.push("");
    }

    if (result.task.files_hint.length > 0) {
      lines.push("Files to modify:");
      for (const file of result.task.files_hint) {
        lines.push(`  - ${file}`);
      }
      lines.push("");
    }

    if (result.task.acceptance.length > 0) {
      lines.push("Acceptance criteria:");
      for (const criteria of result.task.acceptance) {
        lines.push(`  - ${criteria}`);
      }
      lines.push("");
    }
  }

  if (result.promptPath) {
    lines.push("Prompt file:");
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

  if (result.verificationResults && result.verificationResults.length > 0) {
    lines.push("Verification Results:");
    for (let i = 0; i < result.verificationResults.length; i++) {
      const verifResult = result.verificationResults[i];
      const statusIcon = verifResult.success ? "✓" : "✗";
      lines.push(`  ${statusIcon} ${verifResult.command}`);
      if (!verifResult.success && verifResult.stderr) {
        lines.push(`      Error: ${verifResult.stderr.substring(0, 100)}`);
      }
    }
    lines.push("");
  }

  lines.push(result.message);

  return lines.join("\n");
}
