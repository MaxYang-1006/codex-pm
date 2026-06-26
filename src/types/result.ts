import type { VerificationResult } from "./state.js";

export interface TaskResult {
  task_id: string;
  run_id: string;
  status: "completed" | "blocked" | "failed" | "needs_review" | "needs_approval";
  changed_files: string[];
  commands_run: string[];
  verification_passed: boolean;
  verification_results: VerificationResult[];
  risks: string[];
  blockers: string[];
  prompt_path?: string;
  written_at: string;
  execution: {
    success: boolean;
    exit_code: number | null;
    duration_ms: number;
    stdout: string;
    stderr: string;
    error?: string;
  };
  reward?: number;
  penalty?: number;
}
