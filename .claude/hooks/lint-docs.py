#!/usr/bin/env python3
# lint-docs.py — the language-agnostic doc-schema linter for `.agent-docs/`.
#
# This is the ENFORCEMENT the CONVENTIONS.md "Lint rules" section refers to. CONVENTIONS ships those
# rules as a spec; this file makes them real. It implements every rule 1–15 from that section as a
# discrete check with a PASS/FAIL (or WARN) verdict and a `file:line` message. Rules 16–19 are kit-local
# (not CONVENTIONS rules): rule 16 (WARN-only) nudges `ADR-`-prefixed ADR filenames back toward the
# canonical unprefixed form without failing the run; rule 17 checks receivable-obligation integrity on a
# multi-party install's now/obligations.md — every "owed to me" row must name its trigger and its
# default-if-silent — and passes silently when that file is absent (a single-party install carries the
# same ledger as a handoff section, not a standalone file); rule 18 (FAIL) gates a full risk-tier
# dispatch-charter — once its status leaves drafting it must carry a resolved REV-NNN design-rev —
# recognizing a charter by its `charter-id` front-matter OR (filename-keyed) an `FR-NNNN-slug.md` under
# dispatch-charters/, and passing silently on any charter with no risk-tier field at all (brownfield-safe,
# the rule-17 precedent); rule 19 (FAIL) enforces the docs-impact baseline SEAL contract — a present
# baseline ledger (reference/docs-baseline.md) must carry a recorded seal and no parked row may post-date
# it — silent when that ledger is absent, and (like rule 17) NOT adopt-exempt.
#
# Portability contract (the colleague may be on macOS / BSD / WSL):
#   * STOCK Python 3, STDLIB ONLY — no pip installs, no `import yaml`. Front-matter is hand-parsed.
#   * Deterministic — the staleness check reads its "now" from --now, never a wall clock, so a run is
#     reproducible and testable. Without --now the staleness rule is skipped gracefully.
#   * Never hard-fails on a doc it cannot read; degrades to a finding, not a crash.
#
# Exit status: 0 when clean (or warnings only); 1 when any FAIL was reported. Warnings never fail.
#
# CLI: lint-docs.py [--root DIR] [--now YYYY-MM-DD] [--warn-days N] [--fail-days N]
#                   [--extra-id-prefixes S,U,AR,NS]
#
# What gets linted, and the template stance (documented choice):
#   The linter walks every `*.md` under --root. INSTANTIATED docs get the full rule set. Kit-shipped
#   scaffolding — a file whose name ends `.template.md`, OR any file under a `templates/` dir, OR any
#   doc still carrying `provenance: kit-template` — gets a RELAXED pass: structural rules (front-matter
#   present + parseable, required fields, allowed provenance, filename/category shape) still apply, but
#   rules that assume a fully instantiated tree are skipped for it: cross-reference resolution (a seed
#   references not-yet-instantiated sibling names), `now/` staleness, and WU resolution. Rationale: a
#   seed legitimately holds `{{PLACEHOLDER}}` tokens and points at names that only exist post-install;
#   linting those as if instantiated would flag the kit itself. The ADR/checkpoint body rules are keyed
#   on directory + filename shape (`decisions/[ADR-]NNNN-*.md` — the `ADR-` prefix is optional and
#   recognized, `checkpoints/DATE-*.md`), so a template in `templates/` is never mistaken for the real
#   artifact.
#
# Adopt-exemption: docs recorded `action: adopt` in `<root>/.kit-manifest.json` predate the kit and carry
#   no kit front-matter — the schema-class rules (1,2,3,4,5,6,10,12,14) are skipped for them; rule 13
#   (index completeness) still applies so they stay visible. Rule 14 (checkpoint integrity) is exempt for
#   the same write-once reason: a checkpoint authored before the ten-point format cannot be retro-edited to
#   add the points, so an adopted row must exempt it — while a freshly-written checkpoint is never adopted
#   and stays fully checked. Missing/malformed manifest ⇒ no exemptions, no crash.

import argparse
import datetime
import json
import os
import re
import sys

# ---------------------------------------------------------------------------------------------------
# Schema constants (mirror CONVENTIONS.md §2 / §5)
# ---------------------------------------------------------------------------------------------------
ALLOWED_PROVENANCE = {"human", "llm-reviewed", "llm-draft", "llm-autonomous", "kit-template"}
ADR_STATUS = {
    "proposed", "accepted", "pending", "deferred", "rejected", "superseded", "deprecated",
}
REQUIRED_FIELDS = ("provenance", "created", "last-modified")
# Front-matter fields whose values name other docs that must resolve on disk (CONVENTIONS rule 8).
REFERENCE_FIELDS = ("related", "supersedes", "superseded-by", "archived-from")
# Typed ID prefixes that are cross-references, NOT files (they resolve to a ledger row, not a path).
# REV (reviews subsystem — REV-NNN, Standard tier since 0.2.0) is DISTINCT from RV (REVISIT anchors); both
# are listed, ordered longest-first (REV before RV before R) so `REV-001` is matched by REV and never
# swallowed by the shorter RV / R alternatives. The trailing `-` already disambiguates, but longest-first
# keeps that correctness independent of the anchoring detail.
ID_PREFIX_RE = re.compile(r"^(OQ|WU|LP|REV|RV|FR|R|INC)-", re.IGNORECASE)
# The canonical typed-ID prefixes as a plain LIST (the same family ID_PREFIX_RE encodes, plus ADR whose
# on-disk artifacts are keyed `[ADR-]NNNN-slug.md`). Rules 20 build a filename/id regex from this list
# UNIONED with any caller-declared --extra-id-prefixes, ordered longest-first so a short prefix (`R`)
# never swallows a longer one that shares its stem (`REV`, `RV`). Kept as data (not only baked into
# ID_PREFIX_RE) so the collision detector can reuse the exact same prefix family without re-deriving it.
CANONICAL_ID_PREFIXES = ("ADR", "INC", "REV", "OQ", "WU", "LP", "RV", "FR", "R")

RULES = {
    1: "front-matter present + parseable",
    2: "required fields populated (provenance, created, last-modified)",
    3: "provenance in the allowed set",
    4: "ADRs have a valid status",
    5: "ADR status:superseded implies non-null superseded-by",
    6: "ADR status:pending implies pending-on; deferred implies deferred-because",
    7: "ADRs contain a non-empty '## Alternatives Considered' section",
    8: "related / supersedes / superseded-by / archived-from references resolve",
    9: "file path matches category (ADR in decisions/, checkpoint in checkpoints/)",
    10: "accepted ADRs are not llm-draft / llm-autonomous",
    11: "date-prefixed filenames match the date format",
    12: "now/ files last-modified within the freshness window (warn-not-fail)",
    13: "index completeness (every populated content dir has a matching index.md)",
    14: "checkpoint integrity (all ten numbered points present)",
    15: "work-unit value resolves to a WU in now/work-plan.md",
    16: "advisory: ADR filenames carry a redundant 'ADR-' prefix; canonical is decisions/NNNN-slug.md "
        "(warn-not-fail)",
    17: "obligations receivable integrity — every '## Owed to me' row in now/obligations.md names a "
        "trigger + a canonical default-if-silent",
    18: "dispatch-charter design-review gate — a full risk-tier charter past drafting must carry a "
        "resolved REV-NNN design-rev",
    19: "baseline-integrity — a sealed docs-baseline is write-once: it carries a seal, and no parked row "
        "may post-date it",
    20: "id-collision (INTERIM) — one typed-ID number maps to at most one artifact (file or index-row "
        "slug) in this tree",
    21: "deferral-home typing — a DEFER→ annotation's home is a typed-ID that resolves (no prose-only "
        "home)",
}

FAIL = "FAIL"
WARN = "WARN"

# Schema-class rules (front-matter presence + field validity + provenance enum + staleness), PLUS rule 14
# (checkpoint integrity). These are the rules waived for retro-adopted docs (manifest `action: adopt`) —
# a pre-existing flat corpus that predates the kit and carries no kit front-matter. Rule 14 is waived for
# the write-once reason: a checkpoint authored before the ten-point format cannot be retro-edited to pass,
# so an adopted row exempts it — a freshly-written checkpoint is never adopted and stays fully checked.
# Everything else (notably rule 13 index completeness) still applies to them; see load_adopted_paths() and
# the post-filter in main().
SCHEMA_CLASS_RULES = frozenset({1, 2, 3, 4, 5, 6, 10, 12, 14})

# Rule 12 (staleness) is a doc-freshness signal, shipped WARN-only so a stale-but-correct doc never
# hard-fails a commit / CI gate. CONVENTIONS notes a 90d *fail* threshold; --fail-days changes the
# message wording (soft-stale vs hard-stale), not the finding class. A maintainer who wants a hard
# gate can flip this one constant.
STALENESS_FAILS = False


