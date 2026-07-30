---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [log, journal]
---

# Operational log — modelmux

<!-- THE one canonical operational journal. It lives HERE, at the `.agent-docs/` root (not under
     `now/`, not per-directory). There is exactly one log; append to it, never fork it.

     Append-only. NEWEST ENTRY AT THE TOP (directly under this note). One entry per session or
     operation. Keep the heading grep-parseable:

         ## YYYY-MM-DD | <op / session label> — <one-line summary>
         <a short paragraph: what happened, the commits, what's next.>

     A rejected lesson proposal logs its one-line reason here (see now/lessons/proposals.md). -->

## 2026-07-30 | change — the codex/GPT upstream is WIRED and verified end to end

Operator-authorized. `routes.toml` gains `{ tag = "build" } -> builder = "codex:gpt-5.6-sol"`, no
`minMaxTokens` (per `OQ-019`). Slug DERIVED from `~/.codex/models_cache.json` — priority 1,
`supported_in_api`, "Latest frontier agentic coding model" — never transcribed from our README, which
still ships the nonexistent `gpt-5.3-codex`. Verified with a live probe: HTTP 200, `model: gpt-5.6-sol`,
`stop_reason: end_turn`, `usage {input_tokens: 33, output_tokens: 17}`, and
`matchedRule: "tag:build" -> codex:gpt-5.6-sol` in the decision log. Review leg regression-checked in the
same pass, unaffected. Two things worth carrying: the Responses adapter reports REAL input tokens where
the Chat-Completions leg reports a structural zero (`OQ-015`), and it **drops reasoning items entirely**
(`responses.ts:199`, `:301`) — no thinking blocks come back from codex, unlike the GLM leg.

## 2026-07-30 | finding — `OQ-020`: one atomic-replace edit permanently kills config hot-reload

And I asserted the opposite to a peer first, from ONE passing case. `watchConfig` uses `watch(path)`,
which follows the inode; every safe-writing editor does temp-file + rename, so the watcher ends up on an
unlinked inode and never fires again. Measured in three steps: in-place append → reloads; atomic-replace
edit → NO reload (file correct, `mux models` agreed, live probe returned `matchedRule: "default"`);
in-place append again → still nothing, so the watcher is DEAD, not stale. Silent in both directions —
correct file, agreeing CLI, proxy serving stale config, no warning anywhere. Detected only by routing a
request and reading `matchedRule`. Restarted in a verified-empty window (zero Z.ai connections, zero
genuine hex-id subagent decisions in 20 min) so it could not land on the peer's work. The lesson is the
one this repo keeps paying for: **one passing case is not a proven mechanism**, and the artifact being
right is not evidence the running system agrees.

## 2026-07-30 | finding — `OQ-019`: `minMaxTokens` breaks a Codex upstream's request body

Answering `aegis` on routing a BUILDER at the Codex leg. `server.ts:68-70` applies the wire translation
FIRST and the token floor SECOND, so on a `codexSubscription` upstream `toResponsesRequest` deletes
`max_output_tokens` (a measured hard 400) and `applyMinMaxTokens` immediately writes
`def.maxTokensField` — `"max_tokens"` on the codex built-in, which the Responses API does not define.
Reproduced with a control: floor set → `max_tokens: 32000` in a Responses body; floor removed → both
cap fields absent. The backend already 400s on three stripped params, so a token floor may break EVERY
request on that leg. Reachable because `maxTokensField` is VESTIGIAL on the responses path
(`toResponsesRequest` ignores it and hardcodes `max_output_tokens`) while `applyMinMaxTokens` reads it
for every format — a field inert on its own path, waiting for the first cross-cutting consumer. Per the
standing rule the fix is the missing format check, NOT deleting the field.

## 2026-07-30 | memory — the Codex leg's capabilities and limits, derived not recalled

For the record, all measured today rather than read off our own docs: `codex` is built into the binary
(`format: "responses"`, `auth: {kind:"codex"}`, `codexSubscription`, `stripBeta`) but is **not
configured** in the live `routes.toml` — no alias exists to tag. Auth is the operator's ChatGPT
subscription, not a metered key (`auth_mode: "chatgpt"`, no `OPENAI_API_KEY`, `access_token` valid to
2026-08-08 — which cleared a stale tripwire claiming it expired 07-28). Tool translation is real and
bidirectional (`tool_result`→`function_call_output` keyed on `call_id`, streamed argument fragments →
`input_json_delta`, `stop_reason: "tool_use"`), and a SINGLE round trip is proven live per `OQ-004`;
MANY-turn tool calling across long-running commands is **unproven by anyone**, which is the honest
answer to give. Real model slugs came from `~/.codex/models_cache.json` (on disk, no network):
`gpt-5.6-{terra,sol,luna}`, `gpt-5.5`, `gpt-5.4{,-mini}`, `gpt-5.3-codex-spark`, `codex-auto-review`.
`gpt-5.3-codex` is ABSENT — independently confirming `OQ-008`'s README defect from a second source.

