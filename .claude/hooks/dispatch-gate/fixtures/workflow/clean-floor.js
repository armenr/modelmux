// GREEN — a clean governed survey: enumerate -> probe (dependent fan-out) -> aggregate, completeness-gated
// by fanout(), returning its own manifestDiff accounting. Expect: no findings (the gate stays silent).
// (The self-test prepends the current preamble.js; this file is the leg the author writes below it.)
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
  stations: ['enumerate', 'probe', 'aggregate'],
  edges: [
    { from: 'enumerate', to: 'probe', dependent: true },
    { from: 'probe', to: 'aggregate', dependent: true },
  ],
  degraded: [],
};

async function run(targets) {
  // @station: enumerate
  const inputs = await enumerate(targets);
  // @station: probe — dependent fan-out, completeness-gated by fanout (fails loud on any drop)
  const { results } = await fanout(inputs, (t) => probe(t), { label: 'probe', idOf: (t) => t.id });
  // @station: aggregate — roll-up over the COMPLETE probe set
  const rollup = aggregate(results);
  return manifestDiff(inputs.map((t) => t.id), results.map((r) => ({ id: r.id, status: 'ok' })), { label: 'survey' });
}
