import { LoopRunner, LoopReport } from "../core/loop-runner.js";

export interface RunResult {
  success: boolean;
  message: string;
  report?: LoopReport;
  dryRun?: boolean;
}

/**
 * 执行 run 命令
 */
export async function runRun(options: {
  maxTasks?: number;
  mode?: string;
  dryRun?: boolean;
  energyBudget?: number;
}): Promise<RunResult> {
  try {
    const runner = new LoopRunner({
      maxTasks: options.maxTasks,
      dryRun: options.dryRun,
      energyBudget: options.energyBudget,
      stopOnHighRisk: true,
      maxConsecutiveFailures: 2,
    });

    const report = await runner.run();

    return {
      success: report.totalTasks > 0 ? report.completedTasks === report.totalTasks : false,
      message:
        report.totalTasks > 0
          ? `Run loop completed: ${report.completedTasks}/${report.totalTasks} tasks succeeded`
          : "No tasks were run",
      report,
      dryRun: options.dryRun,
    };
  } catch (error) {
    return {
      success: false,
      message: `Run loop failed: ${error instanceof Error ? error.message : String(error)}`,
      dryRun: options.dryRun,
    };
  }
}

/**
 * 格式化 run 命令输出
 */
export function formatRunOutput(result: RunResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Run ===");
  lines.push("");

  if (!result.success && !result.report) {
    lines.push(`✗ ${result.message}`);
    return lines.join("\n");
  }

  if (result.report) {
    const runner = new LoopRunner({ dryRun: result.dryRun });
    lines.push(runner.formatReport(result.report));
  }

  return lines.join("\n");
}
