import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

const WINDOWS_SHELL_BUILTINS = new Set([
  "assoc",
  "call",
  "cd",
  "chdir",
  "cls",
  "copy",
  "del",
  "dir",
  "echo",
  "erase",
  "exit",
  "for",
  "if",
  "md",
  "mkdir",
  "move",
  "path",
  "rd",
  "rem",
  "ren",
  "rename",
  "rmdir",
  "set",
  "shift",
  "type",
]);

const POSIX_SHELL_BUILTINS = new Set([
  "[",
  "alias",
  "cd",
  "command",
  "echo",
  "eval",
  "exec",
  "exit",
  "export",
  "false",
  "pwd",
  "read",
  "set",
  "test",
  "true",
  "type",
  "ulimit",
  "umask",
  "unset",
]);

export interface ShellInvocation {
  command: string;
  args: string[];
}

export function createShellInvocation(command: string): ShellInvocation {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `"${command}"`],
    };
  }

  return {
    command: process.env.SHELL || "/bin/sh",
    args: ["-c", command],
  };
}

export function extractCommandExecutable(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const quote = trimmed[0];
  if (quote === '"' || quote === "'") {
    const closingIndex = trimmed.indexOf(quote, 1);
    if (closingIndex > 1) {
      return trimmed.slice(1, closingIndex);
    }
  }

  return trimmed.split(/\s+/)[0] || null;
}

export function resolveExecutablePath(
  executable: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const normalized = stripWrappingQuotes(executable);

  if (isPathLike(normalized)) {
    return resolvePathWithExtensions(normalized, env);
  }

  const pathValue = env.PATH || env.Path || env.path || "";
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);

  for (const entry of pathEntries) {
    const resolved = resolvePathWithExtensions(path.join(entry, normalized), env);
    if (resolved) return resolved;
  }

  return null;
}

export function commandExists(command: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const executable = extractCommandExecutable(command);
  if (!executable) return false;

  const normalized = stripWrappingQuotes(executable).toLowerCase();
  const builtins = process.platform === "win32" ? WINDOWS_SHELL_BUILTINS : POSIX_SHELL_BUILTINS;
  if (builtins.has(normalized)) {
    return true;
  }

  return resolveExecutablePath(executable, env) !== null;
}

export function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    const escaped = value.replace(/"/g, '\\"');
    return /[\s&()^|<>"]/.test(value) ? `"${escaped}"` : escaped;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function terminateProcessTree(child: ChildProcess): void {
  if (!child.pid) return;

  // Windows 的 shell 命令经常会再启动子进程；杀进程树避免超时后留下后台任务。
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", () => {
      child.kill("SIGTERM");
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isPathLike(value: string): boolean {
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function resolvePathWithExtensions(
  candidate: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (fs.existsSync(candidate)) {
    return candidate;
  }

  if (process.platform !== "win32" || path.extname(candidate)) {
    return null;
  }

  const extensions = (env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map(extension => extension.trim())
    .filter(Boolean);

  for (const extension of extensions) {
    const resolved = `${candidate}${extension}`;
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}
