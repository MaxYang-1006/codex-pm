/**
 * Task Graph - 任务依赖图和可运行任务过滤
 *
 * 负责：
 * - 构建任务依赖图
 * - 检查依赖关系
 * - 过滤可运行的任务
 * - 检测循环依赖
 */

import type { CodexPmTask } from "../types/task.js";

export type TaskStatus = "pending" | "done" | "failed" | "blocked" | "needs_review";

export interface TaskNode {
  task: CodexPmTask;
  dependencies: string[];
  dependents: string[];
  depth: number;
}

export interface DependencyInfo {
  taskId: string;
  dependencies: string[];
  missingDependencies: string[];
  isReady: boolean;
}

export interface TaskGraphStats {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  blockedTasks: number;
  maxDepth: number;
  hasCircularDependencies: boolean;
}

export class TaskGraph {
  private nodes: Map<string, TaskNode> = new Map();
  private adjacencyList: Map<string, string[]> = new Map();
  private reverseAdjacencyList: Map<string, string[]> = new Map();

  constructor(tasks: CodexPmTask[] = []) {
    if (tasks.length > 0) {
      this.buildFromTasks(tasks);
    }
  }

  /**
   * 从任务列表构建依赖图
   */
  buildFromTasks(tasks: CodexPmTask[]): void {
    // 清理旧数据
    this.nodes.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();

    // 创建所有节点
    for (const task of tasks) {
      this.nodes.set(task.id, {
        task,
        dependencies: [...task.depends_on],
        dependents: [],
        depth: 0,
      });
      this.adjacencyList.set(task.id, []);
      this.reverseAdjacencyList.set(task.id, []);
    }

    // 构建邻接表（依赖关系）
    for (const task of tasks) {
      for (const depId of task.depends_on) {
        // 添加正向依赖（depId -> task.id）
        if (this.adjacencyList.has(depId)) {
          this.adjacencyList.get(depId)!.push(task.id);
        }
        // 添加反向依赖（task.id -> depId）
        if (this.reverseAdjacencyList.has(task.id)) {
          this.reverseAdjacencyList.get(task.id)!.push(depId);
        }
      }
    }

    // 计算每个任务的深度
    this.calculateDepths();
  }

  /**
   * 计算每个任务的依赖深度
   */
  private calculateDepths(): void {
    // 拓扑排序计算深度
    const visited = new Set<string>();
    const depthCache = new Map<string, number>();

    const calculateDepth = (taskId: string): number => {
      if (depthCache.has(taskId)) {
        return depthCache.get(taskId)!;
      }

      if (visited.has(taskId)) {
        // 循环依赖，返回 0
        return 0;
      }

      visited.add(taskId);

      const node = this.nodes.get(taskId);
      if (!node || node.dependencies.length === 0) {
        depthCache.set(taskId, 0);
        return 0;
      }

      let maxDepDepth = 0;
      for (const depId of node.dependencies) {
        const depDepth = calculateDepth(depId);
        maxDepDepth = Math.max(maxDepDepth, depDepth);
      }

      const depth = maxDepDepth + 1;
      depthCache.set(taskId, depth);

      // 更新节点的深度
      if (this.nodes.has(taskId)) {
        this.nodes.get(taskId)!.depth = depth;
      }

      return depth;
    };

    for (const taskId of this.nodes.keys()) {
      calculateDepth(taskId);
    }
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): CodexPmTask[] {
    return Array.from(this.nodes.values()).map(node => node.task);
  }

  /**
   * 根据 ID 获取任务
   */
  getTask(taskId: string): CodexPmTask | null {
    return this.nodes.get(taskId)?.task || null;
  }

  /**
   * 获取任务节点
   */
  getNode(taskId: string): TaskNode | null {
    return this.nodes.get(taskId) || null;
  }

  /**
   * 获取任务的所有依赖
   */
  getDependencies(taskId: string): string[] {
    return this.nodes.get(taskId)?.dependencies || [];
  }

  /**
   * 获取依赖于指定任务的所有任务
   */
  getDependents(taskId: string): string[] {
    return this.nodes.get(taskId)?.dependents || [];
  }

  /**
   * 获取任务的深度（依赖层级）
   */
  getDepth(taskId: string): number {
    return this.nodes.get(taskId)?.depth || 0;
  }

  /**
   * 获取依赖信息
   */
  getDependencyInfo(taskId: string): DependencyInfo {
    const node = this.nodes.get(taskId);
    if (!node) {
      return {
        taskId,
        dependencies: [],
        missingDependencies: [],
        isReady: false,
      };
    }

    const missingDependencies = node.dependencies.filter(depId => {
      const depNode = this.nodes.get(depId);
      return !depNode || depNode.task.status !== "done";
    });

    return {
      taskId,
      dependencies: node.dependencies,
      missingDependencies,
      isReady: missingDependencies.length === 0,
    };
  }

