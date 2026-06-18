const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const externalGames = new Map();
let latestUpdate = null;
const defaultSettings = {
  schemaVersion: 1,
  audio: {
    volume: 80,
  },
  video: {
    resolution: "fit",
  },
  autosave: {
    enabled: true,
    intervalSeconds: 10,
  },
  keybinds: {
    p1: {
      A: { keyCode: 88, label: "X" },
      B: { keyCode: 90, label: "Z" },
      SELECT: { keyCode: 17, label: "Right Ctrl" },
      START: { keyCode: 13, label: "Enter" },
      UP: { keyCode: 38, label: "Up" },
      DOWN: { keyCode: 40, label: "Down" },
      LEFT: { keyCode: 37, label: "Left" },
      RIGHT: { keyCode: 39, label: "Right" },
      TURBO_A: { keyCode: 83, label: "S" },
      TURBO_B: { keyCode: 65, label: "A" },
    },
    p2: {
      A: { keyCode: 103, label: "Num-7" },
      B: { keyCode: 105, label: "Num-9" },
      SELECT: { keyCode: 99, label: "Num-3" },
      START: { keyCode: 97, label: "Num-1" },
      UP: { keyCode: 104, label: "Num-8" },
      DOWN: { keyCode: 98, label: "Num-2" },
      LEFT: { keyCode: 100, label: "Num-4" },
      RIGHT: { keyCode: 102, label: "Num-6" },
    },
  },
  hotkeys: {
    pause: { keyCode: 80, label: "P" },
    quickSave: { keyCode: 117, label: "F6" },
    quickLoad: { keyCode: 118, label: "F7" },
    fullscreen: { keyCode: 122, label: "F11" },
  },
};
const supportedMappers = new Set([0, 1, 2, 3, 4, 5, 7, 9, 11, 34, 38, 66, 71, 79, 94, 118, 119, 140, 180, 240, 241]);
const mapperNames = {
  0: "NROM",
  1: "MMC1",
  2: "UxROM",
  3: "CNROM",
  4: "MMC3",
  5: "MMC5",
  7: "AxROM",
  9: "MMC2",
  11: "Color Dreams",
  34: "BNROM",
  38: "PCI556",
  66: "GxROM",
  71: "Camerica",
  79: "NINA",
  94: "UN1ROM",
  118: "TxSROM",
  119: "TQROM",
  140: "Jaleco",
  180: "UNROM",
  240: "Mapper 240",
  241: "BxROM",
};

function slug(value) {
  return String(value || "game")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "game";
}

function gameIdFromRelativePath(relativePath) {
  const hash = crypto.createHash("sha1").update(relativePath).digest("hex").slice(0, 10);
  return `library-${slug(relativePath)}-${hash}`;
}

function gameIdFromExternalPath(filePath) {
  const hash = crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 10);
  return `external-${slug(path.basename(filePath))}-${hash}`;
}

function titleFromName(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || name;
}

function readRomMeta(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    if (bytesRead < 16 || header.toString("ascii", 0, 4) !== "NES\u001a") {
      return {
        validHeader: false,
        label: "Invalid NES header",
        compatibility: "bad-header",
      };
    }

    const flags6 = header[6];
    const flags7 = header[7];
    const isNes2 = (flags7 & 0x0c) === 0x08;
    const mapper = (flags6 >> 4) | (flags7 & 0xf0) | (isNes2 ? ((header[8] & 0x0f) << 8) : 0);
    const region = header[9] & 1 ? "PAL" : "NTSC";
    const supported = supportedMappers.has(mapper);
    const mapperName = mapperNames[mapper] || `Mapper ${mapper}`;
    return {
      validHeader: true,
      format: isNes2 ? "NES 2.0" : "iNES",
      mapper,
      mapperName,
      mapperSupported: supported,
      prgKb: header[4] * 16,
      chrKb: header[5] * 8,
      region,
      trainer: Boolean(flags6 & 0x04),
      label: `M${mapper} ${mapperName} - ${region}`,
      compatibility: supported ? "supported" : "unsupported-mapper",
    };
  } catch (error) {
    return {
      validHeader: false,
      label: "ROM info unavailable",
      compatibility: "unknown",
    };
  }
}

