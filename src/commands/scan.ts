import { DocsScanner } from "../core/docs-scanner.js";
import { TaskParser, type ParseResult } from "../core/task-parser.js";
import { TaskNormalizer, type NormalizeResult } from "../core/task-normalizer.js";
import { StateManager } from "../core/state-manager.js";
import { ensureDirectoryExists } from "../core/file-utils.js";
import type { DocIndexEntry } from "../types/state.js";
import * as fs from "fs";
import * as path from "path";

export interface ScanResult {
  success: boolean;
  message: string;
  docsScanned: number;
  tasksParsed: number;
  errors: string[];
  warnings: string[];
}

export async function runScan(): Promise<ScanResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const scanner = new DocsScanner("./docs");
  const manager = new StateManager();

  manager.load();

  const scanResult = scanner.scan();
  if (scanResult.errors.length > 0) {
    errors.push(...scanResult.errors);
    return {
      success: false,
      message: "Failed to scan docs directory",
      docsScanned: 0,
      tasksParsed: 0,
      errors,
      warnings,
    };
  }

  manager.setDocIndex(scanResult.entries);

  warnings.push(...scanResult.warnings);

  const tasksMdEntry = scanResult.entries.find(e => e.filename.includes("TASKS"));
  if (!tasksMdEntry) {
    errors.push("TASKS.md not found in docs directory");
    manager.save();
    return {
      success: false,
      message: "TASKS.md not found",
      docsScanned: scanResult.total_files,
      tasksParsed: 0,
      errors,
      warnings,
    };
  }

  try {
    const content = fs.readFileSync(tasksMdEntry.path, "utf-8");
    const parser = new TaskParser(content);
    const parseResult = parser.parse();

    if (parseResult.errors.length > 0) {
      warnings.push(...parseResult.errors.map(e => `Parse error: ${e.message}`));
    }

    warnings.push(...parseResult.warnings);

    const normalizer = new TaskNormalizer();
    const normalizeResult = normalizer.normalize(parseResult.tasks);

    if (normalizeResult.dependencyErrors.length > 0) {
      warnings.push(...normalizeResult.dependencyErrors);
    }

    warnings.push(...normalizeResult.warnings);

    manager.setTasks(normalizeResult.tasks);
    manager.updateState({ last_scan_at: new Date().toISOString() });

    if (normalizeResult.tasks.length > 0) {
      const completedCount = normalizeResult.tasks.filter(t => t.status === "done").length;
      const pendingCount = normalizeResult.tasks.filter(t => t.status === "pending").length;
      warnings.push(
        `Progress: ${completedCount}/${normalizeResult.tasks.length} tasks completed (${pendingCount} pending)`
      );
    }

    manager.save();

    generateScanReport(scanResult, normalizeResult, parseResult);

    return {
      success: true,
      message: `Successfully scanned ${scanResult.total_files} docs and parsed ${normalizeResult.tasks.length} tasks`,
      docsScanned: scanResult.total_files,
      tasksParsed: normalizeResult.tasks.length,
      errors,
      warnings,
    };
  } catch (err) {
    errors.push(`Failed to read or parse TASKS.md: ${(err as Error).message}`);
    return {
      success: false,
      message: "Failed to parse TASKS.md",
      docsScanned: scanResult.total_files,
      tasksParsed: 0,
      errors,
      warnings,
    };
  }
}

export function formatScanOutput(result: ScanResult): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push("=== Codex PM Scan ===");
    lines.push("");
    lines.push(`✓ ${result.message}`);
    lines.push("");
    lines.push("Details:");
    lines.push(`  - Documents scanned: ${result.docsScanned}`);
    lines.push(`  - Tasks parsed: ${result.tasksParsed}`);
    lines.push("");

    if (result.warnings.length > 0) {
      lines.push("Warnings:");
      for (const warning of result.warnings) {
        lines.push(`  ! ${warning}`);
      }
      lines.push("");
    }

    lines.push("State saved to .codex-pm/");
  } else {
    lines.push("=== Codex PM Scan ===");
    lines.push("");
    lines.push(`✗ ${result.message}`);
    lines.push("");

    if (result.errors.length > 0) {
      lines.push("Errors:");
      for (const error of result.errors) {
        lines.push(`  - ${error}`);
      }
      lines.push("");
    }

    if (result.warnings.length > 0) {
      lines.push("Warnings:");
      for (const warning of result.warnings) {
        lines.push(`  ! ${warning}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function generateScanReport(
  scanResult: { entries: DocIndexEntry[]; total_files: number; warnings: string[] },
  normalizeResult: NormalizeResult,
  parseResult: ParseResult
): void {
  const reportDir = ".codex-pm";
  ensureDirectoryExists(reportDir);

  const reportLines: string[] = [];

  reportLines.push("# Codex PM Scan Report");
  reportLines.push("");
  reportLines.push(`Generated at: ${new Date().toISOString()}`);
  reportLines.push("");

  reportLines.push("## Document Index");
  reportLines.push("");
  reportLines.push(`Total documents scanned: ${scanResult.total_files}`);
  reportLines.push("");
  reportLines.push("| File | Size |");
  reportLines.push("|------|------|");
  for (const entry of scanResult.entries) {
    reportLines.push(`| ${entry.filename} | ${entry.size} bytes |`);
  }
  reportLines.push("");

  reportLines.push("## Task Analysis");
  reportLines.push("");
  reportLines.push(`Total tasks: ${normalizeResult.tasks.length}`);

  const doneCount = normalizeResult.tasks.filter(t => t.status === "done").length;
  const pendingCount = normalizeResult.tasks.filter(t => t.status === "pending").length;
  const failedCount = normalizeResult.tasks.filter(t => t.status === "failed").length;

  reportLines.push(`- Done: ${doneCount}`);
  reportLines.push(`- Pending: ${pendingCount}`);
  reportLines.push(`- Failed: ${failedCount}`);
  reportLines.push("");

  if (normalizeResult.tasks.length > 0) {
    reportLines.push("### Task Status Breakdown");
    reportLines.push("");
    reportLines.push("| Task ID | Title | Status | Risk | Priority |");
    reportLines.push("|---------|-------|--------|------|----------|");
    for (const task of normalizeResult.tasks) {
      reportLines.push(`| ${task.id} | ${task.title} | ${task.status} | ${task.risk} | ${task.priority} |`);
    }
    reportLines.push("");
  }

  if (parseResult.errors.length > 0) {
    reportLines.push("## Parse Errors");
    reportLines.push("");
    for (const error of parseResult.errors) {
      reportLines.push(`- Line ${error.line}: ${error.message}`);
    }
    reportLines.push("");
  }

  if (normalizeResult.dependencyErrors.length > 0) {
    reportLines.push("## Dependency Errors");
    reportLines.push("");
    for (const error of normalizeResult.dependencyErrors) {
      reportLines.push(`- ${error}`);
    }
    reportLines.push("");
  }

  if (scanResult.warnings.length > 0 || parseResult.warnings.length > 0 || normalizeResult.warnings.length > 0) {
    reportLines.push("## Warnings");
    reportLines.push("");
    for (const warning of [...scanResult.warnings, ...parseResult.warnings, ...normalizeResult.warnings]) {
      reportLines.push(`- ${warning}`);
    }
    reportLines.push("");
  }

  const reportPath = path.join(reportDir, "scan-report.md");
  fs.writeFileSync(reportPath, reportLines.join("\n"));
}
