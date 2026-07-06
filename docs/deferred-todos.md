# Deferred TODOs (after the first-wave implementation is built + verified)

These are intentionally NOT part of the first wave (Tasks 1–15). Tackle them only
once the first wave is done, tested, and verified working. None are blockers.

## 1. Last-known-good config fallback

**Goal:** a bad/unparseable `routes.jsonc` (bad hand-edit, or a bad `hetero set`)
should never brick the proxy — it should fall back to the last config that loaded
and validated successfully.

**What already exists (Task 3):** `watchConfig`'s hot-reload path already keeps the
last-known-good config **in memory** when a reload throws — the running proxy never
adopts a broken config and keeps serving the previous one (covered by the
"keeps previous config when a reload fails, then recovers" test).

**The gap:** persistence across restarts, and startup with an already-bad file.

**Proposed design (straightforward + robust):**
- On every *successful* `loadConfig`, write a normalized snapshot to
  `routes.last-good.json` (gitignored).
- On *startup*, if `routes.jsonc` fails to parse/validate, load the snapshot
  instead and log a loud warning (instead of refusing to start).
- The running-process case is already covered by the in-memory keep-previous.

**UX caveat to honor:** do NOT auto-overwrite the user's `routes.jsonc` on a bad
edit (that would clobber an edit-in-progress). Keep running on last-good in memory,
warn, and only *fall back* to the snapshot at startup.

**Why a snapshot file over a git-based "revert to last commit":** it doesn't depend
on the config being git-tracked or the working tree being clean, and it's a few
lines (write-on-success, read-on-failure).
