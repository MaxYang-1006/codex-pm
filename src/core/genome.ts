import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type {
  PmGenome,
  GenomeWeights,
  GenomeThresholds,
  GenomeCollection,
} from "../types/genome.js";
import type { ScorerConfig } from "./task-scorer.js";
import { ensureDirectoryExists } from "./file-utils.js";

const DEFAULT_GENOMES_PATH = "experiments/default-genomes.json";
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export class GenomeManager {
  private genomes: Map<string, PmGenome> = new Map();
  private activeGenomeId: string;

  constructor(defaultGenomesPath?: string) {
    // CLI 通常在用户项目目录运行；默认 genome 需要同时兼容源码运行和 dist 运行。
    const defaultPaths = defaultGenomesPath
      ? [defaultGenomesPath]
      : getDefaultGenomePathCandidates();
    for (const defaultPath of defaultPaths) {
      if (this.loadFromFile(defaultPath)) {
        break;
      }
    }

    // 设置默认为 balanced profile
    this.activeGenomeId = "balanced-v1";
  }

  /**
   * 从文件加载基因组集合
   */
  loadFromFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const collection = JSON.parse(content) as GenomeCollection;

      if (!collection.genomes || !Array.isArray(collection.genomes)) {
        return false;
      }

      for (const genome of collection.genomes) {
        if (this.validateGenome(genome)) {
          this.genomes.set(genome.id, genome);
        }
      }

      return this.genomes.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * 验证基因组格式是否有效
   */
  validateGenome(genome: unknown): genome is PmGenome {
    if (!genome || typeof genome !== "object") {
      return false;
    }

    const g = genome as Record<string, unknown>;

    // 检查必填字段
    if (!g.id || typeof g.id !== "string") return false;
    if (!g.profile || typeof g.profile !== "string") return false;
    if (!g.name || typeof g.name !== "string") return false;
    if (!g.description || typeof g.description !== "string") return false;

    // 检查 weights
    if (!g.weights || typeof g.weights !== "object") return false;
    const weights = g.weights as Record<string, unknown>;
    const requiredWeights: (keyof GenomeWeights)[] = [
      "priority",
      "unlock_count",
      "risk_penalty_low",
      "risk_penalty_medium",
      "risk_penalty_high",
      "risk_penalty_critical",
      "size_penalty_xs",
      "size_penalty_s",
      "size_penalty_m",
      "size_penalty_l",
      "size_penalty_xl",
      "failure_penalty",
      "memory_recall_weight",
      "verification_weight",
    ];
    for (const key of requiredWeights) {
      if (typeof weights[key] !== "number") return false;
    }

    // 检查 thresholds
    if (!g.thresholds || typeof g.thresholds !== "object") return false;
    const thresholds = g.thresholds as Record<string, unknown>;
    const requiredThresholds: (keyof GenomeThresholds)[] = [
      "max_consecutive_failures",
      "max_retries",
      "high_risk_stop",
      "energy_budget_default",
      "risk_approval_threshold",
    ];
    for (const key of requiredThresholds) {
      if (key === "high_risk_stop") {
        if (typeof thresholds[key] !== "boolean") return false;
      } else {
        if (typeof thresholds[key] !== "number") return false;
      }
    }

    // 检查 persona
    if (!g.persona || typeof g.persona !== "object") return false;
    const persona = g.persona as Record<string, unknown>;
    const requiredPersona = [
      "risk_tolerance",
      "quality_bias",
      "speed_bias",
      "autonomy_level",
      "test_strictness",
      "refactor_tolerance",
    ];
    for (const key of requiredPersona) {
      if (typeof persona[key] !== "number") return false;
    }

    return true;
  }

  /**
   * 获取所有基因组
   */
  getAllGenomes(): PmGenome[] {
    return Array.from(this.genomes.values());
  }

  /**
   * 通过 ID 获取基因组
   */
  getGenome(id: string): PmGenome | null {
    return this.genomes.get(id) || null;
  }

  /**
   * 通过 profile 获取基因组（返回第一个匹配的）
   */
  getGenomeByProfile(profile: string): PmGenome | null {
    for (const genome of this.genomes.values()) {
      if (genome.profile === profile) {
        return genome;
      }
    }
    return null;
  }

  /**
   * 获取当前激活的基因组
   */
  getActiveGenome(): PmGenome | null {
    return this.genomes.get(this.activeGenomeId) || null;
  }

  /**
   * 设置激活的基因组
   */
  setActiveGenome(id: string): boolean {
    if (this.genomes.has(id)) {
      this.activeGenomeId = id;
      return true;
    }
    return false;
  }

  /**
   * 添加或更新基因组
   */
  addGenome(genome: PmGenome): void {
    if (this.validateGenome(genome)) {
      this.genomes.set(genome.id, genome);
    }
  }

  /**
   * 将基因组转换为 TaskScorer 配置
   */
  toScorerConfig(genome: PmGenome): ScorerConfig {
    return {
      priorityWeight: genome.weights.priority,
      unlockWeight: genome.weights.unlock_count,
      riskPenaltyLow: genome.weights.risk_penalty_low,
      riskPenaltyMedium: genome.weights.risk_penalty_medium,
      riskPenaltyHigh: genome.weights.risk_penalty_high,
      riskPenaltyCritical: genome.weights.risk_penalty_critical,
      sizePenaltyXS: genome.weights.size_penalty_xs,
      sizePenaltyS: genome.weights.size_penalty_s,
      sizePenaltyM: genome.weights.size_penalty_m,
      sizePenaltyL: genome.weights.size_penalty_l,
      sizePenaltyXL: genome.weights.size_penalty_xl,
      failurePenalty: genome.weights.failure_penalty,
      maxRetries: genome.thresholds.max_retries,
    };
  }

  /**
   * 保存基因组集合到文件
   */
  saveToFile(filePath: string): boolean {
    try {
      const collection: GenomeCollection = {
        version: "1.0.0",
        description: "PM genome collection",
        genomes: Array.from(this.genomes.values()),
      };

      const dir = path.dirname(filePath);
      ensureDirectoryExists(dir);

      fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出所有可用的 profile
   */
  listProfiles(): string[] {
    const profiles = new Set<string>();
    for (const genome of this.genomes.values()) {
      profiles.add(genome.profile);
    }
    return Array.from(profiles);
  }

  /**
   * 比较两个基因组的差异
   */
  compareGenomes(
    id1: string,
    id2: string
  ): {
    identical: boolean;
    differences: string[];
  } | null {
    const g1 = this.genomes.get(id1);
    const g2 = this.genomes.get(id2);

    if (!g1 || !g2) {
      return null;
    }

    const differences: string[] = [];

    // 比较 weights
    for (const key of Object.keys(g1.weights) as (keyof GenomeWeights)[]) {
      if (g1.weights[key] !== g2.weights[key]) {
        differences.push(`weights.${key}: ${g1.weights[key]} vs ${g2.weights[key]}`);
      }
    }

    // 比较 thresholds
    for (const key of Object.keys(g1.thresholds) as (keyof GenomeThresholds)[]) {
      if (g1.thresholds[key] !== g2.thresholds[key]) {
        differences.push(`thresholds.${key}: ${g1.thresholds[key]} vs ${g2.thresholds[key]}`);
      }
    }

    // 比较 persona
    for (const key of Object.keys(g1.persona)) {
      const k = key as keyof typeof g1.persona;
      if (g1.persona[k] !== g2.persona[k]) {
        differences.push(`persona.${key}: ${g1.persona[k]} vs ${g2.persona[k]}`);
      }
    }

    return {
      identical: differences.length === 0,
      differences,
    };
  }
}

function getDefaultGenomePathCandidates(): string[] {
  const candidates = [
    path.resolve(process.cwd(), DEFAULT_GENOMES_PATH),
    path.resolve(MODULE_DIR, "../../experiments/default-genomes.json"),
    path.resolve(MODULE_DIR, "../../../experiments/default-genomes.json"),
  ];

  return Array.from(new Set(candidates));
}
