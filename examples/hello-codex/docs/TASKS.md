# Hello Codex Tasks

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
初始化 TypeScript 项目结构，创建 package.json 和 tsconfig.json。

Acceptance:
- package.json 文件存在
- tsconfig.json 文件存在
- TypeScript 编译配置正确
- src/ 目录存在

Verify:
- ls package.json
- ls tsconfig.json

Files to modify:
- package.json
- tsconfig.json
- src/

---

### P0-T002: 创建问候函数

Status: pending
Priority: 8
Risk: low
Size: S
Area: core
Depends on: P0-T001
Human approval: no
Locked: no

Description:
创建一个简单的问候函数 sayHello(name)，返回 "Hello, {name}!"。

Acceptance:
- src/hello.ts 文件存在
- 函数 sayHello 正确导出
- 传入 "World" 返回 "Hello, World!"
- 支持空名称返回 "Hello, there!"

Verify:
- ls src/hello.ts
- npm run build

Files to modify:
- src/hello.ts

---

### P1-T001: 添加 CLI 入口

Status: pending
Priority: 7
Risk: low
Size: S
Area: cli
Depends on: P0-T002
Human approval: no
Locked: no

Description:
创建 CLI 入口文件，支持命令行参数调用问候函数。

Acceptance:
- src/index.ts 文件存在
- 支持 node dist/src/index.js 运行
- 支持 --name 参数指定名称
- 正确输出来自 sayHello 的结果

Verify:
- ls src/index.ts
- npm run build

Files to modify:
- src/index.ts
- package.json (bin field)

---

### P1-T002: 编写单元测试

Status: pending
Priority: 6
Risk: low
Size: M
Area: testing
Depends on: P0-T002
Human approval: no
Locked: no

Description:
为 sayHello 函数编写完整的单元测试。

Acceptance:
- tests/hello.test.ts 文件存在
- 测试正常名称
- 测试空名称
- 测试特殊字符
- 所有测试通过

Verify:
- ls tests/hello.test.ts
- npm test

Files to modify:
- tests/hello.test.ts

---

### P2-T001: 添加多种语言支持

Status: pending
Priority: 5
Risk: low
Size: M
Area: i18n
Depends on: P0-T002
Human approval: no
Locked: no

Description:
添加多语言支持，支持中文、英文、日文问候。

Acceptance:
- 支持 --lang 参数
- 英文: Hello, {name}!
- 中文: 你好，{name}！
- 日文: こんにちは、{name}！
- 默认英文

Verify:
- npm run build
- node dist/src/index.js --name 世界 --lang zh

Files to modify:
- src/hello.ts
- src/index.ts

---

### P2-T002: 添加格式化选项

Status: pending
Priority: 4
Risk: medium
Size: M
Area: feature
Depends on: P0-T002
Human approval: no
Locked: no

Description:
添加问候语格式化选项，支持大写、小写、标题大小写。

Acceptance:
- 支持 --format 参数
- uppercase: 全部大写
- lowercase: 全部小写
- title: 标题大小写
- 默认原样输出

Verify:
- npm run build
- node dist/src/index.js --name world --format uppercase

Files to modify:
- src/hello.ts
- src/index.ts

---

## 任务统计

- 总任务数: 6
- P0 阶段: 2 个任务
- P1 阶段: 2 个任务
- P2 阶段: 2 个任务
- 预估完成时间: 1-2 小时
