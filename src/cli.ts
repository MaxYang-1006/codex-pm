#!/usr/bin/env node
import { Command } from "commander";
import { runDoctor, formatDoctorOutput } from "./commands/doctor.js";
import { runScan, formatScanOutput } from "./commands/scan.js";
import { runStatus, formatStatusOutput } from "./commands/status.js";
import { runNext, formatNextOutput } from "./commands/next.js";
import { runRunOne, formatRunOneOutput } from "./commands/run-one.js";
import { createFitnessCommand } from "./commands/fitness.js";
import { runRun, formatRunOutput } from "./commands/run.js";
import { runRepair, formatRepairOutput } from "./commands/repair.js";
import { runEvolve, formatEvolveOutput } from "./commands/evolve.js";

const program = new Command();

program
  .name("codex-pm")
  .description("A cerebellum-style project manager for Codex")
  .version("0.1.0");

program
  .command("doctor")
  .description("Check local environment and docs readiness")
  .action(async () => {
    const checks = await runDoctor();
    console.log(formatDoctorOutput(checks));
  });

program
  .command("scan")
  .description("Scan docs/ and build .codex-pm state")
  .action(async () => {
    const result = await runScan();
    console.log(formatScanOutput(result));
  });

program
  .command("status")
  .description("Show project progress")
  .action(() => {
    const result = runStatus();
    console.log(formatStatusOutput(result));
  });

program
  .command("next")
  .description("Recommend next runnable task")
  .action(() => {
    const result = runNext();
    console.log(formatNextOutput(result));
  });

program
  .command("run-one")
  .description("Run or dry-run one task")
  .option("--dry-run", "write prompt but do not execute Codex")
  .option("--task <taskId>", "specific task ID to run")
  .option("--sandbox <mode>", "Codex sandbox mode: read-only or workspace-write", "workspace-write")
  .action(async options => {
    const result = await runRunOne({
      taskId: options.task,
      dryRun: options.dryRun,
      sandbox: options.sandbox,
    });
    console.log(formatRunOneOutput(result));
  });

program
  .command("run")
  .description("Run multiple tasks safely in a loop")
  .option("--max-tasks <number>", "Maximum number of tasks to run", "5")
  .option("--dry-run", "Write prompts but do not execute Codex")
  .option("--energy-budget <number>", "Energy budget limit", "500")
  .action(async options => {
    const maxTasks = parseInt(options.maxTasks, 10);
    const energyBudget = parseInt(options.energyBudget, 10);
    const result = await runRun({
      maxTasks,
      dryRun: options.dryRun,
      energyBudget,
    });
    console.log(formatRunOutput(result));
  });

program
  .command("repair")
  .description("Repair the latest failed task")
  .option("--task <taskId>", "Specific task ID to repair")
  .option("--dry-run", "Write repair prompt but do not execute")
  .action(async options => {
    const result = await runRepair(options.task, options.dryRun);
    console.log(formatRepairOutput(result));
  });

program
  .command("evolve")
  .description("Analyze evolution experiment results")
  .option("--report", "Generate evolution report")
  .option("--episodes <number>", "Limit to N recent episodes")
  .option("--profile <name>", "Filter by genome profile")
  .option("--list", "List available genome profiles")
  .option("--compare <profile>", "Compare with another profile")
  .action(async options => {
    const episodes = options.episodes ? parseInt(options.episodes, 10) : undefined;
    const result = await runEvolve({
      report: options.report,
      episodes,
      profile: options.profile,
      list: options.list,
      compare: options.compare,
    });
    console.log(formatEvolveOutput(result));
  });

program.addCommand(createFitnessCommand());

program.parse();
