# examples

- [`patents`](./patents) — the Acme contract as a package: the standard
  documents under `src/`, `patent build` writing to `.dist/`, and
  `exports` pointing at the built modules, so an app names it as a preset.
- [`nuxt`](./nuxt) — the Acme app over that preset, with stubbed
  authentication: demo accounts behind a cookie, guarded pages, and the
  manifest and issuer the kit built rendered on the overview.
