# Hello Codex - 示例项目

这是一个使用 Codex PM 的简单示例项目，展示了基本的文档优先工作流。

## 项目目标

使用 Codex PM 管理一个简单的问候程序开发项目。

## 快速开始

```bash
# 1. 初始化 Codex PM
codex-pm doctor

# 2. 扫描文档
codex-pm scan

# 3. 查看项目状态
codex-pm status

# 4. 获取下一个推荐任务
codex-pm next

# 5. 试运行任务（只生成提示）
codex-pm run-one --dry-run
```

## 项目结构

```
hello-codex/
├── docs/
│   └── TASKS.md    # 任务定义
├── src/
│   └── hello.ts    # 源代码（由 Codex 生成）
├── tests/
│   └── hello.test.ts  # 测试（由 Codex 生成）
└── README.md       # 项目说明
```
