## What & why

What does this change, and why?

## How it was verified

This repo's rule is **evidence over assertion**. Show the gates passing:

```bash
bun run lint && bun run typecheck && bun test test/
```

- [ ] `bun run lint` clean
- [ ] `bun run typecheck` clean
- [ ] `bun test test/` green (new behavior has a test)
- [ ] No secrets added (`.env`, keys) and no real keys in tests/docs
- [ ] Docs/skills updated if behavior or config changed

## Notes for the reviewer

Anything worth a closer look, trade-offs, or follow-ups.
