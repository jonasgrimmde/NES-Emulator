const statusEl = document.getElementById("status");
const gameTitleEl = document.getElementById("gameTitle");
const titlebar = document.getElementById("titlebar");
const titlebarVersion = document.getElementById("titlebarVersion");
const windowMinimize = document.getElementById("windowMinimize");
const windowMaximize = document.getElementById("windowMaximize");
const windowClose = document.getElementById("windowClose");
const gameList = document.getElementById("gameList");
const gameCount = document.getElementById("gameCount");
const folderPathEl = document.getElementById("folderPath");
const upFolderButton = document.getElementById("upFolder");
const openRomButton = document.getElementById("openRom");
const newFolderButton = document.getElementById("newFolder");
const newFolderPopover = document.getElementById("newFolderPopover");
const newFolderNameInput = document.getElementById("newFolderName");
const createFolderConfirm = document.getElementById("createFolderConfirm");
const createFolderCancel = document.getElementById("createFolderCancel");
const refreshGamesButton = document.getElementById("refreshGames");
const openGamesButton = document.getElementById("openGames");
const openExternalRomButton = document.getElementById("openExternalRom");
const openSavesButton = document.getElementById("openSaves");
const openSettingsButton = document.getElementById("openSettings");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const resetButton = document.getElementById("reset");
const saveButton = document.getElementById("save");
const loadButton = document.getElementById("load");
const slotGrid = document.getElementById("slotGrid");
const slotHint = document.getElementById("slotHint");
const compatModal = document.getElementById("compatModal");
const compatMessage = document.getElementById("compatMessage");
const compatGame = document.getElementById("compatGame");
const compatRom = document.getElementById("compatRom");
const compatCancel = document.getElementById("compatCancel");
const compatContinue = document.getElementById("compatContinue");
const settingsModal = document.getElementById("settingsModal");
const settingsPathEl = document.getElementById("settingsPath");
const volumeRange = document.getElementById("volumeRange");
const volumeValue = document.getElementById("volumeValue");
const resolutionSelect = document.getElementById("resolutionSelect");
const crtToggle = document.getElementById("crtToggle");
const crtCustomize = document.getElementById("crtCustomize");
const crtModal = document.getElementById("crtModal");
const crtControls = document.getElementById("crtControls");
const crtPreviewImage = document.getElementById("crtPreviewImage");
const crtPreview = document.getElementById("crtPreview");
const crtReset = document.getElementById("crtReset");
const crtClose = document.getElementById("crtClose");
const autosaveEnabled = document.getElementById("autosaveEnabled");
const autosaveInterval = document.getElementById("autosaveInterval");
const pauseWhenUnfocused = document.getElementById("pauseWhenUnfocused");
const discordRpcEnabled = document.getElementById("discordRpcEnabled");
const keybindGrid = document.getElementById("keybindGrid");
const hotkeyGrid = document.getElementById("hotkeyGrid");
const settingsDefaults = document.getElementById("settingsDefaults");
const settingsCancel = document.getElementById("settingsCancel");
const settingsSave = document.getElementById("settingsSave");
const settingsCheckUpdates = document.getElementById("settingsCheckUpdates");
const keyCaptureModal = document.getElementById("keyCaptureModal");
const keyCaptureTitle = document.getElementById("keyCaptureTitle");
const keyCaptureTarget = document.getElementById("keyCaptureTarget");
const keyCaptureCancel = document.getElementById("keyCaptureCancel");
const updateModal = document.getElementById("updateModal");
const updateTitle = document.getElementById("updateTitle");
const updateMessage = document.getElementById("updateMessage");
const updateVersionLabel = document.getElementById("updateVersionLabel");
const updateVersion = document.getElementById("updateVersion");
const updateDateLabel = document.getElementById("updateDateLabel");
const updateDate = document.getElementById("updateDate");
const updateSkip = document.getElementById("updateSkip");
const updateDownload = document.getElementById("updateDownload");
const footerCreditLink = document.getElementById("footerCreditLink");

const legacySaveSlotPrefix = "nes-desktop-save-slot-";
const selectedSlotPrefix = "nes-desktop-selected-save-slot-";
const saveSlotCount = 4;
const framesPerSecond = 60.098;
const frameIntervalMs = 1000 / framesPerSecond;
const maxFrameElapsedMs = 100;
const gameListRenderBatchSize = 24;
const romMetaHydrationBatchSize = 6;
const folderNavigationDoubleClickGuardMs = 550;

let currentFolder = "";
let folderEntries = [];
let externalGames = [];
let gameLookup = new Map();
let selectedSlot = 1;
let selectedGame = null;
let currentGame = null;
let browser = null;
let running = false;
let pausedByPage = false;
let audioRateConfigured = false;
let frameRequestId = 0;
let lastFrameTime = 0;
let saveMeta = {};
let savesDir = "";
let compatModalResolve = null;
let settings = null;
let settingsPath = "";
let draftSettings = null;
let settingsBaseline = null;
let keyCaptureTargetInfo = null;
let autosaveTimerId = 0;
let autosaveInProgress = false;
let lastAutosaveAt = 0;
let availableUpdate = null;
let gameContextMenu = null;
let gameContextEntry = null;
let focusedBrowserEntryKey = "";
let renamingEntryKey = "";
let renameCommitInProgress = false;
let gameListRenderToken = 0;
let metaHydrationToken = 0;
let suppressGameDoubleClickUntil = 0;
let draggedEntryKey = "";
let crtFilter = null;
let crtPreviewFilter = null;

const keybindButtons = [
  ["p1", "UP", "P1 Up"],
  ["p1", "DOWN", "P1 Down"],
  ["p1", "LEFT", "P1 Left"],
  ["p1", "RIGHT", "P1 Right"],
  ["p1", "A", "P1 A"],
  ["p1", "B", "P1 B"],
  ["p1", "SELECT", "P1 Select"],
  ["p1", "START", "P1 Start"],
  ["p1", "TURBO_A", "P1 Turbo A"],
  ["p1", "TURBO_B", "P1 Turbo B"],
  ["p2", "UP", "P2 Up"],
  ["p2", "DOWN", "P2 Down"],
  ["p2", "LEFT", "P2 Left"],
  ["p2", "RIGHT", "P2 Right"],
  ["p2", "A", "P2 A"],
  ["p2", "B", "P2 B"],
  ["p2", "SELECT", "P2 Select"],
  ["p2", "START", "P2 Start"],
];

const hotkeyButtons = [
  ["pause", "Pause"],
  ["quickSave", "Quick Save"],
  ["quickLoad", "Quick Load"],
  ["fullscreen", "Fullscreen"],
];

function setStatus(text) {
  statusEl.textContent = text;
}

function setButtonLabel(button, text) {
  const label = button.querySelector("span");
  if (label) {
    label.textContent = text;
  } else {
    button.textContent = text;
  }
}

function setWindowMaximizedState(isMaximized) {
  if (!windowMaximize) {
    return;
  }
  windowMaximize.title = isMaximized ? "Restore" : "Maximize";
  windowMaximize.setAttribute("aria-label", windowMaximize.title);
  windowMaximize.innerHTML = isMaximized
    ? `<i class="fa-regular fa-window-restore" aria-hidden="true"></i>`
    : `<i class="fa-regular fa-square" aria-hidden="true"></i>`;
}

async function controlWindow(action) {
  if (!window.nesApp || !window.nesApp.controlWindow) {
    return;
  }
  try {
    const isMaximized = await window.nesApp.controlWindow(action);
    setWindowMaximizedState(Boolean(isMaximized));
  } catch (error) {
    setStatus(error.message || String(error));
  }
}


function discordRpcEnabledBySettings() {
  return !settings || !settings.discordRpc || settings.discordRpc.enabled !== false;
}

function applyDiscordRpcSetting() {
  if (!discordRpcEnabledBySettings()) {
    if (window.nesApp && window.nesApp.clearDiscordActivity) {
      window.nesApp.clearDiscordActivity().catch(() => {});
    }
    return;
  }
  if (currentGame && running) {
    updateDiscordPlaying();
  } else if (currentGame && browser) {
    updateDiscordPaused();
  } else {
    updateDiscordIdle();
  }
}
function updateDiscordIdle() {
  if (window.nesApp && window.nesApp.setDiscordIdle) {
    window.nesApp.setDiscordIdle().catch(() => {});
  }
}

function updateDiscordPlaying(game = currentGame) {
  if (game && window.nesApp && window.nesApp.setDiscordGame) {
    window.nesApp.setDiscordGame(game.title, { paused: false }).catch(() => {});
  }
}

