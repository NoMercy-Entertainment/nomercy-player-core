# Releasing @nomercy-entertainment/nomercy-player-core

This file is the release runbook for the whole player trio. The video and music
RELEASING.md files cover only their package-specific steps and point back here for
the shared choreography.

## RC publish (current)

All three packages in the trio publish under the `rc` dist-tag. This is controlled by
`publishConfig.tag: "rc"` in each `package.json`. A consumer gets the release candidate
by running:

```
npm install @nomercy-entertainment/nomercy-player-core@rc
```

Watch out: a plain `npm install` without the tag does not fail. For this package it
resolves `2.0.0-rc.2`, which was published to `latest` before `publishConfig.tag` existed.
For video and music it resolves their old v1 line. Publishing `2.0.0` to `latest`
heals all of this; until then, always install with an explicit tag or version.

## Stable 2.0.0 flip checklist

Publish order matters: video and music build against the published core (their build
scripts run from `node_modules/@nomercy-entertainment/nomercy-player-core/scripts`),
so core goes first and the consumers refresh their lockfiles before they publish.

1. Preflight every package: `npm run typecheck`, `npm run lint`, `npm test`, and
   `npm run build:all` (plain `build` for core) must be green. Pack each package with
   `npm pack` and import every subpath export from the tarball with raw Node.
2. Bump the version to `2.0.0` in all three `package.json` files.
3. Remove `"tag": "rc"` from `publishConfig` in all three. Leaving it in place while
   publishing without `--tag latest` keeps stable installs broken.
4. Update the `@nomercy-entertainment/nomercy-player-core` range in video and music
   to `^2.0.0`. The rc range already matches stable, so this is convention, not mechanics.
5. Add a `[2.0.0]` entry to each CHANGELOG.md summarizing the road from the last rc.
6. Publish `@nomercy-entertainment/eslint-plugin-player` (first publish of the standalone
   rules package), then switch the eslint.config.js import in all three packages to it as
   a devDependency. Core stopped shipping its embedded `./eslint-plugin` export; video and
   music still import that subpath from the older published core, which breaks the moment
   they bump to the stable core, so this switch lands in the same pass as the version bump.
7. Publish core. Then in video and music run `npm update @nomercy-entertainment/nomercy-player-core`
   so their lockfiles and build scripts pick up the stable core, and publish both.
8. Tag each repo: `git tag v2.0.0 && git push origin v2.0.0`.
9. Flip the docs-site quickstart install commands from `@rc` to the bare package name
   (nomercy-player-core, nomercy-video-player, and nomercy-music-player quickstart pages).
10. Verify from the outside: `npm view` shows `latest: 2.0.0` for all three, a fresh
    `npm install` of each package imports cleanly, and the CDN bundle
    (`dist/*.iife.js`) is present in the published tarball.

## Cross-package version range

During the rc phase, video and music declare a caret range on a prerelease of this
package (currently `^2.0.0-rc.24`). That range matches every later rc and the eventual
`2.0.0` stable, so the flip needs no range change to keep resolving; step 4 above is
about convention only.

There is no npm or yarn workspace in the monorepo root. The testbed consumes all three
packages through `file:` links, and video and music consume the published core from the
registry, in the monorepo exactly as in CI.
