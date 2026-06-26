import * as fs from "fs";
import * as path from "path";
import type { MemoryRecord } from "../types/memory.js";
import type { CodexPmTask } from "../types/task.js";
import { ExecutionResult } from "./result-writer.js";
import { ensureDirectoryExists } from "./file-utils.js";

export interface MemoryWriterOptions {
  baseDir?: string;
  memoryDir?: string;
  defaultThreshold?: number;
  maxMemorySize?: number;
}

export interface MemoryScore {
  total: number;
  importance: number;
  utility: number;
  recency: number;
  uniqueness: number;
}

export class MemoryWriter {
  private baseDir: string;
  private memoryDir: string;
  private defaultThreshold: number;
  private maxMemorySize: number;

  constructor(options: MemoryWriterOptions = {}) {
    this.baseDir = options.baseDir || ".codex-pm";
    this.memoryDir = options.memoryDir || `${this.baseDir}/memory`;
    this.defaultThreshold = options.defaultThreshold ?? 0.5;
    this.maxMemorySize = options.maxMemorySize ?? 1000;
  }

  /**
   * 计算记忆写入评分
   */
  calculateScore(task: CodexPmTask, executionResult: ExecutionResult): MemoryScore {
    let importance = 0;
    let utility = 0;
    const recency = 1;
    let uniqueness = 0;

    // 基于任务优先级计算重要性
    switch (task.priority) {
      case 10:
        importance = 1.0;
        break;
      case 8:
        importance = 0.8;
        break;
      case 6:
        importance = 0.6;
        break;
      case 4:
        importance = 0.4;
        break;
      default:
        importance = 0.2;
    }

    // 基于风险计算重要性（高风险任务更重要）
    switch (task.risk) {
      case "critical":
        importance += 0.3;
        break;
      case "high":
        importance += 0.2;
        break;
      case "medium":
        importance += 0.1;
        break;
    }

    // 基于执行结果计算实用性
    if (executionResult.success) {
      utility = 0.8;
    } else {
      // 失败也是有价值的教训
      utility = 0.6;
    }

    // 基于验证结果调整
    if (executionResult.success) {
      utility += 0.2;
    }

    // 唯一性：首次执行或高优先级任务更独特
    if (task.retry_count === 0) {
      uniqueness = 0.5;
    } else if (task.retry_count <= 2) {
      uniqueness = 0.3;
    } else {
      uniqueness = 0.1;
    }

    // 确保值在合理范围内
    importance = Math.min(importance, 1.0);
    utility = Math.min(utility, 1.0);

    // 综合评分：重要性 * 0.4 + 实用性 * 0.4 + 独特性 * 0.2
    const total = importance * 0.4 + utility * 0.4 + uniqueness * 0.2;

    return {
      total,
      importance,
      utility,
      recency,
      uniqueness,
    };
  }

  /**
   * 判断是否应该写入记忆
   */
  shouldWrite(
    task: CodexPmTask,
    executionResult: ExecutionResult
  ): {
    shouldWrite: boolean;
    score: MemoryScore;
    threshold: number;
  } {
    const score = this.calculateScore(task, executionResult);
    const threshold = this.getDynamicThreshold(task);

    return {
      shouldWrite: score.total >= threshold,
      score,
      threshold,
    };
  }

  /**
   * 获取动态阈值（根据任务类型调整）
   */
  private getDynamicThreshold(task: CodexPmTask): number {
    // 高优先级或高风险任务阈值更低
    if (task.priority >= 8 || task.risk === "high" || task.risk === "critical") {
      return this.defaultThreshold * 0.7;
    }

    // 基础任务阈值更高
    if (task.priority <= 4) {
      return this.defaultThreshold * 1.3;
    }

    return this.defaultThreshold;
  }

  /**
   * 写入记忆记录
   */
  writeMemory(
    task: CodexPmTask,
    executionResult: ExecutionResult,
    additionalContent?: string
  ): { written: boolean; record?: MemoryRecord; reason?: string } {
    const { shouldWrite, score, threshold } = this.shouldWrite(task, executionResult);

    if (!shouldWrite) {
      return {
        written: false,
        reason: `Memory score ${score.total.toFixed(2)} below threshold ${threshold.toFixed(2)}`,
      };
    }

    // 检查记忆数量是否超过限制
    const currentMemories = this.readAllMemories();
    if (currentMemories.length >= this.maxMemorySize) {
      this.purgeOldMemories();
    }

    // 确定记忆类型
    let type: MemoryRecord["type"];
    if (!executionResult.success) {
      type = "negative";
    } else if (task.area === "risk") {
      type = "risk";
    } else if (task.area === "prompt") {
      type = "prompt";
    } else if (task.acceptance.length > 0) {
      type = "decision";
    } else {
      type = "task";
    }

    // 构建记忆内容
    const content = this.buildMemoryContent(task, executionResult, additionalContent);

    const record: MemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: "active",
      content,
      source_task_id: task.id,
      importance: score.importance,
      utility: score.utility,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: this.generateTags(task, executionResult),
    };

    // 保存记忆记录
    ensureDirectoryExists(this.memoryDir);
    const filePath = path.join(this.memoryDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");

    return {
      written: true,
      record,
    };
  }

