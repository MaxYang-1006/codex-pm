import { EpisodeLogger, Episode } from "./episode-logger.js";
import { FitnessMetrics } from "./fitness.js";
import { GenomeManager } from "./genome.js";

/**
 * Profile 性能统计
 */
export interface ProfilePerformance {
  profile: string;
  genomeId: string;
  episodes: number;
  successRate: number;
  averageReward: number;
  averagePenalty: number;
  averageFitnessDelta: number;
  totalEnergyCost: number;
  averageEnergyCost: number;
  averageChangedFiles: number;
  averageDiffLines: number;
}

/**
 * 进化报告
 */
export interface EvolutionReport {
  totalEpisodes: number;
  dateRange: {
    start: string;
    end: string;
  };
  profiles: ProfilePerformance[];
  overallMetrics: FitnessMetrics;
  bestPerformingProfile: string;
  worstPerformingProfile: string;
  improvementAnalysis: ImprovementAnalysis;
}

/**
 * 改进分析结果
 */
export interface ImprovementAnalysis {
  hasImprovement: boolean;
  confidence: number;
  metricsComparison: {
    earlierPeriod: ProfilePerformance | null;
    laterPeriod: ProfilePerformance | null;
    delta: {
      successRate: number;
      reward: number;
      fitnessDelta: number;
    };
  };
  recommendations: string[];
}

export class EvolutionReportGenerator {
  private episodeLogger: EpisodeLogger;
  private genomeManager: GenomeManager;

  constructor() {
    this.episodeLogger = new EpisodeLogger();
    this.genomeManager = new GenomeManager();
  }

  /**
   * 生成进化报告
   */
  generateReport(
    options: {
      profile?: string;
      episodes?: number;
      compareWith?: string;
    } = {}
  ): EvolutionReport {
    const allEpisodes = this.episodeLogger.getAllEpisodes(options.episodes);

    if (allEpisodes.length === 0) {
      return this.buildEmptyReport();
    }

    // 按时间排序
    const sortedEpisodes = [...allEpisodes].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const dateRange = {
      start: sortedEpisodes[0].timestamp,
      end: sortedEpisodes[sortedEpisodes.length - 1].timestamp,
    };

    // 过滤指定 profile 的 episodes
    let filteredEpisodes = sortedEpisodes;
    const profileFilter = options.profile;
    if (profileFilter !== undefined) {
      filteredEpisodes = sortedEpisodes.filter(e => e.genome_id.includes(profileFilter));
    }

    // 计算各 profile 的性能
    const profiles = this.calculateProfilePerformance(filteredEpisodes);

    // 计算整体适应度指标
    const overallMetrics = this.calculateOverallMetrics(filteredEpisodes);

    // 找出最佳和最差表现的 profile
    let bestProfile = "";
    let worstProfile = "";
    if (profiles.length > 0) {
      bestProfile = profiles.reduce((a, b) =>
        a.averageFitnessDelta > b.averageFitnessDelta ? a : b
      ).profile;
      worstProfile = profiles.reduce((a, b) =>
        a.averageFitnessDelta < b.averageFitnessDelta ? a : b
      ).profile;
    }

    // 分析改进情况
    const improvementAnalysis = this.analyzeImprovement(filteredEpisodes);

    return {
      totalEpisodes: filteredEpisodes.length,
      dateRange,
      profiles,
      overallMetrics,
      bestPerformingProfile: bestProfile,
      worstPerformingProfile: worstProfile,
      improvementAnalysis,
    };
  }

