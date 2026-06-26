import * as fs from "fs";
import * as path from "path";
import type { MemoryRecord } from "../types/memory.js";
import type { CodexPmTask } from "../types/task.js";
import { ensureDirectoryExists } from "./file-utils.js";

export interface RecallOptions {
  maxResults?: number;
  minImportance?: number;
  types?: MemoryRecord["type"][];
  tags?: string[];
}

export interface RecallResult {
  records: MemoryRecord[];
  count: number;
  query: string;
  queryType: "keyword" | "task" | "tag";
}

export class MemoryRecall {
  private memoryDir: string;

  constructor(baseDir: string = ".codex-pm") {
    this.memoryDir = path.join(baseDir, "memory");
    ensureDirectoryExists(this.memoryDir);
  }

  /**
   * 加载所有记忆记录
   */
  loadAllMemories(): MemoryRecord[] {
    if (!fs.existsSync(this.memoryDir)) {
      return [];
    }

    const files = fs.readdirSync(this.memoryDir);
    const memories: MemoryRecord[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(this.memoryDir, file), "utf-8");
          const record = JSON.parse(content) as MemoryRecord;

          // 验证必要字段
          if (record.id && record.type && record.content && record.created_at) {
            memories.push(record);
          }
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
   * 基于关键词召回记忆
   */
  recallByKeyword(keywords: string | string[], options: RecallOptions = {}): RecallResult {
    const memoryRecords = this.loadAllMemories();

    if (memoryRecords.length === 0) {
      return {
        records: [],
        count: 0,
        query: Array.isArray(keywords) ? keywords.join(", ") : keywords,
        queryType: "keyword",
      };
    }

    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    const lowerKeywords = keywordList.map(k => k.toLowerCase());

    let filtered = memoryRecords;

    // 按类型过滤
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(m => options.types!.includes(m.type));
    }

    // 按最小重要性过滤
    if (options.minImportance !== undefined) {
      filtered = filtered.filter(m => m.importance >= options.minImportance!);
    }

    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(m => options.tags!.some(tag => m.tags.includes(tag)));
    }

    // 基于关键词匹配内容
    const matched = filtered.filter(m => {
      const lowerContent = m.content.toLowerCase();
      return lowerKeywords.some(keyword => lowerContent.includes(keyword));
    });

    // 限制结果数量
    const maxResults = options.maxResults ?? 10;
    const results = matched.slice(0, maxResults);

    return {
      records: results,
      count: results.length,
      query: Array.isArray(keywords) ? keywords.join(", ") : keywords,
      queryType: "keyword",
    };
  }

  /**
   * 基于任务召回相关记忆
   */
  recallByTask(task: CodexPmTask, options: RecallOptions = {}): RecallResult {
    const keywords = this.extractTaskKeywords(task);
    return this.recallByKeyword(keywords, options);
  }

  /**
   * 基于标签召回记忆
   */
  recallByTag(tags: string[], options: RecallOptions = {}): RecallResult {
    const memoryRecords = this.loadAllMemories();

    if (memoryRecords.length === 0) {
      return {
        records: [],
        count: 0,
        query: tags.join(", "),
        queryType: "tag",
      };
    }

    let filtered = memoryRecords;

    // 按类型过滤
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(m => options.types!.includes(m.type));
    }

    // 按最小重要性过滤
    if (options.minImportance !== undefined) {
      filtered = filtered.filter(m => m.importance >= options.minImportance!);
    }

    // 按标签匹配
    const matched = filtered.filter(m => tags.some(tag => m.tags.includes(tag)));

    // 限制结果数量
    const maxResults = options.maxResults ?? 10;
    const results = matched.slice(0, maxResults);

    return {
      records: results,
      count: results.length,
      query: tags.join(", "),
      queryType: "tag",
    };
  }

  /**
   * 获取负面记忆（用于避免重复失败）
   */
  getNegativeMemories(maxResults: number = 5): MemoryRecord[] {
    return this.recallByTag(["failure"], { maxResults, types: ["negative"] }).records;
  }

  /**
   * 获取最近的记忆
   */
  getRecentMemories(maxResults: number = 10): MemoryRecord[] {
    const memories = this.loadAllMemories();
    return memories.slice(0, maxResults);
  }

  /**
   * 获取特定来源任务的记忆
   */
  getMemoriesBySourceTask(taskId: string): MemoryRecord[] {
    const memories = this.loadAllMemories();
    return memories.filter(m => m.source_task_id === taskId);
  }

  /**
   * 检查是否有相关记忆
   */
  hasRelevantMemory(task: CodexPmTask): boolean {
    const result = this.recallByTask(task);
    return result.count > 0;
  }

  /**
   * 从任务中提取关键词
   */
  private extractTaskKeywords(task: CodexPmTask): string[] {
    const keywords: string[] = [];

    // 添加任务 ID 和标题
    if (task.id) {
      keywords.push(task.id);
    }

    if (task.title) {
      keywords.push(...task.title.split(/\s+/).filter(w => w.length > 2));
    }

    // 添加区域
    if (task.area) {
      keywords.push(task.area);
    }

    // 添加标签相关的关键词
    keywords.push(task.risk);
    keywords.push(task.size);

    // 添加描述中的关键词
    if (task.description) {
      const descKeywords = task.description.split(/\s+/).filter(w => w.length > 3);
      keywords.push(...descKeywords);
    }

    // 去重并转为小写
    return [...new Set(keywords)].map(k => k.toLowerCase());
  }

  /**
   * 格式化召回结果
   */
  formatResult(result: RecallResult): string {
    const lines: string[] = [];

    lines.push(`=== Memory Recall Results ===`);
    lines.push(`Query: ${result.query}`);
    lines.push(`Type: ${result.queryType}`);
    lines.push(`Found: ${result.count} records`);
    lines.push("");

    if (result.count === 0) {
      lines.push("No relevant memories found.");
      return lines.join("\n");
    }

    for (let i = 0; i < result.records.length; i++) {
      const record = result.records[i];
      lines.push(`${i + 1}. [${record.type}] ${record.id}`);
      lines.push(`   Importance: ${record.importance}`);
      lines.push(`   Utility: ${record.utility}`);
      lines.push(`   Created: ${record.created_at}`);
      lines.push(`   Tags: ${record.tags.join(", ")}`);
      lines.push(`   Content (first 100 chars): ${record.content.substring(0, 100)}...`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 获取记忆统计信息
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const memories = this.loadAllMemories();

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

  /**
   * 检查记忆目录是否存在
   */
  hasMemoryFiles(): boolean {
    if (!fs.existsSync(this.memoryDir)) {
      return false;
    }

    const files = fs.readdirSync(this.memoryDir);
    return files.some(file => file.endsWith(".json"));
  }
}