function updateDiscordPaused(game = currentGame) {
  if (game && window.nesApp && window.nesApp.setDiscordGame) {
    window.nesApp.setDiscordGame(game.title, { paused: true }).catch(() => {});
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function keyLabelFromEvent(event) {
  if (event.code && event.code.startsWith("Numpad")) {
    return event.code.replace("Numpad", "Num-");
  }
  if (event.key === " ") {
    return "Space";
  }
  if (event.key && event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return event.key || `Key ${event.keyCode}`;
}

function getKeybind(group, button, source = draftSettings || settings) {
  return source.keybinds[group][button];
}

function getHotkey(action, source = draftSettings || settings) {
  return source.hotkeys[action];
}

function formatBinding(binding) {
  return binding && binding.label ? binding.label : "Empty";
}

function valuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function createSettingRevertButton(isChanged, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "setting-revert";
  button.hidden = !isChanged;
  button.title = `Revert ${label}`;
  button.setAttribute("aria-label", `Revert ${label}`);
  button.innerHTML = `<i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function getBaselineCrtSettings() {
  return Object.assign({}, window.CRT_DEFAULTS || {}, settingsBaseline && settingsBaseline.crt || {});
}

function getAutosaveEnabled(source) {
  return Boolean(source && source.autosave && source.autosave.enabled);
}

function getDiscordEnabled(source) {
  return !source || !source.discordRpc || source.discordRpc.enabled !== false;
}

function getPauseWhenUnfocused(source) {
  return !source || !source.runtime || source.runtime.pauseWhenUnfocused !== false;
}

function normalizedSettingsForCompare(source) {
  if (!source) {
    return null;
  }
  const copy = clone(source);
  copy.crt = Object.assign({}, window.CRT_DEFAULTS || {}, copy.crt || {});
  copy.autosave = copy.autosave || {};
  copy.autosave.enabled = getAutosaveEnabled(copy);
  copy.autosave.intervalSeconds = Number(copy.autosave.intervalSeconds) || 10;
  copy.runtime = copy.runtime || {};
  copy.runtime.pauseWhenUnfocused = getPauseWhenUnfocused(copy);
  copy.discordRpc = copy.discordRpc || {};
  copy.discordRpc.enabled = getDiscordEnabled(copy);
  return copy;
}

function refreshSettingsSaveState() {
  if (!draftSettings || !settings) {
    settingsSave.disabled = true;
    return;
  }
  settingsSave.disabled = valuesEqual(
    normalizedSettingsForCompare(draftSettings),
    normalizedSettingsForCompare(settings),
  );
}

function refreshSettingsReverts() {
  if (!draftSettings || !settingsBaseline) {
    return;
  }
  document.querySelectorAll("#settingsModal .settings-row > .setting-revert, #settingsModal .settings-toggle > .setting-revert, #settingsModal .settings-command > .setting-revert")
    .forEach((button) => button.remove());

  const attach = (container, isChanged, label, onClick) => {
    if (container) {
      container.append(createSettingRevertButton(isChanged, label, onClick));
    }
  };

  attach(volumeRange.closest(".settings-row"), !valuesEqual(Number(draftSettings.audio.volume), settingsBaseline.audio.volume), "Volume", () => {
    draftSettings.audio.volume = settingsBaseline.audio.volume;
    volumeRange.value = String(draftSettings.audio.volume);
    volumeValue.value = `${draftSettings.audio.volume}%`;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(resolutionSelect.closest(".settings-row"), !valuesEqual(draftSettings.video.resolution, settingsBaseline.video.resolution), "Resolution", () => {
    draftSettings.video.resolution = settingsBaseline.video.resolution;
    resolutionSelect.value = draftSettings.video.resolution;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(crtToggle.closest(".settings-toggle"), !valuesEqual(Boolean(draftSettings.crt.enabled), Boolean(getBaselineCrtSettings().enabled)), "CRT Shader", () => {
    draftSettings.crt.enabled = Boolean(getBaselineCrtSettings().enabled);
    crtToggle.checked = draftSettings.crt.enabled;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(autosaveEnabled.closest(".settings-toggle"), !valuesEqual(getAutosaveEnabled(draftSettings), getAutosaveEnabled(settingsBaseline)), "Auto-Save", () => {
    draftSettings.autosave.enabled = getAutosaveEnabled(settingsBaseline);
    autosaveEnabled.checked = draftSettings.autosave.enabled;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(autosaveInterval.closest(".settings-row"), !valuesEqual(Number(draftSettings.autosave.intervalSeconds), Number(settingsBaseline.autosave.intervalSeconds)), "Auto-Save interval", () => {
    draftSettings.autosave.intervalSeconds = settingsBaseline.autosave.intervalSeconds;
    autosaveInterval.value = String(draftSettings.autosave.intervalSeconds);
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(pauseWhenUnfocused.closest(".settings-toggle"), !valuesEqual(getPauseWhenUnfocused(draftSettings), getPauseWhenUnfocused(settingsBaseline)), "Pause when unfocused", () => {
    draftSettings.runtime.pauseWhenUnfocused = getPauseWhenUnfocused(settingsBaseline);
    pauseWhenUnfocused.checked = draftSettings.runtime.pauseWhenUnfocused;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
  attach(discordRpcEnabled.closest(".settings-toggle"), !valuesEqual(getDiscordEnabled(draftSettings), getDiscordEnabled(settingsBaseline)), "Rich Presence", () => {
    draftSettings.discordRpc.enabled = getDiscordEnabled(settingsBaseline);
    discordRpcEnabled.checked = draftSettings.discordRpc.enabled;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  });
}

function keybindToJsnesKeys(source) {
  const keys = {};
  const buttonNames = ["A", "B", "SELECT", "START", "UP", "DOWN", "LEFT", "RIGHT", "TURBO_A", "TURBO_B"];
  for (const group of ["p1", "p2"]) {
    const player = group === "p1" ? 1 : 2;
    for (const button of buttonNames) {
      const keybind = source.keybinds[group] && source.keybinds[group][button];
      if (!keybind || !Number.isInteger(Number(keybind.keyCode)) || !Object.prototype.hasOwnProperty.call(jsnes.Controller, `BUTTON_${button}`)) {
        continue;
      }
      keys[keybind.keyCode] = [player, jsnes.Controller[`BUTTON_${button}`], keybind.label];
    }
  }
  return keys;
}

function applyResolution() {
  if (!settings) {
    return;
  }
  const resolution = settings.video && settings.video.resolution ? settings.video.resolution : "fit";
  const nesEl = document.getElementById("nes");
  nesEl.dataset.resolution = resolution;
}

function applyVolume() {
  if (!browser || !browser.nes || !browser._speakers || !settings) {
    return;
  }
  const volume = Math.min(1, Math.max(0, Number(settings.audio.volume) / 100));
  browser.nes.opts.onAudioSample = (left, right) => {
    browser._speakers.writeSample(left * volume, right * volume);
  };
}

function applyKeybinds() {
  if (!settings) {
    return;
  }
  const keys = keybindToJsnesKeys(settings);
  localStorage.setItem("keys", JSON.stringify(keys));
  if (browser && browser.keyboard) {
    browser.keyboard.setKeys(keys);
  }
}

function autosaveEnabledBySettings() {
  return Boolean(settings && settings.autosave && settings.autosave.enabled);
}

function getAutosaveIntervalMs() {
  const seconds = Number(settings && settings.autosave && settings.autosave.intervalSeconds) || 10;
  return Math.max(3000, seconds * 1000);
}

function stopAutosaveTimer() {
  if (autosaveTimerId) {
    window.clearInterval(autosaveTimerId);
    autosaveTimerId = 0;
  }
}

function startAutosaveTimer() {
  stopAutosaveTimer();
  if (!autosaveEnabledBySettings() || !browser || !currentGame) {
    return;
  }
  autosaveTimerId = window.setInterval(() => {
    saveAutoNow("interval");
  }, getAutosaveIntervalMs());
}

function applySettings() {
  applyResolution();
  applyCrtSettings();
  applyVolume();
  applyKeybinds();
  startAutosaveTimer();
  applyDiscordRpcSetting();
}

function getCrtSettings() {
  settings.crt = Object.assign({}, window.CRT_DEFAULTS || {}, settings.crt || {});
  return settings.crt;
}

function getEditableCrtSettings() {
  if (draftSettings) {
    draftSettings.crt = Object.assign({}, window.CRT_DEFAULTS || {}, draftSettings.crt || {});
    return draftSettings.crt;
  }
  return getCrtSettings();
}

function getNesSourceCanvas() {
  return document.querySelector("#nes canvas:not(.crt-output)");
}

function updateNesSplash() {
  document.getElementById("nes").classList.toggle("has-game", Boolean(browser));
}

function ensureCrtFilter() {
  if (!crtFilter && window.CRTFilter) {
    try {
      crtFilter = new window.CRTFilter(document.getElementById("nes"));
    } catch (error) {
      console.warn("CRT shader disabled:", error);
    }
  }
  return crtFilter;
}

function renderCrtFrame() {
  if (!crtFilter || !settings || !settings.crt || !settings.crt.enabled) {
    return;
  }
  try {
    crtFilter.render(getNesSourceCanvas());
  } catch (error) {
    console.warn("CRT shader render failed:", error);
    settings.crt.enabled = false;
    crtFilter.setEnabled(false);
    crtToggle.checked = false;
    setStatus("CRT Shader failed and was disabled.");
  }
}

function applyCrtSettings() {
  if (!settings) return;
  const crt = getCrtSettings();
  const filter = ensureCrtFilter();
  if (filter) {
    filter.setParams(crt);
    filter.setEnabled(Boolean(crt.enabled));
    renderCrtFrame();
  }
  crtToggle.checked = Boolean(crt.enabled);
}

function renderCrtPreview() {
  const ctx = crtPreview.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (crtPreviewImage && crtPreviewImage.complete && crtPreviewImage.naturalWidth) {
    drawCover(ctx, crtPreviewImage, crtPreview.width, crtPreview.height);
  } else {
    drawCrtPreviewFallback(ctx);
  }
  if (!crtPreviewFilter && window.CRTFilter) {
    const wrap = crtPreview.parentElement;
    crtPreviewFilter = new window.CRTFilter(wrap);
    crtPreviewFilter.canvas.classList.add("crt-preview-output");
  }
  if (crtPreviewFilter) {
    crtPreviewFilter.setParams(getEditableCrtSettings());
    crtPreviewFilter.setEnabled(true);
    crtPreviewFilter.render(crtPreview);
  }
}

function drawCover(ctx, source, targetWidth, targetHeight) {
  const sourceWidth = source.naturalWidth || source.videoWidth || source.width;
  const sourceHeight = source.naturalHeight || source.videoHeight || source.height;
  if (!sourceWidth || !sourceHeight) {
    drawCrtPreviewFallback(ctx);
    return;
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.ceil(sourceWidth * scale);
  const height = Math.ceil(sourceHeight * scale);
  const x = Math.floor((targetWidth - width) / 2);
  const y = Math.floor((targetHeight - height) / 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(source, x, y, width, height);
}

function drawCrtPreviewFallback(ctx) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, crtPreview.width, crtPreview.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(8, 8, 240, 224);
  ctx.fillStyle = "#2b6fd6";
  ctx.fillRect(18, 24, 64, 56);
  ctx.fillStyle = "#d6ad2b";
  ctx.fillRect(92, 24, 64, 56);
  ctx.fillStyle = "#b63f3f";
  ctx.fillRect(166, 24, 64, 56);
  ctx.fillStyle = "#101010";
  ctx.fillRect(18, 94, 212, 58);
  ctx.fillStyle = "#54c46f";
  for (let x = 24; x < 224; x += 16) {
    ctx.fillRect(x, 112 + Math.round(Math.sin(x / 16) * 14), 10, 28);
  }
  ctx.fillStyle = "#ece4c8";
  ctx.font = "bold 24px monospace";
  ctx.fillText("CRT TEST", 52, 190);
  ctx.font = "12px monospace";
  ctx.fillText("PIXEL GRID 240P", 70, 210);
}

function closeCrtModal() {
  crtModal.hidden = true;
}

function renderKeybindEditor() {
  keybindGrid.innerHTML = "";
  for (const [group, button, label] of keybindButtons) {
    const keybind = getKeybind(group, button);
    const baseline = settingsBaseline ? getKeybind(group, button, settingsBaseline) : keybind;
    const item = document.createElement("div");
    item.className = "keybind-item";
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "keybind-button";
    buttonEl.dataset.group = group;
    buttonEl.dataset.button = button;
    buttonEl.innerHTML = `
      <span class="keybind-action">${escapeHtml(label)}</span>
      <kbd class="keybind-key${keybind ? "" : " empty"}">${escapeHtml(formatBinding(keybind))}</kbd>
    `;
    buttonEl.addEventListener("click", () => {
      openKeyCaptureModal({
        type: "keybind",
        group,
        button,
        label,
      });
    });
    const revert = createSettingRevertButton(!valuesEqual(keybind, baseline), label, () => {
      draftSettings.keybinds[group][button] = clone(baseline);
      renderKeybindEditor();
      refreshSettingsSaveState();
    });
    item.append(buttonEl, revert);
    keybindGrid.append(item);
  }
}

function renderHotkeyEditor() {
  hotkeyGrid.innerHTML = "";
  for (const [action, label] of hotkeyButtons) {
    const hotkey = getHotkey(action);
    const baseline = settingsBaseline ? getHotkey(action, settingsBaseline) : hotkey;
    const item = document.createElement("div");
    item.className = "keybind-item";
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "keybind-button";
    buttonEl.dataset.action = action;
    buttonEl.innerHTML = `
      <span class="keybind-action">${escapeHtml(label)}</span>
      <kbd class="keybind-key${hotkey ? "" : " empty"}">${escapeHtml(formatBinding(hotkey))}</kbd>
    `;
    buttonEl.addEventListener("click", () => {
      openKeyCaptureModal({
        type: "hotkey",
        action,
        label,
      });
    });
    const revert = createSettingRevertButton(!valuesEqual(hotkey, baseline), label, () => {
      draftSettings.hotkeys[action] = clone(baseline);
      renderHotkeyEditor();
      refreshSettingsSaveState();
    });
    item.append(buttonEl, revert);
    hotkeyGrid.append(item);
  }
}

function loadSettingsForm(source) {
  draftSettings = clone(source);
  draftSettings.crt = Object.assign({}, window.CRT_DEFAULTS || {}, draftSettings.crt || {});
  draftSettings.discordRpc = draftSettings.discordRpc || {};
  draftSettings.autosave = draftSettings.autosave || {};
  draftSettings.runtime = draftSettings.runtime || {};
  draftSettings.discordRpc.enabled = getDiscordEnabled(draftSettings);
  draftSettings.autosave.enabled = getAutosaveEnabled(draftSettings);
  draftSettings.autosave.intervalSeconds = Number(draftSettings.autosave.intervalSeconds) || 10;
  draftSettings.runtime.pauseWhenUnfocused = getPauseWhenUnfocused(draftSettings);
  volumeRange.value = String(draftSettings.audio.volume);
  volumeValue.value = `${draftSettings.audio.volume}%`;
  resolutionSelect.value = draftSettings.video.resolution;
  autosaveEnabled.checked = draftSettings.autosave.enabled;
  autosaveInterval.value = String(draftSettings.autosave.intervalSeconds);
  pauseWhenUnfocused.checked = draftSettings.runtime.pauseWhenUnfocused;
  discordRpcEnabled.checked = draftSettings.discordRpc.enabled;
  crtToggle.checked = Boolean(draftSettings.crt.enabled);
  renderKeybindEditor();
  renderHotkeyEditor();
  refreshSettingsReverts();
  refreshSettingsSaveState();
}

function collectSettingsForm() {
  draftSettings.audio.volume = Number(volumeRange.value);
  draftSettings.video.resolution = resolutionSelect.value;
  draftSettings.autosave = draftSettings.autosave || {};
  draftSettings.autosave.enabled = autosaveEnabled.checked;
  draftSettings.autosave.intervalSeconds = Number(autosaveInterval.value);
  draftSettings.runtime = draftSettings.runtime || {};
  draftSettings.runtime.pauseWhenUnfocused = pauseWhenUnfocused.checked;
  draftSettings.discordRpc = draftSettings.discordRpc || {};
  draftSettings.discordRpc.enabled = discordRpcEnabled.checked;
  draftSettings.crt = clone(draftSettings.crt || settings.crt || window.CRT_DEFAULTS || {});
  return draftSettings;
}

const crtFields = [
  ["scanlineIntensity", "Scanlines", 0, 1, 0.01],
  ["scanlineCount", "Line count", 50, 1200, 1],
  ["brightness", "Brightness", 0.5, 2, 0.01],
  ["contrast", "Contrast", 0.5, 2, 0.01],
  ["saturation", "Saturation", 0, 2, 0.01],
  ["bloomIntensity", "Bloom", 0, 1, 0.01],
  ["rgbShift", "RGB shift", 0, 1, 0.01],
  ["vignetteStrength", "Vignette", 0, 2, 0.01],
  ["curvature", "Curvature", 0, 0.5, 0.005],
  ["flickerStrength", "Flicker", 0, 0.08, 0.001],
];

function renderCrtControls() {
  const crt = getEditableCrtSettings();
  const baselineCrt = getBaselineCrtSettings();
  crtControls.innerHTML = "";
  for (const [key, label, min, max, step] of crtFields) {
    const row = document.createElement("label");
    row.className = "settings-row";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${crt[key]}"><output>${crt[key]}</output>`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    const revert = createSettingRevertButton(!valuesEqual(Number(crt[key]), Number(baselineCrt[key])), label, () => {
      const editableCrt = getEditableCrtSettings();
      editableCrt[key] = baselineCrt[key];
      input.value = String(editableCrt[key]);
      output.value = String(editableCrt[key]);
      revert.hidden = true;
      renderCrtPreview();
      refreshSettingsSaveState();
    });
    input.addEventListener("input", () => {
      const editableCrt = getEditableCrtSettings();
      editableCrt[key] = Number(input.value);
      output.value = input.value;
      revert.hidden = valuesEqual(Number(editableCrt[key]), Number(baselineCrt[key]));
      renderCrtPreview();
      refreshSettingsSaveState();
    });
    row.append(revert);
    crtControls.append(row);
  }
}

function closeSettingsModal() {
  settingsModal.hidden = true;
  closeKeyCaptureModal();
  draftSettings = null;
  settingsBaseline = null;
}

async function openSettingsModal() {
  if (!settings) {
    return;
  }
  settingsPathEl.textContent = settingsPath;
  settingsPathEl.title = settingsPath;
  try {
    settingsBaseline = clone(await window.nesApp.getDefaultSettings());
    settingsBaseline.crt = Object.assign({}, window.CRT_DEFAULTS || {}, settingsBaseline.crt || {});
  } catch (error) {
    settingsBaseline = Object.assign(clone(settings), {
      crt: Object.assign({}, window.CRT_DEFAULTS || {}, settings.crt || {}),
    });
    setStatus(error.message || String(error));
  }
  loadSettingsForm(settings);
  settingsModal.hidden = false;
  volumeRange.focus();
}

function openKeyCaptureModal(targetInfo) {
  keyCaptureTargetInfo = targetInfo;
  keyCaptureTitle.textContent = `Type a key for ${targetInfo.label}`;
  keyCaptureTarget.textContent = "Waiting...";
  keyCaptureModal.hidden = false;
  keyCaptureCancel.focus();
}

function closeKeyCaptureModal() {
  keyCaptureModal.hidden = true;
  keyCaptureTargetInfo = null;
}

function closeUpdateModal() {
  updateModal.hidden = true;
}

function showUpdateModal(update) {
  availableUpdate = update;
  updateTitle.textContent = "Update available";
  const manualInstall = update && update.installMode === "manual";
  updateMessage.textContent = manualInstall
    ? "A new version is available. Open the latest GitHub release to download it for this platform."
    : "A new installer will be downloaded and started.";
  updateVersionLabel.textContent = "Version";
  updateVersion.textContent = `${update.currentVersion} -> ${update.latestVersion}`;
  updateDateLabel.textContent = "Date";
  updateDate.textContent = update.releaseDate ? formatSavedAt(update.releaseDate) : "Unknown";
  updateDownload.disabled = false;
  updateDownload.hidden = false;
  setButtonLabel(updateSkip, "Skip");
  setButtonLabel(updateDownload, manualInstall ? "Open GitHub" : "Download now");
  updateDownload.dataset.mode = manualInstall ? "manual" : "download";
  updateModal.hidden = false;
  updateDownload.focus();
}

function showUpdateErrorModal(update) {
  availableUpdate = null;
  updateTitle.textContent = "Update check failed";
  updateMessage.textContent = "The update information could not be loaded. Please download the latest version manually from GitHub.";
  updateVersionLabel.textContent = "Installed";
  updateVersion.textContent = update && update.currentVersion ? update.currentVersion : "Unknown";
  updateDateLabel.textContent = "Problem";
  updateDate.textContent = update && update.error ? update.error : "Not available";
  updateDownload.disabled = false;
  updateDownload.hidden = false;
  setButtonLabel(updateSkip, "Close");
  setButtonLabel(updateDownload, "Open GitHub");
  updateDownload.dataset.mode = "manual";
  updateModal.hidden = false;
  updateDownload.focus();
}

function showNoUpdateModal(update) {
  availableUpdate = null;
  updateTitle.textContent = "No update available";
  updateMessage.textContent = "You already have the latest version installed.";
  updateVersionLabel.textContent = "Installed";
  updateVersion.textContent = update && update.currentVersion ? update.currentVersion : "Unknown";
  updateDateLabel.textContent = "Latest";
  updateDate.textContent = update && update.latestVersion ? update.latestVersion : updateVersion.textContent;
  updateDownload.hidden = true;
  updateDownload.disabled = true;
  setButtonLabel(updateSkip, "Close");
  updateModal.hidden = false;
  updateSkip.focus();
}

function renderUpdateDownloadProgress(progress) {
  if (!progress) {
    return;
  }
  if (progress.status === "starting-installer") {
    updateMessage.textContent = "Download complete. Starting installer...";
    setButtonLabel(updateDownload, "Starting...");
    return;
  }
  const downloaded = formatBytes(progress.downloaded);
  const total = progress.total ? formatBytes(progress.total) : "unknown";
  const percent = typeof progress.percent === "number" ? `${progress.percent.toFixed(1)}%` : "";
  updateMessage.textContent = `Downloading update... ${percent} (${downloaded} / ${total})`;
  setButtonLabel(updateDownload, percent ? percent : "Downloading...");
  setStatus(`Downloading update ${percent}`.trim());
}

async function checkForUpdates(options = {}) {
  const showErrors = Boolean(options.showErrors);
  try {
    const update = await window.nesApp.checkForUpdates();
    if (update.error) {
      if (showErrors) {
        showUpdateErrorModal(update);
      }
      return update;
    }
    if (!update.available) {
      if (showErrors) {
        showNoUpdateModal(update);
      }
      return update;
    }
    availableUpdate = update;
    showUpdateModal(update);
    return update;
  } catch (error) {
    console.warn("Update check failed.", error);
    if (showErrors) {
      showUpdateErrorModal({
        error: error.message || String(error),
      });
    }
  }
}

function setCapturedBinding(binding) {
  if (!keyCaptureTargetInfo || !draftSettings) {
    return;
  }
  if (keyCaptureTargetInfo.type === "keybind") {
    draftSettings.keybinds[keyCaptureTargetInfo.group][keyCaptureTargetInfo.button] = binding;
    renderKeybindEditor();
  } else if (keyCaptureTargetInfo.type === "hotkey") {
    draftSettings.hotkeys[keyCaptureTargetInfo.action] = binding;
    renderHotkeyEditor();
  }
  refreshSettingsSaveState();
  closeKeyCaptureModal();
}

function getGameMetaLabel(game) {
  if (!game || !game.meta) {
    return "Indexing ROM...";
  }
  return game.meta.label || "ROM info unavailable";
}

function getCompatibilityStatus(game) {
  if (!game || !game.meta) {
    return "ROM selected. Compatibility unknown.";
  }
  if (game.meta.compatibility === "unsupported-mapper") {
    return `Ready, but ${game.meta.mapperName} / Mapper ${game.meta.mapper} is not supported by jsnes. Graphics may be broken.`;
  }
  if (game.meta.compatibility === "bad-header") {
    return "Ready, but this file has an invalid NES header.";
  }
  if (game.meta.compatibility === "supported") {
    return `Ready. ${game.meta.label} supported.`;
  }
  return "Ready. Compatibility unknown.";
}

function shouldWarnBeforeOpening(game) {
  return Boolean(game && game.meta && game.meta.compatibility !== "supported");
}

async function ensureGameMeta(game) {
  if (!game || game.type === "folder" || game.meta || game.source === "external" || !window.nesApp.readGameMeta) {
    return game;
  }
  try {
    game.meta = await window.nesApp.readGameMeta(game.relativePath);
    rememberGame(game);
    updateGameEntryMetaDom(game);
  } catch (error) {
    game.meta = {
      label: "ROM info unavailable",
      compatibility: "unknown",
    };
  }
  return game;
}

function getCompatibilityWarningMessage(game) {
  if (!game || !game.meta) {
    return "This ROM does not include compatibility information. It may fail to start or behave incorrectly.";
  }
  if (game.meta.compatibility === "unsupported-mapper") {
    return `${game.meta.mapperName} / Mapper ${game.meta.mapper} is not supported by this emulator core. The game may not start, or graphics and audio may be broken.`;
  }
  if (game.meta.compatibility === "bad-header") {
    return "This file does not have a valid NES header. The emulator may not be able to load it.";
  }
  return "This ROM has unknown compatibility. It may fail to start or behave incorrectly.";
}

function closeCompatibilityModal(result) {
  compatModal.hidden = true;
  if (compatModalResolve) {
    compatModalResolve(result);
    compatModalResolve = null;
  }
}

function confirmCompatibility(game) {
  if (!shouldWarnBeforeOpening(game)) {
    return Promise.resolve(true);
  }

  if (compatModalResolve) {
    closeCompatibilityModal(false);
  }

  compatMessage.textContent = getCompatibilityWarningMessage(game);
  compatGame.textContent = game.title || "Unknown";
  compatRom.textContent = getGameMetaLabel(game);
  compatModal.hidden = false;
  compatContinue.focus();

  return new Promise((resolve) => {
    compatModalResolve = resolve;
  });
}

function setRunControlsEnabled(enabled) {
  pauseButton.disabled = !enabled;
  resetButton.disabled = !enabled;
}

function getCurrentGameId() {
  return currentGame ? currentGame.id : "default";
}

function getSelectedGame() {
  return selectedGame || currentGame;
}

function getSelectedGameId() {
  const game = getSelectedGame();
  return game ? game.id : "default";
}

function isLibraryEntry(entry) {
  return entry && entry.source !== "external" && entry.relativePath;
}

function browserEntryKey(entry) {
  if (!entry) {
    return "";
  }
  return `${entry.type}:${entry.source || "library"}:${entry.relativePath || entry.id || entry.name}`;
}

function findBrowserEntryByKey(key) {
  return getBrowserGames().find((entry) => browserEntryKey(entry) === key) || null;
}

function getFocusedBrowserEntry() {
  return findBrowserEntryByKey(focusedBrowserEntryKey)
    || (selectedGame ? getBrowserGames().find((entry) => entry.type === "game" && entry.id === selectedGame.id) : null);
}

function entryContainsGame(entry, game) {
  if (!entry || !game || game.source === "external") {
    return false;
  }
  if (entry.type === "folder") {
    return game.relativePath === entry.relativePath || game.relativePath.startsWith(`${entry.relativePath}/`);
  }
  return entry.type === "game" && game.id === entry.id;
}

function getParentFolder(relativeDir = currentFolder) {
  return relativeDir ? relativeDir.split("/").slice(0, -1).join("/") : "";
}

function getEntryParentFolder(entry) {
  if (!entry || !entry.relativePath) {
    return "";
  }
  return entry.relativePath.split("/").slice(0, -1).join("/");
}

function canDropEntryOnFolder(entry, targetRelativeDir) {
  if (!isLibraryEntry(entry)) {
    return false;
  }
  const targetDir = targetRelativeDir || "";
  if (getEntryParentFolder(entry) === targetDir) {
    return false;
  }
  if (entry.type === "folder") {
    return targetDir !== entry.relativePath && !targetDir.startsWith(`${entry.relativePath}/`);
  }
  return true;
}

function closeGameContextMenu() {
  if (gameContextMenu) {
    gameContextMenu.hidden = true;
  }
  gameContextEntry = null;
}

function getGameContextMenu() {
  if (gameContextMenu) {
    return gameContextMenu;
  }

  gameContextMenu = document.createElement("div");
  gameContextMenu.id = "gameContextMenu";
  gameContextMenu.className = "context-menu";
  gameContextMenu.hidden = true;
  gameContextMenu.innerHTML = `
    <button type="button" data-action="open"><i class="fa-solid fa-play" aria-hidden="true"></i><span>Start</span></button>
    <button type="button" data-action="rom-info" data-game-only="true"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>ROM Info</span></button>
    <button type="button" data-action="refresh-meta" data-library-game-only="true"><i class="fa-solid fa-rotate" aria-hidden="true"></i><span>Refresh ROM Info</span></button>
    <button type="button" data-action="copy-path"><i class="fa-solid fa-copy" aria-hidden="true"></i><span>Copy Path</span></button>
    <button type="button" data-action="open-saves" data-game-only="true"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Open Saves Folder</span></button>
    <button type="button" data-action="rename"><i class="fa-solid fa-pen" aria-hidden="true"></i><span>Rename</span></button>
    <button type="button" data-action="reveal"><i class="fa-solid fa-folder-open" aria-hidden="true"></i><span>Show in Explorer</span></button>
    <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash" aria-hidden="true"></i><span>Delete</span></button>
  `;
  document.body.append(gameContextMenu);
  gameContextMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    const entry = gameContextEntry;
    closeGameContextMenu();
    handleGameContextAction(entry, action);
  });
  return gameContextMenu;
}

