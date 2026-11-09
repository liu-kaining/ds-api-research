# DeepSeek API 稳定性深度研究

研究快照：2026-11-05 · Asia/Shanghai。

这是一份基于公开资料的工程研究。故障剧本是建议，不是 DeepSeek 已发生事故或内部运维手册；未访问真实 API 或生产集群。可交互版本请打开同目录 index.html。

## 研究结论

管理对象是工作量、在途状态、完整服务实例和任务契约，不只是 QPS、连接和进程。恢复分为新请求、在途生成、外部业务动作及状态/计量四个目标。性能优化需要同时说明新增故障域、观测、退路和演练。

## 证据边界

### 当前部署披露 ≠ 整家公司完整拓扑

当前锚点是 V4.1 Flash Q&A。API 网关产品、地域数量、计费库与安全系统内部拓扑未公开，不补画厂商名称。

[S01: DeepInfer · 公开范围与推理核心](https://github.com/deepseek-ai/DeepInfer) · [S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

### 历史版本 ≠ 当前 API 承诺

V3/R1 的 2025 资料只作历史对照；不把旧 H800 规模、成本和新版本机制拼成一张“当前全景”。

[S03: V3/R1 Inference System Overview](https://github.com/deepseek-ai/open-infra-index/blob/3122a25220273cb0806f591e52c4171bd869d8ad/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md) · [S17: API Updates · 模型别名与版本](https://api-docs.deepseek.com/updates/)

### 公开设计 ≠ 已完整开源

DeepInfer 公开范围不足以重现生产 API；参考框架用来解释机制，不代表 DeepSeek 采用它们。

[S01: DeepInfer · 公开范围与推理核心](https://github.com/deepseek-ai/DeepInfer) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/) · [S32: Dynamo · Architecture](https://docs.nvidia.com/dynamo/knowledge-base/concepts/architecture)

### 故障剧本 ≠ 已发生事故

处置卡是基于公开机制的工程推演。真实状态事件只陈述已披露的影响与时间，技术根因留白。

[S18: 公开事件 · 2026-10-15](https://status.deepseek.com/incidents/7116348214287) · [S19: 公开事件 · 2026-09-20](https://status.deepseek.com/incidents/7007335047287)

## 请求链路与组件

交互架构全景位于网页第 01 部分；故障传播全景与 28×13 触点矩阵位于第 03 部分。两张图支持缩放、全屏和处置定位，静态 SVG/PNG 位于 diagrams/。传播图提供缓存/单卡/取消/发布四条机制链与反馈切断模式；它不是故障概率图或真实事故 RCA。

主路径：API 入口 → 编码/调度 → Prefill → 状态交接 → Decode → 输出解析与验收。缓存/专家/GPU/主机资源跨阶段；图片视觉编码 E 与结构化输出编译 SO 是条件分支。内部网关与控制面拆分未公开。

### 01 API 入口

承接 TLS/HTTP/SSE，识别账户与用户，执行参数和配额检查。API 契约存在，内部网关与依赖拆分未公开。

状态：连接、身份、deadline、租户并发与请求标识。

耦合风险：共享鉴权或计费依赖若同步阻塞，可能将局部依赖异常放大为入口拒绝；这是需要验证的通用风险。

优先证据：

- 看错误体与作用域，不只看 429/503 数量。
- 对齐 DNS/TLS/headers/首有效事件时间。

关联处置：F01、F15、F16、F23、F24

[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S12: Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### 02 Recipe / 编码解析

公开 Recipe 负责模型输入输出处理与响应解析；工具、思考内容、终止事件都属于接口契约的一部分。

状态：消息角色、模板/Tokenizer 版本、工具调用和增量解析状态。

耦合风险：模型、Tokenizer、模板、解析器若不兼容，可能 HTTP 成功却任务失败。

优先证据：

- 用脱敏事件类型对照原始输出与解析结果。
- 比较同模型不同 SDK/适配器的最小请求。

关联处置：F18、F19、F20、F21

[S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S15: Thinking Mode · 多轮工具协议](https://api-docs.deepseek.com/guides/thinking_mode/) · [S16: Responses API · 兼容范围](https://api-docs.deepseek.com/guides/responses_api/)

### 03 调度与准入

把工作分配给可用资源；公开 API 有用户隔离，部署材料披露阶段相关调度与扩缩容。具体网关拆分未公开；有界准入与公平保护是本研究的保障建议。

状态：等待工作量、在途请求、池容量、缓存位置、版本。

耦合风险：只按请求数准入，会忽略长输入、长生成、冷缓存和健康容量变化。

优先证据：

- 同时看原始请求率与尝试率。
- 观察队列斜率、未缓存 Token/s 和可服务实例。

关联处置：F01、F02、F03、F04、F15、F22

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S29: Dynamo v1.6.1 · Request Rejection](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-rejection)

### 04 Prefill

处理尚未复用的输入计算。与 Decode 分开分析 TTFT 和生成速度，才能扩对资源。

状态：输入 Token、计算批次、已产生的 KV 中间状态。

耦合风险：缓存失效、长输入和状态传输排队，都会表现为首字延迟；不能直接据此认定算力饱和。

优先证据：

- 拆入口、排队、Prefill、交接四段耗时。
- 按输入长度和冷热缓存分别比较。

关联处置：F02、F04、F06、F13

[S03: V3/R1 Inference System Overview](https://github.com/deepseek-ai/open-infra-index/blob/3122a25220273cb0806f591e52c4171bd869d8ad/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 05 状态交接

把生成所需计算状态交给 Decode。阶段解耦新增了独立网络、元数据兼容和双边回收问题。

状态：KV 布局、源/目标、传输 epoch、握手与超时。

耦合风险：源端算完、目标端空等，双方仍可能占着状态；GPU 利用率下降不等于没有瓶颈。

优先证据：

- 找 Prefill 完成到 Decode 首步的时间缺口。
- 按源/目标对关联传输失败与 NIC 指标。

关联处置：F06、F09、F14

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 06 Decode

为在途序列逐步生成输出。目标是合格的完整回答吞吐，同时约束输出停顿和状态容量。

状态：当前生成位置、活动序列、输出/思考预算与 KV。

耦合风险：大批次、长生成、慢 rank 和通信等待都会放大尾延迟；吞吐高不一定交互体验好。

优先证据：

- 区分引擎 Token 延迟与客户端 chunk 间隔。
- 按生成长度、在途数和最慢 rank 看尾延迟。

关联处置：F03、F05、F07、F11、F17

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/) · [S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/)

### 07 缓存与 3FS

当前披露区分持久 Block 与主机内存 SWA；SWA 缺失可有限回放恢复，不能一概算作整段上下文重算。缓存不是答案或会话恢复保证。

状态：前缀、命名空间、版本、引用与淘汰、KV 位置。

耦合风险：当前 Prefill 可读取任意前缀，不采用前缀亲和路由。其他参考系统的亲和热点不应套作 DeepSeek 事实。隔离与版本正确性优先于命中率。

优先证据：

- 先辨丢失哪层缓存，再估重算范围；同时看 miss Token/s。
- 区分存储、索引、前缀与版本问题。

关联处置：F04、F05、F22、F25

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S08: 3FS · Fire-Flyer File System](https://github.com/deepseek-ai/3FS) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing)

### 08 MoE / 专家并行

Token 分配到专家计算，再组合结果。DeepEP 提供通信，EPLB 通过副本及放置均衡专家工作。

状态：专家位置、Token 分布、每 rank 通信和计算进度。

耦合风险：实例同步受最慢成员影响；专家热点、物理慢卡和请求级缓存热点应分别诊断。

优先证据：

- 每专家/rank 的工作量及 max/median step time。
- 热点跟着内容走，还是始终跟着物理卡？

关联处置：F07、F08、F09

[S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S05: EPLB · Expert Parallelism Load Balancer](https://github.com/deepseek-ai/EPLB)

### 09 GPU / 完整实例

健康单元必须能组成完整可服务实例。官方披露的大 EP 实例内，单 GPU 故障可能令整个实例不可用。

状态：权重、通信组、内核/驱动版本、预热和就绪。

耦合风险：重启分钟级意味着热备用比“可申请几张卡”更关键；进程存活不能代表推理有进展。

优先证据：

- 实例级短生成探针与每 rank 进度。
- 硬件/通信事件、版本和冷启动阶段耗时。

关联处置：F07、F09、F13、F21

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S06: FlashMLA · Attention kernels](https://github.com/deepseek-ai/FlashMLA) · [S07: DeepGEMM · FP8 / grouped GEMM](https://github.com/deepseek-ai/DeepGEMM) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html)

### 10 Engram / 主机资源

GPU 路径涉及主机内存与 RDMA 查表；文档中的 NPU 路径则将数据保留在设备内存。硬件适用范围必须区分。

状态：表版本、主机内存、NIC、远程查询与局部性。

耦合风险：GPU 路径的 CPU/RDMA 查表变慢可能造成空等；此故障是机制推演，非已公开事故。

优先证据：

- 查表/传输时间与 GPU kernel 时间分离。
- 按主机、NUMA、NIC 和版本定位。

关联处置：F10、F09

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html)

### E 视觉编码分支

图片请求经过独立 Vision Encoder，纯文本请求不走此分支。多模态输入可能在这里形成独立资源瓶颈。

状态：图片 patch 工作量、编码队列与 embedding。

耦合风险：图片大小与 patch 数增加会使请求变重；只看文本 Token 或 P/D GPU 可能漏诊。

优先证据：

- 同文本换成纯文本/小图的受控对照。
- 分离图片读取/解码、VE 排队/计算、embedding 交付。

关联处置：F27

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

### SO 结构化输出编译

部署问答披露独立机器承担 structured-output 编译。只对相应结构化请求生效，不能把所有 JSON 失败归此处。

状态：schema/约束、编译结果、版本与编译队列。

耦合风险：复杂新 schema、编译依赖或解析不兼容可造成首输出慢和任务失败；具体恢复步骤属于推演。

优先证据：

- 普通文本与固定 schema / 新 schema 对照。
- 检查编译耗时、成功率与约束/模型兼容版本。

关联处置：F28、F18

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/)

### 11 控制与发布

维护端点、部署和容量变化；具体控制面产品未公开。请求、发现、事件应作为不同故障面分析。

状态：实例 epoch、就绪/排空、兼容版本清单和路由视图。

耦合风险：陈旧视图会向坏目标发流；缩容若先杀后摘流，会主动制造流中断。

优先证据：

- 实际实例状态与调度视图是否一致。
- 发布、SIGTERM、就绪、流终止对齐时间轴。

关联处置：F13、F14、F21、F22、F26

[S01: DeepInfer · 公开范围与推理核心](https://github.com/deepseek-ai/DeepInfer) · [S27: Dynamo v1.6.1 · Graceful Shutdown](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown) · [S32: Dynamo · Architecture](https://docs.nvidia.com/dynamo/knowledge-base/concepts/architecture)

## 优化与可靠性取舍

### Prefill / Decode 分离

收益：两阶段独立调度和容量规划。

代价：新增 KV 交接、预留资源及双边超时清理。

保障：交接独立 span；源目标兼容清单；在途状态回收。参见 F06。

[S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670) · [S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation)

### 前缀与分级缓存

收益：减少重复输入计算。

代价：冷态重算、存储/索引依赖、热点和隔离风险。

保障：冷缓存容量、受控预热、局部性与负载联合路由。参见 F04。

[S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing) · [S08: 3FS · Fire-Flyer File System](https://github.com/deepseek-ai/3FS)

### 大规模专家并行

收益：分布式专家计算与高效资源使用。

代价：同步慢成员约束；完整实例故障域扩大。

保障：整实例冗余；每 rank 进度、网络与专家负载。参见 F07。

[S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S05: EPLB · Expert Parallelism Load Balancer](https://github.com/deepseek-ai/EPLB) · [S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

### 大批量 / 高资源利用率

收益：提高吞吐、摊薄成本。

代价：尾延迟与状态容量余量可能变差。

保障：用满足双延迟目标的 goodput 规划容量。参见 F03。

[S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 投机 / MTP

收益：被接受时减少有效生成的等待。

代价：低接受率下验证与草稿工作浪费。

保障：按有效输出、接受率、延迟与质量联合验收。参见 F11。

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

### 弹性与滚动发布

收益：容量随需求调整、持续升级。

代价：冷启动、陈旧路由、排空与兼容性问题。

保障：热备用、代表性就绪探针、兼容单元回退。参见 F14。

[S27: Dynamo v1.6.1 · Graceful Shutdown](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration) · [S06: FlashMLA · Attention kernels](https://github.com/deepseek-ai/FlashMLA)

## 28 份故障处置剧本

以下操作须由具备对应权限的平台人员按最小作用域执行，且有回退条件。调用方主要控制自身并发、deadline、重试、parser、任务校验和业务幂等。先止损/再恢复是行动顺序，不是承诺固定分钟恢复。

### F01 连接保活，迟迟没有真正输出

活跃连接、HTTP 200 或 SSE comment 都不能证明模型开始推理。

作用域：请求 / 池。协作：入口 + 调度。

#### 症状

- 首字节正常，首模型 Token 超时
- 排队工作量增长或长输入集中
- 小探针与真实长请求表现不同

#### 候选机制

- 可能在等待资源，也可能卡在编码、Prefill、状态交接或代理缓冲；正常思考先于答案也是另一分支。
- 公开契约允许等待期间返回保活；不能把每条保活都作为业务 deadline 的重置依据。

#### 判别与证伪

- 若首字节快、首有效事件慢：检查真实事件类型及代理缓冲，排除客户端只丢弃了内容。
- 若等待与未缓存 Token 同升：转查 F02/F04；若 Prefill 已完成，则转查 F06。
- 记录 headers、首非注释事件、首模型 Token、首答案、终态五个时间点；不要记录敏感原文。

#### 先止损

- 设置独立排队/首模型 Token 期限和总期限，降低高成本新增工作。
- 超时后取消原请求；尚无可见输出/外部动作且总预算允许时，才考虑一次受控重试。

#### 再恢复

- 先定位失衡阶段，再恢复对应池或路由；只向已验证有余量的备用池移流。
- 分批释放积压。若队列斜率仍为正，停止继续加流，保留拒绝和降级边界。

#### 恢复验收

- 同长度、同缓存组的首模型 Token P95/P99 回落。
- 真实请求有合法终态，取消后不再留下计算。

#### 提前预防

- 建立真实进度 SLI；keepalive 只服务连接保活。
- 流式代理关闭不必要缓冲，贯穿传递 deadline。

**不要这样做：** 无限等待、每次保活重置业务超时、未取消就并发重试。

机制依据（剧本为工程推演）：[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### F02 首字很慢，开始以后输出正常

先定位入口编码、排队、输入计算、交接四段，避免扩错资源池。

作用域：Prefill / 编码池。协作：推理 + 调度。

#### 症状

- TTFT 上升，进入 Decode 后 ITL 接近基线
- 未缓存输入 Token/s 或输入长尾上升
- 也可能 CPU 饱和而 GPU 未忙

#### 候选机制

- 长输入、冷缓存和 Prefill 健康容量减少都会提高输入侧负载。
- 入口 Tokenizer/模板处理慢可产生相同表象；GPU 平均利用率不足以区分。

#### 判别与证伪

- 对同输入长度、同冷热缓存、同版本组比较分段耗时。
- Prefill kernel 正常、入口 CPU 排队高：处理编码池；Prefill 批次耗时或等待高：处理计算池。
- 检查模板发布和 miss Token/s 的先后关系，不只看请求 QPS。

#### 先止损

- 限制新增长输入、低优先级批量重算；保护短交互任务。
- 若与前缀模板变更相关，回退可证实的异常改动，暂停全量预热。

#### 再恢复

- 扩/恢复已定位的编码或 Prefill 资源；调参只采用经过回放验证的配置。
- 若用分块输入改变批预算，同时观察 Decode 长尾；出现新回归立即回退。

#### 恢复验收

- 同一回放集合的输入阶段 P99 达标。
- Decode 停顿和任务质量未因优化而恶化。

#### 提前预防

- 按输入长度、缓存状态独立容量评估。
- 批处理与交互工作量分级准入，输出与输入池分别扩缩容。

**不要这样做：** 只加 Decode、直接拉高总并发、把 CPU 编码瓶颈当作 GPU 算力不足。

机制依据（剧本为工程推演）：[S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670) · [S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/) · [S03: V3/R1 Inference System Overview](https://github.com/deepseek-ai/open-infra-index/blob/3122a25220273cb0806f591e52c4171bd869d8ad/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md)

### F03 首字正常，越生成越卡

需要把引擎生成停顿、专家/通信等待和代理分块缓冲区分开。

作用域：Decode / 实例。协作：推理引擎。

#### 症状

- ITL / 最长可见停顿上升
- 活动序列与输出长度分布变重
- 首 Token 可能仍然正常

#### 候选机制

- 长生成、更多思考 Token、批次增大和 KV 压力会提高输出侧压力。
- 混部输入计算、慢 rank 或网络缓冲也能表现为输出卡顿。

#### 判别与证伪

- 比较固定生成长度后的引擎 step time 与客户端 chunk gap。
- 引擎稳定而用户侧成批输出：检查代理/SDK；引擎变慢：查 KV、通信、专家及活动序列。
- 区分首模型 Token 与首答案内容，避免把合理思考间隔直接当故障。

#### 先止损

- 收紧新增长生成准入，保护已在途任务。
- 如产品有明确契约，可显式限制输出/思考预算；不要静默截断仍声称完整成功。

#### 再恢复

- 恢复/增加完整 Decode 实例，分批移流并监测最慢 rank。
- 回到验证过的活动序列和批量预算；仅在已测试方案内调整阶段隔离。

#### 恢复验收

- 真实用户最长停顿与引擎 ITL 同时恢复。
- 完整任务 goodput、输出完整性和长任务公平性均达标。

#### 提前预防

- 用活动序列、生成长度和 KV 三者评审容量。
- 将生成预算与模型默认行为变化纳入发布门禁。

**不要这样做：** 只看平均 GPU 利用率，用偷偷缩短答案掩盖容量不足。

机制依据（剧本为工程推演）：[S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/) · [S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### F04 缓存命中下降，重算引发第二轮过载

恢复缓存与控制重算必须同时进行；“绕过缓存”不是免费降级。

作用域：缓存命名空间 / 模型池。协作：缓存 + 调度。

#### 症状

- 命中 Token 下降，miss Token/s 先于 TTFT 上升
- 请求数相近但输入计算需求跳升
- 模板、模型或用户隔离标签刚变化

#### 候选机制

- 相同前缀才能复用；模板首部插入时间戳、版本/隔离键变化、淘汰或存储故障都可能导致失配。
- 先区分持久 Block 丢失与内存 SWA 丢失；当前实现可有限回放恢复 SWA，不应一律估为全量重算。当前 Prefill 不采用前缀亲和，亲和热点只作为参考机制。

#### 判别与证伪

- 按模板/模型/租户比对脱敏前缀指纹和 hit/miss Token。
- 若前缀稳定但读错误高：查存储/索引；若无读错误且发布后变化：优先查命名空间与前缀。
- 看 Token 加权命中及总输入量，不能只看请求命中百分比。

#### 先止损

- 限制重算和预热速率，暂缓低优先级长输入。
- 仅在有冷缓存承载余量、且已验证正确性的情况下绕过坏缓存路径。

#### 再恢复

- 回退意外前缀变化或修复坏存储端点，按版本隔离恢复热集。
- 小批预热并测队列斜率；若重算增长超过预算，停止扩大预热和放流。

#### 恢复验收

- 未缓存工作量下降，短/长输入 TTFT 分组恢复。
- 缓存仍冷时也能在声明的降级流量内稳定完成任务。

#### 提前预防

- 常态保留冷缓存容量模型和演练。
- 缓存正确性、版本隔离和热点负载与命中率一起管理。

**不要这样做：** 全量清缓存、无限重算、强制所有相似请求挤到同一热节点。

机制依据（剧本为工程推演）：[S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S08: 3FS · Fire-Flyer File System](https://github.com/deepseek-ai/3FS)

### F05 KV 容量耗尽，显存未 OOM 却吞吐暴跌

预分配显存看似稳定，逻辑可用 block 仍可能耗尽。

作用域：状态池 / 实例。协作：引擎内存 + 调度。

#### 症状

- 可用 KV 槽低，长序列与等待并存
- 参考引擎中可能出现抢占/重算增长
- GPU 总显存曲线未必出现突增

#### 候选机制

- 状态随输入与生成长度占用，连接数相同并不代表状态需求相同。
- 当前 Q&A 明确其 Decode 部署不受缓存容量约束。本卡适用于参考引擎、自建配置变化及异常泄漏等风险，不暗示是 DeepSeek 当前常态瓶颈；抢占重算也不是其已披露策略。

#### 判别与证伪

- 区分权重加载 OOM、临时张量 OOM 和 KV 逻辑池不足。
- 关联可用状态块、每请求长度、引用/淘汰、等待 Decode 的预留槽。
- 检查取消或交接超时是否未释放状态，转查 F12/F06。

#### 先止损

- 减少新增高状态占用请求，让可完成的在途请求先退出。
- 暂停预热和无用重算，保留通信 buffer 与临时张量余量。

#### 再恢复

- 转移长上下文流量或增加服务副本；按已验证内存配置重建异常实例。
- 修改状态预算前回放长尾输入与生成，不直接提高显存上限；出现 OOM 立即撤回。

#### 恢复验收

- 分配失败/抢占回到基线，状态回收与任务完成吞吐恢复。
- 长请求未被长期饿死，GPU 与状态池均有稳定余量。

#### 提前预防

- 按 Token 状态与最大在途长度准入。
- 验证引用计数、淘汰和异常退出路径；不直接套 MHA 的 KV 字节公式。

**不要这样做：** 把显存使用上限推到近 100%，反复清缓存，把“没有 OOM”当健康。

机制依据（剧本为工程推演）：[S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/) · [S24: PagedAttention · SOSP 2023](https://arxiv.org/abs/2309.06180) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### F06 Prefill 已完成，Decode 卡在状态交接

阶段分离引入独立的交接队列、兼容版本与双边回收问题。

作用域：源/目标配对 / 链路。协作：传输 + 引擎。

#### 症状

- Prefill 完成到 Decode 首步的缺口扩大
- 目标保留槽位却没有生成，源状态迟迟未释放
- 错误集中在某些源/目标组合

#### 候选机制

- 可能是网络带宽/错误、握手元数据不兼容、坏端点或传输超时清理失效。
- 继续增加 Decode 预留不会修复传输，反而可能消耗更多状态空间。

#### 判别与证伪

- 给交接单独建 span，拆握手、传输、目标确认与源端释放。
- 比对 KV bytes、吞吐、NIC 错误和布局/引擎版本。
- 固定源换目标、固定目标换源，缩小到端点或链路，保留现场。

#### 先止损

- 停止向确认坏的配对派发新任务，限制跨域迁移。
- 按受支持流程清理超时握手的双方状态，不重用旧 epoch。

#### 再恢复

- 恢复坏端点/链路或回滚不兼容组件，再以小流量验证源目标组合。
- 只有预置并压测过的替代传输/聚合方案才可切换，负载超预算立即撤回。

#### 恢复验收

- 交接成功率和尾延迟恢复，源/目标状态能成对释放。
- 输出内容及多轮状态正确，不只是传输测速通过。

#### 提前预防

- 传输独立 SLI、布局兼容清单和拓扑感知放置。
- 测试传输中取消、源故障和目标故障。

**不要这样做：** 随手禁用 RDMA 让全量走 TCP，跨模型版本盲迁 KV，只扩 Decode。

机制依据（剧本为工程推演）：[S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html)

### F07 一张 GPU 故障，整个实例停止推进

恢复与备用容量应按完整可服务实例设计，而不是按空闲卡数。

作用域：完整并行实例。协作：GPU 平台 + 引擎。

#### 症状

- 同实例多个请求同时停顿或失败
- 一个 rank 出错，其他成员等待同一通信步骤
- 进程存活，但端到端推理探针无进度

#### 候选机制

- 官方披露的大 EP 实例中，单 GPU 故障可能使整个实例不可用。
- 硬件故障、慢卡、链路和通信组错误表象相近；需要关联同故障域的进度与硬件事件。

#### 判别与证伪

- 按实例/通信域聚合停顿请求，关联每 rank 最后进展时间。
- 检查硬件/RAS、驱动与 NIC 错误；若无硬错误，验证慢 rank 与网络拥塞。
- 保留关键诊断后确认可用的完整备用实例，不能只统计 Pending Pod 或空闲 GPU。

#### 先止损

- 完整摘除不健康实例，停止新请求，保留健康池余量。
- 仅对尚无可见输出/副作用的工作按总重试预算重路由；部分生成显式标为中断。

#### 再恢复

- 隔离坏卡或节点，按一致配置重建完整通信组，加载与预热。
- 通过代表性推理探针后逐级放量；旧 epoch 仍被选中或进度再次停顿时立即摘除。

#### 恢复验收

- 新流量不再路由旧组，长短输入及完整生成 canary 均通过。
- 健康池 N-1 容量、尾延迟、无重复输出和状态清理同时满足要求。

#### 提前预防

- 整实例热备用、进度探针、RAS 基线及单 rank 故障演练。
- 将共同网络/机架故障纳入 N-k，按实测恢复时间设计限流。

**不要这样做：** 只重启一个 rank、卡死实例反复重新就绪、重启全部健康池。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html) · [S31: Dynamo · Fault Tolerance Testing](https://docs.nvidia.com/dynamo/latest/knowledge-base/concepts/fault-tolerance/fault-tolerance-testing)

### F08 专家热点或慢 rank，平均利用率掩盖尾延迟

先区分专家工作量不均、请求缓存亲和和物理慢卡，再决定均衡动作。

作用域：专家 / rank / 实例。协作：MoE 调度。

#### 症状

- max rank step time 明显高于 median
- 部分专家 Token 分布偏斜
- 整体 GPU 平均利用率仍不高

#### 候选机制

- MoE 内容分布改变会改变专家工作量；同步步骤受最慢成员约束。
- EPLB 通过热点专家副本及放置均衡工作，但均衡移动也有成本，不等于容灾接管。

#### 判别与证伪

- 联合看每专家 Token、每 rank 计算、通信等待和 NIC。
- 热点随内容移动：查专家分布；始终固定某卡：查硬件/主机；只热在请求端：查缓存路由。
- 比较变更前后流量分布，避免用均匀合成流量证明生产均衡。

#### 先止损

- 限制导致突发的异常工作，避开已确认物理变慢的实例。
- 暂停未经验证的放置调整，保留可回退配置。

#### 再恢复

- 通过受支持的副本/映射机制回到已验证放置，或受控重新均衡。
- 分步观察通信开销与 P99，若负载更均匀但延迟更差则回退。

#### 恢复验收

- max/median rank 步时与任务尾延迟同时改善。
- 迁移期间无错误结果或无进度请求。

#### 提前预防

- 生产分布回放、每 rank 分位监控、均衡移动预算。
- 把请求级路由和专家级路由拆开评审。

**不要这样做：** 只靠 GPU 平均值扩缩容，未经支持在线重排专家，把专家副本当服务备用。

机制依据（剧本为工程推演）：[S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S05: EPLB · Expert Parallelism Load Balancer](https://github.com/deepseek-ai/EPLB) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing)

### F09 RDMA / all-to-all 长尾拖慢整个同步组

吞吐测速正常，不代表推理小批低延迟或同步通信尾延迟正常。

作用域：链路 / NIC / 拓扑域。协作：网络 + GPU 平台。

#### 症状

- 通信时间升高而纯计算时间接近基线
- 同机架/链路相关的 rank 慢
- 网络拥塞、重传或 NIC 错误相关

#### 候选机制

- 状态交接、专家 dispatch/combine、远程查表可能共享网络资源。
- 坏链路、竞争流量、网卡选择和拓扑放置均可能使少数成员拖慢整个组。

#### 判别与证伪

- 分别测专家通信、KV 交接和主机查表，不能统称网络慢。
- 按物理路径关联端口/NIC 计数和每 rank 步时；比较小批低延迟与大流吞吐。
- 通信框架差异需尊重：NCCL 诊断方法是参考，不等同 DeepEP 实现。

#### 先止损

- 停止向确认坏路径和实例派发，降低竞争工作量。
- 保留健康域；避免同时迁移大量 KV 把网络进一步压满。

#### 再恢复

- 修复或隔离坏 NIC/链路，恢复已验证的拓扑与通信配置。
- 逐级回放真实通信模式；错误或 P99 回升即退回已知健康域。

#### 恢复验收

- 各通信路径尾延迟恢复，同步组无新停顿。
- 端到端 TTFT/ITL 达标，非仅带宽测试通过。

#### 提前预防

- 按通信模式做持续基准，监测最慢路径。
- 共享网络资源做容量和故障隔离评审。

**不要这样做：** 未经验证全量换 TCP、随手修改集群级通信参数、用平均带宽排除网络故障。

机制依据（剧本为工程推演）：[S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html) · [S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation)

### F10 GPU 不满载，瓶颈在主机内存或远程查表

当前部署披露将部分主机/RDMA 访问带入关键路径，GPU 空闲不能排除资源瓶颈。

作用域：主机 / RDMA 后端。协作：主机资源 + 推理。

#### 症状

- GPU kernel 时间稳定，等待段上升
- 某些主机/NIC 相关的请求更慢
- CPU 内存、NUMA 或查表延迟异常

#### 候选机制

- 适用 GPU 部署路径：基于主机承载与远程访问，可推演主机资源争用、局部性或版本风险。官方 NPU 路径将 Engram 数据保留在设备内存，不能套用 CPU offload 诊断。
- 这不是 DeepSeek 已公开事故，也不意味着任何 CPU 峰值都来自 Engram。

#### 判别与证伪

- 分离 Tokenizer、远程查表、通信和 GPU kernel 的时间。
- 按主机、NUMA、NIC、表版本比对健康样本。
- 若查表稳定，则回到 F08/F09，避免只因 GPU 不满就盲加 CPU。

#### 先止损

- 隔离已确认异常后端或实例，控制新工作量。
- 停止相关主机/表版本扩流，保留健康副本。

#### 再恢复

- 恢复已验证的主机/NIC/内存与兼容版本，做目标形状的端到端预热。
- 逐级切回；若表访问正确性或延迟未达标，不放流。

#### 恢复验收

- 查询正确且尾延迟回基线，GPU 等待随之减少。
- 代表性任务质量和完成时长达标。

#### 提前预防

- 主机内存和 NIC 与 GPU 一起容量评估。
- 表/模型/后端兼容清单，监控局部性和远程访问尾延迟。

**不要这样做：** 只加 GPU、用 CPU 平均占用代替查表链路证据。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html)

### F11 投机生成接受率下降，算得多却产出少

优化应按最终有效输出工作量验收，不能按草稿 Token 数验收。

作用域：生成配置 / 工作负载。协作：推理优化。

#### 症状

- 草稿/预测工作增长，有效产出未同步增长
- 每个最终输出 Token 的耗时增加
- 问题与内容、采样或模型配置相关

#### 候选机制

- 投机预测需要验证，未被接受的草稿不等于用户有效输出。
- 官方披露自适应策略：结合接受率预测与硬件吞吐曲线选取草稿前缀。完整生产实现和具体部署参数未全部开源，调用方不能假设可直接调节。

#### 判别与证伪

- 区分草稿数、接受数、验证成本和最终输出数。
- 同一任务集合比较接受率与端到端 goodput，排除网络和专家热点。
- 检查采样参数、内容分布或版本改变是否先于下降。

#### 先止损

- 停止继续扩大实验参数，限制异常工作量。
- 有受支持且已测试配置时，降低投机深度或回到稳定配置。

#### 再恢复

- 在代表性短/长生成样本上对照调参，按任务完成/延迟/成本选择。
- 如无可控接口，不假设调用方可远程修改内部投机机制。

#### 恢复验收

- 有效输出吞吐改善且尾延迟、质量不回归。
- 不同任务组没有被整体均值掩盖的恶化。

#### 提前预防

- 按工作负载跟踪接受率与总成本。
- 优化发布设置 goodput 和质量门禁。

**不要这样做：** 把草稿 Token/s 当服务吞吐，未测试就关闭或调大投机深度。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### F12 用户已离开，后台仍在生成

取消必须到达引擎并完成状态回收；cancel_received 只是中间事件。

作用域：请求及子请求。协作：入口 + 引擎。

#### 症状

- 入口连接数下降，后端在途数不降
- 取消后仍产出 Token，KV 不释放
- 重试导致新旧请求同时计算

#### 候选机制

- 断开未检测、上下文未传播、子请求未关联，或引擎收到取消但未中止。
- 跨阶段还可能只取消入口，不释放传输源和目标的预留状态。

#### 判别与证伪

- 用 request_id 串联 disconnect、cancel_received、engine_abort、KV_free。
- 分别在排队、Prefill、交接、Decode 阶段取消，确认哪一段缺失。
- 检查正常长请求，避免把它们误作孤儿终止。

#### 先止损

- 限制新增长生成，停止超时后的无预算重试。
- 按引擎支持方式终止已确认的孤儿工作，避免破坏共享状态。

#### 再恢复

- 回退取消传播回归，修复子请求关联和双边清理。
- 必要时先摘流排空单实例再重建；不能全池粗暴清理。

#### 恢复验收

- 取消后不再持续生成，状态/在途数按目标期限回基线。
- 各阶段取消测试通过，正常请求不受误杀。

#### 提前预防

- 取消到实际停止和回收分别设 SLI。
- deadline/取消贯穿传播，持续测试客户端提前断开。

**不要这样做：** 把取消计数当回收证明，入口超时就立即重试，终止所有“长请求”。

机制依据（剧本为工程推演）：[S28: Dynamo v1.6.1 · Cancellation Architecture](https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture) · [S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation)

### F13 扩容来不及，新实例就绪却无法承接

有进程、有 Pod、有 GPU，都不等于已有可承接工作量的完整实例。

作用域：容量池 / 启动流程。协作：平台发布 + 推理。

#### 症状

- 实例数量增加，完成吞吐不增长
- 权重加载、编译或预热持续耗时
- 新实例首批请求高延迟/失败

#### 候选机制

- 权重、通信组、内核/JIT、图与缓存都可能需要准备。
- 官方披露的分钟级重启约束，意味着扩容无法替代所有瞬时故障的热备用。

#### 判别与证伪

- 拆资源分配、权重、通信初始化、编译、预热、发现传播时间。
- readiness 是否真的跑过代表性模型请求，还是仅 HTTP 进程可访问？
- 区分单个新版本兼容问题与资源池整体拉起速度问题。

#### 先止损

- 暂停过快放量，恢复完整热备用承载。
- 保持有界队列，显式拒绝超预算工作，避免用无限排队等待扩容。

#### 再恢复

- 修复启动瓶颈或回滚坏镜像/内核组合，预热后逐批加入。
- 真实多长度探针通过才就绪；首次工作长尾恶化即停止扩流。

#### 恢复验收

- 容量按真实 goodput 增长，新旧实例质量一致。
- 完整恢复时间含申请到可服务，不只统计容器启动。

#### 提前预防

- 保留整实例热备用；预构建兼容内核和代表性形状。
- 按冷启动时间提前触发扩容，独立扩 P/D 而非一刀切。

**不要这样做：** 把 Pending/Running 计入可用容量，过早就绪，指望分钟级启动解决秒级突发。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S06: FlashMLA · Attention kernels](https://github.com/deepseek-ai/FlashMLA) · [S07: DeepGEMM · FP8 / grouped GEMM](https://github.com/deepseek-ai/DeepGEMM) · [S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/)

### F14 发布或缩容时，长流反复被切断

摘流、传播、排空、迁移、退出需要有序进行；优雅迁移不等于任意故障续写。

作用域：发布批次 / 版本。协作：发布平台 + 引擎。

#### 症状

- 流中断与发布/SIGKILL 时间高度相关
- 新旧版本或状态布局混用
- 长生成比短探针更容易失败

#### 候选机制

- 终止宽限期不足、发现摘流未传播、不可迁移的状态或新实例尚未预热。
- 参考 Dynamo 的迁移默认关闭且有结构化解码等限制；不能泛化成 DeepSeek 的恢复保证。

#### 判别与证伪

- 对齐版本、摘流、最后新请求、在途数、退出信号和终止事件。
- 检查最长任务、工具轮次、结构化输出能否按声明完成或明确中断。
- 只在模型、Tokenizer、状态布局及解码状态均兼容时讨论迁移。

#### 先止损

- 暂停发布和缩容，保留旧版本健康容量。
- 停止向待退出或确认回归的实例发新请求，先保护已有流。

#### 再恢复

- 按兼容发布单元回滚；先摘流确认传播，再等待完成或执行受支持迁移。
- 排空期限外的任务显式取消/标部分结果，最后退出；新实例预热后小批放量。

#### 恢复验收

- 长生成、工具、结构化任务也无新增无声断流。
- 旧 epoch 不再接请求，状态正确清理，新版本冷流量达标。

#### 提前预防

- 模型/Tokenizer/模板/解析器/内核绑定版本。
- 平台强杀期限包含内部排空和传播预算；每版实际演练。

**不要这样做：** 先杀再摘流、假设所有请求都能迁移、把不同版本答案无声拼接。

机制依据（剧本为工程推演）：[S27: Dynamo v1.6.1 · Graceful Shutdown](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration) · [S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe)

### F15 429 激增，但不一定是全平台容量故障

先判明限额作用域，减少正确层级的并发与重试。

作用域：账户 / 用户 / 模型。协作：配额 + 调用方。

#### 症状

- 一个账户/用户明显高于其他组
- 在途数增长，但原始请求率未必增长
- 错误体可能揭示不同限制作用域

#### 候选机制

- 并发受请求持续时间影响；生成变长即可触及原来足够的额度。
- 官方区分账户并发及用户隔离，额度不能直接转换为固定 QPS。

#### 判别与证伪

- 核对错误体、模型、账户、稳定真实 user_id 与限制快照日期。
- 比较原始请求与尝试数，核算并发和持续时间。
- 若健康容量同时减少且各租户受影响，再转查 F16/F07。

#### 先止损

- 停止立即重试，按受影响作用域降低并发。
- 使用公平有界队列，重试仅一层且有总期限/抖动预算。

#### 再恢复

- 在真实容量支持下重新分配租户预算，逐级放回任务。
- 若限额有误，走授权配额流程；不以新增身份绕过限制。

#### 恢复验收

- 独立业务请求完成率和延迟恢复。
- 429 下降不是因为静默丢弃请求或无限排队。

#### 提前预防

- 客户端自适应并发及稳定租户标识。
- 按长尾时长规划额度，预算重试与批任务。

**不要这样做：** 换 key/user_id 规避限制、把每个 429 都判成系统过载、全量放开限额。

机制依据（剧本为工程推演）：[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S12: Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### F16 500 / 503 与重试形成过载正反馈

先阻断负载放大，再找健康容量；扩容不是第一步的唯一选项。

作用域：模型池 / 实例 / 网络路径。协作：值班协调 + 容量。

#### 症状

- 尝试率快于原始业务率增长
- 完成吞吐平台化、队列持续增长
- 超时、错误与健康实例下降相关

#### 候选机制

- 过载、实例故障、DNS/TLS/代理或 SDK 期限都可产生相近结果。
- SDK、网关、应用多层重试会相乘；局部故障可把健康池拖进第二轮过载。

#### 判别与证伪

- 区分发生阶段、HTTP 错误体与网络错误。
- 按模型/实例/租户/网络路径缩小范围，查原始请求、尝试率、就绪容量和工作量。
- 关联官方状态只证明影响同时发生，不能据此确认技术根因。

#### 先止损

- 冻结相关变更，限制低优先级高成本工作和长队列。
- 收敛到一层共享重试预算；对受影响范围熔断，保护健康域。

#### 再恢复

- 恢复完整实例或对应资源池；仅对有余量且任务兼容的备用目标移新流量。
- 分批消化积压，队列增长/错误回升即停；不要把坏流量一口气倒给备用池。

#### 恢复验收

- 原始任务完成率、TTFT/ITL、队列斜率一起恢复。
- 拒绝/超时不被口径隐藏，未产生重复工具动作。

#### 提前预防

- 基于多资源的准入、端到端 deadline 和重试 token budget。
- 按真实长尾流量做过载/N-k/冷缓存联合测试。

**不要这样做：** 无限重试、无限队列、同步全量双发、在无余量时全切备用池。

机制依据（剧本为工程推演）：[S12: Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S29: Dynamo v1.6.1 · Request Rejection](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-rejection)

### F17 已经输出一半，突然停顿或 EOF

再生成是一个新的候选回答；没有公开保证可让任意流无损续接。

作用域：在途流 / 代理路径。协作：流式服务 + 引擎。

#### 症状

- 答案已可见，却缺少协议终态
- 停顿集中在某代理超时或实例
- 可能没有最后 usage 事件

#### 候选机制

- 实例/通信失败、代理空闲期限、客户端退出、解析器错误或长思考阶段。
- HTTP headers 已发送后，内部失败未必还能用 5xx 反映。

#### 判别与证伪

- 保留最后事件类型/时间、关闭原因、finish_reason 与代理日志。
- 引擎仍有进度而客户端无事件：查缓冲/网络；引擎也停止：查实例/通信。
- 核对 endpoint 的合法终态，usage 未到不能单独证明任务失败。

#### 先止损

- 标记部分结果，停止执行未完整拼装的工具参数。
- 尽力取消原请求；按产品约定提供明确的重新生成，保留原答案身份。

#### 再恢复

- 修复所定位的代理/解析/实例问题；只为新请求切健康路径。
- 如有经验证的迁移机制，按能力边界使用，不能跨版本拼接。

#### 恢复验收

- 完整终态、内容和工具链通过；原计算不再占用资源。
- 真实长流跨过旧超时边界仍正常完成。

#### 提前预防

- 输出进度与连接期限对齐，定义部分结果契约。
- 测试断网、实例退出、长时间无内容和 usage 丢失。

**不要这样做：** 把任意 EOF 算成功，无声拼接重生成，按每个 delta 执行工具。

机制依据（剧本为工程推演）：[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration) · [S27: Dynamo v1.6.1 · Graceful Shutdown](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown)

### F18 HTTP 200 很健康，用户任务却失败

终态、结构与任务验收是独立门槛，不能由 HTTP 状态或 stop 代替。

作用域：任务类型 / 终态。协作：API 契约 + 业务。

#### 症状

- 截断、空结果、无效 JSON 或工具循环未完成
- 资源不足/aborted 等终态升高
- 200 成功率未反映投诉

#### 候选机制

- length 是预算耗尽，tool_calls 是交接，资源不足/中止是异常结果，过滤是策略终止。
- 官方还提示 JSON 模式可能只输出空格却以 stop 结束。

#### 判别与证伪

- 统计 finish_reason、长度预算、非空内容、schema 与工具循环完成率。
- 按任务类型定义哪些终态可接受；过滤与系统资源故障分开计数。
- 比较原始事件和 Recipe/SDK 解析结果，排除适配层丢字段。

#### 先止损

- 先分类：资源异常按容量处理；预算耗尽显式提示/调整；工具交接继续合法流程。
- 对无效结构仅受控再生成；有外部副作用的动作先停并核对状态。

#### 再恢复

- 修复确定的解析、预算或实例问题，回放受影响任务集。
- 若要求 JSON/schema，完整接收后验证；多次失败转显式失败或人工流程。

#### 恢复验收

- 传输完整、协议合法、结果满足任务契约三组指标分别达标。
- 不通过缩短答案、丢弃难任务美化成功率。

#### 提前预防

- 每种任务有终态与 schema 规则；独立维护业务质量目标。
- 真实协议金丝雀覆盖空格、截断、资源失败和工具交接。

**不要这样做：** 只要 200/stop 就算成功，把所有幻觉归为平台宕机，过滤失败盲重试。

机制依据（剧本为工程推演）：[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### F19 工具轮次 400，或业务动作被执行两次

模型输出恢复与外部业务状态恢复要分开处理。

作用域：编排会话 / 外部事务。协作：调用方编排 + 业务动作。

#### 症状

- 第一轮正常，工具返回后下一轮失败
- 工具参数碎片未结束就执行
- 订单/消息等动作重复，外部响应曾超时

#### 候选机制

- 消息角色/工具 ID 不匹配，思考工具轮次缺少所需 reasoning_content，或动作提交后响应丢失。
- 工具由客户端执行；模型 tool_call_id 不是业务恰好一次保证。

#### 判别与证伪

- 检查脱敏 role/tool_call_id 序列及字段是否存在，不抄录思考原文。
- 用业务事务 ID 查询外部动作是否提交；先消除状态不确定性。
- 区分规划重试、工具调用重试、外部提交重试三层。

#### 先止损

- 停止盲目重放，冻结不确定动作的自动执行。
- 查外部账本/订单/动作状态；未完整拼装并校验的参数不执行。

#### 再恢复

- 修复合法历史消息，保留已完成工具结果，继续会话。
- 业务动作采用稳定业务 ID 和外部幂等机制；无法确认时走补偿/人工核对，不再赌一次。

#### 恢复验收

- 每个预定业务动作按稳定动作 ID 至多提交一次；应执行动作已完成或进入明确补偿/人工状态，会话能继续。
- 超时重试测试不会产生重复动作或状态丢失。

#### 提前预防

- 持久编排/动作状态机，幂等放在业务提交边界。
- 工具协议与流式分片金丝雀，明确“未知”动作状态。

**不要这样做：** 重新跑模型就重新执行动作，把 tool_call_id 当业务唯一提交保证。

机制依据（剧本为工程推演）：[S15: Thinking Mode · 多轮工具协议](https://api-docs.deepseek.com/guides/thinking_mode/) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### F20 换到 Responses API 后假挂起或丢上下文

接口名相似不代表终态、会话存储和后台执行语义相同。

作用域：endpoint / SDK 适配器。协作：API 兼容层。

#### 症状

- 服务已结束，客户端仍等待 [DONE]
- 下一轮缺历史，background/store 不生效
- 有些参数未报错却未被执行

#### 候选机制

- 官方说明 Responses 兼容接口无状态，不支持若干存储/后台字段。
- 它以 response.completed / incomplete / failed 结束，不发送 Chat Completions 的 [DONE]。

#### 判别与证伪

- 检查 endpoint、事件类型和终态解析器，直接比较脱敏事件序列。
- 核对客户端是否显式发送必要历史，是否依赖不支持字段。
- 用能力矩阵逐项验收，不仅验证请求能返回 200。

#### 先止损

- 回到正确 parser，停用不支持选项或回滚适配层。
- 显式补齐合法会话状态，不假设后台任务仍运行。

#### 再恢复

- 分端点实现完成/失败/不完整处理，使用协议样例回放。
- 多轮、工具、取消和空内容均通过后再切换真实任务。

#### 恢复验收

- 合法终态及时结束；failed/incomplete 不能报成功。
- 多轮上下文完整，不支持能力被显式暴露。

#### 提前预防

- 按 endpoint 固定契约测试及支持矩阵。
- SDK 迁移门禁包含语义，不只包含 JSON schema。

**不要这样做：** 复用单一 [DONE] parser，把忽略参数当支持持久会话。

机制依据（剧本为工程推演）：[S16: Responses API · 兼容范围](https://api-docs.deepseek.com/guides/responses_api/) · [S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe)

### F21 模型别名或内核更新后，质量/协议回归

模型、模板、Tokenizer、解析器、量化与内核需要一起验证；API 别名未必不可变。

作用域：版本 / 任务族。协作：模型服务 + 质量。

#### 症状

- HTTP 与延迟正常，schema/工具/任务评测变差
- 回归按硬件/版本或任务类型集中
- 输出预算、成本或答案长度突变

#### 候选机制

- 模型别名更新、提示词变更、解析兼容和数值/内核差异均可能影响结果。
- 内核库存在硬件和软件边界；这只支持风险机制，不证明发生过 DeepSeek 内核事故。

#### 判别与证伪

- 对齐官方更新、请求 alias、可观察模型元数据及自有模板/SDK版本。
- 用固定代表性任务集比较结构、工具、质量、成本和延迟。
- 若仅某 GPU/形状回归，核对兼容组合；若仅解析结果错，优先查 Recipe。

#### 先止损

- 暂停问题版本/能力扩流，对高风险外部动作加校验。
- 停止把质量错误直接重试成更多副作用。

#### 再恢复

- 平台方回滚完整兼容单元；调用方只能选择实际可用且已评测的模型/配置。
- 不能承诺 API 支持旧版本固定；逐级恢复并保留独立质量回退条件。

#### 恢复验收

- 同一任务集的能力、schema、工具和数值基线恢复。
- 技术 SLO 与成本均仍达标，不仅“更快了”。

#### 提前预防

- 别名变更评测、影子验证、硬件/形状兼容矩阵。
- 维护模型/模板/解析器等版本清单与独立回退路径。

**不要这样做：** 承诺不存在的固定版本能力，只凭健康探针完成发布验收。

机制依据（剧本为工程推演）：[S17: API Updates · 模型别名与版本](https://api-docs.deepseek.com/updates/) · [S06: FlashMLA · Attention kernels](https://github.com/deepseek-ai/FlashMLA) · [S07: DeepGEMM · FP8 / grouped GEMM](https://github.com/deepseek-ai/DeepGEMM) · [S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe)

### F22 GPU 健康，路由视图仍指向旧或错误目标

请求、发现、缓存事件不是同一个通信平面，不能用重启 GPU 替代定位。

作用域：发现 / 事件 / 路由视图。协作：控制面 + 路由。

#### 症状

- 已有流部分正常，新请求失败
- 实际实例与调度选中目标不一致
- 预测缓存命中与实际偏离

#### 候选机制

- 参考系统会使用独立发现/事件平面；租约、事件缺口和陈旧视图可影响路由。
- DeepSeek 具体注册中心/消息产品未公开，本剧本只描述需要覆盖的通用机制。

#### 判别与证伪

- 核对路由选择、实例实际就绪与 epoch，确认旧成员是否仍被引用。
- 查事件序号缺口/延迟，分清负载视图和 KV 索引。
- 直接推理探针健康但经路由失败，才支持把范围收敛到控制/路由层。

#### 先止损

- 隔离已确认坏目标，暂停发布/缩容以减少状态变化。
- 保持健康现有流；有经测试方案时进入容量受控的简化路由。

#### 再恢复

- 恢复发现/事件并按受支持流程重建快照，不混用旧身份。
- 确认 fencing/epoch 生效后逐批恢复缓存感知路由。

#### 恢复验收

- 旧 epoch 不再被选中，实际命中与视图一致。
- 新老连接、取消与端点退出均正常。

#### 提前预防

- 租约/epoch/fencing、事件缺口检测和快照重建。
- 发现平面与数据平面独立故障演练。

**不要这样做：** 无证据全池 GPU 重启，新旧实例共用身份同时接流。

机制依据（剧本为工程推演）：[S32: Dynamo · Architecture](https://docs.nvidia.com/dynamo/knowledge-base/concepts/architecture) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration)

### F23 鉴权、余额或请求配置问题被误判为宕机

永久错误先纠正配置，广泛重试只会放大压力并隐藏真实问题。

作用域：key / 配置批次 / payload。协作：账户配置 + 调用方。

#### 症状

- 错误集中于新 key、某部署或 payload
- 最小合法请求与真实请求表现不同
- 与 secret/SDK/参数变更时间一致

#### 候选机制

- 密钥轮换未覆盖、账户余额、模型/参数/长度不合法，或工具历史缺失。
- HTTP 错误码提供分类线索，仍需错误体和作用域定位。

#### 判别与证伪

- 用 key 指纹而非明文对照部署；查看错误体和参数形状。
- 使用已有授权凭据验证最小合法请求，再复现受影响 payload。
- 若只真实请求失败，优先查构造/长度/工具历史，不归咎基础设施。

#### 先止损

- 对永久错误快速失败，关闭无意义重试。
- 暂停相关配置扩散，保留正常 key 和旧配置。

#### 再恢复

- 恢复正确 secret/参数构造或按授权流程处理账户问题。
- 最小请求和真实请求都通过后再恢复批量流量。

#### 恢复验收

- 受影响配置批次错误归零，真实任务完整完成。
- 日志未泄漏 key，旧凭据退出符合既定轮换流程。

#### 提前预防

- 配置预检、轮换重叠窗口、余额提醒和 SDK 契约测试。
- 错误按永久/暂态及账户/系统分开管理。

**不要这样做：** 打印 API key 排查，对 401/402/422 无限重试。

机制依据（剧本为工程推演）：[S12: Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/) · [S15: Thinking Mode · 多轮工具协议](https://api-docs.deepseek.com/guides/thinking_mode/)

### F24 DNS / TLS / 代理故障伪装成模型服务异常

先证实请求到达哪一层；没有 headers 的失败不应直接归因 GPU。

作用域：网络路径 / 代理 / 客户端。协作：接入网络 + SDK。

#### 症状

- 特定网络/代理/SDK 失败，其他路径正常
- 连接或 TLS 耗时升高
- 输出按固定周期成批出现或固定时长断流

#### 候选机制

- 解析、证书、连接池、代理缓冲/空闲期限和客户端读取方式都可制造假慢或中断。
- DeepSeek 内部网关产品未公开；此处是完整 API 服务必须覆盖的接入风险。

#### 判别与证伪

- 拆 DNS、connect、TLS、headers、首有效事件与终态时间。
- 在同一合法请求下对比受影响与已知正常路径；记录脱敏网络错误。
- 如果客户端没有数据而引擎/服务端仍有进展，优先检查代理和解析。

#### 先止损

- 停止故障路径的重试洪峰，使用已验证可用路径。
- 对齐流式空闲期限和业务总期限，避免缓冲吞掉进度事件。

#### 再恢复

- 修复证书/解析/连接池或回滚代理配置；小流量长流验证。
- 禁止通过关闭证书校验等方式换取表面恢复。

#### 恢复验收

- 长流跨旧超时点完整完成，连接与首内容延迟回基线。
- 无连接泄漏，安全校验仍开启。

#### 提前预防

- 独立网络合成探针、SSE 代理测试、证书与连接池容量预警。
- 连接保活与模型进度使用不同指标。

**不要这样做：** 直接重启 GPU，关闭 TLS 校验，用无限 socket timeout 掩盖问题。

机制依据（剧本为工程推演）：[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### F25 租户隔离或缓存命名空间错误

可用性恢复不能通过取消隔离来换取命中率；正确性与租户边界必须先保住。

作用域：租户 / 隔离域。协作：安全 + 缓存 + 配额。

#### 症状

- 隔离标签变更后命中/限制异常
- 某租户影响其他租户调度
- 异常内容或状态复用需要安全核查

#### 候选机制

- 公开契约将 user_id 用于安全、缓存及调度隔离；错误标识会改变隔离作用域。
- 缓存污染/越界是本研究的风险推演，不是已证实 DeepSeek 漏洞。

#### 判别与证伪

- 检查真实稳定用户映射、命名空间、模型和版本键。
- 确认授权域与缓存键一致，不通过收集更多敏感原文来排查。
- 涉及越界迹象先按安全事件隔离与保全受控证据，不能只优化命中。

#### 先止损

- 暂停可疑共享/复用路径并缩小影响域；明确降低可服务流量。
- 保留租户边界，限制冷缓存重算以避免二次过载。

#### 再恢复

- 修正身份与版本命名空间，在隔离环境做跨租户负测试。
- 仅清理确认受影响范围；验证隔离和容量后再逐批恢复复用。

#### 恢复验收

- 跨租户负测试不复用不应共享状态，调度公平性恢复。
- 无数据越界证据且安全流程完成，冷态容量仍受控。

#### 提前预防

- 身份/缓存/调度隔离一致性测试，稳定租户标识。
- 隔离变更与缓存/容量评审联动，最小化日志敏感内容。

**不要这样做：** 随机 user_id 规避限制、为了命中跨租户合并、无证据清全量缓存。

机制依据（剧本为工程推演）：[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing)

### F26 日志、计量或共享依赖反压拖垮数据面

这类内部拓扑未公开，应作为设计审查项，不能声称是 DeepSeek 真实实现。

作用域：共享依赖 / 进程资源。协作：平台依赖 + 可观测。

#### 症状

- GPU 仍健康，入口线程/队列/磁盘或内存异常
- 日志/遥测/共享依赖延迟与请求失败相关
- 采样或发布后指标基数/写入量激增

#### 候选机制

- 若请求关键路径同步等待日志、计量、审计或依赖，就可能传播反压。
- 无限异步队列同样会耗尽进程资源；降级还必须保护安全决策和可核对计量。

#### 判别与证伪

- 从 trace 证实等待点，查线程、队列、磁盘和高基数标签。
- 区分非必要遥测与必须一致的安全/计量状态；不能一概 fail-open。
- 比较停用可选详细日志前后，但保留最小事件和原始工作量口径。

#### 先止损

- 降低可选详细日志与高成本采样，给写入队列设边界。
- 对关键依赖按预先约定策略限制新请求，保留最小审计/计量标识。

#### 再恢复

- 恢复依赖或回滚异常日志/采样配置，受控补齐可重放事件。
- 校验计量去重和缺口；不存在已验证持久补偿机制时，不宣称账单已一致。

#### 恢复验收

- 关键路径等待回落，队列/磁盘恢复且请求完整完成。
- 最小审计和计量核对通过，敏感内容未进入普通指标。

#### 提前预防

- 依赖分级、有限缓冲、采样与基数预算、计量事件去重。
- 按请求/发现/事件/审计的独立故障面演练。

**不要这样做：** 无条件关闭鉴权计费，丢掉全部证据，给每个 request_id 建指标标签。

机制依据（剧本为工程推演）：[S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S32: Dynamo · Architecture](https://docs.nvidia.com/dynamo/knowledge-base/concepts/architecture) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### F27 图片请求慢，文本请求却正常

把视觉编码 E 加入请求链路，按图片工作量而非图片个数排查。

作用域：多模态分支 / VE 池。协作：视觉编码 + 接入。

#### 症状

- 相同文本下带图片才慢
- 高分辨率/多图组更明显
- P/D 未饱和但 VE 排队上升

#### 候选机制

- 独立视觉编码有自己的队列和计算；图片尺寸/patch 工作量改变资源需求。
- 也可能在上传、图片读取/解码或 embedding 交付，不是视觉 GPU 计算本身。

#### 判别与证伪

- 受控对比纯文本、小图、大图和多图，保留相同其余参数。
- 拆接入/解码、VE 排队/计算、embedding 到达和 Prefill 开始时间。
- 按图片 patch 工作量比较 VE 实例分布，不用图片数代替。

#### 先止损

- 限制新增超大/多图的低优先级工作，保护正常文本与小图服务。
- 摘除已确认异常 VE 端点，保持与对应 P/D 版本兼容。

#### 再恢复

- 恢复对应 VE/解码资源或回退图像处理变更，预热后逐级放图像流量。
- 若允许降分辨率，必须显式约定并验证任务效果，不静默丢图。

#### 恢复验收

- 真实多模态任务完整完成，图片理解质量和阶段 P99 达标。
- 文本服务没有被移流或预热拖慢。

#### 提前预防

- 多模态独立工作量、SLO 和故障域评估。
- 图片形状/大小兼容测试，VE 故障与 embedding 交接演练。

**不要这样做：** 只扩 P/D，以图片数估全部成本，静默丢图后仍报告原任务成功。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### F28 新 schema 请求首包慢或结构化生成失败

区分 JSON 格式请求、约束编译、增量解码与最终校验，不能都归因模型能力。

作用域：schema / 编译依赖。协作：结构化输出 + 协议。

#### 症状

- 普通文本正常，特定新/复杂 schema 失败
- 编译等待或失败先于首输出
- 终态正常但结构验证仍不通过

#### 候选机制

- 公开部署有独立结构化输出编译职责，可能新增资源与版本边界。
- 编译失败/超时是机制推演；空格 JSON、截断、解析与不支持字段也可能产生相近结果。

#### 判别与证伪

- 固定文本和预算，对比无约束、已验证 schema、新 schema。
- 拆 schema 校验/编译、排队、生成与最终 validator，核对端点支持能力。
- 检查结构化状态与迁移兼容，不把参考迁移能力当普适保障。

#### 先止损

- 暂停问题 schema 扩散，保留已验证任务路径。
- 明确失败或采用产品允许且同样校验的替代方案，不静默取消 schema 约束。

#### 再恢复

- 修复/回退编译或适配层，恢复兼容版本；控制新 schema 编译突发。
- 回放合法/非法/复杂与边界 schema，质量通过后逐级恢复。

#### 恢复验收

- 编译与生成分别达标，合法终态后最终 schema 校验通过。
- 无约束降级没有被统计成原结构化任务成功。

#### 提前预防

- schema 能力矩阵、复杂度与编译工作量预算。
- 模型/编译器/解析器版本协同灰度；长流与取消测试。

**不要这样做：** 仅看 200，关闭校验掩盖失败，假定结构化请求能任意迁移。

机制依据（剧本为工程推演）：[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S16: Responses API · 兼容范围](https://api-docs.deepseek.com/guides/responses_api/) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration)

## 请求生命周期教学场景

### 正常完成

- 0ms · 请求进入，开始总 deadline
- 70ms · 收到 headers；还不能算成功
- 约 500ms · 首模型输出；随后开始答案内容
- 2360ms · 收到合法终态并通过任务校验

完整成功需要传输、协议与任务验收三层证据。图示时间仅教学示意，不是 DeepSeek 实测。

阶段示意（非实测）：入口 70ms → 排队 90ms → Prefill 260ms → KV 交接 60ms → Decode 1800ms → 解析验收 80ms。

[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### 保活但不出字

- 0ms · 连接建立
- 1000ms · 收到 keepalive comment；没有模型输出
- 3000ms · 首模型 Token 仍未出现，首 Token 预算已超
- 最终可能被关闭；应取消并释放原计算

连接活着只能证明传输活性。官方允许排队保活，未开始推理可在 10 分钟后关闭；客户端应设置更符合业务的独立期限。

阶段示意（非实测）：入口 70ms → 排队 3000ms → Prefill 260ms → KV 交接 60ms → Decode 1800ms → 解析验收 80ms。

[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/)

### 缓存失效

- 模板/命名空间变化先发生
- miss Token/s 上升，Prefill 排队随后增长
- TTFT 超时，重试若无预算会再次增加工作量
- 限制重算与预热，恢复可证实的前缀复用

命中率下降不是根因结论；先区分前缀变化、隔离键、冷启动、缓存存储或索引异常。

阶段示意（非实测）：入口 70ms → 排队 700ms → Prefill 1800ms → KV 交接 100ms → Decode 1800ms → 解析验收 80ms。

[S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S30: Dynamo · KV-Aware Routing](https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing)

### 交接卡住

- 源端已完成输入计算
- 目标 Decode 尚未真正开始生成
- 双方可能各自保留状态与槽位
- 定位源/目标对、链路与布局版本后再恢复

单看 Prefill 或 Decode 利用率可能误判。需要一段独立的状态交接 span 和双边清理证据。

阶段示意（非实测）：入口 70ms → 排队 90ms → Prefill 260ms → KV 交接 2800ms → Decode 1800ms → 解析验收 80ms。

[S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 输出到一半断流

- 首内容已对用户可见
- 中途停顿或连接断开
- 缺少协议合法终态：只能标部分结果
- 再生成必须作为新候选，不能无声拼接

首包成功率会掩盖这类故障。恢复在途连续性与恢复新请求是两个不同目标。

阶段示意（非实测）：入口 70ms → 排队 90ms → Prefill 260ms → KV 交接 60ms → Decode 2600ms → 解析验收 0ms。

[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration)

### 取消后仍在计算

- 客户端 deadline 到期或主动断开
- worker 收到取消计数增长
- engine abort / KV free 未发生，旧计算仍占资源
- 再次重试会产生新旧两份工作

必须关联 disconnect → cancel_received → engine_abort → KV_free。信号计数不是资源回收证明。

阶段示意（非实测）：入口 70ms → 排队 90ms → Prefill 260ms → KV 交接 60ms → Decode 3300ms → 解析验收 0ms。

[S28: Dynamo v1.6.1 · Cancellation Architecture](https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture)

## 交互实验的数学模型

### 工作量与稳定在途数

P = λ × I × (1 − h)，L = λ × W，G = λ × O。

例：100 req/s × 8000 Token × 10% 未命中 = 80000 未缓存 Token/s；命中从 90% 降为 50%，变为 400000，即 5 倍。W 从 10s 变为 30s，在途数从 1000 变为 3000。

P 不是 FLOPs，不能直接换算 GPU；Little 定律用于稳定时间平均，队列无限增长时不能据此预测稳定容量。

### 有界重试

单层期望尝试 A = Σ(k=0..r) p^k；成功概率 1 − p^(r+1)。多层最坏底层尝试 = (r+1)^m。

p=0.5，r=2：单层期望 1.75 次。三层每层最多总尝试 3 次，最坏 27 次。生产失败相关且 p 随负载增长，独立模型通常低估风险。部分内容或业务动作已发生时必须先处理状态，不能只应用概率公式。

### 整实例 N−1

故障后规划预算 = (N−1)C u；未限流积压 B ≈ max(λ−(N−1)C,0)T。

N=4，C=100 req/s，u=70%，故障后规划预算 210 req/s。λ=200 时有 10 req/s 规划余量。C 必须来自规定长度分布、缓存和 SLO 的实测。目标余量是用户假设；共享网络和冷缓存使线性模型偏乐观。

## SLO 与可观测

### 完整服务可用性

符合约定的完整响应数 ÷ 合格原始请求数

合格请求必须预先定义。参数/鉴权错误单列；过载拒绝、服务超时和服务诱发取消仍应可见，不能事后移出分母。

### 首输出与持续输出

联合达标率 = 同时满足两项的合格请求数 ÷ 合格原始请求数

TTFT 与最长停顿各设 SLO，再评估联合达标率。首模型 Token 与首答案分别观察；按长度、缓存、思考模式和模型分组。

### 协议与任务正确性

合法终态 → schema → 约定任务验收

平台协议正确性与模型任务质量不是同一个 SLO；不能把全部幻觉当宕机，也不能只看 200。

### 状态与恢复

新请求 / 在途 / 外部动作 / 计量分别设目标

进程恢复不等于流连续、动作恰好一次或账单一致。取消回收和版本兼容也需要验收。

### 用户任务 / 独立任务完成率

口径：按唯一业务意图计数。

目的：合法终态 + 结构可用 + 约定流程完成。

配合证据：与拒绝、超时、服务诱发取消一起看，避免重试提高分母或只挑成功请求。

[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### 接入 / DNS / TLS / headers 分段

口径：ms，按路径分组。

目的：判断请求是否到达推理链路。

配合证据：同 payload 对比路径；无 headers 的失败不能直接归 GPU。

[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/)

### 首输出 / 首字节 / 首模型 / 首答案

口径：ms，P50/P95/P99。

目的：把保活、真实生成、用户看到答案区分开。

配合证据：按长度、冷热缓存、思考模式分组；保活不重置业务预算。

[S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### 调度 / 等待时间与等待工作量

口径：s + 未缓存 Token。

目的：连接数与工作量两个维度观察队列。

配合证据：看队列斜率与完成率；无限增长时不存在稳定平均容量。

[S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/) · [S29: Dynamo v1.6.1 · Request Rejection](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-rejection)

### 输入 / 未缓存输入 Token/s

口径：Token/s。

目的：输入计算压力代理，不能直接当 FLOPs。

配合证据：联合输入长度分布、Token 加权命中率和 Prefill 步时。

[S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 状态交接 / KV 交接尾延迟 / 成功率

口径：ms / 比例 / bytes。

目的：区分算得慢与算完却交不过去。

配合证据：源目标配对、握手、NIC 与双边释放记录。

[S22: SGLang · PD Disaggregation](https://docs.sglang.io/docs/advanced_features/pd_disaggregation) · [S23: DistServe · OSDI 2024](https://arxiv.org/abs/2401.09670)

### 输出 / 引擎 ITL 与客户端最长停顿

口径：ms/token；ms/event。

目的：引擎 Token 节奏与用户可见 chunk 节奏分开。

配合证据：SSE chunk 可能含多个 Token；网络缓冲会使两者不同。

[S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### 状态容量 / KV 可用块 / 引用 / 抢占

口径：block / 次数 / 时间。

目的：预分配显存内部的逻辑余量。

配合证据：与长度、预留槽及重算关联；具体计数按引擎能力取。

[S21: vLLM · Optimization and Tuning](https://docs.vllm.ai/en/stable/configuration/optimization/) · [S24: PagedAttention · SOSP 2023](https://arxiv.org/abs/2309.06180)

### 实例 / 完整实例 goodput / 进度

口径：合格任务/s；最后进度时间。

目的：只统计已加载、预热且能推理的完整单元。

配合证据：Running Pod、GPU 平均利用率、活进程不代表就绪。

[S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md) · [S20: vLLM · Production Metrics](https://docs.vllm.ai/en/stable/usage/metrics/)

### 专家与通信 / 最慢 rank / 专家偏斜

口径：max/median 步时；Token 分布。

目的：定位同步长尾，而非只观察平均 GPU。

配合证据：拆计算、all-to-all、NIC；热点跟内容还是物理卡移动。

[S04: DeepEP · MoE 通信](https://github.com/deepseek-ai/DeepEP) · [S05: EPLB · Expert Parallelism Load Balancer](https://github.com/deepseek-ai/EPLB) · [S33: NCCL · Troubleshooting](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html)

### 取消 / 断开 → 中止 → 状态回收

口径：ms，按阶段。

目的：确认用户退出后真实释放资源。

配合证据：cancel_received 不能替代引擎 abort 和 KV free。

[S28: Dynamo v1.6.1 · Cancellation Architecture](https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture)

### 重试 / 尝试率 / 原始请求率

口径：倍数 + 重试序号。

目的：识别应用、SDK、网关的放大。

配合证据：同业务 ID 关联但不作为高基数指标标签。

[S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

### 发布 / 可服务容量与版本 cohort

口径：完整实例 / 版本 / 启动阶段秒数。

目的：把恢复时间算到真实承载，而非进程启动。

配合证据：版本、SIGTERM、旧 epoch 和流终止同时间轴。

[S06: FlashMLA · Attention kernels](https://github.com/deepseek-ai/FlashMLA) · [S07: DeepGEMM · FP8 / grouped GEMM](https://github.com/deepseek-ai/DeepGEMM) · [S27: Dynamo v1.6.1 · Graceful Shutdown](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown)

### 协议与质量 / 终态 / schema / 工具 / 任务评测

口径：各自成功率。

目的：运输成功、协议成功和能力目标分别衡量。

配合证据：length、过滤、资源失败、空格 JSON、工具交接分别处理。

[S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/) · [S15: Thinking Mode · 多轮工具协议](https://api-docs.deepseek.com/guides/thinking_mode/) · [S16: Responses API · 兼容范围](https://api-docs.deepseek.com/guides/responses_api/)

遥测最小化：稳定匿名租户、key 指纹、模型/可见版本、模板/适配器版本、计数、阶段时间、终态、工具动作状态。请求 ID 进 trace/受控日志，不作为高基数指标标签。原始提示词、思考内容、工具敏感参数与 API key 不进普通指标。

## 事故恢复顺序

### 先判断：分阶段、分作用域、分状态

确认是入口、首输出、输出中、终态还是外部动作；再按租户/模型/版本/实例/机架定位。已可见内容与已提交业务动作决定能否重试。

停止条件：证据不足先保留多个候选原因，不启动全池重启。

### 先止损：冻结变化，削减放大，保护健康容量

暂停相关发布与缩容；有界准入、降低可选工作、限制重试；摘除已确认坏目标。记录被拒绝与被降级请求。

停止条件：备用池无余量时不全切；无状态一致性保障时不迁移。

### 再恢复：修复最小故障域，小批恢复

按定位修复链路、组件或完整实例；兼容单元回退，代表性探针通过再逐批放流。积压也受控释放。

停止条件：队列斜率重新为正、P99 恶化、旧 epoch 被选中或质量不合格，立即停放量。

### 后验收：同时验证四种恢复

新任务完整完成；在途结果明确完整或部分；外部动作无重复/歧义；孤儿状态和计量缺口已核对。保留降级窗口。

停止条件：仅健康探针变绿、拒绝量变低或 GPU 利用率回落，都不足以宣布恢复。

## 故障演练与验收

### 单 rank / GPU 退出（F07）

期望：隔离完整实例，不向旧 epoch 发新请求。

验收：N-1 下代表性任务完成；部分流显式失败；完整组重建后验证。

护栏：隔离环境、完整备用、停止条件与负责人。

### 冷缓存 + 模板切换（F04）

期望：输入重算受控，不引发二次过载。

验收：miss Token/s、队列和任务 SLO 在声明降级边界内。

护栏：限制预热/重算预算，保留旧命名空间。

### P/D 传输延迟或失败（F06）

期望：坏配对隔离，源/目标状态都回收。

验收：交接超时后无槽位泄漏；恢复后内容一致。

护栏：限制链路注入范围，不扩散到共享网络。

### 各阶段主动取消（F12）

期望：取消到引擎中止，状态及时释放。

验收：排队/输入/交接/输出均无孤儿生成，正常请求不被误杀。

护栏：只操作合成请求，保留关联 ID。

### 长流滚动更新（F14）

期望：先摘流再排空，合法迁移或明确中断。

验收：长生成、工具、结构化终态均符合能力声明。

护栏：保留旧版本容量，不默认所有状态可迁移。

### 多层重试与突发过载（F16）

期望：预算阻断放大，公平拒绝与降级。

验收：attempt/original 有上限；队列能回落而非无限增长。

护栏：负载上限和共享系统隔离。

### 发现/缓存事件落后（F22）

期望：陈旧端点被 fence，降级路由有界。

验收：旧 epoch 不被选，索引可快照重建。

护栏：保留健康已有流，不触发全池重启。

### JSON / 终态 / parser 边界（F18）

期望：200 终态失败不误报成功，分协议处理结束。

验收：空格、length、资源失败、Responses failed 均正确分类。

护栏：纯契约回放，不执行真实业务动作。

### 工具提交后响应丢失（F19）

期望：先查业务状态，不盲目重放动作。

验收：每个预定动作按稳定 ID 至多提交一次，应执行动作完成或进入明确补偿/人工状态。

护栏：模拟业务账本和动作级幂等键。

### 模型 / 内核兼容回归（F21）

期望：灰度止住并回滚兼容单元。

验收：硬件×形状×任务族评测、质量/成本/时延均通过。

护栏：影子与小灰度，保留回退版本。

### 租户标识 / 缓存隔离变更（F25）

期望：隔离失败先阻断复用，重算受控。

验收：跨租户负测试通过，无越界且容量可承载。

护栏：合成隔离域，无真实敏感数据。

### 日志/遥测/计量依赖变慢（F26）

期望：可选遥测有界降级，关键状态可核对。

验收：无无限缓冲，任务恢复且计量无重复/缺口。

护栏：先明确 fail-open/closed 策略，保留最小审计。

## 建设路线

### P0 把请求看完整

负责：API + 可观测。

产物：原始业务 ID、阶段耗时、终态、版本 cohort 与取消回收；敏感内容不进入指标标签。

验收：能把任意失败归到阶段/范围/状态，并追到相应恢复卡。

### P0 能拒绝、能止重试、能摘坏实例

负责：调度 + 入口。

产物：多资源有界准入、单层重试预算、实例进度探针及最小域熔断。

验收：过载与单实例故障不会拖垮健康池，拒绝和降级有明确定义。

### P0 整实例 N-1 与冷态承载

负责：容量 + 推理。

产物：按真实长度/缓存分布的 goodput 曲线、完整热备用与启动阶段测量。

验收：损失一个故障域后仍满足已声明的流量/SLO，或可受控降级。

### P1 状态生命周期与发布排空

负责：引擎 + 发布。

产物：取消传播、交接双边清理、版本兼容清单、可验证排空/迁移边界。

验收：退出、断开和发布不会产生孤儿计算或无声断流。

### P1 协议与外部动作可靠性

负责：SDK + 业务编排。

产物：端点契约回放、JSON/工具校验、业务动作幂等及未知状态核对。

验收：200 不掩盖失败，重试不制造重复业务动作。

### P2 持续故障演练与优化审查

负责：SRE + 平台各层。

产物：每项性能优化写出新增故障域、代价、监控、退路与演练；定期更新来源版本。

验收：优化后的 goodput 增长可复现，恢复能力和任务质量不退化。

## 真实公开事件

2026-10-15，北京时间 08:11—13:04，页面记录持续 4h52min；端点为分钟级显示，不重算更精确时长。API/聊天退化，技术根因未公开。[S18: 公开事件 · 2026-10-15](https://status.deepseek.com/incidents/7116348214287)

2026-09-20，北京时间 16:45—16:58，Flash 退化 13min；技术根因未公开。历史组件名可能随当前命名更新。[S19: 公开事件 · 2026-09-20](https://status.deepseek.com/incidents/7007335047287)

## 主张台账

- V4.1 Flash / DeepInfer / Recipe 官方资料真实存在；当前研究以此为锚点。（official） [S01: DeepInfer · 公开范围与推理核心](https://github.com/deepseek-ai/DeepInfer) · [S09: deepseek-recipe · 协议编码与输出解析](https://github.com/deepseek-ai/deepseek-recipe) · [S17: API Updates · 模型别名与版本](https://api-docs.deepseek.com/updates/)

- 公开 DeepInfer 离线核心并未包含完整在线生产系统。（official） [S01: DeepInfer · 公开范围与推理核心](https://github.com/deepseek-ai/DeepInfer)

- V3/R1 H800 时代设计可解释历史，但不能当当前硬件/容量承诺。（history） [S03: V3/R1 Inference System Overview](https://github.com/deepseek-ai/open-infra-index/blob/3122a25220273cb0806f591e52c4171bd869d8ad/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md)

- 大 EP 实例存在单 GPU 故障扩大到整实例的约束。（official） [S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

- 专家副本和完整服务容灾备用是不同层级。（inference） [S05: EPLB · Expert Parallelism Load Balancer](https://github.com/deepseek-ai/EPLB) · [S02: V4.1 Flash Deployment Q&A · v0.2](https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md)

- 连接保活不能证明模型已经开始输出。（contract） [S11: Rate Limit · 并发、隔离与保活](https://api-docs.deepseek.com/quick_start/rate_limit/)

- 合法 HTTP 状态不保证合法终态和可用任务结果。（contract） [S13: Chat Completions · 响应与终态](https://api-docs.deepseek.com/api/create-chat-completion/)

- Responses 不能直接沿用 Chat 的流终止与会话持久化假设。（contract） [S16: Responses API · 兼容范围](https://api-docs.deepseek.com/guides/responses_api/)

- 取消信号收到后，仍需证明引擎中止和状态回收。（reference） [S28: Dynamo v1.6.1 · Cancellation Architecture](https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture)

- 框架迁移能力受版本与请求类型限制，不能外推到任意 DeepSeek 请求。（reference） [S26: Dynamo v1.6.1 · Request Migration](https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration)

- 缓存失败可能经重算和重试放大为过载；本研究的因果剧本。（inference） [S14: Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) · [S25: Google SRE · Handling Overload](https://sre.google/sre-book/handling-overload/)

- 两起公开服务退化事件没有公开技术 RCA，不能分配到具体故障卡。（incident） [S18: 公开事件 · 2026-10-15](https://status.deepseek.com/incidents/7116348214287) · [S19: 公开事件 · 2026-09-20](https://status.deepseek.com/incidents/7007335047287)

## 术语

- **Prefill**：处理输入上下文的阶段。其负载应关注未缓存输入工作量，不能只看请求数。

- **Decode**：在已有上下文上持续生成输出。活动序列、输出长度和状态容量一起决定压力。

- **KV Cache**：注意力计算的中间状态。前缀复用、状态内存和生成迁移是相关但不同的问题。

- **EP / rank**：专家并行及其成员。同步步骤可能受最慢 rank 约束；一个成员故障可影响完整组。

- **DP**：数据并行服务副本或组的维度；与专家 Token 路由、缓存请求路由不是同一层。

- **MLA / SWA**：模型注意力与窗口机制。不要把传统 MHA 的每 Token 显存公式直接套来估容量。

- **MTP / speculation**：多 Token 预测或投机生成。应看接受率与每个最终有效 Token 的总工作量。

- **TTFT / ITL**：首模型 Token 延迟 / 引擎 Token 间隔。首字节、角色事件、SSE chunk 不能自动替代。

- **Goodput**：在约定长度分布、延迟和正确性目标下完成的有效任务吞吐，不是裸生成 Token 数。

- **故障域**：一次故障会共同失去的服务单元。规划备用应按完整可服务实例及共同依赖计算。

- **RTO / RPO**：恢复时间 / 状态损失目标。新流量、在途生成、工具动作及账单状态应分别定义。

- **证伪**：寻找能排除候选原因的观测。例如 Prefill 正常、交接耗时增长，会削弱算力饱和假设。

## 一手来源登记

### S01 DeepInfer · 公开范围与推理核心

DeepSeek · 核验 2026-11-05 · official

支持范围：生产引擎定位；公开版本目前仅离线核心，缺少在线缓存、E/P/D 分离及 DP 均衡。

不能推断：不能仅凭开源仓库重建完整在线 API。

https://github.com/deepseek-ai/DeepInfer

### S02 V4.1 Flash Deployment Q&A · v0.2

DeepSeek · 2026-11-03 · 固定 commit · official

支持范围：阶段分离、分级缓存、EP 故障域及扩缩容等部署披露。

不能推断：仅代表文档对应部署；处置剧本与全公司架构不是官方披露。

https://github.com/deepseek-ai/DeepInfer/blob/a679bb86ce36e883a98a97733492b686e5b9a08e/doc/inference_deployment_qa.md

### S03 V3/R1 Inference System Overview

DeepSeek · 2025-03-01 · 历史快照 · history

支持范围：历史 H800 集群、P/D 分离和专家并行设计。

不能推断：历史硬件、吞吐、成本不能当作当前承诺，也不能与新版本随意拼接。

https://github.com/deepseek-ai/open-infra-index/blob/3122a25220273cb0806f591e52c4171bd869d8ad/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md

### S04 DeepEP · MoE 通信

DeepSeek · 核验 2026-11-05 · official

支持范围：MoE Token dispatch/combine、NVLink/RDMA 及 all-to-all 通信。

不能推断：通信性能优化不构成服务可用性承诺；V1/V2 配置不同。

https://github.com/deepseek-ai/DeepEP

### S05 EPLB · Expert Parallelism Load Balancer

DeepSeek · 核验 2026-11-05 · official

支持范围：热点专家副本与拓扑感知放置。

不能推断：专家副本用于负载均衡，不等于完整服务备用实例。

https://github.com/deepseek-ai/EPLB

### S06 FlashMLA · Attention kernels

DeepSeek · 核验 2026-11-05 · official

支持范围：专用 MLA 内核及硬件、软件兼容边界。

不能推断：不能推导所有 GPU、模型与形状都可用。

https://github.com/deepseek-ai/FlashMLA

### S07 DeepGEMM · FP8 / grouped GEMM

DeepSeek · 核验 2026-11-05 · official

支持范围：矩阵计算、JIT 与兼容性测试依据。

不能推断：内核机制不能证明 DeepSeek 发生过数值或编译事故。

https://github.com/deepseek-ai/DeepGEMM

### S08 3FS · Fire-Flyer File System

DeepSeek · 核验 2026-11-05 · official

支持范围：面向训练和推理的分布式存储；客户端/服务端版本兼容提示。

不能推断：开源存储能力不等于 API 状态一致性或缓存持久性保证。

https://github.com/deepseek-ai/3FS

### S09 deepseek-recipe · 协议编码与输出解析

DeepSeek · 核验 2026-11-05 · official

支持范围：输入编码、解码、响应格式和工具/思考内容解析。

不能推断：不是完整网关、账户、安全或计费实现。

https://github.com/deepseek-ai/deepseek-recipe

### S10 DualPipe · 训练与在线路径边界

DeepSeek · 核验 2026-11-05 · official

支持范围：训练阶段计算与通信重叠。

不能推断：本研究不将训练算法画进 API 在线推理路径。

https://github.com/deepseek-ai/DualPipe

### S11 Rate Limit · 并发、隔离与保活

DeepSeek API · 核验 2026-11-05 · contract

支持范围：账户并发、user_id 隔离；排队保活与未开始推理时的连接关闭。

不能推断：限额会变；并发额度不是固定 QPS、吞吐或延迟保证。

https://api-docs.deepseek.com/quick_start/rate_limit/

### S12 Error Codes

DeepSeek API · 核验 2026-11-05 · contract

支持范围：400/401/402/422/429/500/503 等错误分类。

不能推断：仅凭状态码无法确定内部故障层级。

https://api-docs.deepseek.com/quick_start/error_codes/

### S13 Chat Completions · 响应与终态

DeepSeek API · 核验 2026-11-05 · contract

支持范围：增量响应、finish_reason、usage、工具交接及长度/资源/中止终态。

不能推断：HTTP 成功和 stop 本身不能证明业务任务成功。

https://api-docs.deepseek.com/api/create-chat-completion/

### S14 Context Caching

DeepSeek API · 核验 2026-11-05 · contract

支持范围：前缀计算复用及 hit/miss Token 用量。

不能推断：不等于答案缓存；不保证每次命中或会话持久恢复。

https://api-docs.deepseek.com/guides/kv_cache/

### S15 Thinking Mode · 多轮工具协议

DeepSeek API · 核验 2026-11-05 · contract

支持范围：思考模式与工具轮次的历史消息要求。

不能推断：工具由客户端执行，模型响应不提供业务恰好一次保证。

https://api-docs.deepseek.com/guides/thinking_mode/

### S16 Responses API · 兼容范围

DeepSeek API · 核验 2026-11-05 · contract

支持范围：无状态兼容、不支持字段及独立终止事件。

不能推断：不能把相似接口名称理解成相同状态、存储或后台执行能力。

https://api-docs.deepseek.com/guides/responses_api/

### S17 API Updates · 模型别名与版本

DeepSeek API · 2026-10-17 条目等 · contract

支持范围：V4.1 Flash 发布及后续别名更新记录。

不能推断：更新记录不意味着 API 允许任意旧版本固定或回滚。

https://api-docs.deepseek.com/updates/

### S18 公开事件 · 2026-10-15

DeepSeek Status · 2026-10-15 · incident

支持范围：官方记录的服务退化、事件时间及恢复更新。

不能推断：未披露技术根因；不能归因为 GPU、缓存或调度。

https://status.deepseek.com/incidents/7116348214287

### S19 公开事件 · 2026-09-20

DeepSeek Status · 2026-09-20 · incident

支持范围：Flash 服务退化 13 分钟的公开记录。

不能推断：无公开技术 RCA；历史组件名称可能随当前命名更新。

https://status.deepseek.com/incidents/7007335047287

### S20 vLLM · Production Metrics

vLLM · stable · 核验 2026-11-05 · reference

支持范围：排队、TTFT、ITL、KV、抢占等参考观测量。

不能推断：不代表 DeepSeek 使用 vLLM；指标名应按实际版本核对。

https://docs.vllm.ai/en/stable/usage/metrics/

### S21 vLLM · Optimization and Tuning

vLLM · stable · 核验 2026-11-05 · reference

支持范围：KV 抢占重算、分块 Prefill 与批量预算取舍。

不能推断：本研究只借鉴机制，不提供可直接套到 DeepSeek 的参数。

https://docs.vllm.ai/en/stable/configuration/optimization/

### S22 SGLang · PD Disaggregation

SGLang · 核验 2026-11-05 · reference

支持范围：阶段分离、状态传输及资源预留取舍。

不能推断：不是 DeepSeek 内部选型证据。

https://docs.sglang.io/docs/advanced_features/pd_disaggregation

### S23 DistServe · OSDI 2024

论文作者 · 2024 · paper

支持范围：TTFT/TPOT 双目标与通信约束下的阶段分离研究。

不能推断：实验吞吐收益不应外推成任何平台容量承诺。

https://arxiv.org/abs/2401.09670

### S24 PagedAttention · SOSP 2023

论文作者 · 2023 · paper

支持范围：动态 KV 状态与内存管理的原始研究。

不能推断：不能给 DeepSeek MLA 直接套传统 MHA 每 Token 显存公式。

https://arxiv.org/abs/2309.06180

### S25 Google SRE · Handling Overload

Google · SRE Book · reference

支持范围：不同请求成本、过载保护、重试预算及多层放大。

不能推断：具体阈值要结合本平台工作量、SLO 与压测确定。

https://sre.google/sre-book/handling-overload/

### S26 Dynamo v1.6.1 · Request Migration

NVIDIA · 固定文档版本 v1.6.1 · reference

支持范围：请求迁移、Token 状态重放及能力限制。

不能推断：默认关闭；guided/JSON schema 和 n>1 等不受支持；不能推出普适续写。

https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-migration

### S27 Dynamo v1.6.1 · Graceful Shutdown

NVIDIA · 固定文档版本 v1.6.1 · reference

支持范围：摘流、排空、终止超时与清理顺序。

不能推断：不能视为 DeepSeek 已实现的具体控制流程。

https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/graceful-shutdown

### S28 Dynamo v1.6.1 · Cancellation Architecture

NVIDIA · 固定文档版本 v1.6.1 · reference

支持范围：取消信号传播和实际引擎中止的区别。

不能推断：cancel_received 计数不能证明计算停止或 KV 回收。

https://docs.nvidia.com/dynamo/v1.6.1/knowledge-base/concepts/fault-tolerance/request-cancellation-architecture

### S29 Dynamo v1.6.1 · Request Rejection

NVIDIA · 固定文档版本 v1.6.1 · reference

支持范围：按不同资源维度拒绝过载的参考设计。

不能推断：其 HTTP 529 等实现细节不是 DeepSeek API 契约。

https://docs.nvidia.com/dynamo/v1.6.1/kubernetes/fault-tolerance/request-rejection

### S30 Dynamo · KV-Aware Routing

NVIDIA · 核验 2026-11-05 · reference

支持范围：同时权衡缓存局部性和活跃负载。

不能推断：缓存路由与专家路由是不同层级；不是 DeepSeek 选型证明。

https://docs.nvidia.com/dynamo/knowledge-base/concepts/system-architecture/kv-aware-routing

### S31 Dynamo · Fault Tolerance Testing

NVIDIA · 核验 2026-11-05 · reference

支持范围：取消、迁移、GPU、网络等测试范畴。

不能推断：演练只能在已授权隔离环境执行；本页面不连接系统。

https://docs.nvidia.com/dynamo/latest/knowledge-base/concepts/fault-tolerance/fault-tolerance-testing

### S32 Dynamo · Architecture

NVIDIA · 核验 2026-11-05 · reference

支持范围：请求、发现、事件等通信平面划分。

不能推断：用于说明故障模式，不推断 DeepSeek 使用 etcd/NATS 等组件。

https://docs.nvidia.com/dynamo/knowledge-base/concepts/architecture

### S33 NCCL · Troubleshooting

NVIDIA · 核验 2026-11-05 · reference

支持范围：GPU 拓扑、网络、通信和运行时的分层诊断。

不能推断：参考诊断方法；DeepEP 不能被等同为 NCCL。

https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/troubleshooting.html

### S34 3FS · Design Notes

DeepSeek · 核验 2026-11-05 · official

支持范围：存储/元数据职责、复制与恢复的设计依据。

不能推断：存储复制语义不能自动覆盖生成状态和业务动作。

https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md
