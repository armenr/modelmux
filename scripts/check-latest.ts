// `mux check-latest` — compare the OpenRouter slugs in routes.toml against
// OpenRouter's live model catalog, so you notice when a configured model has
// been renamed, removed, or superseded by a newer version.
//
// The catalog endpoint is public (no key required). Pure helpers are exported
// for hermetic testing; `run()` does the live fetch + prints a report.
import process from "node:process";
import { loadConfig } from "../src/config.ts";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export interface SlugStatus {
  alias: string;
  slug: string;
  present: boolean;
  candidates: string[]; // live ids in the same family (suggestions when stale)
}

// Family stem = everything up to the first digit, trailing separators trimmed.
// "z-ai/glm-5.2" -> "z-ai/glm"; "qwen/qwen3.7-max" -> "qwen/qwen".
export function familyStem(slug: string): string {
  return slug.replace(/\d.*$/, "").replace(/[-._/]+$/, "");
}

// Pure: classify each configured slug against the live catalog.
export function analyzeModels(
  configured: { alias: string; slug: string }[],
  liveIds: string[],
): SlugStatus[] {
  const live = new Set(liveIds);
  return configured.map(({ alias, slug }) => {
    const stem = familyStem(slug);
    const candidates = liveIds
      .filter(id => id !== slug && stem !== "" && id.startsWith(stem))
      .slice(0, 5);
    return { alias, slug, present: live.has(slug), candidates };
  });
}

// Fetch just the model ids from OpenRouter's public catalog. Injectable fetch
// for tests; throws on a non-OK response.
export async function fetchModelIds(
  fetchImpl: typeof fetch = fetch,
  url: string = OPENROUTER_MODELS_URL,
): Promise<string[]> {
  const res = await fetchImpl(url);
  if (!res.ok)
    throw new Error(`OpenRouter catalog fetch failed: HTTP ${res.status}`);
  const json = await res.json() as { data?: { id?: string }[] };
  return (json.data ?? [])
    .map(m => m.id)
    .filter((id): id is string => typeof id === "string");
}

export async function run(routesPath = "routes.toml"): Promise<number> {
  const config = loadConfig(routesPath);
  const configured = Object.entries(config.models)
    .filter(([, ref]) => ref.upstream === "openrouter")
    .map(([alias, ref]) => ({ alias, slug: ref.slug }));

  if (configured.length === 0) {
    console.log("No OpenRouter models configured in routes.toml — nothing to check.");
    return 0;
  }

  let liveIds: string[];
  try {
    liveIds = await fetchModelIds();
  }
  catch (e) {
    console.error(`[check-latest] could not reach OpenRouter: ${(e as Error).message}`);
    return 1;
  }

  if (liveIds.length === 0) {
    console.error("[check-latest] OpenRouter returned an empty/unrecognized catalog; cannot verify slugs.");
    return 1;
  }

  const rows = analyzeModels(configured, liveIds);
  let stale = 0;
  console.log(`Checked ${rows.length} OpenRouter model(s) against ${liveIds.length} live catalog entries:\n`);
  for (const r of rows) {
    if (r.present) {
      console.log(`  ✓ ${r.alias.padEnd(14)} ${r.slug}`);
    }
    else {
      stale++;
      console.log(`  ✗ ${r.alias.padEnd(14)} ${r.slug}  — not found in the live catalog`);
      if (r.candidates.length > 0)
        console.log(`      same family available: ${r.candidates.join(", ")}`);
    }
  }
  if (stale > 0) {
    console.log(`\n${stale} slug(s) look stale. Update one with:  mux set <alias> openrouter:<slug>`);
  }
  else {
    console.log("\nAll configured OpenRouter slugs exist in the live catalog.");
  }
  return stale > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await run());
}
