// Puente seguro entre el renderer (Next.js) y el proceso principal.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  retry: () => ipcRenderer.invoke("app:retry"),
  onMaximizeChange: (cb) => {
    const handler = (_e, isMax) => cb(isMax);
    ipcRenderer.on("window:maximized", handler);
    return () => ipcRenderer.removeListener("window:maximized", handler);
  },
  isElectron: true,
});
