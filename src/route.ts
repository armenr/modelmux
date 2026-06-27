import type { Config, Decision, RouteRule, Signals, WorkType } from "./types.ts";

export function route(signals: Signals, config: Config): Decision {
  for (const rule of config.routes) {
    if (matches(rule, signals, config)) {
      return decide(rule.use, ruleLabel(rule), config);
    }
  }
  return decide(config.default, "default", config);
}

function matches(rule: RouteRule, s: Signals, config: Config): boolean {
  const w = rule.when;
  if (w.tag !== undefined)
    return s.tag === w.tag;
  if (w.workType !== undefined)
    return hasWorkType(s, w.workType, config);
  if (w.anySubagent === true)
    return s.isSubagent;
  return false;
}

function hasWorkType(s: Signals, t: WorkType, config: Config): boolean {
  switch (t) {
    case "background": return s.xApp === "cli-bg";
    case "think": return s.hasThinking;
    case "longContext": return s.tokensIn > config.longContextThreshold;
    case "webSearch": return s.hasWebSearch;
  }
}

function ruleLabel(rule: RouteRule): string {
  const w = rule.when;
  if (w.tag !== undefined)
    return `tag:${w.tag}`;
  if (w.workType !== undefined)
    return `workType:${w.workType}`;
  return "anySubagent";
}

function decide(alias: string, matchedRule: string, config: Config): Decision {
  const ref = config.models[alias];
  if (!ref)
    throw new Error(`route uses unknown alias "${alias}" (not in models)`);
  return { alias, upstream: ref.upstream, model: ref.slug, matchedRule };
}