## 2026-07-30 | ops — a room reply was BLOCKED by the operator's cooldown, and not forced

Composed a five-part answer to `aegis`'s Codex questions carrying genuinely new information (the
`OQ-019` defect that would have broken their build leg, derived model slugs, and the correction that
rotating `ANTHROPIC_API_KEY` does not fix `OQ-018` — the export's PRECEDENCE is the defect, not the
value). The ping-pong breaker rejected it: the operator had posted a cooldown after six consecutive
modelmux<->aegis messages. `--force` exists and was deliberately NOT used — routing around an explicit
operator gate is the self-authorization the standing rules forbid, and "I had genuinely new
information" is exactly the justification that rule anticipates. Draft held at
`$CLAUDE_JOB_DIR/tmp/msg-aegis-4.txt`; the findings themselves are on disk regardless, which is the
point of filing them there rather than in a message.

## 2026-07-29 | correction — I filed a routing consequence measured off the WRONG ARTIFACT

`OQ-017` first claimed `mux use` rewriting an agent's front-matter description made it "route as
`review`". False. Front matter is never sent to the proxy — proven by recording a real subagent request
(`scripts/record-fixtures.ts`, isolated port, scratch cwd): `body.system` is a 2-block array, block[0]
the Agent SDK preamble, block[1] the agent BODY opening `<<route:control>>\n\n`, and the description
string is absent entirely. The CLI defect is real but it is a silent NO-OP, not a silent hijack.
Root cause of MY error is the same one that produced the billing incident: I measured the file on disk
(fed whole into `extractSignals`) instead of the request on the wire. A disk file is not a request.
Corrected in the OQ and sent to `aegis`, who had already received the wrong version.

## 2026-07-29 | memory — an agent's introspection about its own system prompt CONFABULATES

Before recording anything I asked a live `claude-control` agent to report its own system prompt. It
answered fluently and specifically that the bare tag had been concatenated onto the preamble with no
separator, and that the standalone-line occurrence was NOT present. Believing it would have forced a
catastrophic conclusion — that an own-line anchor matches nothing, i.e. that my own proposed fix
un-routes every tagged agent on the machine. The recorded request shows the tag alone on its own line;
the agent also misquoted the preamble it claimed to be reading. An agent cannot see the wire: its
report is a hypothesis, and the most convincing possible form of an unbacked claim. Record the request.

## 2026-07-29 | finding — `OQ-018`: the billing incident had a SECOND path, still open

`ANTHROPIC_API_KEY` is exported into every shell from `~/.config/fish/conf.d/99-custom-env.fish`, and
Claude Code prefers it over the claude.ai subscription — the CLI says so itself. A `claude -p` died on
"Credit balance is too low"; the identical command under `env -u ANTHROPIC_API_KEY` succeeded on the
subscription, so the variable is the cause by same-run control rather than by reading the warning.
`39c5adc` closed modelmux's substitution path and did nothing about this one — a different mechanism,
identical blast radius, currently inert only because the balance is drained. Operator's call; not a
repo change and not mine to make.

## 2026-07-29 | memory — `claude -p` in this repo becomes a SECOND VOICE for this agent name

Headless is not context-free: project context resolves off cwd, so a `claude -p` run from the repo root
inherited `CLAUDE.md`, the SessionStart hook and the partyline block. It ignored its actual instruction,
consumed room mail with the cursor-advancing verb, edited `.agent-docs/`, and killed the primary's
monitor twice (exit 144). Verified firsthand that it did NOT post to the room — `room.jsonl` checked
directly, not taken from its self-report. Mail survived only because the primary had already read it.
Fix: run probes from a `mktemp -d` cwd holding only the agent def they need. Filed as a memory; note the
one-voice rule addresses *subagents* and a `claude -p` is not one, which is the gap that let it through.

## 2026-07-29 | decision — the tag-scan question closes with NO code change (now `OQ-016`)

`aegis` delivered both halves of the leg measurement with a same-run control each: a Workflow
`agent()` inline prompt does NOT carry the tag (tagged and untagged legs landed identically on
`default -> anthropic:passthrough`, both genuinely running at ~49k tokensIn, so the prompt travelled
and the tag simply made no difference), while a file-based agent def DOES
(`glm-reviewer -> tag:review -> zai-max:glm-5.2` against `opus-reviewer -> default`, byte-identical
prompts except the two tag lines). Corroborated here: 261 `tag:review` decisions all-time, 16 since
the 09:00:06Z boot, zero errors. The widen-the-scan option is deliberately not taken. Filed for one
day as a duplicate `OQ-011`; renumbered `OQ-016` on closure, which cleared the ID collision.

## 2026-07-29 | finding — `OQ-017`: our tag matcher cannot tell a directive from a sentence about one

