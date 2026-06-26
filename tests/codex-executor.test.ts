import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { CodexExecutor } from "../src/core/codex-executor.js";

describe("Codex Executor", () => {
  describe("constructor", () => {
    it("should have default config values", () => {
      const executor = new CodexExecutor();
      const config = executor.getConfig();

      assert.strictEqual(config.timeout, 300000);
      assert.strictEqual(config.sandbox, "workspace-write");
      assert.strictEqual(config.command, "codex");
      assert.deepStrictEqual(config.defaultArgs, ["exec"]);
      assert.ok(!config.defaultArgs.includes("--yes"));
    });

    it("should accept custom config", () => {
      const executor = new CodexExecutor({
        timeout: 60000,
        sandbox: "read-only",
        command: "custom-codex",
      });

      const config = executor.getConfig();
      assert.strictEqual(config.timeout, 60000);
      assert.strictEqual(config.sandbox, "read-only");
      assert.strictEqual(config.command, "custom-codex");
    });
  });

  describe("updateConfig", () => {
    it("should update config partially", () => {
      const executor = new CodexExecutor();
      executor.updateConfig({ timeout: 120000 });

      const config = executor.getConfig();
      assert.strictEqual(config.timeout, 120000);
      assert.strictEqual(config.command, "codex");
    });
  });

  describe("dry-run mode", () => {
    it("should execute dry-run without prompt", async () => {
      const executor = new CodexExecutor();
      const result = await executor.execute({ dryRun: true });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.exitCode, null);
    });

    it("should execute dry-run with prompt file", async () => {
      const executor = new CodexExecutor();
      const result = await executor.execute({
        dryRun: true,
        promptFile: "test.md",
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stdout.length > 0);
      assert.ok(result.stdout.includes("exec"));
      assert.ok(result.stdout.includes("--sandbox workspace-write"));
      assert.ok(!result.stdout.includes("--yes"));
    });

    it("should execute dry-run with extra args", async () => {
      const executor = new CodexExecutor();
      const result = await executor.execute({
        dryRun: true,
        promptFile: "test.md",
        extraArgs: ["--verbose"],
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stdout.includes("--verbose"));
    });
  });

  describe("execute without dry-run", () => {
    it("should fail without prompt file", async () => {
      const executor = new CodexExecutor();
      const result = await executor.execute({ dryRun: false });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("No prompt file"));
    });

    it("should fail with non-existent prompt file", async () => {
      const executor = new CodexExecutor();
      const result = await executor.execute({
        dryRun: false,
        promptFile: "non-existent.md",
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("not found"));
    });

    it("should reject real execution when sandbox is disabled with --yes", async () => {
      const testDir = ".codex-pm-test-executor";
      const promptFile = path.join(testDir, "prompt.md");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(promptFile, "# Test prompt", "utf-8");

      try {
        const executor = new CodexExecutor({
          command: process.execPath,
          defaultArgs: ["--yes"],
          sandbox: false,
        });
        const result = await executor.execute({
          dryRun: false,
          promptFile,
          sandbox: false,
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes("Unsafe Codex execution options"));
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should reject unsafe sandbox strings from CLI-style input", async () => {
      const testDir = ".codex-pm-test-executor";
      const promptFile = path.join(testDir, "prompt.md");
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(promptFile, "# Test prompt", "utf-8");

      try {
        const executor = new CodexExecutor({
          command: process.execPath,
        });
        const result = await executor.execute({
          dryRun: false,
          promptFile,
          sandbox: "danger-full-access" as any,
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes("Unsafe Codex execution options"));
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("checkAvailability", () => {
    it("should detect unavailable command", async () => {
      const executor = new CodexExecutor({
        command: "codex-nonexistent-12345",
      });

      const result = await executor.checkAvailability();
      assert.strictEqual(result.available, false);
      assert.ok(result.error);
    });
  });
});