function positionGameContextMenu(menu, x, y) {
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const margin = 8;
  menu.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin))}px`;
  menu.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))}px`;
}

function showGameContextMenu(event, entry) {
  event.preventDefault();
  event.stopPropagation();
  gameContextEntry = entry;
  const menu = getGameContextMenu();
  const openButton = menu.querySelector('[data-action="open"] span');
  if (openButton) {
    openButton.textContent = entry.type === "folder" ? "Open" : "Start";
  }
  menu.querySelectorAll("[data-game-only]").forEach((button) => {
    button.disabled = entry.type !== "game";
  });
  menu.querySelectorAll("[data-library-game-only]").forEach((button) => {
    button.disabled = entry.type !== "game" || !isLibraryEntry(entry);
  });
  menu.querySelector('[data-action="rename"]').disabled = !isLibraryEntry(entry);
  menu.querySelector('[data-action="delete"]').disabled = !isLibraryEntry(entry);
  menu.querySelector('[data-action="reveal"]').disabled = !isLibraryEntry(entry);
  menu.querySelector('[data-action="copy-path"]').disabled = entry.source !== "external" && !isLibraryEntry(entry);
  positionGameContextMenu(menu, event.clientX, event.clientY);
}

async function openGameContextEntry(entry) {
  if (entry.type === "folder") {
    await loadGameDirectory(entry.relativePath);
    return;
  }
  const selected = await selectGame(entry);
  if (selected) {
    await startSelectedGame();
  }
}

