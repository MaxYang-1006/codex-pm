import * as fs from "fs";
import * as path from "path";
import type { CodexPmTask } from "../types/task.js";
import { ensureDirectoryExists } from "./file-utils.js";
import type { AuditLogEntry } from "./result-writer.js";

export interface RepairContext {
  task: CodexPmTask;
  failureHistory: AuditLogEntry[];
  lastFailure?: AuditLogEntry;
  maxRetries: number;
}

export class RepairBuilder {
  private templatePath: string;

  constructor(templatePath?: string) {
    this.templatePath = templatePath || "templates/prompts/repair.md";
  }

  buildRepairPrompt(context: RepairContext): string {
    const { task, lastFailure, maxRetries } = context;

    // 读取模板文件
    let template = this.loadTemplate();

    // 替换模板变量
    template = template.replace(/\{\{task\.id\}\}/g, task.id);
    template = template.replace(/\{\{task\.title\}\}/g, task.title);

    // 构建失败摘要
    const failureSummary = lastFailure
      ? this.buildFailureSummary(lastFailure)
      : "No failure details available";
    template = template.replace(/\{\{failure\.summary\}\}/g, failureSummary);

    // 构建失败输出
    const failureOutput = lastFailure ? this.buildFailureOutput(lastFailure) : "";
    template = template.replace(/\{\{failure\.output\}\}/g, failureOutput);

    // 添加任务详情
    template = this.addTaskDetails(template, task);

    // 添加重试信息
    template = this.addRetryInfo(template, task, maxRetries);

    return template;
  }

  private loadTemplate(): string {
    if (fs.existsSync(this.templatePath)) {
      return fs.readFileSync(this.templatePath, "utf-8");
    }

    // 默认模板
    return `# Codex PM Repair Brief

Previous task failed.

Task: {{task.id}} — {{task.title}}

Failure:

{{failure.summary}}

Verification output:

{{failure.output}}

Repair rules:

- Fix only the failure.
- Do not expand scope.
- Do not refactor unrelated code.
- Do not exceed max retries.`;
  }

  private buildFailureSummary(entry: AuditLogEntry): string {
    const lines: string[] = [];

    lines.push(`Status: ${entry.status}`);
    lines.push(`Run ID: ${entry.run_id}`);
    lines.push(`Timestamp: ${entry.completed_at || entry.timestamp || entry.started_at}`);
    lines.push(`Duration: ${entry.duration_ms}ms`);

    if (entry.exit_code !== null) {
      lines.push(`Exit Code: ${entry.exit_code}`);
    }

    if (entry.error_message) {
      lines.push(`Error: ${entry.error_message}`);
    }

    return lines.join("\n");
  }

  private buildFailureOutput(entry: AuditLogEntry): string {
    // 从任务结果文件中获取详细输出
    const resultFiles = entry.result_path
      ? [entry.result_path]
      : this.findResultFiles(entry.task_id, entry.run_id);

    if (resultFiles.length === 0) {
      return "No detailed output available.";
    }

    const outputs: string[] = [];

    for (const file of resultFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(content);

        if (parsed.execution?.stdout) {
          outputs.push("stdout:\n" + parsed.execution.stdout);
        }

        if (parsed.execution?.stderr) {
          outputs.push("stderr:\n" + parsed.execution.stderr);
        }
      } catch {
        // 文件可能被删除或格式不正确
      }
    }

    return outputs.length > 0 ? outputs.join("\n\n") : "No detailed output available.";
  }

  private findResultFiles(taskId: string, runId: string): string[] {
    const resultsDir = ".codex-pm/results";

    if (!fs.existsSync(resultsDir)) {
      return [];
    }

    const files = fs.readdirSync(resultsDir);
    return files
      .filter(f => f.startsWith(taskId) && f.includes(runId.split("-").pop() || ""))
      .map(f => path.join(resultsDir, f));
  }

  private addTaskDetails(template: string, task: CodexPmTask): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("## Task Details");
    lines.push(`**Priority:** ${task.priority}`);
    lines.push(`**Risk:** ${task.risk}`);
    lines.push(`**Size:** ${task.size}`);
    lines.push("");

    if (task.description) {
      lines.push("### Description");
      lines.push(task.description);
      lines.push("");
    }

    if (task.files_hint.length > 0) {
      lines.push("### Files to Modify");
      for (const file of task.files_hint) {
        lines.push(`- ${file}`);
      }
      lines.push("");
    }

    if (task.acceptance.length > 0) {
      lines.push("### Acceptance Criteria");
      for (const criteria of task.acceptance) {
        lines.push(`- ${criteria}`);
      }
      lines.push("");
    }

    if (task.verify.length > 0) {
      lines.push("### Verification Commands");
      for (const cmd of task.verify) {
        lines.push(`- ${cmd}`);
      }
      lines.push("");
    }

    return template + "\n" + lines.join("\n");
  }

  private addRetryInfo(template: string, task: CodexPmTask, maxRetries: number): string {
    const retriesUsed = task.retry_count || 0;
    const remainingRetries = Math.max(0, maxRetries - retriesUsed);

    const lines: string[] = [];
    lines.push("## Retry Information");
    lines.push(`- Retries used: ${retriesUsed}`);
    lines.push(`- Maximum retries: ${maxRetries}`);
    lines.push(`- Remaining retries: ${remainingRetries}`);
    lines.push("");

    if (remainingRetries === 0) {
      lines.push("⚠️ WARNING: No retries remaining. This is the final attempt.");
    }

    return template + "\n" + lines.join("\n");
  }

  saveRepairPrompt(taskId: string, prompt: string): string {
    ensureDirectoryExists(".codex-pm/prompts");
    const promptPath = `.codex-pm/prompts/${taskId}-repair.md`;
    fs.writeFileSync(promptPath, prompt, "utf-8");
    return promptPath;
  }

  loadRepairPrompt(taskId: string): string | null {
    const promptPath = `.codex-pm/prompts/${taskId}-repair.md`;
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, "utf-8");
    }
    return null;
  }
}
