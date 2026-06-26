# Codex PM 示例项目

这里是一些使用 Codex PM 的示例项目，帮助你快速上手。

## 示例列表

### 1. hello-codex - 入门示例

最简单的示例项目，展示基本的 Codex PM 工作流。

**特点：**
- 6 个任务，从初始化到多语言支持
- 清晰的任务依赖关系
- 适合第一次接触 Codex PM

**快速开始：**

```bash
cd hello-codex
codex-pm doctor
codex-pm scan
codex-pm status
codex-pm next
codex-pm run-one --dry-run
```

## 如何使用示例

### 1. 复制示例项目

```bash
cp -r examples/hello-codex my-project
cd my-project
```

### 2. 初始化 Codex PM

```bash
codex-pm doctor
codex-pm scan
```

### 3. 探索任务

```bash
codex-pm status
codex-pm next
```

### 4. 执行任务

```bash
# 先 dry-run 看看效果
codex-pm run-one --dry-run

# 确认没问题后真正执行
codex-pm run-one
```

## 自己创建示例

想分享你的 Codex PM 使用案例？欢迎提交 PR！

### 示例项目结构建议

```
your-example/
├── README.md          # 项目说明
├── docs/
│   └── TASKS.md       # 任务定义
├── src/               # 源代码（由 Codex 生成）
└── tests/             # 测试（由 Codex 生成）
```

### 好的示例应该

- 循序渐进，从简单到复杂
- 有清晰的任务依赖关系
- 包含不同风险等级的任务
- 有可自动运行的验证命令
- README 说明项目目标和学习要点

## 下一步

- 阅读 [使用教程](../docs/TUTORIAL.md)
- 查看 [常见问题解答](../docs/FAQ.md)
- 了解 [产品需求文档](../docs/01_PRD.md)