class Finding:
    __slots__ = ("rule", "level", "path", "line", "msg")

    def __init__(self, rule, level, path, line, msg):
        self.rule = rule
        self.level = level
        self.path = path
        self.line = line
        self.msg = msg


# ---------------------------------------------------------------------------------------------------
# Hand-rolled front-matter parser (no PyYAML). A doc's front-matter is the first `---`-delimited
# block, optionally preceded ONLY by blank lines and HTML comment blocks (the templates open with a
# `<!-- guidance -->` block before their front-matter). Supports scalars, inline `[a, b]` lists, and
# simple block lists (`key:` then `- item` lines). Trailing ` # inline comments` are stripped.
# ---------------------------------------------------------------------------------------------------

def _strip_inline_comment(s):
    # A YAML inline comment starts at whitespace + '#'. Strip from the first ' #' or '\t#'.
    for token in (" #", "\t#"):
        idx = s.find(token)
        if idx != -1:
            s = s[:idx]
    return s


def _strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1]
    return s


def _parse_scalar(val):
    val = _strip_quotes(val.strip())
    if val == "" or val.lower() in ("null", "~", "none"):
        return None
    return val


def _parse_inline_list(val):
    inner = val.strip()
    inner = inner[1:-1] if inner.startswith("[") else inner
    if inner.endswith("]"):
        inner = inner[:-1]
    inner = inner.strip()
    if not inner:
        return []
    return [_strip_quotes(x) for x in inner.split(",") if x.strip()]


def extract_frontmatter_region(lines):
    """Return (start_idx, end_idx) of the '---' fences, or None. Skips a leading comment block."""
    i, n = 0, len(lines)
    while i < n:
        s = lines[i].strip()
        if s == "":
            i += 1
            continue
        if s.startswith("<!--"):
            if "-->" in s:
                i += 1
                continue
            i += 1
            while i < n and "-->" not in lines[i]:
                i += 1
            i += 1  # consume the closing '-->' line
            continue
        break
    if i >= n or lines[i].strip() != "---":
        return None  # no opening fence
    start = i
    for j in range(i + 1, n):
        if lines[j].strip() == "---":
            return (start, j)
    return "UNTERMINATED"


def parse_frontmatter(text):
    """Return (fields, field_line, error). fields: {key: scalar|list|None}. field_line: 1-indexed."""
    lines = text.split("\n")
    region = extract_frontmatter_region(lines)
    if region is None:
        return None, None, "no YAML front-matter (expected an opening '---')"
    if region == "UNTERMINATED":
        return None, None, "unterminated front-matter (opening '---' has no closing '---')"
    start, end = region
    fields, field_line = {}, {}
    i = start + 1
    while i < end:
        raw = lines[i]
        line_no = i + 1
        stripped = raw.strip()
        if stripped == "" or stripped.startswith("#"):
            i += 1
            continue
        m = re.match(r"^([A-Za-z0-9_-]+):(.*)$", raw)
        if not m:
            i += 1
            continue
        key = m.group(1)
        val = _strip_inline_comment(m.group(2)).strip()
        if val == "":
            # Possible block list: consecutive '- item' lines.
            items, j = [], i + 1
            while j < end:
                s2 = lines[j].strip()
                if s2.startswith("- "):
                    items.append(_strip_quotes(_strip_inline_comment(s2[2:]).strip()))
                    j += 1
                else:
                    break
            fields[key] = items if items else None
            field_line[key] = line_no
            i = j if items else i + 1
            continue
        if val.startswith("["):
            fields[key] = _parse_inline_list(val)
        else:
            fields[key] = _parse_scalar(val)
        field_line[key] = line_no
        i += 1
    return fields, field_line, None


# ---------------------------------------------------------------------------------------------------
# Classification helpers
# ---------------------------------------------------------------------------------------------------

CHECKPOINT_NAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}-.+\.md$")
# NNNN-kebab (4-digit then dash then non-date). The `ADR-` prefix is OPTIONAL: the canonical authored
# form is the unprefixed `NNNN-slug.md` (CONVENTIONS §5), but a natural adopter choice — carrying the
# `ADR-` in the filename too — is ALSO recognized as an ADR so the ADR-class rules (4-7, 10) actually
# run on it instead of silently no-op'ing. Rule 16 (advisory, WARN) nudges those back toward canonical.
ADR_NAME_RE = re.compile(r"^(?:ADR-)?\d{4}-[a-z0-9].*\.md$")
# Just the prefixed variant, used by the rule-16 convergence advisory.
ADR_PREFIXED_NAME_RE = re.compile(r"^ADR-\d{4}-[a-z0-9].*\.md$")
DATE_PREFIX_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
# A CALENDAR-dated artifact name (YYYY-MM-DD-<slug>.md — an incident / audit / dogfood record). Its leading
# four digits satisfy ADR_NAME_RE, so rule 9 needs this to tell a dated artifact APART from an ADR: the
# directory decides, not the shape (see the rule-9 guard). The trailing `-` pins the full year-month-day
# shape so a genuine `NNNN-slug` ADR (whose second group is a title word, not a month) never matches.
DATED_ARTIFACT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-")


def rel(path, root):
    try:
        return os.path.relpath(path, root)
    except ValueError:
        return path


def is_template(path, fields):
    name = os.path.basename(path)
    if name.endswith(".template.md"):
        return True
    parts = path.replace("\\", "/").split("/")
    if "templates" in parts:
        return True
    if fields and fields.get("provenance") == "kit-template":
        return True
    return False


def is_adr(path):
    name = os.path.basename(path)
    if name == "index.md" or name.endswith(".template.md"):
        return False
    return os.path.basename(os.path.dirname(path)) == "decisions" and bool(ADR_NAME_RE.match(name))


def parent_dir_name(path):
    return os.path.basename(os.path.dirname(path))


def is_checkpoint(path):
    """A checkpoint is classified by DIRECTORY + SHAPE: it must live directly under checkpoints/ AND carry
    the timestamped filename shape (YYYY-MM-DD-HHMMSS-<slug>.md). A date+HHMMSS-named file elsewhere — an
    audits/ artifact that happens to share the shape, say — is NOT a checkpoint and gets no checkpoint-class
    rules (14). index.md and templates are never checkpoints."""
    name = os.path.basename(path)
    if name == "index.md" or name.endswith(".template.md"):
        return False
    return parent_dir_name(path) == "checkpoints" and bool(CHECKPOINT_NAME_RE.match(name))


def as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [v]


def nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


# Leading markdown emphasis markers (**, *, _, backtick). A table cell whose canonical value the author
# (or a template legend) has BOLDED — e.g. `**never-chase-never-peek**` — must still satisfy a begins-with
# or emptiness check: cosmetic markdown may not fail a canonical check. Prefix-strip only (leading), so a
# begins-with comparison sees the token itself; the anchoring lesson is the same one the example markers
# carry (a decorated prefix silently never matches an exact-literal test).
EMPHASIS_LEAD_RE = re.compile(r"^[*_`]+")


def strip_emphasis(s):
    """Return `s` with any leading markdown emphasis markers (**, *, _, backtick) stripped, after a
    whitespace trim. Non-strings degrade to '' so callers can check emptiness uniformly."""
    if not isinstance(s, str):
        return ""
    return EMPHASIS_LEAD_RE.sub("", s.strip())


# Rule 21 — a DEFER-with-home annotation. The kit's own DEFER grammar (standing-rules-core "write the
# deferral down"; the inbound-reference sweep treats a `DEFER→` row as a first-class obligation surface
# POINTING at a home) is `DEFER→ <home>`: the arrow points a deferral at the artifact that will absorb it.
# This captures the FIRST token after the arrow (the home) — an alphanumeric-led run — so a genuine home id
# (`WU-0042`, `M5-07`) is caught, while a bare `DEFER→` with no following home (a prose mention of the
# concept) does not match at all and is left alone. Both the Unicode arrow `→` and the ASCII `->` fallback
# are accepted; `TRACKED → …` / `DEFER (reason)` do not match (the token before the arrow must be DEFER).
DEFER_HOME_RE = re.compile(r"DEFER\s*(?:→|->)\s*([A-Za-z][\w-]*)")


# ---------------------------------------------------------------------------------------------------
# Per-doc checks (rules 1–12, 14, 15, 21)
# ---------------------------------------------------------------------------------------------------

def find_section(body, heading_words):
    """Locate a '## Heading' (case-insensitive prefix). Return (found, non_empty, heading_line_idx)."""
    lines = body.split("\n")
    pat = re.compile(r"^#{2,6}\s+" + re.escape(heading_words), re.IGNORECASE)
    for i, ln in enumerate(lines):
        if pat.match(ln.strip()):
            for j in range(i + 1, len(lines)):
                if re.match(r"^#{1,6}\s", lines[j]):
                    break
                s = lines[j].strip()
                if not s or s.startswith("<!--") or s.startswith("-->"):
                    continue
                return True, True, i
            return True, False, i
    return False, False, -1


