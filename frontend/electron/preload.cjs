const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getBackendStatus: () => ipcRenderer.invoke("backend:status"),
  getSession: () => ipcRenderer.invoke("auth:get-session"),
  login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
  logout: () => ipcRenderer.invoke("auth:logout"),
  listWorkspaceSection: (section) => ipcRenderer.invoke("workspace:list", section),
  createWorkspaceRecord: (section, record) =>
    ipcRenderer.invoke("workspace:create", section, record),
  mutateWorkspaceRecord: (operation, section, recordId, record) =>
    ipcRenderer.invoke(
      "workspace:mutate",
      operation,
      section,
      recordId,
      record,
    ),
});
