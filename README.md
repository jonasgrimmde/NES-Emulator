# NES Emulator

Electron desktop app for local `.nes` games.

## Games

Put ROM files into:

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Games\
```

The app scans that folder automatically on startup.

Subfolders are supported, so you can organize games like:

```text
Games\Super Mario\
Games\Mega Man\
Games\Sports\
```

The app also has an `Open ROM` button for opening a `.nes` file directly without copying it into `Games`.

## Saves

Save slots are stored as JSON files in a `Saves` folder next to the app.

```text
%APPDATA%\jonasgrimm.de\NES Emulator\Saves\
```

## Commands

Run the app during development:

```bash
npm run dev
```

Create an unpacked Windows build:

```bash
npm run pack
```

Create the Windows installer:

```bash
npm run dist
```

This uses `create-setup.iss` and Inno Setup. Install Inno Setup 6 or add `ISCC.exe` to PATH before running it.

Compile the Inno Setup installer from an existing `dist/win-unpacked` build:

```bash
npm run setup
```

Clean build output:

```bash
npm run clean
```

If Electron ever says it failed to install correctly:

```bash
npm run repair:electron
```

Packaged builds do not include `.nes` files. Put your ROMs into the `Games` folder.
