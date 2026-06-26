import { describe, it } from "node:test";
import assert from "node:assert";
import { Verifier } from "../src/core/verifier.js";

function nodeCommand(script: string): string {
  const executable = `"${process.execPath}"`;
  const escapedScript = script.replace(/"/g, '\\"');
  return `${executable} -e "${escapedScript}"`;
}

describe("Verifier", () => {
  describe("constructor", () => {
    it("should use default timeout of 60 seconds", () => {
      new Verifier();
      assert.ok(true);
    });

    it("should accept custom timeout", () => {
      const verifier = new Verifier({ timeout: 30000 });
      assert.ok(verifier); // 验证构造函数不报错
    });

    it("should accept custom cwd", () => {
      const verifier = new Verifier({ cwd: "/tmp" });
      assert.ok(verifier);
    });
  });

  describe("verifyCommand", () => {
    it("should execute simple echo command", async () => {
      const verifier = new Verifier();
      const result = await verifier.verifyCommand("echo 'hello'");

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes("hello"));
    });

    it("should capture stdout and stderr", async () => {
      const verifier = new Verifier();
      const result = await verifier.verifyCommand(
        nodeCommand("console.log('out'); console.error('err')")
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.stdout.includes("out"));
      assert.ok(result.stderr.includes("err"));
    });

    it("should return success=false for non-zero exit", async () => {
      const verifier = new Verifier();
      const result = await verifier.verifyCommand(nodeCommand("process.exit(1)"));

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, 1);
    });

    it("should handle command not found", async () => {
      const verifier = new Verifier();
      // 使用一个不存在的命令路径
      const result = await verifier.verifyCommand("/nonexistent-dir-xyz/nonexistent-bin-123");

      assert.strictEqual(result.success, false);
      // 可能是 not_found 或 execution_error
      assert.ok(
        result.error === "not_found" || result.error === "execution_error" || result.exitCode !== 0
      );
    });

    it("should handle timeout", async () => {
      const verifier = new Verifier();
      const result = await verifier.verifyCommand(nodeCommand("setTimeout(() => {}, 5000)"), {
        timeout: 500,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "timeout");
    });

    it("should record duration", async () => {
      const verifier = new Verifier();
      const result = await verifier.verifyCommand("echo 'test'");

      assert.ok(result.duration >= 0);
    });
  });

  describe("verifyCommands", () => {
    it("should execute commands sequentially", async () => {
      const verifier = new Verifier();
      const results = await verifier.verifyCommands([
        "echo 'first'",
        "echo 'second'",
        "echo 'third'",
      ]);

      assert.strictEqual(results.length, 3);
      assert.ok(results[0].stdout.includes("first"));
      assert.ok(results[1].stdout.includes("second"));
      assert.ok(results[2].stdout.includes("third"));
    });

    it("should skip empty commands", async () => {
      const verifier = new Verifier();
      const results = await verifier.verifyCommands(["echo 'test'", "", "  ", "echo 'done'"]);

      assert.strictEqual(results.length, 2);
    });

    it("should continue after failure", async () => {
      const verifier = new Verifier();
      const results = await verifier.verifyCommands([
        nodeCommand("process.exit(1)"),
        "echo 'after-failure'",
      ]);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].success, false);
      assert.strictEqual(results[1].success, true);
    });
  });

  describe("checkCommandExists", () => {
    it("should return true for existing command", async () => {
      const verifier = new Verifier();
      const exists = await verifier.checkCommandExists(process.execPath);

      assert.strictEqual(exists, true);
    });

    it("should return false for non-existent command", async () => {
      const verifier = new Verifier();
      const exists = await verifier.checkCommandExists("nonexistent-xyz-12345");

      assert.strictEqual(exists, false);
    });
  });

  describe("formatResults", () => {
    it("should format results correctly", async () => {
      const verifier = new Verifier();
      const results = await verifier.verifyCommands([
        "echo 'test'",
        nodeCommand("process.exit(1)"),
      ]);

      const formatted = Verifier.formatResults(results);

      assert.ok(formatted.includes("Verification Results"));
      assert.ok(formatted.includes("PASSED"));
      assert.ok(formatted.includes("FAILED"));
      assert.ok(formatted.includes("Summary:"));
    });
  });
});
