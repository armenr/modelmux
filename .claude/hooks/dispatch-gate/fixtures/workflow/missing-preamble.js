// RED (CW1/FAIL) — a governed workflow (contract: v1) that fans out but FORGOT to paste the fail-loud
// preamble, so the primitives it calls are not present/verified. Expect: [CW1/FAIL].
// (The self-test runs this leg with NO preamble prepended — that absence is the whole point.)
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
