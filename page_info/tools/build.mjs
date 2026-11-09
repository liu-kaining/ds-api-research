import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => readFile(path.join(root, "src", name), "utf8");
const files = ["shell.html","style.css","atlas.css","core.js","data.js","cases.js","operations.js","atlas.js","app.js"];
const values = await Promise.all(files.map(read));
const contents = Object.fromEntries(files.map((name,i)=>[name,values[i]]));
let html = contents["shell.html"];
contents["style.css"] += "\n" + contents["atlas.css"];
for (const [marker,name] of [["STYLE","style.css"],["CORE","core.js"],["DATA","data.js"],["CASES","cases.js"],["OPERATIONS","operations.js"],["ATLAS","atlas.js"],["APP","app.js"]])
  html = html.replace(`/*__${marker}__*/`,()=>contents[name].replace(/<\/script/gi,"<\\/script"));
if (/\/\*__\w+__\*\//.test(html)) throw new Error("Unreplaced build placeholder");
const context = {};
vm.createContext(context);
for (const name of ["data.js","cases.js","operations.js"])
  vm.runInContext(contents[name],context,{filename:name});
const d = context.RESEARCH;
const sourceIds = new Set(d.sources.map(s=>s.id));
const caseIds = new Set(d.cases.map(c=>c.id));
if(caseIds.size!==d.cases.length || sourceIds.size!==d.sources.length) throw new Error("Duplicate research ID");
for(const group of [d.nodes,d.cases,d.tradeoffs,d.metrics,d.claims,d.scenarios,d.boundaries])
  for(const item of group)
    for(const id of item.sources || [])
      if(!sourceIds.has(id)) throw new Error(`Missing source ${id}`);
for(const node of d.nodes)
  for(const id of node.cases) if(!caseIds.has(id)) throw new Error(`Missing case ${id}`);
for(const x of d.cases)
  for(const key of ["signals","mechanism","diagnose","contain","restore","verify","prevent","avoid"])
    if(!x[key]?.length) throw new Error(`${x.id} missing ${key}`);

const sourceLink = id => {const s=d.sources.find(x=>x.id===id);return `[${id}: ${s.title}](${s.url})`;};
const refs = ids => ids.map(sourceLink).join(" · ");
const bullets = list => list.map(s=>`- ${s}`).join("\n");
const lines = [
  "# DeepSeek API 稳定性深度研究",
  `研究快照：${d.date} · ${d.timezone}。`,
  "这是一份基于公开资料的工程研究。故障剧本是建议，不是 DeepSeek 已发生事故或内部运维手册；未访问真实 API 或生产集群。可交互版本请打开同目录 index.html。",
  "## 研究结论",
  "管理对象是工作量、在途状态、完整服务实例和任务契约，不只是 QPS、连接和进程。恢复分为新请求、在途生成、外部业务动作及状态/计量四个目标。性能优化需要同时说明新增故障域、观测、退路和演练。",
  "## 证据边界",
  ...d.boundaries.map(x=>`### ${x.title}\n\n${x.text}\n\n${refs(x.sources)}`),
  "## 请求链路与组件",
  "交互架构全景位于网页第 01 部分；故障传播全景与 28×13 触点矩阵位于第 03 部分。两张图支持缩放、全屏和处置定位，静态 SVG/PNG 位于 diagrams/。传播图提供缓存/单卡/取消/发布四条机制链与反馈切断模式；它不是故障概率图或真实事故 RCA。",
  "主路径：API 入口 → 编码/调度 → Prefill → 状态交接 → Decode → 输出解析与验收。缓存/专家/GPU/主机资源跨阶段；图片视觉编码 E 与结构化输出编译 SO 是条件分支。内部网关与控制面拆分未公开。",
  ...d.nodes.map(x=>`### ${x.n} ${x.name}\n\n${x.responsibility}\n\n状态：${x.state}\n\n耦合风险：${x.coupling}\n\n优先证据：\n\n${bullets(x.evidence)}\n\n关联处置：${x.cases.join("、")}\n\n${refs(x.sources)}`),
  "## 优化与可靠性取舍",
  ...d.tradeoffs.map(x=>`### ${x.design}\n\n收益：${x.benefit}。\n\n代价：${x.cost}。\n\n保障：${x.control}。参见 ${x.case}。\n\n${refs(x.sources)}`),
  `## ${d.cases.length} 份故障处置剧本`,
  "以下操作须由具备对应权限的平台人员按最小作用域执行，且有回退条件。调用方主要控制自身并发、deadline、重试、parser、任务校验和业务幂等。先止损/再恢复是行动顺序，不是承诺固定分钟恢复。",
  ...d.cases.map(x=>`### ${x.id} ${x.title}\n\n${x.summary}\n\n作用域：${x.scope}。协作：${x.owner}。\n\n${[
    ["症状",x.signals],["候选机制",x.mechanism],["判别与证伪",x.diagnose],["先止损",x.contain],["再恢复",x.restore],["恢复验收",x.verify],["提前预防",x.prevent]
  ].map(([title,items])=>`#### ${title}\n\n${bullets(items)}`).join("\n\n")}\n\n**不要这样做：** ${x.avoid}\n\n机制依据（剧本为工程推演）：${refs(x.sources)}`),
  "## 请求生命周期教学场景",
  ...d.scenarios.map(x=>`### ${x.title}\n\n${bullets(x.trace)}\n\n${x.finding}\n\n阶段示意（非实测）：${x.stages.map(([name,ms])=>`${name} ${ms}ms`).join(" → ")}。\n\n${refs(x.sources)}`),
  "## 交互实验的数学模型",
  "### 工作量与稳定在途数\n\nP = λ × I × (1 − h)，L = λ × W，G = λ × O。\n\n例：100 req/s × 8000 Token × 10% 未命中 = 80000 未缓存 Token/s；命中从 90% 降为 50%，变为 400000，即 5 倍。W 从 10s 变为 30s，在途数从 1000 变为 3000。\n\nP 不是 FLOPs，不能直接换算 GPU；Little 定律用于稳定时间平均，队列无限增长时不能据此预测稳定容量。",
  "### 有界重试\n\n单层期望尝试 A = Σ(k=0..r) p^k；成功概率 1 − p^(r+1)。多层最坏底层尝试 = (r+1)^m。\n\np=0.5，r=2：单层期望 1.75 次。三层每层最多总尝试 3 次，最坏 27 次。生产失败相关且 p 随负载增长，独立模型通常低估风险。部分内容或业务动作已发生时必须先处理状态，不能只应用概率公式。",
  "### 整实例 N−1\n\n故障后规划预算 = (N−1)C u；未限流积压 B ≈ max(λ−(N−1)C,0)T。\n\nN=4，C=100 req/s，u=70%，故障后规划预算 210 req/s。λ=200 时有 10 req/s 规划余量。C 必须来自规定长度分布、缓存和 SLO 的实测。目标余量是用户假设；共享网络和冷缓存使线性模型偏乐观。",
  "## SLO 与可观测",
  ...d.slos.map(x=>`### ${x.title}\n\n${x.formula}\n\n${x.text}`),
  ...d.metrics.map(x=>`### ${x.stage} / ${x.name}\n\n口径：${x.unit}。\n\n目的：${x.meaning}。\n\n配合证据：${x.pair}。\n\n${refs(x.sources)}`),
  "遥测最小化：稳定匿名租户、key 指纹、模型/可见版本、模板/适配器版本、计数、阶段时间、终态、工具动作状态。请求 ID 进 trace/受控日志，不作为高基数指标标签。原始提示词、思考内容、工具敏感参数与 API key 不进普通指标。",
  "## 事故恢复顺序",
  ...d.responseSteps.map(x=>`### ${x.time}：${x.title}\n\n${x.detail}\n\n停止条件：${x.stop}`),
  "## 故障演练与验收",
  ...d.drills.map(x=>`### ${x.fault}（${x.case}）\n\n期望：${x.expected}。\n\n验收：${x.accept}。\n\n护栏：${x.guard}。`),
  "## 建设路线",
  ...d.roadmap.map(x=>`### ${x.p} ${x.title}\n\n负责：${x.owner}。\n\n产物：${x.deliver}\n\n验收：${x.accept}`),
  "## 真实公开事件",
  `2026-10-15，北京时间 08:11—13:04，页面记录持续 4h52min；端点为分钟级显示，不重算更精确时长。API/聊天退化，技术根因未公开。${sourceLink("S18")}`,
  `2026-09-20，北京时间 16:45—16:58，Flash 退化 13min；技术根因未公开。历史组件名可能随当前命名更新。${sourceLink("S19")}`,
  "## 主张台账",
  ...d.claims.map(x=>`- ${x.text}（${x.kind}） ${refs(x.sources)}`),
  "## 术语",
  ...d.glossary.map(([term,text])=>`- **${term}**：${text}`),
  "## 一手来源登记",
  ...d.sources.map(x=>`### ${x.id} ${x.title}\n\n${x.owner} · ${x.date} · ${x.kind}\n\n支持范围：${x.scope}\n\n不能推断：${x.limit}\n\n${x.url}`)
];
await Promise.all([
  writeFile(path.join(root,"index.html"),html),
  writeFile(path.join(root,"research.md"),lines.join("\n\n")+"\n"),
  writeFile(path.join(root,"sources.json"),JSON.stringify({date:d.date,timezone:d.timezone,sources:d.sources},null,2)+"\n")
]);
await mkdir(path.join(root,"artifacts"),{recursive:true});
console.log(`Built self-contained index.html (${Buffer.byteLength(html)} bytes), research.md; ${d.cases.length} cases, ${d.sources.length} sources, ${d.nodes.length} components.`);
