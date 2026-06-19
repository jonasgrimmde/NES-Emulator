# NES Emulator

Electron desktop app for playing local NES `.nes` ROMs with `jsnes`.

The app is designed around local files. It does not ship ROMs, BIOS files, save data, or copyrighted game content.

## Features

- Local NES ROM browser with folder navigation
- Direct `Open ROM` support for external `.nes` files
- ROM header and mapper compatibility metadata
- Four manual save slots plus Auto-Save
- Auto-save on interval, game switch, app close, page lifecycle, and emulator crash
- Settings for volume, resolution, CRT shader, autosave, Discord RPC, keybinds, and hotkeys
- GitHub Releases updater using `latest.yml`
- Windows installer and Linux AppImage releases

## Install

### Windows

```powershell
iwr -useb https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.ps1 | iex
```

This installs or updates the latest Windows build. The same script also supports `status` and `uninstall` when run with an argument.

Manual download: `NES-Emulator-Windows-Setup.exe` from the latest GitHub Release.

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh
```

This installs or updates the latest AppImage, adds a `nes-emulator` command, and creates a desktop launcher. The same script also supports `status` and `uninstall` with `sh -s -- status` or `sh -s -- uninstall`.

Manual download: `NES-Emulator-Linux.AppImage` from the latest GitHub Release.

## App Data

Windows:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\
```

Linux:

```text
~/.config/jonasgrimm.de/NES Emulator/
```

Important files and folders:

```text
Games/          Local ROM library
Saves/          Manual saves and Auto-Save files
Temp/           Downloaded update files
User Data/      Electron user data
settings.json   App settings
```

Put your own `.nes` ROMs into the `Games` folder. Subfolders are supported. Saves are stored in `Saves` and are preserved across updates.

## Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run preflight      # syntax checks
npm run pack:win       # unpacked Windows build
npm run dist           # Windows installer
npm run dist:linux     # Linux AppImage, run on Linux/CI
npm run clean          # remove dist output
```

## Release

```bash
npm run release
```

This bumps the version, builds the Windows installer, creates or updates the GitHub Release, uploads `NES-Emulator-Windows-Setup.exe` and `latest.yml`, then triggers the `Linux AppImage Release` GitHub Actions workflow.

The Linux workflow builds `NES-Emulator-Linux.AppImage` on Ubuntu, uploads it to the same release, and updates `latest.yml` with Linux asset metadata.

Release auth uses `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth token` from the GitHub CLI.

## Updates

The app checks:

```text
https://github.com/jonasgrimmde/NES-Emulator/releases/latest/download/latest.yml
```

Windows updates download and start the verified installer. Linux updates show the install command so users can copy and run it in a terminal.