  /**
   * 为重要失败记录负面记忆
   */
  writeNegativeMemory(
    task: CodexPmTask,
    executionResult: ExecutionResult
  ): {
    written: boolean;
    record?: MemoryRecord;
    reason?: string;
  } {
    if (executionResult.success) {
      return {
        written: false,
        reason: "Negative memory only recorded for failures",
      };
    }

    // 只有重要的失败才记录负面记忆
    if (task.priority < 6 && task.risk === "low") {
      return {
        written: false,
        reason: "Task not important enough for negative memory",
      };
    }

    // 构建负面记忆内容
    const content =
      `FAILURE: Task ${task.id} (${task.title})\n` +
      `Exit Code: ${executionResult.exitCode ?? "unknown"}\n` +
      `Error: ${executionResult.error ?? "unknown error"}\n` +
      `Retry Count: ${task.retry_count + 1}\n` +
      `Priority: ${task.priority}, Risk: ${task.risk}, Size: ${task.size}\n` +
      `Area: ${task.area}\n` +
      `---\n` +
      `stdout: ${executionResult.stdout.substring(0, 500)}\n` +
      `stderr: ${executionResult.stderr.substring(0, 500)}`;

    const record: MemoryRecord = {
      id: `mem-negative-${Date.now()}`,
      type: "negative",
      status: "active",
      content,
      source_task_id: task.id,
      importance: 1.0,
      utility: 0.8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ["failure", task.id, task.area, `priority-${task.priority}`, `risk-${task.risk}`],
    };

    ensureDirectoryExists(this.memoryDir);
    const filePath = path.join(this.memoryDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");

    return {
      written: true,
      record,
    };
  }

  /**
   * 读取所有记忆记录
   */
  readAllMemories(): MemoryRecord[] {
    ensureDirectoryExists(this.memoryDir);

    const files = fs.readdirSync(this.memoryDir);
    const memories: MemoryRecord[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(this.memoryDir, file), "utf-8");
          const record = JSON.parse(content) as MemoryRecord;
          memories.push(record);
        } catch {
          // 跳过无效文件
        }
      }
    }

    // 按创建时间排序（最新的在前）
    memories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return memories;
  }

  /**
   * 清理旧记忆（保留最新的）
   */
  purgeOldMemories(keepCount: number = 500): void {
    const memories = this.readAllMemories();

    if (memories.length <= keepCount) {
      return;
    }

    // 获取需要删除的旧记忆
    const toDelete = memories.slice(keepCount);

    for (const memory of toDelete) {
      try {
        fs.unlinkSync(path.join(this.memoryDir, `${memory.id}.json`));
      } catch {
        // 忽略删除错误
      }
    }
  }

  /**
   * 获取特定任务的记忆
   */
  getMemoriesByTask(taskId: string): MemoryRecord[] {
    const allMemories = this.readAllMemories();
    return allMemories.filter(m => m.source_task_id === taskId);
  }

  /**
   * 获取特定类型的记忆
   */
  getMemoriesByType(type: MemoryRecord["type"]): MemoryRecord[] {
    const allMemories = this.readAllMemories();
    return allMemories.filter(m => m.type === type);
  }

  /**
   * 获取负面记忆
   */
  getNegativeMemories(): MemoryRecord[] {
    return this.getMemoriesByType("negative");
  }

  /**
   * 构建记忆内容
   */
  private buildMemoryContent(
    task: CodexPmTask,
    executionResult: ExecutionResult,
    additionalContent?: string
  ): string {
    const lines: string[] = [];

    lines.push(`${executionResult.success ? "SUCCESS" : "FAILURE"}: Task ${task.id}`);
    lines.push(`Title: ${task.title}`);
    lines.push(`Priority: ${task.priority} | Risk: ${task.risk} | Size: ${task.size}`);
    lines.push(`Area: ${task.area}`);
    lines.push(`Exit Code: ${executionResult.exitCode ?? "N/A"}`);
    lines.push(`Duration: ${executionResult.duration}ms`);

    if (executionResult.error) {
      lines.push(`Error: ${executionResult.error}`);
    }

    if (task.description) {
      lines.push("---");
      lines.push("Description:");
      lines.push(task.description);
    }

    if (additionalContent) {
      lines.push("---");
      lines.push("Additional:");
      lines.push(additionalContent);
    }

    if (executionResult.stdout && executionResult.stdout.length > 0) {
      lines.push("---");
      lines.push("stdout (first 500 chars):");
      lines.push(executionResult.stdout.substring(0, 500));
    }

    if (executionResult.stderr && executionResult.stderr.length > 0) {
      lines.push("---");
      lines.push("stderr (first 500 chars):");
      lines.push(executionResult.stderr.substring(0, 500));
    }

    return lines.join("\n");
  }

  /**
   * 生成标签
   */
  private generateTags(task: CodexPmTask, executionResult: ExecutionResult): string[] {
    const tags: string[] = [];

    tags.push(task.id);
    tags.push(task.area);
    tags.push(`priority-${task.priority}`);
    tags.push(`risk-${task.risk}`);
    tags.push(`size-${task.size}`);

    if (executionResult.success) {
      tags.push("success");
    } else {
      tags.push("failure");
    }

    if (task.acceptance.length > 0) {
      tags.push("has-acceptance");
    }

    if (task.verify.length > 0) {
      tags.push("has-verification");
    }

    return tags;
  }

  /**
   * 获取记忆统计信息
   */
  getMemoryStats(): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const memories = this.readAllMemories();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      byStatus[memory.status] = (byStatus[memory.status] || 0) + 1;
    }

    return {
      total: memories.length,
      byType,
      byStatus,
    };
  }
}
