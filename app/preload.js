const { clipboard, contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nesApp", {
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  controlWindow: (action) => ipcRenderer.invoke("window:control", action),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  copyText: (text) => clipboard.writeText(String(text || "")),
  listGameDirectory: (relativeDir) => ipcRenderer.invoke("games:listDirectory", relativeDir),
  readGameMeta: (relativePath) => ipcRenderer.invoke("games:readMeta", relativePath),
  refreshGameMeta: (relativePath) => ipcRenderer.invoke("games:refreshMeta", relativePath),
  getGameEntryPath: (relativePath) => ipcRenderer.invoke("games:getEntryPath", relativePath),
  listGames: () => ipcRenderer.invoke("games:list"),
  createGameFolder: (parentRelativeDir, folderName) => ipcRenderer.invoke("games:createFolder", parentRelativeDir, folderName),
  importRomFile: (targetRelativeDir) => ipcRenderer.invoke("games:importFile", targetRelativeDir),
  renameGameEntry: (relativePath, newName) => ipcRenderer.invoke("games:renameEntry", relativePath, newName),
  moveGameEntry: (relativePath, targetRelativeDir) => ipcRenderer.invoke("games:moveEntry", relativePath, targetRelativeDir),
  deleteGameEntry: (relativePath) => ipcRenderer.invoke("games:deleteEntry", relativePath),
  revealGameEntry: (relativePath) => ipcRenderer.invoke("games:revealEntry", relativePath),
  openRomFile: () => ipcRenderer.invoke("games:openFile"),
  readSettings: () => ipcRenderer.invoke("settings:read"),
  writeSettings: (settings) => ipcRenderer.invoke("settings:write", settings),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getDefaultSettings: () => ipcRenderer.invoke("settings:defaults"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadAndInstallUpdate: () => ipcRenderer.invoke("updates:downloadAndInstall"),
  onUpdateDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("updates:downloadProgress", listener);
    return () => ipcRenderer.removeListener("updates:downloadProgress", listener);
  },
  openManualUpdateDownload: () => ipcRenderer.invoke("updates:openManualDownload"),
  getDiscordStatus: () => ipcRenderer.invoke("discord:status"),
  setDiscordIdle: () => ipcRenderer.invoke("discord:setIdle"),
  setDiscordGame: (gameTitle, options) => ipcRenderer.invoke("discord:setGame", gameTitle, options),
  clearDiscordActivity: () => ipcRenderer.invoke("discord:clear"),
  readRom: (id) => ipcRenderer.invoke("rom:read", id),
  listSaves: (gameId) => ipcRenderer.invoke("saves:list", gameId),
  readSave: (gameId, slot) => ipcRenderer.invoke("saves:read", gameId, slot),
  writeSave: (gameId, slot, save) => ipcRenderer.invoke("saves:write", gameId, slot, save),
  writeSaveSync: (gameId, slot, save) => ipcRenderer.sendSync("saves:writeSync", gameId, slot, save),
  deleteSave: (gameId, slot) => ipcRenderer.invoke("saves:delete", gameId, slot),
  openGamesFolder: () => ipcRenderer.invoke("folder:open", "games"),
  openSavesFolder: () => ipcRenderer.invoke("folder:open", "saves"),
});
