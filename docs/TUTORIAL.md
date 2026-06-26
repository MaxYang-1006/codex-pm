# Codex PM 使用教程

## 目录

1. [简介](#简介)
2. [安装与配置](#安装与配置)
3. [快速开始](#快速开始)
4. [任务定义格式](#任务定义格式)
5. [工作流程](#工作流程)
6. [高级功能](#高级功能)
7. [故障排除](#故障排除)

---

## 简介

Codex PM 是一个文档驱动的项目管理器，专门为 Codex 设计。它将 `docs/` 目录中的 Markdown 文档转化为可验证的开发进度。

### 核心概念

- **文档优先**：所有任务和需求都定义在 `docs/` 目录中的 Markdown 文件里
- **小脑控制层**：Codex PM 负责任务调度、风险控制、成本管理、记忆系统、反馈和适应度
- **验证驱动**：任务是否完成由测试、构建、lint 等验证命令决定，而不是 Codex 自己说了算

### 核心定位

```
Codex = LLM 大脑 + 工程师
Codex PM = 项目经理小脑 + 记忆 + 风险 + 验证 + 策略
```

### 用户首次使用流程

#### 1. 安装插件

```bash
npm install -g codex-pm
```

#### 2. 准备项目文档

```text
project/
  docs/
    PRD.md
    ARCHITECTURE.md
    TASKS.md
```

#### 3. 首次启动

```bash
codex-pm start
```

Codex PM 会：
1. 运行 doctor 检查
2. 扫描文档
3. 解析任务
4. 创建 `.codex-pm/`
5. 生成启动报告
6. 推荐第一个安全任务
7. 询问是否执行

#### 4. 典型输出示例

```text
Codex PM found project docs.

Detected:
✓ docs/PRD.md
✓ docs/ARCHITECTURE.md
✓ docs/TASKS.md

Parsed:
✓ 6 phases
✓ 42 tasks
✓ 5 runnable tasks
✓ 4 high-risk tasks require approval

Recommended first task:
P0-T001 — Initialize CLI project skeleton

Reason:
No dependencies, low risk, unlocks core implementation tasks.

Run this task now? [Y/n]
```

#### 5. 每日使用

```bash
codex-pm status     # 查看项目状态
codex-pm next       # 获取下一个推荐任务
codex-pm run-one    # 执行任务
codex-pm run --max-tasks 5  # 批量执行
codex-pm repair     # 修复失败的任务
```

#### 6. 高风险任务处理

```text
Task requires approval: P4-T003 Database migration
Reason: destructive database migration risk.

Use:
Set `Human approval: yes` after review, then run with the default safe sandbox:

codex-pm run-one --task P4-T003 --sandbox workspace-write
```

#### 7. 实验模式

```bash
codex-pm evolve --episodes 20 --profile startup
codex-pm fitness
codex-pm memory report
```

---

## 安装与配置

### 前置要求

- Node.js 18+ (推荐 20+)
- npm 或 yarn
- Codex CLI (用于实际执行任务)

### 安装方式

#### 方式一：全局安装

```bash
npm install -g codex-pm
```

#### 方式二：项目内安装

```bash
npm install --save-dev codex-pm
```

#### 方式三：从源码运行

```bash
git clone https://github.com/MaxYang-1006/codex-pm.git
cd codex-pm
npm install
npm run build
npm link
```

### 验证安装

```bash
codex-pm --version
codex-pm --help
```

---

## 快速开始

让我们用一个简单的示例项目来体验 Codex PM。

### 第 1 步：创建项目结构

```bash
mkdir my-project
cd my-project
mkdir docs
```

### 第 2 步：创建任务定义文件

在 `docs/TASKS.md` 中定义你的第一个任务：

```markdown
### P0-T001: 初始化项目

Status: pending
Priority: 10
Risk: low
Size: S
Area: setup
Depends on: none
Human approval: no
Locked: no

Description:
创建一个简单的 Node.js 项目。

Acceptance:
- package.json 存在
- src/index.js 存在
- 可以运行 node src/index.js

Verify:
- ls package.json
- ls src/index.js
- node src/index.js
```

### 第 3 步：运行环境检查

```bash
codex-pm doctor
```

你应该看到类似这样的输出：

```
=== Codex PM Doctor ===

[✓] Node.js version
[✓] Docs directory
[✓] TASKS.md
[✓] State directory

=== Summary ===
Pass: 4, Warn: 0, Fail: 0
```

### 第 4 步：扫描文档

```bash
codex-pm scan
```

Codex PM 会读取 `docs/` 目录中的所有文档，解析任务定义，并构建任务图。

### 第 5 步：查看项目状态

```bash
codex-pm status
```

查看当前项目进度、各区域完成情况等。

### 第 6 步：获取推荐任务

```bash
codex-pm next
```

Codex PM 会根据优先级、解锁数量、风险等因素推荐下一个应该执行的任务。

### 第 7 步：试运行任务

在真正让 Codex 执行之前，先看看会生成什么提示：

```bash
codex-pm run-one --dry-run
```

提示文件会保存在 `.codex-pm/prompts/P0-T001.md`。

### 第 8 步：执行任务

当你准备好让 Codex 实际执行任务时：

```bash
codex-pm run-one
```

Codex PM 会：
1. 生成任务提示词
2. 调用 Codex CLI 执行任务
3. 运行验证命令检查结果
4. 更新任务状态
5. 记录审计日志

### 第 9 步：查看适应度

```bash
codex-pm fitness
```

查看项目的整体适应度指标，包括完成率、验证通过率等。

---

## 任务定义格式

Codex PM 从 `docs/TASKS.md` 中解析任务。每个任务都使用三级标题（`###`）定义。

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| Status | string | 任务状态：pending, done, failed, blocked |
| Priority | number | 优先级 1-10，越高越重要 |
| Risk | string | 风险等级：low, medium, high, critical |
| Size | string | 任务大小：XS, S, M, L, XL |
| Area | string | 功能区域 |
| Depends on | string | 依赖的任务 ID，多个用逗号分隔，无依赖写 none |
| Human approval | string | 是否需要人工审批：yes 或 no |

### 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| Locked | string | 是否锁定：yes 或 no |

### 内容部分

| 部分 | 说明 |
|------|------|
| Description | 任务的详细描述 |
| Acceptance | 验收标准列表 |
| Verify | 验证命令列表 |
| Files to modify | 提示可能修改的文件 |
| Blocked actions | 禁止的操作 |

### 完整示例

```markdown
### P1-T003: 实现用户认证

Status: pending
Priority: 8
Risk: high
Size: L
Area: auth
Depends on: P1-T001, P1-T002
Human approval: yes
Locked: no

Description:
实现基于 JWT 的用户认证系统，支持邮箱注册和登录。

Acceptance:
- 用户可以使用邮箱和密码注册
- 用户可以登录获取 JWT token
- token 有效期为 24 小时
- 密码使用 bcrypt 加密存储

Verify:
- npm run build
- npm test
- npm run lint

Files to modify:
- src/auth/
- src/models/User.ts
- package.json

Blocked actions:
- 不要明文存储密码
- 不要使用不安全的哈希算法
```

### 任务编号约定

推荐使用 `P<阶段>-T<序号>` 的格式：

- `P0` - 项目基础架构
- `P1` - 核心功能
- `P2` - 增强功能
- `P3` - 优化和完善

---

## 工作流程

### 标准开发流程

```
1. 编写文档
   ↓
2. codex-pm scan (扫描文档)
   ↓
3. codex-pm status (查看状态)
   ↓
4. codex-pm next (获取推荐)
   ↓
5. codex-pm run-one --dry-run (预览提示)
   ↓
6. codex-pm run-one (执行任务)
   ↓
7. 验证结果
   ↓
8. 重复步骤 3-7
```

### 批量执行

如果你想一次执行多个任务：

```bash
# 执行最多 5 个任务
codex-pm run --max-tasks 5

# 设置能量预算
codex-pm run --energy-budget 300

# 只生成提示，不执行
codex-pm run --max-tasks 3 --dry-run
```

### 循环停止条件

Codex PM 的运行循环会在以下情况停止：

1. 达到最大任务数（`--max-tasks`）
2. 能量预算耗尽（`--energy-budget`）
3. 没有更多可运行的任务
4. 连续失败次数过多
5. 遇到高风险任务需要审批

---

## 高级功能

### 风险门控

Codex PM 会自动评估每个任务的风险：

- **low**：低风险，自动执行
- **medium**：中等风险，警告但执行
- **high**：高风险，需要人工审批
- **critical**：关键风险，默认阻止

风险评估基于：
- 任务声明的风险等级
- 任务描述中的关键词（auth、password、delete 等）
- 涉及的文件类型（.env、migrations、config 等）
- 历史风险记录

### 记忆系统

Codex PM 会记住每次任务执行的结果，用于：

- 改进任务评分
- 避免重复犯错
- 提供上下文记忆

查看记忆：

```bash
# 记忆功能即将推出
```

### 适应度指标

跟踪项目的健康状况：

```bash
codex-pm fitness
```

指标包括：
- 完成率
- 验证通过率
- 重试率
- 风险事件率
- 平均执行时间
- 平均奖励

### 进化实验

Codex PM 支持不同的 PM "人格"配置，可以实验哪种策略最适合你的项目：

```bash
# 查看可用的 profiles
codex-pm evolve --list

# 生成进化报告
codex-pm evolve --report
```

可用的 profiles：
- **balanced** - 平衡型（默认）
- **conservative** - 保守型，低风险
- **startup** - 创业型，快速交付
- **research** - 研究型，允许实验

### 故障修复

如果任务失败了，可以尝试自动修复：

```bash
# 修复最近失败的任务
codex-pm repair

# 修复指定任务
codex-pm repair --task P1-T003

# 只生成修复提示
codex-pm repair --dry-run
```

---

## 命令参考

### doctor

检查环境和配置。

```bash
codex-pm doctor
```

### scan

扫描文档并构建任务图。

```bash
codex-pm scan
```

### status

查看项目状态。

```bash
codex-pm status
```

### next

推荐下一个任务。

```bash
codex-pm next
```

### run-one

执行单个任务。

```bash
codex-pm run-one [选项]

选项:
  --task <taskId>    指定任务 ID
  --dry-run          只生成提示，不执行
```

### run

循环执行多个任务。

```bash
codex-pm run [选项]

选项:
  --max-tasks <N>     最多执行 N 个任务 (默认: 5)
  --dry-run           只生成提示，不执行
  --energy-budget <N> 能量预算 (默认: 500)
```

### repair

修复失败的任务。

```bash
codex-pm repair [选项]

选项:
  --task <taskId>    指定任务 ID
  --dry-run          只生成修复提示，不执行
```

### fitness

查看适应度指标。

```bash
codex-pm fitness [选项]

选项:
  --task <taskId>    查看指定任务的指标
```

### evolve

进化实验分析。

```bash
codex-pm evolve [选项]

选项:
  --report           生成进化报告
  --episodes <N>     限制最近 N 个 episodes
  --profile <name>   按 profile 过滤
  --list             列出可用 profiles
  --compare <name>   与指定 profile 比较
```

---

## 状态目录结构

Codex PM 的所有状态都保存在 `.codex-pm/` 目录中：

```
.codex-pm/
├── state.json          # 主状态文件（任务、进度等）
├── doc-index.json      # 文档索引
├── task-runs.jsonl     # 任务运行记录
├── audit.jsonl         # 审计日志（JSON Lines 格式）
├── episodes.jsonl      # 进化 episode 日志
├── prompts/            # 生成的提示词
│   ├── P0-T001.md
│   └── ...
├── reports/            # 循环运行报告
│   ├── loop-<timestamp>.json
│   └── ...
├── memory/             # 记忆存储
└── results/            # 任务执行结果
```

### 忽略状态目录

建议将 `.codex-pm/` 添加到 `.gitignore`：

```gitignore
.codex-pm/
```

---

## 最佳实践

### 1. 任务粒度要适中

- 单个任务应该在 1-4 小时内完成
- 太大的任务拆分成多个子任务
- 太小的任务可以合并

### 2. 验收标准要具体

**不好的：**
```
- 功能要好用
- 代码要漂亮
```

**好的：**
```
- 用户可以点击按钮提交表单
- 表单验证错误时有明确提示
- npm test 所有测试通过
```

### 3. 验证命令要可靠

每个任务都应该有可自动运行的验证命令：
- 单元测试
- 类型检查
- Lint 检查
- 构建成功

### 4. 合理设置风险

涉及以下内容的任务应标记为 high 或 critical 风险：
- 认证、权限、安全
- 数据库 schema 变更
- 核心业务逻辑重构
- 生产环境配置

### 5. 利用依赖关系

合理设置任务依赖，让 Codex PM 知道执行顺序：
- 基础组件先做
- 依赖前置任务的后做
- 并行任务不要设置依赖

---

## 故障排除

### doctor 检查失败

**问题：** TypeScript 检查失败

**解决：** 确保全局安装了 TypeScript，或者项目内安装：

```bash
npm install --save-dev typescript
```

### scan 找不到任务

**问题：** 扫描后显示 0 个任务

**解决：**
1. 确保 `docs/TASKS.md` 存在
2. 检查任务格式是否正确（必须用 `###` 开头）
3. 检查必填字段是否都有

### 任务一直是 blocked

**问题：** 任务状态是 blocked，无法运行

**解决：**
1. 检查依赖的任务是否已完成
2. 运行 `codex-pm status` 查看依赖关系
3. 先完成前置任务

### 高风险任务被阻止

**问题：** 任务因为风险太高被阻止

**解决：**
1. 确认任务确实需要执行
2. 设置 `Human approval: yes` 标记为已批准
3. 使用默认安全沙箱运行：`codex-pm run-one --task <task-id> --sandbox workspace-write`

### 提示文件生成有问题

**问题：** 生成的提示词不完整或有错误

**解决：**
1. 检查 `docs/TASKS.md` 中的任务定义
2. 检查提示模板文件（如果自定义了）
3. 运行 `codex-pm scan` 重新扫描

---

## 常见问题

### Q: Codex PM 和其他 AI 编程工具有什么区别？

A: Codex PM 是一个**项目管理器**，不是代码生成器。它负责调度、风险控制、验证和学习，实际编码工作由 Codex 完成。

### Q: 可以和其他任务管理工具一起用吗？

A: 可以。Codex PM 的任务定义在 Markdown 文件里，你可以用其他工具做项目管理，Codex PM 负责执行层面。

### Q: 支持哪些编程语言？

A: Codex PM 本身是 TypeScript 写的，但可以管理任何语言的项目，只要验证命令能在命令行运行。

### Q: 数据保存在哪里？

A: 所有数据都在本地 `.codex-pm/` 目录里，没有云服务，没有远程遥测。

### Q: 怎么自定义 PM 策略？

A: 修改基因组配置文件（功能即将推出），或者使用预设的 profile：

```bash
codex-pm evolve --list
```

---

## 下一步

- 查看 [示例项目](../examples/hello-codex/)
- 阅读 [产品需求文档](01_PRD.md)
- 了解 [系统架构](03_SYSTEM_ARCHITECTURE.md)
- 探索 [进化实验规范](05_EVOLUTION_EXPERIMENT_SPEC.md)