async function renameGameContextEntry(entry) {
  if (!isLibraryEntry(entry)) {
    return;
  }
  beginInlineRename(entry);
}

function beginInlineRename(entry) {
  if (!isLibraryEntry(entry)) {
    setStatus("This entry cannot be renamed here.");
    return;
  }
  closeGameContextMenu();
  focusedBrowserEntryKey = browserEntryKey(entry);
  renamingEntryKey = focusedBrowserEntryKey;
  renderGameList();
}

function cancelInlineRename() {
  if (!renamingEntryKey) {
    return;
  }
  renamingEntryKey = "";
  renameCommitInProgress = false;
  renderGameList();
}

async function commitInlineRename(entry, input) {
  if (!renamingEntryKey || renameCommitInProgress) {
    return;
  }
  const oldName = entry.type === "folder" ? entry.name : entry.filename;
  const nextName = input.value.trim();
  if (!nextName || nextName === oldName) {
    cancelInlineRename();
    return;
  }
  renameCommitInProgress = true;
  const affectsCurrent = entryContainsGame(entry, currentGame);
  const affectsSelected = entryContainsGame(entry, selectedGame);
  try {
    const renamed = await window.nesApp.renameGameEntry(entry.relativePath, nextName);
    renamingEntryKey = "";
    focusedBrowserEntryKey = browserEntryKey(renamed);
    if (renamed.type === "folder" && (affectsCurrent || affectsSelected)) {
      await saveAutoNow("rename-folder");
      stopEmulation();
      if (browser) {
        browser.destroy();
        browser = null;
        updateNesSplash();
      }
      currentGame = null;
      selectedGame = null;
      startButton.disabled = true;
      setRunControlsEnabled(false);
      gameTitleEl.textContent = "NES Emulator";
    } else {
      if (affectsSelected) {
        selectedGame = renamed.type === "game" ? renamed : null;
      }
      if (affectsCurrent) {
        currentGame = renamed.type === "game" ? renamed : null;
        if (currentGame) {
          gameTitleEl.textContent = currentGame.title;
        }
      }
    }
    if (renamed.type === "game") {
      rememberGame(renamed);
    }
    await loadGameDirectory(currentFolder);
    if (getSelectedGame()) {
      selectedSlot = readSelectedSlot();
      await refreshSaveMeta();
      renderSaveSlots();
    }
    setStatus(`Renamed ${oldName} to ${entry.type === "folder" ? renamed.name : renamed.filename}.`);
  } catch (error) {
    renamingEntryKey = "";
    renderGameList();
    setStatus(error.message || String(error));
  } finally {
    renameCommitInProgress = false;
  }
}

async function deleteGameContextEntry(entry) {
  if (!isLibraryEntry(entry)) {
    return;
  }
  const label = entry.type === "folder" ? entry.name : entry.title;
  const message = entry.type === "folder"
    ? `Delete folder "${label}" and all contained ROMs?`
    : `Delete "${label}"?`;
  if (!window.confirm(message)) {
    return;
  }

  const affectsCurrent = entryContainsGame(entry, currentGame);
  const affectsSelected = entryContainsGame(entry, selectedGame);
  if (affectsCurrent || affectsSelected) {
    await saveAutoNow("delete-rom");
    stopEmulation();
    if (browser) {
      browser.destroy();
      browser = null;
      updateNesSplash();
    }
    currentGame = null;
    selectedGame = null;
    startButton.disabled = true;
    setRunControlsEnabled(false);
    gameTitleEl.textContent = "NES Emulator";
  }

  await window.nesApp.deleteGameEntry(entry.relativePath);
  await reloadGameList(null);
  setStatus(`Deleted ${label}.`);
}

async function moveGameEntryToFolder(entry, targetRelativeDir) {
  if (!canDropEntryOnFolder(entry, targetRelativeDir)) {
    return;
  }
  const label = entry.type === "folder" ? entry.name : entry.title;
  const affectsCurrent = entryContainsGame(entry, currentGame);
  const affectsSelected = entryContainsGame(entry, selectedGame);
  const moved = await window.nesApp.moveGameEntry(entry.relativePath, targetRelativeDir || "");

  if (moved.type === "game") {
    rememberGame(moved);
    if (affectsSelected) {
      selectedGame = moved;
    }
    if (affectsCurrent) {
      currentGame = moved;
      gameTitleEl.textContent = moved.title;
    }
  } else if (affectsCurrent || affectsSelected) {
    await saveAutoNow("move-folder");
    stopEmulation();
    if (browser) {
      browser.destroy();
      browser = null;
      updateNesSplash();
    }
    currentGame = null;
    selectedGame = null;
    startButton.disabled = true;
    setRunControlsEnabled(false);
    gameTitleEl.textContent = "NES Emulator";
  }

  focusedBrowserEntryKey = browserEntryKey(moved);
  await loadGameDirectory(currentFolder);
  if (getSelectedGame()) {
    selectedSlot = readSelectedSlot();
    await refreshSaveMeta();
    renderSaveSlots();
  }
  const targetLabel = targetRelativeDir ? `Games / ${targetRelativeDir}` : "Games";
  setStatus(`Moved ${label} to ${targetLabel}.`);
}

