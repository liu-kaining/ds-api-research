/* Connected, offline diagrams. Public mechanisms and proposed dependencies stay distinct. */
(function (root) {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const svgNode = ({x,y,w,h=96,id,title,lines=[],badge="",generic=false,extra=""},fault=false) =>
    `<g class="svg-node ${generic?"generic":""} ${extra}" ${id?`role="button" tabindex="0" ${fault?"data-fault-node":"data-atlas-node"}="${id}" aria-label="${esc(title)}"`:'role="img"'}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><text class="node-badge" x="${x+14}" y="${y+18}">${esc(badge)}</text><text class="node-title" x="${x+14}" y="${y+42}">${esc(title)}</text>${lines.map((line,i)=>`<text class="node-sub" x="${x+14}" y="${y+63+i*17}">${esc(line)}</text>`).join("")}</g>`;
  const arrow = (id,color) => `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`;
  let D, onNode, selectedNode="scheduler", selectedFault="cache-loss", scene="all", guarded=false, expanded=null;
  const faultNodes = [
    {id:"heavy",x:20,y:90,w:170,h:105,title:"工作量变重",lines:["长输入 / 长生成","图片 / 复杂 schema"],badge:"触发 · 需求变化",extra:"fault-node trigger",cases:["F02","F03","F27","F28"],why:"原始请求数不变，输入、输出、图片或编译工作量仍可能增长。先比较工作量分布与阶段耗时。"},
    {id:"cache-loss",x:210,y:90,w:170,h:105,title:"缓存层失效",lines:["前缀 / 版本 / 冷态","先辨 Block 与 SWA"],badge:"触发 · 状态变化",extra:"fault-node trigger",cases:["F04","F05","F25"],why:"区分缓存层级、版本/隔离键、存储与前缀变化，再估恢复成本。丢失 SWA 不应一概当完整上下文重算。"},
    {id:"rank-loss",x:400,y:90,w:170,h:105,title:"rank / 硬件故障",lines:["坏卡 / 慢卡 / 通信组","可能损失完整实例"],badge:"触发 · 故障域",extra:"fault-node trigger",cases:["F07","F08","F09"],why:"相关请求按完整实例聚集时，关联最慢 rank、硬件和通信证据；不要只重启一个成员或只数空闲 GPU。"},
    {id:"network",x:590,y:90,w:170,h:105,title:"网络 / 存储异常",lines:["KV 交接 / all-to-all","主机 RDMA / 入口"],badge:"触发 · 依赖",extra:"fault-node trigger",cases:["F06","F09","F10","F24"],why:"入口、专家通信、状态交接和主机访问是不同路径。用配对、拓扑和阶段跨度找真实等待点。"},
    {id:"rollout",x:780,y:90,w:170,h:105,title:"发布 / 视图变化",lines:["冷启动 / 摘流 / epoch","版本兼容与发现落后"],badge:"触发 · 控制变化",extra:"fault-node trigger",cases:["F13","F14","F21","F22","F26"],why:"把实际版本、就绪/排空、发现视图和流终止对到一条时间轴。新 Pod 不等于新容量。"},
    {id:"contract-change",x:970,y:90,w:170,h:105,title:"协议 / 编排变化",lines:["端点 / 工具 / 解析器","鉴权 / 预算 / 参数"],badge:"触发 · 契约变化",extra:"fault-node trigger",cases:["F18","F19","F20","F21","F23"],why:"先确定接口能力和终态，再看模型任务质量。不要把永久错误、工具交接和资源失败混作同一种重试。"},
    {id:"cancel-loss",x:1160,y:90,w:180,h:105,title:"取消传播断裂",lines:["断开未到引擎","中止后状态未回收"],badge:"触发 · 生命周期",extra:"fault-node trigger",cases:["F12"],why:"同一请求的 disconnect、cancel_received、engine_abort、KV_free 缺哪个环节，就定位到对应生命周期边界。"},
    {id:"prefill-pressure",x:20,y:315,w:300,h:105,title:"输入工作量 / Prefill 压力上升",lines:["未缓存 Token/s ↑，编码或输入池等待","QPS 不变不代表所需算力不变"],badge:"资源层 · 输入",extra:"fault-node resource",cases:["F02","F04","F16"],why:"把输入侧计算、入口 CPU 与交接等待拆开。优先限制重算和高成本突发，再补正确资源。"},
    {id:"capacity-loss",x:360,y:315,w:300,h:105,title:"健康完整容量骤降",lines:["故障实例摘流；健康池承接更多工作","备用需完整可服务，不能只统计卡"],badge:"资源层 · 容量",extra:"fault-node resource",cases:["F07","F13","F14","F16"],why:"以当前长度/缓存分布下的 goodput 核算 N-k。备用无余量就限流，不能把全部积压瞬间转移。"},
    {id:"handoff-pressure",x:700,y:315,w:300,h:105,title:"交接 / 状态保留与等待",lines:["双方预留、孤儿计算、远程等待","占用延长也会减少可接新请求"],badge:"资源层 · 状态",extra:"fault-node resource",cases:["F05","F06","F10","F12"],why:"观察交接双方、活动状态和真实中止；减少新准入并清理已确认孤儿状态。当前 DeepSeek Decode 不常态受缓存容量约束。"},
    {id:"contract-bad",x:1040,y:315,w:300,h:105,title:"协议 / 任务 / 业务状态不一致",lines:["生成完整 ≠ schema / 工具流程成功","动作提交后超时留下“未知”状态"],badge:"语义层 · 契约",extra:"fault-node resource",cases:["F18","F19","F20","F21","F23","F25"],why:"按端点终态、schema、业务动作账本分层校验；处理未知提交先查询，不盲目重放。"},
    {id:"queue-timeout",x:20,y:550,w:300,h:105,title:"排队 / 首输出超时 / 拒绝",lines:["保活不算生成进度","429 与 503 还需区分作用域"],badge:"用户可见 · 尚未完整输出",extra:"fault-node outcome",cases:["F01","F02","F15","F16"],why:"限制队列与重试，先定位账户/模型/实例作用域。拒绝与降级必须在指标中可见，不能被移出分母。"},
    {id:"decode-bad",x:360,y:550,w:300,h:105,title:"生成停顿 / 终态失败 / 断流",lines:["HTTP 200 仍可能中途失败","已可见内容不能无声重生成拼接"],badge:"用户可见 · 在途生成",extra:"fault-node outcome",cases:["F03","F07","F11","F14","F17"],why:"区分引擎进度与客户端事件、判断是否部分结果。恢复新请求与恢复在途连续性需要不同验收。"},
    {id:"orphan",x:700,y:550,w:300,h:105,title:"孤儿计算 / 状态长期占用",lines:["用户退出，后台仍产 Token","in-flight / KV / 预留槽不回落"],badge:"隐性影响 · 占用延长",extra:"fault-node outcome",cases:["F05","F06","F12"],why:"必须以实际引擎停止和资源释放证明取消完成。新重试不能继续叠在未停止的旧工作之上。"},
    {id:"invalid",x:1040,y:550,w:300,h:105,title:"无效结果 / 错误或重复动作",lines:["空格 JSON / 截断 / parser 差异","工具副作用与计量需独立核对"],badge:"用户可见 · 任务失败",extra:"fault-node outcome",cases:["F18","F19","F20","F21","F26"],why:"技术可用性、协议完整、任务质量、每个业务动作的提交状态分开评估；一个会话可合法包含多个动作。"},
    {id:"retry",x:240,y:755,w:350,h:100,title:"重试放大尝试率",lines:["应用 × SDK × 网关；坏请求重复进入","过载中失败相关，独立模型偏乐观"],badge:"放大器 A · 正反馈",extra:"fault-node amplifier",cases:["F15","F16","F17","F19"],why:"收敛为单层有预算重试，贯穿总 deadline。输出已可见和外部动作已提交会改变安全重试条件。"},
    {id:"hold",x:770,y:755,w:350,h:100,title:"占用变长，剩余资源继续减少",lines:["计算 / 状态 / 握手保留得更久","新请求更慢，更多取消与失败"],badge:"放大器 B · 正反馈",extra:"fault-node amplifier",cases:["F05","F06","F12"],why:"缩短无效生命周期、释放确认孤儿状态，并抑制新增高占用工作；不能只优化入口连接数。"},
    {id:"admission-guard",x:20,y:965,w:420,h:100,title:"切断 A：准入 + 期限 + 重试预算",lines:["有限排队；限制重算；公平拒绝；取消旧工作","保护健康池，记录真实拒绝和降级"],badge:"传播切断点 · 工程建议",extra:"fault-node guard",cases:["F01","F04","F15","F16"],why:"保护阻断放大，不会自动修复源头。先确认取消与可承载范围，再逐批释放积压。"},
    {id:"domain-guard",x:470,y:965,w:420,h:100,title:"恢复源头：隔离 + 完整备用 + 版本回退",lines:["最小故障域摘流；热备用；兼容单元回滚","通过真实推理探针后再逐批放量"],badge:"恢复条件 · 工程建议",extra:"fault-node guard",cases:["F07","F09","F13","F14","F21","F22"],why:"故障域、备用与回滚目标要事先验证。没有健康余量或兼容保障时，宁可有界降级，也不全切或盲迁。"},
    {id:"state-guard",x:920,y:965,w:420,h:100,title:"切断 B：真实取消 + 终态与动作校验",lines:["engine abort → 状态回收；端点独立 parser","动作 ID 幂等、未知提交核对、隔离验证"],badge:"传播切断点 · 工程建议",extra:"fault-node guard",cases:["F12","F18","F19","F20","F25","F26"],why:"收到信号、HTTP 成功或模型 stop 都不是终点；需要引擎、协议和业务状态分别证明完成。"}
  ];
  const faultEdges = [
    ["work-p","heavy","prefill-pressure","M105 195 V250 H170 V315"],
    ["cache-p","cache-loss","prefill-pressure","M295 195 V270 H170 V315"],
    ["rank-cap","rank-loss","capacity-loss","M485 195 V260 H510 V315"],
    ["net-transfer","network","handoff-pressure","M675 195 V250 H850 V315"],
    ["net-cap","network","capacity-loss","M675 195 V230 H640 V315"],
    ["roll-cap","rollout","capacity-loss","M865 195 V240 H665 V285 H510 V315"],
    ["roll-contract","rollout","contract-bad","M865 195 V275 H1190 V315"],
    ["contract-invalid","contract-change","contract-bad","M1055 195 V250 H1190 V315"],
    ["cancel-orphan","cancel-loss","orphan","M1250 195 V235 H1020 V600 H1000"],
    ["p-q","prefill-pressure","queue-timeout","M170 420 V550"],
    ["cap-q","capacity-loss","queue-timeout","M510 420 V470 H170 V550"],
    ["cap-d","capacity-loss","decode-bad","M510 420 V550"],
    ["transfer-q","handoff-pressure","queue-timeout","M850 420 V490 H170 V550"],
    ["transfer-d","handoff-pressure","decode-bad","M850 420 V470 H510 V550"],
    ["transfer-orphan","handoff-pressure","orphan","M850 420 V550"],
    ["contract-result","contract-bad","invalid","M1190 420 V550"],
    ["q-retry","queue-timeout","retry","M170 655 V700 H415 V755"],
    ["d-retry","decode-bad","retry","M510 655 V710 H415 V755"],
    ["orphan-hold","orphan","hold","M850 655 V710 H945 V755"],
    ["result-retry","invalid","retry","M1190 655 V700 H415 V755"],
    ["retry-p","retry","prefill-pressure","M240 805 H8 V368 H20",true],
    ["hold-state","hold","handoff-pressure","M1120 805 H1352 V440 H1020 V368 H1000",true]
  ];
  const scenes = {
    all:{title:"全景：多源触发、两类放大器",start:"cache-loss",edges:faultEdges.map(x=>x[0]),text:"箭头表示可能的传播机制，不表示每次必然发生、发生概率或已确认根因。点节点看关联处置；选择一条链可减少视觉干扰。"},
    cache:{title:"缓存失效 → 输入重算 → 超时重试",start:"cache-loss",edges:["cache-p","p-q","q-retry","retry-p"],text:"先确认丢失的缓存层与重算范围。限制重算/预热和重试预算可切断回灌，但仍需修复前缀、存储或版本问题。"},
    gpu:{title:"单 rank 故障 → 完整容量下降 → 健康池受压",start:"rank-loss",edges:["rank-cap","cap-q","cap-d","q-retry","d-retry","retry-p"],text:"服务单位是完整实例。摘流保护新请求；已输出的流可能仍中断。备用池无余量时必须限流，而不是把所有积压立即切过去。"},
    cancel:{title:"取消传播断裂 → 孤儿工作 → 占用延长",start:"cancel-loss",edges:["cancel-orphan","orphan-hold","hold-state","transfer-q","transfer-d","q-retry","d-retry","retry-p"],text:"取消必须贯穿到 engine abort 与状态释放。仅降低前端连接数无法恢复后端容量；超时后立即重试会叠加两份工作。"},
    release:{title:"发布 / 契约变化 → 在途或语义失败 → 危险重放",start:"rollout",edges:["roll-cap","roll-contract","cap-d","contract-result","d-retry","result-retry","retry-p"],text:"同时查版本/排空与协议能力。终态、schema、每个业务动作独立验收；有外部副作用时先查已提交状态，再决定重试。"}
  };

  function refs(ids) {
    return `<div class="refs"><small>依据</small>${ids.map(id=>`<a class="ref" href="#source-${id}">${id}</a>`).join("")}</div>`;
  }
  function jumps(ids) {
    return `<div class="case-jumps">${ids.map(id=>`<button type="button" class="case-jump" data-case="${id}">${id} ${esc(D.cases.find(c=>c.id===id).title)} ↗</button>`).join("")}</div>`;
  }
  function shell(type,title,kicker,body,extra="") {
    return `<header class="panorama-head"><div><span class="panorama-kicker">${kicker}</span><h3>${title}</h3></div><div class="panorama-tools" aria-label="全景图工具"><button type="button" data-map-action="minus" data-map="${type}" aria-label="缩小${title}">−</button><output id="${type}-zoom">100%</output><button type="button" data-map-action="plus" data-map="${type}" aria-label="放大${title}">＋</button><button type="button" data-map-action="fit" data-map="${type}">全览</button><button type="button" data-map-action="expand" data-map="${type}">全屏 ↗</button></div></header>${extra}<div class="panorama-hint"><span><b>点击节点</b> 查看状态、证据与处置</span><span>可缩放、横向/纵向滚动；手机建议全屏后放大</span></div><div class="panorama-viewport" id="${type}-viewport"><div class="panorama-canvas" id="${type}-canvas">${body}</div></div><div class="panorama-detail" id="${type}-panorama-detail" aria-live="polite"></div><div class="panorama-note">单独查看静态大图：<a href="diagrams/${type}-panorama.svg" target="_blank" rel="noopener">SVG 矢量图 ↗</a> · <a href="diagrams/${type}-panorama.png" target="_blank" rel="noopener">PNG 原图 ↗</a></div>`;
  }
  function architectureSvg() {
    const nodes = [
      {x:20,y:130,w:120,id:null,title:"开发者应用",lines:["输入 / 会话 / 工具","合法动作与状态"],badge:"调用方",generic:true},
      {x:175,y:130,w:155,id:"edge",title:"API 入口",lines:["连接 / 鉴权 / 配额","内部拆分未公开"],badge:"通用平台职责",generic:true},
      {x:365,y:130,w:155,id:"recipe",title:"Recipe / 编码",lines:["消息 / 模板 / Token","协议和版本边界"],badge:"官方软件职责"},
      {x:555,y:130,w:160,id:"scheduler",title:"调度 / 选池",lines:["请求 / 阶段 / 用户","保护策略另作建议"],badge:"公开机制 + 建议"},
      {x:750,y:130,w:160,id:"prefill",title:"Prefill",lines:["未复用的输入计算","输入侧工作量"],badge:"公开阶段"},
      {x:945,y:130,w:120,id:"transfer",title:"KV 交接",lines:["状态 / 元数据","双边清理"],badge:"分离引入的依赖"},
      {x:1100,y:130,w:160,id:"decode",title:"Decode",lines:["活动序列 / 生成","进度与合法终态"],badge:"公开阶段"},
      {x:365,y:340,w:155,id:"structured",title:"SO 编译",lines:["schema / 解码约束","独立编译职责"],badge:"条件：结构化输出"},
      {x:555,y:340,w:160,id:"vision",title:"视觉编码 E",lines:["图片 patch → 表征","独立编码资源"],badge:"条件：图片请求"},
      {x:750,y:340,w:300,id:"cache",h:105,title:"KV 存储 / 分级缓存",lines:["持久 Block 与内存 SWA 生命周期不同","有限回放恢复与全量重算需区分"],badge:"公开分级机制"},
      {x:1100,y:340,w:160,id:"recipe",title:"解析 / 终态",lines:["SSE / schema / 工具","再做任务验收"],badge:"出站协议职责"},
      {x:205,y:555,w:240,id:"expert",h:105,title:"MoE / 专家并行",lines:["DeepEP dispatch / combine","EPLB 专家副本与放置"],badge:"实例内部 · 计算与通信"},
      {x:475,y:555,w:260,id:"gpu",h:105,title:"GPU / 权重 / 专用内核",lines:["FlashMLA / DeepGEMM 等","完整通信组、版本、预热与进度"],badge:"实例内部 · 运行条件"},
      {x:765,y:555,w:270,id:"transfer",h:105,title:"高速通信与状态路径",lines:["NVLink / RDMA / KV 传输","链路、拓扑、buffer 和超时"],badge:"不同流量分别观测"},
      {x:1100,y:555,w:160,id:"engram",h:105,title:"Engram / 主机",lines:["GPU 路径：CPU/RDMA","NPU 路径须区别"],badge:"硬件范围已区分"},
      {x:205,y:840,w:250,id:"control",h:90,title:"发现 / 路由视图 / epoch",lines:["健康与实际端点一致；隔离旧成员"],badge:"通用职责 · 具体产品未公开",generic:true},
      {x:485,y:840,w:250,id:"control",h:90,title:"容量 / 发布 / 排空",lines:["完整备用、就绪、版本和回退"],badge:"通用职责 · 保障建议",generic:true},
      {x:765,y:840,w:465,id:"control",h:90,title:"观测 / 安全 / 计量与审计边界",lines:["阶段 trace、终态与质量、取消回收；共享依赖有界保护"],badge:"通用职责 · 内部拓扑未公开",generic:true}
    ];
    return `<svg class="panorama-svg architecture-svg" viewBox="0 0 1360 1000" role="img" aria-labelledby="architecture-svg-title architecture-svg-desc"><title id="architecture-svg-title">DeepSeek API 架构全景与状态依赖</title><desc id="architecture-svg-desc">主链路从开发者经过入口、Recipe、调度、Prefill、KV 交接和 Decode；图片与结构化编译是条件分支，缓存、专家、GPU、主机及控制面作为依赖。实线数据流，绿色虚线状态或运行依赖，橙色虚线通用控制职责。</desc><defs>${arrow("architecture-arrow","#426d75")}${arrow("architecture-state-arrow","#3b8875")}${arrow("architecture-control-arrow","#ba7c4e")}</defs>
      <text class="zone-label" x="20" y="27">A / DATA PLANE · 主请求路径</text>
      <path class="data-edge" d="M140 178 H175"/><path class="data-edge" d="M330 178 H365"/><path class="data-edge" d="M520 178 H555"/><path class="data-edge" d="M715 178 H750"/><path class="data-edge" d="M910 178 H945"/><path class="data-edge" d="M1065 178 H1100"/>
      <path class="data-edge" d="M1180 226 V340"/><path class="data-edge" d="M1260 388 H1320 V65 H80 V130"/>
      <text class="edge-label" x="500" y="57">流式返回：保活 ≠ 模型进度；协议完成 ≠ 任务完成</text>
      <rect class="zone optional" x="345" y="295" width="385" height="170" rx="3"/><text class="zone-label" x="365" y="317">B / CONDITIONAL BRANCHES</text>
      <path class="data-edge" d="M442 226 V340"/><path class="data-edge" d="M442 280 H635 V340"/><path class="data-edge" d="M715 388 H735 V280 H830 V226"/>
      <path class="state-edge" d="M520 388 H535 V260 H1080 V178 H1100"/><text class="edge-label" x="565" y="253">结构化解码约束</text>
      <rect class="zone" x="738" y="295" width="325" height="170" rx="3"/><text class="zone-label" x="755" y="317">C / STATE & REUSE</text>
      <path class="state-edge" d="M850 340 V280 H870 V226"/><path class="state-edge" d="M1180 226 V280 H965 V340"/>
      <text class="edge-label" x="930" y="273">KV 状态读写</text>
      <rect class="zone engine" x="175" y="500" width="890" height="230" rx="3"/><text class="zone-label" x="205" y="526">D / INSIDE SERVING INSTANCES · P / D 实例的执行与通信</text>
      <path class="state-edge" d="M750 178 H735 V485 H605 V555"/><path class="state-edge" d="M1100 178 H1080 V485 H900 V555"/>
      <path class="state-edge" d="M445 607 H475"/><path class="state-edge" d="M735 607 H765"/><path class="state-edge" d="M1035 607 H1100"/>
      <rect class="domain-boundary" x="192" y="540" width="560" height="138" rx="3"/>
      <text class="domain-label" x="205" y="702">故障域：当前大 EP 披露中，单 GPU 故障可影响完整实例；专家副本 ≠ 整实例备用</text>
      <text class="zone-note" x="1100" y="687">主机资源与网络也可在关键路径</text>
      <rect class="zone control" x="175" y="795" width="1085" height="160" rx="3"/><text class="zone-label" x="205" y="820">E / CONTROL & ASSURANCE · 通用平台职责，未声称具体内部产品与拆分</text>
      <path class="control-edge" d="M205 885 H150 V178 H175"/><path class="control-edge" d="M610 840 V730"/><path class="control-edge" d="M900 730 V840"/>
      <text class="edge-label" x="620" y="778">生命周期管理</text><text class="edge-label" x="915" y="778">观测 / 反馈</text>
      ${nodes.map(x=>svgNode(x)).join("")}
      <text class="zone-note" x="20" y="984">图例：蓝色实线 = 请求/返回；绿色虚线 = 状态、条件或运行依赖；橙色虚线 = 通用控制职责。不是机房物理拓扑。</text>
    </svg>`;
  }
  function faultSvg() {
    const activeEdges = new Set(scenes[scene].edges);
    const activeNodes = new Set();
    faultEdges.filter(e=>activeEdges.has(e[0])).forEach(e=>{activeNodes.add(e[1]);activeNodes.add(e[2]);});
    if(scene==="all") faultNodes.forEach(n=>activeNodes.add(n.id));
    ["admission-guard","domain-guard","state-guard"].forEach(id=>activeNodes.add(id));
    return `<svg class="panorama-svg fault-svg" viewBox="0 0 1360 1105" role="img" aria-labelledby="fault-svg-title fault-svg-desc"><title id="fault-svg-title">故障触发、传播、正反馈与切断点全景</title><desc id="fault-svg-desc">七种触发因素进入四个资源或契约故障面，再产生首输出、持续输出、状态或业务结果问题。重试和占用延长形成反馈；有界准入、故障域备用、真实取消与业务校验用于切断传播。</desc><defs>${arrow("fault-arrow","#c67d5b")}${arrow("fault-loop-arrow","#b34c31")}${arrow("fault-break-arrow","#4b8c73")}</defs>
      <text class="zone-label" x="20" y="40">1 / TRIGGERS · 触发不是根因结论；按工作量、变化与作用域找证据</text>
      <text class="zone-label" x="20" y="290">2 / RESOURCES & CONTRACTS · 算力、容量、状态与契约四个故障面</text>
      <text class="zone-label" x="20" y="523">3 / USER & HIDDEN IMPACT · 同样的 200 / 超时，可能处于完全不同阶段</text>
      <text class="zone-label" x="20" y="735">4 / AMPLIFIERS · 故障为什么会越处理越大</text>
      <text class="zone-label" x="20" y="938">5 / CUTS & RECOVERY CONDITIONS · 切断反馈不等于修复源头</text>
      ${faultEdges.map(([id,from,to,d,feedback])=>`<path class="fault-edge ${feedback?"feedback":""} ${!activeEdges.has(id)?"dim":""} ${feedback&&guarded?"blocked":""}" data-fault-edge="${id}" d="${d}"/>`).join("")}
      <path class="guard-line" d="M230 965 V900 H415 V855"/><path class="guard-line" d="M1130 965 V900 H945 V855"/>
      ${guarded?'<text class="guard-bolt" x="13" y="710">×</text><text class="guard-bolt" x="1334" y="710">×</text>':""}
      <text class="edge-label" x="32" y="877">${guarded?"尝试回灌已被预算约束（示意）":"红色回路：尝试率再次进入输入侧"}</text>
      <text class="edge-label" x="900" y="885">${guarded?"无效占用需实际中止并回收":"红色回路：状态保留让可用资源继续减少"}</text>
      ${faultNodes.map(n=>svgNode({...n,extra:`${n.extra} ${activeNodes.has(n.id)?"":"dim"} ${selectedFault===n.id?"is-selected":""}`},true)).join("")}
      <text class="zone-note" x="20" y="1093">纯机制推演；边不是发生概率。灰化表示当前链未选中。保护模式只展示阻断正反馈的边界，不承诺自动恢复。</text>
    </svg>`;
  }
  function renderArchitectureDetail(id) {
    selectedNode=id;
    const n=D.nodes.find(x=>x.id===id);
    document.querySelectorAll("[data-atlas-node]").forEach(el=>el.classList.toggle("is-selected",el.dataset.atlasNode===id));
    document.getElementById("architecture-panorama-detail").innerHTML=`<h4>${esc(n.name)}</h4><span class="tag ${n.kind}">${n.kind==="official"?"官方机制 / 软件职责":"通用职责 · 内部未公开"}</span><p>${esc(n.responsibility)} ${esc(n.coupling)}</p>${jumps(n.cases)}${refs(n.sources)}`;
  }
  function renderFaultDetail() {
    const node=faultNodes.find(x=>x.id===selectedFault);
    const current=scenes[scene];
    document.getElementById("failure-panorama-detail").innerHTML=`<h4>${esc(current.title)}</h4><span class="tag inference">工程推演</span><p>${esc(current.text)}</p><p><b>选中：${esc(node.title)}</b> · ${esc(node.why)}</p>${jumps(node.cases)}${refs(["S02","S25","S28","S13"])}${guarded?'<p><b>保护条件：</b>只示意切断回路。仍需定位修复源头，并证明健康余量、真实取消和业务状态正确。</p>':""}`;
  }
  function renderFault() {
    const section=document.getElementById("failure-panorama");
    const canvas=section.querySelector(".panorama-canvas");
    if(canvas) canvas.innerHTML=faultSvg();
    section.querySelectorAll("[data-fault-scene]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.faultScene===scene)));
    section.querySelectorAll("[data-fault-guard]").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.faultGuard==="on")===guarded)));
    renderFaultDetail();
  }
  function resize(type,action) {
    const viewport=document.getElementById(`${type}-viewport`);
    const canvas=document.getElementById(`${type}-canvas`);
    const old=canvas.getBoundingClientRect().width||1360;
    const width=action==="fit"?viewport.clientWidth:action==="initial"?Math.max(viewport.clientWidth,innerWidth<640?1020:viewport.clientWidth):Math.max(340,Math.min(3200,old*(action==="plus"?1.2:1/1.2)));
    const center=(viewport.scrollLeft+viewport.clientWidth/2)/old;
    canvas.style.width=`${width}px`;
    document.getElementById(`${type}-zoom`).textContent=`${Math.round(width/1360*100)}%`;
    if(action!=="initial" && action!=="fit") viewport.scrollLeft=Math.max(0,center*width-viewport.clientWidth/2);
  }
  function toggleExpand(type) {
    const dialog=document.getElementById("atlas-dialog");
    if(expanded){dialog.close();return;}
    const section=document.getElementById(`${type}-panorama`);
    const placeholder=document.createComment("panorama original position");
    section.before(placeholder);
    expanded={section,placeholder,type};
    dialog.append(section);
    section.querySelector('[data-map-action="expand"]').textContent="退出全屏 ↙";
    dialog.showModal();
    requestAnimationFrame(()=>resize(type,innerWidth<640?"initial":"fit"));
  }
  function renderMatrix() {
    const short={edge:"入口",recipe:"协议",scheduler:"调度",prefill:"P",transfer:"交接",decode:"D",cache:"缓存",expert:"EP",gpu:"GPU",engram:"主机",vision:"视觉 E",structured:"SO",control:"控制"};
    document.getElementById("fault-matrix").innerHTML=`<p class="matrix-note">● 表示主要诊断/处置触点，不代表该组件已被确认为根因。点击故障名称进入完整手册。</p><table class="fault-matrix"><thead><tr><th>故障现象 / 机制</th>${D.nodes.map(n=>`<th title="${esc(n.name)}">${short[n.id]}</th>`).join("")}</tr></thead><tbody>${D.cases.map(c=>`<tr><td><button type="button" class="case-jump" data-case="${c.id}">${c.id} ${esc(c.title)} ↗</button></td>${D.nodes.map(n=>`<td>${c.layers.includes(n.id)?`<span class="matrix-dot" aria-label="${esc(n.name)}诊断触点">●</span>`:""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function init(data,options={}) {
    D=data;onNode=options.onNode;
    document.getElementById("architecture-panorama").innerHTML=shell("architecture","架构全景 · 请求、状态与故障域","PANORAMA A / CONNECTED SYSTEM",architectureSvg())+`<div class="panorama-note">当前官方机制依据 S01 / S02 / S04 / S05 / S08 / S09；蓝色连接是简化逻辑，非物理拓扑。橙色平台职责没有声称已公开的内部实现。</div>`;
    const controls=`<div class="fault-controls"><div class="fault-scene-tabs" aria-label="故障传播链">${[["all","全部传播关系"],["cache","缓存 → 重试"],["gpu","单卡 → 容量"],["cancel","取消 → 占用"],["release","发布 → 结果"]].map(([id,title])=>`<button type="button" data-fault-scene="${id}" aria-pressed="${id===scene}">${title}</button>`).join("")}</div><div class="fault-protection"><span class="fault-mode-label">观察传播边界：</span><button type="button" data-fault-guard="off" aria-pressed="true">无额外保护</button><button type="button" data-fault-guard="on" aria-pressed="false">切断放大回路</button></div></div>`;
    document.getElementById("failure-panorama").innerHTML=shell("failure","故障全景 · 触发、传播与切断点","PANORAMA B / FAILURE PROPAGATION",faultSvg(),controls);
    const dialog=document.createElement("dialog");dialog.id="atlas-dialog";dialog.className="atlas-dialog";dialog.setAttribute("aria-label","全屏全景图");document.body.append(dialog);
    dialog.addEventListener("close",()=>{
      if(!expanded)return;
      const {section,placeholder,type}=expanded;
      placeholder.before(section);placeholder.remove();
      section.querySelector('[data-map-action="expand"]').textContent="全屏 ↗";
      expanded=null;requestAnimationFrame(()=>resize(type,"initial"));
    });
    renderArchitectureDetail(selectedNode);renderFaultDetail();renderMatrix();
    resize("architecture","initial");resize("failure","initial");
    document.addEventListener("click",event=>{
      if(expanded && event.target.closest("[data-case], a.ref")) {dialog.close();return;}
      const control=event.target.closest("[data-map-action]");
      if(control){const {map,mapAction}=control.dataset;if(mapAction==="expand")toggleExpand(map);else resize(map,mapAction);return;}
      const sceneButton=event.target.closest("[data-fault-scene]");
      if(sceneButton){scene=sceneButton.dataset.faultScene;selectedFault=scenes[scene].start;renderFault();return;}
      const guard=event.target.closest("[data-fault-guard]");
      if(guard){guarded=guard.dataset.faultGuard==="on";renderFault();return;}
      const node=event.target.closest("[data-atlas-node]");
      if(node){renderArchitectureDetail(node.dataset.atlasNode);onNode?.(node.dataset.atlasNode);return;}
      const fault=event.target.closest("[data-fault-node]");
      if(fault){selectedFault=fault.dataset.faultNode;renderFault();document.querySelector(`[data-fault-node="${selectedFault}"]`)?.focus({preventScroll:true});return;}
    });
    document.addEventListener("keydown",event=>{
      const node=event.target.closest("[data-atlas-node], [data-fault-node]");
      if(node && ["Enter"," "].includes(event.key)){event.preventDefault();node.dispatchEvent(new MouseEvent("click",{bubbles:true}));}
    });
  }
  root.ResearchAtlas={init,selectNode:id=>{if(D)renderArchitectureDetail(id);}};
})(globalThis);
