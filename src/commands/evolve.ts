import { EvolutionReportGenerator, EvolutionReport } from "../core/evolution-report.js";
import { GenomeManager } from "../core/genome.js";

export interface EvolveResult {
  success: boolean;
  message: string;
  report?: EvolutionReport;
}

/**
 * 执行 evolve 命令
 */
export async function runEvolve(options: {
  report?: boolean;
  episodes?: number;
  profile?: string;
  list?: boolean;
  compare?: string;
}): Promise<EvolveResult> {
  try {
    // 列出可用的 profiles
    if (options.list) {
      const genomeManager = new GenomeManager();
      const profiles = genomeManager.listProfiles();
      return {
        success: true,
        message: formatProfileList(profiles),
      };
    }

    // 生成进化报告
    if (options.report || !options.list) {
      const generator = new EvolutionReportGenerator();
      const report = generator.generateReport({
        profile: options.profile,
        episodes: options.episodes,
        compareWith: options.compare,
      });

      return {
        success: true,
        message: generator.formatReport(report),
        report,
      };
    }

    return {
      success: false,
      message: "Please specify --report or --list",
    };
  } catch (error) {
    return {
      success: false,
      message: `Evolution command failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 格式化 profile 列表输出
 */
function formatProfileList(profiles: string[]): string {
  const lines: string[] = [];

  lines.push("=== Available Genome Profiles ===");
  lines.push("");

  const genomeManager = new GenomeManager();

  for (const profile of profiles) {
    const genome = genomeManager.getGenomeByProfile(profile);
    if (genome) {
      lines.push(`${profile}`);
      lines.push(`  ID:        ${genome.id}`);
      lines.push(`  Name:      ${genome.name}`);
      lines.push(`  Desc:      ${genome.description}`);
      lines.push(`  Risk:      ${genome.persona.risk_tolerance.toFixed(2)}`);
      lines.push(`  Quality:   ${genome.persona.quality_bias.toFixed(2)}`);
      lines.push(`  Speed:     ${genome.persona.speed_bias.toFixed(2)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * 格式化 evolve 命令输出
 */
export function formatEvolveOutput(result: EvolveResult): string {
  if (!result.success) {
    return `✗ ${result.message}`;
  }

  return result.message;
}