  /**
   * 计算各 profile 的性能
   */
  private calculateProfilePerformance(episodes: Episode[]): ProfilePerformance[] {
    const profileMap = new Map<string, Episode[]>();

    for (const episode of episodes) {
      const profile = this.getProfileFromGenomeId(episode.genome_id);
      if (!profileMap.has(profile)) {
        profileMap.set(profile, []);
      }
      profileMap.get(profile)!.push(episode);
    }

    const profiles: ProfilePerformance[] = [];

    for (const [profile, profileEpisodes] of profileMap) {
      const successCount = profileEpisodes.filter(e => e.codex_status === "completed").length;
      const totalReward = profileEpisodes.reduce((sum, e) => sum + e.reward, 0);
      const totalPenalty = profileEpisodes.reduce((sum, e) => sum + e.penalty, 0);
      const totalFitnessDelta = profileEpisodes.reduce((sum, e) => sum + e.fitness_delta, 0);
      const totalEnergyCost = profileEpisodes.reduce((sum, e) => sum + e.energy_cost, 0);
      const totalChangedFiles = profileEpisodes.reduce((sum, e) => sum + e.changed_files, 0);
      const totalDiffLines = profileEpisodes.reduce((sum, e) => sum + e.diff_lines, 0);

      profiles.push({
        profile,
        genomeId: profileEpisodes[0]?.genome_id || "",
        episodes: profileEpisodes.length,
        successRate: profileEpisodes.length > 0 ? successCount / profileEpisodes.length : 0,
        averageReward: profileEpisodes.length > 0 ? totalReward / profileEpisodes.length : 0,
        averagePenalty: profileEpisodes.length > 0 ? totalPenalty / profileEpisodes.length : 0,
        averageFitnessDelta:
          profileEpisodes.length > 0 ? totalFitnessDelta / profileEpisodes.length : 0,
        totalEnergyCost,
        averageEnergyCost:
          profileEpisodes.length > 0 ? totalEnergyCost / profileEpisodes.length : 0,
        averageChangedFiles:
          profileEpisodes.length > 0 ? totalChangedFiles / profileEpisodes.length : 0,
        averageDiffLines: profileEpisodes.length > 0 ? totalDiffLines / profileEpisodes.length : 0,
      });
    }

    // 按平均适应度增量排序
    profiles.sort((a, b) => b.averageFitnessDelta - a.averageFitnessDelta);

    return profiles;
  }

  /**
   * 根据 genome_id 获取 profile 名称
   */
  private getProfileFromGenomeId(genomeId: string): string {
    const genome = this.genomeManager.getGenome(genomeId);
    if (genome) {
      return genome.profile;
    }
    // 如果找不到，尝试从 genome_id 中提取
    const match = genomeId.match(/^(\w+)-v/);
    return match ? match[1] : genomeId;
  }

  /**
   * 计算整体适应度指标
   */
  private calculateOverallMetrics(episodes: Episode[]): FitnessMetrics {
    const totalTasks = episodes.length;
    const completedTasks = episodes.filter(e => e.codex_status === "completed").length;
    const passedVerifications = episodes.filter(e => e.verify_passed).length;
    const totalRetries = episodes.reduce((sum, e) => sum + e.retry_count, 0);
    const riskIncidents = episodes.filter(e => e.risk_score > 0.7).length;
    const totalDuration = episodes.reduce((sum, e) => sum + e.energy_cost, 0);
    const totalReward = episodes.reduce((sum, e) => sum + e.reward, 0);

    return {
      completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      verificationPassRate: totalTasks > 0 ? passedVerifications / totalTasks : 0,
      retryRate: totalTasks > 0 ? totalRetries / totalTasks : 0,
      riskIncidentRate: totalTasks > 0 ? riskIncidents / totalTasks : 0,
      totalScore: episodes.reduce((sum, e) => sum + e.fitness_delta, 0),
      totalTasks,
      completedTasks,
      passedVerifications,
      totalVerifications: totalTasks,
      totalRetries,
      riskIncidents,
      averageDuration: totalTasks > 0 ? totalDuration / totalTasks : 0,
      averageReward: totalTasks > 0 ? totalReward / totalTasks : 0,
    };
  }

