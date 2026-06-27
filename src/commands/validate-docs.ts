import * as fs from "fs";
import * as path from "path";
import { DocsScanner } from "../core/docs-scanner.js";
import { TaskParser } from "../core/task-parser.js";
import { TaskNormalizer } from "../core/task-normalizer.js";

export interface ValidateDocsResult {
  success: boolean;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  severity: "error" | "critical";
}

export interface ValidationWarning {
  file: string;
  line?: number;
  message: string;
}

const REQUIRED_DOCS = [
  { name: "Product Brief", pattern: /00.*PRODUCT.*BRIEF/i },
  { name: "PRD", pattern: /01.*PRD/i },
  { name: "System Architecture", pattern: /03.*SYSTEM.*ARCHITECTURE/i },
  { name: "TASKS", pattern: /TASKS/i },
];

const RECOMMENDED_DOCS = [
  { name: "CLI Command Spec", pattern: /08.*CLI.*COMMAND/i },
  { name: "Data Schemas", pattern: /10.*DATA.*SCHEMAS/i },
  { name: "Roadmap", pattern: /15.*ROADMAP/i },
];

export function runValidateDocs(docsPath: string = "./docs"): ValidateDocsResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let totalFiles = 0;
  let validFiles = 0;

  if (!fs.existsSync(docsPath)) {
    errors.push({
      file: docsPath,
      message: "Docs directory does not exist",
      severity: "critical",
    });
    return {
      success: false,
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      errors,
      warnings,
    };
  }

  const scanner = new DocsScanner(docsPath);
  const scanResult = scanner.scan();

  totalFiles = scanResult.total_files;

  if (scanResult.errors.length > 0) {
    for (const error of scanResult.errors) {
      errors.push({
        file: docsPath,
        message: error,
        severity: "error",
      });
    }
  }

  warnings.push(...scanResult.warnings.map(w => ({ file: docsPath, message: w })));

  checkRequiredDocs(scanResult.entries, errors, warnings);
  checkRecommendedDocs(scanResult.entries, warnings);

  const tasksMdEntry = scanResult.entries.find(e => e.filename.match(/TASKS/i));
  if (tasksMdEntry) {
    const taskValidation = validateTasksMd(tasksMdEntry.path, path.basename(tasksMdEntry.path));
    errors.push(...taskValidation.errors);
    warnings.push(...taskValidation.warnings);

    if (taskValidation.errors.length === 0) {
      validFiles++;
    }
  }

  for (const entry of scanResult.entries) {
    const mdValidation = validateMarkdown(entry.path, entry.filename);
    errors.push(...mdValidation.errors);
    warnings.push(...mdValidation.warnings);

    if (mdValidation.errors.length === 0) {
      validFiles++;
    }
  }

  return {
    success: errors.length === 0,
    totalFiles,
    validFiles,
    invalidFiles: totalFiles - validFiles,
    errors,
    warnings,
  };
}

function checkRequiredDocs(entries: Array<{ filename: string; path: string }>, errors: ValidationError[], warnings: ValidationWarning[]) {
  for (const required of REQUIRED_DOCS) {
    const found = entries.some(e => e.filename.match(required.pattern));
    if (!found) {
      errors.push({
        file: "docs/",
        message: `Missing required document: ${required.name}`,
        severity: "error",
      });
    }
  }
}

function checkRecommendedDocs(entries: Array<{ filename: string; path: string }>, warnings: ValidationWarning[]) {
  for (const recommended of RECOMMENDED_DOCS) {
    const found = entries.some(e => e.filename.match(recommended.pattern));
    if (!found) {
      warnings.push({
        file: "docs/",
        message: `Missing recommended document: ${recommended.name}`,
      });
    }
  }
}

function validateTasksMd(filePath: string, filename: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parser = new TaskParser(content);
    const parseResult = parser.parse();

    for (const error of parseResult.errors) {
      errors.push({
        file: filename,
        line: error.line,
        message: `Parse error: ${error.message}`,
        severity: "error",
      });
    }

    for (const warning of parseResult.warnings) {
      warnings.push({
        file: filename,
        message: warning,
      });
    }

    if (parseResult.tasks.length === 0) {
      warnings.push({
        file: filename,
        message: "No tasks found in TASKS.md",
      });
    }

    const normalizer = new TaskNormalizer();
    const normalizeResult = normalizer.normalize(parseResult.tasks);

    for (const error of normalizeResult.dependencyErrors) {
      errors.push({
        file: filename,
        message: `Dependency error: ${error}`,
        severity: "error",
      });
    }

    for (const warning of normalizeResult.warnings) {
      warnings.push({
        file: filename,
        message: warning,
      });
    }

  } catch (err) {
    errors.push({
      file: filename,
      message: `Failed to read or parse: ${(err as Error).message}`,
      severity: "critical",
    });
  }

  return { errors, warnings };
}

function validateMarkdown(filePath: string, filename: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);

    if (content.trim() === "") {
      warnings.push({
        file: filename,
        message: "Empty document",
      });
    }

    if (!lines[0]?.startsWith("#")) {
      warnings.push({
        file: filename,
        line: 1,
        message: "Document should start with a level 1 heading",
      });
    }

    let lineNum = 0;
    for (const line of lines) {
      lineNum++;

      if (line.length > 120) {
        warnings.push({
          file: filename,
          line: lineNum,
          message: "Line exceeds 120 characters",
        });
      }

      if (/^(#{7,})\s/.test(line)) {
        errors.push({
          file: filename,
          line: lineNum,
          message: "Heading level too deep (more than 6 #)",
          severity: "error",
        });
      }
    }

  } catch (err) {
    errors.push({
      file: filename,
      message: `Failed to read: ${(err as Error).message}`,
      severity: "critical",
    });
  }

  return { errors, warnings };
}

export function formatValidateDocsOutput(result: ValidateDocsResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Docs Validation ===");
  lines.push("");

  lines.push(`Documents scanned: ${result.totalFiles}`);
  lines.push(`Valid documents: ${result.validFiles}`);
  lines.push(`Invalid documents: ${result.invalidFiles}`);
  lines.push("");

  if (result.errors.length > 0) {
    lines.push("❌ Errors:");
    for (const error of result.errors) {
      const lineInfo = error.line ? `:${error.line}` : "";
      const severity = error.severity === "critical" ? "[CRITICAL]" : "[ERROR]";
      lines.push(`  ${severity} ${error.file}${lineInfo}: ${error.message}`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("⚠️ Warnings:");
    for (const warning of result.warnings) {
      const lineInfo = warning.line ? `:${warning.line}` : "";
      lines.push(`  ${warning.file}${lineInfo}: ${warning.message}`);
    }
    lines.push("");
  }

  if (result.success) {
    lines.push("✅ All documents are valid!");
  } else {
    lines.push("❌ Validation failed due to errors.");
  }

  return lines.join("\n");
}