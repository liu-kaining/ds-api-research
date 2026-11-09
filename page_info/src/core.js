(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ResearchCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function finite(value, name, min, max = Infinity) {
    if (!Number.isFinite(value) || value < min || value > max)
      throw new RangeError(`${name} must be between ${min} and ${max}`);
    return value;
  }
  function retryAmplification(p, retries, layers = 1) {
    finite(p, "failureRate", 0, 1);
    finite(retries, "retries", 0, 10);
    finite(layers, "layers", 1, 3);
    if (!Number.isInteger(retries) || !Number.isInteger(layers))
      throw new RangeError("retries and layers must be integers");
    let attempts = 0;
    for (let i = 0; i <= retries; i++) attempts += p ** i;
    return attempts ** layers;
  }
  function workload(input) {
    const { rps, inputTokens, hitRate, seconds, outputTokens,
      failureRate = 0, retries = 0, layers = 1 } = input;
    finite(rps, "rps", 0);
    finite(inputTokens, "inputTokens", 0);
    finite(hitRate, "hitRate", 0, 1);
    finite(seconds, "seconds", 0);
    finite(outputTokens, "outputTokens", 0);
    const amplification = retryAmplification(failureRate, retries, layers);
    const effectiveRps = rps * amplification;
    return {
      amplification, effectiveRps,
      inputTps: effectiveRps * inputTokens * (1 - hitRate),
      outputTps: effectiveRps * outputTokens,
      concurrency: effectiveRps * seconds
    };
  }
  function nMinusOne({ instances, perInstance, load, target, warmSeconds }) {
    finite(instances, "instances", 1, 100);
    if (!Number.isInteger(instances)) throw new RangeError("instances must be an integer");
    finite(perInstance, "perInstance", 0.001);
    finite(load, "load", 0);
    finite(target, "target", 0.01, 1);
    finite(warmSeconds, "warmSeconds", 0);
    const failureHardCapacity = (instances - 1) * perInstance;
    const failureBudget = failureHardCapacity * target;
    return {
      normalBudget: instances * perInstance * target,
      failureHardCapacity, failureBudget,
      margin: failureBudget - load,
      withinBudget: load <= failureBudget,
      backlog: Math.max(0, load - failureHardCapacity) * warmSeconds
    };
  }
  function filterCases(cases, { query = "", symptom = "all", layer = "all" } = {}) {
    const needle = query.trim().toLocaleLowerCase();
    return cases.filter(item => {
      if (symptom !== "all" && item.symptom !== symptom) return false;
      if (layer !== "all" && !item.layers.includes(layer)) return false;
      if (!needle) return true;
      return [item.id, item.title, item.summary, ...(item.tags || []),
        ...(item.signals || []), ...(item.mechanism || [])]
        .join(" ").toLocaleLowerCase().includes(needle);
    });
  }
  function completion({ protocol, terminal, finishReason, parsed = true }) {
    if (["insufficient_system_resource", "aborted", "content_filter"].includes(finishReason)
        || ["response.failed", "response.incomplete"].includes(terminal))
      return { state: "failed", label: "终态失败 / 策略终止" };
    const ended = protocol === "responses"
      ? terminal === "response.completed" : terminal === "[DONE]";
    if (!ended) return { state: "incomplete", label: "未证实完整结束" };
    if (!parsed) return { state: "invalid", label: "协议完成，结果不可用" };
    if (finishReason === "length") return { state: "truncated", label: "长度预算耗尽" };
    return { state: "complete", label: "协议完整；业务仍需验收" };
  }
  return { retryAmplification, workload, nMinusOne, filterCases, completion };
});