async function revealGameContextEntry(entry) {
  if (!isLibraryEntry(entry)) {
    return;
  }
  const entryPath = await window.nesApp.revealGameEntry(entry.relativePath);
  setStatus(`Opened ${entryPath}`);
}

async function getEntryAbsolutePath(entry) {
  if (!entry) {
    throw new Error("Entry not found.");
  }
  if (entry.source === "external") {
    return entry.filePath || entry.relativePath;
  }
  if (!isLibraryEntry(entry)) {
    throw new Error("This entry has no local path.");
  }
  return window.nesApp.getGameEntryPath(entry.relativePath);
}

async function copyGameContextPath(entry) {
  const entryPath = await getEntryAbsolutePath(entry);
  window.nesApp.copyText(entryPath);
  setStatus(`Copied path: ${entryPath}`);
}

async function showGameContextRomInfo(entry) {
  if (!entry || entry.type !== "game") {
    return;
  }
  await ensureGameMeta(entry);
  const meta = entry.meta || {};
  const details = [
    meta.format || "Unknown format",
    meta.mapperName ? `${meta.mapperName} / Mapper ${meta.mapper}` : "Unknown mapper",
    meta.region || "Unknown region",
    meta.validHeader === false ? "Invalid header" : "Header OK",
  ];
  setStatus(`${entry.title}: ${details.join(" | ")}`);
}

async function refreshGameContextRomInfo(entry) {
  if (!isLibraryEntry(entry) || entry.type !== "game") {
    return;
  }
  entry.meta = await window.nesApp.refreshGameMeta(entry.relativePath);
  rememberGame(entry);
  updateGameEntryMetaDom(entry);
  setStatus(`Refreshed ROM info for ${entry.title}.`);
}

async function openGameContextSavesFolder(entry) {
  if (!entry || entry.type !== "game") {
    return;
  }
  const folderPath = await window.nesApp.openSavesFolder();
  setStatus(`Opened saves folder: ${folderPath}`);
}

async function handleGameContextAction(entry, action) {
  if (!entry) {
    return;
  }
  try {
    if (action === "open") {
      await openGameContextEntry(entry);
    } else if (action === "rename") {
      await renameGameContextEntry(entry);
    } else if (action === "delete") {
      await deleteGameContextEntry(entry);
    } else if (action === "reveal") {
      await revealGameContextEntry(entry);
    } else if (action === "copy-path") {
      await copyGameContextPath(entry);
    } else if (action === "rom-info") {
      await showGameContextRomInfo(entry);
    } else if (action === "refresh-meta") {
      await refreshGameContextRomInfo(entry);
    } else if (action === "open-saves") {
      await openGameContextSavesFolder(entry);
    }
  } catch (error) {
    setStatus(error.message || String(error));
  }
}

function getSelectedSlotKey() {
  return `${selectedSlotPrefix}${getSelectedGameId()}`;
}

function getLegacySlotKey(slot) {
  return `${legacySaveSlotPrefix}${getSelectedGameId()}-${slot}`;
}

function readSelectedSlot() {
  const slot = Number(localStorage.getItem(getSelectedSlotKey())) || 1;
  return Math.min(Math.max(slot, 1), saveSlotCount);
}

function formatSavedAt(value) {
  if (!value) {
    return "Empty";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasSlot(slot) {
  return Boolean(saveMeta[slot]);
}

function canUseSelectedGameSave() {
  return Boolean(browser && currentGame && getSelectedGame() && currentGame.id === getSelectedGame().id);
}

function getSelectedSlot() {
  if (selectedSlot < 1 || selectedSlot > saveSlotCount) {
    selectedSlot = 1;
  }
  return selectedSlot;
}

function selectSlot(slot) {
  selectedSlot = slot;
  localStorage.setItem(getSelectedSlotKey(), String(slot));
  renderSaveSlots();
}

function updateSaveButtons() {
  const canUseSave = canUseSelectedGameSave();
  const slot = getSelectedSlot();
  saveButton.disabled = !canUseSave;
  loadButton.disabled = !canUseSave || !hasSlot(slot);
  slotHint.title = savesDir ? `Saved in ${savesDir}` : "";
  const autoText = autosaveEnabledBySettings() ? "Auto-Save ON" : "Auto-Save OFF";
  const game = getSelectedGame();
  slotHint.textContent = game ? `${game.title} - Slot ${slot} / ${autoText}` : `Slot ${slot}`;
}

async function refreshSaveMeta() {
  const game = getSelectedGame();
  if (!game) {
    saveMeta = {};
    savesDir = "";
    return;
  }
  let result = await window.nesApp.listSaves(game.id);
  let migrated = false;
  for (let slot = 1; slot <= saveSlotCount; slot += 1) {
    if (result.saves && result.saves[slot]) {
      continue;
    }
    const legacySave = localStorage.getItem(getLegacySlotKey(slot));
    if (!legacySave) {
      continue;
    }
    try {
      await window.nesApp.writeSave(game.id, slot, JSON.parse(legacySave));
      localStorage.removeItem(getLegacySlotKey(slot));
      migrated = true;
    } catch (error) {
      localStorage.removeItem(getLegacySlotKey(slot));
    }
  }
  if (migrated) {
    result = await window.nesApp.listSaves(game.id);
  }
  saveMeta = result.saves || {};
  savesDir = result.dir || "";
}

function renderSaveSlots() {
  slotGrid.innerHTML = "";
  renderAutoSaveSlot();
  const canUseSave = canUseSelectedGameSave();
  for (let slot = 1; slot <= saveSlotCount; slot += 1) {
    const save = saveMeta[slot];
    const slotEl = document.createElement("div");
    slotEl.className = "save-slot" + (slot === getSelectedSlot() ? " active" : "");

    const info = document.createElement("button");
    info.type = "button";
    info.className = "slot-info";
    info.innerHTML = `
      <div class="slot-name">Slot ${slot}</div>
      <div class="slot-meta">${save ? formatSavedAt(save.savedAt) : "Empty"}</div>
    `;
    info.addEventListener("click", () => selectSlot(slot));

    const saveSlotButton = document.createElement("button");
    saveSlotButton.type = "button";
    saveSlotButton.className = "btn btn-warning";
    saveSlotButton.innerHTML = `<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Save</span>`;
    saveSlotButton.disabled = !canUseSave;
    saveSlotButton.addEventListener("click", () => {
      selectSlot(slot);
      saveToSlot(slot);
    });

    const loadSlotButton = document.createElement("button");
    loadSlotButton.type = "button";
    loadSlotButton.className = "btn btn-success";
    loadSlotButton.innerHTML = `<i class="fa-solid fa-upload" aria-hidden="true"></i><span>Load</span>`;
    loadSlotButton.disabled = !canUseSave || !save;
    loadSlotButton.addEventListener("click", () => {
      selectSlot(slot);
      loadFromSlot(slot);
    });

    const clearSlotButton = document.createElement("button");
    clearSlotButton.type = "button";
    clearSlotButton.className = "btn btn-danger";
    clearSlotButton.innerHTML = `<i class="fa-solid fa-trash-can" aria-hidden="true"></i><span>Clear</span>`;
    clearSlotButton.disabled = !save;
    clearSlotButton.addEventListener("click", async () => {
      await window.nesApp.deleteSave(getCurrentGameId(), slot);
      await refreshSaveMeta();
      setStatus(`Slot ${slot} cleared.`);
      renderSaveSlots();
    });

    slotEl.append(info, saveSlotButton, loadSlotButton, clearSlotButton);
    slotGrid.append(slotEl);
  }
  updateSaveButtons();
}

function renderAutoSaveSlot() {
  const save = saveMeta.auto;
  const canUseSave = canUseSelectedGameSave();
  const slotEl = document.createElement("div");
  slotEl.className = "save-slot autosave-slot";

  const info = document.createElement("div");
  info.className = "slot-info static-slot-info";
  info.innerHTML = `
    <div class="slot-name">Auto-Save</div>
    <div class="slot-meta">${save ? formatSavedAt(save.savedAt) : "Empty"}</div>
  `;

  const saveSlotButton = document.createElement("button");
  saveSlotButton.type = "button";
  saveSlotButton.className = "btn btn-warning";
  saveSlotButton.innerHTML = `<i class="fa-solid fa-rotate" aria-hidden="true"></i><span>Save</span>`;
  saveSlotButton.disabled = !canUseSave || !autosaveEnabledBySettings();
  saveSlotButton.addEventListener("click", () => {
    saveAutoNow("manual");
  });

  const loadSlotButton = document.createElement("button");
  loadSlotButton.type = "button";
  loadSlotButton.className = "btn btn-success";
  loadSlotButton.innerHTML = `<i class="fa-solid fa-upload" aria-hidden="true"></i><span>Load</span>`;
  loadSlotButton.disabled = !canUseSave || !save;
  loadSlotButton.addEventListener("click", () => {
    loadFromSlot("auto");
  });

  const clearSlotButton = document.createElement("button");
  clearSlotButton.type = "button";
  clearSlotButton.className = "btn btn-danger";
  clearSlotButton.innerHTML = `<i class="fa-solid fa-trash-can" aria-hidden="true"></i><span>Clear</span>`;
  clearSlotButton.disabled = !save;
  clearSlotButton.addEventListener("click", async () => {
    await window.nesApp.deleteSave(getCurrentGameId(), "auto");
    await refreshSaveMeta();
    setStatus("Auto-Save cleared.");
    renderSaveSlots();
  });

  slotEl.append(info, saveSlotButton, loadSlotButton, clearSlotButton);
  slotGrid.append(slotEl);
}

function createSavePayload(reason) {
  return {
    savedAt: new Date().toISOString(),
    reason,
    state: browser.nes.toJSON(),
  };
}

async function saveAutoNow(reason = "autosave") {
  if (!browser || !currentGame || !autosaveEnabledBySettings() || autosaveInProgress) {
    return false;
  }
  autosaveInProgress = true;
  try {
    await window.nesApp.writeSave(getCurrentGameId(), "auto", createSavePayload(reason));
    lastAutosaveAt = Date.now();
    await refreshSaveMeta();
    renderSaveSlots();
    if (reason === "manual") {
      setStatus("Saved to Auto-Save.");
    }
    return true;
  } catch (error) {
    setStatus("Auto-Save failed.");
    return false;
  } finally {
    autosaveInProgress = false;
  }
}

function saveAutoSync(reason = "sync") {
  if (!browser || !currentGame || !autosaveEnabledBySettings()) {
    return false;
  }
  try {
    return window.nesApp.writeSaveSync(getCurrentGameId(), "auto", createSavePayload(reason));
  } catch (error) {
    return false;
  }
}

async function saveToSlot(slot) {
  if (!canUseSelectedGameSave()) {
    return;
  }
  const resumeAfterSave = running;
  pauseRuntime();
  try {
    await window.nesApp.writeSave(getCurrentGameId(), slot, {
      savedAt: new Date().toISOString(),
      reason: "manual",
      state: browser.nes.toJSON(),
    });
    await refreshSaveMeta();
    setStatus(slot === "auto" ? "Saved to Auto-Save." : `Saved to slot ${slot}.`);
    renderSaveSlots();
  } catch (error) {
    setStatus("Save failed.");
  } finally {
    resumeRuntime(resumeAfterSave);
  }
}

async function loadFromSlot(slot) {
  if (!canUseSelectedGameSave()) {
    return;
  }
  const resumeAfterLoad = running;
  pauseRuntime();
  try {
    const save = await window.nesApp.readSave(getCurrentGameId(), slot);
    if (!save) {
      setStatus(`Slot ${slot} is empty.`);
      return;
    }
    browser.nes.fromJSON(save.state);
    stabilizeRuntime();
    releaseAllInputs();
    await refreshSaveMeta();
    setStatus(slot === "auto" ? "Loaded Auto-Save." : `Loaded slot ${slot}.`);
    renderSaveSlots();
  } catch (error) {
    setStatus("Load failed.");
  } finally {
    resumeRuntime(resumeAfterLoad);
  }
}

function configureAudioRate() {
  if (audioRateConfigured) {
    return;
  }
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext) {
    audioRateConfigured = true;
    return;
  }

  function StableAudioContext(options = {}) {
    try {
      return new NativeAudioContext(Object.assign({ sampleRate: 44100 }, options));
    } catch (error) {
      return new NativeAudioContext(options);
    }
  }

  Object.setPrototypeOf(StableAudioContext, NativeAudioContext);
  StableAudioContext.prototype = NativeAudioContext.prototype;
  window.AudioContext = StableAudioContext;
  if (window.webkitAudioContext) {
    window.webkitAudioContext = StableAudioContext;
  }
  audioRateConfigured = true;
}

function nesButton(name) {
  return jsnes.Controller[`BUTTON_${name}`];
}

function buttonDown(input) {
  if (browser && browser.nes) {
    browser.nes.buttonDown(input.player, nesButton(input.button));
  }
}

function buttonUp(input) {
  if (browser && browser.nes) {
    browser.nes.buttonUp(input.player, nesButton(input.button));
  }
}

function releaseAllInputs() {
  ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT", "TURBO_A", "TURBO_B"].forEach((button) => {
    buttonUp({ player: 1, button });
    buttonUp({ player: 2, button });
  });
}

