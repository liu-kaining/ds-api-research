# 公开资料与适用边界

核验日期：2026-11-06。本文为非官方工程研究，以下均为原始论文或项目／服务方官方资料。来源支持具体机制，不构成对厂商完整生产架构、事故原因、成熟度或能力缺口的判断。

图稿为作者参考设计；正文的控制流程、所有权不变量、算例、演练与自查表为工程建议。原文中的请求样例、系统提示词或重试教程，不能自动视为正式服务保证。

## 一、公开案例台账

| 编号 | 一手来源与版本 | 支持的有限事实 | 不可据此推断 |
| --- | --- | --- | --- |
| 1 | [Mooncake 论文 v5](https://arxiv.org/abs/2407.00079v5)，2026-10-08；初版 2024-06-24 | Kimi 背景的 KV 资源组织、P/D 分离及预测式早期拒绝研究 | 实验数字不是当前 API 容量或 SLA；开源新功能不能倒填为全部线上部署 |
| 2 | [Mooncake Store Design](https://github.com/kvcache-ai/Mooncake/blob/868a6d05abf904975840c7e0487dc256af5491d0/docs/source/design/store/mooncake-store.md)，固定 commit | 元数据与数据传输职责不同；HA 选主后有状态恢复；副本分配需检查实际结果 | 默认模式不是 Kimi 生产模式；选主或配置副本不证明自己的故障域与 RTO |
| 3 | [DeepInfer](https://github.com/deepseek-ai/DeepInfer)，研究日快照 | 公开核心范围与生产系统存在差别 | 仓库不等于可复现完整在线 API |
| 4 | [DeepInfer Deployment Q&A v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)，2026-11-03 | 对应部署中的阶段、并行、状态与实例故障约束 | 不代表所有模型、硬件或地域；优雅缩容不证明突然故障可无损续写 |
| 5 | [Kimi errors](https://platform.kimi.ai/docs/api/errors.md)，滚动契约 | 同为 429 可以对应引擎过载、组织限额、额度等不同错误类型 | 不能形成跨厂商统一重试表 |
| 6 | [Kimi context caching](https://platform.kimi.ai/docs/guide/context-caching.md)，滚动契约 | 前缀复用、隔离、有效期与 usage 口径 | 缓存命中不证明生成执行态可恢复；不固定价格或模型列表 |
| 7 | [智谱 API 错误码](https://docs.bigmodel.cn/cn/api/api-code)，滚动契约 | HTTP 状态与业务码、SSE 生成结束异常分类 | HTTP 429 不唯一对应容量过载；200 不代表完整任务 |
| 8 | [智谱 Responses](https://docs.bigmodel.cn/cn/guide/develop/responses/introduction)，滚动契约 | 支持 store、previous_response_id；有存储默认值、有效期和独立终态 | 保存会话不等于保存执行态、无损续写或业务动作恰好一次 |
| 9 | [百炼限流](https://help.aliyun.com/zh/model-studio/rate-limit)，滚动契约 | 动态／静态模式、账户统计范围及相应承诺不同 | 不绝对表述“配额一概不保证吞吐”；API Key 不等于额外资源 |
| 10 | [百炼吞吐预留](https://help.aliyun.com/zh/model-studio/tpm-reservation)，滚动契约 | 输入输出分别预留；可配置溢出或仅用预留；有观测入口 | 不自动证明低延迟、物理隔离或跨故障域剩余容量 |
| 11 | [百炼 PTU](https://help.aliyun.com/zh/model-studio/ptu-long-input-and-cache)，滚动契约 | 该模式的自动溢出、共享池条件和溢出标记 | 不把专属字段泛化到所有产品；文档中的模型上限数值需使用时复核 |
| 12 | [百炼 DTU](https://help.aliyun.com/zh/model-studio/dtu-model-deployment)，滚动契约 | 独占资源与共享／逻辑隔离模式有不同边界，仍受实际承载约束 | 未披露的地域、机架或 N−1 能力保持未知，不反推为“没有容灾” |

## 二、参考实现与观测依据

| 编号 | 一手来源与版本 | 用途 | 适用边界 |
| --- | --- | --- | --- |
| 13 | [Dynamo Cancellation Architecture v1.6.1](https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture) | 区分取消信号与实际引擎中止 | 不把信号计数当资源释放，也不推定其他厂商实现相同 |
| 14 | [Dynamo Request Migration v1.6.1](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration) | 迁移需要版本、请求类型和配置支持 | 不是所有请求默认可续写；不推出普适无损恢复 |
| 15 | [Dynamo Graceful Shutdown v1.6.1](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown) | 摘流、排空与退出时序参考 | 优雅退出条件与突然硬件故障不同 |
| 16 | [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/) | 工作成本、过载、重试预算与负反馈 | 不沿用固定阈值为通用推荐 |
| 17 | [DistServe](https://arxiv.org/abs/2401.09670)，OSDI 2024 | 阶段延迟目标与 goodput 的取舍 | 实验提升不是服务承诺 |
| 18 | [vLLM Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)，stable 快照 | 理解 TTFT、ITL、队列与执行状态观测 | 指标名随版本变化；不表示讨论厂商使用 vLLM |
| 19 | [DeepEP](https://github.com/deepseek-ai/DeepEP)，研究日快照 | 专家 Token dispatch/combine 通信职责 | 通信库性能不等于平台可靠性保证 |
| 20 | [EPLB](https://github.com/deepseek-ai/EPLB)，研究日快照 | 专家副本与放置 | 专家负载副本不是完整服务备用 |
| 21 | [deepseek-recipe](https://github.com/deepseek-ai/deepseek-recipe)，研究日快照 | 输入输出处理与协议边界 | 不等于账户、网关、安全或计费系统实现 |
| 22 | [DeepSeek Rate Limit](https://api-docs.deepseek.com/quick_start/rate_limit/)，滚动契约 | 排队保活与并发／隔离语义 | 活跃连接不等于开始推理；数字额度不写死 |
| 23 | [DeepSeek Responses](https://api-docs.deepseek.com/guides/responses_api/)，滚动契约 | 对照端点状态、字段和终态支持范围 | 不能将它的状态约束推广到其他厂商同名 API |
| 24 | [Kimi limits](https://platform.kimi.ai/docs/pricing/limits.md)，滚动契约 | 多维限额及能力范围 | 不能把某项额度直接换算成任意任务分布下的固定 QPS |
| 25 | [智谱缓存能力](https://docs.bigmodel.cn/cn/guide/capabilities/cache)，滚动契约 | 前缀与 cached_tokens 用量观察 | 长 system 示例是请求载荷，不是恢复保障规范 |
| 26 | [Mooncake Transfer Engine](https://github.com/kvcache-ai/Mooncake/blob/main/docs/source/design/transfer-engine/index.md)，main 快照 | 拓扑、替代路径与异步传输生命周期的补充 | 换路径依赖可达性和带宽，不保证任意分区无损恢复 |
| 27 | [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)，滚动契约 | 输出及结束原因分类 | 长度、资源、策略与工具交接不能混为同一种成功或失败 |
| 28 | [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) | 理解依赖变慢、重试和恢复负载的放大路径 | 文中六阶段处置与数字为作者教学设计，不是书中案例或厂商事故 |
| 29 | [Envoy External Authorization](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter)，latest 快照 | 外部授权有独立错误／拒绝指标及故障放行配置 | 不推定厂商使用 Envoy；不把配置开关当作推荐关闭授权 |
| 30 | [Envoy Rate Limit](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter)，latest 快照 | 全局限流依赖错误可按对应配置选择处理策略 | 限流不等于余额或资源预留，不据此推导计费／额度正确性 |
| 31 | [etcd Failure Modes](https://etcd.io/docs/v3.6/op-guide/failures/)，v3.6 | 选主、失去多数派与分区具有不同可用性边界 | 不推定厂商使用 etcd，也不把删除数据或强行恢复写入作为通用操作 |
| 32 | [etcd API Guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/)，v3.6 | 超时／网络中断可使客户端无法确认操作状态；一致性语义有具体接口范围 | 不把重试响应或一次空查询视为业务动作未提交；watch 与 KV 语义不能混用 |

## 三、算例与控制方案不是厂商实测

- 100 请求/秒、8,000 输入 Token、90%／50% 命中，以及四个实例的 100／70 容量均为教学假设。
- `L=λW` 需匹配统计边界；持续积压时不能用它证明稳定容量。
- `(N−k)C×预算系数` 只适用于简化同分布场景；C 若已有相同余量，不重复折扣。
- Token 工作预算与状态占用分开；不同资源不能相加为一个具有普适保证的分数。
- owner fencing 不推出客户端恰好一次接收；动作幂等需要实际业务系统合作。
- 所有恢复流量，包括预热、迁移、探针、影子和重试，都需计入相关资源约束。
- 完整推演新增的原始 200 次／秒、40 次／秒额外尝试及 10 个等价预热工作单位都是教学输入，不是实测；只有内部工作成本已经校准时才可将 147 减成外部 137，再分成原始 130 与额外 7。
- 新增共享依赖图、16 项快速处置表与术语表属于作者参考设计。隔离粒度、保守运行模式、持久缓冲及信用边界均需由自身实现验证。

## 四、发表与更新时复核什么

固定论文／commit 便于追溯；滚动文档则应重新核对端点、模式、限制、默认值和字段。引用开源 HA、迁移、重试示例时，尤其要确认版本、默认开关和失败范围。

文章没有内部 trace、实际生产容量曲线或厂商值班记录，不提供故障频率排名、内部成熟度结论和生产参数。正文中的反查题旨在要求读者提供自己的证据。
