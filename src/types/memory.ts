export type MemoryStatus =
  | "active"
  | "archived"
  | "discarded"
  | "superseded"
  | "invalid"
  | "rejected_by_user";

export interface MemoryRecord {
  id: string;
  type: "project" | "task" | "risk" | "prompt" | "decision" | "negative" | "lesson";
  status: MemoryStatus;
  content: string;
  source_task_id?: string;
  importance: number;
  utility: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}