def parse_date(s):
    if not isinstance(s, str):
        return None
    try:
        return datetime.datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def scan_content_dirs_for_slug(slug, root):
    """Root-relative dirs (sorted) that contain `<slug>.md`, scanning the managed content dirs only.

    Last-resort rule-8 resolution for a BARE slug (no '/', no '.md', no typed-ID prefix) that names a doc
    living in some content dir other than the referring doc's own dir (or root). One hit resolves; more
    than one is reported as ambiguous by the caller. The scan runs over `managed_dirs(root,
    include_now=True)`: the rule-13 content-dir set PLUS `now/` — the live-state dir rule 13 does not index
    but a `related:` legitimately points into. Including it here is safe precisely because a bare slug that
    also exists elsewhere yields >1 hit and the caller turns that into the ambiguity-FAIL ("qualify it with
    a path"), so now/ can never silently mis-resolve a ref. templates/ and dot-dirs stay excluded, so the
    scan never reaches kit scaffolding or VCS internals. (`managed_dirs` is defined further down; Python
    resolves it at call time.)
    """
    target = slug + ".md"
    hits = []
    for d in managed_dirs(root, include_now=True):
        if os.path.isfile(os.path.join(d, target)):
            hits.append(rel(d, root))
    return sorted(hits)


def resolve_reference(ref, doc_path, root, extra_id_re=None):
    """Resolve a reference token. Returns (resolved, detail).

    `resolved` is True when the token resolves to an existing file (or is a non-file typed ID). `detail`
    is None for the ordinary unresolved case (the caller supplies its generic "does not resolve" message)
    and a short clause (e.g. "ambiguous across N content dirs (...)") when the failure needs a specific
    message.

    `extra_id_re`, when supplied, is a compiled regex of caller-declared LOCAL typed-ID prefixes
    (--extra-id-prefixes); a token matching it is treated as a resolvable non-file ledger id, exactly like
    the canonical OQ-/WU-/… set. This is the upgrade-safe seam for spines the kit deliberately does not
    canonize — a flag in the caller's wiring, not an edit to (or fork of) this linter.
    """
    if not isinstance(ref, str):
        return True, None
    ref = ref.strip()
    if ref == "" or ref.lower() in ("null", "~", "none", "[]"):
        return True, None
    doc_dir = os.path.dirname(doc_path)
    # Path-qualified reference (contains '/', or already carries a .md extension). Try the literal path
    # first, then — for a path-qualified but EXTENSIONLESS ref (e.g. `decisions/0001-foo`) — the same path
    # with `.md` appended; each relative to the doc dir, then the root. This mirrors the bare-stem fallback
    # below so a related-ref written without its extension still resolves.
    if "/" in ref or ref.endswith(".md"):
        cands = [ref] if ref.endswith(".md") else [ref, ref + ".md"]
        for base in (doc_dir, root):
            for c in cands:
                if os.path.isfile(os.path.normpath(os.path.join(base, c))):
                    return True, None
        return False, None
    # ADR-NNNN -> decisions/NNNN-*.md OR decisions/ADR-NNNN-*.md (adopters who keep the prefix on disk).
    m = re.match(r"^ADR-(\d{3,4})$", ref, re.IGNORECASE)
    if m:
        dec = os.path.join(root, "decisions")
        if not os.path.isdir(dec):
            return False, None
        prefix = m.group(1)
        ok = any(
            (fn.startswith(prefix + "-") or fn.startswith("ADR-" + prefix + "-"))
            and fn.endswith(".md")
            for fn in os.listdir(dec)
        )
        return ok, None
    # Other typed IDs (OQ/WU/LP/…) are ledger rows, not files — treat as resolvable. Caller-declared local
    # spines (--extra-id-prefixes) get the same treatment via extra_id_re.
    if ID_PREFIX_RE.match(ref):
        return True, None
    if extra_id_re is not None and extra_id_re.match(ref):
        return True, None
    # Bare stem -> <doc_dir>/<ref>.md or <root>/<ref>.md
    for base in (doc_dir, root):
        if os.path.isfile(os.path.join(base, ref + ".md")):
            return True, None
    # LAST resort — a bare slug that did not resolve in its own dir or root: scan the managed content dirs
    # for `<slug>.md`. A single unambiguous hit resolves; multiple hits keep the FAIL but report the
    # ambiguity so the author can qualify the ref with a path. Kept last so typed ids and path-qualified
    # refs retain their existing semantics.
    hits = scan_content_dirs_for_slug(ref, root)
    if len(hits) == 1:
        return True, None
    if len(hits) > 1:
        return False, ("ambiguous across %d content dirs (%s) — qualify it with a path"
                       % (len(hits), ", ".join(hits)))
    return False, None


