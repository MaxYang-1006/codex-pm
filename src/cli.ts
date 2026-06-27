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
import { runStart, formatStartOutput } from "./commands/start.js";
import { runValidateDocs, formatValidateDocsOutput } from "./commands/validate-docs.js";
import { runReview, formatReviewOutput } from "./commands/review.js";
import { EnergyGate } from "./core/energy-gate.js";

const program = new Command();

program
  .name("codex-pm")
  .description("A cerebellum-style project manager for Codex")
  .version("0.1.0");

program
  .command("start")
  .description("First-run setup: doctor → scan → recommend")
  .option("--run-first", "Run first task without asking")
  .option("--dry-run", "Only show what would happen")
  .action(async options => {
    const result = await runStart({
      runFirst: options.runFirst,
      dryRun: options.dryRun,
    });
    console.log(formatStartOutput(result));
  });

program
  .command("doctor")
  .description("Check local environment and docs readiness")
  .action(async () => {
    const checks = await runDoctor();
    console.log(formatDoctorOutput(checks));
  });

program
  .command("validate-docs")
  .description("Validate docs/ format and completeness")
  .action(() => {
    const result = runValidateDocs();
    console.log(formatValidateDocsOutput(result));
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
  .option("--mode <mode>", "Recommendation mode: smart or sequential", "smart")
  .action(options => {
    const result = runNext(3, options.mode as "smart" | "sequential");
    console.log(formatNextOutput(result));
  });

program
  .command("run-one")
  .description("Run or dry-run one task")
  .option("--dry-run", "write prompt but do not execute Codex")
  .option("--task <taskId>", "specific task ID to run")
  .option("--sandbox <mode>", "Codex sandbox mode: read-only or workspace-write", "workspace-write")
  .option("-i, --interactive", "interactive mode: prompt for approval on high-risk tasks")
  .action(async options => {
    const result = await runRunOne({
      taskId: options.task,
      dryRun: options.dryRun,
      sandbox: options.sandbox,
      interactive: options.interactive,
    });
    console.log(formatRunOneOutput(result));
  });

program
  .command("run")
  .description("Run multiple tasks safely in a loop")
  .option("--max-tasks <number>", "Maximum number of tasks to run", "5")
  .option("--dry-run", "Write prompts but do not execute Codex")
  .option("--energy-budget <number>", "Energy budget limit", "500")
  .option("-i, --interactive", "interactive mode: prompt for approval on high-risk tasks")
  .option("--refill-energy <number>", "Refill energy before running")
  .option("--mode <mode>", "Task selection mode: smart or guided", "smart")
  .action(async options => {
    const maxTasks = parseInt(options.maxTasks, 10);
    const energyBudget = parseInt(options.energyBudget, 10);

    if (options.refillEnergy) {
      const energyGate = new EnergyGate();
      const refillAmount = parseInt(options.refillEnergy, 10);
      const result = energyGate.refillEnergy(refillAmount);
      console.log(`Energy refilled: +${result.added} units (new balance: ${result.newBalance})`);
    }

    const result = await runRun({
      maxTasks,
      dryRun: options.dryRun,
      energyBudget,
      interactive: options.interactive,
      mode: options.mode as "smart" | "guided",
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
  .command("review")
  .description("Review current diff and task status")
  .action(async () => {
    const result = await runReview();
    console.log(formatReviewOutput(result));
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

program
  .command("energy")
  .description("Manage energy balance")
  .option("--status", "Show current energy status")
  .option("--refill <number>", "Refill energy")
  .option("--reset", "Reset energy to initial value")
  .action(options => {
    const energyGate = new EnergyGate();

    if (options.reset) {
      const state = energyGate.resetEnergy();
      console.log(`Energy reset to ${state.balance} units`);
    } else if (options.refill) {
      const amount = parseInt(options.refill, 10);
      const result = energyGate.refillEnergy(amount);
      console.log(`Energy refilled: +${result.added} units (new balance: ${result.newBalance})`);
    } else {
      const status = energyGate.formatEnergyStatus();
      console.log(status);
    }
  });

program.parse();