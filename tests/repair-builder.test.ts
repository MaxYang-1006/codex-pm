import { describe, it } from "node:test";
import assert from "node:assert";
import { RepairBuilder } from "../src/core/repair-builder.js";
import type { CodexPmTask } from "../src/types/task.js";

describe("Repair Builder", () => {
  describe("constructor", () => {
    it("should use default template path", () => {
      const builder = new RepairBuilder();
      assert.ok(builder);
    });

    it("should accept custom template path", () => {
      const builder = new RepairBuilder("templates/prompts/repair.md");
      assert.ok(builder);
    });
  });

  describe("buildRepairPrompt", () => {
    it("should build prompt with task details", () => {
      const builder = new RepairBuilder();
      const task: CodexPmTask = {
        id: "P2-T004",
        title: "Test Task",
        status: "failed",
        priority: 10,
        risk: "low",
        size: "M",
        area: "test",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "This is a test task",
        files_hint: ["src/test.ts"],
        acceptance: ["Test should pass"],
        verify: ["npm test"],
        blocked_rules: [],
        retry_count: 1,
        max_retries: 3,
      };

      const prompt = builder.buildRepairPrompt({
        task,
        failureHistory: [],
        maxRetries: 3,
      });

      assert.ok(prompt.includes("P2-T004"));
      assert.ok(prompt.includes("Test Task"));
      assert.ok(prompt.includes("This is a test task"));
      assert.ok(prompt.includes("src/test.ts"));
      assert.ok(prompt.includes("Test should pass"));
      assert.ok(prompt.includes("npm test"));
    });

    it("should include failure information", () => {
      const builder = new RepairBuilder();
      const task: CodexPmTask = {
        id: "P2-T004",
        title: "Test Task",
        status: "failed",
        priority: 10,
        risk: "low",
        size: "M",
        area: "test",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 1,
        max_retries: 3,
      };

      const prompt = builder.buildRepairPrompt({
        task,
        failureHistory: [
          {
            task_id: "P2-T004",
            run_id: "P2-T004-123",
            started_at: "2024-01-01T00:00:00Z",
            status: "failed",
            success: false,
            exit_code: 1,
            error_message: "Test failed",
            duration_ms: 1000,
            verification_results: [],
            verification_passed: false,
            retry_count: 1,
            risk_incident: false,
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
        lastFailure: {
          task_id: "P2-T004",
          run_id: "P2-T004-123",
          started_at: "2024-01-01T00:00:00Z",
          status: "failed",
          success: false,
          exit_code: 1,
          error_message: "Test failed",
          duration_ms: 1000,
          verification_results: [],
          verification_passed: false,
          retry_count: 1,
          risk_incident: false,
          timestamp: "2024-01-01T00:00:00Z",
        },
        maxRetries: 3,
      });

      assert.ok(prompt.includes("Test failed"));
      assert.ok(prompt.includes("Exit Code: 1"));
      assert.ok(prompt.includes("Duration: 1000ms"));
    });

    it("should include retry information", () => {
      const builder = new RepairBuilder();
      const task: CodexPmTask = {
        id: "P2-T004",
        title: "Test Task",
        status: "failed",
        priority: 10,
        risk: "low",
        size: "M",
        area: "test",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 2,
        max_retries: 3,
      };

      const prompt = builder.buildRepairPrompt({
        task,
        failureHistory: [],
        maxRetries: 3,
      });

      assert.ok(prompt.includes("Retries used: 2"));
      assert.ok(prompt.includes("Maximum retries: 3"));
      assert.ok(prompt.includes("Remaining retries: 1"));
    });
  });

  describe("saveRepairPrompt", () => {
    it("should save prompt to file", () => {
      const builder = new RepairBuilder();
      const prompt = "# Test Prompt\n\nThis is a test";
      const path = builder.saveRepairPrompt("P2-T004", prompt);

      assert.ok(path.includes("P2-T004-repair.md"));
    });
  });

  describe("loadRepairPrompt", () => {
    it("should return null for non-existent prompt", () => {
      const builder = new RepairBuilder();
      const prompt = builder.loadRepairPrompt("nonexistent-task");

      assert.strictEqual(prompt, null);
    });
  });
});
