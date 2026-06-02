## Related issue

Closes # <!-- issue number is required -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — code change without feature/fix
- [ ] `test` — adding or fixing tests
- [ ] `docs` — documentation only
- [ ] `chore` — build/tooling/deps
- [ ] `perf` — performance improvement

## What changed and why

<!-- What does this PR do? Why was this change needed? Be specific. -->

## Technical checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] `npm run test:arch` passes
- [ ] Coverage remains ≥ 85% (`npm run test:coverage`)
- [ ] No `console.log` left in production code
- [ ] No new `any` types introduced

## Architecture checklist

- [ ] `domain` and `ports` layers have zero imports from `adapters` or `application`
- [ ] No framework decorators or I/O in the domain layer
- [ ] New use cases implement a `Port` interface in `ports/driving/`
- [ ] New adapters implement the corresponding `Port` in `ports/driven/`
- [ ] InMemory adapter provided for any new repository port

## Branch checklist

- [ ] Branch created from `develop` (not from `main`)
- [ ] Branch name follows convention: `feature/`, `bugfix/`, or `hotfix/` + kebab-case (max 4 words)
- [ ] PR targets `develop` (not `main`)

## Screenshots / evidence

<!-- For API changes: paste a curl example or Postman screenshot.
     For behaviour changes: before/after if applicable.
     Delete this section if not relevant. -->

---

## Reviewer checklist

- [ ] Code matches the stated intent and the linked issue
- [ ] No business logic leaked into adapters
- [ ] Error cases handled and tested
- [ ] No sensitive data logged or exposed
