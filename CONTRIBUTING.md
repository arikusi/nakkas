# Contributing

Thanks for your interest in nakkas.

## Setup

```bash
git clone https://github.com/arikusi/nakkas
cd nakkas
npm install
```

## Dev commands

```bash
npm run dev         # watch mode (recompile on save)
npm run test        # watch mode tests
npm run test:run    # single run
npm run typecheck   # type check without emitting
npm run build       # compile to dist/
```

## Where things live

| What | Where |
|------|-------|
| Tool definitions | `src/index.ts` |
| JSON schema | `src/schemas/` |
| SVG rendering | `src/renderer/` |
| Preview (SVG to PNG) | `src/preview.ts` |
| Save to disk | `src/save.ts` |
| Design analysis | `src/analysis.ts` |
| Tests | `tests/` |

## Guidelines

- Every schema field needs a `.describe()` annotation. This is how AI understands what to fill in.
- Add tests for new features. Run `npm run test:run` before pushing.
- All PRs must pass `typecheck` + `test:run` + `build`.

## Releases

Automated via GitHub Actions. Push a tag, CI handles the rest:

```bash
git tag v0.2.0
git push origin v0.2.0
```

## Bugs & ideas

Open an issue at [github.com/arikusi/nakkas/issues](https://github.com/arikusi/nakkas/issues).
