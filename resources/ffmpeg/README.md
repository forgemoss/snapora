# Bundled ffmpeg

Snapora ships a static **ffmpeg** binary in `resources/bin/ffmpeg-{arm64,x64}` so the screen-recording feature works without asking users to install anything. The binaries live outside `git` (see `.gitignore` at `resources/bin/`); they are fetched by `npm run prepare:resources`, which is chained from `postinstall`.

## Source

- **Provider:** [evermeet.cx](https://evermeet.cx/ffmpeg/) — long-running OSS service shipping macOS static ffmpeg builds.
- **Why this provider:** static (no dylib deps, so signing/notarization works), well-known to the macOS dev community.
- **Architecture:** evermeet currently publishes **x86_64** only. On Apple silicon Macs the binary runs via Rosetta 2 — performance is good enough for screen recording (Rosetta JIT keeps within ~10% of native for ffmpeg's pipeline). When an arm64-native static upstream stabilizes (osxexperts.net is the most likely candidate), bump the `arm64` URL in `scripts/manifest.json` and clear its sha to refresh.
- **Version pin + sha256:** locked in `scripts/manifest.json`. The first invocation of the prepare script writes the discovered sha back into the manifest; subsequent runs hard-fail on mismatch.

## License

ffmpeg's static evermeet.cx builds are LGPL 2.1+ (see `LICENSE` next to this file). Snapora's MIT-licensed code links no ffmpeg sources at compile time — we ship the upstream binary, which is the explicit redistribution model the LGPL allows. Source for the bundled version is recoverable from <https://www.ffmpeg.org/download.html>.

## Updating

```bash
# Bump the version in scripts/manifest.json, blank out the sha256s.
npm run prepare:resources -- --all-archs   # writes the new shas back
git add scripts/manifest.json resources/ffmpeg
```

## What it's used for

- Screen recording (region / display / window) → mp4 via `h264_videotoolbox`
- Microphone audio capture (avfoundation)
- GIF export from existing recordings (palette method)
- Trimming (`-ss` / `-t`, stream copy when possible)

See `docs/adr/0004-bundling-ffmpeg.md` for the full architecture decision.
