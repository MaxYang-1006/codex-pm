# 常见问题解答 (FAQ)

## 基础概念

### Q: 什么是 Codex PM？

A: Codex PM 是一个文档驱动的项目管理器，专门为 Codex 设计。它将 Markdown 文档转化为可验证的开发进度，负责任务调度、风险控制、成本管理等"小脑"功能。

### Q: Codex PM 和 Codex 是什么关系？

A: 
- **Codex** 是大脑，负责实际编码工作
- **Codex PM** 是小脑/项目经理，负责调度、风险、验证和学习

Codex PM 不生成代码，它管理 Codex 的执行过程。

### Q: 为什么叫"小脑"？

A: 大脑负责思考和创造，小脑负责协调、平衡和自动化控制。Codex PM 就像小脑一样，让 Codex 的开发过程更有序、更可控。

---

## 安装和配置

### Q: 如何安装 Codex PM？

A: 

```bash
# 全局安装
npm install -g codex-pm

# 或项目内安装
npm install --save-dev codex-pm
```

### Q: 需要什么环境？

A:
- Node.js 18+ (推荐 20+)
- npm 或 yarn
- Codex CLI (用于实际执行任务)

### Q: 必须安装 Codex CLI 吗？

A: 不一定。你可以只用 `--dry-run` 模式生成提示词，然后手动复制到 Codex 中使用。但要获得完整体验，建议安装 Codex CLI。

---

## 使用方法

### Q: 如何开始一个新项目？

A:

```bash
# 1. 创建项目目录
mkdir my-project && cd my-project

# 2. 创建 docs 目录
mkdir docs

# 3. 创建 TASKS.md 定义任务
# （参考 examples/hello-codex/docs/TASKS.md）

# 4. 扫描并开始
codex-pm doctor
codex-pm scan
codex-pm next
```

### Q: 任务怎么定义？

A: 在 `docs/TASKS.md` 中用 Markdown 格式定义。每个任务以 `###` 开头，包含状态、优先级、风险等字段。

