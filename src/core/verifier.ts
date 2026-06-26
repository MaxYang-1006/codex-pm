import { spawn } from "child_process";
import type { VerificationResult } from "../types/state.js";
import { commandExists, createShellInvocation, terminateProcessTree } from "./command-utils.js";

export interface VerifierOptions {
  /** 超时时间（毫秒），0 表示无超时 */
  timeout?: number;
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

export class Verifier {
  private defaultTimeout: number;
  private defaultCwd?: string;
  private defaultEnv?: Record<string, string>;

  constructor(options: VerifierOptions = {}) {
    this.defaultTimeout = options.timeout || 60000; // 默认 1 分钟
    this.defaultCwd = options.cwd;
    this.defaultEnv = options.env;
  }

  /**
   * 运行单个验证命令
   */
  async verifyCommand(
    command: string,
    options: Partial<VerifierOptions> = {}
  ): Promise<VerificationResult> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const cwd = options.cwd ?? this.defaultCwd;
    const env = options.env ?? this.defaultEnv;
    const startTime = Date.now();

    return new Promise(resolve => {
      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout | undefined;
      let settled = false;

      const settle = (result: VerificationResult) => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(result);
      };

      const shellInvocation = createShellInvocation(command);
      const child = spawn(shellInvocation.command, shellInvocation.args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        detached: process.platform !== "win32",
        windowsVerbatimArguments: process.platform === "win32",
        windowsHide: true,
      });

      child.stdout?.on("data", data => {
        stdout += data.toString();
      });

      child.stderr?.on("data", data => {
        stderr += data.toString();
      });

      // 设置超时
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          terminateProcessTree(child);
          settle({
            command,
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: null,
            duration: Date.now() - startTime,
            error: "timeout",
            errorMessage: `Command timed out after ${timeout}ms`,
          });
        }, timeout);
      }

      child.on("close", code => {
        const executableExists = commandExists(command, { ...process.env, ...env });
        const error = code !== 0 && !executableExists ? "not_found" : undefined;
        const errorMessage = error === "not_found" ? `Command not found: ${command}` : undefined;

        settle({
          command,
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          duration: Date.now() - startTime,
          error,
          errorMessage,
        });
      });

      child.on("error", error => {
        let errorType: VerificationResult["error"] = "execution_error";
        let errorMessage = error.message;

        if (error.message.includes("ENOENT") || error.message.includes("not found")) {
          errorType = "not_found";
          errorMessage = `Command not found: ${command}`;
        }

        settle({
          command,
          success: false,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: null,
          duration: Date.now() - startTime,
          error: errorType,
          errorMessage,
        });
      });
    });
  }

  /**
   * 按顺序运行多个验证命令
   */
  async verifyCommands(
    commands: string[],
    options: Partial<VerifierOptions> = {}
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const command of commands) {
      if (command.trim() === "") {
        continue; // 跳过空命令
      }

      const result = await this.verifyCommand(command, options);
      results.push(result);

      // 如果命令失败，可以选择继续或停止
      // 这里选择继续运行所有命令，以便收集完整的验证结果
    }

    return results;
  }

  /**
   * 检查命令是否存在（不执行）
   */
  async checkCommandExists(command: string): Promise<boolean> {
    return commandExists(command, this.defaultEnv);
  }

  /**
   * 格式化验证结果为可读字符串
   */
  static formatResults(results: VerificationResult[]): string {
    const lines: string[] = [];

    lines.push("=== Verification Results ===");
    lines.push("");

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const statusIcon = result.success ? "✓" : "✗";
      const statusText = result.success ? "PASSED" : "FAILED";

      lines.push(`[${i + 1}] ${statusIcon} ${result.command}`);
      lines.push(`    Status: ${statusText}`);
      lines.push(`    Exit code: ${result.exitCode ?? "N/A"}`);
      lines.push(`    Duration: ${result.duration}ms`);

      if (result.error) {
        lines.push(`    Error: ${result.error}`);
        if (result.errorMessage) {
          lines.push(`    Message: ${result.errorMessage}`);
        }
      }

      if (result.stdout) {
        lines.push(
          `    stdout: ${result.stdout.substring(0, 200)}${result.stdout.length > 200 ? "..." : ""}`
        );
      }

      if (result.stderr) {
        lines.push(
          `    stderr: ${result.stderr.substring(0, 200)}${result.stderr.length > 200 ? "..." : ""}`
        );
      }

      lines.push("");
    }

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    lines.push(`Summary: ${passed} passed, ${failed} failed`);

    return lines.join("\n");
  }
}
