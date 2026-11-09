Object.assign(RESEARCH, {
  tradeoffs: [
    {design:"Prefill / Decode 分离",benefit:"两阶段独立调度和容量规划",cost:"新增 KV 交接、预留资源及双边超时清理",control:"交接独立 span；源目标兼容清单；在途状态回收",case:"F06",sources:["S23","S22"]},
    {design:"前缀与分级缓存",benefit:"减少重复输入计算",cost:"冷态重算、存储/索引依赖、热点和隔离风险",control:"冷缓存容量、受控预热、局部性与负载联合路由",case:"F04",sources:["S14","S30","S08"]},
    {design:"大规模专家并行",benefit:"分布式专家计算与高效资源使用",cost:"同步慢成员约束；完整实例故障域扩大",control:"整实例冗余；每 rank 进度、网络与专家负载",case:"F07",sources:["S04","S05","S02"]},
    {design:"大批量 / 高资源利用率",benefit:"提高吞吐、摊薄成本",cost:"尾延迟与状态容量余量可能变差",control:"用满足双延迟目标的 goodput 规划容量",case:"F03",sources:["S21","S23"]},
    {design:"投机 / MTP",benefit:"被接受时减少有效生成的等待",cost:"低接受率下验证与草稿工作浪费",control:"按有效输出、接受率、延迟与质量联合验收",case:"F11",sources:["S02"]},
    {design:"弹性与滚动发布",benefit:"容量随需求调整、持续升级",cost:"冷启动、陈旧路由、排空与兼容性问题",control:"热备用、代表性就绪探针、兼容单元回退",case:"F14",sources:["S27","S26","S06"]}
  ],
  metrics: [
    {stage:"用户任务",name:"独立任务完成率",unit:"按唯一业务意图计数",meaning:"合法终态 + 结构可用 + 约定流程完成",pair:"与拒绝、超时、服务诱发取消一起看，避免重试提高分母或只挑成功请求",sources:["S13","S25"]},
    {stage:"接入",name:"DNS / TLS / headers 分段",unit:"ms，按路径分组",meaning:"判断请求是否到达推理链路",pair:"同 payload 对比路径；无 headers 的失败不能直接归 GPU",sources:["S11","S13"]},
    {stage:"首输出",name:"首字节 / 首模型 / 首答案",unit:"ms，P50/P95/P99",meaning:"把保活、真实生成、用户看到答案区分开",pair:"按长度、冷热缓存、思考模式分组；保活不重置业务预算",sources:["S11","S20"]},
    {stage:"调度",name:"等待时间与等待工作量",unit:"s + 未缓存 Token",meaning:"连接数与工作量两个维度观察队列",pair:"看队列斜率与完成率；无限增长时不存在稳定平均容量",sources:["S25","S29"]},
    {stage:"输入",name:"未缓存输入 Token/s",unit:"Token/s",meaning:"输入计算压力代理，不能直接当 FLOPs",pair:"联合输入长度分布、Token 加权命中率和 Prefill 步时",sources:["S14","S23"]},
    {stage:"状态交接",name:"KV 交接尾延迟 / 成功率",unit:"ms / 比例 / bytes",meaning:"区分算得慢与算完却交不过去",pair:"源目标配对、握手、NIC 与双边释放记录",sources:["S22","S23"]},
    {stage:"输出",name:"引擎 ITL 与客户端最长停顿",unit:"ms/token；ms/event",meaning:"引擎 Token 节奏与用户可见 chunk 节奏分开",pair:"SSE chunk 可能含多个 Token；网络缓冲会使两者不同",sources:["S20"]},
    {stage:"状态容量",name:"KV 可用块 / 引用 / 抢占",unit:"block / 次数 / 时间",meaning:"预分配显存内部的逻辑余量",pair:"与长度、预留槽及重算关联；具体计数按引擎能力取",sources:["S21","S24"]},
    {stage:"实例",name:"完整实例 goodput / 进度",unit:"合格任务/s；最后进度时间",meaning:"只统计已加载、预热且能推理的完整单元",pair:"Running Pod、GPU 平均利用率、活进程不代表就绪",sources:["S02","S20"]},
    {stage:"专家与通信",name:"最慢 rank / 专家偏斜",unit:"max/median 步时；Token 分布",meaning:"定位同步长尾，而非只观察平均 GPU",pair:"拆计算、all-to-all、NIC；热点跟内容还是物理卡移动",sources:["S04","S05","S33"]},
    {stage:"取消",name:"断开 → 中止 → 状态回收",unit:"ms，按阶段",meaning:"确认用户退出后真实释放资源",pair:"cancel_received 不能替代引擎 abort 和 KV free",sources:["S28"]},
    {stage:"重试",name:"尝试率 / 原始请求率",unit:"倍数 + 重试序号",meaning:"识别应用、SDK、网关的放大",pair:"同业务 ID 关联但不作为高基数指标标签",sources:["S25"]},
    {stage:"发布",name:"可服务容量与版本 cohort",unit:"完整实例 / 版本 / 启动阶段秒数",meaning:"把恢复时间算到真实承载，而非进程启动",pair:"版本、SIGTERM、旧 epoch 和流终止同时间轴",sources:["S06","S07","S27"]},
    {stage:"协议与质量",name:"终态 / schema / 工具 / 任务评测",unit:"各自成功率",meaning:"运输成功、协议成功和能力目标分别衡量",pair:"length、过滤、资源失败、空格 JSON、工具交接分别处理",sources:["S13","S15","S16"]}
  ],
  slos: [
    {title:"完整服务可用性",formula:"符合约定的完整响应数 ÷ 合格原始请求数",text:"合格请求必须预先定义。参数/鉴权错误单列；过载拒绝、服务超时和服务诱发取消仍应可见，不能事后移出分母。"},
    {title:"首输出与持续输出",formula:"联合达标率 = 同时满足两项的合格请求数 ÷ 合格原始请求数",text:"TTFT 与最长停顿各设 SLO，再评估联合达标率。首模型 Token 与首答案分别观察；按长度、缓存、思考模式和模型分组。"},
    {title:"协议与任务正确性",formula:"合法终态 → schema → 约定任务验收",text:"平台协议正确性与模型任务质量不是同一个 SLO；不能把全部幻觉当宕机，也不能只看 200。"},
    {title:"状态与恢复",formula:"新请求 / 在途 / 外部动作 / 计量分别设目标",text:"进程恢复不等于流连续、动作恰好一次或账单一致。取消回收和版本兼容也需要验收。"}
  ],
  responseSteps: [
    {time:"先判断",title:"分阶段、分作用域、分状态",detail:"确认是入口、首输出、输出中、终态还是外部动作；再按租户/模型/版本/实例/机架定位。已可见内容与已提交业务动作决定能否重试。",stop:"证据不足先保留多个候选原因，不启动全池重启。"},
    {time:"先止损",title:"冻结变化，削减放大，保护健康容量",detail:"暂停相关发布与缩容；有界准入、降低可选工作、限制重试；摘除已确认坏目标。记录被拒绝与被降级请求。",stop:"备用池无余量时不全切；无状态一致性保障时不迁移。"},
    {time:"再恢复",title:"修复最小故障域，小批恢复",detail:"按定位修复链路、组件或完整实例；兼容单元回退，代表性探针通过再逐批放流。积压也受控释放。",stop:"队列斜率重新为正、P99 恶化、旧 epoch 被选中或质量不合格，立即停放量。"},
    {time:"后验收",title:"同时验证四种恢复",detail:"新任务完整完成；在途结果明确完整或部分；外部动作无重复/歧义；孤儿状态和计量缺口已核对。保留降级窗口。",stop:"仅健康探针变绿、拒绝量变低或 GPU 利用率回落，都不足以宣布恢复。"}
  ],
  drills: [
    {fault:"单 rank / GPU 退出",expected:"隔离完整实例，不向旧 epoch 发新请求",accept:"N-1 下代表性任务完成；部分流显式失败；完整组重建后验证",guard:"隔离环境、完整备用、停止条件与负责人",case:"F07"},
    {fault:"冷缓存 + 模板切换",expected:"输入重算受控，不引发二次过载",accept:"miss Token/s、队列和任务 SLO 在声明降级边界内",guard:"限制预热/重算预算，保留旧命名空间",case:"F04"},
    {fault:"P/D 传输延迟或失败",expected:"坏配对隔离，源/目标状态都回收",accept:"交接超时后无槽位泄漏；恢复后内容一致",guard:"限制链路注入范围，不扩散到共享网络",case:"F06"},
    {fault:"各阶段主动取消",expected:"取消到引擎中止，状态及时释放",accept:"排队/输入/交接/输出均无孤儿生成，正常请求不被误杀",guard:"只操作合成请求，保留关联 ID",case:"F12"},
    {fault:"长流滚动更新",expected:"先摘流再排空，合法迁移或明确中断",accept:"长生成、工具、结构化终态均符合能力声明",guard:"保留旧版本容量，不默认所有状态可迁移",case:"F14"},
    {fault:"多层重试与突发过载",expected:"预算阻断放大，公平拒绝与降级",accept:"attempt/original 有上限；队列能回落而非无限增长",guard:"负载上限和共享系统隔离",case:"F16"},
    {fault:"发现/缓存事件落后",expected:"陈旧端点被 fence，降级路由有界",accept:"旧 epoch 不被选，索引可快照重建",guard:"保留健康已有流，不触发全池重启",case:"F22"},
    {fault:"JSON / 终态 / parser 边界",expected:"200 终态失败不误报成功，分协议处理结束",accept:"空格、length、资源失败、Responses failed 均正确分类",guard:"纯契约回放，不执行真实业务动作",case:"F18"},
    {fault:"工具提交后响应丢失",expected:"先查业务状态，不盲目重放动作",accept:"每个预定动作按稳定 ID 至多提交一次，应执行动作完成或进入明确补偿/人工状态",guard:"模拟业务账本和动作级幂等键",case:"F19"},
    {fault:"模型 / 内核兼容回归",expected:"灰度止住并回滚兼容单元",accept:"硬件×形状×任务族评测、质量/成本/时延均通过",guard:"影子与小灰度，保留回退版本",case:"F21"},
    {fault:"租户标识 / 缓存隔离变更",expected:"隔离失败先阻断复用，重算受控",accept:"跨租户负测试通过，无越界且容量可承载",guard:"合成隔离域，无真实敏感数据",case:"F25"},
    {fault:"日志/遥测/计量依赖变慢",expected:"可选遥测有界降级，关键状态可核对",accept:"无无限缓冲，任务恢复且计量无重复/缺口",guard:"先明确 fail-open/closed 策略，保留最小审计",case:"F26"}
  ],
  roadmap: [
    {p:"P0",title:"把请求看完整",owner:"API + 可观测",deliver:"原始业务 ID、阶段耗时、终态、版本 cohort 与取消回收；敏感内容不进入指标标签。",accept:"能把任意失败归到阶段/范围/状态，并追到相应恢复卡。"},
    {p:"P0",title:"能拒绝、能止重试、能摘坏实例",owner:"调度 + 入口",deliver:"多资源有界准入、单层重试预算、实例进度探针及最小域熔断。",accept:"过载与单实例故障不会拖垮健康池，拒绝和降级有明确定义。"},
    {p:"P0",title:"整实例 N-1 与冷态承载",owner:"容量 + 推理",deliver:"按真实长度/缓存分布的 goodput 曲线、完整热备用与启动阶段测量。",accept:"损失一个故障域后仍满足已声明的流量/SLO，或可受控降级。"},
    {p:"P1",title:"状态生命周期与发布排空",owner:"引擎 + 发布",deliver:"取消传播、交接双边清理、版本兼容清单、可验证排空/迁移边界。",accept:"退出、断开和发布不会产生孤儿计算或无声断流。"},
    {p:"P1",title:"协议与外部动作可靠性",owner:"SDK + 业务编排",deliver:"端点契约回放、JSON/工具校验、业务动作幂等及未知状态核对。",accept:"200 不掩盖失败，重试不制造重复业务动作。"},
    {p:"P2",title:"持续故障演练与优化审查",owner:"SRE + 平台各层",deliver:"每项性能优化写出新增故障域、代价、监控、退路与演练；定期更新来源版本。",accept:"优化后的 goodput 增长可复现，恢复能力和任务质量不退化。"}
  ],
  claims: [
    {text:"V4.1 Flash / DeepInfer / Recipe 官方资料真实存在；当前研究以此为锚点。",kind:"official",sources:["S01","S09","S17"]},
    {text:"公开 DeepInfer 离线核心并未包含完整在线生产系统。",kind:"official",sources:["S01"]},
    {text:"V3/R1 H800 时代设计可解释历史，但不能当当前硬件/容量承诺。",kind:"history",sources:["S03"]},
    {text:"大 EP 实例存在单 GPU 故障扩大到整实例的约束。",kind:"official",sources:["S02"]},
    {text:"专家副本和完整服务容灾备用是不同层级。",kind:"inference",sources:["S05","S02"]},
    {text:"连接保活不能证明模型已经开始输出。",kind:"contract",sources:["S11"]},
    {text:"合法 HTTP 状态不保证合法终态和可用任务结果。",kind:"contract",sources:["S13"]},
    {text:"Responses 不能直接沿用 Chat 的流终止与会话持久化假设。",kind:"contract",sources:["S16"]},
    {text:"取消信号收到后，仍需证明引擎中止和状态回收。",kind:"reference",sources:["S28"]},
    {text:"框架迁移能力受版本与请求类型限制，不能外推到任意 DeepSeek 请求。",kind:"reference",sources:["S26"]},
    {text:"缓存失败可能经重算和重试放大为过载；本研究的因果剧本。",kind:"inference",sources:["S14","S25"]},
    {text:"两起公开服务退化事件没有公开技术 RCA，不能分配到具体故障卡。",kind:"incident",sources:["S18","S19"]}
  ]
});
