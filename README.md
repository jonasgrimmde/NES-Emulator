# NES Emulator

Electron desktop app for playing local NES `.nes` ROMs with `jsnes`.

The app is designed around local files. It does not ship ROMs, BIOS files, save data, or any copyrighted game content.

## Features

- Local NES ROM browser with folder navigation
- Direct `Open ROM` support for external `.nes` files
- ROM header and mapper compatibility metadata
- Start-on-demand behavior: single-click selects a game, `Start` or double-click loads it
- Four manual save slots per game
- Separate `Auto-Save` slot that overwrites itself
- Auto-save on interval, game switch, app close, page lifecycle, and emulator crash
- Settings modal stored in AppData
- Editable volume, resolution, controller keybinds, and app hotkeys
- Empty keybind support with `Delete`
- Custom release updater using GitHub Releases and `latest.yml`
- Inno Setup based Windows installer

## App Data

Runtime data is stored in:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\
```

Important folders and files:

```text
Games\          Local ROM library
Saves\          Manual saves and Auto-Save files
Temp\           Downloaded update installers
User Data\      Electron user data
settings.json   App settings
```

These folders are intentionally not part of the repository and are preserved by installer updates.

## Games

Put your own `.nes` ROM files into:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Games\
```

Subfolders are supported:

```text
Games\Mega Man\
Games\Sports\
Games\Homebrew\
```

The left-side browser only shows folders and compatible ROM file extensions. You can also use `Open ROM` to select a `.nes` file outside the library.

## Saves

Save files are stored in:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Saves\
```

Each game has:

- Slot 1
- Slot 2
- Slot 3
- Slot 4
- Auto-Save

Auto-Save is enabled by default and can be disabled in Settings.

## Settings

Settings are stored in:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\settings.json
```

Current settings include:

- Volume
- Gameplay resolution
- Auto-Save on/off
- Player 1 and Player 2 keybinds
- App hotkeys

Click a keybind to open the key capture modal. Press a key to assign it, or press `Delete` to clear that binding.

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Create an unpacked Windows build:

```bash
npm run pack
```

Build the Windows installer:

```bash
npm run dist
```

Compile only the Inno Setup installer from an existing `dist/win-unpacked` build:

```bash
npm run setup
```

Clean build output:

```bash
npm run clean
```

Repair Electron if installation was interrupted:

```bash
npm run repair:electron
```

## Release Workflow

The project uses a custom Node release script instead of GitHub Actions.

```bash
npm run release
```

This will:

- Bump the version in the `26.x.x` schema
- Build the unpacked app
- Build the Inno Setup installer
- Generate `dist/installer/latest.yml`
- Add SHA-256 and SHA-512 hashes to the manifest
- Create or reuse the GitHub release tag
- Upload the installer and `latest.yml`

Release configuration lives in `package.json`:

```json
"release": {
  "owner": "jonasgrimmde",
  "repo": "NES-Emulator",
  "latestUrl": "https://github.com/jonasgrimmde/NES-Emulator/releases/latest/download/latest.yml"
}
```

Authentication uses one of:

- `GH_TOKEN`
- `GITHUB_TOKEN`
- `gh auth token` from the GitHub CLI

Run `gh auth login` once if you want the script to work without manually setting an environment variable.

## Updater

On startup, the app checks:

```text
https://github.com/jonasgrimmde/NES-Emulator/releases/latest/download/latest.yml
```

If a newer version is available, the UI shows an update button and modal. The app downloads the installer into `Temp`, verifies hashes, starts the installer, and quits.

For the updater to work without embedding secrets, the release assets must be publicly downloadable.

## Public Repo Safety

Do not commit ROMs, BIOS files, saves, archives, `.env` files, tokens, or build output.

The `.gitignore` blocks common sensitive and generated files, including:

- `node_modules/`
- `dist/`
- `.env`
- key/certificate files
- ROM extensions like `.nes`
- `Games/`
- `Saves/`
- `TAS/`

If you are making this repository public, use a clean Git history. Do not publish old history that contained ROMs or other copyrighted game files.