def check_document(path, root, findings, now_date, warn_days, fail_days, workplan_wus,
                   extra_id_re=None):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError as exc:
        findings.append(Finding(1, FAIL, rel(path, root), 1, "cannot read file: %s" % exc))
        return

    fields, field_line, err = parse_frontmatter(text)

    # Rule 1 — front-matter present + parseable.
    if err is not None:
        findings.append(Finding(1, FAIL, rel(path, root), 1, err))
        return  # nothing else is checkable without front-matter
    field_line = field_line or {}
    rpath = rel(path, root)
    body = text.split("---", 2)[-1] if text.count("---") >= 2 else text

    templated = is_template(path, fields)

    # Rule 2 — required fields populated.
    for f in REQUIRED_FIELDS:
        if f not in fields or fields.get(f) in (None, "", []):
            findings.append(Finding(2, FAIL, rpath, field_line.get(f, 1),
                                    "missing/empty required field '%s'" % f))

    # Rule 3 — provenance in allowed set.
    prov = fields.get("provenance")
    if nonempty_str(prov) and prov not in ALLOWED_PROVENANCE:
        findings.append(Finding(3, FAIL, rpath, field_line.get("provenance", 1),
                                "provenance '%s' not in allowed set %s"
                                % (prov, sorted(ALLOWED_PROVENANCE))))

    # Rule 11 — date-prefixed filename matches a real date.
    name = os.path.basename(path)
    dm = DATE_PREFIX_RE.match(name)
    if dm:
        y, mo, d = dm.groups()
        try:
            datetime.date(int(y), int(mo), int(d))
        except ValueError:
            findings.append(Finding(11, FAIL, rpath, 1,
                                    "filename date prefix '%s-%s-%s' is not a valid date"
                                    % (y, mo, d)))
        if parent_dir_name(path) == "checkpoints" and not CHECKPOINT_NAME_RE.match(name):
            findings.append(Finding(11, FAIL, rpath, 1,
                                    "checkpoint filename must match YYYY-MM-DD-HHMMSS-<slug>.md"))

    # Rule 9 — file path matches category (ADR placement). Checkpoints are classified by DIRECTORY + shape,
    # not shape alone: a date+HHMMSS-named file OUTSIDE checkpoints/ (e.g. an audits/ artifact that happens
    # to share the timestamped filename shape) is NOT a checkpoint, so it gets no "misplaced checkpoint"
    # finding — the shape is genuinely ambiguous and cannot distinguish a stray checkpoint from a same-named
    # audit record. The `not CHECKPOINT_NAME_RE.match(name)` guard also stops such a file being misread as
    # an ADR by the NNNN- prefix it incidentally shares. The `not DATED_ARTIFACT_RE.match(name)` guard is the
    # SAME rationale genus one step out: a plain calendar-dated name (YYYY-MM-DD-<slug>.md, no HHMMSS — an
    # incident / audit / dogfood record) also satisfies ADR_NAME_RE by its leading digits, but the shape is
    # ambiguous and the directory wins, so a dated file outside decisions/ is never flagged as a misplaced
    # ADR. Only ADR placement is actively checked here.
    if ADR_NAME_RE.match(name) and not CHECKPOINT_NAME_RE.match(name) \
            and not DATED_ARTIFACT_RE.match(name) \
            and name != "index.md" and not name.endswith(".template.md"):
        if parent_dir_name(path) != "decisions":
            findings.append(Finding(9, FAIL, rpath, 1,
                                    "ADR-named file (NNNN-*.md) must live in decisions/, not %s/"
                                    % parent_dir_name(path)))

    # ADR-specific rules (4, 5, 6, 7, 10).
    if is_adr(path):
        status = fields.get("status")
        # Rule 4 — valid status.
        if not nonempty_str(status) or status not in ADR_STATUS:
            findings.append(Finding(4, FAIL, rpath, field_line.get("status", 1),
                                    "ADR status '%s' is missing or not one of %s"
                                    % (status, sorted(ADR_STATUS))))
        # Rule 5 — superseded implies superseded-by.
        if status == "superseded" and not nonempty_str(fields.get("superseded-by")):
            findings.append(Finding(5, FAIL, rpath, field_line.get("superseded-by", 1),
                                    "status: superseded requires a non-null superseded-by"))
        # Rule 6 — pending/deferred implications.
        if status == "pending" and not as_list(fields.get("pending-on")):
            findings.append(Finding(6, FAIL, rpath, field_line.get("pending-on", 1),
                                    "status: pending requires a non-empty pending-on"))
        if status == "deferred" and not nonempty_str(fields.get("deferred-because")):
            findings.append(Finding(6, FAIL, rpath, field_line.get("deferred-because", 1),
                                    "status: deferred requires a non-empty deferred-because"))
        # Rule 7 — non-empty '## Alternatives Considered'.
        found, non_empty, hidx = find_section(body, "Alternatives Considered")
        if not found:
            findings.append(Finding(7, FAIL, rpath, 1,
                                    "missing mandatory '## Alternatives Considered' section (§5)"))
        elif not non_empty:
            findings.append(Finding(7, FAIL, rpath, hidx + 1,
                                    "'## Alternatives Considered' section is empty (§5)"))
        # Rule 10 — accepted ADRs are not llm-draft/llm-autonomous.
        if status == "accepted" and prov in ("llm-draft", "llm-autonomous"):
            findings.append(Finding(10, FAIL, rpath, field_line.get("provenance", 1),
                                    "accepted ADR may not be provenance '%s' (need llm-reviewed/human)"
                                    % prov))

    # Rule 14 — checkpoint integrity. Keyed on is_checkpoint (directory + timestamp shape): only a real
    # checkpoint under checkpoints/ is integrity-checked; a timestamp-shaped file elsewhere is not one.
    if is_checkpoint(path):
        present = set()
        for ln in body.split("\n"):
            m = re.match(r"^\s{0,3}(?:[*_]{0,2})?(\d{1,2})\.\s", ln)
            if m:
                num = int(m.group(1))
                if 1 <= num <= 10:
                    present.add(num)
        missing = [n for n in range(1, 11) if n not in present]
        if missing:
            findings.append(Finding(14, FAIL, rpath, 1,
                                    "checkpoint missing required point(s): %s (§6)"
                                    % ", ".join(str(x) for x in missing)))

    # Rules that assume a fully instantiated tree — skip for kit-shipped scaffolding.
    if templated:
        return

    # Rule 8 — reference fields resolve.
    for fld in REFERENCE_FIELDS:
        for ref in as_list(fields.get(fld)):
            resolved, detail = resolve_reference(ref, path, root, extra_id_re)
            if not resolved:
                if detail:
                    msg = "%s reference '%s' is %s" % (fld, ref, detail)
                else:
                    msg = "%s reference '%s' does not resolve to a file" % (fld, ref)
                findings.append(Finding(8, FAIL, rpath, field_line.get(fld, 1), msg))

    # Rule 15 — work-unit resolves to a WU in now/work-plan.md.
    wu = fields.get("work-unit")
    if nonempty_str(wu):
        if workplan_wus is None:
            findings.append(Finding(15, FAIL, rpath, field_line.get("work-unit", 1),
                                    "work-unit '%s' set but now/work-plan.md not found to resolve it"
                                    % wu))
        elif wu not in workplan_wus:
            findings.append(Finding(15, FAIL, rpath, field_line.get("work-unit", 1),
                                    "work-unit '%s' not found in now/work-plan.md" % wu))

    # Rule 21 — deferral-home typing (the TRACTABLE CORE of a larger accepted design: this rule types the
    # HOME only). A `DEFER→ <home>` deferral must point at a TYPED-ID home (a known prefix or a declared
    # --extra-id-prefix) that RESOLVES via the existing rule-8 resolver — so a deferral has a machine-
    # followable target, not a prose gesture. A prose-only home (`DEFER→ the multipart unit`) FAILS
    # "untyped deferral home". OUT OF SCOPE (do NOT implement here): target-STATUS checking (whether the
    # home is open vs already-resolved) and code-comment sweeping — those are the rest of the accepted
    # design, deliberately not built by this rule.
    for m in DEFER_HOME_RE.finditer(body):
        home = m.group(1).strip()
        is_typed = bool(
            ID_PREFIX_RE.match(home)
            or re.match(r"^ADR-\d", home, re.IGNORECASE)
            or (extra_id_re is not None and extra_id_re.match(home))
        )
        if not is_typed:
            findings.append(Finding(21, FAIL, rpath, 1,
                                    "untyped deferral home 'DEFER→ %s' — a deferral must point at a "
                                    "TYPED-ID home (a known prefix or a --extra-id-prefix), not prose"
                                    % home))
            continue
        resolved, detail = resolve_reference(home, path, root, extra_id_re)
        if not resolved:
            findings.append(Finding(21, FAIL, rpath, 1,
                                    "deferral home 'DEFER→ %s' %s"
                                    % (home, detail or "does not resolve")))

    # Rule 12 — now/ staleness (warn-not-fail; requires --now).
    if now_date is not None:
        parts = os.path.dirname(rpath).replace("\\", "/").split("/")
        if "now" in parts:
            lm = parse_date(fields.get("last-modified"))
            if lm is not None:
                age = (now_date - lm).days
                if age > fail_days:
                    lvl = FAIL if STALENESS_FAILS else WARN
                    findings.append(Finding(12, lvl, rpath, field_line.get("last-modified", 1),
                                            "now/ doc is %dd old (> fail window %dd) — refresh"
                                            % (age, fail_days)))
                elif age > warn_days:
                    findings.append(Finding(12, WARN, rpath, field_line.get("last-modified", 1),
                                            "now/ doc is %dd old (> warn window %dd)"
                                            % (age, warn_days)))


# ---------------------------------------------------------------------------------------------------
# Rule 13 — index completeness (folds in lint-agent-docs-indexes.sh, promoted to FAIL: it is THE
# hook-enforced rule per CONVENTIONS). Managed dirs are the one-level (and one-nested) content dirs
# under root, excluding now/ and templates/, that hold >= 1 non-index, non-template .md. (Rule 13 calls
# managed_dirs() with the default include_now=False — now/ is live state, not indexed content; only the
# rule-8 slug scan passes include_now=True.)
# ---------------------------------------------------------------------------------------------------

# In-dir references count in two forms (mirrors lint-agent-docs-indexes.sh exactly): a bare
# backtick token `file.md`, or a ledger-table markdown link [label](file.md). Targets containing
# '/' are cross-dir references and are skipped by both patterns.
INDEX_TOKEN_RE = re.compile(r"`([^`/]*\.md)`")
INDEX_LINK_RE = re.compile(r"\]\(([^)/]*\.md)\)")
# HTML comment blocks are stripped BEFORE the token scan: an index seed carries an EXAMPLE comment
# whose illustrative `<name>.md` tokens name files that don't exist yet — counting them would flag a
# phantom entry on a fresh install. A commented-out row is not a live index entry.
HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
# A token counts ONLY on an ENTRY ROW — a list-marker row (`- `file.md` …`, optionally after an emoji
# marker) or a ledger-table row (`| `file.md` | …`). A bare backtick token in a prose paragraph or an
# entry's indented continuation line (`  **Open when:** … `foo.md``) is NOT an index entry. Anchoring on
# the row shape (paired with the HTML-comment strip above) is the second half of the entry-detector fix:
# without it a filename merely NAMED in prose was miscounted as an entry (a spurious phantom / unindexed
# split). Only `- ` (dash + space) and `|` open an entry row — never `*`/`+`, so a `**Open when:**`
# continuation line is never mistaken for a bullet.
INDEX_ENTRY_ROW_RE = re.compile(r"^[ \t]*(?:-[ \t]|\|)")


def content_docs(dirpath):
    out = []
    try:
        for fn in os.listdir(dirpath):
            if not fn.endswith(".md"):
                continue
            if fn == "index.md" or fn.endswith(".template.md"):
                continue
            if os.path.isfile(os.path.join(dirpath, fn)):
                out.append(fn)
    except OSError:
        pass
    return out


def managed_dirs(root, include_now=False):
    result = []
    try:
        top = sorted(os.listdir(root))
    except OSError:
        return result
    for base in top:
        # Skip dot-prefixed dirs (.git, .kit-backups, ...) — they hold no managed content docs.
        if base.startswith("."):
            continue
        d = os.path.join(root, base)
        if not os.path.isdir(d):
            continue
        # templates/ is kit scaffolding, never referenceable content — always excluded. now/ is the
        # live-state dir: rule 13 (default, include_now=False) does NOT index it, but the rule-8 bare-slug
        # scan opts it back in (include_now=True) so a `related:` can resolve into it; the ambiguity-FAIL is
        # the collision protection that makes scanning the live-state dir safe (a slug shared with another
        # content dir goes ambiguous, never a silent wrong resolve).
        if base == "templates":
            continue
        if base == "now" and not include_now:
            continue
        if content_docs(d):
            result.append(d)
        try:
            for sub in sorted(os.listdir(d)):
                if sub.startswith("."):
                    continue
                subd = os.path.join(d, sub)
                if os.path.isdir(subd) and content_docs(subd):
                    result.append(subd)
        except OSError:
            pass
    return result