function getAppRootDir() {
  const roamingDir = process.env.APPDATA || app.getPath("appData");
  return path.join(roamingDir, "jonasgrimm.de", "NES Emulator");
}

function getGamesDir() {
  return path.join(getAppRootDir(), "Games");
}

function getTempDir() {
  return path.join(getAppRootDir(), "Temp");
}

function getSettingsPath() {
  return path.join(getAppRootDir(), "settings.json");
}

function getPackageConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  } catch (error) {
    return {};
  }
}

function getWindowTitle() {
  return `NES Emulator (${app.getVersion()})`;
}

function getWindowIconPath() {
  return path.join(__dirname, "..", "build", "icons", "app.ico");
}

function resolveInside(baseDir, relativeDir = "") {
  const safeRelativeDir = String(relativeDir || "").replace(/^[/\\]+/, "");
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(resolvedBase, safeRelativeDir);
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(resolvedBase + path.sep)) {
    throw new Error("Invalid folder.");
  }
  return resolvedPath;
}

function toRelativePath(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function ensureAppDirs() {
  fs.mkdirSync(getAppRootDir(), { recursive: true });
  fs.mkdirSync(getGamesDir(), { recursive: true });
  fs.mkdirSync(getSavesDir(), { recursive: true });
  fs.mkdirSync(getTempDir(), { recursive: true });
}

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(defaultSettings));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(base, override) {
  const result = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!isPlainObject(override)) {
    return result;
  }
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? mergeSettings(result[key], value)
      : value;
  }
  return result;
}

function sanitizeKeybinds(settings) {
  const defaults = cloneDefaultSettings();
  settings.keybinds = isPlainObject(settings.keybinds) ? settings.keybinds : {};
  settings.hotkeys = isPlainObject(settings.hotkeys) ? settings.hotkeys : {};
  for (const group of ["p1", "p2"]) {
    settings.keybinds[group] = isPlainObject(settings.keybinds[group]) ? settings.keybinds[group] : {};
    for (const [button, fallback] of Object.entries(defaults.keybinds[group])) {
      const keybind = settings.keybinds && settings.keybinds[group] && settings.keybinds[group][button];
      if (keybind === null) {
        settings.keybinds[group][button] = null;
        continue;
      }
      const keyCode = Number(keybind && keybind.keyCode);
      settings.keybinds[group][button] = {
        keyCode: Number.isInteger(keyCode) ? keyCode : fallback.keyCode,
        label: String((keybind && keybind.label) || fallback.label),
      };
    }
  }
  for (const [action, fallback] of Object.entries(defaults.hotkeys)) {
    const hotkey = settings.hotkeys && settings.hotkeys[action];
    if (hotkey === null) {
      settings.hotkeys[action] = null;
      continue;
    }
    const keyCode = Number(hotkey && hotkey.keyCode);
    settings.hotkeys[action] = {
      keyCode: Number.isInteger(keyCode) ? keyCode : fallback.keyCode,
      label: String((hotkey && hotkey.label) || fallback.label),
    };
  }
}

function normalizeSettings(input = {}) {
  const settings = mergeSettings(cloneDefaultSettings(), input);
  const volume = Number(settings.audio && settings.audio.volume);
  settings.audio.volume = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : defaultSettings.audio.volume;
  const allowedResolutions = new Set(["fit", "1x", "2x", "3x", "4x"]);
  settings.video.resolution = allowedResolutions.has(settings.video && settings.video.resolution)
    ? settings.video.resolution
    : defaultSettings.video.resolution;
  settings.autosave = isPlainObject(settings.autosave) ? settings.autosave : {};
  settings.autosave.enabled = typeof settings.autosave.enabled === "boolean"
    ? settings.autosave.enabled
    : defaultSettings.autosave.enabled;
  const intervalSeconds = Number(settings.autosave.intervalSeconds);
  settings.autosave.intervalSeconds = Number.isFinite(intervalSeconds)
    ? Math.min(120, Math.max(3, Math.round(intervalSeconds)))
    : defaultSettings.autosave.intervalSeconds;
  sanitizeKeybinds(settings);
  settings.schemaVersion = defaultSettings.schemaVersion;
  return settings;
}

