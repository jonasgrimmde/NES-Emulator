const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createDiscordRpc } = require("./discord-rpc");

const fsp = fs.promises;
const externalGames = new Map();
const romMetaCache = new Map();
let discordRpc = null;
let latestUpdate = null;
const defaultSettings = {
  schemaVersion: 1,
  audio: {
    volume: 80,
  },
  video: {
    resolution: "fit",
  },
  crt: {
    enabled: false,
    scanlineIntensity: 0.15,
    scanlineCount: 400,
    brightness: 1.1,
    contrast: 1.05,
    saturation: 1.1,
    bloomIntensity: 0.2,
    bloomThreshold: 0.5,
    rgbShift: 0,
    adaptiveIntensity: 0.5,
    vignetteStrength: 0.3,
    curvature: 0.15,
    flickerStrength: 0.01,
  },
  autosave: {
    enabled: true,
    intervalSeconds: 10,
  },
  runtime: {
    pauseWhenUnfocused: true,
  },
  discordRpc: {
    enabled: true,
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

async function readRomMetaAsync(filePath) {
  let handle = null;
  try {
    handle = await fsp.open(filePath, "r");
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, 16, 0);
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
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

function getCachedRomMeta(filePath, stats) {
  const cached = romMetaCache.get(filePath);
  if (!cached) {
    return null;
  }
  if (stats && (cached.mtimeMs !== stats.mtimeMs || cached.size !== stats.size)) {
    romMetaCache.delete(filePath);
    return null;
  }
  return cached.meta;
}

function rememberRomMeta(filePath, stats, meta) {
  romMetaCache.set(filePath, {
    mtimeMs: stats ? stats.mtimeMs : 0,
    size: stats ? stats.size : 0,
    meta,
  });
  return meta;
}

async function readRomMetaCached(filePath, options = {}) {
  const stats = await fsp.stat(filePath);
  if (!stats.isFile()) {
    throw new Error("Selected entry is not a ROM file.");
  }
  const cached = options.force ? null : getCachedRomMeta(filePath, stats);
  if (cached) {
    return cached;
  }
  return rememberRomMeta(filePath, stats, await readRomMetaAsync(filePath));
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

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
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
  settings.runtime = isPlainObject(settings.runtime) ? settings.runtime : {};
  settings.runtime.pauseWhenUnfocused = typeof settings.runtime.pauseWhenUnfocused === "boolean"
    ? settings.runtime.pauseWhenUnfocused
    : defaultSettings.runtime.pauseWhenUnfocused;
  settings.discordRpc = isPlainObject(settings.discordRpc) ? settings.discordRpc : {};
  settings.discordRpc.enabled = typeof settings.discordRpc.enabled === "boolean"
    ? settings.discordRpc.enabled
    : defaultSettings.discordRpc.enabled;
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

function sendUpdateDownloadProgress(event, progress) {
  if (event && event.sender && !event.sender.isDestroyed()) {
    event.sender.send("updates:downloadProgress", progress);
  }
}

async function downloadToFileWithProgress(url, targetPath, event) {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      "User-Agent": "nes-emulator-updater",
    },
  });
  if (!response.ok) {
    throw new Error(`Update download failed: ${response.status} ${response.statusText}`);
  }

  const total = Number(response.headers.get("content-length")) || Number(latestUpdate.size) || 0;
  let downloaded = 0;
  let lastProgressAt = 0;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (!response.body) {
    throw new Error("Update download failed: response body is empty.");
  }
  const file = fs.createWriteStream(targetPath);
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    downloaded += value.byteLength;
    if (!file.write(Buffer.from(value))) {
      await new Promise((resolve) => file.once("drain", resolve));
    }
    const now = Date.now();
    if (now - lastProgressAt > 120 || downloaded === total) {
      sendUpdateDownloadProgress(event, {
        downloaded,
        total,
        percent: total > 0 ? Math.min(100, (downloaded / total) * 100) : null,
      });
      lastProgressAt = now;
    }
  }

  await new Promise((resolve, reject) => {
    file.on("finish", resolve);
    file.on("error", reject);
    file.end();
  });

  sendUpdateDownloadProgress(event, {
    downloaded,
    total: total || downloaded,
    percent: 100,
  });
}

