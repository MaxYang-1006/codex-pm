import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { EpisodeLogger } from "../src/core/episode-logger.js";

describe("Episode Logger", () => {
  const testDir = ".test-codex-pm";
  const testFile = path.join(testDir, "episodes.jsonl");

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe("constructor", () => {
    it("should create logger with default options", () => {
      const logger = new EpisodeLogger();
      assert.ok(logger);
    });

    it("should create logger with custom baseDir", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });
      assert.ok(logger);
    });
  });

  describe("logEpisode", () => {
    it("should log episode and return full episode with id and timestamp", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      const episode = logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      assert.ok(episode.episode_id.startsWith("E"));
      assert.ok(episode.timestamp);
      assert.strictEqual(episode.task_id, "P0-T001");
      assert.strictEqual(episode.genome_id, "balanced-v1");
    });

    it("should increment episode ID for each log", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      const ep1 = logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      const ep2 = logger.logEpisode({
        task_id: "P0-T002",
        genome_id: "balanced-v1",
        selected_task_score: 65.0,
        risk_score: 0.2,
        energy_cost: 10,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 2,
        diff_lines: 100,
        reward: 8,
        penalty: 0,
        fitness_delta: 0.03,
      });

      const id1 = parseInt(ep1.episode_id.replace("E", ""), 10);
      const id2 = parseInt(ep2.episode_id.replace("E", ""), 10);
      assert.strictEqual(id2, id1 + 1);
    });

    it("should persist episodes to file", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      assert.ok(fs.existsSync(testFile));
      const content = fs.readFileSync(testFile, "utf-8");
      const lines = content.split("\n").filter(line => line.trim() !== "");
      assert.strictEqual(lines.length, 1);
    });
  });

  describe("createEpisode", () => {
    it("should create episode with named parameters", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      const episode = logger.createEpisode({
        taskId: "P1-T003",
        genomeId: "conservative-v1",
        selectedTaskScore: 80.0,
        riskScore: 0.1,
        energyCost: 15,
        codexStatus: "completed",
        verifyPassed: true,
        retryCount: 0,
        changedFiles: 5,
        diffLines: 200,
        reward: 10,
        penalty: 0,
        fitnessDelta: 0.05,
      });

      assert.ok(episode.episode_id.startsWith("E"));
      assert.strictEqual(episode.task_id, "P1-T003");
      assert.strictEqual(episode.genome_id, "conservative-v1");
      assert.strictEqual(episode.changed_files, 5);
      assert.strictEqual(episode.diff_lines, 200);
    });

    it("should use default values for optional fields", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      const episode = logger.createEpisode({
        taskId: "P1-T003",
        genomeId: "conservative-v1",
        selectedTaskScore: 80.0,
        riskScore: 0.1,
        energyCost: 15,
        codexStatus: "completed",
        verifyPassed: true,
        retryCount: 0,
      });

      assert.strictEqual(episode.changed_files, 0);
      assert.strictEqual(episode.diff_lines, 0);
      assert.strictEqual(episode.reward, 0);
      assert.strictEqual(episode.penalty, 0);
      assert.strictEqual(episode.fitness_delta, 0);
    });
  });

  describe("getAllEpisodes", () => {
    it("should return empty array when no episodes exist", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });
      const episodes = logger.getAllEpisodes();
      assert.deepStrictEqual(episodes, []);
    });

    it("should return all logged episodes", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      logger.logEpisode({
        task_id: "P0-T002",
        genome_id: "balanced-v1",
        selected_task_score: 65.0,
        risk_score: 0.2,
        energy_cost: 10,
        codex_status: "failed",
        verify_passed: false,
        retry_count: 1,
        changed_files: 0,
        diff_lines: 0,
        reward: -2,
        penalty: 3,
        fitness_delta: -0.01,
      });

      const episodes = logger.getAllEpisodes();
      assert.strictEqual(episodes.length, 2);
    });

    it("should respect limit parameter", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      for (let i = 0; i < 5; i++) {
        logger.logEpisode({
          task_id: `P0-T00${i}`,
          genome_id: "balanced-v1",
          selected_task_score: 70,
          risk_score: 0.3,
          energy_cost: 10,
          codex_status: "completed",
          verify_passed: true,
          retry_count: 0,
          changed_files: 1,
          diff_lines: 50,
          reward: 5,
          penalty: 0,
          fitness_delta: 0.02,
        });
      }

      const episodes = logger.getAllEpisodes(3);
      assert.strictEqual(episodes.length, 3);
    });
  });

  describe("getEpisodesByTaskId", () => {
    it("should return episodes for specific task", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 70.0,
        risk_score: 0.3,
        energy_cost: 10,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 1,
        changed_files: 2,
        diff_lines: 50,
        reward: 6,
        penalty: 0,
        fitness_delta: 0.02,
      });

      logger.logEpisode({
        task_id: "P0-T002",
        genome_id: "balanced-v1",
        selected_task_score: 65.0,
        risk_score: 0.2,
        energy_cost: 10,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 1,
        diff_lines: 30,
        reward: 5,
        penalty: 0,
        fitness_delta: 0.01,
      });

      const episodes = logger.getEpisodesByTaskId("P0-T001");
      assert.strictEqual(episodes.length, 2);
    });

    it("should return empty array for non-existent task", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      const episodes = logger.getEpisodesByTaskId("P9-T999");
      assert.deepStrictEqual(episodes, []);
    });
  });

  describe("getEpisodesByGenomeId", () => {
    it("should return episodes for specific genome", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      logger.logEpisode({
        task_id: "P0-T002",
        genome_id: "conservative-v1",
        selected_task_score: 80.0,
        risk_score: 0.1,
        energy_cost: 15,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 5,
        diff_lines: 200,
        reward: 10,
        penalty: 0,
        fitness_delta: 0.05,
      });

      const episodes = logger.getEpisodesByGenomeId("conservative-v1");
      assert.strictEqual(episodes.length, 1);
      assert.strictEqual(episodes[0].task_id, "P0-T002");
    });
  });

  describe("getStatistics", () => {
    it("should return empty statistics when no episodes", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });
      const stats = logger.getStatistics();

      assert.strictEqual(stats.totalEpisodes, 0);
      assert.deepStrictEqual(stats.byGenome, {});
      assert.deepStrictEqual(stats.byTask, {});
      assert.strictEqual(stats.averageReward, 0);
      assert.strictEqual(stats.averageFitnessDelta, 0);
      assert.strictEqual(stats.successRate, 0);
    });

    it("should calculate correct statistics", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 10,
        penalty: 0,
        fitness_delta: 0.04,
      });

      logger.logEpisode({
        task_id: "P0-T002",
        genome_id: "conservative-v1",
        selected_task_score: 80.0,
        risk_score: 0.1,
        energy_cost: 15,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 5,
        diff_lines: 200,
        reward: 8,
        penalty: 0,
        fitness_delta: 0.03,
      });

      const stats = logger.getStatistics();

      assert.strictEqual(stats.totalEpisodes, 2);
      assert.strictEqual(stats.byGenome["balanced-v1"], 1);
      assert.strictEqual(stats.byGenome["conservative-v1"], 1);
      assert.strictEqual(stats.byTask["P0-T001"], 1);
      assert.strictEqual(stats.byTask["P0-T002"], 1);
      assert.strictEqual(stats.averageReward, 9);
      assert.strictEqual(stats.averageFitnessDelta, 0.035);
      assert.strictEqual(stats.successRate, 1);
    });
  });

  describe("clearEpisodes", () => {
    it("should clear all episodes", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      logger.clearEpisodes();

      const episodes = logger.getAllEpisodes();
      assert.strictEqual(episodes.length, 0);
    });
  });

  describe("exportToFile and importFromFile", () => {
    it("should export and import episodes", () => {
      const logger = new EpisodeLogger({ baseDir: testDir });

      logger.logEpisode({
        task_id: "P0-T001",
        genome_id: "balanced-v1",
        selected_task_score: 72.4,
        risk_score: 0.32,
        energy_cost: 12,
        codex_status: "completed",
        verify_passed: true,
        retry_count: 0,
        changed_files: 4,
        diff_lines: 180,
        reward: 9,
        penalty: 1,
        fitness_delta: 0.04,
      });

      const exportPath = path.join(testDir, "export.json");
      const exported = logger.exportToFile(exportPath);
      assert.strictEqual(exported, true);
      assert.ok(fs.existsSync(exportPath));

      // 创建新的 logger 并导入
      const logger2 = new EpisodeLogger({ baseDir: path.join(testDir, "import") });
      const imported = logger2.importFromFile(exportPath);
      assert.strictEqual(imported, 1);
    });
  });
});