function readSettings() {
  ensureAppDirs();
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    const settings = cloneDefaultSettings();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    return { settings, path: settingsPath };
  }
  try {
    const settings = normalizeSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    return { settings, path: settingsPath };
  } catch (error) {
    const backupPath = `${settingsPath}.broken-${Date.now()}`;
    fs.renameSync(settingsPath, backupPath);
    const settings = cloneDefaultSettings();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    return { settings, path: settingsPath, repairedFrom: backupPath };
  }
}

function writeSettings(settings) {
  ensureAppDirs();
  const normalized = normalizeSettings(settings);
  fs.writeFileSync(getSettingsPath(), JSON.stringify(normalized, null, 2), "utf8");
  return { settings: normalized, path: getSettingsPath() };
}

function resetSettings() {
  return writeSettings(cloneDefaultSettings());
}

function getDefaultSettings() {
  return cloneDefaultSettings();
}

function parseLatestManifest(text) {
  const manifest = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const key = match[1];
    let value = match[2].trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = JSON.parse(value);
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    }
    manifest[key] = value;
  }
  return manifest;
}

function compareVersions(left, right) {
  const leftParts = String(left || "0.0.0").split(".").map((part) => Number(part) || 0);
  const rightParts = String(right || "0.0.0").split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

function getUpdaterConfig() {
  const packageConfig = getPackageConfig();
  const release = packageConfig.release || {};
  const owner = process.env.GITHUB_OWNER || release.owner;
  const repo = process.env.GITHUB_REPO || release.repo;
  return {
    latestUrl: process.env.NES_EMULATOR_LATEST_URL || release.latestUrl,
    releasesUrl: owner && repo ? `https://github.com/${owner}/${repo}/releases` : null,
  };
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const config = getUpdaterConfig();
  if (!config.latestUrl) {
    return {
      available: false,
      currentVersion,
      error: "Update URL is not configured.",
      manualUrl: config.releasesUrl,
    };
  }

  try {
    const response = await fetch(config.latestUrl, {
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "nes-emulator-updater",
      },
    });
    if (!response.ok) {
      return {
        available: false,
        currentVersion,
        error: `Update check failed: ${response.status} ${response.statusText}`,
        manualUrl: config.releasesUrl,
      };
    }

    const manifest = parseLatestManifest(await response.text());
    if (!manifest.version || !manifest.url || !manifest.sha256 || !manifest.sha512 || !manifest.path) {
      return {
        available: false,
        currentVersion,
        error: "Update manifest is incomplete.",
        manualUrl: config.releasesUrl,
      };
    }

    latestUpdate = {
      currentVersion,
      latestVersion: manifest.version,
      releaseDate: manifest.releaseDate || null,
      url: manifest.url,
      path: path.basename(manifest.path),
      sha256: manifest.sha256,
      sha512: manifest.sha512,
      size: manifest.size || null,
      manualUrl: config.releasesUrl,
    };

    return Object.assign({
      available: compareVersions(manifest.version, currentVersion) > 0,
    }, latestUpdate);
  } catch (error) {
    return {
      available: false,
      currentVersion,
      error: error.message || String(error),
      manualUrl: config.releasesUrl,
    };
  }
}

function verifyFile(filePath, expectedSha256, expectedSha512) {
  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const sha512 = crypto.createHash("sha512").update(bytes).digest("base64");
  if (sha256 !== expectedSha256 || sha512 !== expectedSha512) {
    throw new Error("Downloaded update failed hash verification.");
  }
}

