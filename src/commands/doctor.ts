import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { DocsScanner } from "../core/docs-scanner.js";
import { TaskParser, type ParseResult } from "../core/task-parser.js";
import { StateManager } from "../core/state-manager.js";
import type { CodexPmTask } from "../types/task.js";
import {
  commandExists,
  createShellInvocation,
  extractCommandExecutable,
  quoteShellArg,
  resolveExecutablePath,
} from "../core/command-utils.js";

export interface DoctorCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: string[];
}

export interface DoctorCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

export type DoctorCommandRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
  }
) => Promise<DoctorCommandResult>;

export interface DoctorOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  commandRunner?: DoctorCommandRunner;
}

interface DoctorContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  commandRunner: DoctorCommandRunner;
  usesCustomCommandRunner: boolean;
}

interface TasksCheckResult {
  checks: DoctorCheck[];
  tasks: CodexPmTask[];
  parseResult?: ParseResult;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
  const context = createDoctorContext(options);
  const checks: DoctorCheck[] = [];

  checks.push(...checkNodeVersion());
  checks.push(await checkToolVersion(context, "npm command", "npm", ["--version"]));
  checks.push(await checkToolVersion(context, "Git command", "git", ["--version"]));
  checks.push(...(await checkGitRepository(context)));
  checks.push(await checkToolVersion(context, "Codex CLI", "codex", ["--version"]));
  checks.push(...(await checkTypeScript()));
  checks.push(...checkDocsDirectory(context));

  const tasksResult = checkTasksMd(context);
  checks.push(...tasksResult.checks);
  checks.push(await checkVerifyCommands(context, tasksResult.tasks));

  checks.push(...checkStateDirectory(context));
  checks.push(...checkPluginFiles(context));

  return checks;
}

function createDoctorContext(options: DoctorOptions): DoctorContext {
  return {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...options.env },
    timeoutMs: options.timeoutMs ?? 5000,
    commandRunner: options.commandRunner || runCommand,
    usesCustomCommandRunner: Boolean(options.commandRunner),
  };
}

function checkNodeVersion(): DoctorCheck[] {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);

  if (majorVersion >= 20) {
    return [
      {
        name: "Node.js version",
        status: "pass",
        message: `Node.js ${nodeVersion} is supported`,
      },
    ];
  } else if (majorVersion >= 18) {
    return [
      {
        name: "Node.js version",
        status: "warn",
        message: `Node.js ${nodeVersion} may have limited support, recommend v20+`,
      },
    ];
  }

  return [
    {
      name: "Node.js version",
      status: "fail",
      message: `Node.js ${nodeVersion} is not supported, require v20+`,
    },
  ];
}

async function checkToolVersion(
  context: DoctorContext,
  name: string,
  command: string,
  args: string[]
): Promise<DoctorCheck> {
  const result = await context.commandRunner(command, args, context);

  if (result.exitCode === 0) {
    const version = firstOutputLine(result.stdout) || "available";
    return {
      name,
      status: "pass",
      message: `${command} ${version}`,
    };
  }

  return {
    name,
    status: "fail",
    message: `${command} is not available or not executable`,
    details: compactDetails([result.error, result.stderr]),
  };
}

async function checkGitRepository(context: DoctorContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const repoResult = await context.commandRunner(
    "git",
    ["rev-parse", "--is-inside-work-tree"],
    context
  );

  if (repoResult.exitCode !== 0 || firstOutputLine(repoResult.stdout) !== "true") {
    checks.push({
      name: "Git repository",
      status: "warn",
      message: "Current directory is not a Git repository",
      details: compactDetails([repoResult.stderr, repoResult.error]),
    });
    return checks;
  }

  checks.push({
    name: "Git repository",
    status: "pass",
    message: "Current directory is inside a Git repository",
  });

  const statusResult = await context.commandRunner("git", ["status", "--short"], context);
  if (statusResult.exitCode !== 0) {
    checks.push({
      name: "Git dirty state",
      status: "warn",
      message: "Unable to inspect Git dirty state",
      details: compactDetails([statusResult.stderr, statusResult.error]),
    });
  } else if (statusResult.stdout.trim()) {
    checks.push({
      name: "Git dirty state",
      status: "warn",
      message: "Working tree has uncommitted changes",
      details: statusResult.stdout.trim().split(/\r?\n/).slice(0, 20),
    });
  } else {
    checks.push({
      name: "Git dirty state",
      status: "pass",
      message: "Working tree is clean",
    });
  }

  return checks;
}

