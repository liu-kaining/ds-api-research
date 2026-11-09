(function () {
  "use strict";
  const D = globalThis.RESEARCH;
  const C = globalThis.ResearchCore;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const num = (value, digits = 0) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits:digits }).format(value);
  const kinds = { official:"官方披露", contract:"API 契约", history:"历史快照", reference:"参考实现", paper:"原始论文", inference:"工程推演", incident:"公开事件" };
  const symptoms = { latency:"首输出慢", stall:"持续输出卡顿", capacity:"容量与状态", error:"拒绝与错误", stream:"流中断 / 网络", contract:"协议与任务" };
  const tag = kind => `<span class="tag ${esc(kind)}">${esc(kinds[kind] || kind)}</span>`;
  const refs = (ids, label = "依据") => `<div class="refs"><small>${esc(label)}</small>${ids.map(id => `<a class="ref" href="#source-${esc(id)}" title="${esc(D.sources.find(x => x.id === id)?.title)}">${esc(id)}</a>`).join("")}</div>`;
  const list = (items, ordered = false) => `<${ordered ? "ol" : "ul"}>${items.map(x => `<li>${esc(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
  const caseLink = (id, text = id) => `<button type="button" class="case-jump" data-case="${esc(id)}">${esc(text)} ↗</button>`;
  let selectedCase = D.cases.some(c => c.id === new URLSearchParams(location.search).get("case"))
    ? new URLSearchParams(location.search).get("case") : "F07";
  let selectedNode = "scheduler";
  let selectedScenario = "normal";
  let selectedLab = "workload";
  const labValues = {
    workload:{ rps:100, inputTokens:8000, hit:90, seconds:10, outputTokens:1000 },
    retry:{ rps:100, failure:50, retries:2, layers:1 },
    capacity:{ instances:4, perInstance:100, load:150, target:70, warmSeconds:120 }
  };

  function renderStatic() {
    $("#case-stat").textContent = D.cases.length;
    $("#source-stat").textContent = D.sources.length;
    $("#nav-case-count").textContent = D.cases.length;
    $("#boundaries").innerHTML = D.boundaries.map(x => `<article><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p>${refs(x.sources)}</article>`).join("");
    $("#layer-filter").insertAdjacentHTML("beforeend", D.nodes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(""));
    $("#tradeoffs").innerHTML = `<table><thead><tr><th>设计</th><th>效率收益</th><th>新增代价</th><th>保障责任</th></tr></thead><tbody>${D.tradeoffs.map(x => `<tr><td>${esc(x.design)}</td><td>${esc(x.benefit)}</td><td>${esc(x.cost)}</td><td>${esc(x.control)}<div>${caseLink(x.case)}</div>${refs(x.sources)}</td></tr>`).join("")}</tbody></table>`;
    $("#slo-grid").innerHTML = D.slos.map(x => `<article><h3>${esc(x.title)}</h3><code>${esc(x.formula)}</code><p>${esc(x.text)}</p></article>`).join("");
    $("#metrics-table").innerHTML = `<table><thead><tr><th>阶段 / 观测量</th><th>它要证明什么</th><th>必须配合的证据</th></tr></thead><tbody>${D.metrics.map(x => `<tr><td>${esc(x.stage)}<br>${esc(x.name)}<p class="source-date">${esc(x.unit)}</p></td><td>${esc(x.meaning)}</td><td>${esc(x.pair)}${refs(x.sources)}</td></tr>`).join("")}</tbody></table>`;
    $("#response-steps").innerHTML = D.responseSteps.map(x => `<article class="response-step"><span class="time">${esc(x.time)}</span><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p><p class="stop-rule"><b>停止条件</b> · ${esc(x.stop)}</p></article>`).join("");
    $("#drills-table").innerHTML = `<table><thead><tr><th>注入场景</th><th>希望系统如何反应</th><th>验收证据</th><th>前提与护栏</th></tr></thead><tbody>${D.drills.map(x => `<tr><td>${esc(x.fault)}<div>${caseLink(x.case)}</div></td><td>${esc(x.expected)}</td><td>${esc(x.accept)}</td><td>${esc(x.guard)}</td></tr>`).join("")}</tbody></table>`;
    $("#roadmap").innerHTML = D.roadmap.map(x => `<article><div class="priority">${esc(x.p)}<small>${esc(x.owner)}</small></div><h4>${esc(x.title)}</h4><p>${esc(x.deliver)}</p><p class="roadmap-accept"><b>验收</b> · ${esc(x.accept)}</p></article>`).join("");
    $("#claims-table").innerHTML = `<table><thead><tr><th>主张</th><th>证据类别</th><th>来源</th></tr></thead><tbody>${D.claims.map(x => `<tr><td>${esc(x.text)}</td><td>${tag(x.kind)}</td><td>${refs(x.sources,"")}</td></tr>`).join("")}</tbody></table>`;
    $("#glossary").innerHTML = D.glossary.map(([term, text]) => `<dt>${esc(term)}</dt><dd>${esc(text)}</dd>`).join("");
  }
  function renderArchitecture() {
    let previousGroup = "";
    $("#architecture-map").innerHTML = D.nodes.map(node => {
      const group = node.group !== previousGroup ? `<div class="map-group-title">${esc(node.group)}</div>` : "";
      previousGroup = node.group;
      return `${group}<button type="button" class="node-button ${node.id === selectedNode ? "selected" : ""}" data-node="${esc(node.id)}" aria-pressed="${node.id === selectedNode}"><span class="node-number">${esc(node.n)}</span><i class="dot ${node.kind === "official" ? "teal" : "amber"}" aria-hidden="true"></i><b>${esc(node.name)}</b><small>${esc(node.sub)}</small></button>`;
    }).join("") + `<p class="map-note">主路径：入口 → 编码/调度 → Prefill → 状态交接 → Decode → 解析终态。缓存、专家/GPU、主机资源横跨多个阶段。图片 E 与结构化 SO 是条件分支；控制面管理生命周期。</p>`;
    const node = D.nodes.find(x => x.id === selectedNode);
    $("#node-detail").innerHTML = `<div class="node-detail-head">${tag(node.kind)}<h3>${esc(node.name)}</h3><p>${esc(node.responsibility)}</p></div><div><h4>持有什么状态</h4><p>${esc(node.state)}</p></div><div><h4>为什么会耦合放大</h4><p>${esc(node.coupling)}</p></div><div><h4>优先找什么证据</h4>${list(node.evidence)}</div><div class="node-related"><h4>关联故障处置</h4><div class="case-jumps">${node.cases.map(id => caseLink(id, `${id} ${D.cases.find(c => c.id === id)?.title || ""}`)).join("")}</div>${refs(node.sources)}</div>`;
    globalThis.ResearchAtlas?.selectNode(node.id);
  }
  function renderJourney() {
    $("#scenario-tabs").innerHTML = D.scenarios.map(x => `<button role="tab" id="scenario-${x.id}" aria-controls="scenario-panel" aria-selected="${x.id === selectedScenario}" data-scenario="${x.id}">${esc(x.title)}</button>`).join("");
    const x = D.scenarios.find(s => s.id === selectedScenario);
    const total = x.stages.reduce((sum, [,v]) => sum + v, 0);
    const maxIndex = x.stages.reduce((best, [,v], i) => v > x.stages[best][1] ? i : best, 0);
    $("#scenario-panel").setAttribute("aria-labelledby", `scenario-${x.id}`);
    $("#scenario-panel").innerHTML = `<div class="journey-top"><div><h3>${esc(x.title)}</h3><small>${esc(x.phase)}</small></div><span class="journey-state ${x.tone === "good" ? "" : "bad"}">${esc(x.status)}</span></div><div class="phase-bars" role="img" aria-label="${esc(x.stages.map(([name,value]) => `${name} ${value}毫秒`).join("，"))}">${x.stages.map(([name,v], i) => `<div class="phase-bar ${x.tone !== "good" && i === maxIndex ? "highlight" : ""}" style="flex:${Math.max(v,20)}"><span>${esc(name)}<small>${num(v)}ms</small></span></div>`).join("")}</div><div class="bar-caption">阶段宽度示意 · 小阶段设最小可读宽度 · 总示意时长 ${num(total)}ms</div><div class="journey-bottom"><ol class="event-list">${x.trace.map(t => `<li>${esc(t)}</li>`).join("")}</ol><div class="journey-finding">${esc(x.finding)}<br><a href="#incidents" data-case="${x.case}">打开对应处置 ${x.case} ↗</a>${refs(x.sources)}</div></div>`;
  }
  function filters() {
    return { query:$("#case-search").value, symptom:$("#symptom-filter").value, layer:$("#layer-filter").value };
  }
  function resetFilters() {
    $("#case-search").value = "";
    $("#symptom-filter").value = "all";
    $("#layer-filter").value = "all";
  }
  function renderCases() {
    const matches = C.filterCases(D.cases, filters());
    $("#case-count").textContent = `${matches.length} / ${D.cases.length} 个处置剧本`;
    if (!matches.some(x => x.id === selectedCase) && matches.length) selectedCase = matches[0].id;
    $("#case-list").innerHTML = matches.length ? matches.map(x => `<button type="button" class="case-option ${x.id === selectedCase ? "selected" : ""}" data-case-option="${x.id}" aria-pressed="${x.id === selectedCase}"><span class="case-option-top"><span>${x.id}</span><span>${esc(symptoms[x.symptom])}</span></span><b>${esc(x.title)}</b><small>${esc(x.scope)}</small></button>`).join("") : `<div class="empty-state"><b>没有匹配的故障</b>减少关键词或重置筛选。<br><button type="button" class="text-button" data-reset>重置筛选</button></div>`;
    if (!matches.length) {
      $("#case-detail").innerHTML = `<div class="empty-state"><b>保留多个候选原因，按证据缩小范围。</b>可尝试“KV”“取消”“503”“工具”“RDMA”。</div>`;
      return;
    }
    renderCaseDetail(D.cases.find(x => x.id === selectedCase));
  }
  function renderCaseDetail(x) {
    $("#case-detail").innerHTML = `<header class="case-detail-header"><div class="case-meta"><span class="case-id">${x.id}</span>${tag("inference")}<span>${esc(x.scope)}</span></div><h3>${esc(x.title)}</h3><p class="case-summary">${esc(x.summary)}</p><div class="case-meta">协作角色：${esc(x.owner)}</div><div class="case-inline-tools">${refs(x.sources,"机制依据")}<button type="button" class="text-button" id="copy-case">复制处置卡 ↗</button></div></header><section class="case-part"><h4><span>01</span> 看到什么</h4>${list(x.signals)}</section><section class="case-part"><h4><span>02</span> 候选原因与机制</h4>${x.mechanism.map(p => `<p>${esc(p)}</p>`).join("")}</section><section class="case-part"><h4><span>03</span> 怎样判别 / 证伪</h4>${list(x.diagnose,true)}</section><div class="case-recovery-grid"><section class="case-part"><h4><span>04</span> 先止损</h4>${list(x.contain,true)}</section><section class="case-part"><h4><span>05</span> 再恢复</h4>${list(x.restore,true)}</section></div><section class="case-checks"><h4>✓ 恢复验收 · 什么证据才算恢复</h4>${list(x.verify)}</section><section class="case-part"><h4><span>06</span> 提前预防</h4>${list(x.prevent)}</section><div class="danger-note"><b>不要这样处理</b>${esc(x.avoid)}</div><p class="case-bottom-note">动作前提：具备对应平台权限、已定位最小作用域、存在回退条件。调用方无法执行内部实例/网络/缓存操作，应提供脱敏分段证据并管理自身并发、deadline、重试与业务幂等。这里不是生产命令清单。</p>`;
  }
  function showCase(id, scroll = true, preserve = false) {
    if (!D.cases.some(x => x.id === id)) return;
    if (!preserve) resetFilters();
    selectedCase = id;
    renderCases();
    try {
      const url = new URL(location.href);
      url.searchParams.set("case", id);
      url.hash = "incidents";
      history.replaceState(null, "", url);
    } catch (_) { /* file URL history may be restricted by the host. */ }
    if (scroll) $("#incidents").scrollIntoView({ behavior:"smooth", block:"start" });
  }
  const slider = (key, title, min, max, step, value, unit = "") => `<div class="slider-control"><div class="slider-label"><label for="slider-${key}">${esc(title)}</label><output id="value-${key}" for="slider-${key}">${num(value)}${esc(unit)}</output></div><input type="range" id="slider-${key}" data-slider="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(title)}"><div class="slider-endpoints"><span>${num(min)}${esc(unit)}</span><span>${num(max)}${esc(unit)}</span></div></div>`;
  function barRow(label, value, max, base = false, unit = "") {
    return `<div class="lab-bar-row"><div><span>${esc(label)}</span><b>${num(value,1)} ${esc(unit)}</b></div><div class="bar-track"><div class="bar-fill ${base ? "base" : ""}" style="width:${Math.max(0, Math.min(100, value / Math.max(max, 1) * 100))}%"></div></div></div>`;
  }
  function renderLab() {
    $$("#lab-tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.lab === selectedLab)));
    $("#lab-panel").setAttribute("aria-labelledby", `lab-tab-${selectedLab}`);
    const v = labValues[selectedLab];
    let controls, title, assumptions;
    if (selectedLab === "workload") {
      title = "改变同一批请求的工作量";
      controls = slider("rps","原始到达率 λ",10,300,10,v.rps," req/s")
        + slider("inputTokens","平均输入长度 I",1000,64000,1000,v.inputTokens," Token")
        + slider("hit","Token 加权缓存命中 h",0,100,1,v.hit,"%")
        + slider("seconds","平均系统停留时间 W",1,60,1,v.seconds," s")
        + slider("outputTokens","平均输出长度 O",100,4000,100,v.outputTokens," Token");
      assumptions = `<div class="formula">P = λ × I × (1 − h)<br>L = λ × W<br>G = λ × O</div><b>适用边界：</b>无丢弃、无重试的稳定时间平均。P 是未缓存输入工作量代理，不是 FLOPs；长上下文、缓存读带宽和模型结构会改变真实成本。L 是 Little 定律关系，队列无限增长时不能用它宣称存在稳定容量。固定 W 不表示它不会随过载变化。${refs(["S14","S23","S24"],"机制背景")}`;
    } else if (selectedLab === "retry") {
      title = "重试怎样反过来加重故障";
      controls = slider("rps","原始业务请求率 λ",10,300,10,v.rps," req/s")
        + slider("failure","每次尝试失败概率 p",0,100,1,v.failure,"%")
        + slider("retries","单层最多额外重试 r",0,4,1,v.retries," 次")
        + slider("layers","存在重试的层数 m",1,3,1,v.layers," 层");
      assumptions = `<div class="formula">单层 E[尝试数] = Σ(k=0..r) p^k<br>单层成功概率 = 1 − p^(r+1)<br>多层最坏尝试数 = (r + 1)^m</div><b>适用边界：</b>期望值仅用独立、同分布失败的单层教学模型；多层显示的是最坏次数，不冒充同一概率下的期望值。生产过载失败相关，p 会随尝试量上升，因此通常更危险。内容已可见或动作可能提交后，数学上“再试”不代表业务上安全。${refs(["S25","S13","S15"])}`;
    } else {
      title = "损失一个完整实例以后";
      controls = slider("instances","完整可服务实例 N",1,12,1,v.instances," 个")
        + slider("perInstance","每实例同分布 goodput C",10,200,10,v.perInstance," req/s")
        + slider("load","业务到达 λ",10,1200,10,v.load," req/s")
        + slider("target","目标利用上限 u",50,90,1,v.target,"%")
        + slider("warmSeconds","故障实例恢复耗时 T",30,600,30,v.warmSeconds," s");
      assumptions = `<div class="formula">故障后规划预算 = (N − 1) × C × u<br>安全条件：λ ≤ (N − 1) × C × u<br>未限流积压 B ≈ max(λ − (N − 1)C, 0) × T</div><b>适用边界：</b>C 必须来自约定长度分布、缓存状态和 SLO 下的持续实测 goodput；实例必须是完整可服务组。u 是你选择的规划余量，不是 DeepSeek 参数。积压是假设处理率恒定、未限流的粗估；共享故障、冷缓存、网络竞争会让线性模型偏乐观。${refs(["S02","S25"],"约束依据")}`;
    }
    $("#lab-panel").innerHTML = `<div class="lab-grid"><div class="lab-controls"><h3>${title}</h3>${controls}</div><div class="lab-result" id="lab-result" aria-live="polite"></div></div><div class="lab-assumptions">${assumptions}</div>`;
    syncLab();
  }
  function syncLab() {
    const v = labValues[selectedLab];
    $$("[data-slider]").forEach(input => {
      const key = input.dataset.slider;
      const suffix = { hit:"%",failure:"%",target:"%",seconds:" s",warmSeconds:" s",retries:" 次",layers:" 层",instances:" 个" }[key] || (key === "inputTokens" || key === "outputTokens" ? " Token" : " req/s");
      $(`#value-${key}`).textContent = `${num(v[key])}${suffix}`;
    });
    let html;
    if (selectedLab === "workload") {
      const r = C.workload({ rps:v.rps,inputTokens:v.inputTokens,hitRate:v.hit/100,seconds:v.seconds,outputTokens:v.outputTokens });
      const baseline = v.rps * v.inputTokens * 0.1;
      const scale = r.inputTps / baseline;
      html = `<div class="lab-result-label">未缓存输入工作量 · 教学值</div><div class="lab-main-value" id="lab-main-value">${num(r.inputTps)}<small>Token/s</small></div><p class="lab-result-sub">同流量、同长度下，相对 90% 命中基线为 <b>${num(scale,2)} 倍</b>。不是 GPU 算力预测。</p><div class="lab-bars">${barRow("90% 命中基线",baseline,Math.max(baseline,r.inputTps),true,"Token/s")}${barRow("当前命中设定",r.inputTps,Math.max(baseline,r.inputTps),false,"Token/s")}</div><div class="lab-secondary"><div><b id="lab-concurrency">${num(r.concurrency)}</b><span>稳定平均在途请求 · λW</span></div><div><b>${num(r.outputTps)}</b><span>输出需求 · Token/s</span></div></div><div class="lab-verdict">试一试：命中从 90% 降至 50%，输入工作量变为 5 倍；W 从 10 秒变成 30 秒，在途数变成 3 倍。</div>`;
    } else if (selectedLab === "retry") {
      const p = v.failure/100;
      const mean = C.retryAmplification(p,v.retries,1);
      const worst = (v.retries+1) ** v.layers;
      html = `<div class="lab-result-label">单层期望尝试放大 · 独立模型</div><div class="lab-main-value" id="lab-main-value">${num(mean,3)}<small>倍</small></div><p class="lab-result-sub">原始 ${num(v.rps)} req/s → 单层约 ${num(v.rps*mean,1)} attempts/s。成功概率 ${num((1-p**(v.retries+1))*100,2)}%。</p><div class="lab-bars">${barRow("原始业务请求",v.rps,v.rps*mean,true,"req/s")}${barRow("单层尝试数",v.rps*mean,v.rps*mean,false,"attempts/s")}</div><div class="lab-secondary"><div><b id="retry-worst">${num(worst)}</b><span>${v.layers} 层最坏底层尝试 / 请求</span></div><div><b>${num(v.rps*worst)}</b><span>最坏尝试率 · 非期望值</span></div></div><div class="lab-verdict warn">重试的代价由健康资源承担。先限预算、消除多层叠加；部分输出与外部动作必须另做状态判断。</div>`;
    } else {
      const r = C.nMinusOne({instances:v.instances,perInstance:v.perInstance,load:v.load,target:v.target/100,warmSeconds:v.warmSeconds});
      const cap = Math.max(r.normalBudget,v.load,1);
      html = `<div class="lab-result-label">N−1 后规划预算 · 教学值</div><div class="lab-main-value" id="lab-main-value">${num(r.failureBudget)}<small>req/s</small></div><p class="lab-result-sub">${v.instances-1} 个完整实例 × ${num(v.perInstance)} req/s × ${v.target}% 余量设定。</p><div class="lab-bars">${barRow("正常规划预算",r.normalBudget,cap,true,"req/s")}${barRow("故障后规划预算",r.failureBudget,cap,false,"req/s")}${barRow("业务到达",v.load,cap,false,"req/s")}</div><div class="lab-secondary"><div><b>${r.margin >= 0 ? "+" : ""}${num(r.margin)}</b><span>故障后规划余量 · req/s</span></div><div><b>${num(r.backlog)}</b><span>恢复前未限流积压粗估 · 请求</span></div></div><div class="lab-verdict ${r.withinBudget ? "" : "warn"}" id="capacity-verdict">${v.instances === 1 ? "失去唯一实例后，没有可服务完整实例。" : r.withinBudget ? "在此线性假设和自选余量下满足 N−1；仍需冷缓存与真实流量验证。" : "不满足所选 N−1 规划余量。先补完整容量或降低准入，不能指望无限排队。"} ${r.backlog === 0 && !r.withinBudget ? "未超过数学硬容量不等于满足尾延迟 SLO。" : ""}</div>`;
    }
    $("#lab-result").innerHTML = html;
  }
  function renderSources(query = "") {
    const needle = query.trim().toLocaleLowerCase();
    const sources = D.sources.filter(x => [x.id,x.title,x.owner,x.scope,x.limit].join(" ").toLocaleLowerCase().includes(needle));
    $("#source-list").innerHTML = sources.length ? sources.map(x => `<details id="source-${x.id}" class="source-item"><summary><span class="source-id">${x.id}</span><div><strong>${esc(x.title)}</strong><span class="source-date">${esc(x.owner)} · ${esc(x.date)}</span></div>${tag(x.kind)}</summary><div class="source-body"><p><b>支持范围</b> · ${esc(x.scope)}</p><p><b>不能据此推断</b> · ${esc(x.limit)}</p><a class="source-url" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">阅读原始资料 ↗ ${esc(new URL(x.url).hostname)}</a></div></details>`).join("") : `<p class="empty-state">没有匹配来源，试试项目名称或编号。</p>`;
  }
  function caseText(x) {
    return `${x.id} ${x.title}\n${x.summary}\n\n${[
      ["症状",x.signals],["候选机制",x.mechanism],["判别证据",x.diagnose],
      ["先止损",x.contain],["再恢复",x.restore],["恢复验收",x.verify],["提前预防",x.prevent]
    ].map(([title,items]) => `${title}\n${items.map((s,i) => `${i+1}. ${s}`).join("\n")}`).join("\n\n")}\n\n不要这样做：${x.avoid}\n\n性质：工程推演，非 DeepSeek 真实事故或内部手册。\n${x.sources.map(id => `${id} ${D.sources.find(s=>s.id===id).url}`).join("\n")}`;
  }
  async function copyCase() {
    const text = caseText(D.cases.find(x=>x.id===selectedCase));
    const button = $("#copy-case");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else throw new Error("clipboard unavailable");
      button.textContent = "已复制完整处置卡";
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text; area.setAttribute("aria-label","待复制的处置卡");
      area.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(area); area.select();
      const ok = document.execCommand("copy"); area.remove();
      button.textContent = ok ? "已复制完整处置卡" : "可在完整文字稿中复制";
    }
  }

  renderStatic(); renderArchitecture(); renderJourney(); renderCases(); renderLab(); renderSources();
  globalThis.ResearchAtlas?.init(D,{onNode:id=>{selectedNode=id;renderArchitecture();}});
  document.addEventListener("click", event => {
    const nodeButton = event.target.closest("[data-node]");
    if (nodeButton) { selectedNode = nodeButton.dataset.node; renderArchitecture(); $(`[data-node="${selectedNode}"]`).focus({preventScroll:true}); return; }
    const scenario = event.target.closest("[data-scenario]");
    if (scenario) { selectedScenario = scenario.dataset.scenario; renderJourney(); $(`[data-scenario="${selectedScenario}"]`).focus({preventScroll:true}); return; }
    const option = event.target.closest("[data-case-option]");
    if (option) { showCase(option.dataset.caseOption,false,true); $(`[data-case-option="${selectedCase}"]`)?.focus({preventScroll:true}); return; }
    const jump = event.target.closest("[data-case]");
    if (jump) { event.preventDefault(); showCase(jump.dataset.case); return; }
    const lab = event.target.closest("[data-lab]");
    if (lab) { selectedLab=lab.dataset.lab; renderLab(); return; }
    if (event.target.closest("[data-reset]") || event.target.closest("#reset-filters")) { resetFilters(); renderCases(); return; }
    if (event.target.closest("#copy-case")) { copyCase(); return; }
    const sourceRef = event.target.closest('a.ref[href^="#source-"]');
    if (sourceRef) {
      event.preventDefault();
      $("#source-search").value = ""; renderSources();
      const source = document.getElementById(sourceRef.hash.slice(1));
      if (source) {
        source.open=true; source.scrollIntoView({behavior:"smooth",block:"start"});
        try { const u=new URL(location.href);u.hash=source.id;history.replaceState(null,"",u); } catch (_) {}
      }
    }
  });
  $("#case-search").addEventListener("input",renderCases);
  $("#symptom-filter").addEventListener("change",renderCases);
  $("#layer-filter").addEventListener("change",renderCases);
  $("#source-search").addEventListener("input",event => renderSources(event.target.value));
  $("#lab-panel").addEventListener("input",event => {
    const input=event.target.closest("[data-slider]"); if (!input) return;
    labValues[selectedLab][input.dataset.slider]=Number(input.value); syncLab();
  });
  $("#print-page").addEventListener("click",()=>window.print());
  document.addEventListener("keydown",event=>{
    if(event.key==="/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      event.preventDefault(); $("#incidents").scrollIntoView({behavior:"smooth"});$("#case-search").focus({preventScroll:true});
    }
    const tab=event.target.closest('[role="tab"]');
    if(tab && ["ArrowRight","ArrowLeft","Home","End"].includes(event.key)) {
      event.preventDefault();const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')];const index=tabs.indexOf(tab);
      const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
      tabs[next].click();
      const id=tabs[next].id;if(id) document.getElementById(id)?.focus({preventScroll:true});
    }
  });
  const observer = new IntersectionObserver(entries=>{
    const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
    if(!visible.length) return;
    const id=visible[0].target.id;
    $$("#main-nav a").forEach(a=>a.classList.toggle("active",a.hash===`#${id}`));
  },{rootMargin:"-5% 0px -65% 0px",threshold:0});
  $$("#overview, .research-section").forEach(el=>observer.observe(el));
  let printOpen = [];
  window.addEventListener("beforeprint",()=>{printOpen=$$("details").filter(x=>x.open);$$("details").forEach(x=>x.open=true);});
  window.addEventListener("afterprint",()=>{$$("details").forEach(x=>x.open=printOpen.includes(x));});
  if(location.hash.startsWith("#source-")) {
    const source=document.getElementById(location.hash.slice(1));if(source){source.open=true;requestAnimationFrame(()=>source.scrollIntoView());}
  }
  globalThis.RESEARCH_READY = true;
})();
