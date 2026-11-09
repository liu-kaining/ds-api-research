# 交付验证记录

验证日期：2026-11-05，Asia/Shanghai。

## 本次交付

- 自包含单页 `index.html`，无网络或服务运行依赖。
- 13 个组件的架构全景、20 个传播节点的故障全景、28×13 故障触点矩阵。
- 28 份故障剧本；各有症状、机制、判别、止损、恢复、验收、预防与禁忌。
- 34 项一手来源及证据边界。
- 6 个生命周期教学场景、3 个数学实验、14 项观测和 12 类演练。
- 独立 SVG / PNG 图稿、完整文字稿、结构化来源及可复现源文件。

## 实际执行

```sh
node tools/build.mjs
node --test tests/core.test.cjs
node --check src/app.js
node --check src/atlas.js
```

构建成功。研究数据的来源 ID、故障 ID、关联关系及必备处置字段通过构建校验。5 组核心行为测试通过，覆盖重试边界、工作量/稳定在途数、完整实例 N−1、复合筛选和协议终态分类。脚本语法检查通过。

浏览器命令：

```sh
/Users/liqian/Documents/Codex/2026-11-05/kai/work/research-test-env/bin/python tests/browser_smoke.py --channel chrome
```

使用系统 Google Chrome 的全新无头上下文，**断网**运行。桌面视口 1440×1000，手机视口 390×844。

**43 项浏览器检查通过，JavaScript 运行错误 0，外部网络请求 0。** 逐项记录见 `artifacts/browser-checks.json`。

涵盖：

- file URL 离线启动、故障深链接。
- 全景的连接结构、节点联动、放大、全屏、Esc 退出及回到原位置。
- 全屏内跳转处置会退出模态，不将故障库藏在对话框后面。
- 故障传播链切换、反馈切断标记、全部故障矩阵跳转。
- 搜索空态、复合筛选、全部 28 条处置逐一打开。
- 六场景切换、键盘操作、三个计算器的手算样例与 N=1 边界。
- 来源定位/展开/检索，独立图稿导出。
- 手机故障选择与全屏、各实验无根级水平溢出。

复查曾暴露测试对原生 dialog `close` 事件的时序假设：关闭标记先变化，元素随后归位。已按实际 DOM 条件等待关闭及归位，不使用任意休眠掩盖时序。修正后的完整检查通过。

## 目视核对

已查看桌面首页、手机首页、架构全景与故障全景图稿，检查中文排版、箭头、分层、条件分支、故障域、保护切断点和标签可读性。

图稿：

- `diagrams/architecture-panorama.svg`
- `diagrams/architecture-panorama.png`
- `diagrams/failure-panorama.svg`
- `diagrams/failure-panorama.png`

截图：

- `artifacts/desktop-overview.png`
- `artifacts/desktop-architecture.png`
- `artifacts/desktop-runbook.png`
- `artifacts/mobile-overview.png`
- `artifacts/mobile-runbook.png`

## 验证范围

本次没有 Safari / Firefox 自动化检查，没有真实 DeepSeek API 请求、生产故障注入、内部数据或恢复演练。43 项检查证明本地交付与交互行为，不证明 DeepSeek 当前生产容量或真实恢复保证。来源原文在研究过程中核验；离线浏览器测试不逐个请求外部来源页面。