`aegis` lost a six-leg run to it and reported one failure mode; reproducing it firsthand against the
live tree found FOUR. `TAG_RE` (`src/signals.ts:3`) is unanchored and first-match-wins over the whole
system text, so backticks, code fences and prose do not fence it. Worst two, neither reported: a prose
mention placed BEFORE a real directive OVERRIDES it (`<<route:control>>` in a sentence beats a bare
`<<route:review>>` two lines down), and `mux use` rewrites the wrong occurrence while PRINTING SUCCESS
— measured on a scratch copy of our own `claude-control.md`, it rewrote the front-matter `description:`
and left the real directive untouched, producing a file that says `control` to a human and routes as
`review`. All four of our shipped agent defs carry the exact shape that bit them; they are safe today
only because the prose names the same alias, which is luck. Recommended fix is line-anchoring, measured
blast radius zero. Operator-gated — it is user-visible routing semantics — and owes an ADR first.

## 2026-07-29 | finding — `OQ-015`: a proxied leg reports a STRUCTURAL ZERO for input tokens

Watching a peer's GLM-vs-Opus A/B, their three GLM legs read `0 tok` beside Opus twins at ~200k, which
reads as three dead legs. `decisions.jsonl` proved all three alive and iterating (3-5 round trips each,
zero errors). The zero is ours: `message_start` reports `input_tokens: 0` because the Chat Completions
upstream sends no usage until the stream closes — `OQ-006`'s accepted and still-correct trade. What
that resolution missed is the asymmetry: Anthropic's native API DOES report input there, so a dashboard
comparing the two is measuring a structural zero against a real number, not small against big. Fix is a
write, not a new measurement: persist per-request usage to `decisions.jsonl` at stream close. Peer
confirmed they want it, but not blocking this run.

## 2026-07-29 | handoff | a billing incident we caused, fixed; GLM max-reasoning shipped

Session end. `main` at `66399b9`, clean, **0 ahead** — 5 commits pushed. Release PR **#20 is `0.6.0`**
and correct (2 `feat:` + 1 `fix:` → minor; it self-corrected from an earlier `0.5.2` title). Gates:
lint/typecheck/reachability/build rc=0, **213 tests**, doc-lint clean over 48 files. Installed binary
`sha256`-compared equal to a fresh build of HEAD. `modelmux.service` is a systemd user unit, enabled,
**verified across a real reboot**.

**THE INCIDENT.** `anthropic:passthrough` preferred an env `ANTHROPIC_API_KEY` over the caller's
subscription OAuth and **returned before ever reading the inbound headers** — 93 orchestrator
requests, ~15.2M input tokens, billed to the operator's metered account. Fixed in `39c5adc`.
**Two things the next session should carry, not the fix:** (a) the tell was a **200 answered to a
credential-less probe** — which I produced, logged, wrote up as "where the auth came from", and filed
as trivia; a 200 with no credentials means *something else paid*; (b) the root cause was a test named
*"anthropic leg PREFERS env ANTHROPIC_API_KEY"* that had **SPECIFIED** the defect and kept it green.
Every gate passed over a billing redirect because an assertion said it was correct.

**Obligations journaled and pruned:** operator · dispatch authorization (2026-07-27, *"CLAUDE.md go
for it"*, recorded DATED in `CLAUDE.md`, `bf8a05e`) · operator · push authorization (2026-07-29,
*"push at will"*, `66399b9`). New receivable: **aegis owes the file-based-vs-dynamic reviewer leg**
(HARD, chase-once).

## 2026-07-29 | decision | endpoint choice for imposed reasoning depth — measured, not read

Three Z.ai endpoints; picking by documentation alone would have cost money. `/api/anthropic`
(subscription) **silently drops** `reasoning_effort` — 200 on a deliberately invalid value, while
`thinking.type` IS parsed, so it reads what it knows and discards the rest. `/api/paas/v4` validates
it but is **METERED** — *"Insufficient balance"* on a Coding Plan key. `/api/coding/paas/v4` is
**subscription AND validates it**, and effort is real there: `minimal` → 0 reasoning chars, `max` →
5730 on an identical prompt.
**The hazard it introduced, also measured:** a cap hit mid-reasoning returns a `thinking` block with
NO `text` block — reasoning billed, no answer, and it does not *look* truncated (6000 → truncated;
24000 → 19,322 used, clean stop). Hence `minMaxTokens`, a RAISE-only floor at 32000 — deliberately
not `extraBody`, which overwrites and would have CLAMPED a generous caller.

## 2026-07-29 | memory | agent defs load at SESSION START and do not hot-reload

Proven by direct probe rather than inferred: injected a unique marker into an **already-registered**
agent file, spawned it, asked it to read its own system prompt → **`MARKER ABSENT`** (the fresh edit)
/ **`TAG PRESENT`** (the pre-existing tag). Neither new agent NAMES nor edited agent BODIES take
effect mid-session. Consequences: a new def needs a process restart (**not** a machine reboot —
`claude --resume <session-id>` preserves the transcript, and a live bg session must be stopped first
or resume refuses with "currently running as a background agent"); and **a file-based agent's
`<<route:>>` tag DOES reach `body.system`**, which is what makes that routing path sound. `OQ-012`
carries the open half: the session runs from a pre-warmed spare pool, so the registry may be fixed at
pool-spawn rather than session-claim time.

