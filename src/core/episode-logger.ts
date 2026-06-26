import * as fs from "fs";
import * as path from "path";
import { ensureDirectoryExists } from "./file-utils.js";

/**
 * Episode 记录 - 单次任务执行尝试
 *
 * 根据 docs/05_EVOLUTION_EXPERIMENT_SPEC.md 定义
 */
export interface Episode {
  episode_id: string;
  timestamp: string;
  task_id: string;
  genome_id: string;
  selected_task_score: number;
  risk_score: number;
  energy_cost: number;
  codex_status: "running" | "completed" | "failed" | "needs_review";
  verify_passed: boolean;
  retry_count: number;
  changed_files: number;
  diff_lines: number;
  reward: number;
  penalty: number;
  fitness_delta: number;
}

export interface EpisodeLoggerOptions {
  baseDir?: string;
  episodeFilePath?: string;
}

export class EpisodeLogger {
  private baseDir: string;
  private episodeFilePath: string;
  private episodeCounter: number = 0;

  constructor(options: EpisodeLoggerOptions = {}) {
    this.baseDir = options.baseDir || ".codex-pm";
    this.episodeFilePath = options.episodeFilePath || `${this.baseDir}/episodes.jsonl`;

    // 确保目录存在
    ensureDirectoryExists(this.baseDir);

    // 初始化 episode 计数器
    this.initializeCounter();
  }

  /**
   * 初始化 episode 计数器 - 读取已有的 episode 数量
   */
  private initializeCounter(): void {
    if (fs.existsSync(this.episodeFilePath)) {
      try {
        const content = fs.readFileSync(this.episodeFilePath, "utf-8");
        const lines = content.split("\n").filter(line => line.trim() !== "");

        if (lines.length > 0) {
          // 获取最后一个 episode 的 ID
          const lastLine = lines[lines.length - 1];
          const lastEpisode = JSON.parse(lastLine) as Episode;
          const match = lastEpisode.episode_id.match(/E(\d+)/);
          if (match) {
            this.episodeCounter = parseInt(match[1], 10);
          }
        }
      } catch {
        // 文件可能为空或格式不正确，使用默认值 0
        this.episodeCounter = 0;
      }
    }
  }

  /**
   * 生成下一个 episode ID
   */
  private generateEpisodeId(): string {
    this.episodeCounter++;
    return `E${String(this.episodeCounter).padStart(6, "0")}`;
  }

  /**
   * 记录一个新的 episode
   */
  logEpisode(episode: Omit<Episode, "episode_id" | "timestamp">): Episode {
    const fullEpisode: Episode = {
      ...episode,
      episode_id: this.generateEpisodeId(),
      timestamp: new Date().toISOString(),
    };

    // 追加到 JSONL 文件
    const line = JSON.stringify(fullEpisode);
    fs.appendFileSync(this.episodeFilePath, line + "\n", "utf-8");

    return fullEpisode;
  }

  /**
   * 从任务执行结果创建 episode
   */
  createEpisode(params: {
    taskId: string;
    genomeId: string;
    selectedTaskScore: number;
    riskScore: number;
    energyCost: number;
    codexStatus: Episode["codex_status"];
    verifyPassed: boolean;
    retryCount: number;
    changedFiles?: number;
    diffLines?: number;
    reward?: number;
    penalty?: number;
    fitnessDelta?: number;
  }): Episode {
    return this.logEpisode({
      task_id: params.taskId,
      genome_id: params.genomeId,
      selected_task_score: params.selectedTaskScore,
      risk_score: params.riskScore,
      energy_cost: params.energyCost,
      codex_status: params.codexStatus,
      verify_passed: params.verifyPassed,
      retry_count: params.retryCount,
      changed_files: params.changedFiles || 0,
      diff_lines: params.diffLines || 0,
      reward: params.reward || 0,
      penalty: params.penalty || 0,
      fitness_delta: params.fitnessDelta || 0,
    });
  }

  /**
   * 读取所有 episodes
   */
  getAllEpisodes(limit?: number): Episode[] {
    if (!fs.existsSync(this.episodeFilePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.episodeFilePath, "utf-8");
      const lines = content.split("\n").filter(line => line.trim() !== "");

      const episodes = lines.map(line => JSON.parse(line) as Episode);

      if (limit) {
        return episodes.slice(-limit);
      }

      return episodes;
    } catch {
      return [];
    }
  }