async function checkTypeScript(): Promise<DoctorCheck[]> {
  try {
    const ts = await import("typescript");
    return [
      {
        name: "TypeScript",
        status: "pass",
        message: `TypeScript v${ts.version} is available`,
      },
    ];
  } catch {
    return [
      {
        name: "TypeScript",
        status: "fail",
        message: "TypeScript is not installed",
      },
    ];
  }
}

function checkDocsDirectory(context: DoctorContext): DoctorCheck[] {
  const scanner = new DocsScanner(path.join(context.cwd, "docs"));
  const result = scanner.scan();
  const checks: DoctorCheck[] = [];

  if (result.errors.length > 0) {
    checks.push({
      name: "Docs directory",
      status: "fail",
      message: "Docs directory not found or inaccessible",
      details: result.errors,
    });
  } else {
    checks.push({
      name: "Docs directory",
      status: "pass",
      message: `Found ${result.total_files} documentation files`,
    });

    if (result.warnings.length > 0) {
      checks.push({
        name: "Docs warnings",
        status: "warn",
        message: "Some warnings found",
        details: result.warnings,
      });
    }
  }

  return checks;
}

function checkTasksMd(context: DoctorContext): TasksCheckResult {
  const checks: DoctorCheck[] = [];
  const tasksPath = findTasksFile(context.cwd);

  if (!tasksPath) {
    checks.push({
      name: "TASKS.md",
      status: "fail",
      message: "TASKS.md not found in docs directory",
    });
    return { checks, tasks: [] };
  }

  try {
    const content = fs.readFileSync(tasksPath, "utf-8");
    const parser = new TaskParser(content);
    const result = parser.parse();

    checks.push({
      name: "TASKS.md",
      status: result.errors.length > 0 ? "fail" : "pass",
      message: `Parsed ${result.tasks.length} tasks from ${path.relative(context.cwd, tasksPath)}`,
    });

    if (result.errors.length > 0) {
      checks.push({
        name: "TASKS.md parsing errors",
        status: "fail",
        message: `${result.errors.length} parsing errors found`,
        details: result.errors.map(error => `${error.task_id || "unknown"}: ${error.message}`),
      });
    }

    if (result.warnings.length > 0) {
      checks.push({
        name: "TASKS.md warnings",
        status: "warn",
        message: `${result.warnings.length} warnings found`,
        details: result.warnings,
      });
    }

    return { checks, tasks: result.tasks, parseResult: result };
  } catch (err) {
    checks.push({
      name: "TASKS.md",
      status: "fail",
      message: `Failed to read or parse TASKS.md: ${(err as Error).message}`,
    });
    return { checks, tasks: [] };
  }
}

async function checkVerifyCommands(
  context: DoctorContext,
  tasks: CodexPmTask[]
): Promise<DoctorCheck> {
  const executables = collectVerifyExecutables(tasks);

  if (executables.length === 0) {
    return {
      name: "Verify commands",
      status: "warn",
      message: "No verification commands found in tasks",
    };
  }

  const missing: string[] = [];
  for (const executable of executables) {
    const available = await isExecutableAvailable(context, executable);
    if (!available) {
      missing.push(executable);
    }
  }

  if (missing.length > 0) {
    return {
      name: "Verify commands",
      status: "fail",
      message: "Some verification command executables are missing",
      details: missing.map(command => `${command} is not available`),
    };
  }

  return {
    name: "Verify commands",
    status: "pass",
    message: `All ${executables.length} verification command executables are available`,
  };
}

function checkStateDirectory(context: DoctorContext): DoctorCheck[] {
  const manager = new StateManager(path.join(context.cwd, ".codex-pm"));
  const checks: DoctorCheck[] = [];

  if (!fs.existsSync(path.join(context.cwd, ".codex-pm"))) {
    checks.push({
      name: "State directory",
      status: "warn",
      message: ".codex-pm directory does not exist, will be created on first scan",
    });
    return checks;
  }

  manager.load();
  const state = manager.getState();

  checks.push({
    name: "State directory",
    status: "pass",
    message: ".codex-pm directory exists and is readable",
  });

  checks.push({
    name: "State version",
    status: "pass",
    message: `State version: ${state.version}`,
  });

  return checks;
}

