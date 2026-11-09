# DeepSeek API 稳定性研究台

直接双击 `index.html` 打开。页面是自包含的单页文件，不需要安装依赖、启动服务或联网。来源原文需要联网后主动点击查看。

研究快照：**2026-11-05，Asia/Shanghai**。以 DeepSeek 官方资料为锚点，覆盖架构、典型故障、判别证据、止损、恢复、验收和预防。

## 建议阅读路径

1. **架构全景**：沿请求/返回、状态、条件分支和控制职责读图；点击节点联动组件解释与故障手册。
2. **故障全景**：选择“缓存→重试”“单卡→容量”“取消→占用”“发布→结果”，切换保护模式理解反馈切断点。图中箭头是机制推演，不是已发生事故或发生概率。
3. **故障处置库**：用症状、组件和关键字筛选 28 类故障；每类包含完整判别与恢复验收。按 `/` 聚焦搜索。
4. **三个实验**：工作量/缓存、单层重试与多层最坏放大、整实例 N−1。所有数字是教学假设。
5. **观测与预防**：14 项观测、SLO 口径、12 类演练及分阶段建设建议。
6. **证据登记**：34 项一手来源、主张分类、真实公开事件及未知边界。

全景图支持放大、缩小、全览、全屏、滚动和键盘激活；退出全屏按 Esc。点击图中的处置卡会返回故障库。页面也可打印；完整 28 类处置的线性文字版见 `research.md`。

## 文件

- `index.html`：最终单页；CSS、数据和脚本全部内联，可单独复制分享。
- `research.md`：由相同研究数据生成的完整文字稿。
- `sources.json`：来源、日期、支持范围和不能推断的内容。
- `diagrams/architecture-panorama.svg`、`.png`：独立架构全景图。
- `diagrams/failure-panorama.svg`、`.png`：独立故障全景图。
- `artifacts/`：浏览器验证结果与桌面/手机截图。
- `methodology.md`：研究方法、证据等级和限制。
- `src/`、`tools/`、`tests/`：可复现源文件、构建和验证脚本。
- `verification-report.md`：本次实际验证记录。

## 证据边界

“官方披露”“API 契约”“历史快照”“参考实现”“工程推演”分开标记。DeepInfer 开源范围不是完整在线 API；V3/R1 历史硬件与成本不能当当前承诺；vLLM/SGLang/Dynamo 不是 DeepSeek 内部选型证据。真实公开事件未披露技术 RCA 的部分保持未知。

恢复动作属于有前提的工程建议，不是 DeepSeek 内部运维指令。本研究没有真实账户/API 调用、生产访问、故障注入或付费请求。

## 修改与复现

页面无运行依赖。修改 `src/` 后，用 Node.js 20 或更高版本构建：

```sh
node tools/build.mjs
node --test tests/core.test.cjs
```

浏览器检查需要 Python 3 与 Playwright；页面用户无需安装这些工具。测试使用独立浏览器上下文，默认调用已安装的 Google Chrome：

```sh
python3 -m venv /path/to/test-env
/path/to/test-env/bin/python -m pip install playwright
/path/to/test-env/bin/python tests/browser_smoke.py --channel chrome
```

如使用 Playwright 自带 Chromium，先按 Playwright 官方方式安装浏览器，再传 `--channel ""`。检查全程断网，验证 file URL 离线运行；同时重新生成图稿和截图。测试环境不属于页面交付依赖。

动态官方文档日后可能变化；重要部署问答已固定 commit，其他资料按研究日登记。更新时应复核 API 契约、版本和迁移支持范围，重新构建与验证。