def check_index_completeness(root, findings):
    for d in managed_dirs(root):
        rd = rel(d, root)
        idx = os.path.join(d, "index.md")
        disk = set(content_docs(d))
        if not os.path.isfile(idx):
            findings.append(Finding(13, FAIL, rd, 1,
                                    "populated content dir has no index.md (%d docs)" % len(disk)))
            continue
        try:
            with open(idx, "r", encoding="utf-8", errors="replace") as fh:
                itext = fh.read()
        except OSError as exc:
            findings.append(Finding(13, FAIL, rel(idx, root), 1, "cannot read index.md: %s" % exc))
            continue
        scan = HTML_COMMENT_RE.sub("", itext)  # drop commented-out example rows before counting
        indexed = set()
        for line in scan.split("\n"):
            if not INDEX_ENTRY_ROW_RE.match(line):
                continue  # prose / continuation / heading — a named filename here is not an index entry
            for t in INDEX_TOKEN_RE.findall(line) + INDEX_LINK_RE.findall(line):
                if t != "index.md":
                    indexed.add(t)
        unindexed = sorted(disk - indexed)
        phantom = sorted(indexed - disk)
        if unindexed:
            findings.append(Finding(13, FAIL, rel(idx, root), 1,
                                    "unindexed docs (on disk, not in index): %s"
                                    % ", ".join(unindexed)))
        if phantom:
            findings.append(Finding(13, FAIL, rel(idx, root), 1,
                                    "phantom entries (in index, no such file): %s"
                                    % ", ".join(phantom)))


# ---------------------------------------------------------------------------------------------------
# Rule 20 — same-number/different-slug ID-COLLISION detector (an INTERIM detector — see below). Across the
# managed tree, if ONE typed-ID numeric prefix (REV-033, OQ-030 — every typed prefix, incl. any
# --extra-id-prefixes) maps to MORE THAN ONE distinct artifact — a content file `PREFIX-NNN-slug.md`, or a
# filename token cited on an index ENTRY ROW — with DIFFERENT slugs, the run FAILS and names both.
#
# WHY THIS IS THE ONLY SURFACE THAT NOTICES: a same-number/different-slug collision (two authors both minting
# REV-033, as `REV-033-foo.md` and `REV-033-bar.md`) produces DISTINCT filenames and INDIVIDUALLY-VALID index
# rows — so a git merge applies both cleanly, and reference-resolution stays green (each file exists; each id
# is a resolvable ledger prefix). Nothing else in the schema is even looking at the pair. Meanwhile the
# CITATION GRAPH is now corrupt: a `related: REV-033` (or a prose `see REV-033`) silently binds to whichever
# of the two the reader happens to open. This rule is the tripwire for exactly that.
#
# ENTAILMENT — what a clean rule-20 pass DOES answer: "does each typed-ID number identify AT MOST ONE artifact
# in THIS tree (working copy, this branch)". What it does NOT answer: cross-branch / pre-merge collisions (two
# branches each minting REV-033 before they meet — this sees only the merged/working tree, not the other
# branch); and the SEMANTIC correctness of any citation (that `related: REV-033` points at the INTENDED review,
# not merely at a unique one). It is INTERIM: the durable fix is a mint-time id allocator; until then this is
# the after-the-fact catch.
# ---------------------------------------------------------------------------------------------------

def check_id_collisions(root, findings, collision_fname_re):
    """Rule 20 driver. `collision_fname_re` matches `^(PREFIX)-(NNN)-(slug).md$` for the canonical +
    caller-declared prefix family. Builds id_key -> {slug: {source-paths}} across content filenames and
    index entry-row filename tokens, and FAILs any id_key that carries more than one distinct slug."""
    if collision_fname_re is None:
        return
    idmap = {}

    def record(idkey, slug, source):
        idmap.setdefault(idkey, {}).setdefault(slug, set()).add(source)

    for path in iter_markdown(root):
        parts = path.replace("\\", "/").split("/")
        if "templates" in parts:
            continue  # kit scaffolding carries EXAMPLE ids, never a live collision
        name = os.path.basename(path)
        rp = rel(path, root)
        if name == "index.md":
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    itext = fh.read()
            except OSError:
                continue
            scan = HTML_COMMENT_RE.sub("", itext)  # commented-out example rows are not live entries
            for line in scan.split("\n"):
                if not INDEX_ENTRY_ROW_RE.match(line):
                    continue  # prose / heading / continuation — a named id here is not an index entry
                for tok in INDEX_TOKEN_RE.findall(line) + INDEX_LINK_RE.findall(line):
                    m = collision_fname_re.match(tok)
                    if m:
                        record(m.group(1).upper() + "-" + m.group(2), m.group(3).lower(),
                               "%s (index row)" % rp)
            continue
        if name.endswith(".template.md"):
            continue
        m = collision_fname_re.match(name)
        if m:
            record(m.group(1).upper() + "-" + m.group(2), m.group(3).lower(), rp)

    for idkey in sorted(idmap):
        slugs = idmap[idkey]
        if len(slugs) <= 1:
            continue
        sources = sorted({s for srcset in slugs.values() for s in srcset})
        findings.append(Finding(20, FAIL, sources[0], 1,
            "typed-ID '%s' collides — %d distinct slugs (%s) map to it across: %s (same-number/different-"
            "slug: distinct filenames + valid index rows merge clean while the citation graph corrupts)"
            % (idkey, len(slugs), ", ".join(sorted(slugs)), "; ".join(sources))))


# ---------------------------------------------------------------------------------------------------
# Rule 16 — ADR-prefix convergence advisory (WARN-only, one finding per run). The linter now RECOGNIZES
# `decisions/ADR-NNNN-slug.md` as a full ADR (ADR_NAME_RE) and RESOLVES `ADR-NNNN` references against it
# (resolve_reference), so a prefixed corpus is fully checked and never phantom-fails. This advisory is the
# gentle counter-pressure: the canonical authored form stays the unprefixed `decisions/NNNN-slug.md`
# (CONVENTIONS §5), so ONE warn per run names that form. It never fails a run (mirrors rule 12 staleness)
# — convergence by nudge, not by forced rename.
# ---------------------------------------------------------------------------------------------------

def check_adr_prefix_advisory(root, findings):
    dec = os.path.join(root, "decisions")
    if not os.path.isdir(dec):
        return
    try:
        prefixed = sorted(fn for fn in os.listdir(dec)
                          if ADR_PREFIXED_NAME_RE.match(fn) and not fn.endswith(".template.md"))
    except OSError:
        return
    if not prefixed:
        return
    shown = ", ".join(prefixed[:3]) + (", …" if len(prefixed) > 3 else "")
    canonical = re.sub(r"(?i)^ADR-", "", prefixed[0])
    findings.append(Finding(
        16, WARN, rel(dec, root), 1,
        "%d ADR file(s) carry the redundant 'ADR-' filename prefix (%s); the canonical authored form is "
        "the unprefixed 'decisions/%s' — rename at leisure (ADR rules and references already work either "
        "way)" % (len(prefixed), shown, canonical)))


# ---------------------------------------------------------------------------------------------------
# Rule 17 — obligations receivable integrity (multi-party form). A multi-party install seeds a standalone
# now/obligations.md (the inter-party debt ledger); a single-party / Minimal install carries the same rows
# as an `## Obligations` section inside now/handoff.md and ships NO obligations.md. This rule keys on the
# runtime FACT — the file's existence — and is SILENT when it is absent: there is no receivable ledger to
# check. When present, every DATA row of its `## Owed to me` table must name BOTH the point at which silence
# becomes actionable (a non-empty Trigger/by-when cell) AND the pre-decided rule at that point (a
# Default-if-silent cell drawn from the canonical enum), so a receivable can never be left with no trigger
# (it would never come due) or no silence-rule (an agent would have to improvise a default). Example rows
# the template ships between the `<!-- example:start -->` / `<!-- example:end -->` markers are illustrative,
# delete-on-first-use, and are skipped — the linter honors the same marker pair the template uses to fence
# them. Columns are located by HEADER NAME (a cell containing "trigger" / "default"), not by position, so
# the check tolerates the schema's exact wording ("Trigger / by-when", "Default-if-silent") without pinning
# to a column index. A table the parser cannot make sense of degrades to ONE WARN naming the file, never a
# traceback (the portability contract: a malformed doc is a finding, not a crash).
# ---------------------------------------------------------------------------------------------------

# Canonical default-if-silent dispositions (CONVENTIONS / ADR-0012). A cell must BEGIN with one of these; a
# row may append a clause after the token (e.g. "chase-once, then apply-default: proceed against v1").
OBLIGATION_DEFAULTS = ("chase-once", "apply-default", "never-chase-never-peek")
# Prefix-only matching (same canon as the kit's own CLAUDE.md markers, ADR-0011): the template
# decorates its start markers with inline guidance ("<!-- example:start · delete these rows... -->"),
# so an exact-literal match would silently never skip — the vacuity class this file exists to kill.
OBLIGATION_EXAMPLE_START = "<!-- example:start"
OBLIGATION_EXAMPLE_END = "<!-- example:end"
MD_SEPARATOR_CELL_RE = re.compile(r"^:?-+:?$")


