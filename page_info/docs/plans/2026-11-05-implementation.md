# DeepSeek Reliability Research Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付一个可离线打开、证据明确、以故障恢复与预防为核心的 DeepSeek API 稳定性单页研究台。

**Architecture:** 模块化静态源文件及研究数据通过构建脚本内联到单页 HTML。纯函数负责教学计算、过滤和协议判定；页面渲染使用本地结构化研究数据。

**Tech Stack:** HTML、CSS、原生 JavaScript、Node 内置测试、Python Playwright。

---

## Task 1：并行研究与来源审计

- 官方架构、API 契约、参考推理系统分工核查。
- 主代理核查状态事件、合并证据、区分当前与历史。
- 产出 `src/data.js` 中的来源登记表与架构条目。
- 验收：每项事实有来源；推论不伪装为官方实现。

## Task 2：计算与过滤的行为测试

- 创建 `tests/core.test.cjs`，使用手算结果测试工作量、重试和 N-1 容量。
- 验证错误/空输入、重试为零、失败概率边界、工作量过滤。
- 先运行得到缺失功能的预期失败，再实现 `src/core.js`。
- 运行 `node --test tests/core.test.cjs`。

## Task 3：研究内容与故障处置库

- 创建 `src/data.js`，包含架构、生命周期、故障、观测、演练与来源。
- 每个故障包含诊断证据、排除项、即时止损、后续恢复、验收、预防与禁忌。
- 从同一数据生成 `research.md`、`sources.json`，避免页面与文字稿漂移。

## Task 4：单页实现与构建

- 创建 `src/shell.html`、`src/style.css`、`src/app.js`。
- 创建 `tools/build.mjs` 将源文件内联到 `index.html`。
- 提供搜索、筛选、节点到故障链接、生命周期切换、计算器与来源检索。
- 无外部资源依赖；内容在脚本失败时有说明。

## Task 5：真实浏览器验证

- 在工作目录创建临时测试环境安装 Playwright，不给页面增加运行依赖。
- 创建 `tests/browser_smoke.py`，测试离线 file URL、桌面和移动视口。
- 验证搜索零结果、清除筛选、场景变化、计算结果、来源链接、无水平溢出、无脚本错误。
- 保存截图并目视检查；修正实际问题后重复相关检查。

## Task 6：交付

- 编写 `README.md`、`verification-report.md`。
- 检查研究覆盖和内容边界，确保目录中为完整可复现交付。
- 打开 `index.html` 供用户查看，并简要报告内容及验证结果。
