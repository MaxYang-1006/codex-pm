import * as fs from "fs";
import * as path from "path";
import type { CodexPmTask } from "../types/task.js";
import type { TaskResult } from "../types/result.js";
import type { TaskRunEntry, VerificationResult } from "../types/state.js";
import { ensureDirectoryExists } from "./file-utils.js";

/**
 * Codex 执行结果接口
 */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  error?: string;
  needsReview?: boolean;
}

export type AuditLogEntry = TaskRunEntry;

export interface TaskRunMetadata {
  runId?: string;
  startedAt?: string;
  completedAt?: string;
  resultPath?: string;
  promptPath?: string;
  verificationResults?: VerificationResult[];
  retryCount?: number;
  riskIncident?: boolean;
  reward?: number;
  penalty?: number;
  changedFiles?: string[];
  commandsRun?: string[];
  risks?: string[];
  blockers?: string[];
}

export interface ResultWriterOptions {
  baseDir?: string;
  resultsDir?: string;
  auditLogPath?: string;
}

export class ResultWriter {
  private baseDir: string;
  private resultsDir: string;
  private auditLogPath: string;

  constructor(options: ResultWriterOptions = {}) {
    this.baseDir = options.baseDir || ".codex-pm";
    this.resultsDir = options.resultsDir || `${this.baseDir}/results`;
    this.auditLogPath = options.auditLogPath || `${this.baseDir}/task-runs.jsonl`;
  }

