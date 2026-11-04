# 贡献指南

感谢你愿意改进 LangEditor。提交前请先搜索已有 Issue，确认问题没有被重复报告。

## 开发环境

- Node.js 20.19 或更高版本
- pnpm 11
- Git

初始化项目：

```bash
pnpm install
pnpm check
```

## 分支与提交

从默认分支创建独立分支，分支名称建议使用：

```text
feat/功能名称
fix/问题名称
docs/文档名称
refactor/重构内容
```

提交信息使用 Conventional Commits 格式，例如：

```text
feat: add table cell background extension
fix: preserve selection after external content update
docs: document upload callbacks
```

## 提交代码前

在提交 Pull Request 前运行：

```bash
pnpm check
```

如果修改了编辑行为，请在公开 `examples/` 中加入或更新最小验证场景；如果修改了公共参数、事件或扩展选项，请同步更新 README 或 `docs/`。私有 workspace 的维护者还应在私有 Playground 中同步对应的产品演示。

## Pull Request 要求

Pull Request 描述中请写清楚：

1. 修改解决了什么问题。
2. 是否改变了公共 API 或默认行为。
3. 做了哪些验证，以及验证结果。
4. 是否需要更新文档、示例或发布说明。

保持每个 Pull Request 聚焦一个主题。避免把无关格式化、依赖升级和功能修改混在一起。

## 新增扩展

新增扩展请遵循 [开发规范](./docs/development.md) 的扩展约束：扩展本体、选项类型、可选界面放在同一目录，并从 `src/extensions/index.ts` 导出。

## 报告问题

Issue 中请提供：

- Node.js、pnpm、Vue 和浏览器版本
- 最小复现步骤或仓库链接
- 期望结果和实际结果
- 浏览器控制台或构建输出中的完整错误

安全问题请不要公开提交，请按 [安全说明](./SECURITY.md) 联系维护者。

## 发布公开包

`@langeditor/core`、`@langeditor/react`、`@langeditor/plugin-docx`、
`@langeditor/plugin-spreadsheet` 和 `@langeditor/agent-core` 使用统一版本号。
发布时同步修改五份 `package.json`、两个插件的 manifest 版本和 Core 兼容范围，
并通过 pnpm 更新锁文件。

发布前清理旧构建产物，执行以下检查：

```bash
pnpm check
pnpm -r --filter '@langeditor/*' --if-present typecheck
pnpm --filter @langeditor/agent-core test
pnpm -r --filter '@langeditor/*' --if-present build
pnpm release:check
git diff --check
```

提交版本变更后，推送与版本号一致的 `vX.Y.Z` 标签。GitHub 发布工作流会校验版本，
构建并将五个包发布到 `https://registry.npmjs.org`；已存在的版本会跳过。
工作流使用仓库的 `NPM_TOKEN` secret，示例与私有 `commercial/` 工作区不会发布。