async function downloadAndInstallUpdate(event) {
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
  await downloadToFileWithProgress(latestUpdate.url, targetPath, event);
  verifyFile(targetPath, latestUpdate.sha256, latestUpdate.sha512);

  sendUpdateDownloadProgress(event, {
    downloaded: latestUpdate.size || 0,
    total: latestUpdate.size || 0,
    percent: 100,
    status: "starting-installer",
  });

  const child = spawn(targetPath, ["/SILENT", "/NORESTART", "/FORCECLOSEAPPLICATIONS"], {
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

function gameFromFile(filePath, baseDir, options = {}) {
  const filename = path.basename(filePath);
  const relativePath = toRelativePath(baseDir, filePath);
  const folder = path.dirname(relativePath).split(path.sep).join("/");
  const stats = options.stats || null;
  const cachedMeta = getCachedRomMeta(filePath, stats);
  return {
    id: gameIdFromRelativePath(relativePath),
    title: titleFromName(filename),
    filename,
    relativePath,
    folder: folder === "." ? "" : folder,
    source: "library",
    meta: options.includeMeta === false ? cachedMeta : (cachedMeta || rememberRomMeta(filePath, stats, readRomMeta(filePath))),
  };
}

function directoryFromEntry(dirPath, baseDir, name) {
  return {
    type: "folder",
    name,
    relativePath: toRelativePath(baseDir, dirPath),
  };
}

async function listGameDirectory(relativeDir = "") {
  ensureAppDirs();
  const gamesDir = getGamesDir();
  const currentPath = resolveInside(gamesDir, relativeDir);
  const currentStats = await fsp.stat(currentPath).catch(() => null);
  if (!currentStats || !currentStats.isDirectory()) {
    throw new Error("Folder not found.");
  }

  const currentDir = toRelativePath(gamesDir, currentPath);
  const dirents = await fsp.readdir(currentPath, { withFileTypes: true });
  const entries = (await Promise.all(dirents
    .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.toLowerCase().endsWith(".nes")))
    .map(async (entry) => {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        return directoryFromEntry(entryPath, gamesDir, entry.name);
      }
      const stats = await fsp.stat(entryPath).catch(() => null);
      if (!stats || !stats.isFile()) {
        return null;
      }
      return Object.assign({ type: "game" }, gameFromFile(entryPath, gamesDir, { includeMeta: false, stats }));
    })))
    .filter(Boolean)
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

function getLibraryRomPath(relativePath) {
  ensureAppDirs();
  if (!relativePath) {
    throw new Error("Entry not found.");
  }
  const entryPath = resolveInside(getGamesDir(), relativePath);
  if (!entryPath.toLowerCase().endsWith(".nes")) {
    throw new Error("Selected file is not a .nes ROM.");
  }
  return entryPath;
}

async function readLibraryRomMeta(relativePath, options = {}) {
  return readRomMetaCached(getLibraryRomPath(relativePath), options);
}

function getLibraryEntryAbsolutePath(relativePath) {
  const entryPath = getLibraryEntryPath(relativePath);
  if (!fs.existsSync(entryPath)) {
    throw new Error("Entry not found.");
  }
  return entryPath;
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
      games.push(gameFromFile(entryPath, baseDir, { includeMeta: false }));
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

function getLibraryEntryPath(relativePath) {
  ensureAppDirs();
  if (!relativePath) {
    throw new Error("Entry not found.");
  }
  return resolveInside(getGamesDir(), relativePath);
}

function sanitizeEntryName(name, options = {}) {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[/\\]/.test(trimmed)) {
    throw new Error("Invalid name.");
  }
  if (/[<>:"|?*\x00-\x1f]/.test(trimmed)) {
    throw new Error("Name contains invalid characters.");
  }
  if (options.requireNesExtension && !trimmed.toLowerCase().endsWith(".nes")) {
    return `${trimmed}.nes`;
  }
  return trimmed;
}

function renameLibraryEntry(relativePath, newName) {
  const entryPath = getLibraryEntryPath(relativePath);
  if (!fs.existsSync(entryPath)) {
    throw new Error("Entry not found.");
  }
  const stats = fs.statSync(entryPath);
  if (!stats.isDirectory() && !(stats.isFile() && entryPath.toLowerCase().endsWith(".nes"))) {
    throw new Error("Entry cannot be renamed.");
  }

  const nextName = sanitizeEntryName(newName, { requireNesExtension: stats.isFile() });
  const nextPath = path.join(path.dirname(entryPath), nextName);
  resolveInside(getGamesDir(), toRelativePath(getGamesDir(), nextPath));
  if (fs.existsSync(nextPath)) {
    throw new Error("An entry with that name already exists.");
  }

  fs.renameSync(entryPath, nextPath);
  return stats.isDirectory()
    ? directoryFromEntry(nextPath, getGamesDir(), nextName)
    : Object.assign({ type: "game" }, gameFromFile(nextPath, getGamesDir()));
}

function createLibraryFolder(parentRelativeDir = "", folderName) {
  ensureAppDirs();
  const parentDir = resolveInside(getGamesDir(), parentRelativeDir || "");
  if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
    throw new Error("Parent folder not found.");
  }

  const nextName = sanitizeEntryName(folderName);
  const nextPath = path.join(parentDir, nextName);
  resolveInside(getGamesDir(), toRelativePath(getGamesDir(), nextPath));
  if (fs.existsSync(nextPath)) {
    throw new Error("An entry with that name already exists.");
  }

  fs.mkdirSync(nextPath);
  return directoryFromEntry(nextPath, getGamesDir(), nextName);
}

async function importRomFile(targetRelativeDir = "") {
  ensureAppDirs();
  const result = await dialog.showOpenDialog({
    title: "Import NES ROM",
    properties: ["openFile"],
    filters: [
      { name: "NES ROMs", extensions: ["nes"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  if (!sourcePath.toLowerCase().endsWith(".nes")) {
    throw new Error("Selected file is not a .nes ROM.");
  }
  const targetDir = resolveInside(getGamesDir(), targetRelativeDir || "");
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error("Target folder not found.");
  }
  const targetPath = path.join(targetDir, path.basename(sourcePath));
  resolveInside(getGamesDir(), toRelativePath(getGamesDir(), targetPath));
  if (fs.existsSync(targetPath)) {
    throw new Error("A ROM with that filename already exists in this folder.");
  }

  await fsp.copyFile(sourcePath, targetPath);
  return Object.assign({ type: "game" }, gameFromFile(targetPath, getGamesDir()));
}

function moveLibraryEntry(relativePath, targetRelativeDir = "") {
  const entryPath = getLibraryEntryPath(relativePath);
  if (!fs.existsSync(entryPath)) {
    throw new Error("Entry not found.");
  }
  const stats = fs.statSync(entryPath);
  if (!stats.isDirectory() && !(stats.isFile() && entryPath.toLowerCase().endsWith(".nes"))) {
    throw new Error("Entry cannot be moved.");
  }

  const gamesDir = getGamesDir();
  const targetDir = resolveInside(gamesDir, targetRelativeDir || "");
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error("Target folder not found.");
  }
  if (stats.isDirectory()) {
    const sourceWithSep = `${entryPath}${path.sep}`;
    const targetWithSep = `${targetDir}${path.sep}`;
    if (targetDir === entryPath || targetWithSep.startsWith(sourceWithSep)) {
      throw new Error("A folder cannot be moved into itself.");
    }
  }

  const currentDir = path.dirname(entryPath);
  if (currentDir === targetDir) {
    return stats.isDirectory()
      ? directoryFromEntry(entryPath, gamesDir, path.basename(entryPath))
      : Object.assign({ type: "game" }, gameFromFile(entryPath, gamesDir));
  }

  const nextPath = path.join(targetDir, path.basename(entryPath));
  resolveInside(gamesDir, toRelativePath(gamesDir, nextPath));
  if (fs.existsSync(nextPath)) {
    throw new Error("An entry with that name already exists in the target folder.");
  }

  fs.renameSync(entryPath, nextPath);
  return stats.isDirectory()
    ? directoryFromEntry(nextPath, gamesDir, path.basename(nextPath))
    : Object.assign({ type: "game" }, gameFromFile(nextPath, gamesDir));
}

function deleteLibraryEntry(relativePath) {
  const entryPath = getLibraryEntryPath(relativePath);
  if (!fs.existsSync(entryPath)) {
    return true;
  }
  const stats = fs.statSync(entryPath);
  if (stats.isDirectory()) {
    fs.rmSync(entryPath, { recursive: true, force: true });
    return true;
  }
  if (stats.isFile() && entryPath.toLowerCase().endsWith(".nes")) {
    fs.unlinkSync(entryPath);
    return true;
  }
  throw new Error("Entry cannot be deleted.");
}

async function revealLibraryEntry(relativePath) {
  const entryPath = getLibraryEntryPath(relativePath);
  if (!fs.existsSync(entryPath)) {
    throw new Error("Entry not found.");
  }
  shell.showItemInFolder(entryPath);
  return entryPath;
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
  loadLocalEnv();
  discordRpc = createDiscordRpc();
  const initialSettings = readSettings().settings;
  if (initialSettings.discordRpc && initialSettings.discordRpc.enabled !== false) {
    discordRpc.start();
    discordRpc.setIdle();
  }

  ipcMain.handle("games:listDirectory", (_event, relativeDir) => listGameDirectory(relativeDir));
  ipcMain.handle("games:readMeta", (_event, relativePath) => readLibraryRomMeta(relativePath));
  ipcMain.handle("games:refreshMeta", (_event, relativePath) => readLibraryRomMeta(relativePath, { force: true }));
  ipcMain.handle("games:getEntryPath", (_event, relativePath) => getLibraryEntryAbsolutePath(relativePath));
  ipcMain.handle("games:list", () => listGames());
  ipcMain.handle("games:createFolder", (_event, parentRelativeDir, folderName) => createLibraryFolder(parentRelativeDir, folderName));
  ipcMain.handle("games:importFile", (_event, targetRelativeDir) => importRomFile(targetRelativeDir));
  ipcMain.handle("games:renameEntry", (_event, relativePath, newName) => renameLibraryEntry(relativePath, newName));
  ipcMain.handle("games:moveEntry", (_event, relativePath, targetRelativeDir) => moveLibraryEntry(relativePath, targetRelativeDir));
  ipcMain.handle("games:deleteEntry", (_event, relativePath) => deleteLibraryEntry(relativePath));
  ipcMain.handle("games:revealEntry", (_event, relativePath) => revealLibraryEntry(relativePath));
  ipcMain.handle("settings:read", () => readSettings());
  ipcMain.handle("settings:write", (_event, settings) => writeSettings(settings));
  ipcMain.handle("settings:reset", () => resetSettings());
  ipcMain.handle("settings:defaults", () => getDefaultSettings());
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("discord:status", () => discordRpc ? discordRpc.getStatus() : { configured: false, enabled: false, connected: false });
  ipcMain.handle("discord:setIdle", () => {
    if (discordRpc) {
      discordRpc.start();
      discordRpc.setIdle();
    }
    return discordRpc ? discordRpc.getStatus() : { configured: false, enabled: false, connected: false };
  });
  ipcMain.handle("discord:setGame", (_event, gameTitle, options) => {
    if (discordRpc) {
      discordRpc.start();
      discordRpc.setGame(gameTitle, options || {});
    }
    return discordRpc ? discordRpc.getStatus() : { configured: false, enabled: false, connected: false };
  });
  ipcMain.handle("discord:clear", () => {
    if (discordRpc) {
      discordRpc.clear();
    }
    return discordRpc ? discordRpc.getStatus() : { configured: false, enabled: false, connected: false };
  });
  ipcMain.handle("app:openExternal", async (_event, url) => {
    const parsedUrl = new URL(String(url));
    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      throw new Error("External URL is not allowed.");
    }
    await shell.openExternal(parsedUrl.toString());
    return true;
  });
  ipcMain.handle("updates:check", () => checkForUpdates());
  ipcMain.handle("updates:downloadAndInstall", (event) => downloadAndInstallUpdate(event));
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
  ipcMain.handle("rom:read", async (_event, id) => {
    const game = findGameById(id);
    if (!game) {
      throw new Error("Game not found.");
    }

    const romPath = getRomPath(game);
    if (!romPath.toLowerCase().endsWith(".nes")) {
      throw new Error("Selected file is not a .nes ROM.");
    }
    const bytes = await fsp.readFile(romPath);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
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

app.on("before-quit", () => {
  if (discordRpc) {
    discordRpc.stop();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
