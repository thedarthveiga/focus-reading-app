## What changed

<!-- Brief description of what this PR does -->

## Why

<!-- Context and motivation -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — code change without feature/fix
- [ ] `test` — adding or fixing tests
- [ ] `docs` — documentation only
- [ ] `chore` — build/tooling/deps

## Architecture checklist

- [ ] No imports from `adapters` inside `domain`, `ports`, or `application`
- [ ] No framework decorators or I/O in the domain layer
- [ ] New use cases implement a `Port` interface
- [ ] New adapters implement the corresponding `Port`
- [ ] In-memory adapter available for new repositories

## Tests

- [ ] Unit tests cover the happy path and main error cases
- [ ] Integration tests cover the HTTP endpoint(s) affected
- [ ] Architecture tests still pass (`npm run test:arch`)
- [ ] Coverage remains ≥ 85%