def split_md_row(line):
    """Split a markdown table row into stripped cell strings, or None if the line is not a table row. A
    leading '|' is required; a trailing '|' is optional so both border styles ('| a | b |' and '| a | b')
    parse the same."""
    s = line.strip()
    if not s.startswith("|"):
        return None
    s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def is_md_separator(cells):
    """True for a header/body separator row — every cell is dashes with an optional alignment colon."""
    return bool(cells) and all(MD_SEPARATOR_CELL_RE.match(c) for c in cells)


def lint_owed_to_me(text, rpath, findings):
    """Parse the `## Owed to me` table and check each real data row. Appends findings in place; may WARN
    once when the section/table is not shaped as expected (the caller wraps this so nothing raises)."""
    lines = text.split("\n")
    head_re = re.compile(r"^#{2,6}\s+Owed to me\b", re.IGNORECASE)
    hidx = -1
    for i, ln in enumerate(lines):
        if head_re.match(ln.strip()):
            hidx = i
            break
    if hidx == -1:
        findings.append(Finding(17, WARN, rpath, 1,
                                "obligations.md has no '## Owed to me' section to check"))
        return

    header = None
    trig_idx = def_idx = None
    in_example = False
    for j in range(hidx + 1, len(lines)):
        s = lines[j].strip()
        if re.match(r"^#{1,6}\s", s):
            break  # reached the next section (e.g. '## Owed by me') — the receivable table is done
        if OBLIGATION_EXAMPLE_START in s:
            in_example = True
            continue
        if OBLIGATION_EXAMPLE_END in s:
            in_example = False
            continue
        cells = split_md_row(lines[j])
        if cells is None or is_md_separator(cells):
            continue
        if header is None:
            header = cells
            for k, h in enumerate(header):
                hl = h.lower()
                if trig_idx is None and "trigger" in hl:
                    trig_idx = k
                if def_idx is None and "default" in hl:
                    def_idx = k
            if trig_idx is None or def_idx is None:
                findings.append(Finding(17, WARN, rpath, hidx + 1,
                                        "'## Owed to me' header lacks a Trigger and/or Default-if-silent "
                                        "column — cannot check rows"))
                return
            continue
        if in_example:
            continue  # shipped illustrative row (delete-on-first-use), not a real receivable
        who = cells[0] if len(cells) > 0 else ""
        what = cells[1] if len(cells) > 1 else ""
        label = "%s / %s" % (who or "?", what or "?")
        # Both cell checks compare against the emphasis-STRIPPED value: the template legend bolds the
        # canonical dispositions (`**never-chase-never-peek**`), and cosmetic markdown must not fail a
        # canonical check. The original (unstripped) cell text is still shown in the message so the
        # author sees exactly what is in their table.
        trig = cells[trig_idx] if trig_idx < len(cells) else ""
        if not strip_emphasis(trig):
            findings.append(Finding(17, FAIL, rpath, j + 1,
                                    "owed-to-me row [%s] has an empty Trigger/by-when — a receivable with "
                                    "no trigger can never come due" % label))
        dflt = cells[def_idx] if def_idx < len(cells) else ""
        if not any(strip_emphasis(dflt).startswith(tok) for tok in OBLIGATION_DEFAULTS):
            findings.append(Finding(17, FAIL, rpath, j + 1,
                                    "owed-to-me row [%s] Default-if-silent '%s' must begin with one of %s"
                                    % (label, dflt, list(OBLIGATION_DEFAULTS))))


def check_obligations_receivable(root, findings):
    path = os.path.join(root, "now", "obligations.md")
    if not os.path.isfile(path):
        return  # single-party / Minimal installs carry the ledger as a handoff section, not this file
    rpath = rel(path, root)
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError as exc:
        findings.append(Finding(17, WARN, rpath, 1, "cannot read obligations.md: %s" % exc))
        return
    before = len(findings)
    try:
        lint_owed_to_me(text, rpath, findings)
    except Exception:
        # Defensive last line: a table shape the parser did not anticipate degrades to ONE WARN, never a
        # traceback. Drop any partial findings this pass emitted so the file reports exactly one WARN.
        del findings[before:]
        findings.append(Finding(17, WARN, rpath, 1,
                                "could not parse the '## Owed to me' table — verify its structure by hand"))


# ---------------------------------------------------------------------------------------------------
# Rule 18 — dispatch-charter design-review gate (charter-shaped files only). A charter is any doc whose
# front-matter carries a `charter-id` (the dispatch-charter `FR-NNNN` spine; the long-term mission
# `charter.md` has no `charter-id` and is never a target). Two front-matter fields govern the gate:
# `risk-tier` (standard | full) and `design-rev` (a REV-NNN id, empty until earned). The contract: a
# FULL-tier charter may not advance its `status` PAST the drafting phase (drafting | draft) without a
# resolved pre-G0 design-review id in `design-rev` — a full-risk surface (turn-control, shared-write
# state, contracts, irreversible surfaces) earns a multi-lens design review BEFORE it leaves drafting.
# A STANDARD-tier charter carries no such gate. A charter with NO `risk-tier` field AT ALL is brownfield
# and the rule passes SILENTLY (the same absent-artifact precedent as rule 17), so an adopter's pre-kit /
# pre-gate charters never retro-fail. When the gate bites, `design-rev` must be non-empty, match REV-NNN,
# AND resolve through the SAME reference machinery rule 8 uses (REV- is a canonical ledger prefix). A
# risk-tier present but outside {standard, full}, or a charter whose front-matter the rule cannot make
# sense of, degrades to ONE WARN naming the file — never a traceback (the portability contract: a
# malformed doc is a finding, not a crash).
# ---------------------------------------------------------------------------------------------------

CHARTER_RISK_TIERS = ("standard", "full")
# The drafting phase — the ONLY statuses under which a full-tier charter may still lack a design-rev.
# Kept to exactly the two tokens the rule-18 contract names; a charter that has moved to any OTHER status
# has "left drafting" and the gate applies. (The canonical initial status the template ships is
# `drafting`.)
CHARTER_DRAFTING_STATUSES = ("drafting", "draft")
DESIGN_REV_RE = re.compile(r"^REV-\d{3}$", re.IGNORECASE)
# A filename-keyed dispatch-charter: identity carried in an `FR-NNNN-slug.md` filename directly under a
# dispatch-charters/ (or dispatch/) dir, with NO `charter-id` front-matter. This form is RECOGNIZED — not
# CANONIZED: `charter-id` stays the canonical spine (this mirrors the ADR-prefix precedent in rule 16,
# where an `ADR-NNNN` filename is recognized without becoming canonical). Before this, a filename-keyed
# charter early-returned the detector on its absent `charter-id`, so the whole design-review gate silently
# no-op'd on it — the inert-by-absence silent-vacuity hole this linter exists to kill.
CHARTER_NAME_RE = re.compile(r"^FR-\d{3,4}-[a-z0-9].*\.md$", re.IGNORECASE)
CHARTER_DIRS = ("dispatch-charters", "dispatch")


def is_charter_file(path):
    """A dispatch-charter RECOGNIZED by DIRECTORY + SHAPE (mirrors is_adr / is_checkpoint): an
    `FR-NNNN-slug.md` directly under a dispatch-charters/ (or dispatch/) dir. index.md and templates are
    never charters; the long-term mission `charter.md` does not match the FR-NNNN shape, so it is never a
    target (the same exclusion the front-matter path relies on)."""
    name = os.path.basename(path)
    if name == "index.md" or name.endswith(".template.md"):
        return False
    if not CHARTER_NAME_RE.match(name):
        return False
    return parent_dir_name(path) in CHARTER_DIRS


def _charter_id_from_name(name):
    """Extract the `FR-NNNN` id from a filename-keyed charter name (for the finding message), or None."""
    m = re.match(r"^(FR-\d{3,4})-", name, re.IGNORECASE)
    return m.group(1).upper() if m else None