## 2026-07-28 | memory | narrowed the phantom wake to ONE call site; two peers reproduced, one disjointly

Follow-up to the entry below, after `filemage-gen2` and `aegis` both reproduced. Two measurements
narrowed it, and one corrected an assumption I nearly shipped.

**`room unread --count` is the cursor-aware counter the watch path is missing — in the same binary.**
Measured with the rewind-and-restore control: `0` at EOF, `5` after rewinding past exactly five to-me
messages, cursor unchanged either way. `filemage-gen2` had asked whether `watch` reads a *stale*
cursor or *no* cursor; the fork stops mattering once the answer is "call the counter you already ship."

**Only the ARM-TIME branch is defective.** The unstripped binary carries exactly two notification
formats — `MAIL for %s` and `MAIL for %s / %d new from %s` — and they separate the day's four wakes
with no exceptions: both phantom wakes (fresh arm, cursor at EOF) carried the count; both genuine
wakes carried none and delivered the body promptly. **The count is the tell**, and the live path
needs no change.

**The assumption worth recording:** `aegis` had the identical symptom from a *disjoint* cause — their
block wires a Monitor to `tail -F | grep`, and `tail -F` replays its last 10 lines by default, so
every re-arm re-fires consumed matches (their fix: `-n 0`). **That is not our mechanism** — this
repo runs `partyline watch` directly, so the fix is a no-op here and must not be copied. A shared
symptom did not mean a shared cause, and they only found it by *disbelieving* that theirs was mine.

Posted as `4682081c` (composed to file, posted bytes sha256-verified). Nothing owed either way.

## 2026-07-28 | memory | root-caused the phantom room wake, and found the probe nobody had named

The monitor woke this session twice with "MAIL — 4 new" against a **drained** cursor. Yesterday I
recorded the symptom; today I have the cause, derived rather than guessed. The read cursor sits at
byte **2504790** and `room.jsonl` is **exactly 2504790 bytes** — byte-for-byte EOF, not a lagging
cursor. The "4" are the last four to-field mentions of `@modelmux`, **cursor-independent**: their
sender set is exactly `{filemage-gen2, h00-sh}`, matching the notification, and all four date from
2026-07-25 and were consumed then. **A watch wake is evidence that mail EXISTS in the room, not that
any of it is unread.**

**The better find is the verb.** `room unread --for <agent>` is the **non-mutating** probe — the
thing trap #1 has been telling people to want for two days while `CLAUDE.md` named only the
consuming `partyline read`. Not taken on trust, because an empty `unread` on a drained room is
`LP-004`'s exact ambiguous shape: rewound my own cursor by one message → `unread` **printed** it and
did **not** advance the cursor → restored, restore verified byte-equal. So trap #1's remedy is
cheaper than the gate I had scoped in `OQ-010` — fix the doc's *verb choice* first and let a gate be
defence-in-depth. `OQ-010` updated accordingly; memory filed.

Reported to `@partyline` as a defect (`584189dc`), composed to file behind a quoted heredoc and the
**posted bytes sha256-verified against the composed bytes** — the post call returns success whether
or not the content survived. Nothing owed; their tool, their ruling.

**Tripwire firing:** the Codex `access_token` expires **2026-07-28T14:38Z**, ~7.7 h from the
measurement. Only Codex field-testing depends on it; remedy is `codex login`, no restart. Checked by
decoding the `exp` claim alone — no token material printed, logged or written.

## 2026-07-27 | decision | `LP-005` ACCEPTED and promoted evergreen — with a work item, not a note

Adjudicated on the operator's delegation ("use your best judgement"). `LP-005` — *a trap you have
written down is not a trap you have disarmed* — accepted at **evergreen** (MOC row + `lessons/index.md`
entry), promoted to `lessons/a-written-down-trap-is-not-a-disarmed-trap.md`, staging cleared.

**Why evergreen on first sighting**, when `LP-002` sits at budding with comparable evidence: the
index's own rule allows severity/cost-of-recurrence to carry a promotion, and this one has a real
*control* rather than only instances — in the same session the traps backed by mechanisms (armed
pre-commit gate, reachability population floor, `USAGE`→README test) fired **zero** times while three
documented-only traps fired again on the agent that wrote them down. Same agent, same fatigue; the
variable was the mechanism. It is also distinct from `LP-004` — that one is about reading an
instrument's output, this is about whether a rule reaches the point of use at all.

**The disposition had to be more than filing.** A lesson claiming that written sentences do not change
behavior, promoted as a written sentence, demonstrates its own claim. So acceptance shipped
**`OQ-010`**: grade the three cited traps for a mechanism in
`.claude/hooks/pretooluse-safety-gates.sh`, which is already registered `PreToolUse` on `Bash` and
carries a documented stack-fragment insertion point for exactly this (additive — not a patch to a
kit-owned file). `pkill -f` and `partyline read`-in-a-pipeline look cleanly gateable; the fish
word-splitting case may honestly end as a **measured deferral** rather than a forced rule.

