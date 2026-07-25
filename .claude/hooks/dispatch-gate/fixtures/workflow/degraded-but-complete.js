// RED (CX1/FAIL) — the contradiction contract v1 R3(b) forbids: the leg DECLARES a degraded/partial run
// (fanout { degrade: true }) yet its own return asserts coverage COMPLETE. You cannot degrade AND claim
// complete. Expect: [CX1/FAIL]. (Note the preamble body ALSO contains the token 'COMPLETE' by construction —
// the gate strips the preamble region first, so only the leg's own verdict is read.)
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
  degraded: [{ edge: 'probe->aggregate' }],
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const { results, manifest } = await fanout(inputs, (t) => probe(t),
    { degrade: true, label: 'probe', idOf: (t) => t.id });
  // CONFLICT: a declared-degraded run may never carry a COMPLETE verdict.
  return { results, coverage: 'COMPLETE' };
}
