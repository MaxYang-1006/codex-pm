import { runDoctor, formatDoctorOutput } from "./doctor.js";
import { runScan, formatScanOutput } from "./scan.js";
import { runNext, formatNextOutput } from "./next.js";
import { confirm } from "../core/interactive-prompt.js";

export interface StartResult {
  success: boolean;
  message: string;
  doctorPassed: boolean;
  scanSuccess: boolean;
  hasRunnableTasks: boolean;
}

export interface StartOptions {
  runFirst?: boolean;
  dryRun?: boolean;
}

export async function runStart(options: StartOptions = {}): Promise<StartResult> {
  console.log("=== Codex PM First Start ===");
  console.log("");

  console.log("Step 1/3: Running environment diagnostics...");
  console.log("");
  const doctorChecks = await runDoctor();
  console.log(formatDoctorOutput(doctorChecks));
  console.log("");

  const doctorPassed = doctorChecks.every(c => c.status !== "fail");
  if (!doctorPassed && !options.runFirst) {
    console.log("❌ Some doctor checks failed. Please fix them before proceeding.");
    console.log("");
    return {
      success: false,
      message: "Doctor checks failed",
      doctorPassed: false,
      scanSuccess: false,
      hasRunnableTasks: false,
    };
  }

  console.log("Step 2/3: Scanning project docs...");
  console.log("");
  const scanResult = await runScan();
  console.log(formatScanOutput(scanResult));
  console.log("");

  if (!scanResult.success) {
    console.log("❌ Scan failed. Cannot proceed.");
    console.log("");
    return {
      success: false,
      message: "Scan failed",
      doctorPassed,
      scanSuccess: false,
      hasRunnableTasks: false,
    };
  }

  console.log("Step 3/3: Finding next task...");
  console.log("");
  const nextResult = runNext();
  console.log(formatNextOutput(nextResult));
  console.log("");

  const hasRunnableTasks = !!nextResult.selectedTask;

  if (!hasRunnableTasks) {
    console.log("ℹ️ No runnable tasks found.");
    console.log("");
    console.log("Tips:");
    console.log("  - Check if tasks have unmet dependencies");
    console.log("  - Verify task status is 'pending'");
    console.log("  - Ensure tasks don't require human approval");
    return {
      success: true,
      message: "Project initialized, but no runnable tasks",
      doctorPassed,
      scanSuccess: true,
      hasRunnableTasks: false,
    };
  }

  if (!options.runFirst && !options.dryRun) {
    console.log("Ready to execute the first task!");
    console.log("");
    const approved = await confirm({
      question: "Do you want to run the recommended task now?",
      default: false,
    });

    if (approved) {
      console.log("");
      console.log("Running: codex-pm run-one --task " + nextResult.selectedTask!.task_id);
      console.log("(Would execute task here in real implementation)");
    } else {
      console.log("");
      console.log("No problem! Run manually later with:");
      console.log("  codex-pm run-one --task " + nextResult.selectedTask!.task_id);
    }
  }

  return {
    success: true,
    message: "Project initialized successfully",
    doctorPassed,
    scanSuccess: true,
    hasRunnableTasks,
  };
}

export function formatStartOutput(result: StartResult): string {
  const lines: string[] = [];

  lines.push("=== Codex PM Start ===");
  lines.push("");

  if (!result.success) {
    lines.push(`❌ ${result.message}`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push("✅ Project initialized successfully!");
  lines.push("");

  if (result.hasRunnableTasks) {
    lines.push("You can now run tasks:");
    lines.push("  codex-pm run-one      # Run next recommended task");
    lines.push("  codex-pm run --max-tasks 5  # Run up to 5 tasks");
  } else {
    lines.push("No runnable tasks available.");
    lines.push("Check task dependencies and approval status.");
  }

  lines.push("");
  lines.push("Next steps:");
  lines.push("  1. Review task status: codex-pm status");
  lines.push("  2. See next task: codex-pm next");
  lines.push("  3. Run a task: codex-pm run-one --dry-run");

  return lines.join("\n");
}