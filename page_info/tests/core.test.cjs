const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");

test("bounded retry amplification uses attempts, and independent layers multiply", () => {
  assert.equal(core.retryAmplification(0, 3, 1), 1);
  assert.equal(core.retryAmplification(0.5, 2, 1), 1.75);
  assert.equal(core.retryAmplification(0.5, 2, 2), 3.0625);
  assert.equal(core.retryAmplification(1, 3, 1), 4);
  assert.equal(core.retryAmplification(0.9, 0, 2), 1);
  assert.throws(() => core.retryAmplification(-0.1, 2, 1), RangeError);
  assert.throws(() => core.retryAmplification(0.5, 2.5, 1), RangeError);
});

test("workload separates uncached input, generated output and steady-state concurrency", () => {
  const result = core.workload({
    rps: 10, inputTokens: 1000, hitRate: 0.8, seconds: 5,
    outputTokens: 100, failureRate: 0.5, retries: 1, layers: 1
  });
  assert.equal(result.effectiveRps, 15);
  assert.equal(result.concurrency, 75);
  assert.ok(Math.abs(result.inputTps - 3000) < 1e-8);
  assert.equal(result.outputTps, 1500);
  const cached = core.workload({
    rps: 10, inputTokens: 1000, hitRate: 1, seconds: 5,
    outputTokens: 100, failureRate: 0, retries: 0, layers: 1
  });
  assert.equal(cached.inputTps, 0);
  assert.equal(cached.outputTps, 1000);
  assert.throws(() => core.workload({ ...cached, rps: -1 }), RangeError);
});

test("N-1 uses the complete-instance failure unit and distinguishes margin from hard overload", () => {
  const safe = core.nMinusOne({
    instances: 4, perInstance: 100, load: 200, target: 0.7, warmSeconds: 120
  });
  assert.equal(safe.normalBudget, 280);
  assert.equal(safe.failureBudget, 210);
  assert.equal(safe.failureHardCapacity, 300);
  assert.equal(safe.margin, 10);
  assert.equal(safe.backlog, 0);
  assert.equal(safe.withinBudget, true);
  const overloaded = core.nMinusOne({
    instances: 2, perInstance: 100, load: 150, target: 0.7, warmSeconds: 120
  });
  assert.equal(overloaded.failureBudget, 70);
  assert.equal(overloaded.backlog, 6000);
  assert.equal(overloaded.withinBudget, false);
  const one = core.nMinusOne({
    instances: 1, perInstance: 100, load: 10, target: 0.7, warmSeconds: 60
  });
  assert.equal(one.failureBudget, 0);
  assert.equal(one.backlog, 600);
});

test("case filters compose search, symptom and component; empty query restores all", () => {
  const cases = [
    { id: "a", title: "首包慢", symptom: "latency", layers: ["prefill"], tags: ["cache"], summary: "缓存失效" },
    { id: "b", title: "流中断", symptom: "stream", layers: ["edge"], tags: ["SSE"], summary: "终止事件缺失" },
    { id: "c", title: "缓存隔离错误", symptom: "contract", layers: ["prefill", "cache"], tags: [], summary: "安全" }
  ];
  assert.deepEqual(core.filterCases(cases, { query: "CACHE" }).map(x => x.id), ["a"]);
  assert.deepEqual(core.filterCases(cases, { query: "", symptom: "latency", layer: "prefill" }).map(x => x.id), ["a"]);
  assert.deepEqual(core.filterCases(cases, { layer: "prefill" }).map(x => x.id), ["a", "c"]);
  assert.deepEqual(core.filterCases(cases, { query: "不存在" }), []);
  assert.equal(core.filterCases(cases, {}).length, 3);
});

test("completion judgment requires protocol-specific terminal semantics and resource failure is not success", () => {
  assert.equal(core.completion({ protocol: "chat", terminal: "[DONE]", finishReason: "stop", parsed: true }).state, "complete");
  assert.equal(core.completion({ protocol: "chat", terminal: "[DONE]", finishReason: "insufficient_system_resource", parsed: true }).state, "failed");
  assert.equal(core.completion({ protocol: "responses", terminal: "[DONE]", parsed: true }).state, "incomplete");
  assert.equal(core.completion({ protocol: "responses", terminal: "response.completed", parsed: true }).state, "complete");
  assert.equal(core.completion({ protocol: "responses", terminal: "response.failed", parsed: true }).state, "failed");
  assert.equal(core.completion({ protocol: "chat", terminal: "[DONE]", finishReason: "length", parsed: true }).state, "truncated");
  assert.equal(core.completion({ protocol: "chat", terminal: "[DONE]", finishReason: "stop", parsed: false }).state, "invalid");
});