async function downloadAndInstallUpdate() {
  if (!latestUpdate || compareVersions(latestUpdate.latestVersion, latestUpdate.currentVersion) <= 0) {
    await checkForUpdates();
  }
  if (!latestUpdate || compareVersions(latestUpdate.latestVersion, app.getVersion()) <= 0) {
    return {
      started: false,
      message: "No update is available.",
    };
  }

  ensureAppDirs();
  const targetPath = path.join(getTempDir(), latestUpdate.path);
  const response = await fetch(latestUpdate.url, {
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "nes-emulator-updater",
    },
  });
  if (!response.ok) {
    throw new Error(`Update download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
  verifyFile(targetPath, latestUpdate.sha256, latestUpdate.sha512);

  const child = spawn(targetPath, ["/SILENT", "/NORESTART"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  app.quit();
  return {
    started: true,
  };
}

function safeId(value) {
  return String(value || "default")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function safeSlot(value) {
  if (value === "auto") {
    return "auto";
  }
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
    throw new Error("Invalid save slot.");
  }
  return slot;
}

function getSavesDir() {
  return path.join(getAppRootDir(), "Saves");
}

function getSavePath(gameId, slot) {
  const normalizedSlot = safeSlot(slot);
  const suffix = normalizedSlot === "auto" ? "autosave" : `slot-${normalizedSlot}`;
  return path.join(getSavesDir(), `${safeId(gameId)}-${suffix}.json`);
}

function ensureSavesDir() {
  fs.mkdirSync(getSavesDir(), { recursive: true });
}

function gameFromFile(filePath, baseDir) {
  const filename = path.basename(filePath);
  const relativePath = toRelativePath(baseDir, filePath);
  const folder = path.dirname(relativePath).split(path.sep).join("/");
  return {
    id: gameIdFromRelativePath(relativePath),
    title: titleFromName(filename),
    filename,
    relativePath,
    folder: folder === "." ? "" : folder,
    source: "library",
    meta: readRomMeta(filePath),
  };
}

function directoryFromEntry(dirPath, baseDir, name) {
  return {
    type: "folder",
    name,
    relativePath: toRelativePath(baseDir, dirPath),
  };
}

function listGameDirectory(relativeDir = "") {
  ensureAppDirs();
  const gamesDir = getGamesDir();
  const currentPath = resolveInside(gamesDir, relativeDir);
  if (!fs.existsSync(currentPath) || !fs.statSync(currentPath).isDirectory()) {
    throw new Error("Folder not found.");
  }

  const currentDir = toRelativePath(gamesDir, currentPath);
  const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.toLowerCase().endsWith(".nes")))
    .map((entry) => {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        return directoryFromEntry(entryPath, gamesDir, entry.name);
      }
      return Object.assign({ type: "game" }, gameFromFile(entryPath, gamesDir));
    })
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      const aName = a.type === "folder" ? a.name : a.title;
      const bName = b.type === "folder" ? b.name : b.title;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });

  const parentDir = currentDir ? path.dirname(currentDir).split(path.sep).join("/") : "";
  return {
    currentDir: currentDir === "." ? "" : currentDir,
    parentDir: parentDir === "." ? "" : parentDir,
    entries,
  };
}

function walkGames(dir, baseDir, games = []) {
  if (!fs.existsSync(dir)) {
    return games;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkGames(entryPath, baseDir, games);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".nes")) {
      games.push(gameFromFile(entryPath, baseDir));
    }
  }

  return games;
}

function listGames() {
  ensureAppDirs();
  const gamesDir = getGamesDir();
  return walkGames(gamesDir, gamesDir)
    .sort((a, b) => {
      const folderCompare = a.folder.localeCompare(b.folder);
      return folderCompare || a.title.localeCompare(b.title);
    });
}

function findGameById(id) {
  return listGames().find((game) => game.id === id) || externalGames.get(id) || null;
}

function getRomPath(game) {
  if (game.source === "external") {
    return game.filePath;
  }
  return path.join(getGamesDir(), game.relativePath || game.filename);
}

function externalGameFromPath(filePath) {
  const filename = path.basename(filePath);
  return {
    id: gameIdFromExternalPath(filePath),
    title: titleFromName(filename),
    filename,
    relativePath: filePath,
    folder: "Opened file",
    source: "external",
    filePath,
    meta: readRomMeta(filePath),
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    title: getWindowTitle(),
    icon: getWindowIconPath(),
    backgroundColor: "#090909",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.setPath("userData", path.join(getAppRootDir(), "User Data"));

app.whenReady().then(() => {
  ensureAppDirs();

  ipcMain.handle("games:listDirectory", (_event, relativeDir) => listGameDirectory(relativeDir));
  ipcMain.handle("games:list", () => listGames());
  ipcMain.handle("settings:read", () => readSettings());
  ipcMain.handle("settings:write", (_event, settings) => writeSettings(settings));
  ipcMain.handle("settings:reset", () => resetSettings());
  ipcMain.handle("settings:defaults", () => getDefaultSettings());
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:openExternal", async (_event, url) => {
    const parsedUrl = new URL(String(url));
    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      throw new Error("External URL is not allowed.");
    }
    await shell.openExternal(parsedUrl.toString());
    return true;
  });
  ipcMain.handle("updates:check", () => checkForUpdates());
  ipcMain.handle("updates:downloadAndInstall", () => downloadAndInstallUpdate());
  ipcMain.handle("updates:openManualDownload", async () => {
    const url = getUpdaterConfig().releasesUrl;
    if (!url) {
      throw new Error("Manual update URL is not configured.");
    }
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle("games:openFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open NES ROM",
      properties: ["openFile"],
      filters: [
        { name: "NES ROMs", extensions: ["nes"] },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const game = externalGameFromPath(filePath);
    externalGames.set(game.id, game);
    return game;
  });
  ipcMain.handle("folder:open", async (_event, name) => {
    ensureAppDirs();
    const folders = {
      games: getGamesDir(),
      saves: getSavesDir(),
    };
    const folderPath = folders[name];
    if (!folderPath) {
      throw new Error("Unknown folder.");
    }
    const error = await shell.openPath(folderPath);
    if (error) {
      throw new Error(error);
    }
    return folderPath;
  });
  ipcMain.handle("rom:read", (_event, id) => {
    const game = findGameById(id);
    if (!game) {
      throw new Error("Game not found.");
    }

    const romPath = getRomPath(game);
    if (!romPath.toLowerCase().endsWith(".nes")) {
      throw new Error("Selected file is not a .nes ROM.");
    }
    const bytes = fs.readFileSync(romPath);
    return Array.from(bytes);
  });
  ipcMain.handle("saves:read", (_event, gameId, slot) => {
    const savePath = getSavePath(gameId, slot);
    if (!fs.existsSync(savePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(savePath, "utf8"));
  });
  ipcMain.handle("saves:write", (_event, gameId, slot, save) => {
    ensureSavesDir();
    const savePath = getSavePath(gameId, slot);
    fs.writeFileSync(savePath, JSON.stringify(save), "utf8");
    return true;
  });
  ipcMain.on("saves:writeSync", (event, gameId, slot, save) => {
    try {
      ensureSavesDir();
      const savePath = getSavePath(gameId, slot);
      fs.writeFileSync(savePath, JSON.stringify(save), "utf8");
      event.returnValue = true;
    } catch (error) {
      event.returnValue = false;
    }
  });
  ipcMain.handle("saves:delete", (_event, gameId, slot) => {
    const savePath = getSavePath(gameId, slot);
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath);
    }
    return true;
  });
  ipcMain.handle("saves:list", (_event, gameId) => {
    ensureSavesDir();
    const saves = {};
    for (let slot = 1; slot <= 4; slot += 1) {
      const savePath = getSavePath(gameId, slot);
      if (fs.existsSync(savePath)) {
        try {
          const save = JSON.parse(fs.readFileSync(savePath, "utf8"));
          saves[slot] = {
            savedAt: save.savedAt || null,
          };
        } catch (error) {
          saves[slot] = {
            savedAt: null,
            broken: true,
          };
        }
      }
    }
    const autosavePath = getSavePath(gameId, "auto");
    if (fs.existsSync(autosavePath)) {
      try {
        const save = JSON.parse(fs.readFileSync(autosavePath, "utf8"));
        saves.auto = {
          savedAt: save.savedAt || null,
          reason: save.reason || null,
        };
      } catch (error) {
        saves.auto = {
          savedAt: null,
          broken: true,
        };
      }
    }
    return {
      dir: getSavesDir(),
      saves,
    };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