详细格式请参考 [使用教程](TUTORIAL.md#任务定义格式)。

### Q: 可以用中文写任务吗？

A: 完全可以！任务描述、验收标准都支持中文。Codex PM 对内容语言没有限制。

### Q: 如何查看当前进度？

A:

```bash
codex-pm status
```

会显示总体进度、各区域完成情况、最近活动等。

### Q: 怎么知道下一个该做什么？

A:

```bash
codex-pm next
```

Codex PM 会根据优先级、解锁数量、风险等因素智能推荐。

---

## 任务执行

### Q: dry-run 模式是什么？

A: `--dry-run` 模式只生成任务提示词，不实际调用 Codex 执行。适合：
- 第一次使用，想看看效果
- 检查提示词是否合理
- 手动复制到其他 Codex 界面使用

```bash
codex-pm run-one --dry-run
```

### Q: 如何执行单个任务？

A:

```bash
# 执行推荐的下一个任务
codex-pm run-one

# 执行指定任务
codex-pm run-one --task P1-T003
```

### Q: 如何批量执行任务？

A:

```bash
# 执行最多 5 个任务
codex-pm run --max-tasks 5

# 自定义能量预算
codex-pm run --energy-budget 300
```

### Q: 任务执行失败了怎么办？

A:

1. 查看失败原因（在输出中或 `.codex-pm/` 目录中）
2. 尝试自动修复：`codex-pm repair`
3. 如果修复失败，手动修复后重新运行

### Q: 修复功能怎么用？

A:

```bash
# 修复最近失败的任务
codex-pm repair

# 修复指定任务
codex-pm repair --task P1-T003

# 只生成修复提示
codex-pm repair --dry-run
```

---

## 风险和安全

### Q: 风险等级是怎么评估的？

A: 综合考虑多个因素：
- 任务声明的风险等级
- 描述中的关键词（auth、password、delete 等）
- 涉及的文件类型（.env、migrations、config 等）
- 历史风险记录

### Q: 高风险任务被阻止了怎么办？

A: 有几种方式：

1. **确认任务安全后**，在 TASKS.md 中设置 `Human approval: yes`
2. 拆分任务，降低单个任务的风险
3. 使用更保守的 profile（不推荐，可能降低质量）

### Q: 哪些操作是禁止自动修改的？

A: 为了安全，以下内容 Codex PM 不会自动修改：
- 禁用沙箱环境
- 绕过审批门控
- 删除审计日志
- 削弱安全规则
- 修改生产部署策略

### Q: 数据会上传到云端吗？

A: **不会**。所有数据都保存在本地 `.codex-pm/` 目录中：
- 没有云服务
- 没有远程遥测
- 没有数据上传

你的代码和项目数据完全在本地。

---

## 适应度和进化

### Q: 适应度指标有什么用？

A: 适应度指标帮助你了解项目的健康状况：

```bash
codex-pm fitness
```

包括：
- 完成率：任务按时完成的比例
- 验证通过率：验证命令通过的比例
- 重试率：需要重试的任务比例
- 风险事件率：高风险任务的比例

### Q: 什么是基因组（Genome）？

A: 基因组是 Codex PM 的"人格"配置，决定了它的行为偏好：

- **balanced** - 平衡型（默认）
- **conservative** - 保守型，低风险，重验证
- **startup** - 创业型，快速度，接受技术债务
- **research** - 研究型，允许实验

### Q: 怎么切换 genome profile？

A: 目前可以通过进化实验来测试不同 profile 的效果：

```bash
# 查看可用 profiles
codex-pm evolve --list

# 生成进化报告
codex-pm evolve --report
```

直接切换 profile 的功能即将推出。

### Q: 进化实验是什么？

A: 进化实验让你可以测试不同的 PM 策略，找出最适合你项目的方式。通过记录每个任务的执行结果，分析哪种策略效果最好。

---

## 状态和数据

### Q: 状态保存在哪里？

A: 所有状态都在 `.codex-pm/` 目录中：

```
.codex-pm/
├── state.json          # 主状态
├── doc-index.json      # 文档索引
├── task-runs.jsonl     # 运行记录
├── prompts/            # 生成的提示词
└── reports/            # 循环报告
```

### Q: 可以删除状态重新开始吗？

A: 可以，直接删除 `.codex-pm/` 目录：

```bash
rm -rf .codex-pm/
```

然后重新运行 `codex-pm scan` 即可。

### Q: 应该把 .codex-pm 提交到 Git 吗？

A: **不建议**。`.codex-pm/` 包含本地状态、运行记录等，应该添加到 `.gitignore`：

```gitignore
.codex-pm/
```

### Q: 怎么备份状态？

A: 直接复制 `.codex-pm/` 目录即可。这是一个自包含的目录。

---

## 高级问题

### Q: 可以自定义提示模板吗？

A: 可以（功能即将完善）。提示模板在 `templates/prompts/` 目录中，可以根据需要修改。

### Q: 支持多项目吗？

A: 支持。每个项目有自己的 `.codex-pm/` 目录，互不干扰。

### Q: 可以和 CI/CD 集成吗？

A: 可以。Codex PM 的所有命令都是非交互式的，可以在 CI 中运行：

```yaml
# GitHub Actions 示例
- name: Scan docs
  run: codex-pm scan
  
- name: Check status
  run: codex-pm status
```

### Q: 如何贡献代码？

A: 欢迎贡献！请参考：
1. 阅读 `AGENTS.md` 了解开发规则
2. 查看 `docs/11_TASKS.md` 了解任务列表
3. 提交 Pull Request

---

## 故障排除

### Q: 命令执行报错怎么办？

A:

1. 先运行 `codex-pm doctor` 检查环境
2. 查看错误信息的详细内容
3. 检查 Node.js 版本是否符合要求
4. 尝试删除 `.codex-pm/` 重新开始

### Q: 扫描不到任务怎么办？

A:

1. 确认 `docs/TASKS.md` 存在
2. 确认任务用 `###` 开头（三级标题）
3. 确认必填字段都有（Status、Priority、Risk 等）
4. 运行 `codex-pm doctor` 检查

### Q: 任务一直是 blocked 状态？

A: 说明这个任务的依赖还没完成。运行 `codex-pm status` 查看依赖关系，先完成前置任务。

### Q: 验证命令总是失败？

A:

1. 检查验证命令是否正确
2. 手动运行验证命令看看错误信息
3. 确认环境配置正确（依赖已安装等）
4. 如果是合理失败，可以调整验收标准

### Q: 遇到 bug 怎么办？

A: 请在 GitHub 上提交 Issue，包含：
- 复现步骤
- 错误信息
- 你的环境信息（Node.js 版本、操作系统等）
- 如果可以，附上 `.codex-pm/` 中的相关日志

---

## 其他问题

### Q: Codex PM 是开源的吗？

A: 是的！MIT 许可证，自由使用。

### Q: 适合什么规模的项目？

A: 
- **小型项目**（1-10 个任务）：完全没问题
- **中型项目**（10-50 个任务）：表现良好
- **大型项目**（50+ 任务）：可以使用，但可能需要优化

### Q: 和 GitHub Issues / Jira 比怎么样？

A: 定位不同：
- GitHub Issues / Jira：人工项目管理工具
- Codex PM：AI 开发的自动化项目经理

Codex PM 专注于 AI 辅助开发场景，不替代传统项目管理工具。

### Q: 有路线图吗？

A: 有的！查看 `docs/` 目录下的文档，特别是 `11_TASKS.md` 了解当前开发进度。

---

还有其他问题？欢迎在 GitHub Discussions 中提问！