function inputForElement(element) {
  return {
    player: Number(element.dataset.player || 1),
    button: element.dataset.button,
  };
}

async function loadRom() {
  if (!currentGame) {
    throw new Error("No game selected.");
  }
  const bytes = await window.nesApp.readRom(currentGame.id);
  return bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes);
}

async function createBrowser() {
  configureAudioRate();
  applyKeybinds();
  browser = new jsnes.Browser({
    container: document.getElementById("nes"),
    onError: (error) => setStatus(error.message || String(error)),
  });
  updateNesSplash();
  stabilizeRuntime();
  browser.nes.loadROM(await loadRom());
  browser.nes.setFramerate(framesPerSecond);
  syncAudioRate();
  applySettings();
  ensureCrtFilter();
  applyCrtSettings();
}

function syncAudioRate() {
  if (!browser || !browser.nes) {
    return;
  }
  const sampleRate = browser._speakers && browser._speakers.getSampleRate
    ? browser._speakers.getSampleRate()
    : 44100;
  if (browser.nes.opts) {
    browser.nes.opts.sampleRate = sampleRate;
  }
  if (browser.nes.papu) {
    browser.nes.papu.sampleRate = sampleRate;
  }
  browser.nes.setFramerate(framesPerSecond);
}

function stabilizeRuntime() {
  if (!browser) {
    return;
  }
  if (browser._speakers) {
    browser._speakers.onBufferUnderrun = () => {};
  }
  if (browser._frameTimer) {
    browser._frameTimer.stop();
    browser._frameTimer.lastFrameTime = false;
  }
  lastFrameTime = 0;
}

function stopFrameLoop() {
  if (frameRequestId) {
    window.cancelAnimationFrame(frameRequestId);
    frameRequestId = 0;
  }
  lastFrameTime = 0;
}

