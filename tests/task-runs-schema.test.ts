import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";

import { FitnessCalculator } from "../src/core/fitness.js";
import { ResultWriter, type ExecutionResult } from "../src/core/result-writer.js";
import type { VerificationResult } from "../src/types/state.js";

describe("task-runs schema chain", () => {
  const testBaseDir = ".codex-pm-test-task-runs";
  let writer: ResultWriter;

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }

    writer = new ResultWriter({
      baseDir: testBaseDir,
      resultsDir: path.join(testBaseDir, "results"),
      auditLogPath: path.join(testBaseDir, "task-runs.jsonl"),
    });
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it("writes result and task-run JSONL with the same canonical run entry consumed by fitness", () => {
    const runId = "P1-T001-123456789";
    const promptPath = path.join(testBaseDir, "prompts", "P1-T001.md");
    const verificationResults: VerificationResult[] = [
      {
        command: "npm test",
        success: true,
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        duration: 25,
      },
    ];
    const executionResult: ExecutionResult = {
      success: true,
      stdout: "done",
      stderr: "",
      exitCode: 0,
      duration: 125,
    };

    const resultPath = writer.writeTaskResult("P1-T001", executionResult, {
      runId,
      commandsRun: ["codex exec", "npm test"],
      promptPath,
      verificationResults,
      retryCount: 0,
    });
    writer.appendAuditLog("P1-T001", executionResult, {
      runId,
      resultPath,
      promptPath,
      verificationResults,
      retryCount: 0,
      reward: 180,
      penalty: 0,
    });

    const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
    assert.strictEqual(result.run_id, runId);
    assert.deepStrictEqual(result.verification_results, verificationResults);
    assert.strictEqual(result.verification_passed, true);

    const taskRuns = writer.readAuditLog();
    assert.strictEqual(taskRuns.length, 1);
    assert.strictEqual(taskRuns[0].run_id, runId);
    assert.strictEqual(taskRuns[0].result_path, resultPath);
    assert.strictEqual(taskRuns[0].prompt_path, promptPath);
    assert.strictEqual(taskRuns[0].duration_ms, 125);
    assert.strictEqual(taskRuns[0].retry_count, 0);
    assert.deepStrictEqual(taskRuns[0].verification_results, verificationResults);

    const metrics = new FitnessCalculator({ baseDir: testBaseDir, minSampleSize: 1 }).calculate();
    assert.strictEqual(metrics.totalTasks, 1);
    assert.strictEqual(metrics.completionRate, 100);
    assert.strictEqual(metrics.verificationPassRate, 100);
    assert.strictEqual(metrics.averageDuration, 125);
    assert.strictEqual(metrics.averageReward, 180);
  });
});
