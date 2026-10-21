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
  mutateWorkspaceRecord: (operation, section, recordId, record, recordIds) =>
    ipcRenderer.invoke(
      "workspace:mutate",
      operation,
      section,
      recordId,
      record,
      recordIds,
    ),
  exportWorkspaceCsv: (section, columnLabels, rows) =>
    ipcRenderer.invoke("workspace:export-csv", section, columnLabels, rows),
  exportWorkspacePdf: (section, htmlContent, title) =>
    ipcRenderer.invoke("workspace:export-pdf", section, htmlContent, title),
  openPrintPreview: (htmlContent, title) =>
    ipcRenderer.invoke("workspace:print-preview", htmlContent, title),
});
