import * as fs from "fs";
import type { ProjectState, DocIndexEntry, TaskRunEntry } from "../types/state.js";
import type { CodexPmTask } from "../types/task.js";
import type { MemoryRecord } from "../types/memory.js";
import type { PmGenome } from "../types/genome.js";
import { ensureDirectoryExists } from "./file-utils.js";
import { normalizeTaskRunEntry } from "./result-writer.js";

export class StateManager {
  private state: ProjectState | null = null;
  private docIndex: DocIndexEntry[] = [];
  private taskRuns: TaskRunEntry[] = [];
  private baseDir: string;

  constructor(baseDir: string = ".codex-pm") {
    this.baseDir = baseDir;
  }

  private get STATE_FILE(): string {
    return `${this.baseDir}/state.json`;
  }

  private get DOC_INDEX_FILE(): string {
    return `${this.baseDir}/doc-index.json`;
  }

  private get TASK_RUNS_FILE(): string {
    return `${this.baseDir}/task-runs.jsonl`;
  }

  private get LEGACY_TASK_RUNS_FILE(): string {
    return `${this.baseDir}/task-runs.json`;
  }

  load(): void {
    if (fs.existsSync(this.STATE_FILE)) {
      try {
        const content = fs.readFileSync(this.STATE_FILE, "utf-8");
        this.state = JSON.parse(content);
      } catch {
        this.state = this.createEmptyState();
      }
    } else {
      this.state = this.createEmptyState();
    }

    if (fs.existsSync(this.DOC_INDEX_FILE)) {
      try {
        const content = fs.readFileSync(this.DOC_INDEX_FILE, "utf-8");
        this.docIndex = JSON.parse(content);
      } catch {
        this.docIndex = [];
      }
    }

    this.taskRuns = this.loadTaskRuns();
  }

  save(): void {
    ensureDirectoryExists(this.baseDir);

    if (this.state) {
      this.state.updated_at = new Date().toISOString();
      fs.writeFileSync(this.STATE_FILE, JSON.stringify(this.state, null, 2));
    }

    fs.writeFileSync(this.DOC_INDEX_FILE, JSON.stringify(this.docIndex, null, 2));
    const taskRunLines = this.taskRuns.map(run => JSON.stringify(run)).join("\n");
    fs.writeFileSync(this.TASK_RUNS_FILE, taskRunLines ? `${taskRunLines}\n` : "");
  }

  getState(): ProjectState {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    return this.state;
  }

  updateState(updates: Partial<ProjectState>): void {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    this.state = { ...this.state, ...updates };
  }

  setTasks(tasks: CodexPmTask[]): void {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    this.state.tasks = tasks;
  }

  getTasks(): CodexPmTask[] {
    return this.state?.tasks || [];
  }

  getTaskById(taskId: string): CodexPmTask | undefined {
    return this.state?.tasks.find(t => t.id === taskId);
  }

  updateTask(taskId: string, updates: Partial<CodexPmTask>): boolean {
    if (!this.state) return false;

    const index = this.state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    this.state.tasks[index] = { ...this.state.tasks[index], ...updates };
    return true;
  }

  setDocIndex(entries: DocIndexEntry[]): void {
    this.docIndex = entries;
  }

  getDocIndex(): DocIndexEntry[] {
    return this.docIndex;
  }

  getDocByFilename(filename: string): DocIndexEntry | undefined {
    return this.docIndex.find(e => e.filename === filename);
  }

  addTaskRun(taskId: string): string {
    const runId = `${taskId}-${Date.now()}`;
    const entry: TaskRunEntry = {
      task_id: taskId,
      run_id: runId,
      started_at: new Date().toISOString(),
      status: "running",
      success: false,
      verification_results: [],
      verification_passed: false,
      retry_count: 0,
      risk_incident: false,
      duration_ms: 0,
      exit_code: null,
    };
    this.taskRuns.push(entry);
    return runId;
  }

  updateTaskRun(runId: string, updates: Partial<TaskRunEntry>): boolean {
    const index = this.taskRuns.findIndex(r => r.run_id === runId);
    if (index === -1) return false;

    this.taskRuns[index] = { ...this.taskRuns[index], ...updates };
    return true;
  }

  getTaskRuns(taskId?: string): TaskRunEntry[] {
    if (taskId) {
      return this.taskRuns.filter(r => r.task_id === taskId);
    }
    return this.taskRuns;
  }

  addMemoryRecord(record: MemoryRecord): void {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    this.state.memory.push(record);
  }

  getMemoryRecords(): MemoryRecord[] {
    return this.state?.memory || [];
  }

  setActiveGenome(genomeId: string): void {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    this.state.active_genome_id = genomeId;
  }

  addGenome(genome: PmGenome): void {
    if (!this.state) {
      this.state = this.createEmptyState();
    }
    const existingIndex = this.state.genomes.findIndex(g => g.id === genome.id);
    if (existingIndex >= 0) {
      this.state.genomes[existingIndex] = genome;
    } else {
      this.state.genomes.push(genome);
    }
  }

  private createEmptyState(): ProjectState {
    return {
      version: "0.1.0",
      project_id: `project-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tasks: [],
      active_genome_id: "",
      genomes: [],
      memory: [],
    };
  }

  isInitialized(): boolean {
    return fs.existsSync(this.STATE_FILE);
  }

  reset(): void {
    this.state = this.createEmptyState();
    this.docIndex = [];
    this.taskRuns = [];
    this.save();
  }

  private loadTaskRuns(): TaskRunEntry[] {
    const jsonlRuns = this.loadTaskRunsJsonl(this.TASK_RUNS_FILE);
    if (jsonlRuns.length > 0 || fs.existsSync(this.TASK_RUNS_FILE)) {
      return jsonlRuns;
    }

    return this.loadLegacyTaskRunsJson(this.LEGACY_TASK_RUNS_FILE);
  }

  private loadTaskRunsJsonl(filePath: string): TaskRunEntry[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split(/\r?\n/)
      .filter(line => line.trim() !== "")
      .map(line => {
        try {
          return normalizeTaskRunEntry(JSON.parse(line));
        } catch {
          return null;
        }
      })
      .filter((entry): entry is TaskRunEntry => entry !== null);
  }

  private loadLegacyTaskRunsJson(filePath: string): TaskRunEntry[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(entry => normalizeTaskRunEntry(entry))
        .filter((entry): entry is TaskRunEntry => entry !== null);
    } catch {
      return [];
    }
  }
}
