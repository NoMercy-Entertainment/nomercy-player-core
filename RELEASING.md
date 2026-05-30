# Releasing @nomercy-entertainment/nomercy-player-core

## Beta publish (current)

All three packages in the trio publish under the `beta` dist-tag. This is controlled by
`publishConfig.tag: "beta"` in each `package.json`. A consumer gets the beta by running:

```
npm install @nomercy-entertainment/nomercy-player-core@beta
```

A plain `npm install @nomercy-entertainment/nomercy-player-core` resolves nothing until a
stable version is published under the `latest` tag.

## Stable 2.0.0 flip checklist

When the beta period ends and 2.0.0 is ready for general availability:

1. Bump version to `2.0.0` in all three package.json files (`nomercy-player-core`,
   `nomercy-video-player`, `nomercy-music-player`).
2. Remove `"tag": "beta"` from `publishConfig` in all three, OR publish with
   `npm publish --tag latest`. Leaving `tag: "beta"` without the override means
   `npm install <pkg>` still resolves nothing under `latest`.
3. Update the `@nomercy-entertainment/nomercy-player-core` dependency range in
   `nomercy-video-player` and `nomercy-music-player` from `^2.0.0-beta.0` to `^2.0.0`
   (both satisfy the same constraint, but `^2.0.0` is the conventional stable form).
4. Tag each repo: `git tag v2.0.0 && git push origin v2.0.0`.
5. Publish in dependency order: core first, then video and music.

## Cross-package version range

During beta, video and music declare:

```json
{
	"dependencies": {
		"@nomercy-entertainment/nomercy-player-core": "^2.0.0-beta.0"
	}
}
```

`^2.0.0-beta.0` matches `>=2.0.0-beta.0 <3.0.0-0`, which covers every `2.0.0-beta.x`
prerelease AND the eventual `2.0.0` stable — so no range change is required at stable flip
(step 3 above is cosmetic/conventional, not mechanical).

In the yarn classic workspace the range resolves to the local `packages/nomercy-player-kit`
workspace package regardless, so local development is unaffected.