function checkPluginFiles(context: DoctorContext): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const requiredFiles = [".codex-plugin/plugin.json", "skills/codex-pm/SKILL.md"];

  for (const file of requiredFiles) {
    const filePath = path.join(context.cwd, file);
    if (fs.existsSync(filePath)) {
      checks.push({
        name: file,
        status: "pass",
        message: `${file} exists`,
      });
    } else {
      checks.push({
        name: file,
        status: "warn",
        message: `${file} not found`,
      });
    }
  }

  return checks;
}

function collectVerifyExecutables(tasks: CodexPmTask[]): string[] {
  const executables = new Set<string>();

  for (const task of tasks) {
    for (const command of task.verify) {
      const executable = extractCommandExecutable(command);
      if (executable) {
        executables.add(executable);
      }
    }
  }

  return Array.from(executables).sort();
}

async function isExecutableAvailable(context: DoctorContext, executable: string): Promise<boolean> {
  if (!context.usesCustomCommandRunner) {
    return commandExists(executable, context.env);
  }

  const result = await context.commandRunner(executable, ["--version"], context);
  return result.exitCode === 0;
}

function findTasksFile(cwd: string): string | null {
  const docsDir = path.join(cwd, "docs");
  const preferred = [path.join(docsDir, "11_TASKS.md"), path.join(docsDir, "TASKS.md")];

  for (const candidate of preferred) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (!fs.existsSync(docsDir)) {
    return null;
  }

  const fallback = fs
    .readdirSync(docsDir)
    .filter(file => file.endsWith(".md") && file.toUpperCase().includes("TASKS"))
    .sort()[0];

  return fallback ? path.join(docsDir, fallback) : null;
}

function firstOutputLine(output: string): string {
  return output.trim().split(/\r?\n/).filter(Boolean)[0] || "";
}

function compactDetails(values: Array<string | undefined>): string[] {
  return values.map(value => value?.trim()).filter((value): value is string => Boolean(value));
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
  }
): Promise<DoctorCommandResult> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const env = { ...process.env, ...options.env };
    const resolvedCommand = resolveExecutablePath(command, env) || command;
    const invocation = buildCommandInvocation(resolvedCommand, args);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (result: DoctorCommandResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env,
      windowsVerbatimArguments: process.platform === "win32",
      windowsHide: true,
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      settle({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: null,
        error: `Timed out after ${options.timeoutMs}ms`,
      });
    }, options.timeoutMs);

    child.stdout?.on("data", data => {
      stdout += data.toString();
    });

    child.stderr?.on("data", data => {
      stderr += data.toString();
    });

    child.on("close", code => {
      clearTimeout(timeoutId);
      settle({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        error: code === 0 ? undefined : `Command exited with code ${code}`,
      });
    });

    child.on("error", error => {
      clearTimeout(timeoutId);
      settle({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: null,
        error: error.message || `Command failed after ${Date.now() - startTime}ms`,
      });
    });
  });
}

function buildCommandInvocation(
  command: string,
  args: string[]
): { command: string; args: string[] } {
  if (process.platform !== "win32") {
    return { command, args };
  }

  // Windows 下 .cmd/.bat 需要经由 cmd.exe；固定命令参数先逐项转义，避免拼接出错。
  const shellCommand = [command, ...args].map(quoteShellArg).join(" ");
  return createShellInvocation(shellCommand);
}

export function formatDoctorOutput(checks: DoctorCheck[]): string {
  const lines: string[] = [];
  lines.push("=== Codex PM Doctor ===");
  lines.push("");

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const prefix = check.status === "pass" ? "[✓]" : check.status === "warn" ? "[!]" : "[✗]";
    lines.push(`${prefix} ${check.name}`);
    lines.push(`  ${check.message}`);

    if (check.details && check.details.length > 0) {
      for (const detail of check.details) {
        lines.push(`    - ${detail}`);
      }
    }

    lines.push("");

    if (check.status === "pass") passCount++;
    else if (check.status === "warn") warnCount++;
    else failCount++;
  }

  lines.push("=== Summary ===");
  lines.push(`Pass: ${passCount}, Warn: ${warnCount}, Fail: ${failCount}`);

  if (failCount > 0) {
    lines.push("");
    lines.push("Please fix the failing checks before proceeding.");
  } else if (warnCount > 0) {
    lines.push("");
    lines.push("Some warnings detected, but you can proceed.");
  } else {
    lines.push("");
    lines.push("All checks passed!");
  }

  return lines.join("\n");
}
