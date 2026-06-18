const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nesApp", {
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  listGameDirectory: (relativeDir) => ipcRenderer.invoke("games:listDirectory", relativeDir),
  listGames: () => ipcRenderer.invoke("games:list"),
  openRomFile: () => ipcRenderer.invoke("games:openFile"),
  readSettings: () => ipcRenderer.invoke("settings:read"),
  writeSettings: (settings) => ipcRenderer.invoke("settings:write", settings),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getDefaultSettings: () => ipcRenderer.invoke("settings:defaults"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadAndInstallUpdate: () => ipcRenderer.invoke("updates:downloadAndInstall"),
  openManualUpdateDownload: () => ipcRenderer.invoke("updates:openManualDownload"),
  readRom: (id) => ipcRenderer.invoke("rom:read", id),
  listSaves: (gameId) => ipcRenderer.invoke("saves:list", gameId),
  readSave: (gameId, slot) => ipcRenderer.invoke("saves:read", gameId, slot),
  writeSave: (gameId, slot, save) => ipcRenderer.invoke("saves:write", gameId, slot, save),
  writeSaveSync: (gameId, slot, save) => ipcRenderer.sendSync("saves:writeSync", gameId, slot, save),
  deleteSave: (gameId, slot) => ipcRenderer.invoke("saves:delete", gameId, slot),
  openGamesFolder: () => ipcRenderer.invoke("folder:open", "games"),
  openSavesFolder: () => ipcRenderer.invoke("folder:open", "saves"),
});