def _check_one_charter(path, root, findings, rpath, extra_id_re):
    """Apply the rule-18 gate to a single doc. Returns without a finding for any non-charter, template,
    or brownfield (no risk-tier) doc. Raises nothing the caller does not catch."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return  # an unreadable doc is already a rule-1 FAIL from check_document
    fields, field_line, err = parse_frontmatter(text)
    if err is not None or not fields:
        return  # no parseable front-matter — rule 1 owns that finding
    field_line = field_line or {}
    # Detection widens beyond the canonical `charter-id` front-matter to ALSO recognize a filename-keyed
    # charter (an `FR-NNNN-slug.md` under dispatch-charters/): without this the absent `charter-id`
    # early-returned here and the entire gate silently no-op'd on such a charter (the silent-vacuity hole).
    if "charter-id" not in fields and not is_charter_file(path):
        return  # not a dispatch-charter
    if is_template(path, fields):
        return  # kit scaffolding — a seed's placeholder design-rev is not a live violation
    if "risk-tier" not in fields:
        return  # brownfield charter — silent pass (the rule-17 absent-artifact precedent)
    tier = fields.get("risk-tier")
    tier_l = tier.lower() if isinstance(tier, str) else None
    if tier_l not in CHARTER_RISK_TIERS:
        findings.append(Finding(18, WARN, rpath, field_line.get("risk-tier", 1),
                                "charter risk-tier '%s' is not one of %s — cannot apply the design-review "
                                "gate" % (tier, list(CHARTER_RISK_TIERS))))
        return
    if tier_l != "full":
        return  # standard-tier: no design-review gate
    status = fields.get("status")
    status_l = status.lower() if isinstance(status, str) else None
    if status_l is None or status_l in CHARTER_DRAFTING_STATUSES:
        return  # still in the drafting phase — the gate has not yet bitten
    cid = fields.get("charter-id") or _charter_id_from_name(os.path.basename(path)) or "?"
    design_rev = fields.get("design-rev")
    if not nonempty_str(design_rev):
        findings.append(Finding(18, FAIL, rpath,
                                field_line.get("design-rev", field_line.get("status", 1)),
                                "full-tier charter '%s' has status '%s' (past drafting) but no design-rev — "
                                "a pre-G0 design review (REV-NNN) is required before a full risk-tier "
                                "charter leaves drafting" % (cid, status)))
        return
    dr = design_rev.strip()
    if not DESIGN_REV_RE.match(dr):
        findings.append(Finding(18, FAIL, rpath, field_line.get("design-rev", 1),
                                "full-tier charter '%s' design-rev '%s' must be a REV-NNN id"
                                % (cid, design_rev)))
        return
    resolved, detail = resolve_reference(dr, path, root, extra_id_re)
    if not resolved:
        findings.append(Finding(18, FAIL, rpath, field_line.get("design-rev", 1),
                                "full-tier charter '%s' design-rev '%s' %s"
                                % (cid, design_rev, detail or "does not resolve")))


def check_charters(root, findings, extra_id_re=None):
    """Rule 18 driver — walk every markdown doc, apply the charter design-review gate, and degrade any
    single charter the parser cannot make sense of to ONE WARN (never a traceback)."""
    for path in iter_markdown(root):
        rpath = rel(path, root)
        before = len(findings)
        try:
            _check_one_charter(path, root, findings, rpath, extra_id_re)
        except Exception:
            del findings[before:]
            findings.append(Finding(18, WARN, rpath, 1,
                                    "could not evaluate the charter design-review gate — verify the "
                                    "risk-tier / design-rev front-matter by hand"))


# ---------------------------------------------------------------------------------------------------
# Rule 19 — baseline-integrity (the docs-impact SEAL contract; baseline-mechanism.md §"Anti-laundering —
# the baseline is SEALED and write-once"). The docs-impact baseline parks inherited drift so a diff-scoped
# gate does not drown a brownfield adopter — and the whole accountability line ("new debt loud") rests on
# that baseline NOT becoming a laundry where a claim you just broke gets re-labelled "inherited." This rule
# enforces the STATICALLY-checkable half of the seal contract (the git-history "a row's claim was edited
# after the seal" half needs a diff and is the doc-refs sweep's job): if the baseline ledger exists it MUST
# carry a recorded seal, and NO parked row's inventory-date may post-date that seal (a post-seal row is a
# suspected launder — only the sealed one-shot inventory may create rows). It keys on the runtime FILE and
# is SILENT when the ledger is absent (a cold-start / no-baseline repo — the rule-17 absent-artifact
# precedent), and — mirroring rule 17 — it is NOT adopt-exempt: it guards the accountability line, not a
# schema convenience, so it fires regardless of any manifest `action: adopt` row (it is deliberately absent
# from SCHEMA_CLASS_RULES). A ledger the parser cannot make sense of degrades to ONE WARN naming the file,
# never a traceback (the portability contract: a malformed doc is a finding, not a crash).
# ---------------------------------------------------------------------------------------------------

def load_baseline_seal(root, ledger_text=None):
    """Return a datetime.date for the recorded baseline seal, or None.

    Sources, in order: the manifest `baseline-sealed-at` (`<root>/.kit-manifest.json` — the Standard+ home
    per baseline-mechanism.md §Homes), then — standalone, where kit front-matter may be absent — a
    `baseline-sealed-at` token in the ledger's own front-matter or body. The value may be a bare date or
    `<sha> <date>`; a YYYY-MM-DD is extracted from it.
    """
    manifest = os.path.join(root, ".kit-manifest.json")
    try:
        with open(manifest, "r", encoding="utf-8", errors="replace") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("baseline-sealed-at"), str):
            m = re.search(r"\d{4}-\d{2}-\d{2}", data["baseline-sealed-at"])
            if m:
                d = parse_date(m.group(0))
                if d is not None:
                    return d
    except (OSError, ValueError):
        pass
    if ledger_text is not None:
        for ln in ledger_text.split("\n"):
            if "baseline-sealed-at" in ln.lower():
                m = re.search(r"\d{4}-\d{2}-\d{2}", ln)
                if m:
                    return parse_date(m.group(0))
    return None


def _baseline_seal_declared(root, text):
    """True if a `baseline-sealed-at` token is recorded anywhere (manifest OR the ledger) — distinct from
    whether it parses to a real date (checked separately), so an unsealed ledger and a malformed seal give
    different, honest findings."""
    manifest = os.path.join(root, ".kit-manifest.json")
    try:
        with open(manifest, "r", encoding="utf-8", errors="replace") as fh:
            mdata = json.load(fh)
        if isinstance(mdata, dict) and "baseline-sealed-at" in mdata:
            return True
    except (OSError, ValueError):
        pass
    return "baseline-sealed-at" in text.lower()


def lint_baseline_integrity(text, root, rpath, findings):
    """Enforce the seal invariants on the docs-baseline ledger. Appends findings in place; may raise, and
    the caller wraps this so a table shape it did not anticipate degrades to one WARN rather than a crash."""
    if not _baseline_seal_declared(root, text):
        findings.append(Finding(19, FAIL, rpath, 1,
            "baseline ledger present but UNSEALED — a write-once baseline requires a recorded "
            "'baseline-sealed-at' (in .kit-manifest.json or the ledger header); an unsealed baseline "
            "can be laundered"))
        return
    seal = load_baseline_seal(root, text)
    if seal is None:
        findings.append(Finding(19, FAIL, rpath, 1,
            "baseline 'baseline-sealed-at' carries no parseable YYYY-MM-DD — the seal must be a real date "
            "for post-seal rows to be checkable"))
        return

    # Check each parked DATA row's inventory-date against the seal. Locate the table + the inventory-date
    # column by HEADER NAME (not position), same tolerance rule 17 uses.
    lines = text.split("\n")
    header = None
    inv_idx = None
    for j, raw in enumerate(lines):
        cells = split_md_row(raw)
        if cells is None or is_md_separator(cells):
            continue
        if header is None:
            header = cells
            for k, h in enumerate(header):
                if inv_idx is None and "inventory" in h.lower():
                    inv_idx = k
            if inv_idx is None:
                return  # no inventory-date column → no dated rows to check; the seal itself is verified
            continue
        inv = strip_emphasis(cells[inv_idx]) if inv_idx < len(cells) else ""
        label = strip_emphasis(cells[0]) if cells else "?"
        row_date = parse_date(inv)
        if row_date is None:
            findings.append(Finding(19, FAIL, rpath, j + 1,
                "baseline row [%s] has no parseable inventory-date '%s' — an undatable parked row cannot "
                "be verified against the seal (a laundering vector)" % (label or "?", inv)))
            continue
        if row_date > seal:
            findings.append(Finding(19, FAIL, rpath, j + 1,
                "baseline row [%s] inventory-date %s POST-DATES the seal %s — a fresh break cannot be "
                "hand-parked into 'inherited' (suspected launder; only the sealed one-shot writes rows)"
                % (label or "?", row_date, seal)))


def check_baseline_integrity(root, findings):
    """Rule 19 driver — the docs-baseline ledger lives at `<root>/reference/docs-baseline.md` (Standard+
    home). Silent when absent; degrades a ledger it cannot parse to ONE WARN."""
    path = os.path.join(root, "reference", "docs-baseline.md")
    if not os.path.isfile(path):
        return  # cold-start / no-baseline repo — nothing to check (rule-17 absent-artifact precedent)
    rpath = rel(path, root)
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError as exc:
        findings.append(Finding(19, WARN, rpath, 1, "cannot read docs-baseline.md: %s" % exc))
        return
    before = len(findings)
    try:
        lint_baseline_integrity(text, root, rpath, findings)
    except Exception:
        del findings[before:]
        findings.append(Finding(19, WARN, rpath, 1,
            "could not parse the baseline ledger — verify its seal + parked rows by hand"))


# ---------------------------------------------------------------------------------------------------
# work-plan WU harvest (for rule 15)
# ---------------------------------------------------------------------------------------------------

WU_RE = re.compile(r"\bWU-\d{3,4}\b")


def load_adopted_paths(root):
    """Root-relative paths (os.sep) for `<root>/.kit-manifest.json` files[] rows with action == 'adopt'.

    Retro-adopted docs predate the kit and carry no kit front-matter; the SCHEMA_CLASS_RULES are dropped
    for them (they stay subject to rule 13 index completeness). Manifest paths are recorded relative to
    the target REPO ROOT (the parent of --root, e.g. `.agent-docs/reference/foo.md`), so they are mapped
    back to root-relative form to match Finding.path. A missing/malformed manifest yields no exemptions
    and never raises.
    """
    manifest = os.path.join(root, ".kit-manifest.json")
    try:
        with open(manifest, "r", encoding="utf-8", errors="replace") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return set()
    if not isinstance(data, dict):
        return set()
    rows = data.get("files")
    if not isinstance(rows, list):
        return set()
    target_root = os.path.dirname(root)
    adopted = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("action") != "adopt":
            continue
        p = row.get("path")
        if not isinstance(p, str) or not p.strip():
            continue
        abs_p = os.path.normpath(os.path.join(target_root, p))
        try:
            adopted.add(os.path.relpath(abs_p, root))
        except ValueError:
            continue
    return adopted


def load_workplan_wus(root, extra_harvest_re=None):
    """Return the set of work-unit ids declared in now/work-plan.md, or None when there is no live plan.

    RULE-15 LOCAL-SPINE SEAM: rule 15 resolves a checkpoint/doc `work-unit:` value against THIS set, so a
    truthful local spine the kit does not canonize (a milestone `M5-07`, declared via --extra-id-prefixes)
    must be harvestable here too — otherwise a real work-unit id would fail rule 15 purely for not being
    `WU-`-shaped. The harvest is therefore the UNION of the canonical `WU-NNNN` tokens AND, when the caller
    declared local prefixes, tokens matching `extra_harvest_re` (built from the SAME --extra-id-prefixes
    plumbing rule 8 already uses — no new flag). The seam does NOT become resolve-anything: with no
    declared prefixes the union collapses to WU-only, so an undeclared `M5-07` still fails rule 15.
    """
    for cand in ("now/work-plan.md", "now/work-plan.template.md"):
        p = os.path.join(root, cand)
        if os.path.isfile(p):
            # A live work-plan resolves WUs; the template is a placeholder and resolves nothing real,
            # so only the instantiated work-plan is authoritative for rule 15.
            if cand.endswith(".template.md"):
                return None
            try:
                with open(p, "r", encoding="utf-8", errors="replace") as fh:
                    text = fh.read()
            except OSError:
                return None
            wus = set(WU_RE.findall(text))
            if extra_harvest_re is not None:
                wus |= {m.group(0) for m in extra_harvest_re.finditer(text)}
            return wus
    return None


# ---------------------------------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------------------------------

def iter_markdown(root):
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune dot-prefixed subdirectories (.git, .kit-backups, ...) so VCS internals and kit backups
        # living under the root are never linted. The root itself (.agent-docs) is always kept — os.walk
        # only exposes CHILD dir names here, so a dot-prefixed root is unaffected.
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for fn in sorted(filenames):
            if fn.endswith(".md"):
                yield os.path.join(dirpath, fn)


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Doc-schema linter for .agent-docs/ (CONVENTIONS.md lint rules 1-15 + kit-local 16-21).")
    ap.add_argument("--root", default=".agent-docs",
                    help="root of the .agent-docs tree to lint (default: .agent-docs)")
    ap.add_argument("--now", default=None,
                    help="reference date YYYY-MM-DD for the now/ staleness check "
                         "(omit to skip staleness; never reads the wall clock)")
    ap.add_argument("--warn-days", type=int, default=7,
                    help="now/ staleness warn threshold in days (default: 7)")
    ap.add_argument("--fail-days", type=int, default=90,
                    help="now/ staleness hard-stale threshold in days (default: 90)")
    ap.add_argument("--extra-id-prefixes", default=None,
                    help="comma-separated LOCAL typed-ID prefixes (e.g. S,U,AR,NS) to ALSO recognize as "
                         "resolvable non-file ledger ids for rule 8 — for spines the kit does not canonize. "
                         "Upgrade-safe: wire it into the caller, no linter edit / keep-local fork needed.")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        sys.stderr.write("lint-docs: --root '%s' is not a directory\n" % args.root)
        return 2

    now_date = None
    if args.now is not None:
        now_date = parse_date(args.now)
        if now_date is None:
            sys.stderr.write("lint-docs: --now '%s' is not YYYY-MM-DD\n" % args.now)
            return 2

    # Caller-declared LOCAL typed-ID prefixes (--extra-id-prefixes) → one compiled alternation, ordered
    # longest-first so a short prefix never swallows a longer one that shares its stem.
    extra_id_re = None
    extra_prefixes = []
    if args.extra_id_prefixes:
        extra_prefixes = sorted((p.strip() for p in args.extra_id_prefixes.split(",") if p.strip()),
                                key=len, reverse=True)
        if extra_prefixes:
            extra_id_re = re.compile(r"^(?:%s)-" % "|".join(re.escape(p) for p in extra_prefixes),
                                     re.IGNORECASE)

    # RULE-15 SEAM harvest regex — the SAME declared prefixes, in an UNANCHORED word-bounded form for
    # scanning free work-plan text (extra_id_re is `^`-anchored for .match on a single ref token; this one
    # finds the ids embedded in prose). Only the extra prefixes need it; the canonical WU- family is
    # harvested by WU_RE. None when no local prefixes were declared, so the seam stays WU-only by default.
    extra_harvest_re = None
    if extra_prefixes:
        extra_harvest_re = re.compile(
            r"\b(?:%s)-[A-Za-z0-9][A-Za-z0-9-]*" % "|".join(re.escape(p) for p in extra_prefixes),
            re.IGNORECASE)

    # RULE-20 collision filename/id regex — the canonical prefix family UNIONed with the declared extras,
    # ordered longest-first so `R` never swallows `REV`/`RV`. Matches `PREFIX-NNN-slug.md`.
    collision_prefixes = sorted(set(CANONICAL_ID_PREFIXES) | set(extra_prefixes), key=len, reverse=True)
    collision_fname_re = re.compile(
        # \d{1,4}: canonical spines use 3-4 digits, but declared extra-prefix spines may
        # number narrower (e.g. a 2-digit local spine) — wider coverage cannot false-positive,
        # since the rule fires only on a genuine multi-slug collision for one numeric key.
        r"^(%s)-(\d{1,4})-(.+)\.md$" % "|".join(re.escape(p) for p in collision_prefixes),
        re.IGNORECASE)

    findings = []
    workplan_wus = load_workplan_wus(root, extra_harvest_re)

    for path in iter_markdown(root):
        check_document(path, root, findings, now_date, args.warn_days, args.fail_days, workplan_wus,
                       extra_id_re)
    check_index_completeness(root, findings)
    check_id_collisions(root, findings, collision_fname_re)
    check_adr_prefix_advisory(root, findings)
    check_obligations_receivable(root, findings)
    check_charters(root, findings, extra_id_re)
    check_baseline_integrity(root, findings)

    # Adopt-exemption: retro-adopted docs (manifest `action: adopt`) predate the kit and carry no kit
    # front-matter, so drop their schema-class findings. Rule 13 (index completeness) is NOT in the
    # schema-class set, so adopted docs remain fully subject to it.
    adopted = load_adopted_paths(root)
    if adopted:
        findings = [f for f in findings
                    if not (f.rule in SCHEMA_CLASS_RULES and f.path in adopted)]

    # Report, grouped by rule.
    n_fail = sum(1 for f in findings if f.level == FAIL)
    n_warn = sum(1 for f in findings if f.level == WARN)
    files_seen = sum(1 for _ in iter_markdown(root))

    if not findings:
        print("lint-docs: clean — %d file(s) checked, all schema rules pass." % files_seen)
        return 0

    for rule in sorted(RULES):
        group = [f for f in findings if f.rule == rule]
        if not group:
            continue
        print("== Rule %d: %s ==" % (rule, RULES[rule]))
        for f in sorted(group, key=lambda x: (x.path, x.line)):
            print("  %-4s %s:%d  %s" % (f.level, f.path, f.line, f.msg))
        print("")

    print("lint-docs: %d FAIL, %d WARN across %d file(s)." % (n_fail, n_warn, files_seen))
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
