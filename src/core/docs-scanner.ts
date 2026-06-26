import * as fs from "fs";
import * as path from "path";
import { calculateFileHash, readFileSafe, getFileSize, getLastModified } from "./file-utils.js";
import type { DocIndexEntry } from "../types/state.js";

export interface DocsScanResult {
  entries: DocIndexEntry[];
  errors: string[];
  warnings: string[];
  total_files: number;
  scan_time: string;
}

export class DocsScanner {
  private docsPath: string;

  constructor(docsPath: string = "./docs") {
    this.docsPath = docsPath;
  }

  scan(): DocsScanResult {
    const entries: DocIndexEntry[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fs.existsSync(this.docsPath)) {
      errors.push(`Docs directory not found: ${this.docsPath}`);
      return { entries, errors, warnings, total_files: 0, scan_time: new Date().toISOString() };
    }

    try {
      const files = fs.readdirSync(this.docsPath);

      for (const file of files) {
        const filePath = path.join(this.docsPath, file);

        try {
          const stats = fs.statSync(filePath);

          if (stats.isFile() && file.endsWith(".md")) {
            const content = readFileSafe(filePath);

            if (content !== null) {
              const entry: DocIndexEntry = {
                filename: file,
                path: filePath,
                hash: calculateFileHash(content),
                size: getFileSize(filePath),
                last_modified: getLastModified(filePath),
              };
              entries.push(entry);
            } else {
              warnings.push(`Unable to read file: ${file}`);
            }
          }
        } catch (err) {
          errors.push(`Error processing file ${file}: ${(err as Error).message}`);
        }
      }

      if (entries.length === 0) {
        warnings.push("No Markdown files found in docs directory");
      }

      if (!entries.some(e => e.filename.includes("TASKS"))) {
        warnings.push("TASKS.md not found - this is required for task execution");
      }
    } catch (err) {
      errors.push(`Failed to scan docs directory: ${(err as Error).message}`);
    }

    return {
      entries,
      errors,
      warnings,
      total_files: entries.length,
      scan_time: new Date().toISOString(),
    };
  }

  getRequiredDocs(): string[] {
    return ["TASKS.md"];
  }

  checkRequiredDocs(entries: DocIndexEntry[]): string[] {
    const missing: string[] = [];
    const required = this.getRequiredDocs();

    for (const doc of required) {
      if (!entries.some(e => e.filename === doc)) {
        missing.push(doc);
      }
    }

    return missing;
  }
}
