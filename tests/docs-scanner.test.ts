import { describe, it } from "node:test";
import assert from "node:assert";
import { DocsScanner } from "../src/core/docs-scanner.js";

describe("Docs Scanner", () => {
  describe("scan", () => {
    it("should scan docs directory and return entries", () => {
      const scanner = new DocsScanner("./docs");
      const result = scanner.scan();

      assert.ok(result.entries.length > 0, "Should find at least one markdown file");
      assert.ok(Array.isArray(result.errors), "Errors should be an array");
      assert.ok(Array.isArray(result.warnings), "Warnings should be an array");
      assert.strictEqual(result.total_files, result.entries.length);
      assert.ok(result.scan_time);
    });

    it("should find TASKS.md", () => {
      const scanner = new DocsScanner("./docs");
      const result = scanner.scan();

      const hasTasksMd = result.entries.some(e => e.filename.includes("TASKS"));
      assert.ok(hasTasksMd, "TASKS.md should be found");
    });

    it("should handle non-existent directory gracefully", () => {
      const scanner = new DocsScanner("./nonexistent");
      const result = scanner.scan();

      assert.strictEqual(result.total_files, 0);
      assert.ok(result.errors.length > 0);
    });

    it("should have valid entry structure", () => {
      const scanner = new DocsScanner("./docs");
      const result = scanner.scan();

      if (result.entries.length > 0) {
        const entry = result.entries[0];
        assert.ok(entry.filename, "Entry should have filename");
        assert.ok(entry.path, "Entry should have path");
        assert.ok(entry.hash, "Entry should have hash");
        assert.ok(entry.size >= 0, "Entry should have size");
        assert.ok(entry.last_modified, "Entry should have last_modified");
      }
    });
  });

  describe("checkRequiredDocs", () => {
    it("should identify missing required docs", () => {
      const scanner = new DocsScanner("./docs");
      const result = scanner.scan();
      const missing = scanner.checkRequiredDocs(result.entries);

      assert.ok(Array.isArray(missing));
    });
  });
});