  /**
   * 写入结构化任务结果
   */
  writeTaskResult(
    taskId: string,
    executionResult: ExecutionResult,
    metadata?: TaskRunMetadata
  ): string {
    ensureDirectoryExists(this.resultsDir);

    const runId = metadata?.runId || this.createRunId(taskId);
    const filename = `${runId}.json`;
    const filepath = path.join(this.resultsDir, filename);
    const verificationResults = metadata?.verificationResults || [];

    const output: TaskResult = {
      task_id: taskId,
      run_id: runId,
      status: this.getTerminalStatus(executionResult),
      changed_files: metadata?.changedFiles || [],
      commands_run: metadata?.commandsRun || [],
      verification_passed: this.didVerificationPass(executionResult, verificationResults),
      verification_results: verificationResults,
      risks: metadata?.risks || [],
      blockers: metadata?.blockers || [],
      prompt_path: metadata?.promptPath,
      written_at: new Date().toISOString(),
      execution: {
        success: executionResult.success,
        exit_code: executionResult.exitCode,
        duration_ms: executionResult.duration,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr,
        error: executionResult.error,
      },
      reward: metadata?.reward,
      penalty: metadata?.penalty,
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf-8");

    return filepath;
  }

  /**
   * 追加 JSONL 审计日志
   */
  appendAuditLog(
    taskId: string,
    executionResult: ExecutionResult,
    runIdOrMetadata?: string | TaskRunMetadata
  ): void {
    ensureDirectoryExists(this.baseDir);

    const metadata = this.normalizeMetadata(runIdOrMetadata);
    const now = new Date().toISOString();
    const verificationResults = metadata.verificationResults || [];

    const auditEntry: AuditLogEntry = {
      task_id: taskId,
      run_id: metadata.runId || this.createRunId(taskId),
      started_at: metadata.startedAt || now,
      completed_at: metadata.completedAt || now,
      status: this.getStatus(executionResult),
      success: executionResult.success,
      result_path: metadata.resultPath,
      prompt_path: metadata.promptPath,
      verification_results: verificationResults,
      verification_passed: this.didVerificationPass(executionResult, verificationResults),
      retry_count: metadata.retryCount ?? 0,
      risk_incident: metadata.riskIncident ?? false,
      duration_ms: executionResult.duration,
      exit_code: executionResult.exitCode,
      error_message: executionResult.error,
      reward: metadata.reward,
      penalty: metadata.penalty,
    };

    const line = JSON.stringify(auditEntry);
    fs.appendFileSync(this.auditLogPath, line + "\n", "utf-8");
  }

  /**
   * 更新任务状态
   */
  updateTaskState(
    task: CodexPmTask,
    executionResult: ExecutionResult,
    manager: { updateTask: (id: string, updates: Partial<CodexPmTask>) => boolean }
  ): CodexPmTask {
    const updates: Partial<CodexPmTask> = {};

    if (executionResult.success) {
      updates.status = "done";
      updates.retry_count = 0; // 重置重试计数
    } else {
      // 检查是否需要人工审查
      if (executionResult.needsReview) {
        updates.status = "needs_review";
      } else {
        // 增加重试计数
        const newRetryCount = (task.retry_count || 0) + 1;
        updates.retry_count = newRetryCount;

        // 检查是否超过最大重试次数
        if (newRetryCount >= task.max_retries) {
          updates.status = "failed";
        } else {
          updates.status = "pending"; // 保持待处理状态以供重试
        }
      }
    }

    // 更新任务
    manager.updateTask(task.id, updates);

    // 返回更新后的任务
    return { ...task, ...updates } as CodexPmTask;
  }

  /**
   * 读取审计日志
   */
  readAuditLog(limit?: number): AuditLogEntry[] {
    if (!fs.existsSync(this.auditLogPath)) {
      return [];
    }

    const content = fs.readFileSync(this.auditLogPath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim() !== "");

    const entries = lines
      .map(line => {
        try {
          return normalizeTaskRunEntry(JSON.parse(line));
        } catch {
          return null;
        }
      })
      .filter(entry => entry !== null) as AuditLogEntry[];

    if (limit) {
      return entries.slice(-limit);
    }

    return entries;
  }

  /**
   * 获取任务的所有运行记录
   */
  getTaskRuns(taskId: string): AuditLogEntry[] {
    const allRuns = this.readAuditLog();
    return allRuns.filter(entry => entry.task_id === taskId);
  }

  private createRunId(taskId: string): string {
    return `${taskId}-${Date.now()}`;
  }

  private getStatus(executionResult: ExecutionResult): TaskRunEntry["status"] {
    if (executionResult.success) {
      return "completed";
    }
    if (executionResult.needsReview) {
      return "needs_review";
    }
    return "failed";
  }

  private getTerminalStatus(
    executionResult: ExecutionResult
  ): Exclude<TaskRunEntry["status"], "running"> {
    return this.getStatus(executionResult) as Exclude<TaskRunEntry["status"], "running">;
  }

  private didVerificationPass(
    executionResult: ExecutionResult,
    verificationResults: VerificationResult[]
  ): boolean {
    if (!executionResult.success) {
      return false;
    }
    return verificationResults.length === 0 || verificationResults.every(result => result.success);
  }

  private normalizeMetadata(runIdOrMetadata?: string | TaskRunMetadata): TaskRunMetadata {
    if (typeof runIdOrMetadata === "string") {
      return { runId: runIdOrMetadata };
    }
    return runIdOrMetadata || {};
  }

  /**
   * 格式化结果为可读字符串
   */
  static formatExecutionResult(result: ExecutionResult): string {
    const lines: string[] = [];

    lines.push("=== Execution Result ===");
    lines.push("");
    lines.push(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    lines.push(`Exit Code: ${result.exitCode ?? "N/A"}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push("");

    if (result.error) {
      lines.push("Error:");
      lines.push(`  ${result.error}`);
      lines.push("");
    }

    if (result.stdout) {
      lines.push("stdout:");
      lines.push(`  ${result.stdout}`);
      lines.push("");
    }

    if (result.stderr) {
      lines.push("stderr:");
      lines.push(`  ${result.stderr}`);
      lines.push("");
    }

    return lines.join("\n");
  }
}

export function normalizeTaskRunEntry(value: unknown): TaskRunEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.task_id !== "string" || typeof raw.run_id !== "string") {
    return null;
  }

  const status = normalizeStatus(raw.status);
  if (!status) {
    return null;
  }

  const verificationResults = Array.isArray(raw.verification_results)
    ? (raw.verification_results as VerificationResult[])
    : [];
  const success = typeof raw.success === "boolean" ? raw.success : status === "completed";
  const verificationPassed =
    typeof raw.verification_passed === "boolean"
      ? raw.verification_passed
      : success && verificationResults.every(result => result.success);
  const startedAt =
    readString(raw.started_at) || readString(raw.timestamp) || new Date(0).toISOString();
  const completedAt = readString(raw.completed_at) || readString(raw.timestamp);

  return {
    task_id: raw.task_id,
    run_id: raw.run_id,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    success,
    result_path: readString(raw.result_path),
    prompt_path: readString(raw.prompt_path),
    verification_results: verificationResults,
    verification_passed: verificationPassed,
    retry_count: readNumber(raw.retry_count) ?? 0,
    risk_incident: typeof raw.risk_incident === "boolean" ? raw.risk_incident : false,
    // 兼容旧日志里的 duration 字段；新日志统一写 duration_ms。
    duration_ms: readNumber(raw.duration_ms) ?? readNumber(raw.duration) ?? 0,
    exit_code: typeof raw.exit_code === "number" || raw.exit_code === null ? raw.exit_code : null,
    error_message: readString(raw.error_message),
    reward: readNumber(raw.reward),
    penalty: readNumber(raw.penalty),
    timestamp: readString(raw.timestamp),
  };
}

function normalizeStatus(value: unknown): TaskRunEntry["status"] | null {
  if (
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "needs_review"
  ) {
    return value;
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
