// RED (CW1/FAIL) — a governed workflow whose pasted preamble body was HAND-EDITED (a primitive changed)
// without regenerating the header hash. Expect: [CW1/FAIL] (self-consistency: computed body hash != the
// header's declared hash). The self-test prepends a preamble with one primitive line mutated back into a
// known bug, leaving the header's blessed hash untouched — so the mismatch fires.
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const { results } = await fanout(inputs, (t) => probe(t), { label: 'probe', idOf: (t) => t.id });
  return manifestDiff(inputs.map((t) => t.id), results.map((r) => ({ id: r.id, status: 'ok' })), { label: 'survey' });
}
