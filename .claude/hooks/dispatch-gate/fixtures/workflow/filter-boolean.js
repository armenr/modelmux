// RED (CW3/WARN) — a naked .filter(Boolean) on a fan-out result silently compacts dropped units BEFORE the
// count (contract v1 R2), so the manifest over a compacted set reads COMPLETE while units vanished. The
// Workflow tool docs recommend filter(Boolean); this fixture is the dependent-path case it must not silently
// bless. Expect: [CW3/WARN].
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const raw = await parallel(inputs.map((t) => probe(t)));
  const kept = raw.filter(Boolean);   // <-- SILENT DROP before the count — the CW3 idiom
  return manifestDiff(inputs.map((t) => t.id), kept.map((r) => ({ id: r.id, status: 'ok' })), { label: 'survey' });
}
