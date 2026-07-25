// RED (CB4/FAIL) — a governed fan-out whose terminal return is a bare { done: true } with no accounting, so
// it leans on the run's status envelope (which lies both ways — contract v1 R4). CB4 confirms the CALL in
// return position (return fanout(...) / return manifestDiff(...) / return { ...manifest }); a bare object
// fails. Expect: [CB4/FAIL]. This doubles as a KNOWN-POSITIVE canary for the workflow surface.
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const { results } = await fanout(inputs, (t) => probe(t), { label: 'probe', idOf: (t) => t.id });
  return { done: true };   // <-- no self-accounting; the envelope is trusted
}
