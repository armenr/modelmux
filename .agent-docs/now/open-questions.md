---
provenance: llm-reviewed
created: 2026-07-03
last-modified: 2026-07-30
tags: [current, open-questions]
related: [status, work-plan, obligations]
---

# Open questions — modelmux

> `OQ-NNN` is the single source. Reference by number. Resolve → move the item to "Recently resolved"
> with a closure reference (a commit / `ADR-NNNN` / log entry). Surface gaps loudly — an honest
> open-question beats a polished plan with a hidden assumption.

## Open

- **OQ-008** (🟡 doc-drift/carrier; surfaced 2026-07-25 by a peer's *quoted-is-still-typed* argument) —
  **Four of our five providers' model tables are FROZEN transcriptions; only OpenRouter's is derived.**
  `mux check-latest` re-derives the OpenRouter slugs against the live catalog at run time, so they
  cannot rot silently. The **Anthropic, Z.ai, Kimi and Codex** tables in `README.md` were verified by
  hand on 2026-07-25 and then frozen — and `check-latest` says so in its own output:
  *"(2 non-openrouter model(s) not checked — check-latest only verifies OpenRouter.)"*
  The gap is self-reported and nothing acts on it.
  > **Why this is a carrier problem, not a diligence one.** A hand-verified table is correct at
  > authoring time and rots the day a vendor changes a slug — which is exactly how the README came to
  > ship `gpt-5.3-codex`, a model that does not exist. Being more careful was not what fixed that;
  > probing the live endpoint was. *"A quoted doc string is still a typed literal — derived once, then
  > frozen."*
  > **PARTIALLY ADDRESSED 2026-07-25 — the date column, not the probes.** The frozen tables are not
  > wrong to be frozen: probing five providers per README build is real cost. What was missing is that
  > they did not **admit** they were frozen. All four now carry their **referent and derivation date**
  > (2 of 4 already did; GLM and Kimi were the gap), and `check-latest` now discloses **when** as well
  > as **which** — "not checked" says a claim is frozen but not how stale, and staleness is the half
  > that decides whether to trust it today. A frozen literal is not the problem; one that does not
  > admit it is frozen is. What remains open is the run-time probing below.

  > **DATA POINT 2026-07-28 — the frozen Z.ai table HELD UP, and beat the vendor's own page.**
  > With a live subscription key, all three README slugs probed **200 direct to
  > `https://api.z.ai/api/anthropic`**, each echoing its own id: `glm-5.2` · `glm-5-turbo` · `glm-4.7`.
  > Z.ai's current devpack doc names only `glm-4.7` and `glm-5.2` — so **`glm-5-turbo` works but is
  > undocumented there**, and our frozen transcription was *more* complete than the vendor page a
  > re-derivation would have consulted. That cuts against the simple reading of this OQ: the failure
  > mode is not "frozen therefore wrong" (cf. `gpt-5.3-codex`, frozen *and* wrong) — it is that a
  > frozen claim carries no way to tell which case you are in. The date column is what distinguishes
  > them, which is why the shipped half was the right half. Re-derivation date now **2026-07-28**.

  **Resolve:** extend `check-latest` to verify what it can derive per provider — Anthropic via the
  Models API (needs a key), Codex via `~/.codex/models_cache.json` (on disk, no network), Z.ai/Kimi
  likely not derivable without credentials — and have it **say which providers it could not check**
  rather than implying full coverage. Deliberately NOT done on a branch that is ready to merge; adding
  provider probes is feature scope. Relates: WU-0003, `LP-001`.

- **OQ-009** (🟠 gate integrity; surfaced 2026-07-26 triaging PR #19) — **dependabot groups MAJOR
  bumps into routine `dev-deps` updates, and a merge would disarm two gates at once.** PR #19 pairs
  `typescript ^6.0.3 → ^7.0.2` with three harmless patch/minor bumps; CI fails with
  `typescript-eslint does not support TS 7.0`. A tired reviewer merging a green-looking "dev-deps
  bump" is exactly how `lint` and `typecheck` both go dark. **Resolve:** split the group (take
  `@antfu/eslint-config`, `@commitlint/cli`, `eslint`; hold `typescript`), then add a
  `dependabot.yml` `ignore` rule for `typescript` **major** so the pairing cannot recur. Open
  sub-question: should ALL majors be split out of the dev-deps group by policy, not just TypeScript?
  Relates: `memories/this-repo-has-three-pre-commit-mechanisms-and-none-of-them-run.md`.

- **OQ-010** (🟡 mechanism debt; filed 2026-07-27 as the work item `LP-005`'s acceptance owes) —
  **Three traps documented in this repo fired again anyway; which of them can be moved from prose
  into the Bash safety gate?** `LP-005`'s rule is that a *second* firing makes the doc disproven
  evidence and buys a mechanism, not a re-wording. The operative surface already exists and is
  designed for exactly this: `.claude/hooks/pretooluse-safety-gates.sh` is registered `PreToolUse`
  on `Bash`, and its kit-owned base carries a documented **STACK-FRAGMENT INSERTION POINT** where
  repo-local rules are spliced *before* the universal ones — so this is an additive fragment, not a
  patch to a kit-owned file. Grade each candidate:
  1. **`pkill -f <pattern>` kills its own shell here** (exit 144; the harness wrapper embeds the
     command string so the pattern matches the shell running it). Bitten ≥2×. Cleanest candidate —
     a command-position-anchored `ask` with the remedy ("kill by PID") in the reason string.
  2. **`partyline read` inside a pipeline or `$( )`** — it MUTATES the cursor, so a status-shaped
     use silently consumes mail. Bitten once, but recovery depended on `room.jsonl` happening to be
     append-only (luck, not design), so cost-of-recurrence carries it. Low false-positive rate:
     match `partyline read` co-occurring with `|` or `$(`.
     > **PARTIALLY ANSWERED 2026-07-28 — the mechanism already existed and nobody had named it.**
     > `room unread --for <agent> --room <room>` is the **non-mutating** probe: measured, it prints
     > pending mail and leaves the cursor byte-for-byte unchanged. Verified with a known-positive
     > control (`LP-004`), because an empty `unread` on a drained room is the ambiguous shape:
     > rewound the cursor one message → `unread` **printed** it and did NOT advance the cursor →
     > restored, restore verified. So trap #1's remedy is cheaper than a gate — **`unread` for
     > status, `read` only to consume** — and `CLAUDE.md` currently names only `read`, which is why
     > the status-shaped use reached for the mutating verb. Fix the doc's *verb choice* first, then
     > the gate becomes defence-in-depth rather than the primary control.
     > **Sharpened later the same day:** the probe also takes **`--count`** — measured exact (0 at
     > EOF; 5 after rewinding past exactly five to-me messages) and non-mutating. So the doc edit
     > is a two-verb edit, not one: `room unread --for <agent> [--count]` for status, `partyline
     > read` bare to consume. See the `room-unread-is-the-non-mutating-probe-…` memory.
  3. **`for v in $VAR` under fish/zsh** — no word-splitting, and it printed a **false green**. This
     is the one that may *not* be cleanly mechanizable: the pattern is common and legitimate under
     `bash`, so a gate risks noise. Honest possible outcome is a **measured deferral** (an accepted
     recurrence, explicitly recorded) rather than a forced rule.
  **Resolve:** author the fragment for (1) and (2) with a non-vacuous control each — write the
  foot-gun, watch the gate fire for the right reason, restore — and either implement (3) or record
  it as a deferral with its reason. Open sub-question: does a repo-local fragment survive a
  `kit-upgrade` reconcile, or does the insertion point get rewritten? Verify before relying on it.
  Relates: `LP-005`, `LP-003` (the non-vacuity requirement), `.claude/hooks/README.md`.

- **OQ-017** (🔴 routing correctness, CONFIRMED DEFECT; surfaced 2026-07-29 by `aegis`, reproduced
  firsthand) — **`TAG_RE` is unanchored, so ANY mention of a tag *is* the tag — including the
  sentence that documents it.** `src/signals.ts:3` is `/<<route:([\w-]+)>>/i` matched against the
  whole system text, first-match-wins. Backticks, code fences and prose do not fence a regex.
  Reproduced against the live tree — four distinct failure modes, only the first of which was
  reported:
  1. **A prose-only mention routes.** `aegis`'s control arm carried no directive, only the sentence
     ``The `<<route:review>>` line above is a routing directive…`` → `tag = "review"`. Their control
     arm silently became a second GLM arm; the six-leg run was GLM-vs-GLM and would have produced a
     confident, meaningless comparison.
  2. **A prose mention BEFORE the real directive WINS — worse, and previously unreported.** Given
     `Never write <<route:control>> in your output.\n<<route:review>>\nYou are the reviewer.` the
     effective tag is **`control`**, not `review`. A *correctly tagged* agent can be routed somewhere
     else entirely by an earlier incidental mention.
  3. **`mux use` rewrites the WRONG occurrence and reports success — a silent NO-OP.** Measured on a
     scratch copy of our own `claude-control.md`: `mux use claude-control review` rewrote line 3 — the
     front-matter **`description:`** — left the real bare directive on line 9 as `control`, and printed
     *"agent claude-control now uses `<<route:review>>`"*. **Front matter is never sent to the proxy
     (proven on the wire, below), so routing does not change at all.** The command reports success and
     accomplishes nothing, while leaving the file self-contradictory: the description says `review`,
     the directive says `control`, and the agent still routes to `control`.
     > **CORRECTION 2026-07-29, same day.** This row first claimed the rewrite made the agent *"route
     > as `review`"*. That was WRONG, and wrong in the same way the billing incident was wrong: I
     > measured the artifact I had (the file on disk, fed whole into `extractSignals`) instead of the
     > artifact the system uses (`body.system` on the wire). A disk file is not a request. The defect
     > is real; the consequence I attached to it was not. Corrected against a recorded request before
     > anyone acted on it — and the wrong version had already been sent to `aegis`, who was told.
  4. **`mux tag` refuses a genuinely untagged agent** (`src/cli.ts:87`) — an agent whose only match is
     a prose mention fails with *"agent already has a `<<route:...>>` tag"*, blocking the one command
     that exists to fix it.

  > **We ship the foot-gun as the house style.** All four agent defs in `.claude/agents/` carry a bare
  > directive on its own line PLUS a backticked prose sentence naming the same alias — the exact shape
  > that bit `aegis`. They are harmless today only because both name the SAME alias; that is luck, not
  > design. `claude-control.md` also carries the tag in its front-matter `description`, which is
  > **inert** — front matter never reaches the wire — but which `mux use` will happily rewrite (#3).

  ### GROUND TRUTH — a RECORDED request, because every earlier claim here was measured off-wire

  `scripts/record-fixtures.ts` on an isolated port, driven by a real `claude -p` from a scratch cwd
  carrying only a copy of `claude-control.md` (no `CLAUDE.md`, no hooks — see the incident note below).
  Captured `03-sub-control.json`, a genuine subagent request:

  ```
  body.system = [ {type:"text", 62 chars}, {type:"text", 1937 chars} ]
    block[0] = "You are a Claude agent, built on Anthropic's Claude Agent SDK."
    block[1] = "<<route:control>>\n\nYou are a control subagent. The `<<route:control>>` tag routes …"
  ```

  Three facts, all previously ASSUMED and now MEASURED:
  - **Front matter is absent from the wire.** The `description:` string does not appear. `cli.ts:84`'s
    comment was right; the routing consequence I attached to #3 was not.
  - **The bare directive SURVIVES as its own line.** `systemToText` joins blocks with `\n`, so
    block[1] opening with `<<route:control>>\n\n` puts the tag alone on a line.
  - **Both regexes resolve to `control` on this body** — unanchored (shipped) and anchored (proposed).

  > **A SUBAGENT'S INTROSPECTION IS NOT EVIDENCE ABOUT THE WIRE.** I first asked a live `claude-control`
  > agent to report its own system prompt. It stated the bare tag had been *concatenated onto the
  > preamble with no separator* — `…official CLI for Claude.<<route:control>>`. Had I believed it, the
  > anchored regex would have looked like it matched NOTHING, and I would have "discovered" that my own
  > fix silently un-routes every tagged agent. The recorded request shows the tag on its own line, and
  > even the preamble text differs from what the agent quoted. The model produced a fluent, specific,
  > mechanistic-sounding description of a thing it cannot actually see. **Introspection is a hypothesis;
  > a recorded request is evidence.**

  **Recommended fix — anchor the directive to its own line:** `/^[ \t]*<<route:([\w-]+)>>[ \t]*$/im`,
  applied in `signals.ts` AND both `cli.ts` sites so they agree on what a directive is. **Blast radius:
  verified zero for `claude-control` ON THE WIRE**; the other three defs share the identical structural
  shape (bare directive on its own line immediately after front matter) and the preserving mechanism is
  now understood, so that is a sound inference — but it is an inference, and each owes its own recorded
  request before the ADR closes. It also gives a one-sentence rule — *the tag must be alone on its own
  line* — and makes the escape natural: to talk ABOUT a tag, put it in a sentence. **Operator's call**
  (user-visible routing semantics); rejected alternatives: last-match-wins (picks a different wrong
  answer), first-N-lines (prose in line 1 still wins), strip-code-fences (only the backticked case).
  Owes an ADR before implementation.
  Relates: `OQ-016` (same injection risk, different surface), `LP-003`, `LP-008`.

  *2026-07-29 09:16Z, `aegis` (room)*: independent confirmation from a second tree — they ran the
  matcher semantics over their own two reviewer defs mid-run and found the same **accidental** safety
  (directive happens to sit above the documenting prose; both happen to name the same alias — they
  chose neither). Their proposed ADR framing, worth adopting: *"every shipped def is currently safe by
  coincidence"* argues anchoring more strongly than "one control arm broke," because it means the next
  def written is a coin-flip. Their live `func1-split-regate` run verified routing-as-intended, no
  intervention needed.

- **OQ-018** (🔴 billing exposure, OPERATOR ACTION; surfaced 2026-07-29 while capturing a fixture) —
  **`ANTHROPIC_API_KEY` is still exported into every shell on this machine, and Claude Code itself
  prefers it over the claude.ai subscription.** Found by accident: a `claude -p` invocation died with
  *"Credit balance is too low"* and warned
  *"claude.ai connectors are disabled because ANTHROPIC_API_KEY or another auth source is set and
  **takes precedence over your claude.ai login**"*. Re-running the identical command under
  `env -u ANTHROPIC_API_KEY` succeeded on the subscription — so the variable was the cause, proven by
  a same-run control, not inferred from the warning text.
  - **Source:** `~/.config/fish/conf.d/99-custom-env.fish` — a login-shell conf.d file, so it is
    exported for *every* new shell (value never printed; 108 chars, `sk-ant-…`).
  - **NOT modelmux's doing any more.** Verified the live proxy's own environment is clean
    (`/proc/4705/environ` → 0 occurrences), and `39c5adc` already removed the substitution path.

  > **This is the billing incident's SECOND, INDEPENDENT path, and it was never closed.** `39c5adc`
  > fixed modelmux substituting the metered key. It did nothing about Claude Code preferring that same
  > key on its own — a different mechanism with the identical blast radius. The only reason this is not
  > actively billing right now is that the balance is drained, which is a symptom, not a fix. Whatever
  > `claude` process is next launched from a fresh shell inherits it.

  **Resolve — operator's call, and it is theirs alone (their shell, their key):** remove or scope the
  export (drop the line, or gate it behind a function/alias so only the tools that genuinely need a
  metered key see it), then verify with a fresh shell + a `claude -p` that reports its auth source.
  Deliberately NOT changed by me: editing a user's shell profile to remove a credential is not a repo
  change, and silently disarming their key could break whatever they set it up for.
  Relates: `OQ-013` (the incident this completes), `LP-008`.

- **OQ-012** (🟡 registry mechanics; surfaced + largely ANSWERED 2026-07-29) — **agent definitions are
  loaded at SESSION START and do not hot-reload.** Proven by direct probe: injected a unique marker
  into an already-registered agent file, spawned it, asked it to read its own system prompt →
  `MARKER ABSENT` (the fresh edit) / `TAG PRESENT` (the pre-existing tag). So neither new agent NAMES
  nor edited agent BODIES take effect mid-session; a new def needs a process restart, and a machine
  reboot is not required — `claude --resume <session-id>` preserves the transcript.
  **What remains open:** the consuming session runs from a **pre-warmed spare pool**
  (`claude bg-spare --bg-spare /tmp/cc-daemon-.../spare/*.claim.sock`). If the registry is fixed at
  *pool-spawn* time rather than *session-claim* time, a fresh claim from a stale spare could still
  miss a new def — in which case the lever is the daemon, not the session. **Resolve:** confirm the
  new agent type appears in the available list after a restart, before relying on it.
  > **INDEPENDENTLY CONFIRMED 2026-07-29 by `aegis`, via a sharper probe than mine** (room msg
  > `cd3091d5`). Mine added a marker and watched it not appear; theirs *removed* a routing-relevant
  > string and watched the behaviour persist: after stripping the prose tag from a control def, the
  > file on disk had **zero** regex matches and the running agent **still routed to GLM**. Only a
  > restart cleared it. Two consequences worth more than the mechanism itself: a def edit needs a
  > restart to take effect, and **"I fixed the file" is not evidence the fix is live — only a fresh
  > leg reading is.** That is the same class as `LP-003`'s non-vacuity rule, applied to config.

- **OQ-015** (🟠 measurement fidelity; surfaced 2026-07-29 watching a peer's GLM-vs-Opus A/B) — **a
  proxied OpenAI-format leg reports `input_tokens: 0` where a native Claude leg reports the real
  number, so any client reading usage from `message_start` sees a proxied leg as costing NOTHING —
  forever, including after it completes.** This is `OQ-006`'s accepted trade meeting a consequence
  that resolution did not anticipate. Measured live through the proxy on the review leg:
  > `message_start usage={"input_tokens": 0, "output_tokens": 0}` → 242 incremental `thinking_delta`
  > events (812 chars) → `message_delta usage={"input_tokens": 37, "output_tokens": 253}
  > stop=end_turn`. HTTP 200, first SSE event at **+4.97s**, total **6.58s**.

  `OQ-006` resolved this as *"the `message_start` placeholder stays `0/0` — that value genuinely is
  not known yet"*, which is still true and still the honest choice: the Chat Completions upstream
  does not send usage until the stream closes, and fabricating a number there would be worse. **What
  was missed is the asymmetry.** Anthropic's native API *does* report `input_tokens` in
  `message_start`. So a dashboard comparing a proxied upstream against a native one is not comparing
  a small number to a large one — it is comparing a **structural zero** to a real measurement, and
  the zero is indistinguishable from "this leg did no work." Observed in the field: a peer's
  6-agent A/B showed its three GLM legs at `0 tok` beside Opus twins at 189.7k/212.6k/205.1k, which
  reads as three dead legs. `decisions.jsonl` proved all three alive and iterating (3–5 round trips
  each, zero error rows).
  > **MEASURED 2026-07-29 — wire-level parity is IMPOSSIBLE without fabricating, and this is settled.**
  > Probed Z.ai's Chat Completions stream directly (bypassing modelmux), twice:
  > | run | chunks | first `usage` seen | usage-bearing chunks |
  > |---|---|---|---|
  > | plain stream (what we send today) | 313 | **chunk 313 of 313** (+7.43s) | 1 |
  > | `stream_options={"include_usage":true}` | 237 | **chunk 237 of 237** (+6.90s) | 1 |
  >
  > Usage arrives in the FINAL chunk and nowhere else; `include_usage` changes nothing. There is no
  > honest source of `input_tokens` at `message_start` time — the number does not exist yet, anywhere.
  > (Incidental: chunks ≈ completion tokens, 313→314 and 237→241, so a forwarded-chunk count is a ~98%
  > proxy for OUTPUT tokens — but output is the small number; the 200k the UI shows is INPUT.)

  **REJECTED — estimating `input_tokens` into `message_start`.** It is the friendliest-looking option
  and it is the trap. `usage.input_tokens` is a contractual field meaning *measured tokens as billed*;
  an estimate there is indistinguishable from a measurement to every downstream consumer, and GLM's
  tokenizer is not Claude's so the error is biased in a direction we cannot characterize. The decisive
  argument is the use case: this data exists to compare upstreams, so a fabricated GLM number beside a
  measured Opus number yields a confident, wrong cost conclusion. **A plausible wrong number is worse
  than an obvious zero** — the zero announces its own uselessness and prompts investigation; the
  estimate ends an investigation that should have happened. Same genus as `LP-008` (a green test that
  specified a defect) and the confabulating subagent in `OQ-017`.

  **Resolve — out-of-band truth, plus disclosure:**
  1. Persist per-request usage to `decisions.jsonl` at stream close. The numbers already exist (they
     populate the final `message_delta`); they are simply not recorded, so this is a write, not a new
     measurement. Gives an upstream-agnostic ledger for real cost comparison without touching the wire
     fidelity `OQ-006` preserved. `aegis` explicitly asked for this — *"once the numbers are in the log
     it becomes measurable instead of vibes."*
  2. **Disclose the zero** at startup / in `mux models` when an OpenAI-format upstream is configured.
     This is `OQ-008`'s lesson transplanted: *a frozen literal is not the problem; one that does not
     admit it is frozen is.* A structural zero is not the problem; one that does not admit it is
     structural is — it cost a peer a wrong read of their own experiment.

  **Open sub-question (needs evidence before it is attempted):** whether emitting incremental
  `message_delta` events with a running forwarded-chunk count would make the harness's counter tick
  during generation. That would be honest (counting what we actually forwarded, output only) but owes
  two verifications first — that the Anthropic stream spec permits multiple `message_delta` events,
  and that the harness reads output from there rather than only from `message_start`. Do not build it
  on the assumption. Relates: `OQ-006` (the accepted trade), `OQ-008` (disclosure), `LP-008`.

## Recently resolved

- **OQ-020** (🔴 config hot-reload silently dies; surfaced + **RESOLVED 2026-07-30**, `bf45c30`) — **ONE atomic-replace edit of `routes.toml` permanently disables hot-reload for the rest
  of the process's life, and NOTHING says so.** `watchConfig` (`config.ts:202`) calls
  `watch(path, …)`, which on Linux follows the **inode**. Almost every editor — `vim`, VS Code, and any
  tool doing a safe write, including this agent's Edit tool — writes a temp file and `rename()`s it
  over the target. The watcher is then holding an unlinked inode and never fires again.
  Measured, in this order, against the live service:
  1. In-place append (`printf >>`, same inode) → `[config] reloaded …` in the journal. **Works.**
  2. Atomic-replace edit adding the codex upstream → **no reload line.** `mux models` showed the new
     alias (the FILE was correct); a live probe showed `matchedRule: "default"` — the running proxy
     was still on the old config.
  3. In-place append again, to test whether the watcher merely missed the rename → **still no reload.**
     The watcher is not stale, it is **dead**; only a restart recovers it.

  > **The failure is silent in BOTH directions, which is what makes it dangerous.** The file on disk is
  > correct, `mux models` parses it and agrees, and the process keeps serving happily on the old config.
  > Nothing logs, warns, or exits non-zero. The only way to detect it is to route a request and read
  > `matchedRule` — i.e. the same "assert the leg, don't trust the artifact" discipline that this repo
  > keeps re-learning. I asserted "hot reload is proven, no restart needed" to a peer **on the strength
  > of test (1) alone**, then falsified it myself twenty minutes later with test (2). One passing case
  > is not a proven mechanism.

  **Resolve:** watch the *directory* rather than the file (the standard fix for rename-replace), or
  re-establish the watch after each event, or stat-poll the path as a backstop. Any of them owes the
  three-case control above — in-place edit, atomic replace, and replace-then-edit-again — because
  case (3) is the one a naive fix will still fail. Consider also logging the config's mtime/hash on
  each decision-log rotation so a stale config is visible without a probe. **Until fixed:** after ANY
  `routes.toml` edit, `systemctl --user restart modelmux.service` and **verify with a tagged probe** —
  the file being right is not evidence the proxy agrees. Relates: `OQ-012` (the same
  frozen-at-load-time shape one layer up), `LP-003`.

  **FIXED — by watching the DIRECTORY, but not naively.** Two measured surprises the obvious fix
  walks into: Bun reports an atomic replace as `rename` against the **SOURCE** name (the editor's
  `.tmp`) and NEVER the destination, so a `filename === basename` filter drops the very event this
  watch exists to catch — the first version of the fix still failed cases 2 and 3. And a directory
  watch sees the temp file vanish, which Bun raises as an **ENOENT `error` event that is FATAL if
  unhandled** — the operation this fix exists to survive would have crashed the proxy. Gating on the
  config's own mtime handles in-place, replace, and null-filename uniformly while keeping the
  decision log's per-request churn out. `ConfigHolder` gained an optional `close()`: a watcher with
  no handle cannot be released at all.
  > **The three-case control earned its keep twice.** Cases 1+2 alone would have passed a fix that
  > still failed case 3, and the suite ALSO exposed a test-harness lie of my own: arming an fs watch
  > is asynchronous, and mutating immediately beat the registration — a miss that looks exactly like
  > the defect under test. Proven RED against the inode-following watch: cases 2, 3 and the
  > broken-config recovery go red while the in-place control and the sibling guard stay green.
  > Hands-on acceptance ran the compiled binary in a real process on its own port, live service
  > untouched: two atomic replaces each reloaded, and a probe returned HTTP 200 with the upstream
  > echoing the NEW model (`tag:review -> zai-max:glm-4.7`) — the reload reaches the WIRE, not just
  > the holder.

- **OQ-019** (🟠 latent defect; surfaced + **RESOLVED 2026-07-30**, `38cd513`) — **`minMaxTokens` is incompatible with a `codexSubscription` upstream: it injects a field
  into the Responses body that the API does not define, immediately after the translator deliberately
  removed the real one.** `server.ts:68-70` applies the wire translation FIRST and the floor SECOND:
  ```ts
  applyMinMaxTokens(def, applyExtraBody(def, isResponses
    ? toResponsesRequest(body, def.codexSubscription === true) : …))
  ```
  `toResponsesRequest` deletes `max_output_tokens` under `codexSubscription` because it is a **measured
  hard 400**. `applyMinMaxTokens` then writes `def.maxTokensField`, which on the `codex` built-in is
  `"max_tokens"` — an OpenAI/Anthropic field name that Responses does not define. Reproduced with the
  exact built-in def plus `minMaxTokens: 32000`:
  ```
  outbound keys: input, instructions, max_tokens, model, store, stream
    max_output_tokens (real Responses cap) : undefined   <- correctly deleted
    max_tokens        (not a Responses field): 32000     <- injected right back
  control (same def, no minMaxTokens)      : both undefined
  ```
  Given the backend 400s on `max_output_tokens`, `temperature` AND `top_p`, an *undefined* extra field
  is very likely a fourth 400 — i.e. configuring a token floor on a Codex upstream may break **every**
  request on that leg. Not yet confirmed against the live backend (that costs a real call and the leg
  is unconfigured here); the body-shape defect is confirmed regardless.

  > **`maxTokensField` is vestigial on the responses path and that is what made this reachable.**
  > `toOpenAIRequest` takes it as a parameter; `toResponsesRequest` ignores it and hardcodes
  > `max_output_tokens`. So the `codex` built-in carries `maxTokensField: "max_tokens"` that nothing on
  > its own path reads — until `applyMinMaxTokens`, which reads it for every format. A field that is
  > inert on the path it is declared for is a trap waiting for the first cross-cutting consumer.
  > (Standing rule: *a dead field is a symptom, not a nit* — here the symptom is a missing format
  > check, and the fix is NOT to delete the field.)

  **Resolve:** make `applyMinMaxTokens` format-aware — no-op (or write `max_output_tokens`) on
  `format: "responses"`, and refuse outright under `codexSubscription`, where any cap is a 400. A
  config-time validation error beats a silent per-request 400. Owes a falsifier per branch.
  **Interim, for anyone wiring a Codex upstream: do NOT set `minMaxTokens` on it.**
  Relates: `OQ-015`, ADR-0003, `WU-0003`.

  **FIXED** — `applyMinMaxTokens` is format-aware via a new `capFieldFor`, and no-ops entirely under
  `codexSubscription` where no cap can be honoured; `loadConfig` REFUSES the pairing outright rather
  than accepting a setting it cannot keep. 9 falsifiers, proven RED on the unmodified behaviour
  (4 fail / 5 pass — the 5 are the regression controls that must not move), restored and blob-hash
  verified. The compiled binary accepts the live config and rejects the bad pairing with an
  actionable message.

- **OQ-016** (🟠 design decision, operator-gated; surfaced 2026-07-29, **RESOLVED 2026-07-29** by
  `aegis`'s two-arm measurement — room msg `cd3091d5`) — *should the `<<route:>>` scan widen beyond
  `body.system`, so dynamically-spawned agents can be tagged?* **Answer: no change needed.**
  > **Filed for one day as a DUPLICATE `OQ-011`** (that number already belonged to the resolved
  > `--version` silent-success question). Renumbered here on closure; older references to "`OQ-011`
  > the tag-scan question" in `handoff.md` / `obligations.md` / `log.md` mean this entry.

  `aegis` ran both halves in one session with a same-run control each:
  - **Dynamic (Workflow `agent()` inline prompt):** tagged leg `default -> anthropic:passthrough`
    (`ab7eaa56d3d4d22bd`), untagged control identical (`a27a345c3a9307b56`). Both legs genuinely ran
    (~49k tokensIn each, so the prompt travelled) — **identical outcome tagged vs untagged, so the
    tag made no difference.** The control is what makes that a measurement rather than an absence.
  - **File-based agent def:** `glm-reviewer -> tag:review -> zai-max:glm-5.2` (`a678f596a78621805`)
    vs `opus-reviewer -> default -> anthropic:passthrough` (`a04918861e5ac922a`) — same second,
    byte-identical prompts except the two tag lines.

  Corroborated independently from this side: **261 `tag:review` decisions all-time, 16 since the
  09:00:06Z boot, zero error rows.** The file-based path is proven at production prompt size.
  **Closed with NO code change.** The widen option is deliberately NOT taken — and the injection cost
  I described as "bounded but real" is no longer theoretical: it FIRED, via a surface I had not
  predicted (an agent's own documentation rather than reviewed content). See **`OQ-017`** — that
  finding is the strongest argument on record for leaving the scan where it is.

- **OQ-013** (🔴 BILLING INCIDENT; surfaced + **RESOLVED 2026-07-29**, `39c5adc`) — *`passthrough`
  silently substituted a METERED key for a SUBSCRIPTION credential.* `applyAuth`'s passthrough branch
  preferred `auth.envKey` and **returned before ever reading the inbound headers**. The `anthropic`
  built-in carried `envKey: "ANTHROPIC_API_KEY"`, so on any machine with that variable exported —
  common, usually for unrelated reasons — Claude Code's subscription OAuth was replaced on **every**
  request through the default upstream. **93 orchestrator requests, ~15.2M input tokens**, billed to
  the operator's metered account before a drained balance surfaced it.
  > **The tell was visible for hours and misread.** The very first proxy probe sent **no credentials
  > at all** and returned **200 with a real completion**. That was logged, written up as "where the
  > auth came from", and filed as trivia. A 200 answered to a credential-less request means something
  > else paid.
  > **ROOT CAUSE, and it is the durable half:** a test named *"anthropic leg PREFERS env
  > ANTHROPIC_API_KEY as x-api-key"* had **SPECIFIED** the defect and kept it green. Every gate —
  > lint, typecheck, 194 tests, CI — passed over a billing redirect because an assertion said it was
  > correct. **A guard aimed at the wrong proposition is worse than no guard.** That test is inverted
  > in place with its original name preserved in a comment so the history stays legible.
  **Fix:** passthrough forwards the caller's credential or sends NOTHING — a missing credential is a
  loud 401, never a silent bill. Opt-in remains via `auth = "bearer:ANTHROPIC_API_KEY"`. 6 falsifiers
  plus the inverted test; non-vacuity proven (restoring the bug turns 5 red). Docs corrected in
  `84f6aa4` — `docs/development.md` and `SECURITY.md` both still described the old behaviour.

- **OQ-014** (🟢 capability; **RESOLVED 2026-07-29**, `a3bdbe7` + `66399b9`) — *impose max reasoning
  depth on GLM reviewers.* Three pieces, none sufficient alone: **`extraBody`** (vendor fields merged
  into the OUTBOUND body *after* wire-format translation — `toOpenAIRequest` builds a fresh object, so
  earlier injection is discarded), **`chatPath`** (found by a 404: the base already carries its
  version, so the derived `/v1/chat/completions` doubled it), and **`reasoning_content` → Anthropic
  `thinking` blocks** in both response paths (streaming needed block indices ALLOCATED rather than
  hardcoded at 0). Plus **`minMaxTokens`**, a RAISE-ONLY floor — deliberately not `extraBody`, which
  overwrites and would have CLAMPED a generous caller.
  > **The endpoint choice is load-bearing and was measured, not read off the docs:**
  > `/api/anthropic` (subscription) **silently drops** `reasoning_effort` — 200 on a deliberately
  > invalid value, while `thinking.type` IS parsed, so it reads what it knows and discards the rest.
  > `/api/paas/v4` validates it but is **METERED** — *"Insufficient balance"* on a Coding Plan key.
  > `/api/coding/paas/v4` is **subscription AND validates it**. Building from the docs alone would
  > have pointed reviewers at the metered endpoint.
  > **Effort is real:** `minimal` → 0 reasoning chars, `max` → 5730 on an identical prompt. End to end
  > through the proxy at max: **37,537 chars of thinking + an answer, `stop_reason: end_turn`**.
  > **The hazard it created, also measured:** a cap hit mid-reasoning returns a `thinking` block with
  > NO `text` block — the reasoning is billed and no answer arrives, and it does not *look* truncated.
  > `max_tokens` 6000 → truncated, no verdict; 24000 → 19,322 used, clean stop. A cap is a CEILING not
  > a reservation (98304 → 3 tokens), so erring high is free. Hence the 32000 floor.

- **OQ-011** (🟠 silent success; surfaced + **RESOLVED 2026-07-28**) — *`modelmux --version` printed the
  usage banner and **exited 0**.* Two defects on one line: no way to learn which version was installed,
  and **every unrecognised command reported SUCCESS**, so a typo in a script exited clean and the script
  carried on as though the command had run. Fixed: a `version` verb (aliases `--version`/`-v`) reporting
  `package.json`'s version — **derived, never transcribed**, since release-please owns that number — plus
  a `help` verb (`--help`/`-h`), and an unrecognised command now prints to **stderr** and exits **1**.
  Both new verbs went through the existing `dispatch → USAGE → README` carrier, which **failed the test
  suite until README documented them** — the mechanism working as designed.
  > **The compiled binary found a defect 169 green tests did not.** `version` still bootstrapped a
  > `routes.toml` into the cwd, because `main.ts` writes the default config *before* dispatch. Asking a
  > binary its version is not consent to write a config file. Fixed with `needsConfig()`, whose verb set
  > is **derived from `USAGE`** so a new verb is config-consuming by default and an unrecognised one is
  > absent by construction — a typo no longer litters either. Verified per-verb in isolated clean dirs
  > against `dist/modelmux`; `models` still bootstraps (the control).
  > **Four guards, each watched fail:** reverting the exit-1 → 4 red · hand-typing `VERSION` → 1 red ·
  > `needsConfig` always-true → 8 red · removing `bin/mux`'s `serve` interception → 1 red; each
  > restored and **blob-hash verified**.
  >
  > **INDEPENDENT REVIEW (reviewer ≠ builder) found a regression I introduced, and a false number.**
  > All five findings dispositioned:
  > 1. **`serve` regression — FIXED.** `USAGE` advertises `serve`; `runCli` deliberately does not handle
  >    it (the proxy is long-running, `runCli` returns an exit code, so a branch there would let
  >    `main.ts`'s `process.exit(code)` kill the server it just started) — interception is the
  >    *entrypoint's* job, and **`bin/mux` never did it**. Pre-change `mux serve` printed usage and
  >    exited 0: a silent no-op advertising a verb. My exit-1 change turned that into a hard error.
  >    Fixed at the root — `bin/mux` now mirrors `main.ts` and actually serves; verified listening.
  > 2. **The "169 tests" baseline was WRONG — FIXED.** The real parent (`1089d2e`) baseline is **156**,
  >    re-derived twice by the reviewer in an isolated clone and once by me. 169 was an intermediate
  >    figure I measured mid-change and then reported as the *before*. 156 → 189 is the true delta.
  > 3. **`FLAG_ALIASES` invisible to the docs carrier — FIXED.** `cli-docs.test.ts` derives handled
  >    verbs from `cmd === "…"` literals and is structurally blind to the alias table, so an alias
  >    could point at an unadvertised verb undetected. Now guarded.
  > 4. **Bare-invocation claim was imprecise — FIXED.** True for `runCli([])`/`bin/mux`; the *compiled
  >    binary* with no args starts the proxy (by design, unchanged). The claim now says which.
  > 5. **"failed the build" was loose — FIXED.** The gate that failed was the **test suite**, not
  >    `bun run build`.

- **NOT AN OQ — the "off-main `v0.5.1` tag" was MY STALE CLONE.** Reported earlier this session as a
  release-process defect (`main`'s `package.json` reading `0.5.0` against a `v0.5.1` tag). It was not.
  `d561cd9 chore(main): release 0.5.1 (#18)` **is on `origin/main`** and `origin/main:package.json`
  reads `0.5.1`. My local `main` was **6 ahead / 1 behind** — six local doc commits stacked on the stale
  base `8b989bb`, with the release commit never pulled. Rebased (no overlapping files, clean); gates
  re-verified green afterwards. **The error was reading local state as repo state without fetching** —
  `/orient`'s trust-the-code rule assumes the code you are looking at is the *current* code, and a
  diagnosis of a shared system from an unfetched clone is a claim about your disk, not the repo.

- **OQ-007** — *the cited IMPL→WIRED oracle had never run.* → **RESOLVED 2026-07-25.** `knip@6.29.0`
  added as a devDependency (currency-checked against the npm registry: published 2026-01-22, actively
  maintained, first-class Bun plugin; `ts-prune` rejected as stalled since 2021). `knip.json` declares
  the **production** entrypoints — `src/main.ts`, `bin/mux`, `scripts/record-fixtures.ts` — and
  deliberately **excludes tests**. Wired as `bun run reachability` (~169 ms), into the `check` script
  and into CI.
  > **The vacuity trap, and why the config looks the way it does.** Every `src/*.ts` here has a test
  > that imports it. Admitting tests as entrypoints makes the whole tree look reachable and the oracle
  > reports clean *forever* — coverage-shaped output that checks nothing. **Derived, not assumed:** a
  > module imported only by a test is flagged (`rc=1`) with tests excluded, and goes **silent**
  > (`rc=0`) the moment tests are added to `entry`. `test/reachability-config.test.ts` is the standing
  > guard on that, and is itself non-vacuous (widen `entry` → it goes red).
  > **Non-vacuity proven twice**, before and after the config was edited — a config change is exactly
  > how an oracle silently disarms.
  >
  > **And knip alone was not enough.** Measured: it exits **0 over a population of ZERO** — point
  > `project` at a glob matching no files and it emits a hint and still returns success, which is
  > byte-identical to a clean tree. The config guard could not see it either (the config was
  > well-formed). `scripts/reachability.ts` wraps knip to supply the term it cannot: it **prints the
  > population** rather than implying it, **verifies every entrypoint exists** on disk, and **floors
  > the population** at 10 files — exiting **2** (distinct from knip's 1) when the check itself cannot
  > be trusted. Three controls, three distinct codes: planted orphan → **1**, empty population → **2**,
  > renamed-away entrypoint → **2**, healthy → **0**.

  **It found a real defect on its first run.** `forwardUrl` was exported, unit-tested, and **never
  called** — `src/server.ts` duplicated its logic inline, so the one tested URL-builder was not the one
  production ran. Now wired: breaking `forwardUrl` fails **6 tests including integration tests**, where
  before it would have failed only the unit test of dead code. Per the standing rule, the dead export
  was a *symptom* (duplication) and the fix was the missing call, not a deletion.

- **OQ-003** — *machine-specific partyline paths in the public `CLAUDE.md`.* → **RESOLVED 2026-07-25,
  operator's call from four options: strip-and-skip-worktree.** The committed `CLAUDE.md` now carries
  ONLY the portable Fieldbook constitution (`kit:start`/`kit:end`); the machine-specific
  `partyline:begin`/`end` block is gone from git. The local file keeps its block unchanged and is held
  out of git with `git update-index --skip-worktree CLAUDE.md`, because `partyline wire` writes only to
  `CLAUDE.md` and has no alternate-target flag. Verified: `git status` clean · local file has the block
  and 4 machine paths · committed version has **0** of either and still carries the kit block.
  > **⚠️ The gotcha this creates, recorded so it is not rediscovered the hard way.** `skip-worktree` is
  > **per-clone local state**, not committed. Two consequences: (a) a fresh clone does NOT have it, so
  > re-running `partyline wire` there makes `CLAUDE.md` show as modified until the bit is set again;
  > (b) a **kit upgrade that edits `CLAUDE.md` will fail or behave confusingly** while the bit is set —
  > `git update-index --no-skip-worktree CLAUDE.md`, take the upgrade, re-strip, re-set. That is the
  > accepted cost of the chosen option, not a defect.

- **OQ-002** — *Codex credential is read but never refreshed.* → **RESOLVED 2026-07-25 by option (b).**
  modelmux now detects a `401`/`403` **from a `codex`-auth upstream specifically** and fails loud with
  the actual remedy — "the token in `~/.codex/auth.json` has most likely expired; re-run `codex login`,
  no restart needed" — instead of forwarding an opaque provider 401. Scoped to the codex auth kind on
  purpose: any other upstream's 401 means a wrong API key, which is a different fix. Option (a)
  (redeeming the refresh token ourselves) is **deliberately NOT done**, and the reason is sharper than
  the original one: *the test IS the dangerous act.* Establishing whether the refresh token rotates
  requires redeeming it, and if it does, that one redemption invalidates the copy in `auth.json` and
  breaks the operator's own `codex` CLI. There is no read-only probe, so (a) needs vendor documentation
  or a throwaway account — never an experiment on a working login.
- **OQ-005** — *sync `readFileSync` on the request path.* → **RESOLVED 2026-07-25: ACCEPTED, measured.**
  **0.002 ms/call** over 2,000 warm reads — **0.0001%** of a ~1.4 s Codex round trip. Going async would
  make `applyAuth`/`rewriteHeaders` async and ripple through the whole call chain for ~2 µs, and adding
  a cache would *weaken* the per-request pickup of a CLI-refreshed token that `OQ-002`'s answer depends
  on. Recorded as a measured trade, not an assumed-fine.
- **OQ-006** — *streamed `message_start` reports `input_tokens: 0`.* → **RESOLVED 2026-07-25.** Both
  stream translators now capture input usage when it arrives (at the END of the stream, long after
  `message_start` had to claim a number) and report it in the final `message_delta`. Live-verified
  against the real Codex backend: `{"input_tokens":15,"output_tokens":5}` where it previously read 0.
  The `message_start` placeholder stays `0/0` — that value genuinely is not known yet.

- **OQ-001** — *Is the Codex auth pair actually ACCEPTED?* → **RESOLVED 2026-07-25: YES.** The endpoint
  recovered and a direct probe returned **HTTP 400 `The 'gpt-5.3-codex' model is not supported`** — a
  *model* complaint, which means the request got **past authentication**. Confirmed end-to-end at 200
  through modelmux. Two bonus measurements that contradict prior belief: **neither `ChatGPT-Account-ID`
  nor `OpenAI-Beta` is required** — both omitted still return 200 on a single-account login (the code
  comment claiming the account header was load-bearing was FALSE and is corrected in place).
- **OQ-004** — *The Responses adapter has never run against a real Responses backend.* → **RESOLVED
  2026-07-25.** Field-tested live end-to-end: non-streaming, streaming, tool call, tool-result round
  trip, and streaming tool-call JSON-fragment reassembly, all 200. Leg proven via `decisions.jsonl`:
  **6/6 requests `upstream=codex`, zero anthropic.** It found **five** real defects the unit tests could
  not — see `log.md` and ADR-0003 §Consequences.

- **(unnumbered)** — *Does modelmux need a second process (LiteLLM) in front of OpenAI-format
  backends?* → RESOLVED 2026-07-25 by `03bcc2e`: no. The Chat Completions adapter is native, and the
  README's "run LiteLLM" advice for local runners is superseded. The operator's challenge — "modelmux
  is fully self-contained… are we not expecting users to have a second tool?" — is what surfaced it.
- **(unnumbered)** — *Was the Kimi `k3-256k` slug the large-context option?* → RESOLVED 2026-07-25,
  **no, backwards**: K3 is a 1,048,576-token model and `k3-256k` is the CAPPED variant; on Kimi Code
  the usable window is tiered by plan. Corrected in README + `routes.toml` before merge, after the
  operator questioned it.
- **(unnumbered)** — *Is the Codex token expired, explaining the failures?* → RESOLVED 2026-07-25, no:
  `access_token` valid until 2026-07-28; only the `id_token` (identity claims, not used for API auth)
  had expired. Hypothesis eliminated; `OQ-001` later confirmed the auth pair is accepted outright.
