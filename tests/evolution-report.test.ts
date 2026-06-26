import { describe, it } from "node:test";
import assert from "node:assert";
import { EvolutionReportGenerator } from "../src/core/evolution-report.js";

describe("Evolution Report Generator", () => {
  describe("generateReport", () => {
    it("should generate empty report when no episodes", () => {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport();

      assert.strictEqual(report.totalEpisodes, 0);
      assert.strictEqual(report.bestPerformingProfile, "-");
      assert.strictEqual(report.worstPerformingProfile, "-");
    });

    it("should generate report with profile filter", () => {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport({ profile: "balanced" });

      assert.ok(report);
      assert.strictEqual(typeof report.totalEpisodes, "number");
    });

    it("should limit episodes when specified", () => {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport({ episodes: 5 });

      assert.ok(report);
      assert.strictEqual(typeof report.totalEpisodes, "number");
    });
  });

  describe("formatReport", () => {
    it("should format empty report", () => {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport();
      const formatted = generator.formatReport(report);

      assert.ok(formatted.includes("Codex PM Evolution Report"));
      assert.ok(formatted.includes("Total Episodes: 0"));
    });

    it("should format report with data", () => {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport();
      const formatted = generator.formatReport(report);

      assert.ok(formatted.includes("Evolution Report"));
    });
  });
});
