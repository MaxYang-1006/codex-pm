import type { CodexPmTask } from "./task.js";
import type { MemoryRecord } from "./memory.js";
import type { PmGenome } from "./genome.js";

export interface ProjectState {
  version: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  tasks: CodexPmTask[];
  active_genome_id: string;
  genomes: PmGenome[];
  memory: MemoryRecord[];
  last_scan_at?: string;
  scan_errors?: string[];
}

export interface DocIndexEntry {
  filename: string;
  path: string;
  hash: string;
  size: number;
  last_modified: string;
}

export interface VerificationResult {
  /** 验证命令 */
  command: string;
  /** 是否成功（exitCode === 0） */
  success: boolean;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number | null;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 错误类型 */
  error?: "timeout" | "not_found" | "execution_error";
  /** 错误消息 */
  errorMessage?: string;
}

export type TaskRunStatus = "running" | "completed" | "failed" | "needs_review";

export interface TaskRunEntry {
  task_id: string;
  run_id: string;
  started_at: string;
  completed_at?: string;
  status: TaskRunStatus;
  success: boolean;
  result_path?: string;
  prompt_path?: string;
  verification_results: VerificationResult[];
  verification_passed: boolean;
  retry_count: number;
  risk_incident: boolean;
  duration_ms: number;
  exit_code: number | null;
  error_message?: string;
  reward?: number;
  penalty?: number;
  /** Legacy audit logs used timestamp before started_at/completed_at. */
  timestamp?: string;
}

export interface CommandOptions {
  dry_run?: boolean;
  verbose?: boolean;
  task_id?: string;
  max_tasks?: number;
  genome_id?: string;
}

export interface TaskScore {
  task_id: string;
  score: number;
  breakdown: {
    priority: number;
    unlock_count: number;
    risk_penalty: number;
    size_penalty: number;
    failure_penalty: number;
  };
  reason: string;
}
