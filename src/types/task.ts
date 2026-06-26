export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "blocked"
  | "needs_approval"
  | "needs_review"
  | "locked";
export type TaskRisk = "low" | "medium" | "high" | "critical";
export type TaskSize = "XS" | "S" | "M" | "L" | "XL";

export interface CodexPmTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  risk: TaskRisk;
  size: TaskSize;
  area: string;
  depends_on: string[];
  human_approval: boolean;
  locked: boolean;
  description: string;
  files_hint: string[];
  acceptance: string[];
  verify: string[];
  blocked_rules: string[];
  retry_count: number;
  max_retries: number;
  updated_at?: string;
}