## 2026-07-27 | memory | room mail re-notified on monitor arm was ALREADY consumed — widen before concluding

Arming the room monitor after the reboot fired "MAIL — 4 new". `partyline read` returned
**"(no unread messages)"** — an empty result, and per `LP-004` that is evidence about the query
(cursor state), not the world. Widened to `room.jsonl` directly: exactly **one** message exists after
my last post (`482bd6db`, filemage-gen2's cell-three ruling, 2026-07-25T14:41Z), it is already folded
into `OQ-008`, and it closes with "Nothing owed." Room silent since. The monitor's "new" is keyed to
its arming baseline, **not** to the read cursor — the two disagree after a reboot and the disagreement
looks like unread mail. No reply posted: a bare acknowledgement is exactly what the room protocol forbids.

## 2026-07-26 | handoff | v0.5.0 + v0.5.1 shipped; seven OQs closed; four lessons promoted

Session end. `main` at `8b989bb`, clean, 0 ahead. Two releases cut and **artifact-verified** — not
just CI-green: downloaded the linux-x64 binary for each, checked it against the published
`SHA256SUMS`, ran it, and confirmed the feature was in the shipped bytes (v0.5.0 accepts
`codex:gpt-5.5` and `format="openai"` and rejects an invalid format with exit 1; v0.5.1's
`check-latest` disclosure line is present).

**Obligations journaled and pruned** (the audit trail for rows removed from `now/obligations.md`
this cycle): fieldbook · install report card — settled, accepted, finding 1 booked upstream (room
`683fbb1b`) · partyline · audit of this repo's partyline install — settled, ruled SOUND (`98896e54`)
· operator · ADR-0003 + README fix + PR #15 retitle + commit WU-0003 — all four delivered
(`7ef2d4c`, `fd08a9a`) · operator · the OQ-002 token-refresh fork — settled, option (b) shipped
(`df9347b`) · operator · the OQ-003 ruling — settled, strip-and-skip-worktree chosen from four
options · fieldbook · the two citing file paths for `0014`/`0012` — answered NONE with a
positive-controlled grep, accepted (`e088ccf0`). **No operator gate remains open.**

Filed `OQ-009`: dependabot groups a MAJOR typescript bump into a routine dev-deps group, and merging
PR #19 would disarm `lint` and `typecheck` together. That is the next action and it is a *hold*, not
a merge.

## 2026-07-26 | decision | a release's version must match its user-facing reality

PR #17 was titled `feat(...)`, which release-please would have cut as **v0.6.0**. Checked the actual
diff first: `USAGE` prints the identical string and `forwardUrl` builds the identical URL — **zero**
user-visible behaviour change, confirmed by 156 tests including the URL-building ones passing
unchanged. Retitled to `fix(server): …` and it cut **v0.5.1**. A minor bump would have advertised a
feature that does not exist. The version number is a public contract; it gets the same
measure-before-you-claim treatment as everything else.

## 2026-07-26 | memory | two documented traps caught me AGAIN in one session

Recording because the recurrence is the finding, not the traps. (a) I put `partyline read` — a
**cursor-advancing** call — inside a status pipeline and piped it to `grep -c`, consuming 4 messages
into a discarded count. Recovered from `room.jsonl`: exactly one message existed after my last post
and I had already processed it, so nothing was lost — but the recovery was luck, not design.
(b) `pkill -f` killed my own shell (exit 144), which is trap #4 in this repo's own handoff, written
down and walked into anyway. Both are now in `LP-004`'s orbit: a rule you have written down is not a
rule you have applied.

## 2026-07-25 | OQ sweep — pre-commit gate finally armed, three OQs closed

**The pre-commit gate now actually gates.** Root cause of 16 silent skips: `.git/hooks/pre-commit` was
a pre-commit.com shim run with `--skip-on-missing-config` against a config this repo never had, so it
fired and exited 0 every time. `lefthook.yml` exists but lefthook was never installed; Fieldbook's real
dispatcher sat tracked-but-unwired because `core.hooksPath` was unset. Ran `install-hooks.sh`, which
pointed git at `.githooks/` and RENAMED the stale shim so an `--unset` cannot resurrect it.

Then the acceptance test that matters — **made it fail on purpose.** Staged a deliberate lint
violation: `git commit` exited **1**, HEAD did not move, and the log named the right gate
(`pre-commit: x lint gate FAILED (exit 1) -> commit blocked`). Probe removed, tree clean. A hook nobody
has watched block a commit is a hypothesis, not a gate. Undo: `git config --unset core.hooksPath`.

**OQ-002 closed via option (b).** A 401/403 from a `codex`-auth upstream now fails loud with the real
remedy rather than an opaque provider body. Option (a) stays undone for a reason worth keeping: *the
test IS the dangerous act* — finding out whether the refresh token rotates requires redeeming it, and
if it rotates, that one redemption breaks the operator's own `codex` CLI. No read-only probe exists.

**OQ-005 closed as accepted, MEASURED not assumed:** the sync `readFileSync` costs **0.002 ms/call**,
0.0001% of a Codex round trip. Async would ripple through the whole call chain for ~2 µs; a cache would
weaken the per-request refresh pickup OQ-002's answer relies on.

**OQ-006 closed and live-verified.** Both stream translators now report real input usage in the final
`message_delta` — `{"input_tokens":15,"output_tokens":5}` against the live backend, where it had been a
flat 0 that reads as "free" rather than "not yet known". The existing empty-choices usage test was
STRENGTHENED rather than loosened: it now asserts both figures survive that chunk.

**OQ-003 closed too — the board is clear.** Operator chose strip-and-skip-worktree from four options.
The committed `CLAUDE.md` now carries only the portable kit constitution; the machine-specific
partyline block is gone from git but untouched locally, held out with `git update-index
--skip-worktree`. Verified four ways: status clean · local block intact (4 machine paths) · committed
version 0 machine paths · kit block still shipping. **All six OQs resolved.** The accepted cost is
recorded on the OQ: skip-worktree is per-clone local state, so a fresh clone lacks it and a kit
upgrade touching `CLAUDE.md` needs `--no-skip-worktree` first.

## 2026-07-25 | model lists refreshed against PRIMARY sources — Claude Opus 5 landed yesterday

Operator flagged new Claude models. Verified every provider against a primary source rather than a
search summary, and the search summary was in fact wrong — it reported "Opus 4.8 and Sonnet 4.6" as
current. The **Anthropic Models API** (queried live) settles it: `claude-opus-5`, **created
2026-07-24**, is the new one. Full current set: `claude-opus-5` · `claude-sonnet-5` ·
`claude-fable-5` · `claude-haiku-4-5-20251001`. `claude-opus-4-1-20250805` is deprecated, retires
2026-08-05. README gains the Claude model table it never had.

**OpenRouter: all 5 shipped slugs valid** — verified with our own `mux check-latest` against 345 live
catalog entries. **Z.ai:** `glm-5.2` still newest, `glm-4.7` still available, and `glm-5-turbo` exists
and is promoted for coding — we had never mentioned it. **Kimi:** all four ids exact.

**One substantive correction, from the vendor's own docs:** we told users to "reach for plain `k3`
unless you specifically want the cap." Moonshot recommends the opposite — `k3-256k` delivers the same
results in a smaller window at **half the quota**, so it is the sensible default and `k3` is for when
you genuinely need >256K. Flipped in README and routes.toml.

`routes.toml` was also carrying three stale blocks from before today: a whole "GPT/CODEX works via
LiteLLM — just not a built-in" recipe (codex has been a built-in for hours), a built-ins list missing
`codex`, and a note telling OpenAI-format runners to put LiteLLM in front. All replaced.

Method note: `bun run src/cli.ts check-latest` printed NOTHING and exited 0 — `src/cli.ts` has no
`import.meta.main` guard, so the module loaded and exited. I nearly filed that as a silent-success
defect in our own CLI. It is `bin/mux check-latest`. Exit 0 with no output is not evidence the tool
found nothing; it can mean the tool never ran.

## 2026-07-25 | Codex FIELD-TESTED live — auth accepted, and the built-in was broken in five ways

Operator said the endpoint was back. It was, and that settled `OQ-001` immediately: the very first
direct probe returned `400 The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT
account` — a **model** complaint, which is only reachable **past authentication**. Auth accepted.

Then the useful part. The `codex` built-in, committed hours earlier with every gate green and 137 tests
passing, **would have 400'd on every single request.** Five defects, none visible to a unit test:
missing `store:false`; `stream` forwarded from the caller when the backend is **SSE-ONLY**;
`instructions` omitted when there is no system prompt; `max_output_tokens`/`temperature`/`top_p`
forwarded when each is a hard `400 Unsupported parameter` (and Anthropic *requires* `max_tokens`, so
that was the common path); and reasoning items opening an empty Anthropic content block on 100% of
streamed replies. All five fixed, each with a falsifier, all seven negative controls watched go red
with the blob hash confirming a clean restore. 137 → 145 tests.

**The trap worth keeping:** the terminal `response.completed` carries `output: []` — always empty.
Aggregating a non-streaming reply from it is the obvious implementation and silently returns a
structurally-valid EMPTY message. Content lives only in the per-item events.

Two beliefs measured FALSE: `ChatGPT-Account-ID` is not required (our own code comment called it
load-bearing — corrected in place, kept because a multi-account login is exactly what a single-account
test cannot observe), and neither is `OpenAI-Beta`. And the README shipped `gpt-5.3-codex`, which does
not exist; 8 slugs verified working, 3 rejected. `models_cache.json`'s `supported_in_api` flag refers
to the *platform* API, not this endpoint — `gpt-5.3-codex-spark` is `false` there and works fine here,
so a table-based inference would have been wrong too.

Method note, since the operator had to say it twice: I started probing model slugs one at a time
instead of reading the CLI's own cache and searching for the documented constraints. Checking the web
gave the whole constraint set at once. Guessing serially where a source exists is the expensive path.

## 2026-07-25 | WU-0003 committed — cleanup closed, and the README was wronger than the plan said

Shipped the three-item cleanup, then committed WU-0003 as `7ef2d4c` (work) and `fd08a9a` (README).
ADR-0003 supersedes ADR-0002 and records that the operator reversed the no-built-in call on explicit
request — with an honest provenance banner noting the ADR was reconstructed *after* the code, which is
the lapse that let ADR-0002 sit contradicted by shipped code for a whole cycle.

**The plan said "fix the stale README Codex section (~lines 260–295)". Reading found five stale spots,
not one** — and recon-before-build is why. The one that mattered was not on the list: the **Security &
scope** section asserted modelmux "is not a tool for using a Claude/ChatGPT *subscription* outside its
official client", which the `codex` built-in makes flatly false. That is the section a cautious reader
uses to decide whether to trust the tool. Rewritten to state the real bright line (no pooling, no
reselling, no harvesting or forging) and to name the grey area plainly rather than soften it: the codex
path sends a token the official CLI obtained, from a process that is not that CLI, to an endpoint
OpenAI does not document. Also stale and fixed: the "OpenAI-format runners need LiteLLM in front"
advice — falsified by the *already-committed* `03bcc2e`, not by this session's work.

Also noted: the pre-commit hook **skipped** both commits (`.pre-commit-config.yaml` not found), so the
manual gate runs were the only verification, not a backstop. Worth knowing before trusting it.

## 2026-07-25 | decision | Codex is the ONLY upstream with an expiring credential — and OQ-002 overstated the gap

Operator asked whether token refresh affects anything besides Codex. Verified against
`BUILTIN_UPSTREAMS`: no. `anthropic` is passthrough (modelmux never holds it), and
`openrouter`/`zai`/`kimi` are console-issued API keys with no clock. Console key vs OAuth grant is the
whole distinction.

Verifying it corrected a filed doc: OQ-002 said there was "no recovery path from inside modelmux". Too
strong. `rewriteHeaders` runs inside the request handler and `readCodexAuth` does an **uncached**
`readFileSync` per call, so modelmux re-reads `auth.json` on every request and picks up a
CLI-refreshed token on the next call with no restart. The gap only bites a modelmux-only user.

The fork is now sharp, and option (a) carries a hazard worth recording before anyone implements it: if
OpenAI issues **rotating** refresh tokens, redeeming ours consumes it and invalidates the copy in
`auth.json` — breaking the user's own `codex` CLI, the tool we depend on for credentials. That also
kills the otherwise-clean in-memory-only variant, and it cannot be tested while the endpoint is
circuit-broken. So (a) is gated on OQ-001; (b) fail-loud-on-401 is safe now. Opened OQ-005 for the
sync `readFileSync` on the request path, which is the price of the free-refresh-pickup behaviour.

## 2026-07-25 | memory | "doc-lint clean — N files" is a partial claim on this tree

Measured after a fieldbook finding: `lint-docs.py` skips rules 8/15/21/12 on any doc whose
`provenance:` is `kit-template`, path-independently — **17 of our 37 files**, permanently, because that
provenance is *correct* for verbatim kit copies and will never be bumped. Armed-vs-control found 2 real
hidden findings, both kit-owned (do not patch; the fix arrives on upgrade).

Two things worth keeping. **Hit count is not debt**: 17 hits → 2 findings here, versus another tree's
4 → 6. And a near-miss of my own — the first control flipped *one* of the 17 (`log.md`, whose refs are
all live ids, making it the file least able to produce a finding), found zero, and nearly went out as
"latent on this tree". A negative control on a subset is only evidence if you can say why the subset is
representative; "it was the first one I tried" is not that.

## 2026-07-25 | handoff | WU-0003 — modelmux speaks OpenAI wire formats natively; Responses+Codex uncommitted

Session turned on one operator challenge: *"modelmux is fully self-contained… are we not expecting users
to have a second tool running to daisy-chain with it?"* That was right, and the inconsistency was already
shipped — the README told users to front LM Studio/llama.cpp/vLLM with LiteLLM. Fixed by making the proxy
speak the formats itself. Chat Completions adapter committed (`03bcc2e`) and field-tested end-to-end
against local Ollama (gemma4:31b): non-streaming tool call, streaming tool call whose `input_json_delta`
fragments reassemble to valid JSON, and the `tool_result` round trip. Responses adapter + `codex` auth
built and green but UNCOMMITTED.

Method note worth keeping: the operator asked whether the adapter was written from confirmed spec or from
memory. It was memory plus one secondary source. Checking the primary specs then caught THREE real
defects — missing `stream_options.include_usage` (token counts structurally always zero), reading usage
after a `choices[0]` guard when the usage chunk carries an EMPTY choices array, and `max_tokens` being
rejected by newer OpenAI models. Each now has a test that fails against the memory version.

## 2026-07-25 | decision | PR #15 gets retitled, not split

The branch outgrew its title (subscription work + the whole Chat Completions adapter). Splitting costs
another rebase for no real gain — the commits are coherent as "modelmux speaks more wire formats".

## 2026-07-25 | ingest | obligations swept; two debts settled

Settled and journaled: the fieldbook install report card (accepted; its finding 1 booked upstream as a
kit defect) and partyline's audit of this repo's install (ruled SOUND). New receivable: operator ruling
on `OQ-003`. New debt: the three-item cleanup before any new feature work.

## 2026-07-25 | WU-0002 — flat-rate subscriptions: Kimi built in, Codex ruled out

Request was "subscription support for GLM 5.2, GPT Codex, Kimi K3". Checked each against vendor primary
docs rather than memory, and they turned out to be three different problems. GLM 5.2 already worked —
the `zai` built-in is current and `glm-5.2` is the right slug; it was under-documented, not missing.
Kimi K3 was real work and a clean fit: Kimi Code is flat-rate at `api.kimi.com/coding` speaking
Anthropic Messages, so it drops in as a built-in with `KIMI_API_KEY`. Codex does not fit at all — see
ADR-0002.

Two traps found while verifying, both now documented. Moonshot sells TWO products with different hosts,
different model ids (`k3` vs `kimi-k3`) and non-interchangeable keys; the built-in is the subscription.
And Kimi Code's own docs publish their base WITH a trailing slash, which `base + "/v1/messages"` would
have doubled — hence `normalizeBase`, which also protects any user-declared `[upstreams]` entry.

Operator caught a real error in review: I had written `k3-256k` as the large-codebase option. Backwards.
K3 is a 1,048,576-token model and on Kimi Code the usable window is TIERED BY PLAN — lower tiers cap near
256K, higher tiers get the full 1M — so `k3-256k` is the CAPPED variant and plain `k3` is the full one,
which Moonshot's docs also say outright. Corrected in README and routes.toml, and the 1M window makes the
commented-out `longContext` route genuinely useful, so that now points at it.

Gates: lint clean · typecheck clean · 107 tests · doc-lint clean 35 files · index-lint rc=0. Both doc
linters caught a missing ADR-0002 index row before commit.

## 2026-07-25 | WU-0001 (cont.) — the diversion is now LOUD, not just fixable

Closed the limitation ADR-0001 named for itself. `src/agents.ts` + a `startProxy` call now print a
startup notice listing every untagged agent, the alias `anySubagent` would send it to, and the command
to pin it. Verified by booting the proxy against a scratch project: two untagged agents named, the
tagged one absent; then `mux tag kit-planner control` and a reboot dropped it to one. Warn → fix →
warning shrinks, end to end.

The load-bearing design choice is where it stays SILENT: no `anySubagent` rule, or one resolving to
passthrough (still Claude, so not a diversion), or nothing untagged. That has its own falsifier — I
removed the passthrough check and two tests went red, because the naive version warns on repos that
carry untagged agents but are not actually exposed. Gates: lint clean · typecheck clean · 101 tests.

Still open: no request-time warning, so an agent added after boot is unannounced until restart.

## 2026-07-25 | WU-0001 — `tag` verb closes the untagged-third-party-agent gap

Added `tagAgent` + `modelmux tag <agent> <alias>` (`src/cli.ts`), the insert counterpart to `use`'s
retarget. Cause: the `anySubagent` catch-all silently diverts any agent without a `<<route:>>` tag, and
third-party agents ship untagged by construction — but `use` throws on a tagless file, so there was no
way to add a first tag. Left that throw intact: it is a deliberate false-success guard, not a defect.
Guards are now symmetric (`use` refuses to create, `tag` refuses to overwrite). Reasoning + the two
rejected alternatives in ADR-0001.

Placement was the risk and carries its own falsifier: the tag goes in the prompt body, after front
matter, because front matter never reaches the proxy. Verified by breaking the implementation on purpose
and watching three tests go red — one of which only caught it after I fixed the test itself, which had
been feeding `extractSignals` the whole file including front matter and so could not detect the very
thing it claimed to check.

Gates: lint clean · `tsc --noEmit` clean · 90 tests pass · build compiles. WIRED proven end-to-end from
`bin/mux` in a scratch cwd, with `extractSignals` reading the tag back. Also ignored `.agent-docs/**` and
`CLAUDE.md` in `eslint.config.mjs` — the Fieldbook install added 22 lint errors in kit-owned markdown
that would have failed CI, and those files are governed by `lint-docs.py`, not eslint.

Next: nothing blocking. The diversion is still SILENT at request time — this gives operators a fix, not a
warning. A startup or route-time notice naming untagged agents is the obvious follow-on (ADR-0001
§Consequences).

<!-- newest entries appended above this line -->
