import type { CodexPmTask, TaskStatus, TaskRisk, TaskSize } from "../types/task.js";

export interface ParseError {
  line_number: number;
  message: string;
  task_id?: string;
}

export interface ParseResult {
  tasks: CodexPmTask[];
  errors: ParseError[];
  warnings: string[];
}

export class TaskParser {
  private lines: string[];
  private currentLine: number = 0;

  constructor(content: string) {
    this.lines = content.split("\n");
  }

  parse(): ParseResult {
    const tasks: CodexPmTask[] = [];
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];

      if (this.isTaskHeading(line)) {
        const task = this.parseTask(errors);
        if (task) {
          tasks.push(task);
        }
      } else if (this.isSectionHeading(line)) {
        this.currentLine++;
      } else {
        this.currentLine++;
      }
    }

    if (tasks.length === 0) {
      warnings.push("No tasks found in TASKS.md");
    }

    return { tasks, errors, warnings };
  }

  private isTaskHeading(line: string): boolean {
    return line.startsWith("### ") && line.includes(":");
  }

  private isSectionHeading(line: string): boolean {
    return line.startsWith("## ");
  }

  private parseTask(errors: ParseError[]): CodexPmTask | null {
    const headingLine = this.lines[this.currentLine];
    const match = headingLine.match(/^###\s+([^:]+):\s*(.+)$/);

    if (!match) {
      errors.push({
        line_number: this.currentLine + 1,
        message: `Invalid task heading format: ${headingLine}`,
      });
      this.currentLine++;
      return null;
    }

    const taskId = match[1].trim();
    const title = match[2].trim();

    this.currentLine++;

    const task: Partial<CodexPmTask> = {
      id: taskId,
      title,
      depends_on: [],
      files_hint: [],
      acceptance: [],
      verify: [],
      blocked_rules: [],
      retry_count: 0,
      max_retries: 2,
      description: "",
    };

    let currentField: string | null = null;

    while (this.currentLine < this.lines.length) {
      const line = this.lines[this.currentLine];

      if (
        line.startsWith("### ") ||
        line.startsWith("## ") ||
        line.startsWith("# ") ||
        line === "---"
      ) {
        break;
      }

      if (line.trim() === "") {
        currentField = null;
        this.currentLine++;
        continue;
      }

      if (line.startsWith("- ")) {
        const content = line.slice(2).trim();
        if (currentField && task[currentField as keyof CodexPmTask]) {
          const arr = task[currentField as keyof CodexPmTask] as string[];
          arr.push(content);
        }
        this.currentLine++;
        continue;
      }

      const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        const fieldValue = fieldMatch[2].trim();

        currentField = this.handleField(task, fieldName, fieldValue, errors);
      } else {
        if (currentField === "description" && line.trim()) {
          if (task.description) {
            task.description += " " + line.trim();
          } else {
            task.description = line.trim();
          }
        }
      }

      this.currentLine++;
    }

    return this.validateTask(task, errors);
  }

  private handleField(
    task: Partial<CodexPmTask>,
    fieldName: string,
    fieldValue: string,
    errors: ParseError[]
  ): string | null {
    switch (fieldName) {
      case "Status": {
        const status = fieldValue as TaskStatus;
        const validStatuses: TaskStatus[] = [
          "pending",
          "running",
          "done",
          "failed",
          "blocked",
          "needs_approval",
          "needs_review",
          "locked",
        ];
        if (validStatuses.includes(status)) {
          task.status = status;
        } else {
          errors.push({
            line_number: this.currentLine + 1,
            message: `Invalid status: ${fieldValue}`,
            task_id: task.id,
          });
          task.status = "pending";
        }
        return null;
      }

      case "Priority": {
        const priority = parseInt(fieldValue, 10);
        if (!isNaN(priority)) {
          task.priority = priority;
        } else {
          errors.push({
            line_number: this.currentLine + 1,
            message: `Invalid priority: ${fieldValue}`,
            task_id: task.id,
          });
          task.priority = 5;
        }
        return null;
      }

      case "Risk": {
        const risk = fieldValue as TaskRisk;
        const validRisks: TaskRisk[] = ["low", "medium", "high", "critical"];
        if (validRisks.includes(risk)) {
          task.risk = risk;
        } else {
          errors.push({
            line_number: this.currentLine + 1,
            message: `Invalid risk: ${fieldValue}`,
            task_id: task.id,
          });
          task.risk = "low";
        }
        return null;
      }

      case "Size": {
        const size = fieldValue as TaskSize;
        const validSizes: TaskSize[] = ["XS", "S", "M", "L", "XL"];
        if (validSizes.includes(size)) {
          task.size = size;
        } else {
          errors.push({
            line_number: this.currentLine + 1,
            message: `Invalid size: ${fieldValue}`,
            task_id: task.id,
          });
          task.size = "M";
        }
        return null;
      }

      case "Area": {
        task.area = fieldValue;
        return null;
      }

      case "Depends on": {
        if (fieldValue.toLowerCase() === "none") {
          task.depends_on = [];
        } else {
          task.depends_on = fieldValue
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        }
        return null;
      }

      case "Human approval": {
        task.human_approval = fieldValue.toLowerCase() === "yes";
        return null;
      }

      case "Locked": {
        task.locked = fieldValue.toLowerCase() === "yes";
        return null;
      }

      case "Description": {
        task.description = fieldValue;
        return "description";
      }

      case "Files hint": {
        task.files_hint = [];
        return "files_hint";
      }

      case "Acceptance": {
        task.acceptance = [];
        return "acceptance";
      }

      case "Verify": {
        task.verify = [];
        return "verify";
      }

      case "Blocked rules": {
        task.blocked_rules = [];
        return "blocked_rules";
      }

      default: {
        return null;
      }
    }
  }

  private validateTask(task: Partial<CodexPmTask>, errors: ParseError[]): CodexPmTask | null {
    const requiredFields: (keyof CodexPmTask)[] = [
      "id",
      "title",
      "status",
      "priority",
      "risk",
      "size",
      "area",
    ];
    let isValid = true;

    for (const field of requiredFields) {
      if (task[field] === undefined) {
        errors.push({
          line_number: 0,
          message: `Missing required field '${field}' in task ${task.id}`,
          task_id: task.id as string,
        });
        isValid = false;
      }
    }

    if (!isValid) {
      return null;
    }

    return task as CodexPmTask;
  }
}
