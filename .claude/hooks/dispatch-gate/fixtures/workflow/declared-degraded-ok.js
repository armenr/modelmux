// GREEN — declared-degraded done right (contract v1 R3(b)): a probe target is unreachable BY DESIGN, so the
// fan-out runs { degrade: true }, the manifest carries coverage INCOMPLETE, and the verdict is never
// COMPLETE/READY on partial input. Expect: no findings.
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
  stations: ['enumerate', 'probe', 'aggregate'],
  degraded: [{ edge: 'probe->aggregate', reason: 'a decommissioned host is unreachable by design' }],
};

async function run(targets) {
  const inputs = await enumerate(targets);
  // R3(b): declared-degraded fan-out — a drop is surfaced (counted), never silently vanished.
  const { results, manifest } = await fanout(inputs, (t) => probe(t),
    { degrade: true, label: 'probe', idOf: (t) => t.id });
  const rollup = aggregate(results);
  return { rollup, coverage: manifest.coverage, verdict: 'INCOMPLETE', manifest };
}
