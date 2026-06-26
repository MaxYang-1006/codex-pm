/**
 * PM Genome - Codex PM 进化参数配置
 *
 * 定义 PM 的"基因组"，包含所有可进化的策略参数。
 * 这些参数控制 PM 的行为偏好，可以通过进化实验进行调整。
 */

export type GenomeProfile = "balanced" | "conservative" | "startup" | "research" | string;

/**
 * 权重配置 - 控制任务评分各因素的权重
 */
export interface GenomeWeights {
  // 任务评分权重
  priority: number;
  unlock_count: number;
  risk_penalty_low: number;
  risk_penalty_medium: number;
  risk_penalty_high: number;
  risk_penalty_critical: number;
  size_penalty_xs: number;
  size_penalty_s: number;
  size_penalty_m: number;
  size_penalty_l: number;
  size_penalty_xl: number;
  failure_penalty: number;

  // 其他权重
  memory_recall_weight: number;
  verification_weight: number;
}

/**
 * 阈值配置 - 控制各种行为的触发阈值
 */
export interface GenomeThresholds {
  max_consecutive_failures: number;
  max_retries: number;
  high_risk_stop: boolean;
  energy_budget_default: number;
  risk_approval_threshold: number;
}

/**
 * 人格配置 - PM 的行为偏好
 */
export interface GenomePersona {
  risk_tolerance: number; // 0-1, 风险容忍度
  quality_bias: number; // 0-1, 质量偏好
  speed_bias: number; // 0-1, 速度偏好
  autonomy_level: number; // 0-1, 自主程度
  test_strictness: number; // 0-1, 测试严格度
  refactor_tolerance: number; // 0-1, 重构容忍度
}

/**
 * PM Genome 完整定义
 */
export interface PmGenome {
  id: string;
  profile: GenomeProfile;
  name: string;
  description: string;
  weights: GenomeWeights;
  thresholds: GenomeThresholds;
  persona: GenomePersona;
}

/**
 * 基因组集合文件格式
 */
export interface GenomeCollection {
  version: string;
  description: string;
  genomes: PmGenome[];
}
