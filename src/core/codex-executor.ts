import { spawn } from "child_process";
import * as fs from "fs";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access" | false;

export interface CodexExecutorConfig {
  /** 执行命令时的超时时间（毫秒），0 表示无超时 */
  timeout: number;
  /** Codex 沙箱模式；false 仅保留为旧配置兼容，真实执行会被拒绝 */
  sandbox: CodexSandboxMode;
  /** Codex 命令路径或名称 */
  command: string;
  /** Codex 命令的默认参数 */
  defaultArgs: string[];
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

export interface CodexExecutionResult {
  /** 执行是否成功 */
  success: boolean;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number | null;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 错误信息 */
  error?: string;
  /** 结果文件路径 */
  resultFile?: string;
}

export interface CodexExecutorOptions {
  /** 是否为 dry-run 模式 */
  dryRun?: boolean;
  /** Codex 提示文件路径 */
  promptFile?: string;
  /** 额外的 Codex 参数 */
  extraArgs?: string[];
  /** 执行超时时间（毫秒），0 表示无超时 */
  timeout?: number;
  /** Codex 沙箱模式 */
  sandbox?: CodexSandboxMode;
  /** 结果文件路径 */
  resultFile?: string;
}

const DEFAULT_CONFIG: CodexExecutorConfig = {
  timeout: 300000, // 5分钟
  sandbox: "workspace-write",
  command: "codex",
  defaultArgs: ["exec"],
};

export class CodexExecutor {
  private config: CodexExecutorConfig;

  constructor(config: Partial<CodexExecutorConfig> = {}) {
    // 每次都创建新对象，防止测试之间共享状态
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(updates: Partial<CodexExecutorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): CodexExecutorConfig {
    return { ...this.config };
  }

  async execute(options: CodexExecutorOptions = {}): Promise<CodexExecutionResult> {
    const {
      dryRun = false,
      promptFile,
      extraArgs = [],
      timeout = this.config.timeout,
      sandbox = this.config.sandbox,
      resultFile,
    } = options;

    const startTime = Date.now();

    // Dry-run 模式
    if (dryRun) {
      return this.dryRun(promptFile, extraArgs);
    }

    // 检查 prompt 文件
    if (!promptFile) {
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: null,
        duration: Date.now() - startTime,
        error: "No prompt file provided",
      };
    }

    if (!fs.existsSync(promptFile)) {
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: null,
        duration: Date.now() - startTime,
        error: `Prompt file not found: ${promptFile}`,
      };
    }

    const safetyError = this.validateRealExecutionSafety(sandbox, [
      ...this.config.defaultArgs,
      ...extraArgs,
    ]);
    if (safetyError) {
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: null,
        duration: Date.now() - startTime,
        error: safetyError,
      };
    }

    // 构建命令参数
    const args = this.buildArgs(promptFile, extraArgs, sandbox);

    // 如果有结果文件，添加到参数
    const actualResultFile = resultFile || `.codex-pm/results/${Date.now()}.json`;
    if (actualResultFile) {
      args.push("--output", actualResultFile);
    }

    try {
      const result = await this.runCommand(this.config.command, args, {
        timeout,
        cwd: this.config.cwd,
        env: this.config.env,
      });

      return {
        ...result,
        resultFile: fs.existsSync(actualResultFile) ? actualResultFile : undefined,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private dryRun(promptFile?: string, extraArgs: string[] = []): CodexExecutionResult {
    const duration = 0;

    if (!promptFile) {
      return {
        success: true,
        stdout: "",
        stderr: "",
        exitCode: null,
        duration,
        error: undefined,
      };
    }

    const dryRunCommand = `${this.config.command} ${this.buildArgs(promptFile, extraArgs).join(
      " "
    )}`;

    return {
      success: true,
      stdout: `DRY-RUN MODE\n\nWould execute:\n  ${dryRunCommand}\n\nPrompt file: ${promptFile}`,
      stderr: "",
      exitCode: null,
      duration,
      error: undefined,
    };
  }

  private buildArgs(
    promptFile?: string,
    extraArgs: string[] = [],
    sandbox: CodexSandboxMode = this.config.sandbox
  ): string[] {
    const args = [...this.config.defaultArgs];

    if (sandbox !== false) {
      args.push("--sandbox", sandbox);
    }

    if (promptFile) {
      args.push(promptFile);
    }

    args.push(...extraArgs);
    return args;
  }

  private validateRealExecutionSafety(sandbox: CodexSandboxMode, args: string[]): string | null {
    if (!this.isKnownSandboxMode(sandbox)) {
      return `Invalid Codex sandbox mode: ${String(sandbox)}`;
    }

    if (sandbox === false || sandbox === "danger-full-access") {
      return "Unsafe Codex execution options: sandbox cannot be disabled for managed real execution.";
    }

    if (this.hasRawSandboxOverride(args)) {
      return "Unsafe Codex execution options: pass sandbox via the sandbox option, not raw Codex args.";
    }

    if (args.some(arg => arg.includes("dangerously-bypass-approvals-and-sandbox"))) {
      return "Unsafe Codex execution options: bypassing approvals and sandbox is not allowed.";
    }

    if (args.some(arg => arg === "danger-full-access" || arg.includes("danger-full-access"))) {
      return "Unsafe Codex execution options: danger-full-access sandbox is not allowed.";
    }

    return null;
  }

  private hasRawSandboxOverride(args: string[]): boolean {
    return args.some(arg => arg === "--sandbox" || arg.startsWith("--sandbox="));
  }

  private isKnownSandboxMode(value: unknown): value is CodexSandboxMode {
    return (
      value === "read-only" ||
      value === "workspace-write" ||
      value === "danger-full-access" ||
      value === false
    );
  }

  private runCommand(
    command: string,
    args: string[],
    options: {
      timeout: number;
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<CodexExecutionResult> {
    return new Promise(resolve => {
      let stdout = "";
      let stderr = "";
      let killed = false;

      const child = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: true,
      });

      child.stdout?.on("data", data => {
        stdout += data.toString();
      });

      child.stderr?.on("data", data => {
        stderr += data.toString();
      });

      // 超时处理
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout > 0) {
        timeoutId = setTimeout(() => {
          killed = true;
          child.kill("SIGTERM");
        }, options.timeout);
      }

      child.on("close", code => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          success: code === 0 && !killed,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          duration: 0, // 由调用者计算
          error: killed ? "Process killed due to timeout" : undefined,
        });
      });

      child.on("error", error => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          success: false,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: null,
          duration: 0,
          error: error.message,
        });
      });
    });
  }

  /**
   * 验证 Codex 是否可用
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    return new Promise(resolve => {
      const child = spawn(this.config.command, ["--version"], {
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", data => {
        stdout += data.toString();
      });

      child.stderr?.on("data", data => {
        stderr += data.toString();
      });

      child.on("close", code => {
        if (code === 0) {
          resolve({
            available: true,
            version: stdout.trim() || undefined,
          });
        } else {
          resolve({
            available: false,
            error: stderr.trim() || `Command exited with code ${code}`,
          });
        }
      });

      child.on("error", error => {
        resolve({
          available: false,
          error: error.message,
        });
      });

      // 5秒超时
      setTimeout(() => {
        child.kill();
        resolve({
          available: false,
          error: "Timeout checking Codex availability",
        });
      }, 5000);
    });
  }
}
