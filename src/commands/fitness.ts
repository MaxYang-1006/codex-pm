import { Command } from "commander";
import { FitnessCalculator } from "../core/fitness.js";

export function createFitnessCommand(): Command {
  const fitness = new FitnessCalculator();

  const command = new Command("fitness")
    .description("Show fitness metrics summary")
    .option("--task <taskId>", "Show metrics for a specific task")
    .action(async options => {
      try {
        let metrics;

        if (options.task) {
          metrics = fitness.calculateForTask(options.task);
          console.log(`=== Fitness for Task: ${options.task} ===`);
        } else {
          metrics = fitness.calculate();
        }

        console.log(fitness.formatSummary(metrics));

        if (!fitness.hasEnoughData()) {
          console.log("\n⚠️  Warning: Insufficient data for meaningful fitness calculation.");
          console.log("  Need at least 3 task runs for reliable metrics.");
        }

        process.exit(0);
      } catch (error) {
        console.error("Error calculating fitness:", error);
        process.exit(1);
      }
    });

  return command;
}
