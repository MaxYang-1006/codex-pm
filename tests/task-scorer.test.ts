import { describe, it } from "node:test";
import assert from "node:assert";
import { TaskScorer } from "../src/core/task-scorer.js";
import type { CodexPmTask } from "../src/types/task.js";

describe("Task Scorer", () => {
  describe("getRunnableTasks", () => {
    it("should return only pending tasks with completed dependencies", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "done",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T002",
          title: "Task 2",
          status: "pending",
          priority: 9,
          risk: "low",
          size: "M",
          area: "plugin",
          depends_on: ["P0-T001"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T003",
          title: "Task 3",
          status: "pending",
          priority: 8,
          risk: "low",
          size: "L",
          area: "testing",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const runnable = scorer.getRunnableTasks(tasks);

      assert.strictEqual(runnable.length, 2);
      assert.ok(runnable.some(t => t.id === "P0-T002"));
      assert.ok(runnable.some(t => t.id === "P0-T003"));
    });

    it("should exclude locked tasks", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: true,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const runnable = scorer.getRunnableTasks(tasks);

      assert.strictEqual(runnable.length, 0);
    });

    it("should exclude tasks with incomplete dependencies", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: ["P0-T999"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const runnable = scorer.getRunnableTasks(tasks);

      assert.strictEqual(runnable.length, 0);
    });
  });

  describe("scoreTask", () => {
    it("should score tasks based on priority", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const score = scorer.scoreTask(tasks[0], tasks);

      assert.strictEqual(score.task_id, "P0-T001");
      assert.ok(score.score > 0);
      assert.ok(score.breakdown.priority > 0);
    });

    it("should apply risk penalty", () => {
      const lowRiskTask: CodexPmTask = {
        id: "P0-T001",
        title: "Low Risk",
        status: "pending",
        priority: 10,
        risk: "low",
        size: "S",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 0,
        max_retries: 2,
      };

      const highRiskTask: CodexPmTask = {
        id: "P0-T002",
        title: "High Risk",
        status: "pending",
        priority: 10,
        risk: "high",
        size: "S",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 0,
        max_retries: 2,
      };

      const scorer = new TaskScorer();
      const lowRiskScore = scorer.scoreTask(lowRiskTask, [lowRiskTask]);
      const highRiskScore = scorer.scoreTask(highRiskTask, [highRiskTask]);

      assert.ok(lowRiskScore.score > highRiskScore.score);
    });

    it("should apply size penalty", () => {
      const smallTask: CodexPmTask = {
        id: "P0-T001",
        title: "Small",
        status: "pending",
        priority: 10,
        risk: "low",
        size: "S",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 0,
        max_retries: 2,
      };

      const largeTask: CodexPmTask = {
        id: "P0-T002",
        title: "Large",
        status: "pending",
        priority: 10,
        risk: "low",
        size: "XL",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 0,
        max_retries: 2,
      };

      const scorer = new TaskScorer();
      const smallScore = scorer.scoreTask(smallTask, [smallTask]);
      const largeScore = scorer.scoreTask(largeTask, [largeTask]);

      assert.ok(smallScore.score > largeScore.score);
    });

    it("should apply failure penalty", () => {
      const noRetryTask: CodexPmTask = {
        id: "P0-T001",
        title: "No Retry",
        status: "pending",
        priority: 10,
        risk: "low",
        size: "S",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 0,
        max_retries: 2,
      };

      const retryTask: CodexPmTask = {
        id: "P0-T002",
        title: "With Retry",
        status: "pending",
        priority: 10,
        risk: "low",
        size: "S",
        area: "foundation",
        depends_on: [],
        human_approval: false,
        locked: false,
        description: "",
        files_hint: [],
        acceptance: [],
        verify: [],
        blocked_rules: [],
        retry_count: 2,
        max_retries: 2,
      };

      const scorer = new TaskScorer();
      const noRetryScore = scorer.scoreTask(noRetryTask, [noRetryTask]);
      const retryScore = scorer.scoreTask(retryTask, [retryTask]);

      assert.ok(noRetryScore.score > retryScore.score);
    });
  });

  describe("selectNextTask", () => {
    it("should select highest scoring task", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "High Priority",
          status: "pending",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T002",
          title: "Low Priority",
          status: "pending",
          priority: 5,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const selected = scorer.selectNextTask(tasks);

      assert.ok(selected);
      assert.strictEqual(selected.task_id, "P0-T001");
    });

    it("should return null when no runnable tasks", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Completed",
          status: "done",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const selected = scorer.selectNextTask(tasks);

      assert.strictEqual(selected, null);
    });
  });

  describe("countUnlockedTasks", () => {
    it("should count tasks that depend on this task", () => {
      const tasks: CodexPmTask[] = [
        {
          id: "P0-T001",
          title: "Task 1",
          status: "pending",
          priority: 10,
          risk: "low",
          size: "S",
          area: "foundation",
          depends_on: [],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T002",
          title: "Task 2",
          status: "pending",
          priority: 9,
          risk: "low",
          size: "M",
          area: "plugin",
          depends_on: ["P0-T001"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
        {
          id: "P0-T003",
          title: "Task 3",
          status: "pending",
          priority: 8,
          risk: "low",
          size: "L",
          area: "testing",
          depends_on: ["P0-T001"],
          human_approval: false,
          locked: false,
          description: "",
          files_hint: [],
          acceptance: [],
          verify: [],
          blocked_rules: [],
          retry_count: 0,
          max_retries: 2,
        },
      ];

      const scorer = new TaskScorer();
      const count = scorer.countUnlockedTasks(tasks[0], tasks);

      assert.strictEqual(count, 2);
    });
  });
});
