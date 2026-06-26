import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import { MemoryWriter } from "../src/core/memory-writer.js";
import { ExecutionResult } from "../src/core/result-writer.js";

describe("Memory Writer", () => {
  const testBaseDir = ".codex-pm-test-memory";
  let writer: MemoryWriter;

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    writer = new MemoryWriter({
      baseDir: testBaseDir,
      memoryDir: `${testBaseDir}/memory`,
      defaultThreshold: 0.5,
      maxMemorySize: 100,
    });
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("calculateScore", () => {
    it("should calculate score for successful high priority task", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const score = writer.calculateScore(task, result);

      assert.ok(score.total >= 0.7);
      assert.strictEqual(score.importance, 1.0);
      assert.ok(score.utility >= 0.8);
    });

    it("should calculate score for failed task", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 8,
        risk: "high" as const,
        size: "M" as const,
        area: "cli",
        retry_count: 1,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 200,
        error: "Test failed",
      };

      const score = writer.calculateScore(task, result);

      assert.ok(score.total > 0);
      assert.ok(score.importance > 0.8);
      assert.ok(score.utility > 0.5);
    });

    it("should calculate lower score for low priority task", () => {
      const task = {
        id: "P3-T001",
        title: "Test",
        priority: 2,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        retry_count: 5, // 多次重试降低唯一性
        max_retries: 10,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      const score = writer.calculateScore(task, result);

      assert.ok(score.total <= 0.5, `Score ${score.total} should be <= 0.5`);
      assert.ok(score.importance <= 0.4);
    });
  });

  describe("shouldWrite", () => {
    it("should return true for high score", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const { shouldWrite, score } = writer.shouldWrite(task, result);

      assert.strictEqual(shouldWrite, true);
      assert.ok(score.total >= 0.5);
    });

    it("should return false for low score", () => {
      const task = {
        id: "P3-T001",
        title: "Test",
        priority: 2,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        retry_count: 5,
        max_retries: 10,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      const { shouldWrite } = writer.shouldWrite(task, result);

      assert.strictEqual(shouldWrite, false);
    });

    it("should lower threshold for high priority tasks", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
        risk: "high" as const,
        size: "L" as const,
        area: "core",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const { shouldWrite, threshold } = writer.shouldWrite(task, result);

      assert.strictEqual(shouldWrite, true);
      assert.ok(threshold < 0.5);
    });
  });

  describe("writeMemory", () => {
    it("should write memory when score is above threshold", () => {
      const task = {
        id: "P0-T001",
        title: "High Priority Task",
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
        stdout: "output",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const { written, record } = writer.writeMemory(task, result);

      assert.strictEqual(written, true);
      assert.ok(record);
      assert.strictEqual(record!.type, "task");
      assert.strictEqual(record!.source_task_id, "P0-T001");
      assert.ok(record!.content.includes("SUCCESS"));
      assert.ok(record!.content.includes("High Priority Task"));
    });

    it("should not write memory when score is below threshold", () => {
      const task = {
        id: "P3-T001",
        title: "Low Priority Task",
        priority: 2,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        retry_count: 5,
        max_retries: 10,
        acceptance: [],
        verify: [],
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 50,
      };

      const { written, reason } = writer.writeMemory(task, result);

      assert.strictEqual(written, false);
      assert.ok(reason?.includes("below threshold"));
    });

    it("should write negative memory type for failures", () => {
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
        error: "Test failed",
      };

      const { written, record } = writer.writeMemory(task, result);

      assert.strictEqual(written, true);
      assert.ok(record);
      assert.strictEqual(record!.type, "negative");
      assert.ok(record!.content.includes("FAILURE"));
    });
  });

  describe("writeNegativeMemory", () => {
    it("should write negative memory for important failures", () => {
      const task = {
        id: "P0-T001",
        title: "Important Task",
        priority: 10,
        risk: "high" as const,
        size: "L" as const,
        area: "core",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "critical error",
        exitCode: 1,
        duration: 500,
        error: "Critical failure",
      };

      const { written, record } = writer.writeNegativeMemory(task, result);

      assert.strictEqual(written, true);
      assert.ok(record);
      assert.strictEqual(record!.type, "negative");
      assert.strictEqual(record!.importance, 1.0);
    });

    it("should not write negative memory for unimportant failures", () => {
      const task = {
        id: "P3-T001",
        title: "Unimportant Task",
        priority: 3,
        risk: "low" as const,
        size: "S" as const,
        area: "test",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: 1,
        duration: 100,
        error: "Minor failure",
      };

      const { written, reason } = writer.writeNegativeMemory(task, result);

      assert.strictEqual(written, false);
      assert.ok(reason?.includes("not important enough"));
    });

    it("should not write negative memory for successful tasks", () => {
      const task = {
        id: "P0-T001",
        title: "Successful Task",
        priority: 10,
        risk: "low" as const,
        size: "S" as const,
        area: "foundation",
        retry_count: 0,
        max_retries: 3,
      } as any;

      const result: ExecutionResult = {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 100,
      };

      const { written, reason } = writer.writeNegativeMemory(task, result);

      assert.strictEqual(written, false);
      assert.ok(reason?.includes("only recorded for failures"));
    });
  });

  describe("readAllMemories", () => {
    it("should return empty array when no memories exist", () => {
      const memories = writer.readAllMemories();
      assert.deepStrictEqual(memories, []);
    });

    it("should read all written memories", () => {
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

      const memories = writer.readAllMemories();

      assert.strictEqual(memories.length, 2);
      assert.ok(memories[0].created_at >= memories[1].created_at); // 最新的在前
    });
  });

  describe("getMemoriesByTask", () => {
    it("should return memories for specific task", () => {
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

      writer.writeMemory(task1, result);
      writer.writeMemory(task1, result);
      writer.writeMemory(task2, result);

      const task1Memories = writer.getMemoriesByTask("P0-T001");

      assert.strictEqual(task1Memories.length, 2);
      assert.ok(task1Memories.every(m => m.source_task_id === "P0-T001"));
    });
  });

  describe("getNegativeMemories", () => {
    it("should return only negative memories", () => {
      const task = {
        id: "P0-T001",
        title: "Test",
        priority: 10,
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

      writer.writeMemory(task, successResult);
      writer.writeMemory(task, failureResult);

      const negativeMemories = writer.getNegativeMemories();

      assert.strictEqual(negativeMemories.length, 1);
      assert.strictEqual(negativeMemories[0].type, "negative");
    });
  });

  describe("getMemoryStats", () => {
    it("should return stats for empty memory", () => {
      const stats = writer.getMemoryStats();

      assert.strictEqual(stats.total, 0);
      assert.deepStrictEqual(stats.byType, {});
      assert.deepStrictEqual(stats.byStatus, {});
    });

    it("should return stats with multiple memories", () => {
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
        priority: 10,
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

      const stats = writer.getMemoryStats();

      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.byType.task, 1);
      assert.strictEqual(stats.byType.negative, 1);
      assert.strictEqual(stats.byStatus.active, 2);
    });
  });

  describe("purgeOldMemories", () => {
    it("should remove old memories when over limit", () => {
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

      // 创建 5 个记忆
      for (let i = 0; i < 5; i++) {
        writer.writeMemory(task, result);
      }

      assert.strictEqual(writer.readAllMemories().length, 5);

      // 清理到只保留 2 个
      writer.purgeOldMemories(2);

      const remaining = writer.readAllMemories();
      assert.strictEqual(remaining.length, 2);
    });
  });
});