function runFrameLoop(timestamp) {
  if (!running || !browser) {
    frameRequestId = 0;
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const elapsed = timestamp - lastFrameTime;
  if (elapsed > maxFrameElapsedMs) {
    lastFrameTime = timestamp;
    frameRequestId = window.requestAnimationFrame(runFrameLoop);
    return;
  }
  if (elapsed >= frameIntervalMs) {
    lastFrameTime = timestamp - (elapsed % frameIntervalMs);
    try {
      browser.nes.frame();
      browser._speakers.flush();
      browser._screen.writeBuffer();
      renderCrtFrame();
    } catch (error) {
      saveAutoNow("crash");
      stopEmulation();
      setStatus(error.message || String(error));
      return;
    }
  }

  frameRequestId = window.requestAnimationFrame(runFrameLoop);
}

function pauseRuntime() {
  if (!browser) {
    return;
  }
  stopFrameLoop();
  if (browser._speakers) {
    browser._speakers.flush();
  }
  clearInterval(browser._fpsInterval);
}

function resumeRuntime(shouldResume) {
  stabilizeRuntime();
  syncAudioRate();
  if (shouldResume && browser) {
    if (browser._speakers && browser._speakers.audioCtx && browser._speakers.audioCtx.state === "suspended") {
      browser._speakers.audioCtx.resume();
    }
    frameRequestId = window.requestAnimationFrame(runFrameLoop);
  }
}

function startEmulation() {
  if (!browser || running) {
    return;
  }
  running = true;
  syncAudioRate();
  if (browser._speakers) {
    Promise.resolve(browser._speakers.start()).then(() => {
      syncAudioRate();
      applyVolume();
    });
  }
  stopFrameLoop();
  frameRequestId = window.requestAnimationFrame(runFrameLoop);
  startAutosaveTimer();
  updateDiscordPlaying();
}

function stopEmulation() {
  running = false;
  pausedByPage = false;
  stopAutosaveTimer();
  updateDiscordIdle();
  if (browser) {
    stopFrameLoop();
    if (browser._speakers) {
      browser._speakers.stop();
    }
    clearInterval(browser._fpsInterval);
  }
}

async function stopLoadedGame() {
  if (!browser) {
    return;
  }
  await saveAutoNow("stop-game");
  stopEmulation();
  releaseAllInputs();
  browser.destroy();
  browser = null;
  currentGame = null;
  pausedByPage = false;
  setRunControlsEnabled(false);
  setButtonLabel(pauseButton, "Pause");
  updateNesSplash();
  renderSaveSlots();
  if (getSelectedGame()) {
    gameTitleEl.textContent = getSelectedGame().title;
    setStatus(`${getSelectedGame().title} stopped.`);
  } else {
    gameTitleEl.textContent = "NES Emulator";
    setStatus("Stopped.");
  }
}

function pauseForPageLifecycle() {
  if (!browser || !running || pausedByPage) {
    return;
  }
  saveAutoNow("page-lifecycle");
  pausedByPage = true;
  releaseAllInputs();
  pauseRuntime();
  updateDiscordPaused();
}

function resumeFromPageLifecycle() {
  if (!browser || !pausedByPage) {
    return;
  }
  pausedByPage = false;
  if (!document.hidden) {
    resumeRuntime(true);
    running = true;
    startAutosaveTimer();
    setButtonLabel(pauseButton, "Pause");
    setStatus(`${currentGame.title} running.`);
    updateDiscordPlaying();
  }
}

function rememberGame(game) {
  if (game && game.type !== "folder") {
    gameLookup.set(game.id, game);
  }
}

function getBrowserGames() {
  const openedGames = externalGames.map((game) => Object.assign({ type: "game", opened: true }, game));
  return openedGames.concat(folderEntries);
}

async function selectGame(gameOrId, options = {}) {
  const game = typeof gameOrId === "string" ? gameLookup.get(gameOrId) : gameOrId;
  if (!game) {
    return false;
  }
  await ensureGameMeta(game);
  if (selectedGame && selectedGame.id === game.id) {
    return true;
  }
  if (!options.skipCompatibilityWarning && !(await confirmCompatibility(game))) {
    setStatus("Game selection canceled.");
    return false;
  }
  rememberGame(game);
  selectedGame = game;
  selectedSlot = readSelectedSlot();
  startButton.disabled = false;
  gameTitleEl.textContent = game.title;
  await refreshSaveMeta();
  const isLoaded = currentGame && currentGame.id === game.id && browser;
  setStatus(isLoaded ? getCompatibilityStatus(game) : `${game.title} selected. Press Start or double-click to load.`);
  updateSelectedGameListDom();
  renderSaveSlots();
  return true;
}

async function loadSelectedGameForStart() {
  const game = getSelectedGame();
  if (!game) {
    throw new Error("No game selected.");
  }
  if (currentGame && currentGame.id === game.id && browser) {
    return;
  }
  await saveAutoNow("game-switch");
  stopEmulation();
  if (browser) {
    browser.destroy();
    browser = null;
    updateNesSplash();
  }
  currentGame = game;
  selectedGame = game;
  selectedSlot = readSelectedSlot();
  pausedByPage = false;
  setButtonLabel(pauseButton, "Pause");
  setRunControlsEnabled(false);
  gameTitleEl.textContent = game.title;
  await refreshSaveMeta();
  updateSelectedGameListDom();
  renderSaveSlots();
}

function createGameListItem(entry, state) {
  const item = document.createElement("div");
  const key = browserEntryKey(entry);
  const isRenaming = renamingEntryKey === key;
  item.tabIndex = 0;
  item.setAttribute("role", "option");
  item.dataset.entryKey = key;
  item.classList.add("streaming-in");

  if (entry.type === "folder") {
    item.className = "game-item folder-entry streaming-in";
    item.title = `Games / ${entry.relativePath}`;
    if (isRenaming) {
      item.classList.add("renaming");
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-folder" aria-hidden="true"></i></span><input class="rename-input" type="text" value="${escapeHtml(entry.name)}" aria-label="Rename ${escapeHtml(entry.name)}"></div>
      `;
    } else {
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-folder" aria-hidden="true"></i></span><span class="entry-text">${escapeHtml(entry.name)}</span></div>
      `;
    }
    item.addEventListener("click", () => {
      focusedBrowserEntryKey = key;
      if (!isRenaming) {
        suppressGameDoubleClickUntil = performance.now() + folderNavigationDoubleClickGuardMs;
        loadGameDirectory(entry.relativePath);
      }
    });
    item.addEventListener("dragover", (event) => handleDragOverFolder(event, entry.relativePath, item));
    item.addEventListener("dragleave", (event) => {
      if (!item.contains(event.relatedTarget)) {
        item.classList.remove("drop-target", "drop-denied");
      }
    });
    item.addEventListener("drop", (event) => handleDropOnFolder(event, entry.relativePath));
    item.addEventListener("contextmenu", (event) => showGameContextMenu(event, entry));
  } else {
    rememberGame(entry);
    const isUnsupported = entry.meta && entry.meta.compatibility && entry.meta.compatibility !== "supported";
    const isSelected = getSelectedGame() && getSelectedGame().id === entry.id;
    item.className = "game-item file-entry streaming-in"
      + (isSelected ? " active" : "")
      + (isUnsupported ? " warning" : "");
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
    item.title = entry.source === "external" ? entry.relativePath : `Games / ${entry.relativePath}`;
    if (isRenaming) {
      item.classList.add("renaming");
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-gamepad" aria-hidden="true"></i></span><input class="rename-input" type="text" value="${escapeHtml(entry.filename)}" aria-label="Rename ${escapeHtml(entry.filename)}"></div>
        <div class="game-meta">${escapeHtml(getGameMetaLabel(entry))}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-gamepad" aria-hidden="true"></i></span><span class="entry-text">${escapeHtml(entry.title)}</span></div>
        <div class="game-meta">${escapeHtml(getGameMetaLabel(entry))}</div>
      `;
    }
    item.addEventListener("click", () => {
      focusedBrowserEntryKey = key;
      if (!isRenaming) {
        selectGame(entry);
      }
    });
    item.addEventListener("dblclick", async () => {
      if (isRenaming) {
        return;
      }
      if (performance.now() < suppressGameDoubleClickUntil) {
        return;
      }
      const selected = await selectGame(entry);
      if (selected) {
        await startSelectedGame();
      }
    });
    item.addEventListener("contextmenu", (event) => showGameContextMenu(event, entry));
  }
  attachDragHandlers(item, entry, isRenaming);
  item.addEventListener("focus", () => {
    focusedBrowserEntryKey = key;
  });
  item.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !isRenaming) {
      event.preventDefault();
      await openGameContextEntry(entry);
    } else if (event.key === "F2" && !isRenaming) {
      event.preventDefault();
      beginInlineRename(entry);
    }
  });
  if (isRenaming) {
    state.renameInput = item.querySelector(".rename-input");
    state.renameInput.addEventListener("click", (event) => event.stopPropagation());
    state.renameInput.addEventListener("dblclick", (event) => event.stopPropagation());
    state.renameInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commitInlineRename(entry, state.renameInput);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelInlineRename();
      }
    });
    state.renameInput.addEventListener("blur", () => {
      commitInlineRename(entry, state.renameInput);
    });
  }
  return item;
}

function updateGameEntryMetaDom(entry) {
  const key = browserEntryKey(entry);
  const item = Array.from(gameList.querySelectorAll("[data-entry-key]"))
    .find((element) => element.dataset.entryKey === key);
  if (!item) {
    return;
  }
  const meta = item.querySelector(".game-meta");
  if (meta) {
    meta.textContent = getGameMetaLabel(entry);
  }
  item.classList.toggle("warning", Boolean(entry.meta && entry.meta.compatibility && entry.meta.compatibility !== "supported"));
}

function updateSelectedGameListDom() {
  const selectedId = getSelectedGame() ? getSelectedGame().id : "";
  for (const item of gameList.querySelectorAll(".file-entry[data-entry-key]")) {
    const entry = findBrowserEntryByKey(item.dataset.entryKey);
    const isSelected = Boolean(entry && entry.id === selectedId);
    item.classList.toggle("active", isSelected);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");
  }
}

function getDraggedEntry(event) {
  const key = event.dataTransfer ? event.dataTransfer.getData("application/x-nes-entry-key") : "";
  return findBrowserEntryByKey(key || draggedEntryKey);
}

function clearDropTargets() {
  gameList.classList.remove("drop-target", "drop-denied");
  upFolderButton.classList.remove("drop-target", "drop-denied");
  gameList.querySelectorAll(".drop-target, .drop-denied").forEach((element) => {
    element.classList.remove("drop-target", "drop-denied");
  });
}

function updateDropTarget(element, entry, targetRelativeDir) {
  const allowed = canDropEntryOnFolder(entry, targetRelativeDir);
  element.classList.toggle("drop-target", allowed);
  element.classList.toggle("drop-denied", !allowed);
  return allowed;
}

function handleDragOverFolder(event, targetRelativeDir, element) {
  const entry = getDraggedEntry(event);
  if (!entry) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = updateDropTarget(element, entry, targetRelativeDir) ? "move" : "none";
}

async function handleDropOnFolder(event, targetRelativeDir) {
  const entry = getDraggedEntry(event);
  event.stopPropagation();
  clearDropTargets();
  if (!entry) {
    return;
  }
  event.preventDefault();
  try {
    await moveGameEntryToFolder(entry, targetRelativeDir);
  } catch (error) {
    setStatus(error.message || String(error));
  }
}

function attachDragHandlers(item, entry, isRenaming) {
  if (!isLibraryEntry(entry) || isRenaming) {
    return;
  }
  item.draggable = true;
  item.addEventListener("dragstart", (event) => {
    draggedEntryKey = browserEntryKey(entry);
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-nes-entry-key", draggedEntryKey);
    event.dataTransfer.setData("text/plain", entry.relativePath);
    closeGameContextMenu();
  });
  item.addEventListener("dragend", () => {
    draggedEntryKey = "";
    item.classList.remove("dragging");
    clearDropTargets();
  });
}

async function hydrateRomMetaForEntries(entries, token) {
  const games = entries.filter((entry) => entry.type === "game" && entry.source !== "external" && !entry.meta);
  for (let index = 0; index < games.length && token === metaHydrationToken; index += romMetaHydrationBatchSize) {
    const batch = games.slice(index, index + romMetaHydrationBatchSize);
    await Promise.all(batch.map((entry) => ensureGameMeta(entry)));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function renderGameList() {
  gameListRenderToken += 1;
  metaHydrationToken += 1;
  const token = gameListRenderToken;
  const folders = folderEntries.filter((entry) => entry.type === "folder");
  const games = folderEntries.filter((entry) => entry.type === "game");
  gameCount.textContent = `${folders.length} dirs / ${games.length} games`;
  folderPathEl.textContent = currentFolder ? `Games / ${currentFolder}` : "Games";
  folderPathEl.title = folderPathEl.textContent;
  upFolderButton.disabled = !currentFolder;
  gameList.innerHTML = "";

  const entries = getBrowserGames();
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "game-item";
    empty.innerHTML = `
      <div class="game-name">No games found</div>
      <div class="game-folder">Add .nes files here or open one directly</div>
    `;
    gameList.append(empty);
    return;
  }

  const state = { renameInput: null };
  let index = 0;
  function appendBatch() {
    if (token !== gameListRenderToken) {
      return;
    }
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + gameListRenderBatchSize, entries.length);
    while (index < end) {
      fragment.append(createGameListItem(entries[index], state));
      index += 1;
    }
    gameList.append(fragment);
    if (index < entries.length) {
      requestAnimationFrame(appendBatch);
      return;
    }
    if (state.renameInput) {
      requestAnimationFrame(() => {
        state.renameInput.focus();
        state.renameInput.select();
      });
    }
    hydrateRomMetaForEntries(entries, metaHydrationToken);
  }
  requestAnimationFrame(appendBatch);
}

async function loadGameDirectory(relativeDir = currentFolder) {
  const result = await window.nesApp.listGameDirectory(relativeDir);
  currentFolder = result.currentDir || "";
  folderEntries = result.entries || [];
  folderEntries.forEach((entry) => {
    if (entry.type === "game") {
      rememberGame(entry);
    }
  });
  renderGameList();
  return result;
}

async function reloadGameList(keepGameId = currentGame && currentGame.id) {
  await loadGameDirectory(currentFolder);
  if (keepGameId && gameLookup.has(keepGameId)) {
    currentGame = gameLookup.get(keepGameId);
    selectedGame = selectedGame && gameLookup.has(selectedGame.id) ? gameLookup.get(selectedGame.id) : currentGame;
    selectedSlot = readSelectedSlot();
    await refreshSaveMeta();
    gameTitleEl.textContent = getSelectedGame().title;
    setStatus(getCompatibilityStatus(currentGame));
  } else if (!getSelectedGame()) {
    const firstGame = folderEntries.find((entry) => entry.type === "game");
    if (firstGame) {
      await selectGame(firstGame, { skipCompatibilityWarning: true });
      return;
    }
    gameTitleEl.textContent = "NES Emulator";
    setStatus("Open a folder or add .nes files to Games.");
  }
  renderGameList();
  renderSaveSlots();
}

async function startSelectedGame() {
  startButton.disabled = true;
  setStatus("Loading ROM...");

  try {
    await loadSelectedGameForStart();
    if (!browser) {
      await createBrowser();
    }

    startEmulation();
    setRunControlsEnabled(true);
    setButtonLabel(pauseButton, "Pause");
    setStatus(`${currentGame.title} running.`);
    updateDiscordPlaying();
    renderSaveSlots();
  } catch (error) {
    startButton.disabled = false;
    setStatus(error.message || String(error));
  }
}

startButton.addEventListener("click", () => {
  startSelectedGame();
});

pauseButton.addEventListener("click", () => {
  if (!browser) {
    return;
  }
  if (running) {
    stopEmulation();
    setButtonLabel(pauseButton, "Resume");
    setStatus("Paused.");
    updateDiscordPaused();
  } else {
    startEmulation();
    setButtonLabel(pauseButton, "Pause");
    setStatus("Running.");
    updateDiscordPlaying();
  }
});

resetButton.addEventListener("click", () => {
  stopLoadedGame();
});

openGamesButton.addEventListener("click", async () => {
  try {
    const folderPath = await window.nesApp.openGamesFolder();
    setStatus(`Opened ${folderPath}`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

openExternalRomButton.addEventListener("click", async () => {
  try {
    const game = await window.nesApp.openRomFile();
    if (!game) {
      return;
    }
    const existingIndex = externalGames.findIndex((entry) => entry.id === game.id);
    if (existingIndex >= 0) {
      externalGames[existingIndex] = game;
    } else {
      externalGames.unshift(game);
    }
    rememberGame(game);
    const selected = await selectGame(game);
    if (selected) {
      setStatus(`Opened ${game.title}. Press Start or double-click to load.`);
    }
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

openRomButton.addEventListener("click", async () => {
  try {
    const game = await window.nesApp.importRomFile(currentFolder);
    if (!game) {
      return;
    }
    rememberGame(game);
    await loadGameDirectory(currentFolder);
    await selectGame(game, { skipCompatibilityWarning: true });
    setStatus(`Imported ${game.filename} to ${currentFolder ? `Games / ${currentFolder}` : "Games"}.`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

upFolderButton.addEventListener("click", async () => {
  if (!currentFolder) {
    return;
  }
  try {
    const parentFolder = getParentFolder();
    await loadGameDirectory(parentFolder);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

upFolderButton.addEventListener("dragover", (event) => {
  if (!currentFolder) {
    return;
  }
  handleDragOverFolder(event, getParentFolder(), upFolderButton);
});

upFolderButton.addEventListener("dragleave", () => {
  upFolderButton.classList.remove("drop-target", "drop-denied");
});

upFolderButton.addEventListener("drop", (event) => {
  if (!currentFolder) {
    return;
  }
  handleDropOnFolder(event, getParentFolder());
});

gameList.addEventListener("dragover", (event) => {
  if (event.target.closest(".game-item")) {
    return;
  }
  handleDragOverFolder(event, currentFolder, gameList);
});

gameList.addEventListener("dragleave", (event) => {
  if (!gameList.contains(event.relatedTarget)) {
    gameList.classList.remove("drop-target", "drop-denied");
  }
});

gameList.addEventListener("drop", (event) => {
  if (event.target.closest(".game-item")) {
    return;
  }
  handleDropOnFolder(event, currentFolder);
});

refreshGamesButton.addEventListener("click", async () => {
  try {
    await reloadGameList();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

function closeNewFolderPopover() {
  newFolderPopover.hidden = true;
  newFolderNameInput.value = "";
}

function openNewFolderPopover() {
  closeGameContextMenu();
  newFolderPopover.hidden = false;
  newFolderNameInput.value = "";
  requestAnimationFrame(() => {
    newFolderNameInput.focus();
  });
}

async function createFolderFromPopover() {
  const folderName = newFolderNameInput.value.trim();
  if (!folderName) {
    newFolderNameInput.focus();
    return;
  }
  try {
    const folder = await window.nesApp.createGameFolder(currentFolder, folderName);
    focusedBrowserEntryKey = browserEntryKey(folder);
    closeNewFolderPopover();
    await loadGameDirectory(currentFolder);
    setStatus(`Created folder ${folder.name}.`);
  } catch (error) {
    setStatus(error.message || String(error));
    newFolderNameInput.focus();
  }
}

newFolderButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (newFolderPopover.hidden) {
    openNewFolderPopover();
  } else {
    closeNewFolderPopover();
  }
});

createFolderConfirm.addEventListener("click", () => {
  createFolderFromPopover();
});

createFolderCancel.addEventListener("click", () => {
  closeNewFolderPopover();
});

newFolderNameInput.addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.preventDefault();
    createFolderFromPopover();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeNewFolderPopover();
    newFolderButton.focus();
  }
});

document.addEventListener("click", (event) => {
  if (gameContextMenu && !gameContextMenu.hidden && !gameContextMenu.contains(event.target)) {
    closeGameContextMenu();
  }
  if (!newFolderPopover.hidden && !newFolderPopover.contains(event.target) && event.target !== newFolderButton) {
    closeNewFolderPopover();
  }
});

document.addEventListener("keydown", (event) => {
  const typingTarget = event.target && event.target.closest && event.target.closest("input, textarea, select");
  if (event.key === "Escape") {
    closeGameContextMenu();
    closeNewFolderPopover();
  } else if (
    event.key === "F2"
    && compatModal.hidden
    && settingsModal.hidden
    && keyCaptureModal.hidden
    && updateModal.hidden
    && !typingTarget
  ) {
    const entry = getFocusedBrowserEntry();
    if (entry) {
      event.preventDefault();
      beginInlineRename(entry);
    }
  }
});

window.addEventListener("blur", closeGameContextMenu);
window.addEventListener("resize", closeGameContextMenu);
gameList.addEventListener("scroll", closeGameContextMenu);

openSavesButton.addEventListener("click", async () => {
  try {
    const folderPath = await window.nesApp.openSavesFolder();
    setStatus(`Opened ${folderPath}`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

openSettingsButton.addEventListener("click", openSettingsModal);

volumeRange.addEventListener("input", () => {
  volumeValue.value = `${volumeRange.value}%`;
  if (draftSettings) {
    draftSettings.audio.volume = Number(volumeRange.value);
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

resolutionSelect.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.video.resolution = resolutionSelect.value;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

crtToggle.addEventListener("change", () => {
  const editableCrt = getEditableCrtSettings();
  editableCrt.enabled = crtToggle.checked;
  if (!draftSettings) {
    applyCrtSettings();
  }
  refreshSettingsSaveState();
  refreshSettingsReverts();
});

crtCustomize.addEventListener("click", () => {
  renderCrtControls();
  renderCrtPreview();
  crtModal.hidden = false;
});

crtClose.addEventListener("click", () => {
  closeCrtModal();
});

crtReset.addEventListener("click", () => {
  const editableCrt = getEditableCrtSettings();
  const wasEnabled = Boolean(editableCrt.enabled);
  const resetCrt = Object.assign({}, window.CRT_DEFAULTS || {}, { enabled: wasEnabled });
  if (draftSettings) {
    draftSettings.crt = resetCrt;
  } else {
    settings.crt = resetCrt;
    applyCrtSettings();
  }
  renderCrtControls();
  renderCrtPreview();
  refreshSettingsSaveState();
});

crtModal.addEventListener("click", (event) => {
  if (event.target === crtModal) {
    closeCrtModal();
  }
});

if (crtPreviewImage) {
  crtPreviewImage.addEventListener("load", () => {
    if (!crtModal.hidden) {
      renderCrtPreview();
    }
  });
}

autosaveEnabled.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.autosave.enabled = autosaveEnabled.checked;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

autosaveInterval.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.autosave.intervalSeconds = Number(autosaveInterval.value);
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

pauseWhenUnfocused.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.runtime = draftSettings.runtime || {};
    draftSettings.runtime.pauseWhenUnfocused = pauseWhenUnfocused.checked;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

discordRpcEnabled.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.discordRpc = draftSettings.discordRpc || {};
    draftSettings.discordRpc.enabled = discordRpcEnabled.checked;
    refreshSettingsSaveState();
    refreshSettingsReverts();
  }
});

settingsDefaults.addEventListener("click", async () => {
  try {
    const defaults = await window.nesApp.getDefaultSettings();
    defaults.crt = Object.assign({}, window.CRT_DEFAULTS || {}, defaults.crt || {});
    settingsBaseline = clone(defaults);
    loadSettingsForm(defaults);
    refreshSettingsSaveState();
    setStatus("Default settings loaded in the modal.");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

settingsCancel.addEventListener("click", closeSettingsModal);

settingsSave.addEventListener("click", async () => {
  if (!draftSettings) {
    return;
  }
  try {
    const result = await window.nesApp.writeSettings(collectSettingsForm());
    settings = result.settings;
    settingsPath = result.path;
    draftSettings = clone(settings);
    refreshSettingsSaveState();
    applySettings();
    setStatus("Settings saved.");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

settingsCheckUpdates.addEventListener("click", async () => {
  settingsCheckUpdates.disabled = true;
  setButtonLabel(settingsCheckUpdates, "Checking...");
  try {
    await checkForUpdates({ showErrors: true });
  } finally {
    settingsCheckUpdates.disabled = false;
    setButtonLabel(settingsCheckUpdates, "Check now");
  }
});

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    closeSettingsModal();
  }
});

keyCaptureCancel.addEventListener("click", closeKeyCaptureModal);

keyCaptureModal.addEventListener("click", (event) => {
  if (event.target === keyCaptureModal) {
    closeKeyCaptureModal();
  }
});

updateSkip.addEventListener("click", closeUpdateModal);

updateDownload.addEventListener("click", async () => {
  if (updateDownload.dataset.mode === "manual") {
    try {
      await window.nesApp.openManualUpdateDownload();
      closeUpdateModal();
    } catch (error) {
      setStatus(error.message || String(error));
    }
    return;
  }
  updateDownload.disabled = true;
  setButtonLabel(updateDownload, "Downloading...");
  updateMessage.textContent = "Starting update download...";
  setStatus("Downloading update...");
  const stopProgress = window.nesApp.onUpdateDownloadProgress(renderUpdateDownloadProgress);
  try {
    const result = await window.nesApp.downloadAndInstallUpdate();
    stopProgress();
    if (result && result.manual) {
      await window.nesApp.openManualUpdateDownload();
      closeUpdateModal();
      return;
    }
    if (result && result.started === false) {
      showNoUpdateModal({
        currentVersion: availableUpdate && availableUpdate.currentVersion,
        latestVersion: availableUpdate && availableUpdate.latestVersion,
      });
      return;
    }
    updateMessage.textContent = "Download complete. Starting installer...";
    setStatus("Starting installer...");
    setButtonLabel(updateDownload, "Starting...");
  } catch (error) {
    stopProgress();
    updateDownload.disabled = false;
    setButtonLabel(updateDownload, "Download now");
    setStatus(error.message || String(error));
    showUpdateErrorModal({
      currentVersion: availableUpdate && availableUpdate.currentVersion,
      error: error.message || String(error),
    });
  }
});

updateModal.addEventListener("click", (event) => {
  if (event.target === updateModal) {
    closeUpdateModal();
  }
});

footerCreditLink.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await window.nesApp.openExternal(footerCreditLink.href);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

windowMinimize.addEventListener("click", () => {
  controlWindow("minimize");
});

windowMaximize.addEventListener("click", () => {
  controlWindow("maximize");
});

windowClose.addEventListener("click", () => {
  controlWindow("close");
});

titlebar.addEventListener("dblclick", (event) => {
  if (!event.target.closest(".titlebar-control")) {
    controlWindow("maximize");
  }
});

if (window.nesApp && window.nesApp.onWindowState) {
  window.nesApp.onWindowState((state) => {
    setWindowMaximizedState(Boolean(state && state.isMaximized));
  });
}

saveButton.addEventListener("click", () => {
  saveToSlot(getSelectedSlot());
});

loadButton.addEventListener("click", () => {
  loadFromSlot(getSelectedSlot());
});

compatCancel.addEventListener("click", () => closeCompatibilityModal(false));
compatContinue.addEventListener("click", () => closeCompatibilityModal(true));
compatModal.addEventListener("click", (event) => {
  if (event.target === compatModal) {
    closeCompatibilityModal(false);
  }
});

window.addEventListener("blur", () => {
  releaseAllInputs();
  if (getPauseWhenUnfocused(settings)) {
    pauseForPageLifecycle();
  }
});
window.addEventListener("focus", () => {
  if (getPauseWhenUnfocused(settings)) {
    resumeFromPageLifecycle();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!getPauseWhenUnfocused(settings)) {
    if (document.hidden) {
      releaseAllInputs();
    }
    return;
  }
  if (document.hidden) {
    pauseForPageLifecycle();
  } else {
    resumeFromPageLifecycle();
  }
});
document.addEventListener("keydown", (event) => {
  if (keyCaptureTargetInfo && draftSettings) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      closeKeyCaptureModal();
      return;
    }
    if (event.key === "Delete" || event.key === "Del" || event.keyCode === 46) {
      setCapturedBinding(null);
      return;
    }
    setCapturedBinding({
      keyCode: event.keyCode,
      label: keyLabelFromEvent(event),
    });
    return;
  }
  if (event.key === "Escape" && !settingsModal.hidden) {
    closeSettingsModal();
    return;
  }
  if (event.key === "Escape" && !updateModal.hidden) {
    closeUpdateModal();
    return;
  }
  if (event.key === "Escape" && !compatModal.hidden) {
    closeCompatibilityModal(false);
  }
});
window.addEventListener("pagehide", pauseForPageLifecycle);
window.addEventListener("beforeunload", () => {
  saveAutoSync("before-unload");
});
window.addEventListener("pagehide", () => {
  saveAutoSync("pagehide");
});
window.addEventListener("pageshow", resumeFromPageLifecycle);

document.querySelectorAll("[data-button]").forEach((button) => {
  const input = inputForElement(button);
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    buttonDown(input);
  });
  button.addEventListener("pointerup", () => buttonUp(input));
  button.addEventListener("pointercancel", () => buttonUp(input));
  button.addEventListener("pointerleave", () => buttonUp(input));
});

async function init() {
  try {
    const version = await window.nesApp.getAppVersion();
    document.title = `NES Emulator (${version})`;
    titlebarVersion.textContent = version;
  } catch (error) {
    document.title = "NES Emulator";
    titlebarVersion.textContent = "";
  }
  try {
    const result = await window.nesApp.readSettings();
    settings = result.settings;
    settingsPath = result.path;
    applySettings();
  } catch (error) {
    setStatus(error.message || String(error));
  }
  try {
    await loadGameDirectory("");
  } catch (error) {
    folderEntries = [];
    setStatus(error.message || String(error));
  }
  const firstGame = folderEntries.find((entry) => entry.type === "game");
  if (firstGame) {
    await selectGame(firstGame, { skipCompatibilityWarning: true });
  } else {
    gameTitleEl.textContent = "NES Emulator";
    setStatus("Open a folder or add .nes files to Games.");
    renderGameList();
  }
  renderSaveSlots();
  setTimeout(checkForUpdates, 1200);
}

init();
