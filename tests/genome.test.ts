import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GenomeManager } from "../src/core/genome.js";
import type { PmGenome } from "../src/types/genome.js";

describe("Genome Manager", () => {
  describe("constructor", () => {
    it("should load default genomes", () => {
      const manager = new GenomeManager();
      const genomes = manager.getAllGenomes();
      assert.ok(genomes.length >= 4);
    });

    it("should have balanced as active genome by default", () => {
      const manager = new GenomeManager();
      const active = manager.getActiveGenome();
      assert.ok(active);
      assert.strictEqual(active?.profile, "balanced");
    });

    it("should load default genomes outside the repository cwd", () => {
      const previousCwd = process.cwd();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-pm-genome-cwd-"));

      try {
        process.chdir(tempDir);
        const manager = new GenomeManager();
        const profiles = manager.listProfiles();

        assert.ok(profiles.includes("balanced"));
        assert.ok(profiles.includes("conservative"));
        assert.ok(profiles.includes("startup"));
        assert.ok(profiles.includes("research"));
      } finally {
        process.chdir(previousCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("getAllGenomes", () => {
    it("should return all loaded genomes", () => {
      const manager = new GenomeManager();
      const genomes = manager.getAllGenomes();
      assert.ok(Array.isArray(genomes));
      assert.ok(genomes.length > 0);
    });
  });

  describe("getGenome", () => {
    it("should return genome by id", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenome("balanced-v1");
      assert.ok(genome);
      assert.strictEqual(genome?.id, "balanced-v1");
    });

    it("should return null for non-existent genome", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenome("nonexistent");
      assert.strictEqual(genome, null);
    });
  });

  describe("getGenomeByProfile", () => {
    it("should return genome by profile", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenomeByProfile("conservative");
      assert.ok(genome);
      assert.strictEqual(genome?.profile, "conservative");
    });

    it("should return null for non-existent profile", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenomeByProfile("nonexistent");
      assert.strictEqual(genome, null);
    });
  });

  describe("validateGenome", () => {
    it("should validate correct genome", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenome("balanced-v1");
      assert.ok(genome);
      assert.strictEqual(manager.validateGenome(genome), true);
    });

    it("should reject genome missing required fields", () => {
      const manager = new GenomeManager();
      const invalidGenome = {
        id: "test",
        profile: "test",
        // missing name, description, weights, etc.
      } as unknown as PmGenome;
      assert.strictEqual(manager.validateGenome(invalidGenome), false);
    });

    it("should reject null or undefined", () => {
      const manager = new GenomeManager();
      assert.strictEqual(manager.validateGenome(null), false);
      assert.strictEqual(manager.validateGenome(undefined), false);
    });
  });

  describe("toScorerConfig", () => {
    it("should convert genome to scorer config", () => {
      const manager = new GenomeManager();
      const genome = manager.getGenome("balanced-v1");
      assert.ok(genome);

      const config = manager.toScorerConfig(genome);
      assert.strictEqual(typeof config.priorityWeight, "number");
      assert.strictEqual(typeof config.unlockWeight, "number");
      assert.strictEqual(typeof config.riskPenaltyLow, "number");
      assert.strictEqual(typeof config.riskPenaltyMedium, "number");
      assert.strictEqual(typeof config.riskPenaltyHigh, "number");
      assert.strictEqual(typeof config.riskPenaltyCritical, "number");
      assert.strictEqual(typeof config.sizePenaltyXS, "number");
      assert.strictEqual(typeof config.sizePenaltyS, "number");
      assert.strictEqual(typeof config.sizePenaltyM, "number");
      assert.strictEqual(typeof config.sizePenaltyL, "number");
      assert.strictEqual(typeof config.sizePenaltyXL, "number");
      assert.strictEqual(typeof config.failurePenalty, "number");
      assert.strictEqual(typeof config.maxRetries, "number");
    });

    it("should have different configs for different profiles", () => {
      const manager = new GenomeManager();
      const balanced = manager.getGenome("balanced-v1");
      const conservative = manager.getGenome("conservative-v1");
      assert.ok(balanced);
      assert.ok(conservative);

      const balancedConfig = manager.toScorerConfig(balanced);
      const conservativeConfig = manager.toScorerConfig(conservative);

      // 保守型应该有更高的风险惩罚
      assert.ok(conservativeConfig.riskPenaltyHigh < balancedConfig.riskPenaltyHigh);
    });
  });

  describe("setActiveGenome", () => {
    it("should set active genome", () => {
      const manager = new GenomeManager();
      const result = manager.setActiveGenome("conservative-v1");
      assert.strictEqual(result, true);
      assert.strictEqual(manager.getActiveGenome()?.id, "conservative-v1");
    });

    it("should return false for non-existent genome", () => {
      const manager = new GenomeManager();
      const result = manager.setActiveGenome("nonexistent");
      assert.strictEqual(result, false);
    });
  });

  describe("listProfiles", () => {
    it("should list all unique profiles", () => {
      const manager = new GenomeManager();
      const profiles = manager.listProfiles();
      assert.ok(profiles.includes("balanced"));
      assert.ok(profiles.includes("conservative"));
      assert.ok(profiles.includes("startup"));
      assert.ok(profiles.includes("research"));
    });
  });

  describe("compareGenomes", () => {
    it("should compare two genomes", () => {
      const manager = new GenomeManager();
      const result = manager.compareGenomes("balanced-v1", "conservative-v1");
      assert.ok(result);
      assert.strictEqual(result?.identical, false);
      assert.ok(result?.differences.length > 0);
    });

    it("should return null for non-existent genomes", () => {
      const manager = new GenomeManager();
      const result = manager.compareGenomes("nonexistent1", "nonexistent2");
      assert.strictEqual(result, null);
    });
  });

  describe("profile characteristics", () => {
    it("conservative should have lowest risk tolerance", () => {
      const manager = new GenomeManager();
      const conservative = manager.getGenome("conservative-v1");
      const balanced = manager.getGenome("balanced-v1");
      const startup = manager.getGenome("startup-v1");

      assert.ok(conservative);
      assert.ok(balanced);
      assert.ok(startup);

      assert.ok(conservative.persona.risk_tolerance < balanced.persona.risk_tolerance);
      assert.ok(balanced.persona.risk_tolerance < startup.persona.risk_tolerance);
    });

    it("startup should have highest speed bias", () => {
      const manager = new GenomeManager();
      const startup = manager.getGenome("startup-v1");
      const conservative = manager.getGenome("conservative-v1");

      assert.ok(startup);
      assert.ok(conservative);

      assert.ok(startup.persona.speed_bias > conservative.persona.speed_bias);
    });

    it("conservative should have highest test strictness", () => {
      const manager = new GenomeManager();
      const conservative = manager.getGenome("conservative-v1");
      const startup = manager.getGenome("startup-v1");

      assert.ok(conservative);
      assert.ok(startup);

      assert.ok(conservative.persona.test_strictness > startup.persona.test_strictness);
    });
  });
});
