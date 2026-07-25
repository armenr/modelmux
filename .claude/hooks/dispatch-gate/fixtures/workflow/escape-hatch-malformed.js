// RED (CB4/FAIL + CX1/FAIL) — the escape hatch is not a rubber stamp. A `checks: all` bypass is forbidden
// (no master key — enumerate the check-ids), so the annotation is MALFORMED: the CB4 FAIL it tried to waive
// STANDS, and the malformed bypass is itself a CX1 FAIL. Expect: [CB4/FAIL, CX1/FAIL].
// fieldbook:degraded
//   checks: all
//   reason: skip the checks
//   artifact: FR-0007
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const { results } = await fanout(inputs, (t) => probe(t), { label: 'probe', idOf: (t) => t.id });
  return { done: true };
}
