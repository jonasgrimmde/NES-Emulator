const statusEl = document.getElementById("status");
const gameTitleEl = document.getElementById("gameTitle");
const gameList = document.getElementById("gameList");
const gameCount = document.getElementById("gameCount");
const folderPathEl = document.getElementById("folderPath");
const upFolderButton = document.getElementById("upFolder");
const openRomButton = document.getElementById("openRom");
const refreshGamesButton = document.getElementById("refreshGames");
const openGamesButton = document.getElementById("openGames");
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
const autosaveEnabled = document.getElementById("autosaveEnabled");
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
let keyCaptureTargetInfo = null;
let autosaveTimerId = 0;
let autosaveInProgress = false;
let lastAutosaveAt = 0;
let availableUpdate = null;

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
  applyVolume();
  applyKeybinds();
  startAutosaveTimer();
}

function renderKeybindEditor() {
  keybindGrid.innerHTML = "";
  for (const [group, button, label] of keybindButtons) {
    const keybind = getKeybind(group, button);
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
    keybindGrid.append(buttonEl);
  }
}

function renderHotkeyEditor() {
  hotkeyGrid.innerHTML = "";
  for (const [action, label] of hotkeyButtons) {
    const hotkey = getHotkey(action);
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
    hotkeyGrid.append(buttonEl);
  }
}

function loadSettingsForm(source) {
  draftSettings = clone(source);
  volumeRange.value = String(draftSettings.audio.volume);
  volumeValue.value = `${draftSettings.audio.volume}%`;
  resolutionSelect.value = draftSettings.video.resolution;
  autosaveEnabled.checked = Boolean(draftSettings.autosave && draftSettings.autosave.enabled);
  renderKeybindEditor();
  renderHotkeyEditor();
}

function collectSettingsForm() {
  draftSettings.audio.volume = Number(volumeRange.value);
  draftSettings.video.resolution = resolutionSelect.value;
  draftSettings.autosave = draftSettings.autosave || {};
  draftSettings.autosave.enabled = autosaveEnabled.checked;
  return draftSettings;
}

function closeSettingsModal() {
  settingsModal.hidden = true;
  closeKeyCaptureModal();
  draftSettings = null;
}

function openSettingsModal() {
  if (!settings) {
    return;
  }
  settingsPathEl.textContent = settingsPath;
  settingsPathEl.title = settingsPath;
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
  updateMessage.textContent = "A new installer will be downloaded and started.";
  updateVersionLabel.textContent = "Version";
  updateVersion.textContent = `${update.currentVersion} -> ${update.latestVersion}`;
  updateDateLabel.textContent = "Date";
  updateDate.textContent = update.releaseDate ? formatSavedAt(update.releaseDate) : "Unknown";
  updateDownload.disabled = false;
  updateDownload.hidden = false;
  setButtonLabel(updateSkip, "Skip");
  setButtonLabel(updateDownload, "Download now");
  updateDownload.dataset.mode = "download";
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
  closeKeyCaptureModal();
}

