import type { CodexPmTask } from "../types/task.js";

export interface NormalizeResult {
  tasks: CodexPmTask[];
  dependencyErrors: string[];
  warnings: string[];
}

export class TaskNormalizer {
  normalize(tasks: CodexPmTask[]): NormalizeResult {
    const dependencyErrors: string[] = [];
    const warnings: string[] = [];

    const taskIds = new Set(tasks.map(t => t.id));

    for (const task of tasks) {
      for (const dep of task.depends_on) {
        if (!taskIds.has(dep)) {
          dependencyErrors.push(`Task ${task.id} has missing dependency: ${dep}`);
        }
      }

      if (task.retry_count === undefined) {
        task.retry_count = 0;
      }

      if (task.max_retries === undefined) {
        task.max_retries = 2;
      }

      if (task.depends_on === undefined) {
        task.depends_on = [];
      }

      if (task.files_hint === undefined) {
        task.files_hint = [];
      }

      if (task.acceptance === undefined) {
        task.acceptance = [];
      }

      if (task.verify === undefined) {
        task.verify = [];
      }

      if (task.blocked_rules === undefined) {
        task.blocked_rules = [];
      }

      if (task.human_approval && task.status === "pending") {
        warnings.push(`Task ${task.id} requires human approval`);
      }

      if (task.locked && task.status === "pending") {
        warnings.push(`Task ${task.id} is locked`);
      }
    }

    const sortedTasks = this.sortByDependency(tasks);

    return {
      tasks: sortedTasks,
      dependencyErrors,
      warnings,
    };
  }

  private sortByDependency(tasks: CodexPmTask[]): CodexPmTask[] {
    const taskMap = new Map<string, CodexPmTask>();
    const visited = new Set<string>();
    const result: CodexPmTask[] = [];

    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      for (const dep of task.depends_on) {
        visit(dep);
      }

      result.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  resolveDependencies(taskId: string, tasks: CodexPmTask[]): CodexPmTask[] {
    const taskMap = new Map<string, CodexPmTask>();
    const result: CodexPmTask[] = [];
    const visited = new Set<string>();

    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    const collect = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const task = taskMap.get(id);
      if (!task) return;

      for (const dep of task.depends_on) {
        collect(dep);
      }

      if (id !== taskId) {
        result.push(task);
      }
    };

    collect(taskId);
    return result;
  }
}
