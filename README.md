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
- Linux AppImage build

## Installation

### Windows

Use the PowerShell install script:

```powershell
iwr -useb https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.ps1 | iex
```

Check installation status:

```powershell
iex "& { $(iwr -useb https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.ps1) } status"
```

Uninstall the app:

```powershell
iex "& { $(iwr -useb https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.ps1) } uninstall"
```

Manual installer download:

Download the latest Windows installer from GitHub Releases:

```text
NES-Emulator-Windows-Setup.exe
```

Run the installer and start `NES Emulator` from the Start menu or desktop shortcut.

### Linux

Use the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh
```

Alternative with `wget`:

```bash
wget -qO- https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh
```

The script downloads the latest AppImage from GitHub Releases, installs it into your user profile, creates a `nes-emulator` command, and adds a desktop launcher.

After installation, start it from your app launcher or run:

```bash
nes-emulator
```

Check installation status:

```bash
curl -fsSL https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh -s -- status
```

Uninstall the Linux AppImage, launcher, command, and icon:

```bash
curl -fsSL https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh -s -- uninstall
```

The uninstall command keeps your games, saves, and settings in `~/.config/jonasgrimm.de/NES Emulator/`.

Manual AppImage install:

```bash
chmod +x NES-Emulator-Linux.AppImage
./NES-Emulator-Linux.AppImage
```

If your Linux distribution cannot start AppImages, install FUSE support first. On Ubuntu/Debian:

```bash
sudo apt install libfuse2
```

## App Data

### Windows

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

### Linux

Runtime data is stored in:

```text
~/.config/jonasgrimm.de/NES Emulator/
```

Important folders and files:

```text
Games/          Local ROM library
Saves/          Manual saves and Auto-Save files
Temp/           Downloaded update files
User Data/      Electron user data
settings.json   App settings
```

These folders are intentionally not part of the repository and are preserved by installer updates.

## Games

Put your own `.nes` ROM files into:

Windows:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Games\
```

Linux:

```text
~/.config/jonasgrimm.de/NES Emulator/Games/
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

Windows:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Saves\
```

Linux:

```text
~/.config/jonasgrimm.de/NES Emulator/Saves/
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

Windows:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\settings.json
```

Linux:

```text
~/.config/jonasgrimm.de/NES Emulator/settings.json
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
npm run pack:win
```

Build the Windows installer:

```bash
npm run dist
```

Build a Linux AppImage on Linux:

```bash
npm run dist:linux
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

The project uses a custom Node release script for Windows and a GitHub Actions workflow for Linux AppImage packaging.

```bash
npm run release
```

This will:

- Bump the version in the `26.x.x` schema
- Build the Windows unpacked app
- Build the Inno Setup installer
- Generate `dist/installer/latest.yml`
- Add SHA-256 and SHA-512 hashes to the manifest
- Create or reuse the GitHub release tag
- Upload the Windows installer and `latest.yml`
- Trigger the `Linux AppImage Release` GitHub Actions workflow

The Linux workflow will:

- Build `NES-Emulator-Linux.AppImage` on Ubuntu
- Upload it to the same GitHub release
- Update `latest.yml` with Linux AppImage download and hash fields

The Linux workflow can also be run manually from GitHub Actions:

```text
Actions -> Linux AppImage Release -> Run workflow
```

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

If a newer version is available, the UI shows an update button and modal.

On Windows, the app downloads the installer into `Temp`, verifies hashes, starts the installer, and quits.

On Linux, the app shows that an update is available and opens the latest GitHub Release. Linux users can update with the same install command:

```bash
curl -fsSL https://raw.githubusercontent.com/jonasgrimmde/NES-Emulator/refs/heads/main/install.sh | sh
```

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
