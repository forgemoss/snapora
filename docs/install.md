# Installing Snapora

Snapora supports two installation paths today, with a third coming once we ship signed builds.

## Requirements

- macOS 13 (Ventura) or later
- Apple silicon (M1/M2/M3/M4) or Intel — both arches are shipped

## Why "first install" is a little awkward (for now)

Snapora pre-v1.0 releases are **unsigned**. macOS will warn you on first launch with one of two messages:

> _"Snapora.app" is damaged and can't be opened. You should move it to the Trash._
>
> _"Snapora.app" can't be opened because it is from an unidentified developer._

Both are misleading — the app isn't damaged or malicious, it just hasn't been signed with an Apple Developer ID certificate (a $99/yr Apple service). We'll add signing before v1.0 ships. Until then, you can clear the warning with **one Terminal command** described below.

If that's a deal-breaker for you, watch the repo and wait for v1.0 — by then installs will be one-click.

---

## Option 1: Direct DMG download

1. Download the latest `Snapora-<version>-arm64.dmg` (or `-x64.dmg` for Intel) from [Releases](https://github.com/forgemoss/Snapora/releases).
2. Double-click the DMG and drag **Snapora** to Applications.
3. Open **Terminal** and run:

   ```bash
   xattr -cr /Applications/Snapora.app
   ```

   This removes macOS's "quarantine" attribute that triggers the unsigned-app warning. Run it once per install — not per launch.

4. Open Snapora from Applications. The first-run wizard walks you through the macOS permissions (Screen Recording is required).

## Option 2 (post v1.0): the homebrew-cask main repo

Once Snapora is signed and notarized, we'll submit to the main Homebrew Cask repo:

```bash
brew install --cask snapora    # zero setup, zero warnings
```

No tap needed. Until then, use the direct DMG above.

## Build from source

If you'd rather compile your own binary (which is automatically trusted by macOS, since you signed it locally), see the **Build from source** section in the [README](../README.md#build-from-source).

## What about the "Privacy & Security" panel?

Some macOS versions show the warning in **System Settings → Privacy & Security** as a "Snapora was blocked" notice with an "Open Anyway" button. Click that and you're good — no Terminal needed. The `xattr` command above is just the same workflow done from the keyboard.

## Troubleshooting

**"Snapora is damaged"** → run `xattr -cr /Applications/Snapora.app` and try again.

**Hotkeys don't work after install** → grant **Screen Recording** permission in System Settings → Privacy & Security, then **quit and relaunch** Snapora. macOS quirk: TCC grants only take effect after restart.

**Capture works but image isn't saved** → check Settings → General → Save folder. Default is `~/Pictures/Snapora`.

Anything else? [Open an issue](https://github.com/forgemoss/Snapora/issues/new/choose) with macOS version + error message.