  /**
   * 分析改进情况
   */
  private analyzeImprovement(episodes: Episode[]): ImprovementAnalysis {
    if (episodes.length < 10) {
      return {
        hasImprovement: false,
        confidence: 0,
        metricsComparison: {
          earlierPeriod: null,
          laterPeriod: null,
          delta: { successRate: 0, reward: 0, fitnessDelta: 0 },
        },
        recommendations: ["Need at least 10 episodes for improvement analysis"],
      };
    }

    // 分成前后两个时期
    const midIndex = Math.floor(episodes.length / 2);
    const earlierEpisodes = episodes.slice(0, midIndex);
    const laterEpisodes = episodes.slice(midIndex);

    // 计算前期性能
    const earlierPerformance = this.calculateProfilePerformance(earlierEpisodes);
    const earlierAvg = earlierPerformance.length > 0 ? earlierPerformance[0] : null;

    // 计算后期性能
    const laterPerformance = this.calculateProfilePerformance(laterEpisodes);
    const laterAvg = laterPerformance.length > 0 ? laterPerformance[0] : null;

    // 计算改进幅度
    let delta = { successRate: 0, reward: 0, fitnessDelta: 0 };
    let hasImprovement = false;
    let confidence = 0;

    if (earlierAvg && laterAvg) {
      delta = {
        successRate: laterAvg.successRate - earlierAvg.successRate,
        reward: laterAvg.averageReward - earlierAvg.averageReward,
        fitnessDelta: laterAvg.averageFitnessDelta - earlierAvg.averageFitnessDelta,
      };

      // 判断是否有改进
      const improvementCount = [
        delta.successRate > 0.05,
        delta.reward > 0.5,
        delta.fitnessDelta > 0.01,
      ].filter(Boolean).length;

      hasImprovement = improvementCount >= 2;
      confidence = improvementCount / 3;
    }

    // 生成建议
    const recommendations = this.generateRecommendations(episodes, hasImprovement, delta);

    return {
      hasImprovement,
      confidence,
      metricsComparison: {
        earlierPeriod: earlierAvg,
        laterPeriod: laterAvg,
        delta,
      },
      recommendations,
    };
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(
    episodes: Episode[],
    hasImprovement: boolean,
    delta: { successRate: number; reward: number; fitnessDelta: number }
  ): string[] {
    const recommendations: string[] = [];

    if (hasImprovement) {
      recommendations.push("✓ Strategy performance has improved!");

      if (delta.successRate > 0) {
        recommendations.push(
          `  - Success rate increased by ${(delta.successRate * 100).toFixed(1)}%`
        );
      }
      if (delta.reward > 0) {
        recommendations.push(`  - Average reward increased by ${delta.reward.toFixed(1)}`);
      }
      if (delta.fitnessDelta > 0) {
        recommendations.push(`  - Fitness delta increased by ${delta.fitnessDelta.toFixed(3)}`);
      }

      recommendations.push(
        "Continue with the current strategy or consider exploring new profiles."
      );
    } else {
      recommendations.push("Strategy performance has not shown significant improvement.");

      if (delta.successRate < 0) {
        recommendations.push(
          `  - Success rate decreased by ${Math.abs(delta.successRate * 100).toFixed(1)}%`
        );
      }
      if (delta.reward < 0) {
        recommendations.push(
          `  - Average reward decreased by ${Math.abs(delta.reward).toFixed(1)}`
        );
      }

      recommendations.push(
        "Consider switching to a different profile or adjusting strategy parameters."
      );
      recommendations.push("Try 'codex-pm genome list' to see available profiles.");
    }

    // 检查风险事件
    const highRiskEpisodes = episodes.filter(e => e.risk_score > 0.7);
    if (highRiskEpisodes.length > 0) {
      recommendations.push(`  - ${highRiskEpisodes.length} high-risk episodes detected`);
      recommendations.push(
        "    Consider reducing risk tolerance or switching to conservative profile."
      );
    }

    return recommendations;
  }

  /**
   * 构建空报告
   */
  private buildEmptyReport(): EvolutionReport {
    return {
      totalEpisodes: 0,
      dateRange: { start: "-", end: "-" },
      profiles: [],
      overallMetrics: {
        completionRate: 0,
        verificationPassRate: 0,
        retryRate: 0,
        riskIncidentRate: 0,
        totalScore: 0,
        totalTasks: 0,
        completedTasks: 0,
        passedVerifications: 0,
        totalVerifications: 0,
        totalRetries: 0,
        riskIncidents: 0,
        averageDuration: 0,
        averageReward: 0,
      },
      bestPerformingProfile: "-",
      worstPerformingProfile: "-",
      improvementAnalysis: {
        hasImprovement: false,
        confidence: 0,
        metricsComparison: {
          earlierPeriod: null,
          laterPeriod: null,
          delta: { successRate: 0, reward: 0, fitnessDelta: 0 },
        },
        recommendations: ["No episodes found. Run some tasks first to generate evolution data."],
      },
    };
  }

  /**
   * 格式化报告输出
   */
  formatReport(report: EvolutionReport): string {
    const lines: string[] = [];

    lines.push("=== Codex PM Evolution Report ===");
    lines.push("");

    // 基本信息
    lines.push(`Total Episodes: ${report.totalEpisodes}`);
    lines.push(`Date Range: ${report.dateRange.start} to ${report.dateRange.end}`);
    lines.push("");

    // 整体指标
    lines.push("Overall Metrics:");
    const metrics = report.overallMetrics;
    lines.push(`  Completion Rate:  ${(metrics.completionRate * 100).toFixed(1)}%`);
    lines.push(`  Verification Pass: ${(metrics.verificationPassRate * 100).toFixed(1)}%`);
    lines.push(`  Retry Rate:       ${(metrics.retryRate * 100).toFixed(1)}%`);
    lines.push(`  Risk Incidents:   ${metrics.riskIncidents}`);
    lines.push(`  Average Reward:   ${metrics.averageReward.toFixed(2)}`);
    lines.push("");

    // Profile 性能比较
    if (report.profiles.length > 0) {
      lines.push("Profile Performance:");
      lines.push("");

      for (const profile of report.profiles) {
        lines.push(`  ${profile.profile} (${profile.episodes} episodes)`);
        lines.push(`    Success Rate:      ${(profile.successRate * 100).toFixed(1)}%`);
        lines.push(`    Avg Reward:        ${profile.averageReward.toFixed(2)}`);
        lines.push(`    Avg Penalty:       ${profile.averagePenalty.toFixed(2)}`);
        lines.push(`    Avg Fitness Delta: ${profile.averageFitnessDelta.toFixed(4)}`);
        lines.push(`    Avg Energy Cost:   ${profile.averageEnergyCost.toFixed(1)}`);
        lines.push("");
      }

      lines.push(`Best Performing:  ${report.bestPerformingProfile}`);
      lines.push(`Worst Performing: ${report.worstPerformingProfile}`);
      lines.push("");
    }

    // 改进分析
    lines.push("Improvement Analysis:");
    const analysis = report.improvementAnalysis;
    lines.push(`  Has Improvement: ${analysis.hasImprovement ? "YES" : "NO"}`);
    lines.push(`  Confidence:      ${(analysis.confidence * 100).toFixed(0)}%`);
    lines.push("");

    if (analysis.metricsComparison.earlierPeriod && analysis.metricsComparison.laterPeriod) {
      lines.push("  Period Comparison:");
      lines.push(
        `    Earlier - Success: ${(analysis.metricsComparison.earlierPeriod.successRate * 100).toFixed(1)}%, Reward: ${analysis.metricsComparison.earlierPeriod.averageReward.toFixed(2)}`
      );
      lines.push(
        `    Later   - Success: ${(analysis.metricsComparison.laterPeriod.successRate * 100).toFixed(1)}%, Reward: ${analysis.metricsComparison.laterPeriod.averageReward.toFixed(2)}`
      );
      lines.push("");
    }

    // 建议
    lines.push("Recommendations:");
    for (const rec of analysis.recommendations) {
      lines.push(`  ${rec}`);
    }

    return lines.join("\n");
  }
}
