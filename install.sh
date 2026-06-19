#!/usr/bin/env sh
set -eu

APP_NAME="NES Emulator"
APP_ID="de.jonasgrimm.nesemulator"
REPO="jonasgrimmde/NES-Emulator"
APPIMAGE_URL="https://github.com/${REPO}/releases/latest/download/NES-Emulator-Linux.AppImage"
ICON_URL="https://raw.githubusercontent.com/${REPO}/refs/heads/main/build/icons/app.png"

INSTALL_DIR="${XDG_DATA_HOME:-"$HOME/.local/share"}/nes-emulator"
BIN_DIR="$HOME/.local/bin"
APPLICATIONS_DIR="${XDG_DATA_HOME:-"$HOME/.local/share"}/applications"
ICON_DIR="${XDG_DATA_HOME:-"$HOME/.local/share"}/icons/hicolor/256x256/apps"

APPIMAGE_PATH="$INSTALL_DIR/NES-Emulator.AppImage"
BIN_PATH="$BIN_DIR/nes-emulator"
DESKTOP_PATH="$APPLICATIONS_DIR/${APP_ID}.desktop"
ICON_PATH="$ICON_DIR/${APP_ID}.png"

download() {
  url="$1"
  target="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL "$url" -o "$target"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$target" "$url"
  else
    echo "Install curl or wget first." >&2
    exit 1
  fi
}

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPLICATIONS_DIR" "$ICON_DIR"

tmp_appimage="$(mktemp)"
tmp_icon="$(mktemp)"
trap 'rm -f "$tmp_appimage" "$tmp_icon"' EXIT

echo "Downloading ${APP_NAME}..."
download "$APPIMAGE_URL" "$tmp_appimage"
chmod +x "$tmp_appimage"
mv "$tmp_appimage" "$APPIMAGE_PATH"

echo "Installing icon..."
if download "$ICON_URL" "$tmp_icon"; then
  mv "$tmp_icon" "$ICON_PATH"
else
  rm -f "$tmp_icon"
fi

cat > "$BIN_PATH" <<EOF
#!/usr/bin/env sh
exec "$APPIMAGE_PATH" "\$@"
EOF
chmod +x "$BIN_PATH"

cat > "$DESKTOP_PATH" <<EOF
[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=Local NES emulator desktop app
Exec=${APPIMAGE_PATH} %U
Icon=${APP_ID}
Terminal=false
Categories=Game;Emulator;
StartupWMClass=NES Emulator
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi

echo "${APP_NAME} installed."
echo "Run it from your app launcher or with: nes-emulator"
if ! printf '%s' ":$PATH:" | grep -q ":$BIN_DIR:"; then
  echo "Note: $BIN_DIR is not in PATH. Restart your shell or add it to PATH to use the nes-emulator command."
fi
