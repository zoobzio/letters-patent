# letters-patent

A pnpm monorepo. Publishable packages live in [`packages/`](./packages);
framework bridges live in [`integrations/`](./integrations).

## Development

```sh
make install    # install workspace dependencies
make stub       # link packages to source for dev
make check      # lint + typecheck + test
make help       # list all targets
```

Releases are versioned with [changesets](./.changeset) and cut manually via
the Release workflow.