  /**
   * 检查是否存在循环依赖
   */
  hasCircularDependencies(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const dependencies = this.adjacencyList.get(taskId) || [];
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        if (dfs(taskId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取循环依赖链（如果有）
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack: string[] = [];

    const dfs = (taskId: string): void => {
      visited.add(taskId);
      recursionStack.push(taskId);

      const dependencies = this.adjacencyList.get(taskId) || [];
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.includes(depId)) {
          // 找到循环依赖
          const cycleStart = recursionStack.indexOf(depId);
          const cycle = recursionStack.slice(cycleStart);
          cycle.push(depId); // 闭合循环
          cycles.push(cycle);
        }
      }

      recursionStack.pop();
    };

    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * 获取所有可运行的任务（pending 状态、依赖已满足、未锁定）
   */
  getRunnableTasks(): CodexPmTask[] {
    return this.getAllTasks().filter(task => {
      if (task.status !== "pending") {
        return false;
      }

      if (task.locked) {
        return false;
      }

      const depInfo = this.getDependencyInfo(task.id);
      return depInfo.isReady;
    });
  }

  /**
   * 获取按深度排序的可运行任务
   */
  getRunnableTasksByDepth(): CodexPmTask[] {
    const runnable = this.getRunnableTasks();
    return runnable.sort((a, b) => this.getDepth(a.id) - this.getDepth(b.id));
  }

  /**
   * 获取被阻止的任务（依赖未完成）
   */
  getBlockedTasks(): CodexPmTask[] {
    return this.getAllTasks().filter(task => {
      if (task.status !== "pending") {
        return false;
      }

      const depInfo = this.getDependencyInfo(task.id);
      return !depInfo.isReady;
    });
  }

  /**
   * 获取图统计信息
   */
  getStats(): TaskGraphStats {
    const tasks = this.getAllTasks();
    const completedCount = tasks.filter(t => t.status === "done").length;

    let maxDepth = 0;
    for (const node of this.nodes.values()) {
      if (node.depth > maxDepth) {
        maxDepth = node.depth;
      }
    }

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === "pending").length,
      completedTasks: completedCount,
      failedTasks: tasks.filter(t => t.status === "failed").length,
      blockedTasks: tasks.filter(t => {
        if (t.status !== "pending") return false;
        const depInfo = this.getDependencyInfo(t.id);
        return !depInfo.isReady;
      }).length,
      maxDepth,
      hasCircularDependencies: this.hasCircularDependencies(),
    };
  }

  /**
   * 格式化任务依赖树
   */
  formatDependencyTree(): string {
    const lines: string[] = [];
    lines.push("Task Dependency Tree:");
    lines.push("");

    // 按深度分组
    const byDepth = new Map<number, CodexPmTask[]>();
    for (const task of this.getAllTasks()) {
      const depth = this.getDepth(task.id);
      if (!byDepth.has(depth)) {
        byDepth.set(depth, []);
      }
      byDepth.get(depth)!.push(task);
    }

    // 按深度排序输出
    const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
    for (const depth of depths) {
      const tasks = byDepth.get(depth)!;
      lines.push(`Depth ${depth}:`);
      for (const task of tasks) {
        const prefix = task.locked ? "[LOCKED] " : "";
        const deps =
          task.depends_on.length > 0 ? ` (depends on: ${task.depends_on.join(", ")})` : "";
        const status = task.status === "done" ? " ✓" : task.status === "failed" ? " ✗" : "";
        lines.push(`  - ${task.id}: ${prefix}${task.title}${deps}${status}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 验证任务列表
   */
  validateTasks(tasks: CodexPmTask[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const taskIds = new Set(tasks.map(t => t.id));

    for (const task of tasks) {
      // 检查依赖是否都存在
      for (const depId of task.depends_on) {
        if (!taskIds.has(depId)) {
          errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
        }
      }

      // 检查循环依赖
      const cycles = this.findCircularDependencies();
      if (cycles.length > 0) {
        errors.push(
          `Circular dependencies detected: ${cycles.map(c => c.join(" -> ")).join("; ")}`
        );
      }

      // 检查孤立任务
      const hasNoDeps = task.depends_on.length === 0;
      const hasNoDependents = !tasks.some(t => t.depends_on.includes(task.id));
      if (hasNoDeps && hasNoDependents && tasks.length > 1) {
        warnings.push(`Task ${task.id} is isolated (no dependencies and no dependents)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