  /**
   * 按 task_id 查询 episodes
   */
  getEpisodesByTaskId(taskId: string): Episode[] {
    const allEpisodes = this.getAllEpisodes();
    return allEpisodes.filter(episode => episode.task_id === taskId);
  }

  /**
   * 按 genome_id 查询 episodes
   */
  getEpisodesByGenomeId(genomeId: string): Episode[] {
    const allEpisodes = this.getAllEpisodes();
    return allEpisodes.filter(episode => episode.genome_id === genomeId);
  }

  /**
   * 获取最新的 N 个 episodes
   */
  getRecentEpisodes(count: number = 10): Episode[] {
    return this.getAllEpisodes(count);
  }

  /**
   * 获取 episode 统计信息
   */
  getStatistics(): {
    totalEpisodes: number;
    byGenome: Record<string, number>;
    byTask: Record<string, number>;
    averageReward: number;
    averageFitnessDelta: number;
    successRate: number;
  } {
    const episodes = this.getAllEpisodes();

    if (episodes.length === 0) {
      return {
        totalEpisodes: 0,
        byGenome: {},
        byTask: {},
        averageReward: 0,
        averageFitnessDelta: 0,
        successRate: 0,
      };
    }

    // 按 genome 统计
    const byGenome: Record<string, number> = {};
    for (const episode of episodes) {
      byGenome[episode.genome_id] = (byGenome[episode.genome_id] || 0) + 1;
    }

    // 按 task 统计
    const byTask: Record<string, number> = {};
    for (const episode of episodes) {
      byTask[episode.task_id] = (byTask[episode.task_id] || 0) + 1;
    }

    // 计算平均值
    const totalReward = episodes.reduce((sum, ep) => sum + ep.reward, 0);
    const totalFitnessDelta = episodes.reduce((sum, ep) => sum + ep.fitness_delta, 0);
    const successfulEpisodes = episodes.filter(ep => ep.codex_status === "completed").length;

    return {
      totalEpisodes: episodes.length,
      byGenome,
      byTask,
      averageReward: totalReward / episodes.length,
      averageFitnessDelta: totalFitnessDelta / episodes.length,
      successRate: successfulEpisodes / episodes.length,
    };
  }

  /**
   * 清除所有 episodes（危险操作）
   */
  clearEpisodes(): void {
    if (fs.existsSync(this.episodeFilePath)) {
      fs.unlinkSync(this.episodeFilePath);
    }
    this.episodeCounter = 0;
  }

  /**
   * 导出 episodes 到指定文件
   */
  exportToFile(filePath: string): boolean {
    try {
      const episodes = this.getAllEpisodes();
      const content = JSON.stringify(episodes, null, 2);

      const dir = path.dirname(filePath);
      ensureDirectoryExists(dir);

      fs.writeFileSync(filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从文件导入 episodes
   */
  importFromFile(filePath: string): number {
    try {
      if (!fs.existsSync(filePath)) {
        return 0;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const episodes = JSON.parse(content) as Episode[];

      if (!Array.isArray(episodes)) {
        return 0;
      }

      let importedCount = 0;
      for (const episode of episodes) {
        if (this.validateEpisode(episode)) {
          // 追加到文件（不重新生成 ID）
          const line = JSON.stringify(episode);
          fs.appendFileSync(this.episodeFilePath, line + "\n", "utf-8");
          importedCount++;
        }
      }

      // 重新初始化计数器
      this.initializeCounter();

      return importedCount;
    } catch {
      return 0;
    }
  }

  /**
   * 验证 episode 格式
   */
  private validateEpisode(episode: unknown): episode is Episode {
    if (!episode || typeof episode !== "object") {
      return false;
    }

    const e = episode as Record<string, unknown>;

    const requiredFields: (keyof Episode)[] = [
      "episode_id",
      "timestamp",
      "task_id",
      "genome_id",
      "selected_task_score",
      "risk_score",
      "energy_cost",
      "codex_status",
      "verify_passed",
      "retry_count",
      "changed_files",
      "diff_lines",
      "reward",
      "penalty",
      "fitness_delta",
    ];

    for (const field of requiredFields) {
      if (!(field in e)) {
        return false;
      }
    }

    // 验证 codex_status
    const validStatuses: Episode["codex_status"][] = [
      "running",
      "completed",
      "failed",
      "needs_review",
    ];
    if (!validStatuses.includes(e.codex_status as Episode["codex_status"])) {
      return false;
    }

    return true;
  }
}
