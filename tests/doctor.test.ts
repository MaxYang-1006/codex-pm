import { describe, it } from "node:test";
import assert from "node:assert";
import { runDoctor, type DoctorCommandRunner } from "../src/commands/doctor.js";

function createCommandRunner(
  overrides: Record<
    string,
    { exitCode: number | null; stdout?: string; stderr?: string; error?: string }
  > = {}
): DoctorCommandRunner {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    const override = overrides[key];

    if (override) {
      return {
        stdout: override.stdout ?? "",
        stderr: override.stderr ?? "",
        exitCode: override.exitCode,
        error: override.error,
      };
    }

    return {
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    };
  };
}

describe("Doctor command", () => {
  it("reports npm as failed when npm cannot be executed", async () => {
    const checks = await runDoctor({
      commandRunner: createCommandRunner({
        "npm --version": { exitCode: null, error: "ENOENT" },
      }),
    });

    const npmCheck = checks.find(check => check.name === "npm command");
    assert.strictEqual(npmCheck?.status, "fail");
    assert.ok(npmCheck?.message.includes("not available"));
  });

  it("checks Git and Codex CLI availability", async () => {
    const checks = await runDoctor({
      commandRunner: createCommandRunner(),
    });

    assert.ok(checks.some(check => check.name === "Git command"));
    assert.ok(checks.some(check => check.name === "Codex CLI"));
  });

  it("warns when the current directory is not a Git repository", async () => {
    const checks = await runDoctor({
      commandRunner: createCommandRunner({
        "git rev-parse --is-inside-work-tree": {
          exitCode: 128,
          stderr: "fatal: not a git repository",
        },
      }),
    });

    const repositoryCheck = checks.find(check => check.name === "Git repository");
    assert.strictEqual(repositoryCheck?.status, "warn");
    assert.ok(repositoryCheck?.message.includes("not a Git repository"));
  });

  it("reports missing verification command executables", async () => {
    const checks = await runDoctor({
      commandRunner: createCommandRunner({
        "npm --version": { exitCode: null, error: "ENOENT" },
      }),
    });

    const verifyCheck = checks.find(check => check.name === "Verify commands");
    assert.strictEqual(verifyCheck?.status, "fail");
    assert.ok(verifyCheck?.details?.some(detail => detail.includes("npm")));
  });
});
