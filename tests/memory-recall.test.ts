import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import { MemoryRecall } from "../src/core/memory-recall.js";
import { MemoryWriter } from "../src/core/memory-writer.js";
import { ExecutionResult } from "../src/core/result-writer.js";

describe("Memory Recall", () => {
  const testBaseDir = ".codex-pm-test-recall";

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("loadAllMemories", () => {
    it("should return empty array when no memory files exist", () => {
      const recall = new MemoryRecall(testBaseDir);
      const memories = recall.loadAllMemories();

      assert.deepStrictEqual(memories, []);
    });

    it("should load memory files if present", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      const memories = recall.loadAllMemories();
      assert.strictEqual(memories.length, 1);
      assert.strictEqual(memories[0].source_task_id, "P0-T001");
    });
  });

  describe("recallByKeyword", () => {
    it("should return empty recall safely when memory is missing", () => {
      const recall = new MemoryRecall(testBaseDir);
      const result = recall.recallByKeyword("test");

      assert.strictEqual(result.count, 0);
      assert.deepStrictEqual(result.records, []);
      assert.strictEqual(result.query, "test");
      assert.strictEqual(result.queryType, "keyword");
    });

    it("should find memories containing keywords", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task1 = {
        id: "P0-T001",
        title: "Test CLI",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const task2 = {
        id: "P0-T002",
        title: "Test Scanner",
        priority: 8,
        risk: "low" as const,
        size: "M" as const,
        area: "docs",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task1, result);
      writer.writeMemory(task2, result);

      const cliResult = recall.recallByKeyword("CLI");
      assert.strictEqual(cliResult.count, 1);
      assert.strictEqual(cliResult.records[0].source_task_id, "P0-T001");

      const testResult = recall.recallByKeyword("Test");
      assert.strictEqual(testResult.count, 2);
    });

    it("should support multiple keywords", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "CLI Scanner",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      const keywordResult = recall.recallByKeyword(["CLI", "Scanner"]);
      assert.strictEqual(keywordResult.count, 1);
    });

    it("should support options filtering", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task1 = {
        id: "P0-T001",
        title: "Success Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const task2 = {
        id: "P0-T002",
        title: "Failure Task",
        priority: 8,
        risk: "high" as const,
        size: "M" as const,
        area: "core",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const successResult: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const failureResult: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 200,
        error: "Failed",
      };

      writer.writeMemory(task1, successResult);
      writer.writeMemory(task2, failureResult);

      // 只获取负面记忆
      const negativeResult = recall.recallByKeyword("Task", { types: ["negative"] });
      assert.strictEqual(negativeResult.count, 1);
      assert.strictEqual(negativeResult.records[0].type, "negative");

      // 按最小重要性过滤
      const highImportanceResult = recall.recallByKeyword("Task", { minImportance: 0.8 });
      assert.ok(highImportanceResult.count >= 1);
    });
  });

  describe("recallByTask", () => {
    it("should recall memories relevant to a task", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task1 = {
        id: "P0-T001",
        title: "CLI Implementation",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
        description: "Implement CLI commands for the project manager",
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task1, result);

      const queryTask = {
        id: "P0-T002",
        title: "CLI Enhancement",
        priority: 8,
        risk: "low" as const,
        size: "M" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const recallResult = recall.recallByTask(queryTask);
      assert.strictEqual(recallResult.count, 1);
      assert.strictEqual(recallResult.queryType, "keyword");
    });
  });

  describe("recallByTag", () => {
    it("should recall memories by tags", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      const tagResult = recall.recallByTag(["P0-T001"]);
      assert.strictEqual(tagResult.count, 1);
      assert.strictEqual(tagResult.queryType, "tag");
    });
  });

  describe("getNegativeMemories", () => {
    it("should return negative memories", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Failing Task",
        priority: 10,
        risk: "high" as const,
        size: "M" as const,
        area: "core",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 200,
        error: "Failed",
      };

      writer.writeNegativeMemory(task, result);

      const negativeMemories = recall.getNegativeMemories();
      assert.strictEqual(negativeMemories.length, 1);
      assert.strictEqual(negativeMemories[0].type, "negative");
    });
  });

  describe("getRecentMemories", () => {
    it("should return most recent memories", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);
      writer.writeMemory(task, result);

      const recent = recall.getRecentMemories(1);
      assert.strictEqual(recent.length, 1);
    });
  });

  describe("getMemoriesBySourceTask", () => {
    it("should return memories from specific task", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task1 = {
        id: "P0-T001",
        title: "Task 1",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const task2 = {
        id: "P0-T002",
        title: "Task 2",
        priority: 8,
        risk: "low" as const,
        size: "M" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task1, result);
      writer.writeMemory(task2, result);

      const task1Memories = recall.getMemoriesBySourceTask("P0-T001");
      assert.strictEqual(task1Memories.length, 1);
      assert.strictEqual(task1Memories[0].source_task_id, "P0-T001");
    });
  });

  describe("hasRelevantMemory", () => {
    it("should return true when relevant memory exists", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "CLI Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      const queryTask = {
        id: "P0-T002",
        title: "CLI Enhancement",
        priority: 8,
        risk: "low" as const,
        size: "M" as const,
        area: "cli",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      assert.strictEqual(recall.hasRelevantMemory(queryTask), true);
    });

    it("should return false when no relevant memory exists", () => {
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      assert.strictEqual(recall.hasRelevantMemory(task), false);
    });
  });

  describe("hasMemoryFiles", () => {
    it("should return false when no memory files", () => {
      const recall = new MemoryRecall(testBaseDir);
      assert.strictEqual(recall.hasMemoryFiles(), false);
    });

    it("should return true when memory files exist", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      assert.strictEqual(recall.hasMemoryFiles(), true);
    });
  });

  describe("getStats", () => {
    it("should return stats for empty memory", () => {
      const recall = new MemoryRecall(testBaseDir);
      const stats = recall.getStats();

      assert.strictEqual(stats.total, 0);
      assert.deepStrictEqual(stats.byType, {});
      assert.deepStrictEqual(stats.byStatus, {});
    });

    it("should return stats with memories", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task1 = {
        id: "P0-T001",
        title: "Success",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const task2 = {
        id: "P0-T002",
        title: "Failure",
        priority: 8,
        risk: "high" as const,
        size: "M" as const,
        area: "core",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const successResult: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const failureResult: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 200,
        error: "Failed",
      };

      writer.writeMemory(task1, successResult);
      writer.writeMemory(task2, failureResult);

      const stats = recall.getStats();

      assert.strictEqual(stats.total, 2);
      assert.ok(stats.byType.task >= 1);
      assert.ok(stats.byType.negative >= 1);
    });
  });

  describe("formatResult", () => {
    it("should format results correctly", () => {
      const writer = new MemoryWriter({ baseDir: testBaseDir });
      const recall = new MemoryRecall(testBaseDir);

      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      writer.writeMemory(task, result);

      const recallResult = recall.recallByKeyword("Test");
      const formatted = recall.formatResult(recallResult);

      assert.ok(formatted.includes("Memory Recall Results"));
      assert.ok(formatted.includes("P0-T001"));
      assert.ok(formatted.includes("Found: 1 records"));
    });

    it("should format empty results", () => {
      const recall = new MemoryRecall(testBaseDir);
      const result = recall.recallByKeyword("nonexistent");
      const formatted = recall.formatResult(result);

      assert.ok(formatted.includes("No relevant memories found"));
    });
  });
});