function getGameMetaLabel(game) {
  if (!game || !game.meta) {
    return "ROM info unavailable";
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
  return new Uint8Array(await window.nesApp.readRom(currentGame.id));
}

async function createBrowser() {
  configureAudioRate();
  applyKeybinds();
  browser = new jsnes.Browser({
    container: document.getElementById("nes"),
    onError: (error) => setStatus(error.message || String(error)),
  });
  stabilizeRuntime();
  browser.nes.loadROM(await loadRom());
  browser.nes.setFramerate(framesPerSecond);
  syncAudioRate();
  applySettings();
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
  if (elapsed >= frameIntervalMs) {
    lastFrameTime = timestamp - (elapsed % frameIntervalMs);
    try {
      browser.nes.frame();
      browser._speakers.flush();
      browser._screen.writeBuffer();
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
}

function stopEmulation() {
  running = false;
  pausedByPage = false;
  stopAutosaveTimer();
  if (browser) {
    stopFrameLoop();
    if (browser._speakers) {
      browser._speakers.stop();
    }
    clearInterval(browser._fpsInterval);
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
  renderGameList();
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
  }
  currentGame = game;
  selectedGame = game;
  selectedSlot = readSelectedSlot();
  pausedByPage = false;
  setButtonLabel(pauseButton, "Pause");
  setRunControlsEnabled(false);
  gameTitleEl.textContent = game.title;
  await refreshSaveMeta();
  renderGameList();
  renderSaveSlots();
}

function renderGameList() {
  gameList.innerHTML = "";
  const folders = folderEntries.filter((entry) => entry.type === "folder");
  const games = folderEntries.filter((entry) => entry.type === "game");
  gameCount.textContent = `${folders.length} dirs / ${games.length} games`;
  folderPathEl.textContent = currentFolder ? `Games / ${currentFolder}` : "Games";
  folderPathEl.title = folderPathEl.textContent;
  upFolderButton.disabled = !currentFolder;

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

  entries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "option");

    if (entry.type === "folder") {
      item.className = "game-item folder-entry";
      item.title = `Games / ${entry.relativePath}`;
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-folder" aria-hidden="true"></i></span><span class="entry-text">${escapeHtml(entry.name)}</span></div>
      `;
      item.addEventListener("click", () => loadGameDirectory(entry.relativePath));
    } else {
      rememberGame(entry);
      const isUnsupported = entry.meta && entry.meta.compatibility && entry.meta.compatibility !== "supported";
      const isSelected = getSelectedGame() && getSelectedGame().id === entry.id;
      item.className = "game-item file-entry"
        + (isSelected ? " active" : "")
        + (isUnsupported ? " warning" : "");
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
      item.title = entry.source === "external" ? entry.relativePath : `Games / ${entry.relativePath}`;
      item.innerHTML = `
        <div class="game-name"><span class="entry-icon"><i class="fa-solid fa-gamepad" aria-hidden="true"></i></span><span class="entry-text">${escapeHtml(entry.title)}</span></div>
        <div class="game-meta">${escapeHtml(getGameMetaLabel(entry))}</div>
      `;
      item.addEventListener("click", () => selectGame(entry));
      item.addEventListener("dblclick", async () => {
        const selected = await selectGame(entry);
        if (selected) {
          await startSelectedGame();
        }
      });
    }
    gameList.append(item);
  });
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
  } else {
    startEmulation();
    setButtonLabel(pauseButton, "Pause");
    setStatus("Running.");
  }
});

resetButton.addEventListener("click", () => {
  if (browser) {
    browser.nes.reset();
    setStatus("Reset.");
  }
});

openGamesButton.addEventListener("click", async () => {
  try {
    const folderPath = await window.nesApp.openGamesFolder();
    setStatus(`Opened ${folderPath}`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

openRomButton.addEventListener("click", async () => {
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

upFolderButton.addEventListener("click", async () => {
  if (!currentFolder) {
    return;
  }
  try {
    const parentFolder = currentFolder.split("/").slice(0, -1).join("/");
    await loadGameDirectory(parentFolder);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

refreshGamesButton.addEventListener("click", async () => {
  try {
    await reloadGameList();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

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
});

resolutionSelect.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.video.resolution = resolutionSelect.value;
  }
});

autosaveEnabled.addEventListener("change", () => {
  if (draftSettings) {
    draftSettings.autosave.enabled = autosaveEnabled.checked;
  }
});

settingsDefaults.addEventListener("click", async () => {
  try {
    loadSettingsForm(await window.nesApp.getDefaultSettings());
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
    applySettings();
    closeSettingsModal();
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
  setStatus("Downloading update...");
  try {
    await window.nesApp.downloadAndInstallUpdate();
    setStatus("Starting installer...");
    setButtonLabel(updateDownload, "Starting...");
  } catch (error) {
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
  pauseForPageLifecycle();
});
window.addEventListener("focus", resumeFromPageLifecycle);
document.addEventListener("visibilitychange", () => {
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
  } catch (error) {
    document.title = "NES Emulator";
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
